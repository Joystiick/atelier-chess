import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

const MAX_MSG = 80;
const MAX_LOG = 2000;

/**
 * Short table banter / chat ÔÇö seated players only.
 * Appends to banterLog and broadcasts via Pusher.
 */
export async function POST(request: Request, { params }: Params) {
  const rl = rateLimit(`banter:${clientKey(request)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim().slice(0, MAX_MSG);
  if (!text) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (game.status !== "active" && game.status !== "waiting") {
    return NextResponse.json({ error: "Table closed" }, { status: 409 });
  }

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [color, token] = seat.split(":") as ["w" | "b", string];
  const ok =
    (color === "w" && token === game.whiteToken) ||
    (color === "b" && token === game.blackToken);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const label = color === "w" ? game.whiteName ?? "White" : game.blackName ?? "Black";
  const line = `${label}: ${text}`;
  const prev = game.banterLog?.trim() ? `${game.banterLog.trim()}\n` : "";
  const banterLog = `${prev}${line}`.slice(-MAX_LOG);

  await db
    .update(games)
    .set({ banterLog, updatedAt: new Date() })
    .where(eq(games.id, game.id));

  try {
    await getPusher().trigger(gameChannel(code), "banter.posted", {
      line,
      by: color,
      at: Date.now(),
    });
  } catch {
    // persist succeeded; clients can poll
  }

  return NextResponse.json({ ok: true, line, banterLog });
}
