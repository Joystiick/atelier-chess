export type PieceSetId = "classic" | "ink" | "brass-glow";

export const PIECE_SETS: Record<
  PieceSetId,
  { label: string; unlockAt: number; filter: string }
> = {
  classic: { label: "Classic", unlockAt: 0, filter: "none" },
  ink: { label: "Ink Wash", unlockAt: 4, filter: "grayscale(0.35) contrast(1.15)" },
  "brass-glow": {
    label: "Brass Glow",
    unlockAt: 10,
    filter: "sepia(0.45) saturate(1.4) hue-rotate(5deg)",
  },
};

export type MoodId = "salon" | "midnight" | "rain" | "opera";

export const MOOD_PACKS: Record<
  MoodId,
  { label: string; theme: string; ambient: "off" | "rain" | "room" | "hall" }
> = {
  salon: { label: "Salon Evening", theme: "salon-emerald", ambient: "room" },
  midnight: { label: "Midnight Study", theme: "midnight-brass", ambient: "hall" },
  rain: { label: "Rain Window", theme: "rain-glass", ambient: "rain" },
  opera: { label: "Opera Box", theme: "opera-box", ambient: "hall" },
};

const K = {
  premove: "atelier.premove",
  confirm: "atelier.confirmMove",
  pieceSet: "atelier.pieceSet",
  mood: "atelier.mood",
  coach: "atelier.coach",
  blindfold: "atelier.blindfold",
  lampAuto: "atelier.lampAuto",
} as const;

function ls() {
  return typeof window !== "undefined" ? localStorage : null;
}

export function getPremoveEnabled() {
  return ls()?.getItem(K.premove) === "1";
}
export function setPremoveEnabled(on: boolean) {
  ls()?.setItem(K.premove, on ? "1" : "0");
}

export function getConfirmMove() {
  return ls()?.getItem(K.confirm) === "1";
}
export function setConfirmMove(on: boolean) {
  ls()?.setItem(K.confirm, on ? "1" : "0");
}

export function getPieceSet(): PieceSetId {
  const v = ls()?.getItem(K.pieceSet);
  if (v && v in PIECE_SETS) return v as PieceSetId;
  return "classic";
}
export function setPieceSet(id: PieceSetId) {
  ls()?.setItem(K.pieceSet, id);
}

export function getMood(): MoodId | null {
  const v = ls()?.getItem(K.mood);
  if (v && v in MOOD_PACKS) return v as MoodId;
  return null;
}
export function setMood(id: MoodId | null) {
  if (!id) ls()?.removeItem(K.mood);
  else ls()?.setItem(K.mood, id);
}

export function getCoachMode() {
  return ls()?.getItem(K.coach) === "1";
}
export function setCoachMode(on: boolean) {
  ls()?.setItem(K.coach, on ? "1" : "0");
}

export function getBlindfold() {
  return ls()?.getItem(K.blindfold) === "1";
}
export function setBlindfold(on: boolean) {
  ls()?.setItem(K.blindfold, on ? "1" : "0");
}

export function getLampAuto() {
  return ls()?.getItem(K.lampAuto) !== "0";
}
export function setLampAuto(on: boolean) {
  ls()?.setItem(K.lampAuto, on ? "1" : "0");
}

/** Soft lamp/vignette bias by local hour when auto is on. */
export function lampForHour(hour = new Date().getHours()) {
  if (hour >= 22 || hour < 6) return { vignette: true, ambientBias: "hall" as const };
  if (hour >= 17) return { vignette: true, ambientBias: "room" as const };
  return { vignette: false, ambientBias: "off" as const };
}

export function currentSeasonKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
