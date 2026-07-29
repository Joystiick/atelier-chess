import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PASS_THEME_IDS, parsePassCosmetics, type PassStatus } from "@/lib/pass";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Soft Atelier Pass — cosmetics flags only.
 * Stripe checkout hooks are stubbed until billing is enabled.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status: PassStatus = {
    active: Boolean(row.atelierPass),
    cosmetics: parsePassCosmetics(row.passCosmetics),
    checkoutReady: Boolean(process.env.STRIPE_SECRET_KEY),
  };
  return NextResponse.json({
    pass: status,
    unlockableThemes: PASS_THEME_IDS,
    note: "Cosmetics only — never affects Elo or matchmaking.",
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "preview-activate" | "stripe-checkout";
  };

  if (body.action === "stripe-checkout") {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        {
          error: "Stripe not configured",
          checkoutReady: false,
          hint: "Set STRIPE_SECRET_KEY to enable Pass checkout.",
        },
        { status: 501 },
      );
    }
    return NextResponse.json(
      {
        error: "Checkout session not wired yet",
        checkoutReady: true,
      },
      { status: 501 },
    );
  }

  // Dev / soft preview: flip Pass on for this account (no payment).
  if (body.action === "preview-activate") {
    const cosmetics = JSON.stringify(PASS_THEME_IDS);
    const [updated] = await db
      .update(users)
      .set({
        atelierPass: true,
        passCosmetics: cosmetics,
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth.user.id))
      .returning();
    return NextResponse.json({
      ok: true,
      pass: {
        active: true,
        cosmetics: PASS_THEME_IDS,
        checkoutReady: Boolean(process.env.STRIPE_SECRET_KEY),
      } satisfies PassStatus,
      userId: updated.id,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
