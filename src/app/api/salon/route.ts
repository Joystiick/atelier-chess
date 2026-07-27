import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { salonNights, salonQueue } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { and, asc, eq } from "drizzle-orm";
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
  };
  const name = (body.name ?? "Salon night").trim().slice(0, 48) || "Salon night";
  const tcId =
    body.timeControl && body.timeControl in TIME_CONTROLS
      ? body.timeControl
      : ("10|0" as TimeControlId);

  const [night] = await db
    .insert(salonNights)
    .values({
      slug: slugify(name),
      name,
      hostId: me.id,
      timeControl: tcId,
      status: "open",
    })
    .returning();

  return NextResponse.json({ night });
}
