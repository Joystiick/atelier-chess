import { requireUser } from "@/lib/auth/requireUser";
import { avatarEmoji } from "@/lib/auth/avatars";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { and, ilike, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      avatarId: users.avatarId,
      elo: users.elo,
    })
    .from(users)
    .where(and(ilike(users.username, `${q}%`), ne(users.id, auth.user.id)))
    .limit(12);

  return NextResponse.json({
    users: rows.map((u) => ({
      ...u,
      avatar: avatarEmoji(u.avatarId),
    })),
  });
}
