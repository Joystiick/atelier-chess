import { requireUser } from "@/lib/auth/requireUser";
import {
  generateGameCode,
  generateJoinTicket,
  generatePlayerToken,
} from "@/lib/codes";
import { db } from "@/lib/db";
import { games, kioskSessions, users } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { and, eq, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Create a walk-up booth with two phone QR slots. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    timeControl?: TimeControlId;
  };
  const tcId =
    body.timeControl && body.timeControl in TIME_CONTROLS
      ? body.timeControl
      : ("10|0" as TimeControlId);

  const booth = `booth-${generateJoinTicket()}`;
  const tokenA = `${booth}-a-${generateJoinTicket()}`;
  const tokenB = `${booth}-b-${generateJoinTicket()}`;

  await db.insert(kioskSessions).values([
    { token: tokenA, matchedCode: null },
    { token: tokenB, matchedCode: null },
  ]);

  return NextResponse.json({
    booth,
    timeControl: tcId,
    slots: [
      { role: "a", token: tokenA },
      { role: "b", token: tokenB },
    ],
  });
}

async function slotsForBooth(booth: string) {
  return db
    .select()
    .from(kioskSessions)
    .where(like(kioskSessions.token, `${booth}-%`));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const booth = url.searchParams.get("booth") ?? "";
  const tcId = (url.searchParams.get("tc") ?? "10|0") as TimeControlId;
  if (!booth.startsWith("booth-")) {
    return NextResponse.json({ error: "Missing booth" }, { status: 400 });
  }

  const slots = await slotsForBooth(booth);
  if (slots.length < 2) {
    return NextResponse.json({ error: "Booth not found" }, { status: 404 });
  }

  const people = await Promise.all(
    slots.map(async (s) => {
      if (!s.userId) {
        return {
          token: s.token,
          user: null as null | { id: string; username: string; elo: number },
        };
      }
      const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
      return {
        token: s.token,
        user: u ? { id: u.id, username: u.username, elo: u.elo } : null,
      };
    }),
  );

  const ready = people.every((p) => p.user);
  let pair: {
    code: string;
    white: { username: string; seatPath: string };
    black: { username: string; seatPath: string };
  } | null = null;

  const existingCode = slots.find((s) => s.matchedCode && /^\d{8}$/.test(s.matchedCode))
    ?.matchedCode;

  if (existingCode) {
    const [g] = await db.select().from(games).where(eq(games.code, existingCode)).limit(1);
    if (g?.whiteToken && g.blackToken) {
      pair = {
        code: g.code,
        white: {
          username: g.whiteName ?? "White",
          seatPath: `/seat/${g.code}?c=w&t=${g.whiteToken}`,
        },
        black: {
          username: g.blackName ?? "Black",
          seatPath: `/seat/${g.code}?c=b&t=${g.blackToken}`,
        },
      };
    }
  } else if (ready && people[0]?.user && people[1]?.user) {
    const a = people[0].user;
    const b = people[1].user;
    const white = a.elo >= b.elo ? a : b;
    const black = white.id === a.id ? b : a;
    const tcKey = tcId in TIME_CONTROLS ? tcId : ("10|0" as TimeControlId);
    const tc = TIME_CONTROLS[tcKey];
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

        const ids = slots.map((s) => s.id);
        for (const id of ids) {
          await db
            .update(kioskSessions)
            .set({ matchedCode: row.code })
            .where(eq(kioskSessions.id, id));
        }

        pair = {
          code: row.code,
          white: {
            username: white.username,
            seatPath: `/seat/${row.code}?c=w&t=${whiteToken}`,
          },
          black: {
            username: black.username,
            seatPath: `/seat/${row.code}?c=b&t=${blackToken}`,
          },
        };
        break;
      } catch {
        code = generateGameCode();
      }
    }
  }

  return NextResponse.json({
    booth,
    slots: people,
    ready,
    pair,
    gameCode: pair?.code ?? null,
  });
}

/** Phone claims a slot after login. */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const [slot] = await db
    .select()
    .from(kioskSessions)
    .where(eq(kioskSessions.token, token))
    .limit(1);
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (slot.userId && slot.userId !== me.id) {
    return NextResponse.json({ error: "Slot already taken" }, { status: 409 });
  }

  const boothMatch = token.match(/^(booth-[^-]+)/);
  if (boothMatch) {
    const siblings = await db
      .select()
      .from(kioskSessions)
      .where(
        and(
          like(kioskSessions.token, `${boothMatch[1]}-%`),
          eq(kioskSessions.userId, me.id),
        ),
      );
    if (siblings.some((s) => s.token !== token)) {
      return NextResponse.json(
        { error: "You're already in the other slot" },
        { status: 409 },
      );
    }
  }

  await db
    .update(kioskSessions)
    .set({ userId: me.id })
    .where(eq(kioskSessions.token, token));

  return NextResponse.json({ ok: true, token });
}

void or;
