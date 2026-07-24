"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { ChessPiece } from "@/components/board/ChessPiece";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import { WaitingRoom } from "@/components/game/WaitingRoom";
import { useAmbient } from "@/lib/chess/ambient";
import { AI_ELO, rivalLine } from "@/lib/chess/banter";
import { formatClock, useClocks } from "@/lib/chess/clocks";
import {
  AI_RIVALS,
  askEngineMove,
  uciToMove,
  type AiLevel,
} from "@/lib/chess/engine";
import { detectOpening } from "@/lib/chess/openings";
import { playSound } from "@/lib/chess/sound";
import {
  BOARD_THEMES,
  bumpGamesPlayed,
  getAmbient,
  getBoardTheme,
  getElo,
  getSoundEnabled,
  isThemeUnlocked,
  setAmbient,
  setBoardTheme,
  setLastOpponent,
  setSoundEnabled,
  updateElo,
  type AmbientMode,
  type BoardTheme,
} from "@/lib/names";
import { Chess, type Square } from "chess.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const AI_CLOCK_MS = 600_000;
const FILES = "abcdefgh";

type GameShellProps =
  | {
      mode: "ai";
      level: AiLevel;
      playerColor?: "w" | "b";
      playerName: string;
    }
  | {
      mode: "human";
      code: string;
      playerColor: "w" | "b";
      playerName: string;
      opponentName: string | null;
      initialFen?: string;
      status: "waiting" | "active" | "finished" | "abandoned";
      spectator?: boolean;
      drawOfferBy?: string | null;
      takebackOfferBy?: string | null;
      onLocalMove?: (uci: string, san: string, fen: string) => Promise<{
        whiteClockMs?: number;
        blackClockMs?: number;
      } | void>;
      remoteFen?: string | null;
      remoteResult?: string | null;
      whiteClockMs?: number;
      blackClockMs?: number;
      onRematch?: () => void;
      onResign?: () => void;
      onAction?: (
        action:
          | "offer-draw"
          | "accept-draw"
          | "decline-draw"
          | "offer-takeback"
          | "accept-takeback"
          | "decline-takeback"
          | "abort",
      ) => Promise<void>;
    };

function piecesFromFen(fen: string): BoardPiece[] {
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
}

function kingSquare(fen: string, color: "w" | "b"): Square | null {
  const chess = new Chess(fen);
  for (const row of chess.board()) {
    for (const p of row) {
      if (p?.type === "k" && p.color === color) return p.square;
    }
  }
  return null;
}

function shiftSquare(sq: Square, df: number, dr: number): Square | null {
  const f = FILES.indexOf(sq[0]!);
  const r = Number(sq[1]);
  const nf = f + df;
  const nr = r + dr;
  if (nf < 0 || nf > 7 || nr < 1 || nr > 8) return null;
  return `${FILES[nf]}${nr}` as Square;
}

export function GameShell(props: GameShellProps) {
  const router = useRouter();
  const initialFen =
    props.mode === "human" && props.initialFen
      ? props.initialFen
      : new Chess().fen();

  const [fen, setFen] = useState(initialFen);
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [thinking, setThinking] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [banter, setBanter] = useState("");
  const [theme, setTheme] = useState<BoardTheme>("salon-emerald");
  const [soundOn, setSoundOn] = useState(true);
  const [ambient, setAmbientMode] = useState<AmbientMode>("off");
  const [vignette, setVignette] = useState(true);
  const [showArrow, setShowArrow] = useState(true);
  const [eloNote, setEloNote] = useState("");
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [showOver, setShowOver] = useState(false);
  const [overTitle, setOverTitle] = useState("");
  const engineAbort = useRef<AbortController | null>(null);
  const started = useRef(false);
  const scored = useRef(false);
  const fenRef = useRef(fen);

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    setTheme(getBoardTheme());
    setSoundOn(getSoundEnabled());
    setAmbientMode(getAmbient());
  }, []);

  useAmbient(ambient);

  const playerColor =
    props.mode === "ai" ? (props.playerColor ?? "w") : props.playerColor;
  const spectator = props.mode === "human" && Boolean(props.spectator);
  const remoteFen = props.mode === "human" ? props.remoteFen : null;
  const remoteResult = props.mode === "human" ? props.remoteResult : null;
  const humanStatus = props.mode === "human" ? props.status : null;
  const aiLevel = props.mode === "ai" ? props.level : null;
  const drawOfferBy = props.mode === "human" ? props.drawOfferBy : null;
  const takebackOfferBy = props.mode === "human" ? props.takebackOfferBy : null;

  const [baseWhiteMs, setBaseWhiteMs] = useState(
    props.mode === "human" ? (props.whiteClockMs ?? AI_CLOCK_MS) : AI_CLOCK_MS,
  );
  const [baseBlackMs, setBaseBlackMs] = useState(
    props.mode === "human" ? (props.blackClockMs ?? AI_CLOCK_MS) : AI_CLOCK_MS,
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    playSound("start");
  }, []);

  useEffect(() => {
    if (!remoteFen || remoteFen === fenRef.current) return;
    startTransition(() => {
      setFen(remoteFen);
      setSelected(null);
      setPromo(null);
      try {
        const c = new Chess(remoteFen);
        const h = c.history({ verbose: true });
        const last = h[h.length - 1];
        if (last) setLastMove({ from: last.from as Square, to: last.to as Square });
      } catch {
        // ignore
      }
    });
  }, [remoteFen]);

  const humanWhiteClock = props.mode === "human" ? props.whiteClockMs : undefined;
  const humanBlackClock = props.mode === "human" ? props.blackClockMs : undefined;

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (humanWhiteClock != null) setBaseWhiteMs(humanWhiteClock);
      if (humanBlackClock != null) setBaseBlackMs(humanBlackClock);
    }, 0);
    return () => window.clearTimeout(t);
  }, [humanWhiteClock, humanBlackClock]);

  const recordEnd = useCallback(
    (title: string, result: "win" | "loss" | "draw") => {
      if (scored.current) return;
      scored.current = true;
      bumpGamesPlayed();
      const opp =
        props.mode === "ai"
          ? AI_ELO[props.level]
          : 1200;
      const next = updateElo(result, opp);
      setEloNote(`Local Elo → ${next}`);
      if (props.mode === "human" && props.opponentName) {
        setLastOpponent(props.opponentName);
      }
      setOverTitle(title);
      setStatusText(title);
      setShowOver(true);
      playSound("end");
      if (aiLevel) {
        const line = rivalLine(aiLevel, "end");
        if (line) setBanter(line);
      }
    },
    [props, aiLevel],
  );

  const endGame = useCallback(
    (title: string) => {
      let result: "win" | "loss" | "draw" = "draw";
      const lower = title.toLowerCase();
      if (lower.includes("draw") || lower.includes("stalemate")) result = "draw";
      else if (lower.includes("white wins")) {
        result = playerColor === "w" ? "win" : "loss";
      } else if (lower.includes("black wins")) {
        result = playerColor === "b" ? "win" : "loss";
      }
      recordEnd(title, result);
    },
    [playerColor, recordEnd],
  );

  useEffect(() => {
    if (!remoteResult) return;
    startTransition(() => {
      setStatusText(remoteResult);
      setOverTitle(remoteResult);
      setShowOver(true);
    });
    if (!scored.current) {
      const lower = remoteResult.toLowerCase();
      let result: "win" | "loss" | "draw" = "draw";
      if (lower.includes("draw") || lower.includes("abort") || lower.includes("stalemate")) {
        result = "draw";
      } else if (lower.includes("white wins")) {
        result = playerColor === "w" ? "win" : "loss";
      } else if (lower.includes("black wins")) {
        result = playerColor === "b" ? "win" : "loss";
      }
      recordEnd(remoteResult, result);
    } else {
      playSound("end");
    }
  }, [remoteResult, playerColor, recordEnd]);

  const position = useMemo(() => new Chess(fen), [fen]);
  const turn = position.turn();
  const gameOver = position.isGameOver() || showOver;
  const inCheck = position.inCheck();
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const pgn = useMemo(() => {
    try {
      return position.pgn();
    } catch {
      return "";
    }
  }, [position]);

  const baseOrientation = spectator
    ? "white"
    : playerColor === "w"
      ? "white"
      : "black";
  const orientation = flipped
    ? baseOrientation === "white"
      ? "black"
      : "white"
    : baseOrientation;

  const legalTargets = useMemo(() => {
    if (!selected || spectator) return [] as Square[];
    return position
      .moves({ square: selected, verbose: true })
      .map((m) => m.to as Square);
  }, [selected, position, spectator]);

  const inCheckSquare = inCheck ? kingSquare(fen, turn) : null;
  const history = useMemo(() => position.history({ verbose: true }), [position]);
  const opening = useMemo(
    () => detectOpening(history.map((m) => m.san)),
    [history],
  );

  const captured = useMemo(() => {
    const white: { color: "w" | "b"; type: BoardPiece["type"] }[] = [];
    const black: { color: "w" | "b"; type: BoardPiece["type"] }[] = [];
    for (const m of history) {
      if (!m.captured) continue;
      const entry = {
        color: (m.color === "w" ? "b" : "w") as "w" | "b",
        type: m.captured as BoardPiece["type"],
      };
      if (m.color === "w") white.push(entry);
      else black.push(entry);
    }
    return { white, black };
  }, [history]);

  const onFlag = useCallback(
    (color: "w" | "b") => {
      const winner = color === "w" ? "Black" : "White";
      endGame(`Flag — ${winner} wins on time`);
      if (props.mode === "human" && props.onResign) {
        void props.onResign();
      }
    },
    [endGame, props],
  );

  const clocksEnabled =
    !spectator &&
    ((props.mode === "ai" && !gameOver) ||
      (props.mode === "human" && humanStatus === "active" && !gameOver));

  const { whiteMs, blackMs } = useClocks({
    enabled: clocksEnabled,
    turn,
    gameOver,
    whiteMs: baseWhiteMs,
    blackMs: baseBlackMs,
    onFlag,
  });

  const applyEndStatus = useCallback(
    (chess: Chess) => {
      if (chess.isCheckmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        endGame(`Checkmate — ${winner} wins`);
        return true;
      }
      if (chess.isDraw()) {
        endGame(
          chess.isStalemate()
            ? "Stalemate"
            : chess.isThreefoldRepetition()
              ? "Draw by repetition"
              : chess.isInsufficientMaterial()
                ? "Draw — insufficient material"
                : "Draw",
        );
        return true;
      }
      return false;
    },
    [endGame],
  );

  const afterMoveFx = useCallback(
    (
      chess: Chess,
      move: { flags: string; captured?: string; promotion?: string },
      fromAi?: boolean,
    ) => {
      if (move.promotion) playSound("promote");
      else if (move.flags.includes("k") || move.flags.includes("q"))
        playSound("castle");
      else if (move.captured) playSound("capture");
      else playSound("move");
      if (chess.inCheck()) playSound("check");

      if (fromAi && aiLevel) {
        const kind = chess.inCheck()
          ? "check"
          : move.captured
            ? "capture"
            : "quiet";
        const line = rivalLine(aiLevel, kind);
        if (line) setBanter(line);
      }
    },
    [aiLevel],
  );

  const runAi = useCallback(async () => {
    if (!aiLevel) return;
    const live = new Chess(fenRef.current);
    if (live.isGameOver() || live.turn() === playerColor || showOver) return;

    setThinking(true);
    setStatusText(`${AI_RIVALS[aiLevel].name} is thinking…`);
    engineAbort.current?.abort();
    const ac = new AbortController();
    engineAbort.current = ac;

    try {
      const { uci } = await askEngineMove(
        live.fen(),
        AI_RIVALS[aiLevel].searchMs,
        ac.signal,
      );
      const parts = uciToMove(uci);
      let move;
      try {
        move = live.move(parts);
      } catch {
        move = null;
      }
      if (move) {
        setFen(live.fen());
        setLastMove({ from: move.from as Square, to: move.to as Square });
        afterMoveFx(live, move, true);
        applyEndStatus(live);
      }
    } catch {
      setStatusText("Engine paused — your move when ready.");
    } finally {
      setThinking(false);
      setStatusText((s) => (s.includes("thinking") ? "" : s));
    }
  }, [aiLevel, playerColor, afterMoveFx, applyEndStatus, showOver]);

  useEffect(() => {
    if (!aiLevel || showOver) return;
    const live = new Chess(fen);
    if (live.turn() === playerColor || live.isGameOver()) return;
    const t = window.setTimeout(() => void runAi(), 50);
    return () => window.clearTimeout(t);
  }, [fen, aiLevel, playerColor, runAi, showOver]);

  const canPlay =
    !spectator &&
    !thinking &&
    !gameOver &&
    humanStatus !== "waiting" &&
    turn === playerColor;

  const tryMove = async (
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) => {
    if (!canPlay) return;

    const live = new Chess(fen);
    const legal = live.moves({ square: from, verbose: true });
    const match = legal.find(
      (m) => m.to === to && (!promotion || m.promotion === promotion),
    );
    if (!match) {
      setSelected(null);
      return;
    }
    if (match.promotion && !promotion) {
      setPromo({ from, to });
      return;
    }

    let move;
    try {
      move = live.move({ from, to, promotion: promotion ?? match.promotion });
    } catch {
      setSelected(null);
      return;
    }
    if (!move) {
      setSelected(null);
      return;
    }

    setSelected(null);
    setPromo(null);
    setLastMove({ from, to });
    setFen(live.fen());
    afterMoveFx(live, move);
    const ended = applyEndStatus(live);

    if (props.mode === "human" && props.onLocalMove) {
      const uci = `${from}${to}${promotion ?? match.promotion ?? ""}`;
      try {
        const clocks = await props.onLocalMove(uci, move.san, live.fen());
        if (clocks?.whiteClockMs != null) setBaseWhiteMs(clocks.whiteClockMs);
        if (clocks?.blackClockMs != null) setBaseBlackMs(clocks.blackClockMs);
      } catch {
        setFen(fen);
        setStatusText("Move rejected — try again.");
        return;
      }
    }

    void ended;
  };

  const onSquareClick = (square: Square) => {
    if (promo || !canPlay) return;

    const piece = position.get(square);
    if (selected) {
      if (selected === square) {
        setSelected(null);
        return;
      }
      if (piece && piece.color === playerColor) {
        setSelected(square);
        return;
      }
      if (!legalTargets.includes(square)) {
        setSelected(null);
        return;
      }
      void tryMove(selected, square);
      return;
    }
    if (piece && piece.color === playerColor) setSelected(square);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (promo || !canPlay) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (e.key === "Escape") {
        setSelected(null);
        return;
      }

      const dir =
        orientation === "white"
          ? { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
          : { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [1, 0], ArrowRight: [-1, 0] };

      if (e.key in dir) {
        e.preventDefault();
        const [df, dr] = dir[e.key as keyof typeof dir]!;
        const from = selected ?? (playerColor === "w" ? ("e2" as Square) : ("e7" as Square));
        const next = shiftSquare(from, df, dr);
        if (next) setSelected(next);
        return;
      }

      if ((e.key === "Enter" || e.key === " ") && selected) {
        e.preventDefault();
        const piece = position.get(selected);
        if (piece && piece.color === playerColor) {
          // selection only — second Enter on target would need two-step; use space on target after select
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlay, promo, orientation, selected, playerColor, position]);

  // Keyboard: first arrow-select piece, Enter confirms move to highlighted legal if only one, else Enter on target
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canPlay || !selected || promo) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (legalTargets.length === 1) {
        e.preventDefault();
        void tryMove(selected, legalTargets[0]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // tryMove intentionally omitted — uses latest fen via closure on canPlay change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlay, selected, promo, legalTargets]);

  const resetAi = () => {
    if (props.mode !== "ai") return;
    engineAbort.current?.abort();
    const fresh = new Chess();
    setFen(fresh.fen());
    setSelected(null);
    setLastMove(null);
    setStatusText("");
    setBanter("");
    setPromo(null);
    setShowOver(false);
    setEloNote("");
    scored.current = false;
    setBaseWhiteMs(AI_CLOCK_MS);
    setBaseBlackMs(AI_CLOCK_MS);
    playSound("start");
  };

  const undoAi = () => {
    if (props.mode !== "ai") return;
    engineAbort.current?.abort();
    const live = new Chess(fen);
    live.undo();
    if (live.turn() !== playerColor) live.undo();
    setFen(live.fen());
    setSelected(null);
    setStatusText("");
    setShowOver(false);
    scored.current = false;
  };

  const resignLocal = () => {
    if (spectator) return;
    if (!confirm("Resign this game?")) return;
    const winner = playerColor === "w" ? "Black" : "White";
    endGame(`Resignation — ${winner} wins`);
    if (props.mode === "human" && props.onResign) void props.onResign();
  };

  const cycleTheme = () => {
    const keys = Object.keys(BOARD_THEMES) as BoardTheme[];
    const unlocked = keys.filter(isThemeUnlocked);
    const idx = unlocked.indexOf(theme);
    const next = unlocked[(idx + 1) % unlocked.length] ?? "salon-emerald";
    setTheme(next);
    setBoardTheme(next);
  };

  const cycleAmbient = () => {
    const modes: AmbientMode[] = ["off", "rain", "room", "hall"];
    const idx = modes.indexOf(ambient);
    const next = modes[(idx + 1) % modes.length]!;
    setAmbientMode(next);
    setAmbient(next);
  };

  const copyPgn = async () => {
    const text = pgn || fen;
    try {
      await navigator.clipboard.writeText(text);
      setStatusText("PGN copied");
    } catch {
      setStatusText("Could not copy");
    }
  };

  const shareGame = async () => {
    const url =
      props.mode === "human"
        ? `${window.location.origin}/game/${props.code}?spectate=1`
        : window.location.href;
    const text = `${overTitle || "Atelier Chess"}\n${pgn || ""}\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Atelier Chess", text, url });
      } else {
        await navigator.clipboard.writeText(text);
        setStatusText("Share card copied");
      }
    } catch {
      await copyPgn();
    }
  };

  const analyze = () => {
    const encoded = encodeURIComponent(pgn || fen);
    router.push(`/analyze?pgn=${encoded}`);
  };

  const title =
    props.mode === "ai"
      ? `vs ${AI_RIVALS[props.level].name}`
      : spectator
        ? `Watching ${props.code}`
        : `Table ${props.code}`;

  const you = spectator ? "Spectator" : props.playerName;
  const them =
    props.mode === "ai"
      ? AI_RIVALS[props.level].name
      : (props.opponentName ?? "Waiting…");

  const topIsYou = orientation === "black";
  const topName = topIsYou ? you : them;
  const bottomName = topIsYou ? them : you;
  const topClock = orientation === "black" ? whiteMs : blackMs;
  const bottomClock = orientation === "black" ? blackMs : whiteMs;
  const topActive =
    (orientation === "black" ? turn === "w" : turn === "b") && clocksEnabled;
  const bottomActive =
    (orientation === "black" ? turn === "b" : turn === "w") && clocksEnabled;

  const incomingDraw =
    props.mode === "human" &&
    drawOfferBy &&
    drawOfferBy !== playerColor &&
    !spectator;
  const incomingTakeback =
    props.mode === "human" &&
    takebackOfferBy &&
    takebackOfferBy !== playerColor &&
    !spectator;

  return (
    <div className="game-layout relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:gap-10">
      {props.mode === "human" && humanStatus === "waiting" && !spectator && (
        <WaitingRoom code={props.code} hostName={props.playerName} />
      )}

      {showOver && (
        <GameOverOverlay
          title={overTitle || "Game over"}
          subtitle={
            props.mode === "ai"
              ? AI_RIVALS[props.level].name
              : opening ?? undefined
          }
          pgn={pgn}
          eloNote={eloNote || `Local Elo ${getElo()}`}
          primaryLabel={
            spectator ? "Lobby" : props.mode === "ai" ? "Play again" : "Rematch"
          }
          onPrimary={() => {
            if (spectator) router.push("/play");
            else if (props.mode === "ai") resetAi();
            else props.onRematch?.();
          }}
          onAnalyze={analyze}
          onShare={() => void shareGame()}
          secondaryLabel={spectator ? undefined : "Lobby"}
          onSecondary={spectator ? undefined : () => router.push("/play")}
          tertiaryLabel="Home"
          onTertiary={() => router.push("/")}
        />
      )}

      {(incomingDraw || incomingTakeback) && (
        <div className="overlay-scrim" role="dialog" aria-modal="true">
          <div className="overlay-card">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              {incomingDraw ? "Draw offered" : "Takeback requested"}
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  void props.mode === "human" &&
                  props.onAction?.(
                    incomingDraw ? "accept-draw" : "accept-takeback",
                  )
                }
              >
                Accept
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  void props.mode === "human" &&
                  props.onAction?.(
                    incomingDraw ? "decline-draw" : "decline-takeback",
                  )
                }
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center gap-3">
        <div className="flex w-full max-w-[min(92vw,560px)] items-center justify-between gap-3">
          <span className="truncate text-sm text-[var(--mist)]">{topName}</span>
          <span
            className={`clock ${topActive ? "active" : ""} ${topClock < 30_000 ? "low" : ""}`}
          >
            {formatClock(topClock)}
          </span>
        </div>

        <ChessBoard
          pieces={pieces}
          orientation={orientation}
          selected={selected}
          legalTargets={legalTargets}
          lastMove={lastMove}
          inCheckSquare={inCheckSquare}
          interactive={canPlay}
          theme={theme}
          showArrow={showArrow}
          vignette={vignette}
          onSquareClick={onSquareClick}
        />

        <div className="flex w-full max-w-[min(92vw,560px)] items-center justify-between gap-3">
          <span className="truncate text-sm text-[var(--mist)]">{bottomName}</span>
          <span
            className={`clock ${bottomActive ? "active" : ""} ${bottomClock < 30_000 ? "low" : ""}`}
          >
            {formatClock(bottomClock)}
          </span>
        </div>

        {promo && (
          <div className="flex gap-2 rounded-lg bg-[var(--panel)] p-3 ring-1 ring-[var(--brass-dim)]">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className="rounded bg-[var(--ink-soft)] p-2"
                onClick={() => void tryMove(promo.from, promo.to, p)}
                aria-label={`Promote to ${p}`}
              >
                <ChessPiece type={p} color={playerColor} size={40} />
              </button>
            ))}
          </div>
        )}

        {(statusText || banter || opening) && !showOver && (
          <p className="rounded-full bg-[var(--panel)] px-4 py-2 text-center text-[var(--cream)] ring-1 ring-[var(--brass-dim)]">
            {banter || statusText || opening}
          </p>
        )}
        <p className="text-center text-xs text-[var(--brass)]">
          {title}
          {opening ? ` · ${opening}` : ""}
          {spectator ? " · Spectating" : ""}
        </p>
        <p className="text-center text-[10px] text-[var(--mist)]">
          Keys: arrows select · Enter moves (one legal) · Esc clears
        </p>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-72">
        <div className="panel">
          <h2 className="panel-title">Moves</h2>
          <ol className="move-list max-h-56 overflow-y-auto text-sm">
            {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => {
              const w = history[i * 2];
              const b = history[i * 2 + 1];
              return (
                <li
                  key={i}
                  className="grid grid-cols-[2rem_1fr_1fr] gap-2 py-0.5"
                >
                  <span className="text-[var(--mist)]">{i + 1}.</span>
                  <span>{w?.san}</span>
                  <span>{b?.san ?? ""}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="panel">
          <h2 className="panel-title">Captured</h2>
          <div className="flex min-h-8 flex-wrap gap-0.5">
            {captured.white.map((p, i) => (
              <ChessPiece key={`w-${i}`} type={p.type} color={p.color} size={22} />
            ))}
          </div>
          <div className="mt-1 flex min-h-8 flex-wrap gap-0.5">
            {captured.black.map((p, i) => (
              <ChessPiece key={`b-${i}`} type={p.type} color={p.color} size={22} />
            ))}
          </div>
        </div>

        <div className="panel flex flex-wrap gap-2">
          <button type="button" className="chip" onClick={cycleTheme}>
            {BOARD_THEMES[theme].label}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
            }}
          >
            Sound {soundOn ? "On" : "Off"}
          </button>
          <button type="button" className="chip" onClick={cycleAmbient}>
            Ambient {ambient}
          </button>
          <button type="button" className="chip" onClick={() => setVignette((v) => !v)}>
            Lamp {vignette ? "On" : "Off"}
          </button>
          <button type="button" className="chip" onClick={() => setShowArrow((a) => !a)}>
            Arrow {showArrow ? "On" : "Off"}
          </button>
          <button type="button" className="chip" onClick={() => setFlipped((f) => !f)}>
            Flip
          </button>
          <button type="button" className="chip" onClick={() => void copyPgn()}>
            Copy PGN
          </button>
          {!spectator && (
            <button type="button" className="chip" onClick={resignLocal}>
              Resign
            </button>
          )}
          {props.mode === "human" && !spectator && props.onAction && (
            <>
              <button
                type="button"
                className="chip"
                onClick={() => void props.onAction?.("offer-draw")}
              >
                Offer draw
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => void props.onAction?.("offer-takeback")}
              >
                Takeback
              </button>
              {(humanStatus === "waiting" || history.length <= 2) && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => void props.onAction?.("abort")}
                >
                  Abort
                </button>
              )}
            </>
          )}
          {props.mode === "ai" && (
            <>
              <button type="button" className="chip" onClick={undoAi}>
                Undo
              </button>
              <button type="button" className="chip" onClick={resetAi}>
                New game
              </button>
            </>
          )}
          <Link href="/play" className="chip inline-flex items-center">
            Lobby
          </Link>
        </div>
        <p className="text-xs text-[var(--mist)]">Local Elo {getElo()}</p>
      </aside>
    </div>
  );
}
