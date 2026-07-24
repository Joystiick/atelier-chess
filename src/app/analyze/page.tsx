"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { detectOpening } from "@/lib/chess/openings";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

function piecesFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  return chess.board().flatMap((row) =>
    row
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ square: p.square, type: p.type, color: p.color })),
  );
}

function AnalyzeInner() {
  const search = useSearchParams();
  const raw = search.get("pgn") ?? "";

  const fens = useMemo(() => {
    const chess = new Chess();
    const list = [chess.fen()];
    if (raw) {
      try {
        if (raw.includes("/")) {
          chess.load(decodeURIComponent(raw));
          return [chess.fen()];
        }
        chess.loadPgn(decodeURIComponent(raw));
        const verbose = chess.history({ verbose: true });
        const replay = new Chess();
        const out = [replay.fen()];
        for (const m of verbose) {
          replay.move(m);
          out.push(replay.fen());
        }
        return out;
      } catch {
        return list;
      }
    }
    return list;
  }, [raw]);

  const sans = useMemo(() => {
    try {
      const c = new Chess();
      if (raw && !raw.includes("/")) c.loadPgn(decodeURIComponent(raw));
      return c.history();
    } catch {
      return [] as string[];
    }
  }, [raw]);

  const [ply, setPly] = useState(() => Math.max(0, fens.length - 1));
  const fen = fens[Math.min(ply, fens.length - 1)] ?? fens[0]!;
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const opening = detectOpening(sans.slice(0, ply));

  const lastMove = useMemo(() => {
    if (ply <= 0) return null;
    try {
      const c = new Chess(fens[ply - 1]);
      const moves = c.moves({ verbose: true });
      // find move that leads to fen
      for (const m of moves) {
        const t = new Chess(fens[ply - 1]);
        t.move(m);
        if (t.fen() === fen) {
          return { from: m.from as Square, to: m.to as Square };
        }
      }
    } catch {
      return null;
    }
    return null;
  }, [ply, fens, fen]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-4 px-4 py-10">
      <Link href="/play" className="self-start text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Lobby
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Analyze</h1>
      {opening && <p className="text-[var(--brass)]">{opening}</p>}
      <ChessBoard pieces={pieces} lastMove={lastMove} interactive={false} showArrow />
      <div className="flex gap-2">
        <button
          type="button"
          className="chip"
          disabled={ply <= 0}
          onClick={() => setPly((p) => Math.max(0, p - 1))}
        >
          ←
        </button>
        <span className="chip">
          {ply}/{fens.length - 1}
        </span>
        <button
          type="button"
          className="chip"
          disabled={ply >= fens.length - 1}
          onClick={() => setPly((p) => Math.min(fens.length - 1, p + 1))}
        >
          →
        </button>
      </div>
      <ol className="max-h-40 w-full overflow-y-auto text-sm text-[var(--mist)]">
        {sans.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              className={i + 1 === ply ? "text-[var(--cream)]" : ""}
              onClick={() => setPly(i + 1)}
            >
              {Math.floor(i / 2) + 1}{i % 2 === 0 ? "." : "..."} {s}
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-[var(--mist)]">
        Local replay — no engine eval in this build.
      </p>
    </main>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Loading…
        </main>
      }
    >
      <AnalyzeInner />
    </Suspense>
  );
}
