import { readSession } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/requireUser";
import { generateGameCode, generatePlayerToken } from "@/lib/codes";
import { db } from "@/lib/db";
import { games, salonNights, salonQueue, users } from "@/lib/db/schema";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { getPusher, userChannel } from "@/lib/pusher/server";
import {
  isSalonAccepting,
  isSalonChatMode,
  salonWindowStatus,
  themeLabel,
} from "@/lib/salon/themes";
import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const [night] = await db
    .select()
    .from(salonNights)
    .where(eq(salonNights.slug, slug))
    .limit(1);
  if (!night) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const queue = await db
    .select()
    .from(salonQueue)
    .where(and(eq(salonQueue.nightId, night.id), eq(salonQueue.status, "waiting")))
    .orderBy(asc(salonQueue.createdAt));

  const ids = queue.map((q) => q.userId);
  const people =
    ids.length > 0
      ? await db.select().from(users).where(inArray(users.id, ids))
      : [];
  const byId = Object.fromEntries(people.map((u) => [u.id, u]));

  const me = await readSession();
  const meId = me?.id;
  const isHost = meId === night.hostId;
  const window = salonWindowStatus(night);
  const accepting = window === "open";

  return NextResponse.json({
    night: {
      id: night.id,
      slug: night.slug,
      name: night.name,
      status: night.status,
      timeControl: night.timeControl,
      theme: night.theme,
      themeLabel: themeLabel(night.theme),
      chatMode: night.chatMode,
      startsAt: night.startsAt,
      endsAt: night.endsAt,
      window,
      accepting,
      isHost,
    },
    queue: queue.map((q, i) => ({
      id: q.id,
      position: i + 1,
      username: byId[q.userId]?.username ?? "Player",
      userId: isHost ? q.userId : undefined,
      me: q.userId === meId,
    })),
    inQueue: queue.some((q) => q.userId === meId),
  });
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { slug } = await params;

  const [night] = await db
    .select()
    .from(salonNights)
    .where(eq(salonNights.slug, slug))
    .limit(1);
  if (!night) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: "join" | "leave" | "pair" | "close";
    a?: string;
    b?: string;
  };

  if (body.action === "join") {
    if (!isSalonAccepting(night)) {
      const window = salonWindowStatus(night);
      return NextResponse.json(
        {
          error:
            window === "opens_at"
              ? "Salon has not opened yet"
              : "Salon closed",
        },
        { status: 409 },
      );
    }
    if (night.hostId === me.id) {
      return NextResponse.json({ error: "Host stays at the desk" }, { status: 400 });
    }
    const existing = await db
      .select()
      .from(salonQueue)
      .where(
        and(
          eq(salonQueue.nightId, night.id),
          eq(salonQueue.userId, me.id),
          eq(salonQueue.status, "waiting"),
        ),
      )
      .limit(1);
    if (existing[0]) return NextResponse.json({ ok: true, already: true });

    await db.insert(salonQueue).values({
      nightId: night.id,
      userId: me.id,
      status: "waiting",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "leave") {
    await db
      .update(salonQueue)
      .set({ status: "left" })
      .where(
        and(
          eq(salonQueue.nightId, night.id),
          eq(salonQueue.userId, me.id),
          eq(salonQueue.status, "waiting"),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "close") {
    if (night.hostId !== me.id) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }
    await db
      .update(salonNights)
      .set({ status: "closed" })
      .where(eq(salonNights.id, night.id));
    return NextResponse.json({ ok: true });
  }

  if (body.action === "pair") {
    if (night.hostId !== me.id) {
      return NextResponse.json({ error: "Host only" }, { status: 403 });
    }
    if (!isSalonAccepting(night)) {
      const window = salonWindowStatus(night);
      return NextResponse.json(
        {
          error:
            window === "opens_at"
              ? "Salon has not opened yet"
              : "Salon closed",
        },
        { status: 409 },
      );
    }
    const a = body.a;
    const b = body.b;
    if (!a || !b || a === b) {
      return NextResponse.json({ error: "Pick two guests" }, { status: 400 });
    }

    const waiting = await db
      .select()
      .from(salonQueue)
      .where(and(eq(salonQueue.nightId, night.id), eq(salonQueue.status, "waiting")));
    const qa = waiting.find((q) => q.userId === a);
    const qb = waiting.find((q) => q.userId === b);
    if (!qa || !qb) {
      return NextResponse.json({ error: "Guests not in queue" }, { status: 409 });
    }

    const [ua] = await db.select().from(users).where(eq(users.id, a)).limit(1);
    const [ub] = await db.select().from(users).where(eq(users.id, b)).limit(1);
    if (!ua || !ub) {
      return NextResponse.json({ error: "Users missing" }, { status: 404 });
    }

    const tcId = (
      night.theme === "bullet"
        ? "3|2"
        : night.timeControl in TIME_CONTROLS
          ? night.timeControl
          : "10|0"
    ) as TimeControlId;
    const tc = TIME_CONTROLS[tcId];
    const chatMode = isSalonChatMode(night.chatMode) ? night.chatMode : "all";
    const blindfoldCafe = night.theme === "blindfold";
    const whiteToken = generatePlayerToken();
    const blackToken = generatePlayerToken();
    let code = generateGameCode();

    for (let i = 0; i < 5; i++) {
      try {
        const [row] = await db
          .insert(games)
          .values({
            code,
            status: "active",
            whiteName: ua.username,
            blackName: ub.username,
            whiteToken,
            blackToken,
            whiteUserId: ua.id,
            blackUserId: ub.id,
            whiteClockMs: tc.baseMs,
            blackClockMs: tc.baseMs,
            timeControlMs: tc.baseMs,
            incrementMs: tc.incMs,
            salonNightId: night.id,
            blindfoldCafe,
            chatMode,
            rated: false,
            joinTicket: null,
          })
          .returning();

        await db
          .update(salonQueue)
          .set({ status: "seated" })
          .where(inArray(salonQueue.id, [qa.id, qb.id]));

        try {
          const pusher = getPusher();
          await pusher.trigger(userChannel(ua.id), "salon.seated", {
            code: row.code,
            color: "w",
            token: whiteToken,
          });
          await pusher.trigger(userChannel(ub.id), "salon.seated", {
            code: row.code,
            color: "b",
            token: blackToken,
          });
        } catch {
          // optional
        }

        return NextResponse.json({
          code: row.code,
          white: {
            username: ua.username,
            seatPath: `/seat/${row.code}?c=w&t=${whiteToken}`,
          },
          black: {
            username: ub.username,
            seatPath: `/seat/${row.code}?c=b&t=${blackToken}`,
          },
        });
      } catch {
        code = generateGameCode();
      }
    }
    return NextResponse.json({ error: "Could not pair" }, { status: 500 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
