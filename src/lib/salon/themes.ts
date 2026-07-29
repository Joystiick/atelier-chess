import type { TimeControlId } from "@/lib/names";

export const SALON_THEMES = ["blindfold", "bullet", "emotes", "open"] as const;
export type SalonTheme = (typeof SALON_THEMES)[number];

export const SALON_CHAT_MODES = ["all", "emotes", "off"] as const;
export type SalonChatMode = (typeof SALON_CHAT_MODES)[number];

export type SalonWindowStatus = "opens_at" | "open" | "closed";

export type SalonPresetId = SalonTheme;

export type SalonPreset = {
  id: SalonPresetId;
  label: string;
  description: string;
  defaultName: string;
  theme: SalonTheme;
  timeControl: TimeControlId;
  chatMode: SalonChatMode;
};

export const SALON_PRESETS: Record<SalonPresetId, SalonPreset> = {
  blindfold: {
    id: "blindfold",
    label: "Blindfold hour",
    description: "Hidden pieces ÔÇö play by coordinates and feel.",
    defaultName: "Blindfold hour",
    theme: "blindfold",
    timeControl: "10|0",
    chatMode: "all",
  },
  bullet: {
    id: "bullet",
    label: "Bullet caf├®",
    description: "3+2 tables only ÔÇö quick rounds, lively lobby.",
    defaultName: "Bullet caf├®",
    theme: "bullet",
    timeControl: "3|2",
    chatMode: "all",
  },
  emotes: {
    id: "emotes",
    label: "Emotes-only",
    description: "No chat text ÔÇö reactions and board only.",
    defaultName: "Emotes-only night",
    theme: "emotes",
    timeControl: "10|0",
    chatMode: "emotes",
  },
  open: {
    id: "open",
    label: "Open salon",
    description: "Classic host desk ÔÇö pick any time control.",
    defaultName: "Salon night",
    theme: "open",
    timeControl: "10|0",
    chatMode: "all",
  },
};

export function isSalonTheme(v: unknown): v is SalonTheme {
  return typeof v === "string" && (SALON_THEMES as readonly string[]).includes(v);
}

export function isSalonChatMode(v: unknown): v is SalonChatMode {
  return typeof v === "string" && (SALON_CHAT_MODES as readonly string[]).includes(v);
}

export function themeLabel(theme: string | null | undefined): string {
  if (theme && isSalonTheme(theme)) return SALON_PRESETS[theme].label;
  return "Salon";
}

/** Whether the night accepts join/pair right now. */
export function salonWindowStatus(
  night: {
    status: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
  },
  now: Date = new Date(),
): SalonWindowStatus {
  if (night.status === "closed") return "closed";
  if (night.startsAt) {
    const start = new Date(night.startsAt);
    if (!Number.isNaN(start.getTime()) && now < start) return "opens_at";
  }
  if (night.endsAt) {
    const end = new Date(night.endsAt);
    if (!Number.isNaN(end.getTime()) && now > end) return "closed";
  }
  return "open";
}

export function isSalonAccepting(
  night: {
    status: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
  },
  now?: Date,
): boolean {
  return salonWindowStatus(night, now) === "open";
}

export function parseOptionalIso(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
