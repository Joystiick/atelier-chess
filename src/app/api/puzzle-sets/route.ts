import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { puzzleSets } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const owned = await db
    .select()
    .from(puzzleSets)
    .where(eq(puzzleSets.ownerId, me.id))
    .orderBy(desc(puzzleSets.createdAt))
    .limit(40);

  const recent = await db
    .select()
    .from(puzzleSets)
    .orderBy(desc(puzzleSets.createdAt))
    .limit(80);

  const sharedMine = recent.filter((s) => {
    if (s.ownerId === me.id) return false;
    return s.sharedWith
      .split(",")
      .map((x) => x.trim())
      .includes(me.id);
  });

  const byId = new Map<string, (typeof owned)[number]>();
  for (const s of [...owned, ...sharedMine]) byId.set(s.id, s);

  return NextResponse.json({
    sets: [...byId.values()].map((s) => ({
      id: s.id,
      title: s.title,
      ownerId: s.ownerId,
      puzzleIds: s.puzzleIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      sharedWith: s.sharedWith,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    puzzleIds?: string[] | string;
    sharedWith?: string;
  };

  const title = (body.title ?? "").trim().slice(0, 80) || "Puzzle set";
  const puzzleIds = Array.isArray(body.puzzleIds)
    ? body.puzzleIds.join(",")
    : (body.puzzleIds ?? "");

  const [row] = await db
    .insert(puzzleSets)
    .values({
      title,
      ownerId: me.id,
      puzzleIds,
      sharedWith: body.sharedWith ?? "",
    })
    .returning();

  return NextResponse.json({
    set: {
      id: row.id,
      title: row.title,
      ownerId: row.ownerId,
      puzzleIds: row.puzzleIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      sharedWith: row.sharedWith,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
