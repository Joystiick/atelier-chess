"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { InviteQrPanel } from "@/components/game/InviteQrPanel";
import { startVisibilityAwareInterval } from "@/lib/poll";
import { getPusherClient } from "@/lib/pusher/client";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const WATCH_POLL_MS = 30_000;
const WATCH_POLL_FALLBACK_MS = 8_000;
const MOVE_FEED_LIMIT = 24;

const REACTIONS = ["👏", "😮", "🔥", "♟️", "☕", "😂"] as const;

type MoveSnap = {
  ply: number;
  san: string;
};

type Snap = {
  code: string;
  status: string;
  fen: string;
  whiteName: string | null;
  blackName: string | null;
  turn: string;
  result: string | null;
  moves?: MoveSnap[];
  tablecast?: boolean;
  spectatorCount?: number;
};

type MovePair = {
  num: number;
  white: string | null;
  black: string | null;
};

function sparseMovePairs(moves: MoveSnap[], limit = MOVE_FEED_LIMIT): MovePair[] {
  const slice = moves.slice(-limit);
  const pairs: MovePair[] = [];
  for (const m of slice) {
    const num = Math.ceil(m.ply / 2);
    const isWhite = m.ply % 2 === 1;
    const last = pairs[pairs.length - 1];
    if (!last || last.num !== num) {
      pairs.push({
        num,
        white: isWhite ? m.san : null,
        black: isWhite ? null : m.san,
      });
    } else if (isWhite) {
      last.white = m.san;
    } else {
      last.black = m.san;
    }
  }
  return pairs;
}

function piecesFromFen(fen: string): BoardPiece[] {
  try {
    const chess = new Chess(fen);
    return chess.board().flatMap((row) =>
      row
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({
          square: p.square,
          type: p.type,
          color: p.color,
        })),
    );
  } catch {
    return [];
  }
}

function lastMoveFromHistory(fen: string): { from: Square; to: Square } | null {
  try {
    // Prefer PGN history when available via moves feed on snap — fen alone has no path.
    void fen;
    return null;
  } catch {
    return null;
  }
}

function WatchPageInner() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const router = useRouter();
  const searchParams = useSearchParams();
  /** OBS overlay: `/watch/CODE?overlay=1` or `?broadcast=1` — clean dark chrome */
  const overlayMode =
    searchParams.get("overlay") === "1" ||
    searchParams.get("overlay") === "true" ||
    searchParams.get("broadcast") === "1" ||
    searchParams.get("broadcast") === "true";

  useEffect(() => {
    if (!overlayMode) return;
    document.documentElement.classList.add("watch-overlay");
    document.body.classList.add("watch-overlay");
    return () => {
      document.documentElement.classList.remove("watch-overlay");
      document.body.classList.remove("watch-overlay");
    };
  }, [overlayMode]);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [error, setError] = useState("");
  const [burst, setBurst] = useState<{ emoji: string; from: string; id: number }[]>([]);
  const [name, setName] = useState("Guest");
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [live, setLive] = useState(false);
  const [pusherOk, setPusherOk] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

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
      setSnap(data);
      if (typeof data.spectatorCount === "number") {
        setSpectatorCount(data.spectatorCount);
      }
      if (data.tablecast || data.status === "active") setLive(true);
    };
    void load();

    void fetch(`/api/games/${code}/tablecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "spectator_join" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.spectatorCount === "number") setSpectatorCount(d.spectatorCount);
      })
      .catch(() => {
        // optional
      });

    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    let stopPoll: (() => void) | null = null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-game-${code}`);
      setPusherOk(true);
      channel.bind("spectator.reaction", (data: { emoji: string; from: string }) => {
        const id = Date.now() + Math.random();
        setBurst((b) => [...b.slice(-8), { emoji: data.emoji, from: data.from, id }]);
        window.setTimeout(() => {
          setBurst((b) => b.filter((x) => x.id !== id));
        }, 2800);
      });
      channel.bind(
        "move.made",
        (data: { fen?: string; san?: string; from?: string; to?: string }) => {
          setLive(true);
          if (data.from && data.to) {
            setLastMove({ from: data.from as Square, to: data.to as Square });
          }
          void load();
        },
      );
      channel.bind("game.ended", () => void load());
      channel.bind("player.joined", () => void load());
      channel.bind("tablecast.opened", () => {
        setLive(true);
        void load();
      });
      channel.bind("tablecast.spectator_count", (data: { count?: number }) => {
        if (typeof data.count === "number") setSpectatorCount(data.count);
      });
      stopPoll = startVisibilityAwareInterval(() => void load(), WATCH_POLL_MS);
    } catch {
      setPusherOk(false);
      stopPoll = startVisibilityAwareInterval(() => void load(), WATCH_POLL_FALLBACK_MS);
    }

    return () => {
      cancelled = true;
      stopPoll?.();
      void fetch(`/api/games/${code}/tablecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "spectator_leave" }),
      }).catch(() => {
        // best-effort
      });
      if (channel) {
        channel.unbind_all();
        try {
          getPusherClient().unsubscribe(`private-game-${code}`);
        } catch {
          // ignore
        }
      }
    };
  }, [code]);

  const moves = snap?.moves ?? [];
  const pairs = sparseMovePairs(moves);
  const waitingForFirst =
    moves.length === 0 &&
    (snap?.status === "waiting" || snap?.status === "active");

  const pieces = useMemo(
    () => (snap?.fen ? piecesFromFen(snap.fen) : []),
    [snap?.fen],
  );

  const react = async (emoji: string) => {
    await fetch(`/api/games/${code}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, from: name }),
    });
  };

  if (error) {
    return (
      <main className="p-8 text-center">
        <p className="text-red-300">{error}</p>
        <Link href="/play">Lobby</Link>
      </main>
    );
  }

  if (!snap) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Joining watch party…
      </main>
    );
  }

  void lastMoveFromHistory;

  if (overlayMode) {
    return (
      <main className="watch-overlay-stage grid min-h-screen place-items-center p-3">
        <div className="w-full max-w-[min(96vw,720px)] space-y-3">
          <div className="flex items-end justify-between gap-3 px-1 text-[var(--cream)]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--brass)]">
                {snap.tablecast ? "Tablecast" : "Broadcast"}
              </p>
              <p className="font-[family-name:var(--font-display)] text-lg leading-tight">
                {snap.whiteName ?? "White"}
                <span className="mx-2 text-[var(--mist)]">vs</span>
                {snap.blackName ?? "Black"}
              </p>
            </div>
            <p className="font-mono text-sm text-[var(--mist)]">
              {snap.status === "finished"
                ? "Final"
                : snap.turn === "w"
                  ? "White to move"
                  : "Black to move"}
            </p>
          </div>
          <ChessBoard
            pieces={pieces}
            orientation="white"
            interactive={false}
            lastMove={lastMove}
            theme="midnight-brass"
            vignette={false}
          />
          {snap.status === "finished" && snap.result ? (
            <p className="text-center font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]">
              {snap.result}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-lg space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/play" className="text-sm text-[var(--mist)]">
          ← Lobby
        </Link>
        <button
          type="button"
          className="chip"
          onClick={() => router.push(`/game/${code}?spectate=1`)}
        >
          Full board
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
          {snap.tablecast ? "Tablecast gallery" : "Watch party"}
        </p>
        {live && snap.status !== "finished" && (
          <span className="chip pointer-events-none border-[var(--brass)] text-[var(--brass)]">
            Table live
          </span>
        )}
        <span className="chip pointer-events-none text-xs">
          {spectatorCount} watching
        </span>
        {!pusherOk && (
          <span className="text-[10px] text-[var(--mist)]">Polling backup</span>
        )}
      </div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Table {code}</h1>
      <p className="text-[var(--mist)]">
        {snap.whiteName ?? "White"} vs {snap.blackName ?? "Black"} · {snap.status}
        {snap.result ? ` · ${snap.result}` : ""}
      </p>

      <div className="mx-auto w-full max-w-[min(92vw,420px)]">
        <ChessBoard
          pieces={pieces}
          orientation="white"
          interactive={false}
          lastMove={lastMove}
          theme="salon-emerald"
          vignette
        />
      </div>

      <section className="panel relative overflow-hidden" aria-live="polite" aria-label="Move feed">
        <h2 className="panel-title">Commentary</h2>

        {snap.status === "finished" && snap.result ? (
          <p className="mb-3">
            <span className="chip pointer-events-none border-[var(--brass)] text-[var(--brass)]">
              {snap.result}
            </span>
          </p>
        ) : null}

        {waitingForFirst ? (
          <p className="py-6 text-center text-sm text-[var(--mist)]">Waiting for first move</p>
        ) : pairs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--mist)]">Waiting for first move</p>
        ) : (
          <ol className="flex flex-wrap gap-x-3 gap-y-2 font-mono text-sm text-[var(--cream)]">
            {pairs.map((p) => (
              <li key={p.num} className="inline-flex items-baseline gap-1.5">
                <span className="text-[var(--brass)]">{p.num}.</span>
                <span className="chip pointer-events-none px-2 py-0.5 text-sm">
                  {p.white ?? "…"}
                </span>
                {p.black ? (
                  <span className="chip pointer-events-none px-2 py-0.5 text-sm">{p.black}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {snap.status !== "finished" && moves.length > 0 ? (
          <p className="mt-4 text-sm text-[var(--mist)]">
            Turn: {snap.turn === "w" ? "White" : "Black"}
          </p>
        ) : null}

        <div className="pointer-events-none absolute inset-0 flex flex-wrap items-end justify-center gap-2 p-4">
          {burst.map((b) => (
            <span key={b.id} className="animate-bounce text-3xl" title={b.from}>
              {b.emoji}
            </span>
          ))}
        </div>
      </section>

      <label className="block text-left text-xs text-[var(--mist)]">
        Display name
        <input
          className="mt-1 w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-[var(--cream)]"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
        />
      </label>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Reactions">
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

      <InviteQrPanel code={code} status={snap.status as "waiting" | "active" | "finished"} />
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Joining watch party…
        </main>
      }
    >
      <WatchPageInner />
    </Suspense>
  );
}
