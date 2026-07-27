import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(40);

  const unread = rows.filter((r) => !r.read);
  const recent = rows.slice(0, 25);

  return NextResponse.json({
    unreadCount: unread.length,
    notifications: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(eq(notifications.userId, me.id), eq(notifications.read, false)),
    );

  return NextResponse.json({ ok: true });
}
