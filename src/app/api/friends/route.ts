import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { friendships, users } from "@/lib/db/schema";
import { avatarEmoji } from "@/lib/auth/avatars";
import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

function friendCard(u: {
  id: string;
  username: string;
  avatarId: string;
  elo: number;
}) {
  return {
    id: u.id,
    username: u.username,
    avatarId: u.avatarId,
    avatar: avatarEmoji(u.avatarId),
    elo: u.elo,
  };
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(
        eq(friendships.requesterId, me.id),
        eq(friendships.addresseeId, me.id),
      ),
    );

  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.requesterId);
    userIds.add(r.addresseeId);
  }
  userIds.delete(me.id);

  const people =
    userIds.size === 0
      ? []
      : await db.select().from(users).where(
          or(...[...userIds].map((id) => eq(users.id, id))),
        );

  const byId = new Map(people.map((p) => [p.id, p]));

  const friends: ReturnType<typeof friendCard>[] = [];
  const incoming: { friendshipId: string; user: ReturnType<typeof friendCard> }[] =
    [];
  const outgoing: { friendshipId: string; user: ReturnType<typeof friendCard> }[] =
    [];

  for (const r of rows) {
    if (r.status === "blocked") continue;
    const otherId = r.requesterId === me.id ? r.addresseeId : r.requesterId;
    const other = byId.get(otherId);
    if (!other) continue;
    const card = friendCard(other);
    if (r.status === "accepted") {
      friends.push(card);
    } else if (r.status === "pending") {
      if (r.addresseeId === me.id) {
        incoming.push({ friendshipId: r.id, user: card });
      } else {
        outgoing.push({ friendshipId: r.id, user: card });
      }
    }
  }

  friends.sort((a, b) => a.username.localeCompare(b.username));

  return NextResponse.json({ friends, incoming, outgoing });
}
