import { hashPassword, hashToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rl = rateLimit(`reset:${clientKey(request)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = body.token ?? "";
  const password = body.password ?? "";
  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: "Token and password (8+ chars) required" },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHash),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, row.userId));
  await db.delete(passwordResets).where(eq(passwordResets.userId, row.userId));

  return NextResponse.json({ ok: true });
}
