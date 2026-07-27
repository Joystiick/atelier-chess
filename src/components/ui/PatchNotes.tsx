"use client";

import { useEffect, useState } from "react";

/** Bump this when you want the note to show again for everyone. */
const PATCH_ID = "2026-07-27-accounts-friends";

const NOTES = [
  "Accounts required to play — sign in or register first.",
  "Friends list: search, request, accept, remove.",
  "Invite friends to a table from lobby, Friends, or the waiting room.",
  "Easier Easy AI, unlimited time, replay fix, safer zoom on the background.",
];

export function PatchNotes() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(`atelier.patch.${PATCH_ID}`) === "1") return;
      setOpen(true);
    } catch {
      // private mode — skip
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(`atelier.patch.${PATCH_ID}`, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="overlay-scrim" role="dialog" aria-modal="true" aria-labelledby="patch-title">
      <div className="overlay-card">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--brass)]">Patch notes</p>
        <h2
          id="patch-title"
          className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]"
        >
          What&apos;s new
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[var(--mist)]">
          {NOTES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="btn-primary mt-6 w-full" onClick={dismiss}>
          Got it
        </button>
        <p className="mt-3 text-center text-[10px] text-[var(--mist)]">
          Won&apos;t show again on this device.
        </p>
      </div>
    </div>
  );
}
