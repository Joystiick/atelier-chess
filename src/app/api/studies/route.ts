import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { studies } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const owned = await db
    .select()
    .from(studies)
    .where(eq(studies.ownerId, me.id))
    .orderBy(desc(studies.updatedAt))
    .limit(40);

  // Also include studies explicitly shared with this user id
  const shared = await db
    .select()
    .from(studies)
    .orderBy(desc(studies.updatedAt))
    .limit(80);

  const sharedMine = shared.filter((s) => {
    if (s.ownerId === me.id) return false;
    return s.sharedWith
      .split(",")
      .map((x) => x.trim())
      .includes(me.id);
  });

  const byId = new Map<string, (typeof owned)[number]>();
  for (const s of [...owned, ...sharedMine]) byId.set(s.id, s);
  const rows = [...byId.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return NextResponse.json({
    studies: rows.map((s) => ({
      id: s.id,
      title: s.title,
      ownerId: s.ownerId,
      fen: s.fen,
      pgn: s.pgn,
      notes: s.notes,
      sharedWith: s.sharedWith,
      updatedAt: s.updatedAt.toISOString(),
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
    fen?: string;
    pgn?: string;
    notes?: string;
  };

  const title = (body.title ?? "").trim().slice(0, 80) || "Untitled study";

  const [row] = await db
    .insert(studies)
    .values({
      title,
      ownerId: me.id,
      fen:
        body.fen?.trim() ||
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      pgn: body.pgn ?? "",
      notes: body.notes ?? "",
    })
    .returning();

  return NextResponse.json({
    study: {
      id: row.id,
      title: row.title,
      ownerId: row.ownerId,
      fen: row.fen,
      pgn: row.pgn,
      notes: row.notes,
      sharedWith: row.sharedWith,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    },
  });
}
