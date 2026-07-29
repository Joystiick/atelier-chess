export type BoardTheme =
  | "salon-emerald"
  | "midnight-brass"
  | "library-oak"
  | "carrara-marble"
  | "cafe-cloth"
  | "rain-glass"
  | "ink-wash"
  | "opera-box";

export type AmbientMode = "off" | "rain" | "room" | "hall";

export type TimeControlId = "∞" | "3|2" | "5|0" | "10|0" | "15|10";

export const TIME_CONTROLS: Record<
  TimeControlId,
  { label: string; baseMs: number; incMs: number }
> = {
  "∞": { label: "Unlimited", baseMs: 0, incMs: 0 },
  "3|2": { label: "3+2 Blitz", baseMs: 180_000, incMs: 2_000 },
  "5|0": { label: "5+0 Blitz", baseMs: 300_000, incMs: 0 },
  "10|0": { label: "10+0 Rapid", baseMs: 600_000, incMs: 0 },
  "15|10": { label: "15+10 Rapid", baseMs: 900_000, incMs: 10_000 },
};

/** Square colors + optional board-frame CSS modifier. Skin owns squares; mood owns ambient. */
export const BOARD_THEMES: Record<
  BoardTheme,
  { label: string; unlockAt: number; light: string; dark: string; frame?: string }
> = {
  "salon-emerald": {
    label: "Salon Emerald",
    unlockAt: 0,
    light: "#dce8df",
    dark: "#2f5d4a",
  },
  "midnight-brass": {
    label: "Midnight Brass",
    unlockAt: 0,
    light: "#c9b896",
    dark: "#1a2330",
  },
  "library-oak": {
    label: "Walnut Wood",
    unlockAt: 0,
    light: "#e8d5b5",
    dark: "#6b4423",
    frame: "board-frame--walnut-wood",
  },
  "carrara-marble": {
    label: "Carrara Marble",
    unlockAt: 0,
    light: "#f4f1ea",
    dark: "#9a9b9e",
    frame: "board-frame--carrara-marble",
  },
  "cafe-cloth": {
    label: "Café Cloth",
    unlockAt: 0,
    light: "#d4dbc0",
    dark: "#3a5c3f",
    frame: "board-frame--cafe-cloth",
  },
  "rain-glass": {
    label: "Rain on Glass",
    unlockAt: 5,
    light: "#c5d4dc",
    dark: "#3a4f5c",
  },
  "ink-wash": {
    label: "Ink Wash",
    unlockAt: 8,
    light: "#e6e6e6",
    dark: "#2a2a2a",
  },
  "opera-box": {
    label: "Opera Box",
    unlockAt: 12,
    light: "#f0d4d8",
    dark: "#4a2030",
  },
};

const K = {
  name: "atelier.displayName",
  sound: "atelier.sound",
  theme: "atelier.theme",
  ambient: "atelier.ambient",
  gamesPlayed: "atelier.gamesPlayed",
  elo: "atelier.elo",
  recent: "atelier.recentTables",
  lastOpponent: "atelier.lastOpponent",
  puzzleStreak: "atelier.puzzleStreak",
  puzzleStreakDay: "atelier.puzzleStreakDay",
  howToSeen: "atelier.howToSeen",
  timeControl: "atelier.timeControl",
} as const;

function ls() {
  return typeof window !== "undefined" ? localStorage : null;
}

export function getCachedDisplayName(): string {
  return ls()?.getItem(K.name) ?? "";
}

export function setCachedDisplayName(name: string) {
  ls()?.setItem(K.name, name.trim().slice(0, 20));
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ").slice(0, 20);
  if (cleaned.length > 0) return cleaned;
  const n = Math.floor(Math.random() * 900) + 100;
  return `Wanderer${n}`;
}

export function getSoundEnabled(): boolean {
  return ls()?.getItem(K.sound) !== "0";
}

export function setSoundEnabled(on: boolean) {
  ls()?.setItem(K.sound, on ? "1" : "0");
}

export function getBoardTheme(): BoardTheme {
  const v = ls()?.getItem(K.theme);
  if (v && v in BOARD_THEMES) return v as BoardTheme;
  return "salon-emerald";
}

export function setBoardTheme(theme: BoardTheme) {
  if (!isThemeUnlocked(theme)) return;
  ls()?.setItem(K.theme, theme);
}

export function getGamesPlayed(): number {
  return Number(ls()?.getItem(K.gamesPlayed) ?? "0") || 0;
}

export function bumpGamesPlayed() {
  const n = getGamesPlayed() + 1;
  ls()?.setItem(K.gamesPlayed, String(n));
  return n;
}

export function isThemeUnlocked(theme: BoardTheme): boolean {
  return getGamesPlayed() >= BOARD_THEMES[theme].unlockAt;
}

export function getAmbient(): AmbientMode {
  const v = ls()?.getItem(K.ambient);
  if (v === "rain" || v === "room" || v === "hall" || v === "off") return v;
  return "off";
}

export function setAmbient(mode: AmbientMode) {
  ls()?.setItem(K.ambient, mode);
}

export function getElo(): number {
  return Number(ls()?.getItem(K.elo) ?? "1200") || 1200;
}

export function setElo(n: number) {
  ls()?.setItem(K.elo, String(Math.round(n)));
}

/** Simple Elo update vs AI difficulty or human. */
export function updateElo(result: "win" | "loss" | "draw", opponentRating: number) {
  const rating = getElo();
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  const score = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  const next = rating + 24 * (score - expected);
  setElo(next);
  return Math.round(next);
}

export type RecentTable = {
  code: string;
  opponent: string;
  at: number;
};

export function getRecentTables(): RecentTable[] {
  try {
    const raw = ls()?.getItem(K.recent);
    if (!raw) return [];
    return JSON.parse(raw) as RecentTable[];
  } catch {
    return [];
  }
}

export function pushRecentTable(code: string, opponent: string) {
  const list = getRecentTables().filter((t) => t.code !== code);
  list.unshift({ code, opponent, at: Date.now() });
  ls()?.setItem(K.recent, JSON.stringify(list.slice(0, 5)));
}

export function getLastOpponent(): string {
  return ls()?.getItem(K.lastOpponent) ?? "";
}

export function setLastOpponent(name: string) {
  ls()?.setItem(K.lastOpponent, name.slice(0, 20));
}

/** Local calendar day key YYYY-MM-DD for daily puzzle streak. */
export function puzzleCalendarDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function puzzleYesterdayKey(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return puzzleCalendarDayKey(d);
}

function rawPuzzleStreak(): number {
  return Number(ls()?.getItem(K.puzzleStreak) ?? "0") || 0;
}

/** Drop streak when the last solve was before yesterday (missed a calendar day). */
function syncPuzzleStreakForMiss(): void {
  const store = ls();
  if (!store) return;
  const last = store.getItem(K.puzzleStreakDay) ?? "";
  if (!last) return;
  const today = puzzleCalendarDayKey();
  const yesterday = puzzleYesterdayKey();
  if (last !== today && last !== yesterday) {
    store.setItem(K.puzzleStreak, "0");
  }
}

export function getPuzzleStreak(): number {
  syncPuzzleStreakForMiss();
  return rawPuzzleStreak();
}

export function setPuzzleStreak(n: number) {
  ls()?.setItem(K.puzzleStreak, String(Math.max(0, Math.floor(n))));
}

export function isDailyPuzzleSolvedToday(): boolean {
  return (ls()?.getItem(K.puzzleStreakDay) ?? "") === puzzleCalendarDayKey();
}

/** Record a daily solve once per calendar day; returns the streak after update. */
export function recordDailyPuzzleSolved(): number {
  syncPuzzleStreakForMiss();
  const store = ls();
  if (!store) return 0;
  const today = puzzleCalendarDayKey();
  const last = store.getItem(K.puzzleStreakDay) ?? "";
  if (last === today) return rawPuzzleStreak();
  const next = (last === puzzleYesterdayKey() ? rawPuzzleStreak() : 0) + 1;
  store.setItem(K.puzzleStreak, String(next));
  store.setItem(K.puzzleStreakDay, today);
  return next;
}

export function hasSeenHowTo(): boolean {
  return ls()?.getItem(K.howToSeen) === "1";
}

export function setSeenHowTo() {
  ls()?.setItem(K.howToSeen, "1");
}

export function getPreferredTimeControl(): TimeControlId {
  const v = ls()?.getItem(K.timeControl);
  if (v && v in TIME_CONTROLS) return v as TimeControlId;
  return "10|0";
}

export function setPreferredTimeControl(id: TimeControlId) {
  ls()?.setItem(K.timeControl, id);
}
