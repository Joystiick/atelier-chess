import { isValidCode } from "@/lib/codes";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ code: string }> };

const REACTIONS = ["👏", "😮", "🔥", "♟️", "☕", "😂"] as const;

/** Spectator emoji reactions — broadcast only, no persistence. */
export async function POST(request: Request, { params }: Params) {
  const rl = rateLimit(`react:${clientKey(request)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    emoji?: string;
    from?: string;
  };
  const emoji = body.emoji ?? "";
  if (!REACTIONS.includes(emoji as (typeof REACTIONS)[number])) {
    return NextResponse.json({ error: "Unknown reaction" }, { status: 400 });
  }

  try {
    await getPusher().trigger(gameChannel(code), "spectator.reaction", {
      emoji,
      from: (body.from ?? "Guest").slice(0, 24),
      at: Date.now(),
    });
  } catch {
    return NextResponse.json({ error: "Realtime unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
