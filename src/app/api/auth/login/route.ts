import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  publicUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth/session";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rl = rateLimit(`login:${clientKey(request)}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    login?: string;
    password?: string;
  };
  const login = (body.login ?? "").trim();
  const password = body.password ?? "";
  if (!login || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const isEmail = login.includes("@");
  const [row] = await db
    .select()
    .from(users)
    .where(isEmail ? eq(users.email, login.toLowerCase()) : eq(users.username, login))
    .limit(1);

  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return NextResponse.json({ error: "Invalid login or password" }, { status: 401 });
  }

  const pub = publicUser(row);
  await setSessionCookie(pub);
  return NextResponse.json({ user: pub });
}
