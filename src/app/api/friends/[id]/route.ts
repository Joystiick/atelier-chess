import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { friendships, users } from "@/lib/db/schema";
import { notifyUser } from "@/lib/notify";
import { getPusher, userChannel } from "@/lib/pusher/server";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "accept" | "decline";
  };
  const action = body.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.id, id), eq(friendships.addresseeId, me.id)))
    .limit(1);

  if (!row || row.status !== "pending") {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (action === "decline") {
    await db.delete(friendships).where(eq(friendships.id, id));
    return NextResponse.json({ ok: true, status: "declined" });
  }

  await db
    .update(friendships)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendships.id, id));

  const [meRow] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);

  await notifyUser({
    userId: row.requesterId,
    kind: "friend",
    title: "Friend request accepted",
    body: `${meRow?.username ?? me.username} accepted your friend request`,
    href: "/friends",
  });

  try {
    await getPusher().trigger(userChannel(row.requesterId), "friend.accepted", {
      userId: me.id,
      username: meRow?.username ?? me.username,
    });
  } catch {
    // optional
  }

  return NextResponse.json({ ok: true, status: "accepted" });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { id } = await params;

  const [byFriendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, id))
    .limit(1);

  let row = byFriendship ?? null;
  if (!row) {
    const [byUser] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(
            and(
              eq(friendships.requesterId, me.id),
              eq(friendships.addresseeId, id),
            ),
            and(
              eq(friendships.requesterId, id),
              eq(friendships.addresseeId, me.id),
            ),
          ),
        ),
      )
      .limit(1);
    row = byUser ?? null;
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.requesterId !== me.id && row.addresseeId !== me.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(friendships).where(eq(friendships.id, row.id));
  return NextResponse.json({ ok: true });
}
