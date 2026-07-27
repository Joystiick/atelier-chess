"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function piecesFromFen(fen: string): BoardPiece[] {
  try {
    const chess = new Chess(fen);
    return chess.board().flatMap((row) =>
      row
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => ({ square: p.square, type: p.type, color: p.color })),
    );
  } catch {
    return [];
  }
}

export default function StudyDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");

  const [title, setTitle] = useState("");
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  );
  const [pgn, setPgn] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Square | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/studies/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Not found");
      return;
    }
    setTitle(data.study.title);
    setFen(data.study.fen);
    setPgn(data.study.pgn);
    setNotes(data.study.notes);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/study/${id}`);
    }
  }, [authLoading, user, router, id]);

  useEffect(() => {
    if (user && id) void load();
  }, [user, id, load]);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const pieces = useMemo(() => piecesFromFen(chess.fen()), [chess]);
  const legalTargets = useMemo(() => {
    if (!selected) return [] as Square[];
    return chess
      .moves({ square: selected, verbose: true })
      .map((m) => m.to as Square);
  }, [chess, selected]);

  const onSquareClick = (sq: Square) => {
    if (selected) {
      const move = chess.move({ from: selected, to: sq, promotion: "q" });
      if (move) {
        setFen(chess.fen());
        setPgn(chess.pgn());
        setSelected(null);
        return;
      }
    }
    const piece = chess.get(sq);
    if (piece && piece.color === chess.turn()) {
      setSelected(sq);
    } else {
      setSelected(null);
    }
  };

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/studies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, fen, pgn, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const resetBoard = () => {
    const c = new Chess();
    setFen(c.fen());
    setPgn("");
    setSelected(null);
  };

  if (authLoading || !user || !loaded) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        {msg || "Loading…"}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/study" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Studies
        </Link>
        <UserChip />
      </div>

      <input
        className="field mb-4 w-full font-[family-name:var(--font-display)] text-2xl"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="mx-auto max-w-md">
        <ChessBoard
          pieces={pieces}
          selected={selected}
          legalTargets={legalTargets}
          interactive
          onSquareClick={onSquareClick}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="chip" onClick={resetBoard}>
          Reset
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>

      <label className="mt-6 block text-sm text-[var(--mist)]">
        Notes
        <textarea
          className="field mt-1 w-full min-h-[6rem]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <label className="mt-4 block text-sm text-[var(--mist)]">
        PGN
        <textarea
          className="field mt-1 w-full min-h-[4rem] font-mono text-xs"
          value={pgn}
          onChange={(e) => {
            setPgn(e.target.value);
            try {
              const c = new Chess();
              c.loadPgn(e.target.value);
              setFen(c.fen());
            } catch {
              // keep typing
            }
          }}
        />
      </label>

      {msg && <p className="mt-3 text-sm text-[var(--brass)]">{msg}</p>}
    </main>
  );
}
