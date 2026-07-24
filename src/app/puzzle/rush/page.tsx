"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { shufflePuzzles, type BuiltInPuzzle } from "@/lib/chess/puzzles";
import { playSound } from "@/lib/chess/sound";
import { getPuzzleStreak, setPuzzleStreak } from "@/lib/names";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function piecesFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  return chess.board().flatMap((row) =>
    row
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ square: p.square, type: p.type, color: p.color })),
  );
}

export default function PuzzleRushPage() {
  const [queue, setQueue] = useState<BuiltInPuzzle[]>([]);
  const [idx, setIdx] = useState(0);
  const [fen, setFen] = useState("");
  const [selected, setSelected] = useState<Square | null>(null);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(90);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState("Solve as many as you can");

  useEffect(() => {
    const q = shufflePuzzles(8);
    setQueue(q);
    setFen(q[0]!.fen);
  }, []);

  useEffect(() => {
    if (over || !fen) return;
    if (seconds <= 0) {
      setOver(true);
      setMsg(`Time — score ${score}`);
      setPuzzleStreak(Math.max(getPuzzleStreak(), score));
      playSound("end");
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds, over, fen, score]);

  const puzzle = queue[idx];
  const position = useMemo(() => (fen ? new Chess(fen) : null), [fen]);
  const pieces = useMemo(() => (fen ? piecesFromFen(fen) : []), [fen]);
  const legalTargets = useMemo(() => {
    if (!selected || !position) return [] as Square[];
    return position.moves({ square: selected, verbose: true }).map((m) => m.to as Square);
  }, [selected, position]);

  const nextPuzzle = (fromScore: number) => {
    const nextIdx = idx + 1;
    if (nextIdx >= queue.length) {
      setOver(true);
      setMsg(`Cleared the set — score ${fromScore}`);
      setPuzzleStreak(Math.max(getPuzzleStreak(), fromScore));
      playSound("end");
      return;
    }
    setIdx(nextIdx);
    setFen(queue[nextIdx]!.fen);
    setStep(0);
    setSelected(null);
    setMsg(queue[nextIdx]!.title);
  };

  const tryUci = (uci: string) => {
    if (!puzzle || over) return;
    const expected = puzzle.solution[step];
    if (uci !== expected) {
      playSound("check");
      setMsg("Miss — next puzzle");
      nextPuzzle(score);
      return;
    }
    const live = new Chess(fen);
    live.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci[4] as "q" | undefined,
    });
    setFen(live.fen());
    const nextStep = step + 1;
    if (nextStep >= puzzle.solution.length) {
      playSound("capture");
      const ns = score + 1;
      setScore(ns);
      nextPuzzle(ns);
    } else {
      playSound("move");
      setStep(nextStep);
    }
    setSelected(null);
  };

  const onSquareClick = (square: Square) => {
    if (!position || over) return;
    const turn = position.turn();
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

  if (!fen) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-4 px-4 py-10">
      <Link href="/play" className="self-start text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Lobby
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Puzzle rush</h1>
      <p className="text-[var(--mist)]">
        {seconds}s · Score {score}
        {puzzle ? ` · ${puzzle.title}` : ""}
      </p>
      <ChessBoard
        pieces={pieces}
        selected={selected}
        legalTargets={legalTargets}
        interactive={!over}
        onSquareClick={onSquareClick}
      />
      <p className="text-[var(--cream)]">{msg}</p>
      {over && (
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Again
        </button>
      )}
    </main>
  );
}
