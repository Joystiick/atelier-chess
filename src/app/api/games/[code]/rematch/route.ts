import {
  generateGameCode,
  generateJoinTicket,
  generatePlayerToken,
  isValidCode,
} from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

/**
 * Rematch: live (both online via Pusher) or ghost (waiting QR for opponent who left).
 */
export async function POST(request: Request, { params }: Params) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { ghost?: boolean };

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "finished") {
    return NextResponse.json({ error: "Game still in progress" }, { status: 409 });
  }
  if (!game.whiteToken || !game.blackToken) {
    return NextResponse.json({ error: "Need both players" }, { status: 409 });
  }

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [color, token] = seat.split(":");
  const ok =
    (color === "w" && token === game.whiteToken) ||
    (color === "b" && token === game.blackToken);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ghost rematch: open waiting table with one-time ticket for the other device/player
  if (body.ghost) {
    const myToken = generatePlayerToken();
    const joinTicket = generateJoinTicket();
    let newCode = generateGameCode();

    for (let i = 0; i < 5; i++) {
      try {
        const [row] = await db
          .insert(games)
          .values({
            code: newCode,
            status: "waiting",
            whiteName: color === "w" ? game.whiteName : game.blackName,
            whiteToken: myToken,
            whiteUserId: color === "w" ? game.whiteUserId : game.blackUserId,
            whiteClockMs: game.timeControlMs,
            blackClockMs: game.timeControlMs,
            timeControlMs: game.timeControlMs,
            incrementMs: game.incrementMs,
            rated: game.rated,
            blindfoldCafe: game.blindfoldCafe,
            joinTicket,
          })
          .returning();

        jar.set(`atelier_seat_${newCode}`, `w:${myToken}`, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24,
        });

        return NextResponse.json({
          code: row.code,
          color: "w" as const,
          ghost: true,
          joinTicket,
        });
      } catch {
        newCode = generateGameCode();
      }
    }
    return NextResponse.json({ error: "Could not rematch" }, { status: 500 });
  }

  const whiteToken = generatePlayerToken();
  const blackToken = generatePlayerToken();
  let newCode = generateGameCode();

  for (let i = 0; i < 5; i++) {
    try {
      const [row] = await db
        .insert(games)
        .values({
          code: newCode,
          status: "active",
          whiteName: game.blackName,
          blackName: game.whiteName,
          whiteToken,
          blackToken,
          whiteUserId: game.blackUserId,
          blackUserId: game.whiteUserId,
          whiteClockMs: game.timeControlMs,
          blackClockMs: game.timeControlMs,
          timeControlMs: game.timeControlMs,
          incrementMs: game.incrementMs,
          rated: game.rated,
          blindfoldCafe: game.blindfoldCafe,
          joinTicket: null,
        })
        .returning();

      const newColor = color === "w" ? "b" : "w";
      const newToken = newColor === "w" ? whiteToken : blackToken;
      jar.set(`atelier_seat_${newCode}`, `${newColor}:${newToken}`, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      try {
        await getPusher().trigger(gameChannel(code), "rematch.ready", {
          newCode: row.code,
          claim: { w: whiteToken, b: blackToken },
          mapping: { w: "b", b: "w" } as const,
        });
      } catch {
        // ignore
      }

      return NextResponse.json({
        code: row.code,
        color: newColor,
        claim: { w: whiteToken, b: blackToken },
      });
    } catch {
      newCode = generateGameCode();
    }
  }

  return NextResponse.json({ error: "Could not rematch" }, { status: 500 });
}
