import { readSession } from "@/lib/auth/session";
import { isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { getPusher } from "@/lib/pusher/server";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  let socketId = "";
  let channel = "";
  if (form) {
    socketId = String(form.get("socket_id") ?? "");
    channel = String(form.get("channel_name") ?? "");
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      socket_id?: string;
      channel_name?: string;
    };
    socketId = body.socket_id ?? "";
    channel = body.channel_name ?? "";
  }

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userMatch = /^private-user-([0-9a-f-]{36})$/i.exec(channel);
  if (userMatch) {
    const session = await readSession();
    if (!session || session.id !== userMatch[1]) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const auth = getPusher().authorizeChannel(socketId, channel);
    return NextResponse.json(auth);
  }

  const match = /^private-game-(\d{8})$/.exec(channel);
  if (!match) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const code = match[1];
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const jar = await cookies();
  const seat = jar.get(`atelier_seat_${code}`)?.value;
  if (!seat) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [color, token] = seat.split(":");
  const ok =
    (color === "w" && token === game.whiteToken) ||
    (color === "b" && token === game.blackToken);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const auth = getPusher().authorizeChannel(socketId, channel);
  return NextResponse.json(auth);
}
