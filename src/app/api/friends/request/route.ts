import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { friendships, users } from "@/lib/db/schema";
import { notifyUser } from "@/lib/notify";
import { getPusher, userChannel } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rl = rateLimit(`friend-req:${clientKey(request)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as { username?: string };
  const username = (body.username ?? "").trim();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requesterId, me.id),
          eq(friendships.addresseeId, target.id),
        ),
        and(
          eq(friendships.requesterId, target.id),
          eq(friendships.addresseeId, me.id),
        ),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "Already friends" }, { status: 409 });
    }
    if (existing.status === "pending") {
      // If they already requested us, auto-accept
      if (existing.requesterId === target.id && existing.addresseeId === me.id) {
        await db
          .update(friendships)
          .set({ status: "accepted", updatedAt: new Date() })
          .where(eq(friendships.id, existing.id));
        await notifyUser({
          userId: target.id,
          kind: "friend",
          title: "Friend request accepted",
          body: `${me.username} accepted your friend request`,
          href: "/friends",
        });
        try {
          await getPusher().trigger(userChannel(target.id), "friend.accepted", {
            userId: me.id,
            username: me.username,
          });
        } catch {
          // optional
        }
        return NextResponse.json({ ok: true, status: "accepted" });
      }
      return NextResponse.json({ error: "Request already pending" }, { status: 409 });
    }
    return NextResponse.json({ error: "Cannot send request" }, { status: 409 });
  }

  const [row] = await db
    .insert(friendships)
    .values({
      requesterId: me.id,
      addresseeId: target.id,
      status: "pending",
    })
    .returning();

  try {
    await getPusher().trigger(userChannel(target.id), "friend.request", {
      friendshipId: row.id,
      from: { id: me.id, username: me.username, avatarId: me.avatarId },
    });
  } catch {
    // optional
  }

  return NextResponse.json({ ok: true, friendshipId: row.id, status: "pending" });
}
