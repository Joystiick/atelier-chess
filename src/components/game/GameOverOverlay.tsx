"use client";

type GameOverOverlayProps = {
  title: string;
  subtitle?: string;
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  onTertiary?: () => void;
  tertiaryLabel?: string;
};

export function GameOverOverlay({
  title,
  subtitle,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  onTertiary,
  tertiaryLabel,
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
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" className="btn-primary w-full" onClick={onPrimary}>
            {primaryLabel}
          </button>
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
