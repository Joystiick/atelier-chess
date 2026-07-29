import { requireUser } from "@/lib/auth/requireUser";
import { hashPassword } from "@/lib/auth/session";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import {
  generateGameCode,
  generateJoinTicket,
  generatePlayerToken,
} from "@/lib/codes";
import { db } from "@/lib/db";
import { friendships, gameInvites, games } from "@/lib/db/schema";
import { isDesktopRequest } from "@/lib/desktop/guard";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { touchPresence } from "@/lib/notify";
import { gameChannel, getPusher, userChannel } from "@/lib/pusher/server";
import { and, eq, or } from "drizzle-orm";
import { cookies } from "next/headers";
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

export async function POST(request: Request) {
  const rl = rateLimit(`create:${clientKey(request)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many tables — wait a moment" },
      { status: 429 },
    );
  }

  if (!(await isDesktopRequest(request))) {
    return NextResponse.json(
      { error: "Create tables from the Atelier desktop app" },
      { status: 403 },
    );
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    timeControl?: TimeControlId;
    inviteFriendId?: string;
    rated?: boolean;
    correspondence?: boolean;
    password?: string;
    maxSpectators?: number;
    revealNames?: boolean;
    clubId?: string;
    blindfoldCafe?: boolean;
    salonNightId?: string;
    tablecast?: boolean;
  };
  const tcId =
    body.timeControl && body.timeControl in TIME_CONTROLS
      ? body.timeControl
      : ("10|0" as TimeControlId);
  const tc = TIME_CONTROLS[tcId];
  const token = generatePlayerToken();
  const inviteFriendId = body.inviteFriendId?.trim() || null;

  if (inviteFriendId) {
    if (!(await areFriends(me.id, inviteFriendId))) {
      return NextResponse.json({ error: "Not friends" }, { status: 403 });
    }
  }

  const passwordHash =
    body.password && body.password.length > 0
      ? await hashPassword(body.password)
      : null;

  const maxSpectators = Math.min(
    Math.max(Number(body.maxSpectators) || 50, 0),
    200,
  );

  const joinTicket = generateJoinTicket();
  let code = generateGameCode();
  for (let i = 0; i < 5; i++) {
    try {
      const [row] = await db
        .insert(games)
        .values({
          code,
          status: "waiting",
          whiteName: me.username,
          whiteToken: token,
          whiteUserId: me.id,
          whiteClockMs: tc.baseMs,
          blackClockMs: tc.baseMs,
          timeControlMs: tc.baseMs,
          incrementMs: tc.incMs,
          rated: body.rated !== false,
          correspondence: Boolean(body.correspondence),
          passwordHash,
          maxSpectators,
          revealNames: body.revealNames !== false,
          clubId: body.clubId || null,
          joinTicket,
          blindfoldCafe: Boolean(body.blindfoldCafe),
          salonNightId: body.salonNightId || null,
          tablecast: Boolean(body.tablecast),
        })
        .returning();

      const jar = await cookies();
      jar.set(`atelier_seat_${code}`, `w:${token}`, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      await touchPresence(me.id, "ingame", row.code);

      if (row.tablecast) {
        try {
          await getPusher().trigger(gameChannel(row.code), "tablecast.opened", {
            code: row.code,
            at: Date.now(),
          });
        } catch {
          // optional — channel may have no subscribers yet
        }
      }

      if (inviteFriendId) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [invite] = await db
          .insert(gameInvites)
          .values({
            gameCode: code,
            fromUserId: me.id,
            toUserId: inviteFriendId,
            status: "pending",
            expiresAt,
          })
          .returning();

        try {
          await getPusher().trigger(userChannel(inviteFriendId), "game.invite", {
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
      }

      return NextResponse.json({
        code: row.code,
        color: "w" as const,
        displayName: me.username,
        timeControl: tcId,
        invited: Boolean(inviteFriendId),
        rated: row.rated,
        correspondence: row.correspondence,
        joinTicket: row.joinTicket,
        blindfoldCafe: row.blindfoldCafe,
        tablecast: row.tablecast,
      });
    } catch {
      code = generateGameCode();
    }
  }

  return NextResponse.json({ error: "Could not create table" }, { status: 500 });
}
