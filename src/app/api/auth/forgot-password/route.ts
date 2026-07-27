import { sendPasswordResetEmail } from "@/lib/auth/email";
import { hashToken, randomToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const rl = rateLimit(`forgot:${clientKey(request)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  // Always return ok to avoid account enumeration
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://atelierchess.netlify.app";
  const resetUrl = `${origin}/reset-password?token=${token}`;

  const sent = await sendPasswordResetEmail({
    to: user.email,
    username: user.username,
    resetUrl,
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: sent.error ?? "Could not send email" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    // Only when Resend is not configured — useful for local / first deploy
    previewUrl: sent.previewUrl,
  });
}
