"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { puzzleOfTheDay } from "@/lib/chess/puzzles";
import { playSound } from "@/lib/chess/sound";
import { getPuzzleStreak, setPuzzleStreak } from "@/lib/names";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useMemo, useState } from "react";

function piecesFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  return chess.board().flatMap((row) =>
    row
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ square: p.square, type: p.type, color: p.color })),
  );
}

export default function DailyPuzzlePage() {
  const puzzle = useMemo(() => puzzleOfTheDay(), []);
  const [fen, setFen] = useState(puzzle.fen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("Find the best move");
  const [done, setDone] = useState(false);

  const position = useMemo(() => new Chess(fen), [fen]);
  const turn = position.turn();
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const legalTargets = useMemo(() => {
    if (!selected) return [] as Square[];
    return position.moves({ square: selected, verbose: true }).map((m) => m.to as Square);
  }, [selected, position]);

  const tryUci = (uci: string) => {
    const expected = puzzle.solution[step];
    if (!expected) return;
    if (uci !== expected) {
      playSound("check");
      setMsg("Not it — try again");
      setSelected(null);
      setPuzzleStreak(0);
      return;
    }
    const live = new Chess(fen);
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci[4] as "q" | undefined;
    live.move({ from, to, promotion });
    setFen(live.fen());
    const next = step + 1;
    if (next >= puzzle.solution.length) {
      playSound("end");
      setDone(true);
      setMsg("Solved!");
      setPuzzleStreak(getPuzzleStreak() + 1);
    } else {
      playSound("move");
      setStep(next);
      setMsg("Good — continue");
    }
    setSelected(null);
  };

  const onSquareClick = (square: Square) => {
    if (done) return;
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

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-4 px-4 py-10">
      <Link href="/play" className="self-start text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Lobby
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Daily puzzle</h1>
      <p className="text-[var(--mist)]">
        {puzzle.title} · ~{puzzle.rating}
      </p>
      <ChessBoard
        pieces={pieces}
        selected={selected}
        legalTargets={legalTargets}
        interactive={!done}
        onSquareClick={onSquareClick}
      />
      <p className="text-[var(--cream)]">{msg}</p>
      <p className="text-xs text-[var(--mist)]">Streak {getPuzzleStreak()}</p>
      <Link href="/puzzle/rush" className="text-sm text-[var(--brass)]">
        Puzzle rush →
      </Link>
    </main>
  );
}
