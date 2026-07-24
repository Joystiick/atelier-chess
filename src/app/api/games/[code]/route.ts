import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games, moves } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const moveRows = await db
    .select()
    .from(moves)
    .where(eq(moves.gameId, game.id))
    .orderBy(asc(moves.ply));

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  let you: "w" | "b" | null = null;
  if (seat) {
    const [color, token] = seat.split(":");
    if (color === "w" && token === game.whiteToken) you = "w";
    if (color === "b" && token === game.blackToken) you = "b";
  }

  return NextResponse.json({
    code: game.code,
    status: game.status,
    fen: game.fen,
    pgn: game.pgn,
    turn: game.turn,
    whiteName: game.whiteName,
    blackName: game.blackName,
    winner: game.winner,
    result: game.result,
    whiteClockMs: game.whiteClockMs,
    blackClockMs: game.blackClockMs,
    you,
    moves: moveRows.map((m) => ({
      ply: m.ply,
      uci: m.uci,
      san: m.san,
      fenAfter: m.fenAfter,
    })),
  });
}
