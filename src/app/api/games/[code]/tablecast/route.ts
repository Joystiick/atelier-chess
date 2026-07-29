import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

type Action =
  | "open"
  | "spectator_join"
  | "spectator_leave"
  | "spectator_ping"
  | "seat_surface";

type Body = {
  action?: Action;
  surface?: "phone" | "desktop";
};

/**
 * Tablecast realtime helpers — open mode, gallery count, seat surface hints.
 * Does not grant move rights.
 */
export async function POST(request: Request, { params }: Params) {
  const rl = rateLimit(`tablecast:${clientKey(request)}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  let you: "w" | "b" | null = null;
  if (seat) {
    const [color, token] = seat.split(":");
    if (color === "w" && token === game.whiteToken) you = "w";
    if (color === "b" && token === game.blackToken) you = "b";
  }

  try {
    switch (action) {
      case "open": {
        if (you !== "w") {
          return NextResponse.json({ error: "Host only" }, { status: 403 });
        }
        const [row] = await db
          .update(games)
          .set({ tablecast: true, updatedAt: new Date() })
          .where(eq(games.code, code))
          .returning();
        await getPusher().trigger(gameChannel(code), "tablecast.opened", {
          code,
          at: Date.now(),
        });
        return NextResponse.json({
          ok: true,
          tablecast: true,
          spectatorCount: row.spectatorCount,
        });
      }
      case "spectator_join": {
        const max = Math.max(game.maxSpectators || 50, 1);
        const count = Math.min(game.spectatorCount + 1, max);
        const [row] = await db
          .update(games)
          .set({ spectatorCount: count, updatedAt: new Date() })
          .where(eq(games.code, code))
          .returning();
        await getPusher().trigger(gameChannel(code), "tablecast.spectator_count", {
          count: row.spectatorCount,
          at: Date.now(),
        });
        return NextResponse.json({ ok: true, spectatorCount: row.spectatorCount });
      }
      case "spectator_ping": {
        // Keep gallery "live" without inflating count — rebroadcast current.
        await getPusher().trigger(gameChannel(code), "tablecast.spectator_count", {
          count: Math.max(game.spectatorCount, 1),
          at: Date.now(),
        });
        return NextResponse.json({
          ok: true,
          spectatorCount: Math.max(game.spectatorCount, 1),
        });
      }
      case "spectator_leave": {
        await db
          .update(games)
          .set({
            spectatorCount: sql`GREATEST(${games.spectatorCount} - 1, 0)`,
            updatedAt: new Date(),
          })
          .where(eq(games.code, code));
        const [row] = await db
          .select({ spectatorCount: games.spectatorCount })
          .from(games)
          .where(eq(games.code, code))
          .limit(1);
        const count = row?.spectatorCount ?? 0;
        await getPusher().trigger(gameChannel(code), "tablecast.spectator_count", {
          count,
          at: Date.now(),
        });
        return NextResponse.json({ ok: true, spectatorCount: count });
      }
      case "seat_surface": {
        if (!you) {
          return NextResponse.json({ error: "Seat required" }, { status: 403 });
        }
        const surface = body.surface === "phone" ? "phone" : "desktop";
        await getPusher().trigger(gameChannel(code), "tablecast.seat_surface", {
          color: you,
          surface,
          at: Date.now(),
        });
        return NextResponse.json({ ok: true, color: you, surface });
      }
      default: {
        const _exhaustive: never = action;
        return NextResponse.json(
          { error: `Unknown action: ${String(_exhaustive)}` },
          { status: 400 },
        );
      }
    }
  } catch {
    return NextResponse.json({ error: "Realtime unavailable" }, { status: 503 });
  }
}
