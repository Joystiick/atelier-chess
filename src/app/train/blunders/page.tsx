"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const REPLAY_KEY = "atelier.replayPgn";

type Tip = {
  ply: number;
  san: string;
  fen: string;
  note: string;
};

function isHanging(chess: Chess, square: Square, color: "w" | "b"): boolean {
  const piece = chess.get(square);
  if (!piece || piece.color !== color) return false;
  const attackers = chess.attackers(square, color === "w" ? "b" : "w");
  if (attackers.length === 0) return false;
  const defenders = chess.attackers(square, color);
  // Simple: attacked and fewer defenders than attackers, or undefended
  if (defenders.length === 0) return true;
  if (attackers.length > defenders.length) return true;
  // Also flag if a higher-value piece is taken by a lower one with equal trade-ish
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
  const myVal = values[piece.type] ?? 0;
  // If any attacker is cheaper or equal and we're not well defended
  for (const a of attackers) {
    const ap = chess.get(a);
    if (!ap) continue;
    const av = values[ap.type] ?? 0;
    if (av < myVal && defenders.length <= attackers.length) return true;
  }
  return false;
}

function scanBlunders(pgn: string, perspective: "w" | "b" = "w"): Tip[] {
  const tips: Tip[] = [];
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const moves = game.history({ verbose: true });
    const replay = new Chess();
    let ply = 0;
    for (const m of moves) {
      replay.move(m);
      ply += 1;
      if (m.color !== perspective) continue;
      // After our move, check if any of our pieces hang
      for (const row of replay.board()) {
        for (const p of row) {
          if (!p || p.color !== perspective) continue;
          if (p.type === "k") continue;
          if (isHanging(replay, p.square, perspective)) {
            tips.push({
              ply,
              san: m.san,
              fen: replay.fen(),
              note: `${p.type.toUpperCase()} on ${p.square} looks hanging after ${m.san}`,
            });
          }
        }
      }
    }
  } catch {
    return tips;
  }
  // Deduplicate by ply+note
  const seen = new Set<string>();
  return tips.filter((t) => {
    const k = `${t.ply}:${t.note}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function BlundersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pgn, setPgn] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [error, setError] = useState("");
  const [side, setSide] = useState<"w" | "b">("w");

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/train/blunders");
  }, [loading, user, router]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(REPLAY_KEY);
      if (stored) setPgn(stored);
    } catch {
      // ignore
    }
  }, []);

  const analyze = () => {
    setError("");
    if (!pgn.trim()) {
      setError("Paste a PGN or load a replay first");
      setTips([]);
      return;
    }
    try {
      const probe = new Chess();
      probe.loadPgn(pgn);
    } catch {
      setError("Could not parse PGN");
      setTips([]);
      return;
    }
    setTips(scanBlunders(pgn, side));
  };

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/train" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Train
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Blunder tips
      </h1>
      <p className="text-sm text-[var(--mist)]">
        Simple hanging-piece heuristic — not a full engine review.
      </p>

      <label className="text-sm text-[var(--mist)]">
        Your color
        <select
          className="field mt-1"
          value={side}
          onChange={(e) => setSide(e.target.value as "w" | "b")}
        >
          <option value="w">White</option>
          <option value="b">Black</option>
        </select>
      </label>

      <textarea
        className="field min-h-40 font-mono text-xs"
        placeholder="Paste PGN…"
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
      />

      <button type="button" className="btn-primary" onClick={analyze}>
        Scan for hangings
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}

      <ul className="space-y-2">
        {tips.length === 0 && !error && (
          <li className="text-sm text-[var(--mist)]">No tips yet.</li>
        )}
        {tips.map((t, i) => (
          <li key={`${t.ply}-${i}`} className="panel text-sm">
            <p className="text-[var(--brass)]">
              Ply {t.ply} · {t.san}
            </p>
            <p className="text-[var(--cream)]">{t.note}</p>
            <Link
              href={`/analyze?pgn=${encodeURIComponent(pgn)}`}
              className="mt-1 inline-block text-xs text-[var(--brass)]"
            >
              Open in analyze
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
