import type { BoardTheme } from "@/lib/names";

/** Cosmetics unlocked only with Atelier Pass (no Elo / rating effect). */
export const PASS_THEME_IDS: BoardTheme[] = ["rain-glass", "ink-wash", "opera-box"];

export const PASS_PIECE_HINT = "atelier-pass";

export type PassStatus = {
  active: boolean;
  cosmetics: string[];
  /** Stripe-ready placeholder — wire checkout later */
  checkoutReady: boolean;
};

export function parsePassCosmetics(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, 32);
  } catch {
    return [];
  }
}

export function passUnlocksTheme(
  theme: BoardTheme,
  pass: { active: boolean; cosmetics: string[] },
): boolean {
  if (!PASS_THEME_IDS.includes(theme)) return false;
  return pass.active || pass.cosmetics.includes(theme);
}
