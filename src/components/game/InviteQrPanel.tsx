"use client";

import { TableQr } from "@/components/game/TableQr";
import { useMemo, useState } from "react";

type InviteQrPanelProps = {
  code: string;
  joinTicket?: string | null;
  status: "waiting" | "active" | "finished" | "abandoned";
  isHost?: boolean;
  onRefreshTicket?: () => void;
  rematchCode?: string | null;
  rematchTicket?: string | null;
  compact?: boolean;
  /** Hide watch tab / keep join-focused */
  joinOnly?: boolean;
};

export function InviteQrPanel({
  code,
  joinTicket,
  status,
  isHost,
  onRefreshTicket,
  rematchCode,
  rematchTicket,
  compact,
  joinOnly,
}: InviteQrPanelProps) {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://atelierchess.netlify.app";

  const joinUrl = useMemo(() => {
    if (rematchCode) {
      const t = rematchTicket ? `?t=${rematchTicket}` : "";
      return `${origin}/join/${rematchCode}${t}`;
    }
    if (status === "waiting" && joinTicket) {
      return `${origin}/join/${code}?t=${joinTicket}`;
    }
    if (status === "waiting") return `${origin}/join/${code}`;
    return `${origin}/watch/${code}`;
  }, [origin, code, joinTicket, status, rematchCode, rematchTicket]);

  const watchUrl = `${origin}/watch/${code}`;
  const canJoin = Boolean(status === "waiting" || rematchCode);
  const [tab, setTab] = useState<"join" | "watch">(canJoin ? "join" : "watch");
  const [copied, setCopied] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const activeUrl = tab === "join" && canJoin ? joinUrl : watchUrl;
  const size = compact ? 140 : 200;

  const copy = async () => {
    await navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Atelier Chess",
          text: tab === "join" ? "Sit at my table" : "Watch this game",
          url: activeUrl,
        });
      } else {
        await copy();
      }
    } catch {
      // cancelled
    }
  };

  return (
    <div className="space-y-3">
      {!joinOnly && (
        <div className="flex flex-wrap justify-center gap-2">
          {canJoin && (
            <button
              type="button"
              className={`chip touch-target ${tab === "join" ? "ring-1 ring-[var(--brass)]" : ""}`}
              onClick={() => setTab("join")}
            >
              {rematchCode ? "Rematch" : "Join"}
            </button>
          )}
          <button
            type="button"
            className={`chip touch-target ${tab === "watch" ? "ring-1 ring-[var(--brass)]" : ""}`}
            onClick={() => setTab("watch")}
          >
            Watch
          </button>
        </div>
      )}

      <TableQr
        url={activeUrl}
        size={size}
        label={
          tab === "join" && canJoin
            ? rematchCode
              ? "Scan for rematch seat"
              : "Scan to sit — one-time ticket"
            : "Scan to spectate"
        }
      />

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="chip touch-target" onClick={() => void share()}>
          Share
        </button>
        <button type="button" className="chip touch-target" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy link"}
        </button>
        {tab === "join" && isHost && status === "waiting" && onRefreshTicket && (
          <button type="button" className="chip touch-target" onClick={onRefreshTicket}>
            New ticket
          </button>
        )}
        <button
          type="button"
          className="chip touch-target"
          onClick={() => setShowUrl((v) => !v)}
        >
          {showUrl ? "Hide link" : "Show link"}
        </button>
      </div>
      {showUrl && (
        <p className="break-all text-[10px] text-[var(--mist)]">{activeUrl}</p>
      )}
    </div>
  );
}
