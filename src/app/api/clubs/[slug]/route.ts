import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { clubMembers, clubs, games, users } from "@/lib/db/schema";
import { TIME_CONTROLS } from "@/lib/names";
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
      joinedAt: clubMembers.joinedAt,
    })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(eq(clubMembers.clubId, club.id));

  return NextResponse.json({
    club: {
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      openTableCode: club.openTableCode,
      ownerId: club.ownerId,
    },
    members,
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

        return NextResponse.json({
          ok: true,
          code: row.code,
          color: "w" as const,
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
