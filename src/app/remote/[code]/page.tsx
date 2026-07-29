"use client";

import { formatClockOrUnlimited, useClocks } from "@/lib/chess/clocks";
import { startVisibilityAwareInterval } from "@/lib/poll";
import { getPusherClient } from "@/lib/pusher/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const REMOTE_POLL_MS = 8_000;
const REACTIONS = ["­ƒæÅ", "­ƒÿ«", "­ƒöÑ", "ÔÖƒ´©Å", "Ôÿò", "­ƒÿé"] as const;

type Snap = {
  code: string;
  status: string;
  turn: string;
  whiteName: string | null;
  blackName: string | null;
  you: "w" | "b" | null;
  result: string | null;
  whiteClockMs?: number;
  blackClockMs?: number;
  timeControlMs?: number;
  drawOfferBy?: string | null;
  banterLog?: string;
};

export default function RemoteCompanionPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [error, setError] = useState("");
  const [whiteClockMs, setWhiteClockMs] = useState(600_000);
  const [blackClockMs, setBlackClockMs] = useState(600_000);
  const [drawOfferBy, setDrawOfferBy] = useState<string | null>(null);
  const [banterLog, setBanterLog] = useState("");
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [burst, setBurst] = useState<{ emoji: string; id: number }[]>([]);
  const [msg, setMsg] = useState("");

  const apply = useCallback((data: Snap) => {
    setSnap(data);
    if (data.whiteClockMs != null) setWhiteClockMs(data.whiteClockMs);
    if (data.blackClockMs != null) setBlackClockMs(data.blackClockMs);
    setDrawOfferBy(data.drawOfferBy ?? null);
    if (data.banterLog != null) setBanterLog(data.banterLog);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/games/${code}`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Not found");
        return;
      }
      apply(data);
    };
    void load();

    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    let stopPoll: (() => void) | null = null;

    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-game-${code}`);
      channel.bind("move.made", (data: {
        whiteClockMs?: number;
        blackClockMs?: number;
      }) => {
        if (data.whiteClockMs != null) setWhiteClockMs(data.whiteClockMs);
        if (data.blackClockMs != null) setBlackClockMs(data.blackClockMs);
        void load();
      });
      channel.bind("game.ended", () => void load());
      channel.bind("draw.offered", () => void load());
      channel.bind("draw.declined", () => void load());
      channel.bind("player.joined", () => void load());
      channel.bind("banter.posted", (data: { line?: string }) => {
        if (data.line) {
          setBanterLog((prev) => (prev ? `${prev}\n${data.line}` : data.line!));
        }
        void load();
      });
      channel.bind("spectator.reaction", (data: { emoji: string }) => {
        const id = Date.now() + Math.random();
        setBurst((b) => [...b.slice(-6), { emoji: data.emoji, id }]);
        window.setTimeout(() => {
          setBurst((b) => b.filter((x) => x.id !== id));
        }, 2400);
      });
      stopPoll = startVisibilityAwareInterval(() => void load(), REMOTE_POLL_MS);
    } catch {
      stopPoll = startVisibilityAwareInterval(() => void load(), 4_000);
    }

    return () => {
      cancelled = true;
      stopPoll?.();
      if (channel) {
        channel.unbind_all();
        try {
          getPusherClient().unsubscribe(`private-game-${code}`);
        } catch {
          // ignore
        }
      }
    };
  }, [code, apply]);

  const turn = (snap?.turn === "b" ? "b" : "w") as "w" | "b";
  const unlimited = (snap?.timeControlMs ?? 600_000) === 0;
  const gameOver =
    snap?.status === "finished" || snap?.status === "abandoned" || Boolean(snap?.result);
  const { whiteMs, blackMs } = useClocks({
    enabled: Boolean(snap) && snap?.status === "active" && !unlimited,
    turn,
    gameOver,
    whiteMs: whiteClockMs,
    blackMs: blackClockMs,
    onFlag: () => {
      /* server flags on next move */
    },
  });

  const you = snap?.you ?? null;
  const seated = Boolean(you);

  const doAction = async (
    action: "offer-draw" | "accept-draw" | "decline-draw",
  ) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/games/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const refresh = await fetch(`/api/games/${code}`);
      const next = await refresh.json();
      if (refresh.ok) apply(next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const resign = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/games/${code}/resign`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Resign failed");
      setConfirmResign(false);
      const refresh = await fetch(`/api/games/${code}`);
      const next = await refresh.json();
      if (refresh.ok) apply(next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Resign failed");
    } finally {
      setBusy(false);
    }
  };

  const react = async (emoji: string) => {
    const from =
      you === "w"
        ? snap?.whiteName ?? "White"
        : you === "b"
          ? snap?.blackName ?? "Black"
          : "Guest";
    await fetch(`/api/games/${code}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, from }),
    });
  };

  const sendBanter = async () => {
    const text = chat.trim();
    if (!text) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/games/${code}/banter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setChat("");
      if (data.banterLog) setBanterLog(data.banterLog);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-300">{error}</p>
        <Link href="/play" className="btn-ghost">
          Lobby
        </Link>
      </main>
    );
  }

  if (!snap) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Connecting remoteÔÇª
      </main>
    );
  }

  if (!seated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
          Phone remote
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Table {code}
        </h1>
        <p className="text-[var(--mist)]">
          No seat on this phone. Scan the Phone remote QR from your desktop table
          to claim a handoff, then return here.
        </p>
        <Link href={`/game/${code}`} className="btn-primary">
          Open table
        </Link>
      </main>
    );
  }

  const incomingDraw = drawOfferBy && drawOfferBy !== you;
  const myOffer = drawOfferBy === you;
  const statusLabel = gameOver
    ? snap.result ?? "Finished"
    : snap.status === "waiting"
      ? "Waiting for opponent"
      : `${turn === "w" ? "White" : "Black"} to move`;

  const banterLines = banterLog
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-12);

  return (
    <main className="relative mx-auto min-h-screen max-w-md space-y-4 px-4 py-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href={`/game/${code}`} className="text-sm text-[var(--mist)]">
          ÔåÉ Table
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] text-[var(--brass)]">
          Remote
        </span>
      </div>

      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
          Phone companion
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Table {code}
        </h1>
        <p className="text-sm text-[var(--mist)]">
          You play {you === "w" ? "White" : "Black"} ┬À Moves stay on desktop
        </p>
        <p className="text-[var(--cream)]">{statusLabel}</p>
      </header>

      <div className="panel relative space-y-3 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--mist)]">
              White
            </p>
            <p className="font-[family-name:var(--font-display)] text-lg">
              {snap.whiteName ?? "White"}
            </p>
          </div>
          <p
            className={`font-mono text-2xl tabular-nums ${
              turn === "w" && !gameOver ? "text-[var(--brass)]" : "text-[var(--cream)]"
            }`}
          >
            {formatClockOrUnlimited(whiteMs, unlimited)}
          </p>
        </div>
        <div className="border-t border-white/10" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--mist)]">
              Black
            </p>
            <p className="font-[family-name:var(--font-display)] text-lg">
              {snap.blackName ?? "Black"}
            </p>
          </div>
          <p
            className={`font-mono text-2xl tabular-nums ${
              turn === "b" && !gameOver ? "text-[var(--brass)]" : "text-[var(--cream)]"
            }`}
          >
            {formatClockOrUnlimited(blackMs, unlimited)}
          </p>
        </div>
        <div className="pointer-events-none absolute inset-0 flex flex-wrap items-end justify-center gap-2 p-3">
          {burst.map((b) => (
            <span key={b.id} className="animate-bounce text-3xl">
              {b.emoji}
            </span>
          ))}
        </div>
      </div>

      {!gameOver && snap.status === "active" && (
        <div className="panel space-y-3">
          <h2 className="panel-title">Table actions</h2>
          {incomingDraw && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() => void doAction("accept-draw")}
              >
                Accept draw
              </button>
              <button
                type="button"
                className="btn-ghost flex-1"
                disabled={busy}
                onClick={() => void doAction("decline-draw")}
              >
                Decline
              </button>
            </div>
          )}
          {!incomingDraw && (
            <button
              type="button"
              className="chip touch-target w-full"
              disabled={busy || Boolean(myOffer)}
              onClick={() => void doAction("offer-draw")}
            >
              {myOffer ? "Draw offeredÔÇª" : "Offer draw"}
            </button>
          )}
          {!confirmResign ? (
            <button
              type="button"
              className="chip touch-target w-full"
              disabled={busy}
              onClick={() => setConfirmResign(true)}
            >
              Resign
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() => void resign()}
              >
                Confirm resign
              </button>
              <button
                type="button"
                className="btn-ghost flex-1"
                disabled={busy}
                onClick={() => setConfirmResign(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="panel space-y-3">
        <h2 className="panel-title">Emotes</h2>
        <div className="flex flex-wrap gap-2">
          {REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              className="chip touch-target text-xl"
              onClick={() => void react(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="panel space-y-3">
        <h2 className="panel-title">Banter</h2>
        <div className="max-h-40 space-y-1 overflow-y-auto text-sm text-[var(--mist)]">
          {banterLines.length === 0 ? (
            <p>Quiet table ÔÇö say something short.</p>
          ) : (
            banterLines.map((line, i) => (
              <p key={`${i}-${line.slice(0, 12)}`} className="text-[var(--cream)]">
                {line}
              </p>
            ))
          )}
        </div>
        {!gameOver && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendBanter();
            }}
          >
            <input
              className="field flex-1"
              maxLength={80}
              placeholder="Short noteÔÇª"
              value={chat}
              onChange={(e) => setChat(e.target.value.slice(0, 80))}
              aria-label="Banter message"
            />
            <button type="submit" className="chip touch-target shrink-0" disabled={busy}>
              Send
            </button>
          </form>
        )}
      </div>

      {msg && <p className="text-center text-sm text-red-300">{msg}</p>}
      <p className="text-center text-[10px] text-[var(--mist)]">
        Closing this page does not end the game.
      </p>
    </main>
  );
}
