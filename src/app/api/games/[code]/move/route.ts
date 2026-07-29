import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games, moves } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { Chess } from "chess.js";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    uci?: string;
  };
  const uci = (body.uci ?? "").trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    return NextResponse.json({ error: "Bad move" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "active") {
    return NextResponse.json({ error: "Game not active" }, { status: 409 });
  }

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [color, token] = seat.split(":") as ["w" | "b", string];
  if (color === "w" && token !== game.whiteToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (color === "b" && token !== game.blackToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (game.turn !== color) {
    return NextResponse.json({ error: "Not your turn" }, { status: 409 });
  }

  const chess = new Chess(game.fen);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci[4] as "q" | "r" | "b" | "n" | undefined;
  let move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return NextResponse.json({ error: "Illegal move" }, { status: 400 });
  }
  if (!move) return NextResponse.json({ error: "Illegal move" }, { status: 400 });

  const elapsed = Math.max(0, Date.now() - new Date(game.updatedAt).getTime());
  let whiteClockMs = game.whiteClockMs;
  let blackClockMs = game.blackClockMs;
  const unlimited = (game.timeControlMs ?? 1) === 0;
  if (!unlimited) {
    if (color === "w") {
      whiteClockMs = Math.max(0, whiteClockMs - elapsed) + (game.incrementMs ?? 0);
    } else {
      blackClockMs = Math.max(0, blackClockMs - elapsed) + (game.incrementMs ?? 0);
    }
  }

  let status: "waiting" | "active" | "finished" | "abandoned" = "active";
  let winner: string | null = null;
  let result: string | null = null;

  if (!unlimited && (whiteClockMs <= 0 || blackClockMs <= 0)) {
    status = "finished";
    winner = whiteClockMs <= 0 ? "b" : "w";
    result = `Flag — ${winner === "w" ? "White" : "Black"} wins on time`;
  } else if (chess.isCheckmate()) {
    status = "finished";
    winner = color;
    result = `Checkmate — ${color === "w" ? "White" : "Black"} wins`;
  } else if (chess.isDraw()) {
    status = "finished";
    result = chess.isStalemate() ? "Stalemate" : "Draw";
  }

  const ply = chess.history().length;
  const fen = chess.fen();
  const pgn = chess.pgn();

  await db.insert(moves).values({
    gameId: game.id,
    ply,
    uci,
    san: move.san,
    fenAfter: fen,
  });

  await db
    .update(games)
    .set({
      fen,
      pgn,
      turn: chess.turn(),
      status,
      winner,
      result,
      whiteClockMs,
      blackClockMs,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  try {
    await getPusher().trigger(gameChannel(code), "move.made", {
      uci,
      san: move.san,
      fen,
      from: move.from,
      to: move.to,
      turn: chess.turn(),
      status,
      result,
      ply,
      whiteClockMs,
      blackClockMs,
    });
    if (status === "finished") {
      await getPusher().trigger(gameChannel(code), "game.ended", {
        winner,
        result,
      });
    }
  } catch {
    // Neon is source of truth
  }

  return NextResponse.json({
    fen,
    san: move.san,
    turn: chess.turn(),
    status,
    result,
    whiteClockMs,
    blackClockMs,
  });
}
