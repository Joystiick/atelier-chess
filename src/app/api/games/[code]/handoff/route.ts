import { generateJoinTicket, generatePlayerToken, isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

/**
 * Cross-device seat handoff: seated player gets a QR token;
 * other device claims it and receives the seat cookie.
 */
export async function POST(request: Request, { params }: Params) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "create" | "claim";
    handoff?: string;
  };

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status === "finished" || game.status === "abandoned") {
    return NextResponse.json({ error: "Table closed" }, { status: 409 });
  }

  const jar = await cookies();

  if (body.action === "claim") {
    const handoff = (body.handoff ?? "").trim();
    if (!handoff) {
      return NextResponse.json({ error: "Missing handoff token" }, { status: 400 });
    }

    let color: "w" | "b" | null = null;
    let seatToken: string | null = null;
    if (handoff === game.handoffWhite && game.whiteToken) {
      color = "w";
      seatToken = game.whiteToken;
    } else if (handoff === game.handoffBlack && game.blackToken) {
      color = "b";
      seatToken = game.blackToken;
    }
    if (!color || !seatToken) {
      return NextResponse.json({ error: "Handoff expired or invalid" }, { status: 403 });
    }

    jar.set(`atelier_seat_${code}`, `${color}:${seatToken}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    await db
      .update(games)
      .set({
        handoffWhite: color === "w" ? null : game.handoffWhite,
        handoffBlack: color === "b" ? null : game.handoffBlack,
        updatedAt: new Date(),
      })
      .where(eq(games.id, game.id));

    return NextResponse.json({ code, color, claimed: true });
  }

  // create handoff for current seat
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [color, token] = seat.split(":");
  const ok =
    (color === "w" && token === game.whiteToken) ||
    (color === "b" && token === game.blackToken);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const handoff = generateJoinTicket() + generatePlayerToken().slice(0, 16);
  await db
    .update(games)
    .set({
      handoffWhite: color === "w" ? handoff : game.handoffWhite,
      handoffBlack: color === "b" ? handoff : game.handoffBlack,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id));

  return NextResponse.json({
    handoff,
    color,
    urlPath: `/handoff/${code}?h=${handoff}`,
  });
}
