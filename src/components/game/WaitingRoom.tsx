"use client";

import { TableQr } from "@/components/game/TableQr";
import { useFriendsFeed } from "@/hooks/useFriendsFeed";
import { useMemo, useState } from "react";

type WaitingRoomProps = {
  code: string;
  hostName: string;
};

export function WaitingRoom({ code, hostName }: WaitingRoomProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [inviteMsg, setInviteMsg] = useState("");
  const { friends } = useFriendsFeed();

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://atelierchess.netlify.app/join/${code}`;
    return `${window.location.origin}/join/${code}`;
  }, [code]);

  const copy = async (kind: "code" | "link") => {
    const text = kind === "code" ? code : shareUrl;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Atelier Chess",
          text: `${hostName} invited you to a table`,
          url: shareUrl,
        });
      } else {
        await copy("link");
      }
    } catch {
      // user cancelled
    }
  };

  const inviteFriend = async (friendId: string, username: string) => {
    setInviteMsg("");
    const res = await fetch("/api/friends/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteMsg(data.error ?? "Invite failed");
      return;
    }
    setInviteMsg(`Invited ${username}`);
  };

  return (
    <div className="overlay-scrim" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="overlay-card max-h-[90vh] space-y-4 overflow-y-auto">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--brass)]">
          Waiting for opponent
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          {hostName} has the white pieces
        </h2>

        <TableQr
          url={shareUrl}
          size={180}
          label="Scan to sit — signs in if needed, then joins"
        />

        <p className="text-5xl font-[family-name:var(--font-display)] tracking-[0.2em] text-[var(--cream)]">
          {code}
        </p>
        <p className="text-sm text-[var(--mist)]">
          Friend scans the QR, or opens the link. One tap from camera to the board.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary flex-1" onClick={() => void nativeShare()}>
            Share table
          </button>
          <button type="button" className="btn-ghost flex-1" onClick={() => void copy("code")}>
            {copied === "code" ? "Copied code" : "Copy code"}
          </button>
          <button type="button" className="btn-ghost flex-1" onClick={() => void copy("link")}>
            {copied === "link" ? "Copied link" : "Copy link"}
          </button>
        </div>

        {friends.length > 0 && (
          <div className="space-y-2 border-t border-white/10 pt-3 text-left">
            <p className="text-xs uppercase tracking-widest text-[var(--mist)]">
              Or invite a friend
            </p>
            {friends.map((f) => (
              <button
                key={f.id}
                type="button"
                className="flex w-full items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                onClick={() => void inviteFriend(f.id, f.username)}
              >
                <span>
                  {f.avatar} {f.username}
                </span>
                <span className="text-[var(--brass)]">Invite</span>
              </button>
            ))}
          </div>
        )}
        {inviteMsg && <p className="text-sm text-[var(--brass)]">{inviteMsg}</p>}
      </div>
    </div>
  );
}
