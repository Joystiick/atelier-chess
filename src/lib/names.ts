const NAME_KEY = "atelier.displayName";
const SOUND_KEY = "atelier.sound";
const THEME_KEY = "atelier.theme";

export type BoardTheme = "salon-emerald" | "midnight-brass";

export function getCachedDisplayName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setCachedDisplayName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 20));
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, 20);
  if (cleaned.length > 0) return cleaned;
  const n = Math.floor(Math.random() * 900) + 100;
  return `Wanderer${n}`;
}

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SOUND_KEY);
  return v !== "0";
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(SOUND_KEY, on ? "1" : "0");
}

export function getBoardTheme(): BoardTheme {
  if (typeof window === "undefined") return "salon-emerald";
  const v = localStorage.getItem(THEME_KEY);
  return v === "midnight-brass" ? "midnight-brass" : "salon-emerald";
}

export function setBoardTheme(theme: BoardTheme) {
  localStorage.setItem(THEME_KEY, theme);
}
