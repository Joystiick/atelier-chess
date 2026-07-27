import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  publicUser,
  readSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { AI_ELO } from "@/lib/chess/banter";
import { currentSeasonKey } from "@/lib/prefs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    result?: "win" | "loss" | "draw";
    opponentElo?: number;
    opponent?: "easy" | "medium" | "hard" | "human";
  };

  if (!body.result) {
    return NextResponse.json({ error: "Missing result" }, { status: 400 });
  }

  const [row] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let opp = body.opponentElo ?? 1200;
  if (body.opponent === "easy") opp = AI_ELO.easy;
  if (body.opponent === "medium") opp = AI_ELO.medium;
  if (body.opponent === "hard") opp = AI_ELO.hard;

  const expected = 1 / (1 + 10 ** ((opp - row.elo) / 400));
  const score = body.result === "win" ? 1 : body.result === "draw" ? 0.5 : 0;
  const nextElo = Math.round(row.elo + 24 * (score - expected));

  const season = currentSeasonKey();
  const seasonBase = row.seasonKey === season ? row.seasonElo : 1200;
  const seasonExpected = 1 / (1 + 10 ** ((opp - seasonBase) / 400));
  const nextSeasonElo = Math.round(seasonBase + 24 * (score - seasonExpected));

  const [updated] = await db
    .update(users)
    .set({
      elo: nextElo,
      seasonElo: nextSeasonElo,
      seasonKey: season,
      gamesPlayed: row.gamesPlayed + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.id))
    .returning();

  const pub = publicUser(updated);
  await setSessionCookie(pub);
  return NextResponse.json({
    user: pub,
    seasonElo: updated.seasonElo,
    seasonKey: updated.seasonKey,
  });
}
