"use client";

import { useEffect, useState } from "react";

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatClockOrUnlimited(ms: number, unlimited: boolean) {
  if (unlimited) return "∞";
  return formatClock(ms);
}

type Anchor = {
  at: number;
  white: number;
  black: number;
  turn: "w" | "b";
};

/** Client clocks: derive remaining time from a server snapshot + ticking `now`. */
export function useClocks(opts: {
  enabled: boolean;
  turn: "w" | "b";
  gameOver: boolean;
  whiteMs: number;
  blackMs: number;
  onFlag: (color: "w" | "b") => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [anchor, setAnchor] = useState<Anchor>(() => ({
    at: Date.now(),
    white: opts.whiteMs,
    black: opts.blackMs,
    turn: opts.turn,
  }));
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    setFlagged(false);
    const t = window.setTimeout(() => {
      setAnchor({
        at: Date.now(),
        white: opts.whiteMs,
        black: opts.blackMs,
        turn: opts.turn,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [opts.whiteMs, opts.blackMs, opts.turn]);

  useEffect(() => {
    if (!opts.enabled || opts.gameOver) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [opts.enabled, opts.gameOver]);

  const elapsed =
    opts.enabled && !opts.gameOver ? Math.max(0, now - anchor.at) : 0;
  const whiteMs =
    anchor.turn === "w" ? Math.max(0, anchor.white - elapsed) : anchor.white;
  const blackMs =
    anchor.turn === "b" ? Math.max(0, anchor.black - elapsed) : anchor.black;

  useEffect(() => {
    if (!opts.enabled || opts.gameOver || flagged) return;
    if (whiteMs <= 0) {
      setFlagged(true);
      opts.onFlag("w");
    } else if (blackMs <= 0) {
      setFlagged(true);
      opts.onFlag("b");
    }
  }, [whiteMs, blackMs, opts, flagged]);

  return { whiteMs, blackMs };
}
