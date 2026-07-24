import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { sanitizeDisplayName } from "@/lib/names";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
  };
  const displayName = sanitizeDisplayName(body.displayName ?? "");
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
      });
    } catch {
      code = generateGameCode();
    }
  }

  return NextResponse.json({ error: "Could not create table" }, { status: 500 });
}
