import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

async function seatOf(code: string, game: typeof games.$inferSelect) {
  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return null;
  const [color, token] = seat.split(":") as ["w" | "b", string];
  if (color === "w" && token === game.whiteToken) return "w" as const;
  if (color === "b" && token === game.blackToken) return "b" as const;
  return null;
}

export async function POST(request: Request, { params }: Params) {
  const rl = rateLimit(`action:${clientKey(request)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?:
      | "offer-draw"
      | "accept-draw"
      | "decline-draw"
      | "offer-takeback"
      | "accept-takeback"
      | "decline-takeback"
      | "abort";
  };

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const color = await seatOf(code, game);
  if (!color) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const action = body.action;
  if (!action) return NextResponse.json({ error: "Bad action" }, { status: 400 });

  if (action === "abort") {
    if (game.status !== "waiting" && game.status !== "active") {
      return NextResponse.json({ error: "Cannot abort" }, { status: 409 });
    }
    // Abort only in waiting or first few plies — check move count loosely via pgn
    const plyGuess = game.pgn.trim() ? game.pgn.split(/\s+/).length : 0;
    if (game.status === "active" && plyGuess > 4) {
      return NextResponse.json(
        { error: "Too late to abort — resign instead" },
        { status: 409 },
      );
    }
    await db
      .update(games)
      .set({
        status: "abandoned",
        result: "Aborted",
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "game.ended", {
        result: "Aborted",
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ result: "Aborted" });
  }

  if (game.status !== "active") {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }

  if (action === "offer-draw") {
    await db
      .update(games)
      .set({ drawOfferBy: color, updatedAt: new Date() })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "draw.offered", { by: color });
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "decline-draw") {
    await db
      .update(games)
      .set({ drawOfferBy: null, updatedAt: new Date() })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "draw.declined", {});
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "accept-draw") {
    if (!game.drawOfferBy || game.drawOfferBy === color) {
      return NextResponse.json({ error: "No offer" }, { status: 409 });
    }
    await db
      .update(games)
      .set({
        status: "finished",
        result: "Draw by agreement",
        winner: null,
        drawOfferBy: null,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "game.ended", {
        result: "Draw by agreement",
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ result: "Draw by agreement" });
  }

  if (action === "offer-takeback") {
    await db
      .update(games)
      .set({ takebackOfferBy: color, updatedAt: new Date() })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "takeback.offered", {
        by: color,
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "decline-takeback") {
    await db
      .update(games)
      .set({ takebackOfferBy: null, updatedAt: new Date() })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "takeback.declined", {});
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "accept-takeback") {
    if (!game.takebackOfferBy || game.takebackOfferBy === color) {
      return NextResponse.json({ error: "No offer" }, { status: 409 });
    }
    const chess = new Chess();
    if (game.pgn) {
      try {
        chess.loadPgn(game.pgn);
      } catch {
        chess.load(game.fen);
      }
    } else {
      chess.load(game.fen);
    }
    chess.undo();
    // If the offerer moved last, one undo; if we need two (pair), undo once more when turn matches
    const fen = chess.fen();
    const pgn = chess.pgn();
    await db
      .update(games)
      .set({
        fen,
        pgn,
        turn: chess.turn(),
        takebackOfferBy: null,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));
    try {
      await getPusher().trigger(gameChannel(code), "takeback.accepted", {
        fen,
        turn: chess.turn(),
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ fen, turn: chess.turn() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
