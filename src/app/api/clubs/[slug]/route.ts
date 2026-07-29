import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { clubMembers, clubs, games, users } from "@/lib/db/schema";
import { TIME_CONTROLS } from "@/lib/names";
import { getPusher, gameChannel } from "@/lib/pusher/server";
import { tablecastHostPaths } from "@/lib/tablecast/paths";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  const [club] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.slug, slug))
    .limit(1);
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const members = await db
    .select({
      userId: clubMembers.userId,
      username: users.username,
      elo: users.elo,
      avatarId: users.avatarId,
      presence: users.presence,
      lastSeenAt: users.lastSeenAt,
      activeGameCode: users.activeGameCode,
      joinedAt: clubMembers.joinedAt,
    })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(eq(clubMembers.clubId, club.id));

  const FREE_MS = 3 * 60 * 1000;
  const now = Date.now();
  const serialized = members.map((m) => {
    const lastSeenMs = m.lastSeenAt.getTime();
    const fresh = now - lastSeenMs < FREE_MS;
    const free =
      fresh &&
      (m.presence === "online" || m.presence === "lfg") &&
      !m.activeGameCode;
    return {
      userId: m.userId,
      username: m.username,
      elo: m.elo,
      avatarId: m.avatarId,
      presence: m.presence,
      lastSeenAt: m.lastSeenAt.toISOString(),
      activeGameCode: m.activeGameCode,
      joinedAt: m.joinedAt.toISOString(),
      free,
    };
  });

  return NextResponse.json({
    club: {
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      openTableCode: club.openTableCode,
      houseEnabled: club.houseEnabled ?? true,
      ownerId: club.ownerId,
      invitePath: `/clubs/${club.slug}?invite=1`,
      ...(club.openTableCode
        ? tablecastHostPaths(club.openTableCode)
        : {}),
    },
    members: serialized,
  });
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { slug } = await params;

  const [club] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.slug, slug))
    .limit(1);
  if (!club) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "join" | "open-table";
    timeControl?: string;
  };

  if (body.action === "open-table") {
    const [membership] = await db
      .select()
      .from(clubMembers)
      .where(
        and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, me.id)),
      )
      .limit(1);
    if (!membership) {
      return NextResponse.json({ error: "Join the club first" }, { status: 403 });
    }

    const tcId =
      body.timeControl && body.timeControl in TIME_CONTROLS
        ? (body.timeControl as keyof typeof TIME_CONTROLS)
        : ("10|0" as const);
    const tc = TIME_CONTROLS[tcId];
    const token = generatePlayerToken();

    let code = generateGameCode();
    for (let i = 0; i < 5; i++) {
      try {
        const [row] = await db
          .insert(games)
          .values({
            code,
            status: "waiting",
            whiteName: me.username,
            whiteToken: token,
            whiteUserId: me.id,
            whiteClockMs: tc.baseMs,
            blackClockMs: tc.baseMs,
            timeControlMs: tc.baseMs,
            incrementMs: tc.incMs,
            rated: false,
            clubId: club.id,
            tablecast: true,
          })
          .returning();

        await db
          .update(clubs)
          .set({ openTableCode: row.code })
          .where(eq(clubs.id, club.id));

        const jar = await cookies();
        jar.set(`atelier_seat_${row.code}`, `w:${token}`, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24,
        });

        const paths = tablecastHostPaths(row.code, { whiteToken: token });
        try {
          await getPusher().trigger(gameChannel(row.code), "tablecast.opened", {
            code: row.code,
          });
        } catch {
          // optional
        }

        return NextResponse.json({
          ok: true,
          code: row.code,
          color: "w" as const,
          ...paths,
        });
      } catch {
        code = generateGameCode();
      }
    }
    return NextResponse.json(
      { error: "Could not open table" },
      { status: 500 },
    );
  }

  // join
  const [existing] = await db
    .select()
    .from(clubMembers)
    .where(
      and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, me.id)),
    )
    .limit(1);

  if (!existing) {
    await db.insert(clubMembers).values({
      clubId: club.id,
      userId: me.id,
    });
  }

  return NextResponse.json({ ok: true, joined: true });
}
