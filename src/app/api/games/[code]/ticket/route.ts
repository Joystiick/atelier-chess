import { generateJoinTicket, isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

/** Host regenerates a one-time join ticket for the waiting-room QR. */
export async function POST(_request: Request, { params }: Params) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "waiting") {
    return NextResponse.json({ error: "Table already seated" }, { status: 409 });
  }

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [color, token] = seat.split(":");
  if (color !== "w" || token !== game.whiteToken) {
    return NextResponse.json({ error: "Only the host can refresh the ticket" }, { status: 403 });
  }

  const joinTicket = generateJoinTicket();
  await db
    .update(games)
    .set({ joinTicket, updatedAt: new Date() })
    .where(eq(games.id, game.id));

  return NextResponse.json({ joinTicket });
}
