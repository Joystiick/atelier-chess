import { requireUser } from "@/lib/auth/requireUser";
import { generatePlayerToken, isValidCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { gameInvites, games } from "@/lib/db/schema";
import { gameChannel, getPusher } from "@/lib/pusher/server";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "accept" | "decline";
  };
  const action = body.action ?? "accept";

  const [invite] = await db
    .select()
    .from(gameInvites)
    .where(and(eq(gameInvites.id, id), eq(gameInvites.toUserId, me.id)))
    .limit(1);

  if (!invite || invite.status !== "pending") {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (new Date(invite.expiresAt) < new Date()) {
    await db
      .update(gameInvites)
      .set({ status: "expired" })
      .where(eq(gameInvites.id, id));
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  if (action === "decline") {
    await db
      .update(gameInvites)
      .set({ status: "declined" })
      .where(eq(gameInvites.id, id));
    return NextResponse.json({ ok: true, status: "declined" });
  }

  const code = invite.gameCode;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Bad invite" }, { status: 400 });
  }

  const [game] = await db.select().from(games).where(eq(games.code, code)).limit(1);
  if (!game || game.status !== "waiting" || game.blackToken) {
    await db
      .update(gameInvites)
      .set({ status: "expired" })
      .where(eq(gameInvites.id, id));
    return NextResponse.json({ error: "Table no longer open" }, { status: 409 });
  }

  const token = generatePlayerToken();
  const [updated] = await db
    .update(games)
    .set({
      blackName: me.username,
      blackToken: token,
      blackUserId: me.id,
      status: "active",
      joinTicket: null,
      updatedAt: new Date(),
    })
    .where(eq(games.id, game.id))
    .returning();

  await db
    .update(gameInvites)
    .set({ status: "accepted" })
    .where(eq(gameInvites.id, id));

  const jar = await cookies();
  jar.set(`atelier_seat_${code}`, `b:${token}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  try {
    await getPusher().trigger(gameChannel(code), "player.joined", {
      blackName: me.username,
      status: "active",
    });
  } catch {
    // optional
  }

  return NextResponse.json({
    ok: true,
    code: updated.code,
    color: "b" as const,
  });
}
