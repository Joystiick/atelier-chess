"use client";

import { InviteQrPanel } from "@/components/game/InviteQrPanel";
import { TableQr } from "@/components/game/TableQr";
import { useEffect, useMemo, useState } from "react";

type TablecastQrDockProps = {
  code: string;
  joinTicket?: string | null;
  status: "waiting" | "active" | "finished" | "abandoned";
  isHost?: boolean;
  onRefreshTicket?: () => void;
  spectatorCount?: number;
  rematchCode?: string | null;
  rematchTicket?: string | null;
  compact?: boolean;
};

/**
 * Persistent join + watch QR dock for Tablecast host display.
 */
export function TablecastQrDock({
  code,
  joinTicket,
  status,
  isHost,
  onRefreshTicket,
  spectatorCount = 0,
  rematchCode,
  rematchTicket,
  compact,
}: TablecastQrDockProps) {
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
    return null;
  }, [origin, code, joinTicket, status, rematchCode, rematchTicket]);

  const watchUrl = `${origin}/watch/${code}`;
  const showDual = Boolean(joinUrl) && status === "waiting";
  const size = compact ? 120 : 160;

  const [copied, setCopied] = useState<"join" | "watch" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!showDual) {
    return (
      <div className="tablecast-dock space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--brass)]">
            Gallery
          </p>
          <span className="chip pointer-events-none text-xs">
            {spectatorCount} watching
          </span>
        </div>
        <InviteQrPanel
          code={code}
          joinTicket={joinTicket}
          status={status}
          isHost={isHost}
          onRefreshTicket={onRefreshTicket}
          rematchCode={rematchCode}
          rematchTicket={rematchTicket}
          compact
        />
      </div>
    );
  }

  return (
    <div className="tablecast-dock space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--brass)]">
          Tablecast
        </p>
        <span className="chip pointer-events-none text-xs">
          {spectatorCount} watching
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 text-center">
          <TableQr url={joinUrl!} size={size} label="Sit — phone seat" />
          <button
            type="button"
            className="chip touch-target w-full text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(joinUrl!);
              setCopied("join");
            }}
          >
            {copied === "join" ? "Copied" : "Copy join"}
          </button>
          {isHost && status === "waiting" && onRefreshTicket && (
            <button
              type="button"
              className="chip touch-target w-full text-xs"
              onClick={onRefreshTicket}
            >
              New ticket
            </button>
          )}
        </div>
        <div className="space-y-2 text-center">
          <TableQr url={watchUrl} size={size} label="Watch — gallery" />
          <button
            type="button"
            className="chip touch-target w-full text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(watchUrl);
              setCopied("watch");
            }}
          >
            {copied === "watch" ? "Copied" : "Copy watch"}
          </button>
        </div>
      </div>
    </div>
  );
}
