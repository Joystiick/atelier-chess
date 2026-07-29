import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { salonNights } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import {
  isSalonChatMode,
  isSalonTheme,
  parseOptionalIso,
  SALON_PRESETS,
  type SalonPresetId,
} from "@/lib/salon/themes";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "salon"}-${generateGameCode().slice(0, 4)}`;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const rows = await db
    .select()
    .from(salonNights)
    .where(eq(salonNights.hostId, auth.user.id))
    .orderBy(asc(salonNights.createdAt));
  return NextResponse.json({ nights: rows });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    timeControl?: TimeControlId;
    preset?: string;
    theme?: string;
    chatMode?: string;
    startsAt?: string | null;
    endsAt?: string | null;
  };

  const presetId = (
    body.preset && body.preset in SALON_PRESETS ? body.preset : "open"
  ) as SalonPresetId;
  const preset = SALON_PRESETS[presetId];

  const theme = isSalonTheme(body.theme) ? body.theme : preset.theme;
  const chatMode = isSalonChatMode(body.chatMode)
    ? body.chatMode
    : preset.chatMode;

  const name =
    (body.name ?? preset.defaultName).trim().slice(0, 48) || preset.defaultName;

  let tcId: TimeControlId = preset.timeControl;
  if (theme === "bullet") {
    tcId = "3|2";
  } else if (body.timeControl && body.timeControl in TIME_CONTROLS) {
    tcId = body.timeControl;
  }

  const startsAt = parseOptionalIso(body.startsAt);
  const endsAt = parseOptionalIso(body.endsAt);
  if (startsAt && endsAt && endsAt <= startsAt) {
    return NextResponse.json(
      { error: "End must be after start" },
      { status: 400 },
    );
  }

  const [night] = await db
    .insert(salonNights)
    .values({
      slug: slugify(name),
      name,
      hostId: me.id,
      timeControl: tcId,
      theme,
      chatMode,
      startsAt,
      endsAt,
      status: "open",
    })
    .returning();

  return NextResponse.json({ night });
}
