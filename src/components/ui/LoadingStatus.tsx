"use client";

type LoadingStatusProps = {
  eyebrow?: string;
  message: string;
};

/** Branded gate for auth/join/suspense — brass pulse + Fraunces line. */
export function LoadingStatus({
  eyebrow = "Atelier",
  message,
}: LoadingStatusProps) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <p className="loading-pulse text-xs uppercase tracking-[0.3em] text-[var(--brass)]">
          {eyebrow}
        </p>
        <p className="mt-3 font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]">
          {message}
        </p>
      </div>
    </main>
  );
}
