import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { getPusher, userChannel } from "@/lib/pusher/server";
import { eq } from "drizzle-orm";

export async function notifyUser(opts: {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  href?: string;
}) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: opts.userId,
      kind: opts.kind,
      title: opts.title,
      body: opts.body ?? "",
      href: opts.href,
    })
    .returning();

  try {
    await getPusher().trigger(userChannel(opts.userId), "notify", {
      id: row.id,
      kind: opts.kind,
      title: opts.title,
      body: opts.body ?? "",
      href: opts.href,
    });
  } catch {
    // optional
  }

  return row;
}

export async function touchPresence(
  userId: string,
  presence: "online" | "lfg" | "ingame" | "offline",
  activeGameCode?: string | null,
) {
  await db
    .update(users)
    .set({
      presence,
      lastSeenAt: new Date(),
      activeGameCode: activeGameCode ?? null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
