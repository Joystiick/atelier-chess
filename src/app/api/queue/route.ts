import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { matchQueue, users, games } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { notifyUser, touchPresence } from "@/lib/notify";
import { getPusher, userChannel } from "@/lib/pusher/server";
import { and, eq, gt, ne, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ELO_BAND = 200;

async function createRankedGame(
  white: { id: string; username: string; elo: number },
  black: { id: string; username: string; elo: number },
  tcId: TimeControlId,
) {
  const tc = TIME_CONTROLS[tcId];
  const whiteToken = generatePlayerToken();
  const blackToken = generatePlayerToken();

  let code = generateGameCode();
  for (let i = 0; i < 5; i++) {
    try {
      const [row] = await db
        .insert(games)
        .values({
          code,
          status: "active",
          whiteName: white.username,
          blackName: black.username,
          whiteToken,
          blackToken,
          whiteUserId: white.id,
          blackUserId: black.id,
          whiteClockMs: tc.baseMs,
          blackClockMs: tc.baseMs,
          timeControlMs: tc.baseMs,
          incrementMs: tc.incMs,
          rated: true,
        })
        .returning();

      await touchPresence(white.id, "ingame", row.code);
      await touchPresence(black.id, "ingame", row.code);

      return { code: row.code, whiteToken, blackToken };
    } catch {
      code = generateGameCode();
    }
  }
  return null;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const [entry] = await db
    .select()
    .from(matchQueue)
    .where(eq(matchQueue.userId, me.id))
    .limit(1);

  if (entry) {
    return NextResponse.json({
      queued: true,
      matched: false,
      timeControl: entry.timeControl,
      elo: entry.elo,
      since: entry.createdAt.toISOString(),
    });
  }

  // If recently matched, surface the active table so pollers can join
  const recent = new Date(Date.now() - 3 * 60_000);
  const [active] = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.status, "active"),
        gt(games.createdAt, recent),
        or(eq(games.whiteUserId, me.id), eq(games.blackUserId, me.id)),
      ),
    )
    .limit(1);

  if (active) {
    return NextResponse.json({
      queued: false,
      matched: true,
      code: active.code,
    });
  }

  return NextResponse.json({ queued: false, matched: false });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    timeControl?: TimeControlId;
  };
  const tcId =
    body.timeControl && body.timeControl in TIME_CONTROLS
      ? body.timeControl
      : ("10|0" as TimeControlId);

  const [meRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, me.id))
    .limit(1);
  if (!meRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Clear any prior queue entry for this user
  await db.delete(matchQueue).where(eq(matchQueue.userId, me.id));

  const candidates = await db
    .select()
    .from(matchQueue)
    .where(
      and(
        eq(matchQueue.timeControl, tcId),
        ne(matchQueue.userId, me.id),
      ),
    );

  const match = candidates.find(
    (c) => Math.abs(c.elo - meRow.elo) <= ELO_BAND,
  );

  if (match) {
    const [opp] = await db
      .select()
      .from(users)
      .where(eq(users.id, match.userId))
      .limit(1);
    if (!opp) {
      await db.delete(matchQueue).where(eq(matchQueue.id, match.id));
    } else {
      // Higher elo plays white for a simple deterministic seat
      const white =
        meRow.elo >= opp.elo
          ? { id: meRow.id, username: meRow.username, elo: meRow.elo }
          : { id: opp.id, username: opp.username, elo: opp.elo };
      const black =
        white.id === meRow.id
          ? { id: opp.id, username: opp.username, elo: opp.elo }
          : { id: meRow.id, username: meRow.username, elo: meRow.elo };

      const created = await createRankedGame(white, black, tcId);
      if (!created) {
        return NextResponse.json(
          { error: "Could not create match" },
          { status: 500 },
        );
      }

      await db.delete(matchQueue).where(eq(matchQueue.id, match.id));

      const myColor = white.id === me.id ? "w" : "b";
      const myToken =
        myColor === "w" ? created.whiteToken : created.blackToken;
      const jar = await cookies();
      jar.set(`atelier_seat_${created.code}`, `${myColor}:${myToken}`, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      await notifyUser({
        userId: opp.id,
        kind: "match",
        title: "Ranked match found",
        body: `You were matched against ${me.username}`,
        href: `/game/${created.code}`,
      });

      try {
        await getPusher().trigger(userChannel(opp.id), "queue.match", {
          code: created.code,
          opponent: me.username,
        });
      } catch {
        // optional
      }

      return NextResponse.json({
        matched: true,
        code: created.code,
        color: myColor,
        timeControl: tcId,
      });
    }
  }

  await db.insert(matchQueue).values({
    userId: me.id,
    timeControl: tcId,
    elo: meRow.elo,
  });
  await touchPresence(me.id, "lfg");

  return NextResponse.json({
    matched: false,
    queued: true,
    timeControl: tcId,
  });
}

export async function DELETE() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  await db.delete(matchQueue).where(eq(matchQueue.userId, me.id));
  await touchPresence(me.id, "online");

  return NextResponse.json({ ok: true, queued: false });
}
