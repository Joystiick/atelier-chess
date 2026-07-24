import type { AiLevel } from "@/lib/chess/engine";

const LINES: Record<AiLevel, { check: string[]; capture: string[]; quiet: string[]; end: string[] }> = {
  easy: {
    check: ["Oh!", "Did I do that?", "Wait—"],
    capture: ["Got one!", "Mine now.", "Oops for you."],
    quiet: ["Hmm.", "Okay…", "Your move!"],
    end: ["Good game!", "That was fun.", "Again?"],
  },
  medium: {
    check: ["Check.", "Watch the king.", "Pressure."],
    capture: ["Taken.", "Fair trade.", "Cleared."],
    quiet: ["Noted.", "Interesting.", "Proceed."],
    end: ["Well played.", "Until next time.", "Clean finish."],
  },
  hard: {
    check: ["…", "Inevitable.", ""],
    capture: ["Necessary.", "…", "Done."],
    quiet: ["…", "", "Continue."],
    end: ["Expected.", "…", "Enough."],
  },
};

export function rivalLine(
  level: AiLevel,
  kind: "check" | "capture" | "quiet" | "end",
): string {
  const pool = LINES[level][kind].filter(Boolean);
  if (pool.length === 0) return "";
  return pool[Math.floor(Math.random() * pool.length)] ?? "";
}

export const AI_ELO: Record<AiLevel, number> = {
  easy: 800,
  medium: 1200,
  hard: 1600,
};
