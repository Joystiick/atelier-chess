import { isValidCode } from "@/lib/codes";
import { generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { sanitizeDisplayName } from "@/lib/names";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    displayName?: string;
  };
  const code = (body.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const displayName = sanitizeDisplayName(body.displayName ?? "");
  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }
  if (game.status === "finished" || game.status === "abandoned") {
    return NextResponse.json({ error: "This table is closed" }, { status: 409 });
  }

  const jar = await cookies();
  const existing = jar.get(`atelier_seat_${code}`)?.value;
  if (existing) {
    const [color] = existing.split(":");
    return NextResponse.json({
      code,
      color,
      displayName: color === "w" ? game.whiteName : game.blackName,
      status: game.status,
      rejoined: true,
    });
  }

  if (game.blackToken) {
    return NextResponse.json({ error: "Table is full" }, { status: 409 });
  }

  const token = generatePlayerToken();
  const [updated] = await db
    .update(games)
    .set({
      blackName: displayName,
      blackToken: token,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id))
    .returning();

  jar.set(`atelier_seat_${code}`, `b:${token}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  try {
    await getPusher().trigger(gameChannel(code), "player.joined", {
      blackName: displayName,
      status: "active",
    });
  } catch {
    // Realtime optional at join; state still in Neon
  }

  return NextResponse.json({
    code: updated.code,
    color: "b" as const,
    displayName,
    status: updated.status,
  });
}
