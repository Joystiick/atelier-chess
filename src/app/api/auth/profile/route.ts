import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isAvatarId } from "@/lib/auth/avatars";
import {
  publicUser,
  readSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    avatarId?: string;
  };

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.username !== undefined) {
    const username = body.username.trim().replace(/\s+/g, "").slice(0, 20);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (taken && taken.id !== session.id) {
      return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }
    updates.username = username;
  }

  if (body.avatarId !== undefined) {
    if (!isAvatarId(body.avatarId)) {
      return NextResponse.json({ error: "Invalid avatar" }, { status: 400 });
    }
    updates.avatarId = body.avatarId;
  }

  const [row] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, session.id))
    .returning();

  const pub = publicUser(row);
  await setSessionCookie(pub);
  return NextResponse.json({ user: pub });
}
