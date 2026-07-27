import { requireUser } from "@/lib/auth/requireUser";
import { touchPresence } from "@/lib/notify";
import { NextResponse } from "next/server";

type Presence = "online" | "lfg" | "offline";
const ALLOWED: Presence[] = ["online", "lfg", "offline"];

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    presence?: Presence;
  };

  const presence: Presence =
    body.presence && ALLOWED.includes(body.presence)
      ? body.presence
      : "online";

  await touchPresence(me.id, presence);
  return NextResponse.json({ ok: true, presence });
}
