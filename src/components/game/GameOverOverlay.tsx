"use client";

import { InviteQrPanel } from "@/components/game/InviteQrPanel";
import { type ReactNode, useState } from "react";

type GameOverOverlayProps = {
  title: string;
  subtitle?: string;
  pgn?: string;
  eloNote?: string;
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  onTertiary?: () => void;
  tertiaryLabel?: string;
  onAnalyze?: () => void;
  onShare?: () => void;
  onGhostRematch?: () => void;
  ghostRematch?: { code: string; joinTicket: string } | null;
  rematchQr?: ReactNode;
};

export function GameOverOverlay({
  title,
  subtitle,
  pgn,
  eloNote,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  onTertiary,
  tertiaryLabel,
  onAnalyze,
  onShare,
  onGhostRematch,
  ghostRematch,
  rematchQr,
}: GameOverOverlayProps) {
  const [showPgn, setShowPgn] = useState(false);

  return (
    <div className="overlay-scrim" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="overlay-card max-h-[90vh] overflow-y-auto">
        <h2
          id="game-over-title"
          className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-[var(--mist)]">{subtitle}</p>}
        {eloNote && <p className="mt-1 text-sm text-[var(--brass)]">{eloNote}</p>}

        {ghostRematch && (
          <div className="mt-4">
            <InviteQrPanel
              code={ghostRematch.code}
              joinTicket={ghostRematch.joinTicket}
              rematchCode={ghostRematch.code}
              rematchTicket={ghostRematch.joinTicket}
              status="waiting"
              compact
              joinOnly
            />
          </div>
        )}
        {rematchQr && <div className="mt-4">{rematchQr}</div>}

        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className="btn-primary w-full" onClick={onPrimary}>
            {primaryLabel}
          </button>
          {onGhostRematch && !ghostRematch && (
            <button type="button" className="btn-ghost w-full" onClick={onGhostRematch}>
              Ghost rematch QR
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {onAnalyze && (
              <button type="button" className="btn-ghost w-full" onClick={onAnalyze}>
                Analyze
              </button>
            )}
            {onSecondary && secondaryLabel && (
              <button type="button" className="btn-ghost w-full" onClick={onSecondary}>
                {secondaryLabel}
              </button>
            )}
          </div>
          {(onShare || pgn || onTertiary) && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {onShare && (
                <button type="button" className="chip" onClick={onShare}>
                  Share PGN
                </button>
              )}
              {pgn && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => setShowPgn((v) => !v)}
                >
                  {showPgn ? "Hide moves" : "Show moves"}
                </button>
              )}
              {onTertiary && tertiaryLabel && (
                <button type="button" className="chip" onClick={onTertiary}>
                  {tertiaryLabel}
                </button>
              )}
            </div>
          )}
        </div>
        {showPgn && pgn && (
          <pre className="mt-3 max-h-28 overflow-auto rounded bg-black/30 p-2 text-left text-[10px] leading-relaxed text-[var(--mist)]">
            {pgn}
          </pre>
        )}
      </div>
    </div>
  );
}
