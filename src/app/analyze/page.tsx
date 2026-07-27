"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { detectOpening } from "@/lib/chess/openings";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const REPLAY_KEY = "atelier.replayPgn";

function piecesFromFen(fen: string): BoardPiece[] {
  const chess = new Chess(fen);
  return chess.board().flatMap((row) =>
    row
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ square: p.square, type: p.type, color: p.color })),
  );
}

function decodeMaybe(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Load a game from PGN, move list, or FEN into a list of positions. */
function buildReplay(rawInput: string): { fens: string[]; sans: string[] } {
  const start = new Chess().fen();
  if (!rawInput.trim()) return { fens: [start], sans: [] };

  const raw = decodeMaybe(rawInput).trim();

  // FEN only
  if (raw.includes("/") && !/\d+\./.test(raw) && raw.split(/\s+/).length >= 4) {
    try {
      const c = new Chess(raw);
      return { fens: [c.fen()], sans: [] };
    } catch {
      // fall through
    }
  }

  try {
    const chess = new Chess();
    chess.loadPgn(raw);
    const verbose = chess.history({ verbose: true });
    const sans = chess.history();
    const replay = new Chess();
    const fens = [replay.fen()];
    for (const m of verbose) {
      replay.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      });
      fens.push(replay.fen());
    }
    if (fens.length > 1) return { fens, sans };
  } catch {
    // fall through
  }

  // Bare SAN tokens
  try {
    const tokens = raw
      .replace(/\d+\.(\.\.)?/g, " ")
      .replace(/[{}][^}]*/g, " ")
      .split(/\s+/)
      .filter((t) => t && !["*", "1-0", "0-1", "1/2-1/2"].includes(t));
    const replay = new Chess();
    const fens = [replay.fen()];
    const sans: string[] = [];
    for (const san of tokens) {
      const moved = replay.move(san);
      if (!moved) break;
      sans.push(moved.san);
      fens.push(replay.fen());
    }
    if (sans.length > 0) return { fens, sans };
  } catch {
    // ignore
  }

  return { fens: [start], sans: [] };
}

function AnalyzeInner() {
  const search = useSearchParams();
  const [raw, setRaw] = useState("");

  useEffect(() => {
    const fromQuery = search.get("pgn") ?? "";
    let fromStore = "";
    try {
      fromStore = sessionStorage.getItem(REPLAY_KEY) ?? "";
    } catch {
      fromStore = "";
    }
    setRaw(fromStore || fromQuery);
  }, [search]);

  const { fens, sans } = useMemo(() => buildReplay(raw), [raw]);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    setPly(Math.max(0, fens.length - 1));
  }, [fens]);

  const fen = fens[Math.min(ply, fens.length - 1)] ?? fens[0]!;
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const opening = detectOpening(sans.slice(0, ply));

  const lastMove = useMemo(() => {
    if (ply <= 0) return null;
    try {
      const prev = fens[ply - 1]!;
      const c = new Chess(prev);
      const san = sans[ply - 1];
      if (!san) return null;
      const m = c.move(san);
      if (!m) return null;
      return { from: m.from as Square, to: m.to as Square };
    } catch {
      return null;
    }
  }, [ply, fens, sans]);

  if (!raw) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-4 px-4 py-10">
        <Link href="/play" className="self-start text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Analyze</h1>
        <p className="text-[var(--mist)]">
          No game loaded. Finish a game and tap Analyze, or paste a PGN below.
        </p>
        <textarea
          className="field min-h-32 w-full font-mono text-xs"
          placeholder="Paste PGN here…"
          onChange={(e) => {
            const v = e.target.value;
            setRaw(v);
            try {
              sessionStorage.setItem(REPLAY_KEY, v);
            } catch {
              // ignore
            }
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center gap-4 px-4 py-10">
      <Link href="/play" className="self-start text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Lobby
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Replay</h1>
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
          {ply}/{Math.max(0, fens.length - 1)}
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
              {Math.floor(i / 2) + 1}
              {i % 2 === 0 ? "." : "..."} {s}
            </button>
          </li>
        ))}
      </ol>
      {sans.length === 0 && (
        <p className="text-sm text-red-300">Could not parse this game for replay.</p>
      )}
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
