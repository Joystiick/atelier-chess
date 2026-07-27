import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { arenas } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const rows = await db
    .select()
    .from(arenas)
    .where(inArray(arenas.status, ["open", "running"]))
    .orderBy(desc(arenas.startsAt))
    .limit(40);

  return NextResponse.json({
    arenas: rows.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      timeControl: a.timeControl,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    minutes?: number;
    timeControl?: TimeControlId;
  };

  const name = (body.name ?? "").trim().slice(0, 60);
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const minutes = Math.min(Math.max(Number(body.minutes) || 30, 5), 180);
  const tcId =
    body.timeControl && body.timeControl in TIME_CONTROLS
      ? body.timeControl
      : ("3|2" as TimeControlId);

  const startsAt = new Date();
  const endsAt = new Date(Date.now() + minutes * 60_000);

  const [row] = await db
    .insert(arenas)
    .values({
      name,
      status: "open",
      timeControl: tcId,
      startsAt,
      endsAt,
    })
    .returning();

  return NextResponse.json({
    arena: {
      id: row.id,
      name: row.name,
      status: row.status,
      timeControl: row.timeControl,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
    },
  });
}
