"use client";

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
}: GameOverOverlayProps) {
  return (
    <div className="overlay-scrim" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
      <div className="overlay-card">
        <h2
          id="game-over-title"
          className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)]"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-[var(--mist)]">{subtitle}</p>}
        {eloNote && <p className="mt-1 text-sm text-[var(--brass)]">{eloNote}</p>}
        {pgn && (
          <pre className="mt-3 max-h-24 overflow-auto rounded bg-black/30 p-2 text-left text-[10px] leading-relaxed text-[var(--mist)]">
            {pgn}
          </pre>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className="btn-primary w-full" onClick={onPrimary}>
            {primaryLabel}
          </button>
          {onAnalyze && (
            <button type="button" className="btn-ghost w-full" onClick={onAnalyze}>
              Analyze
            </button>
          )}
          {onShare && (
            <button type="button" className="btn-ghost w-full" onClick={onShare}>
              Copy PGN / share
            </button>
          )}
          {onSecondary && secondaryLabel && (
            <button type="button" className="btn-ghost w-full" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
          {onTertiary && tertiaryLabel && (
            <button type="button" className="btn-ghost w-full" onClick={onTertiary}>
              {tertiaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
