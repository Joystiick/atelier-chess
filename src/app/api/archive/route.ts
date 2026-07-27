import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { gameArchives } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const rows = await db
    .select()
    .from(gameArchives)
    .where(eq(gameArchives.userId, me.id))
    .orderBy(desc(gameArchives.createdAt))
    .limit(50);

  return NextResponse.json({
    archives: rows.map((r) => ({
      id: r.id,
      code: r.code,
      pgn: r.pgn,
      result: r.result,
      opponent: r.opponent,
      rated: r.rated,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    pgn?: string;
    result?: string;
    opponent?: string;
    rated?: boolean;
  };

  const code = (body.code ?? "").trim().slice(0, 32) || "local";
  const pgn = typeof body.pgn === "string" ? body.pgn.slice(0, 50_000) : "";
  if (!pgn) {
    return NextResponse.json({ error: "PGN required" }, { status: 400 });
  }

  const [row] = await db
    .insert(gameArchives)
    .values({
      userId: me.id,
      code,
      pgn,
      result: body.result?.slice(0, 64) ?? null,
      opponent: body.opponent?.slice(0, 64) ?? null,
      rated: Boolean(body.rated),
    })
    .returning();

  return NextResponse.json({
    archive: {
      id: row.id,
      code: row.code,
      pgn: row.pgn,
      result: row.result,
      opponent: row.opponent,
      rated: row.rated,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
