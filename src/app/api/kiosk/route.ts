import { readSession } from "@/lib/auth/session";
import {
  generateGameCode,
  generateJoinTicket,
  generatePlayerToken,
} from "@/lib/codes";
import { db } from "@/lib/db";
import { games, kioskSessions, users } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { getPusher, gameChannel } from "@/lib/pusher/server";
import { tablecastHostPaths } from "@/lib/tablecast/paths";
import { and, eq, like } from "drizzle-orm";
import { NextResponse } from "next/server";

type SlotPerson = {
  token: string;
  user: { id: string | null; username: string; elo: number; guest: boolean } | null;
};

function guestLabel(matchedCode: string | null): string | null {
  if (!matchedCode?.startsWith("guest:")) return null;
  const name = matchedCode.slice(6).trim().slice(0, 20);
  return name || "Guest";
}

function sanitizeGuestName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, 20);
  return cleaned || `Guest${Math.floor(Math.random() * 900 + 100)}`;
}

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

  const people: SlotPerson[] = await Promise.all(
    slots.map(async (s) => {
      if (s.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
        return {
          token: s.token,
          user: u
            ? { id: u.id, username: u.username, elo: u.elo, guest: false }
            : null,
        };
      }
      const guest = guestLabel(s.matchedCode);
      if (guest) {
        return {
          token: s.token,
          user: { id: null, username: guest, elo: 1200, guest: true },
        };
      }
      return { token: s.token, user: null };
    }),
  );

  const ready = people.every((p) => p.user);
  let pair: {
    code: string;
    tablecast?: boolean;
    hostPath?: string;
    gamePath?: string;
    watchPath?: string;
    broadcastPath?: string;
    white: { username: string; seatPath: string };
    black: { username: string; seatPath: string };
  } | null = null;

  const existingCode = slots.find((s) => s.matchedCode && /^\d{8}$/.test(s.matchedCode))
    ?.matchedCode;

  if (existingCode) {
    const [g] = await db.select().from(games).where(eq(games.code, existingCode)).limit(1);
    if (g?.whiteToken && g.blackToken) {
      const paths = tablecastHostPaths(g.code, {
        whiteToken: g.whiteToken,
        blackToken: g.blackToken,
      });
      pair = {
        code: g.code,
        ...paths,
        white: {
          username: g.whiteName ?? "White",
          seatPath: paths.whiteSeatPath,
        },
        black: {
          username: g.blackName ?? "Black",
          seatPath: paths.blackSeatPath,
        },
      };
    }
  } else if (ready && people[0]?.user && people[1]?.user) {
    const a = people[0].user;
    const b = people[1].user;
    let w = a;
    let bl = b;
    if (!a.guest && !b.guest) {
      w = a.elo >= b.elo ? a : b;
      bl = w === a ? b : a;
    }
    const tcKey = tcId in TIME_CONTROLS ? tcId : ("10|0" as TimeControlId);
    const tc = TIME_CONTROLS[tcKey];
    const whiteToken = generatePlayerToken();
    const blackToken = generatePlayerToken();
    const anyGuest = w.guest || bl.guest;
    let code = generateGameCode();
    for (let i = 0; i < 5; i++) {
      try {
        const [row] = await db
          .insert(games)
          .values({
            code,
            status: "active",
            whiteName: w.username,
            blackName: bl.username,
            whiteToken,
            blackToken,
            whiteUserId: w.id,
            blackUserId: bl.id,
            whiteClockMs: tc.baseMs,
            blackClockMs: tc.baseMs,
            timeControlMs: tc.baseMs,
            incrementMs: tc.incMs,
            rated: !anyGuest,
            tablecast: true,
          })
          .returning();

        const ids = slots.map((s) => s.id);
        for (const id of ids) {
          await db
            .update(kioskSessions)
            .set({ matchedCode: row.code })
            .where(eq(kioskSessions.id, id));
        }

        const paths = tablecastHostPaths(row.code, {
          whiteToken,
          blackToken,
        });
        try {
          await getPusher().trigger(gameChannel(row.code), "tablecast.opened", {
            code: row.code,
          });
        } catch {
          // optional
        }

        pair = {
          code: row.code,
          ...paths,
          white: {
            username: w.username,
            seatPath: paths.whiteSeatPath,
          },
          black: {
            username: bl.username,
            seatPath: paths.blackSeatPath,
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

/** Phone claims a slot — account or guest seat token. */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    guestName?: string;
    asGuest?: boolean;
  };
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

  const me = await readSession();
  const wantGuest = Boolean(body.asGuest) || (!me && Boolean(body.guestName));

  if (wantGuest) {
    if (slot.userId || guestLabel(slot.matchedCode)) {
      return NextResponse.json({ error: "Slot already taken" }, { status: 409 });
    }
    const name = sanitizeGuestName(body.guestName ?? "");
    await db
      .update(kioskSessions)
      .set({ userId: null, matchedCode: `guest:${name}` })
      .where(eq(kioskSessions.token, token));
    return NextResponse.json({ ok: true, token, guest: true, username: name });
  }

  if (!me) {
    return NextResponse.json({ error: "Sign in or join as guest" }, { status: 401 });
  }

  if (slot.userId && slot.userId !== me.id) {
    return NextResponse.json({ error: "Slot already taken" }, { status: 409 });
  }
  if (!slot.userId && guestLabel(slot.matchedCode)) {
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
    .set({ userId: me.id, matchedCode: null })
    .where(eq(kioskSessions.token, token));

  return NextResponse.json({ ok: true, token, guest: false });
}
