"use client";

import { InviteQrPanel } from "@/components/game/InviteQrPanel";
import { TableQr } from "@/components/game/TableQr";
import { useFriendsFeed } from "@/hooks/useFriendsFeed";
import { useCallback, useEffect, useState } from "react";

type WaitingRoomProps = {
  code: string;
  hostName: string;
  joinTicket?: string | null;
  onTicketChange?: (ticket: string) => void;
};

export function WaitingRoom({
  code,
  hostName,
  joinTicket: ticketProp,
  onTicketChange,
}: WaitingRoomProps) {
  const [ticket, setTicket] = useState(ticketProp ?? "");
  const [inviteMsg, setInviteMsg] = useState("");
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const { friends } = useFriendsFeed();

  useEffect(() => {
    if (ticketProp) setTicket(ticketProp);
  }, [ticketProp]);

  const refreshTicket = useCallback(async () => {
    const res = await fetch(`/api/games/${code}/ticket`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.joinTicket) {
      setTicket(data.joinTicket);
      onTicketChange?.(data.joinTicket);
    }
  }, [code, onTicketChange]);

  useEffect(() => {
    if (!ticket) void refreshTicket();
  }, [ticket, refreshTicket]);

  const startHandoff = async () => {
    const res = await fetch(`/api/games/${code}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteMsg(data.error ?? "Handoff failed");
      return;
    }
    setHandoffUrl(`${window.location.origin}${data.urlPath}`);
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
    <div className="overlay-scrim" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="overlay-card max-h-[90vh] space-y-4 overflow-y-auto">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--brass)]">
          Waiting for opponent
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          {hostName} has the white pieces
        </h2>

        <InviteQrPanel
          code={code}
          joinTicket={ticket}
          status="waiting"
          isHost
          onRefreshTicket={() => void refreshTicket()}
        />

        <p className="font-[family-name:var(--font-display)] text-3xl tracking-[0.18em] text-[var(--cream)]">
          {code}
        </p>
        <p className="text-sm text-[var(--mist)]">
          Friend scans Join — one-time ticket. Switch to Watch for spectators.
        </p>

        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "Fewer options" : "More options"}
        </button>

        {showMore && (
          <div className="space-y-3 border-t border-white/10 pt-3 text-left">
            <button
              type="button"
              className="btn-ghost w-full"
              onClick={() => void startHandoff()}
            >
              Move seat to another device
            </button>
            {handoffUrl && (
              <div className="space-y-2">
                <TableQr
                  url={handoffUrl}
                  size={140}
                  label="Scan on your other device"
                />
                <button
                  type="button"
                  className="chip"
                  onClick={() => void navigator.clipboard.writeText(handoffUrl)}
                >
                  Copy handoff link
                </button>
              </div>
            )}

            {friends.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-[var(--mist)]">
                  Invite a friend
                </p>
                <div className="flex flex-wrap gap-2">
                  {friends.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="chip touch-target"
                      onClick={() => void inviteFriend(f.id, f.username)}
                    >
                      {f.username}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inviteMsg && <p className="text-sm text-[var(--brass)]">{inviteMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
