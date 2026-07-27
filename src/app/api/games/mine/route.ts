import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { games } from "@/lib/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const seated = or(
    eq(games.whiteUserId, me.id),
    eq(games.blackUserId, me.id),
  );

  const active = await db
    .select()
    .from(games)
    .where(and(seated, eq(games.status, "active")))
    .orderBy(desc(games.updatedAt))
    .limit(40);

  const waiting = await db
    .select()
    .from(games)
    .where(and(seated, eq(games.status, "waiting")))
    .orderBy(desc(games.updatedAt))
    .limit(20);

  const mapRow = (g: (typeof active)[number]) => ({
    code: g.code,
    status: g.status,
    fen: g.fen,
    turn: g.turn,
    whiteName: g.whiteName,
    blackName: g.blackName,
    rated: g.rated,
    correspondence: g.correspondence,
    timeControlMs: g.timeControlMs,
    updatedAt: g.updatedAt.toISOString(),
    yourColor:
      g.whiteUserId === me.id ? ("w" as const) : ("b" as const),
  });

  return NextResponse.json({
    correspondence: active.filter((g) => g.correspondence).map(mapRow),
    rated: active.filter((g) => g.rated && !g.correspondence).map(mapRow),
    active: active.map(mapRow),
    waiting: waiting.map(mapRow),
  });
}
