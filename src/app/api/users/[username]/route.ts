import { avatarEmoji } from "@/lib/auth/avatars";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw).replace(/^@/, "").trim();
  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      avatarId: users.avatarId,
      elo: users.elo,
      gamesPlayed: users.gamesPlayed,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: row.id,
      username: row.username,
      avatarId: row.avatarId,
      avatar: avatarEmoji(row.avatarId),
      elo: row.elo,
      gamesPlayed: row.gamesPlayed,
    },
  });
}
