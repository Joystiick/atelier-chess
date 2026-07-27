import { requireUser } from "@/lib/auth/requireUser";
import { verifyPassword } from "@/lib/auth/session";
import { isValidCode } from "@/lib/codes";
import { generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const rl = rateLimit(`join:${clientKey(request)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many joins — wait a moment" }, { status: 429 });
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    ticket?: string;
    password?: string;
  };
  const code = (body.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const ticket = (body.ticket ?? "").trim() || null;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }
  if (Date.now() - new Date(game.createdAt).getTime() > ROOM_TTL_MS) {
    await db
      .update(games)
      .set({ status: "abandoned", result: "Expired", updatedAt: new Date() })
      .where(eq(games.id, game.id));
    return NextResponse.json({ error: "This table expired" }, { status: 410 });
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

  // Reclaim own seat if cookies cleared but user id matches
  if (game.whiteUserId === me.id && game.whiteToken) {
    jar.set(`atelier_seat_${code}`, `w:${game.whiteToken}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return NextResponse.json({
      code,
      color: "w" as const,
      displayName: game.whiteName,
      status: game.status,
      rejoined: true,
    });
  }
  if (game.blackUserId === me.id && game.blackToken) {
    jar.set(`atelier_seat_${code}`, `b:${game.blackToken}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return NextResponse.json({
      code,
      color: "b" as const,
      displayName: game.blackName,
      status: game.status,
      rejoined: true,
    });
  }

  if (game.blackToken) {
    return NextResponse.json({ error: "Table is full" }, { status: 409 });
  }

  // One-time ticket (QR) — password salon tables may bypass with correct password
  if (game.joinTicket) {
    const ticketOk = ticket && ticket === game.joinTicket;
    let passwordOk = false;
    if (!ticketOk && body.password && game.passwordHash) {
      passwordOk = await verifyPassword(body.password, game.passwordHash);
    }
    if (!ticketOk && !passwordOk) {
      return NextResponse.json(
        { error: "Need a fresh QR ticket (or salon password) to sit" },
        { status: 403 },
      );
    }
  } else if (game.passwordHash) {
    if (!body.password || !(await verifyPassword(body.password, game.passwordHash))) {
      return NextResponse.json({ error: "Wrong salon password" }, { status: 403 });
    }
  }

  const token = generatePlayerToken();
  const [updated] = await db
    .update(games)
    .set({
      blackName: me.username,
      blackToken: token,
      blackUserId: me.id,
      status: "active",
      joinTicket: null,
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
      blackName: me.username,
      status: "active",
    });
  } catch {
    // Realtime optional at join
  }

  return NextResponse.json({
    code: updated.code,
    color: "b" as const,
    displayName: me.username,
    status: updated.status,
  });
}
