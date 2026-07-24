import { rateLimit, clientKey } from "@/lib/rateLimit";
import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { sanitizeDisplayName } from "@/lib/names";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rl = rateLimit(`create:${clientKey(request)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many tables — wait a moment" },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
    timeControl?: TimeControlId;
  };
  const displayName = sanitizeDisplayName(body.displayName ?? "");
  const tcId =
    body.timeControl && body.timeControl in TIME_CONTROLS
      ? body.timeControl
      : ("10|0" as TimeControlId);
  const tc = TIME_CONTROLS[tcId];
  const token = generatePlayerToken();

  let code = generateGameCode();
  for (let i = 0; i < 5; i++) {
    try {
      const [row] = await db
        .insert(games)
        .values({
          code,
          status: "waiting",
          whiteName: displayName,
          whiteToken: token,
          whiteClockMs: tc.baseMs,
          blackClockMs: tc.baseMs,
          timeControlMs: tc.baseMs,
          incrementMs: tc.incMs,
        })
        .returning();

      const jar = await cookies();
      jar.set(`atelier_seat_${code}`, `w:${token}`, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24,
      });

      return NextResponse.json({
        code: row.code,
        color: "w" as const,
        displayName,
        timeControl: tcId,
      });
    } catch {
      code = generateGameCode();
    }
  }

  return NextResponse.json({ error: "Could not create table" }, { status: 500 });
}
