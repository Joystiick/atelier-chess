"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("atelier.installDismiss") === "1") {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!evt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,22rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--brass-dim)] bg-[var(--panel)] px-3 py-2.5 shadow-lg backdrop-blur">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--cream)]">Install Atelier</p>
        <p className="text-xs text-[var(--mist)]">Add to home screen for quick play.</p>
      </div>
      <button
        type="button"
        className="chip shrink-0"
        onClick={() => {
          void evt.prompt().then(async () => {
            await evt.userChoice;
            setEvt(null);
          });
        }}
      >
        Install
      </button>
      <button
        type="button"
        className="text-xs text-[var(--mist)] hover:text-[var(--cream)]"
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem("atelier.installDismiss", "1");
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
