"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { OPENINGS } from "@/lib/chess/openings";
import { playSound } from "@/lib/chess/sound";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function piecesFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  return chess.board().flatMap((row) =>
    row
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ square: p.square, type: p.type, color: p.color })),
  );
}

export default function OpeningTrainerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pick, setPick] = useState<number | null>(null);
  const [fen, setFen] = useState(() => new Chess().fen());
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [msg, setMsg] = useState("Pick an opening to practice");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/train/openings");
  }, [loading, user, router]);

  const opening = pick != null ? OPENINGS[pick]! : null;
  const position = useMemo(() => new Chess(fen), [fen]);
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const turn = position.turn();
  const legalTargets = useMemo(() => {
    if (!selected) return [] as Square[];
    return position.moves({ square: selected, verbose: true }).map((m) => m.to as Square);
  }, [selected, position]);

  const start = (index: number) => {
    setPick(index);
    setFen(new Chess().fen());
    setStep(0);
    setSelected(null);
    setDone(false);
    setMsg(`Play ${OPENINGS[index]!.moves[0]}`);
    playSound("start");
  };

  const onSquareClick = (square: Square) => {
    if (!opening || done) return;
    const expected = opening.moves[step];
    if (!expected) return;

    const piece = position.get(square);
    if (selected) {
      if (legalTargets.includes(square)) {
        const live = new Chess(fen);
        let move;
        try {
          move = live.move({ from: selected, to: square });
        } catch {
          move = null;
        }
        if (!move || move.san !== expected) {
          playSound("check");
          setMsg(`Not ${expected} — try again`);
          setSelected(null);
          return;
        }
        playSound("move");
        setFen(live.fen());
        const next = step + 1;
        if (next >= opening.moves.length) {
          setDone(true);
          setMsg(`Line complete — ${opening.name}`);
          playSound("end");
        } else {
          // Auto-play opponent reply if next move is theirs and we just played ours
          // Opening list is full SAN sequence; user plays every ply
          setStep(next);
          setMsg(`Play ${opening.moves[next]}`);
        }
        setSelected(null);
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

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/train" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Train
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Opening trainer
      </h1>

      {pick == null ? (
        <ul className="space-y-2">
          {OPENINGS.map((o, i) =>
            o.moves.length < 2 ? null : (
              <li key={`${o.name}-${i}`}>
                <button
                  type="button"
                  className="mode-card w-full text-left"
                  onClick={() => start(i)}
                >
                  <h3>{o.name}</h3>
                  <p>{o.moves.join(" ")}</p>
                </button>
              </li>
            ),
          )}
        </ul>
      ) : (
        <>
          <p className="text-[var(--mist)]">
            {opening!.name} · step {Math.min(step + 1, opening!.moves.length)}/
            {opening!.moves.length}
          </p>
          <ChessBoard
            pieces={pieces}
            selected={selected}
            legalTargets={legalTargets}
            interactive={!done}
            onSquareClick={onSquareClick}
          />
          <p className="text-center text-[var(--cream)]">{msg}</p>
          <button type="button" className="btn-ghost" onClick={() => setPick(null)}>
            Pick another
          </button>
        </>
      )}
    </main>
  );
}
