import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { studies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

function canView(
  row: { ownerId: string; sharedWith: string },
  userId: string,
) {
  if (row.ownerId === userId) return true;
  return row.sharedWith
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(studies)
    .where(eq(studies.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canView(row, me.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(studies)
    .where(eq(studies.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canView(row, me.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    fen?: string;
    pgn?: string;
    notes?: string;
    sharedWith?: string;
  };

  const [updated] = await db
    .update(studies)
    .set({
      title:
        body.title !== undefined
          ? body.title.trim().slice(0, 80) || row.title
          : row.title,
      fen: body.fen !== undefined ? body.fen : row.fen,
      pgn: body.pgn !== undefined ? body.pgn : row.pgn,
      notes: body.notes !== undefined ? body.notes : row.notes,
      sharedWith:
        body.sharedWith !== undefined && row.ownerId === me.id
          ? body.sharedWith
          : row.sharedWith,
      updatedAt: new Date(),
    })
    .where(eq(studies.id, id))
    .returning();

  return NextResponse.json({
    study: {
      id: updated.id,
      title: updated.title,
      ownerId: updated.ownerId,
      fen: updated.fen,
      pgn: updated.pgn,
      notes: updated.notes,
      sharedWith: updated.sharedWith,
      updatedAt: updated.updatedAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
