import { requireUser } from "@/lib/auth/requireUser";
import { avatarEmoji } from "@/lib/auth/avatars";
import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { friendships, gameInvites, games, users } from "@/lib/db/schema";
import { getPusher, userChannel } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { NextResponse } from "next/server";

async function areFriends(a: string, b: string) {
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
          and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** List pending game invites for me */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const rows = await db
    .select()
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.toUserId, me.id),
        eq(gameInvites.status, "pending"),
        gt(gameInvites.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(gameInvites.createdAt))
    .limit(20);

  const fromIds = [...new Set(rows.map((r) => r.fromUserId))];
  const people =
    fromIds.length === 0
      ? []
      : await db.select().from(users).where(or(...fromIds.map((id) => eq(users.id, id))));
  const byId = new Map(people.map((p) => [p.id, p]));

  return NextResponse.json({
    invites: rows.map((r) => {
      const from = byId.get(r.fromUserId);
      return {
        id: r.id,
        code: r.gameCode,
        from: from
          ? {
              id: from.id,
              username: from.username,
              avatarId: from.avatarId,
              avatar: avatarEmoji(from.avatarId),
              elo: from.elo,
            }
          : null,
        createdAt: r.createdAt,
      };
    }),
  });
}

/** Invite a friend to an existing waiting table */
export async function POST(request: Request) {
  const rl = rateLimit(`invite:${clientKey(request)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    friendId?: string;
    code?: string;
  };
  const friendId = body.friendId ?? "";
  const code = (body.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!friendId || !isValidCode(code)) {
    return NextResponse.json({ error: "friendId and code required" }, { status: 400 });
  }

  if (!(await areFriends(me.id, friendId))) {
    return NextResponse.json({ error: "Not friends" }, { status: 403 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game || game.status !== "waiting") {
    return NextResponse.json({ error: "Table not open" }, { status: 409 });
  }
  if (game.whiteUserId !== me.id) {
    return NextResponse.json({ error: "Only the host can invite" }, { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const [invite] = await db
    .insert(gameInvites)
    .values({
      gameCode: code,
      fromUserId: me.id,
      toUserId: friendId,
      status: "pending",
      expiresAt,
    })
    .returning();

  try {
    await getPusher().trigger(userChannel(friendId), "game.invite", {
      inviteId: invite.id,
      code,
      from: {
        id: me.id,
        username: me.username,
        avatarId: me.avatarId,
      },
    });
  } catch {
    // optional
  }

  return NextResponse.json({ ok: true, inviteId: invite.id });
}
