"use client";

import { useState } from "react";

type WaitingRoomProps = {
  code: string;
  hostName: string;
};

export function WaitingRoom({ code, hostName }: WaitingRoomProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/play?join=${code}`
      : `/play?join=${code}`;

  const copy = async (kind: "code" | "link") => {
    const text = kind === "code" ? code : shareUrl;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="overlay-scrim" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="overlay-card space-y-4">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--brass)]">
          Waiting for opponent
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          {hostName} has the white pieces
        </h2>
        <p className="text-6xl font-[family-name:var(--font-display)] tracking-[0.2em] text-[var(--cream)]">
          {code}
        </p>
        <p className="text-sm text-[var(--mist)]">
          Share this code — the board unlocks when they join.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary flex-1" onClick={() => void copy("code")}>
            {copied === "code" ? "Copied code" : "Copy code"}
          </button>
          <button type="button" className="btn-ghost flex-1" onClick={() => void copy("link")}>
            {copied === "link" ? "Copied link" : "Copy invite link"}
          </button>
        </div>
      </div>
    </div>
  );
}
