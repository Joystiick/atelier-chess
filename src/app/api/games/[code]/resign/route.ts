import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "active" && game.status !== "waiting") {
    return NextResponse.json({ error: "Already finished" }, { status: 409 });
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

  const result = `${color === "w" ? "White" : "Black"} resigned`;
  await db
    .update(games)
    .set({
      status: "finished",
      winner: color === "w" ? "b" : "w",
      result,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  try {
    await getPusher().trigger(gameChannel(code), "game.ended", {
      winner: color === "w" ? "b" : "w",
      result,
    });
  } catch {
    // ignore
  }

  return NextResponse.json({ result });
}
