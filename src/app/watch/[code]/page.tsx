"use client";

import { InviteQrPanel } from "@/components/game/InviteQrPanel";
import { startVisibilityAwareInterval } from "@/lib/poll";
import { getPusherClient } from "@/lib/pusher/client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const WATCH_POLL_MS = 8_000;
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

export default function WatchPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const router = useRouter();
  const [snap, setSnap] = useState<Snap | null>(null);
  const [error, setError] = useState("");
  const [burst, setBurst] = useState<{ emoji: string; from: string; id: number }[]>([]);
  const [name, setName] = useState("Guest");

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
    };
    void load();
    const stopPoll = startVisibilityAwareInterval(() => void load(), WATCH_POLL_MS);

    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-game-${code}`);
      channel.bind("spectator.reaction", (data: { emoji: string; from: string }) => {
        const id = Date.now() + Math.random();
        setBurst((b) => [...b.slice(-8), { emoji: data.emoji, from: data.from, id }]);
        window.setTimeout(() => {
          setBurst((b) => b.filter((x) => x.id !== id));
        }, 2800);
      });
      channel.bind("move.made", () => void load());
      channel.bind("game.ended", () => void load());
      channel.bind("player.joined", () => void load());
    } catch {
      // poll only
    }

    return () => {
      cancelled = true;
      stopPoll();
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

      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Watch party</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Table {code}</h1>
      <p className="text-[var(--mist)]">
        {snap.whiteName ?? "White"} vs {snap.blackName ?? "Black"} · {snap.status}
        {snap.result ? ` · ${snap.result}` : ""}
      </p>

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
