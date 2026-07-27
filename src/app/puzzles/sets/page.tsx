"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { BUILTIN_PUZZLES } from "@/lib/chess/puzzles";
import { playSound } from "@/lib/chess/sound";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type PuzzleSet = {
  id: string;
  title: string;
  puzzleIds: string[];
  createdAt: string;
};

function piecesFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  return chess.board().flatMap((row) =>
    row
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ square: p.square, type: p.type, color: p.color })),
  );
}

export default function PuzzleSetsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sets, setSets] = useState<PuzzleSet[]>([]);
  const [title, setTitle] = useState("My set");
  const [selectedIds, setSelectedIds] = useState<string[]>([
    BUILTIN_PUZZLES[0]!.id,
    BUILTIN_PUZZLES[1]!.id,
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playIds, setPlayIds] = useState<string[] | null>(null);
  const [playIndex, setPlayIndex] = useState(0);
  const [fen, setFen] = useState("");
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/puzzle-sets");
    const data = await res.json();
    if (res.ok) setSets(data.sets ?? []);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/puzzles/sets");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const currentPuzzle = useMemo(() => {
    if (!playIds) return null;
    const id = playIds[playIndex];
    return BUILTIN_PUZZLES.find((p) => p.id === id) ?? null;
  }, [playIds, playIndex]);

  useEffect(() => {
    if (!currentPuzzle) return;
    setFen(currentPuzzle.fen);
    setStep(0);
    setSelected(null);
    setDone(false);
    setMsg(currentPuzzle.title);
  }, [currentPuzzle]);

  const position = useMemo(
    () => (fen ? new Chess(fen) : new Chess()),
    [fen],
  );
  const pieces = useMemo(() => (fen ? piecesFromFen(fen) : []), [fen]);
  const turn = position.turn();
  const legalTargets = useMemo(() => {
    if (!selected) return [] as Square[];
    return position.moves({ square: selected, verbose: true }).map((m) => m.to as Square);
  }, [selected, position]);

  const createSet = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/puzzle-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, puzzleIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create set");
    } finally {
      setBusy(false);
    }
  };

  const startPlay = (ids: string[]) => {
    const filtered = ids.filter((id) => BUILTIN_PUZZLES.some((p) => p.id === id));
    if (filtered.length === 0) {
      setError("No builtin puzzles in that set");
      return;
    }
    setPlayIds(filtered);
    setPlayIndex(0);
    playSound("start");
  };

  const tryUci = (uci: string) => {
    if (!currentPuzzle || done) return;
    const expected = currentPuzzle.solution[step];
    if (!expected) return;
    if (uci !== expected && !uci.startsWith(expected.slice(0, 4))) {
      playSound("check");
      setMsg("Not it — try again");
      setSelected(null);
      return;
    }
    const live = new Chess(fen);
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci[4] as "q" | undefined;
    live.move({ from, to, promotion });
    setFen(live.fen());
    const next = step + 1;
    if (next >= currentPuzzle.solution.length) {
      playSound("end");
      setDone(true);
      setMsg("Solved!");
      if (playIds && playIndex < playIds.length - 1) {
        window.setTimeout(() => {
          setPlayIndex((i) => i + 1);
        }, 600);
      }
    } else {
      playSound("move");
      setStep(next);
      setMsg("Good — continue");
    }
    setSelected(null);
  };

  const onSquareClick = (square: Square) => {
    if (!currentPuzzle || done) return;
    const piece = position.get(square);
    if (selected) {
      if (legalTargets.includes(square)) {
        tryUci(`${selected}${square}`);
        return;
      }
      if (piece && piece.color === turn) {
        setSelected(square);
        return;
      }
      setSelected(null);
      return;
    }
    if (piece && piece.color === turn) setSelected(square);
  };

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  if (playIds && currentPuzzle) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-4 px-4 py-10">
        <button
          type="button"
          className="self-start text-sm text-[var(--mist)]"
          onClick={() => setPlayIds(null)}
        >
          ← Sets
        </button>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          {currentPuzzle.title}
        </h1>
        <p className="text-sm text-[var(--mist)]">
          {playIndex + 1} / {playIds.length}
        </p>
        <ChessBoard
          pieces={pieces}
          selected={selected}
          legalTargets={legalTargets}
          interactive={!done}
          onSquareClick={onSquareClick}
        />
        <p className="text-[var(--cream)]">{msg}</p>
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
        Puzzle sets
      </h1>

      <section className="panel space-y-3">
        <h2 className="panel-title">Create set</h2>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <div className="flex flex-wrap gap-2">
          {BUILTIN_PUZZLES.map((p) => {
            const on = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`chip touch-target ${on ? "ring-1 ring-[var(--brass)]" : ""}`}
                onClick={() =>
                  setSelectedIds((ids) =>
                    on ? ids.filter((x) => x !== p.id) : [...ids, p.id],
                  )
                }
              >
                {p.title}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || selectedIds.length === 0}
          onClick={() => void createSet()}
        >
          {busy ? "Saving…" : "Save set"}
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="panel-title">Your sets</h2>
        {sets.length === 0 && (
          <p className="text-sm text-[var(--mist)]">No sets yet.</p>
        )}
        {sets.map((s) => (
          <div key={s.id} className="mode-card">
            <h3>{s.title}</h3>
            <p>{s.puzzleIds.length} puzzles</p>
            <button
              type="button"
              className="chip touch-target mt-2"
              onClick={() => startPlay(s.puzzleIds)}
            >
              Play
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="panel-title">Builtin quick play</h2>
        <button
          type="button"
          className="mode-card w-full text-left"
          onClick={() => startPlay(BUILTIN_PUZZLES.map((p) => p.id))}
        >
          <h3>All builtins</h3>
          <p>{BUILTIN_PUZZLES.length} mates and tactics</p>
        </button>
      </section>
    </main>
  );
}
