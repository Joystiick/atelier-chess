import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { arenaPlayers, arenas, games, users } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { notifyUser, touchPresence } from "@/lib/notify";
import { getPusher, userChannel } from "@/lib/pusher/server";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const [arena] = await db
    .select()
    .from(arenas)
    .where(eq(arenas.id, id))
    .limit(1);
  if (!arena) {
    return NextResponse.json({ error: "Arena not found" }, { status: 404 });
  }

  const players = await db
    .select({
      userId: arenaPlayers.userId,
      score: arenaPlayers.score,
      gamesPlayed: arenaPlayers.gamesPlayed,
      waiting: arenaPlayers.waiting,
      username: users.username,
      elo: users.elo,
      avatarId: users.avatarId,
    })
    .from(arenaPlayers)
    .innerJoin(users, eq(users.id, arenaPlayers.userId))
    .where(eq(arenaPlayers.arenaId, id))
    .orderBy(desc(arenaPlayers.score));

  return NextResponse.json({
    arena: {
      id: arena.id,
      name: arena.name,
      status: arena.status,
      timeControl: arena.timeControl,
      startsAt: arena.startsAt.toISOString(),
      endsAt: arena.endsAt.toISOString(),
    },
    standings: players,
  });
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { id } = await params;

  const [arena] = await db
    .select()
    .from(arenas)
    .where(eq(arenas.id, id))
    .limit(1);
  if (!arena) {
    return NextResponse.json({ error: "Arena not found" }, { status: 404 });
  }
  if (arena.status === "finished") {
    return NextResponse.json({ error: "Arena finished" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "join" | "pair";
  };

  if (body.action === "pair") {
    return pairWaiting(arena, me.id);
  }

  // default: join
  const [existing] = await db
    .select()
    .from(arenaPlayers)
    .where(
      and(eq(arenaPlayers.arenaId, id), eq(arenaPlayers.userId, me.id)),
    )
    .limit(1);

  if (!existing) {
    await db.insert(arenaPlayers).values({
      arenaId: id,
      userId: me.id,
      waiting: true,
    });
  } else {
    await db
      .update(arenaPlayers)
      .set({ waiting: true })
      .where(eq(arenaPlayers.id, existing.id));
  }

  if (arena.status === "open") {
    await db
      .update(arenas)
      .set({ status: "running" })
      .where(eq(arenas.id, id));
  }

  return NextResponse.json({ ok: true, joined: true });
}

async function pairWaiting(
  arena: typeof arenas.$inferSelect,
  requesterId: string,
) {
  const waiting = await db
    .select({
      id: arenaPlayers.id,
      userId: arenaPlayers.userId,
      username: users.username,
      elo: users.elo,
    })
    .from(arenaPlayers)
    .innerJoin(users, eq(users.id, arenaPlayers.userId))
    .where(
      and(eq(arenaPlayers.arenaId, arena.id), eq(arenaPlayers.waiting, true)),
    );

  if (waiting.length < 2) {
    return NextResponse.json(
      { error: "Need at least two waiting players", paired: 0 },
      { status: 400 },
    );
  }

  const tcId =
    arena.timeControl in TIME_CONTROLS
      ? (arena.timeControl as TimeControlId)
      : ("3|2" as TimeControlId);
  const tc = TIME_CONTROLS[tcId];

  const pairs: { code: string; white: string; black: string }[] = [];
  const sorted = [...waiting].sort((a, b) => b.elo - a.elo);

  for (let i = 0; i + 1 < sorted.length; i += 2) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const whiteToken = generatePlayerToken();
    const blackToken = generatePlayerToken();
    let code = generateGameCode();
    let created = false;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [row] = await db
          .insert(games)
          .values({
            code,
            status: "active",
            whiteName: a.username,
            blackName: b.username,
            whiteToken,
            blackToken,
            whiteUserId: a.userId,
            blackUserId: b.userId,
            whiteClockMs: tc.baseMs,
            blackClockMs: tc.baseMs,
            timeControlMs: tc.baseMs,
            incrementMs: tc.incMs,
            rated: false,
            arenaId: arena.id,
          })
          .returning();

        await db
          .update(arenaPlayers)
          .set({ waiting: false })
          .where(eq(arenaPlayers.id, a.id));
        await db
          .update(arenaPlayers)
          .set({ waiting: false })
          .where(eq(arenaPlayers.id, b.id));

        await touchPresence(a.userId, "ingame", row.code);
        await touchPresence(b.userId, "ingame", row.code);

        await notifyUser({
          userId: a.userId,
          kind: "arena",
          title: "Arena pair",
          body: `Paired vs ${b.username}`,
          href: `/game/${row.code}`,
        });
        await notifyUser({
          userId: b.userId,
          kind: "arena",
          title: "Arena pair",
          body: `Paired vs ${a.username}`,
          href: `/game/${row.code}`,
        });

        for (const uid of [a.userId, b.userId]) {
          try {
            await getPusher().trigger(userChannel(uid), "arena.pair", {
              code: row.code,
              arenaId: arena.id,
            });
          } catch {
            // optional
          }
        }

        pairs.push({
          code: row.code,
          white: a.username,
          black: b.username,
        });
        created = true;
        break;
      } catch {
        code = generateGameCode();
      }
    }
    if (!created) {
      // skip this pair on failure
    }
  }

  void requesterId;
  return NextResponse.json({ ok: true, paired: pairs.length, pairs });
}
