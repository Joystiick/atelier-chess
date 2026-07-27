import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { publicUser, readSession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ user: null });

  const [row] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!row) return NextResponse.json({ user: null });
  return NextResponse.json({ user: publicUser(row) });
}
