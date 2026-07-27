import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isAvatarId } from "@/lib/auth/avatars";
import {
  hashPassword,
  publicUser,
  setSessionCookie,
} from "@/lib/auth/session";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rl = rateLimit(`register:${clientKey(request)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    username?: string;
    password?: string;
    avatarId?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  const username = (body.username ?? "").trim().replace(/\s+/g, "").slice(0, 20);
  const password = body.password ?? "";
  const avatarId =
    body.avatarId && isAvatarId(body.avatarId) ? body.avatarId : "knight-brass";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username: 3–20 letters, numbers, or _" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const [emailTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (emailTaken) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const [nameTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (nameTaken) {
    return NextResponse.json({ error: "Username taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [row] = await db
    .insert(users)
    .values({ email, username, passwordHash, avatarId })
    .returning();

  const pub = publicUser(row);
  await setSessionCookie(pub);
  return NextResponse.json({ user: pub });
}
