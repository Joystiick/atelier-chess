"use client";

import { ChessBoard, type BoardPiece } from "@/components/board/ChessBoard";
import { ChessPiece } from "@/components/board/ChessPiece";
import { GameOverOverlay } from "@/components/game/GameOverOverlay";
import { TableQr } from "@/components/game/TableQr";
import { TablecastQrDock } from "@/components/game/TablecastQrDock";
import { VoiceRoom } from "@/components/game/VoiceRoom";
import { WaitingRoom } from "@/components/game/WaitingRoom";
import { useAmbient } from "@/lib/chess/ambient";
import { AI_ELO, rivalLine } from "@/lib/chess/banter";
import { formatClockOrUnlimited, useClocks } from "@/lib/chess/clocks";
import {
  AI_RIVALS,
  askAiMove,
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
import {
  getBlindfold,
  getCoachMode,
  getConfirmMove,
  getLampAuto,
  getMood,
  getPieceSet,
  getPremoveEnabled,
  lampForHour,
  MOOD_PACKS,
  PIECE_SETS,
  setBlindfold,
  setCoachMode,
  setConfirmMove,
  setMood,
  setPieceSet,
  setPremoveEnabled,
  type MoodId,
  type PieceSetId,
} from "@/lib/prefs";
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
const REPLAY_KEY = "atelier.replayPgn";
const FILES = "abcdefgh";

const REMATCH_LINES = [
  "Same table — shall we?",
  "One more, with feeling.",
  "The salon still has light.",
  "Rematch? The pieces remember.",
  "Again — fortune favors the curious.",
];

const MOOD_ORDER = Object.keys(MOOD_PACKS) as MoodId[];
const PIECE_ORDER = Object.keys(PIECE_SETS) as PieceSetId[];

type PendingConfirm = { from: Square; to: Square };
type Premove = { from: Square; to: Square; promotion?: "q" | "r" | "b" | "n" };
type CoachCandidate = { san: string; from: Square; to: Square; promotion?: string };

type GameShellProps =
  | {
      mode: "ai";
      level: AiLevel;
      playerColor?: "w" | "b";
      playerName: string;
      /** 0 = unlimited */
      clockMs?: number;
      correspondence?: boolean;
      rated?: boolean;
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
      /** 0 = unlimited */
      timeControlMs?: number;
      correspondence?: boolean;
      rated?: boolean;
      joinTicket?: string | null;
      blindfoldCafe?: boolean;
      /** Desktop table + phone seats + gallery */
      tablecast?: boolean;
      spectatorCount?: number;
      onTablecastChange?: (on: boolean) => void;
      /** Compact phone seat UI for Tablecast */
      phoneController?: boolean;
      onLocalMove?: (uci: string, san: string, fen: string) => Promise<{
        whiteClockMs?: number;
        blackClockMs?: number;
      } | void>;
      remoteFen?: string | null;
      remoteResult?: string | null;
      whiteClockMs?: number;
      blackClockMs?: number;
      onRematch?: () => void;
      onGhostRematch?: () => Promise<{ code: string; joinTicket: string } | null>;
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

function pickWeightedCandidates(chess: Chess, limit: number): CoachCandidate[] {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return [];

  const scored = moves.map((m) => {
    let score = Math.random();
    if (m.san.includes("+") || m.san.includes("#")) score += 3;
    if (m.captured) score += 2;
    if (m.flags.includes("k") || m.flags.includes("q")) score += 0.5;
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const out: CoachCandidate[] = [];
  const seen = new Set<string>();
  for (const { m } of scored) {
    if (out.length >= limit) break;
    if (seen.has(m.san)) continue;
    seen.add(m.san);
    out.push({
      san: m.san,
      from: m.from as Square,
      to: m.to as Square,
      promotion: m.promotion,
    });
  }
  return out;
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
  const [confirmOn, setConfirmOn] = useState(false);
  const [premoveOn, setPremoveOn] = useState(false);
  const [coachOn, setCoachOn] = useState(false);
  const [blindfoldOn, setBlindfoldOn] = useState(
    props.mode === "human" && Boolean(props.blindfoldCafe),
  );
  const [ghostRematch, setGhostRematch] = useState<{
    code: string;
    joinTicket: string;
  } | null>(null);
  const [joinTicket, setJoinTicket] = useState(
    props.mode === "human" ? (props.joinTicket ?? "") : "",
  );
  const [tablecastOn, setTablecastOn] = useState(
    props.mode === "human" ? Boolean(props.tablecast) : false,
  );
  const [phoneRemoteUrl, setPhoneRemoteUrl] = useState<string | null>(null);
  const [phoneRemoteMsg, setPhoneRemoteMsg] = useState("");
  const [tableSettingsOpen, setTableSettingsOpen] = useState(false);
  const [pieceSet, setPieceSetState] = useState<PieceSetId>("classic");
  const [moodId, setMoodId] = useState<MoodId | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );
  const [premove, setPremove] = useState<Premove | null>(null);
  const [coachMoves, setCoachMoves] = useState<CoachCandidate[]>([]);
  const [sanInput, setSanInput] = useState("");
  const engineAbort = useRef<AbortController | null>(null);
  const coachAbort = useRef<AbortController | null>(null);
  const started = useRef(false);
  const scored = useRef(false);
  const fenRef = useRef(fen);
  const premoveRef = useRef<Premove | null>(null);

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    premoveRef.current = premove;
  }, [premove]);

  useEffect(() => {
    setTheme(getBoardTheme());
    setSoundOn(getSoundEnabled());
    setAmbientMode(getAmbient());
    setConfirmOn(getConfirmMove());
    setPremoveOn(getPremoveEnabled());
    setCoachOn(getCoachMode());
    if (!(props.mode === "human" && props.blindfoldCafe)) {
      setBlindfoldOn(getBlindfold());
    }
    setPieceSetState(getPieceSet());
    const mood = getMood();
    setMoodId(mood);
    if (mood) {
      const pack = MOOD_PACKS[mood];
      // Mood owns ambient only; table skin keeps board squares.
      setAmbientMode(pack.ambient);
      setAmbient(pack.ambient);
    }
    if (getLampAuto()) {
      setVignette(lampForHour().vignette);
    }
  }, []);

  useEffect(() => {
    if (props.mode === "human") {
      setTablecastOn(Boolean(props.tablecast));
    }
  }, [props]);

  useAmbient(ambient);

  const playerColor =
    props.mode === "ai" ? (props.playerColor ?? "w") : props.playerColor;
  const spectator = props.mode === "human" && Boolean(props.spectator);
  const tablecast =
    props.mode === "human" && (tablecastOn || Boolean(props.tablecast));
  const phoneController =
    props.mode === "human" && Boolean(props.phoneController) && !spectator;
  const spectatorCount =
    props.mode === "human" ? (props.spectatorCount ?? 0) : 0;
  const remoteFen = props.mode === "human" ? props.remoteFen : null;
  const remoteResult = props.mode === "human" ? props.remoteResult : null;
  const humanStatus = props.mode === "human" ? props.status : null;
  const aiLevel = props.mode === "ai" ? props.level : null;
  const drawOfferBy = props.mode === "human" ? props.drawOfferBy : null;
  const takebackOfferBy = props.mode === "human" ? props.takebackOfferBy : null;
  const rated = props.rated ?? (props.mode === "human");
  const correspondence = Boolean(props.correspondence);

  const [baseWhiteMs, setBaseWhiteMs] = useState(() => {
    if (props.mode === "human") {
      if ((props.timeControlMs ?? 1) === 0) return 0;
      return props.whiteClockMs ?? AI_CLOCK_MS;
    }
    return props.clockMs ?? AI_CLOCK_MS;
  });
  const [baseBlackMs, setBaseBlackMs] = useState(() => {
    if (props.mode === "human") {
      if ((props.timeControlMs ?? 1) === 0) return 0;
      return props.blackClockMs ?? AI_CLOCK_MS;
    }
    return props.clockMs ?? AI_CLOCK_MS;
  });

  const unlimited =
    (props.mode === "human" && (props.timeControlMs ?? 1) === 0) ||
    (props.mode === "ai" && (props.clockMs ?? AI_CLOCK_MS) === 0) ||
    baseWhiteMs === 0 ||
    correspondence;

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
      setPendingConfirm(null);
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
      const rematch =
        REMATCH_LINES[Math.floor(Math.random() * REMATCH_LINES.length)]!;
      setBanter((prev) => (prev ? `${prev} · ${rematch}` : rematch));

      const archiveCode = props.mode === "human" ? props.code : "ai";
      const opponentLabel =
        props.mode === "ai"
          ? AI_RIVALS[props.level].name
          : (props.opponentName ?? "Opponent");
      let archivePgn = "";
      try {
        archivePgn = new Chess(fenRef.current).pgn();
      } catch {
        archivePgn = fenRef.current;
      }
      void fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: archiveCode,
          pgn: archivePgn,
          result,
          opponent: opponentLabel,
          rated: props.rated ?? props.mode === "human",
        }),
      }).catch(() => {
        // guests / offline ignore archive
      });

      void fetch("/api/auth/elo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result,
          opponent: aiLevel ?? "human",
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.user?.elo != null) {
            setEloNote(`Elo → ${data.user.elo}`);
          }
        })
        .catch(() => {
          // guest play keeps local elo only
        });
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
    !unlimited &&
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
      const { uci } = await askAiMove(aiLevel, live.fen(), ac.signal);
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

  const canPremove =
    premoveOn &&
    !spectator &&
    !thinking &&
    !gameOver &&
    humanStatus !== "waiting" &&
    turn !== playerColor;

  const tryMove = useCallback(
    async (
      from: Square,
      to: Square,
      promotion?: "q" | "r" | "b" | "n",
    ) => {
      if (spectator || gameOver || humanStatus === "waiting" || thinking) return;

      const prevFen = fenRef.current;
      const live = new Chess(prevFen);
      if (live.turn() !== playerColor || live.isGameOver()) return;

      const legal = live.moves({ square: from, verbose: true });
      const match = legal.find(
        (m) => m.to === to && (!promotion || m.promotion === promotion),
      );
      if (!match) {
        setSelected(null);
        setPendingConfirm(null);
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
        setPendingConfirm(null);
        return;
      }
      if (!move) {
        setSelected(null);
        setPendingConfirm(null);
        return;
      }

      setSelected(null);
      setPromo(null);
      setPendingConfirm(null);
      setPremove(null);
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
          setFen(prevFen);
          setStatusText("Move rejected — try again.");
          return;
        }
      }

      void ended;
    },
    [
      spectator,
      gameOver,
      humanStatus,
      thinking,
      playerColor,
      afterMoveFx,
      applyEndStatus,
      props,
    ],
  );

  // Auto-play premove when it becomes our turn
  useEffect(() => {
    if (!canPlay || !premoveOn) return;
    const pm = premoveRef.current;
    if (!pm) return;
    const live = new Chess(fen);
    const legal = live.moves({ square: pm.from, verbose: true });
    const ok = legal.some(
      (m) =>
        m.to === pm.to &&
        (!pm.promotion || m.promotion === pm.promotion),
    );
    if (!ok) {
      setPremove(null);
      return;
    }
    const t = window.setTimeout(() => {
      void tryMove(pm.from, pm.to, pm.promotion);
    }, 30);
    return () => window.clearTimeout(t);
  }, [canPlay, fen, premoveOn, tryMove]);

  // Coach candidates
  useEffect(() => {
    coachAbort.current?.abort();
    if (!coachOn || !canPlay || gameOver) {
      setCoachMoves([]);
      return;
    }
    const live = new Chess(fen);
    const weighted = pickWeightedCandidates(live, 3);
    setCoachMoves(weighted);

    const ac = new AbortController();
    coachAbort.current = ac;
    void (async () => {
      try {
        const { uci } = await askEngineMove(fen, 120, ac.signal);
        if (ac.signal.aborted) return;
        const parts = uciToMove(uci);
        const probe = new Chess(fen);
        let move;
        try {
          move = probe.move(parts);
        } catch {
          move = null;
        }
        if (!move) return;
        setCoachMoves((prev) => {
          const engineCand: CoachCandidate = {
            san: move.san,
            from: move.from as Square,
            to: move.to as Square,
            promotion: move.promotion,
          };
          const rest = prev.filter((c) => c.san !== engineCand.san).slice(0, 2);
          return [engineCand, ...rest].slice(0, 3);
        });
      } catch {
        // keep weighted picks
      }
    })();

    return () => ac.abort();
  }, [coachOn, canPlay, fen, gameOver]);

  const onSquareClick = (square: Square) => {
    if (promo) return;

    // Premove path
    if (canPremove) {
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
        const legal = position.moves({ square: selected, verbose: true });
        // For premoves, opponent's turn — legal moves are opponent's; use ghost chess with our turn
        const ghost = new Chess(fen);
        // Force our color by temporarily... actually chess.js only allows current turn.
        // Store intended from-to if selected piece is ours.
        const selPiece = position.get(selected);
        if (selPiece && selPiece.color === playerColor) {
          setPremove({ from: selected, to: square });
          setLastMove({ from: selected, to: square });
          setSelected(null);
          setStatusText(`Premove ${selected}${square}`);
          return;
        }
        void legal;
        setSelected(null);
        return;
      }
      if (piece && piece.color === playerColor) setSelected(square);
      return;
    }

    if (!canPlay) return;

    const piece = position.get(square);
    if (selected) {
      if (selected === square) {
        setSelected(null);
        setPendingConfirm(null);
        return;
      }
      if (piece && piece.color === playerColor) {
        setSelected(square);
        setPendingConfirm(null);
        return;
      }
      if (!legalTargets.includes(square)) {
        setSelected(null);
        setPendingConfirm(null);
        return;
      }
      if (confirmOn) {
        setPendingConfirm({ from: selected, to: square });
        return;
      }
      void tryMove(selected, square);
      return;
    }
    if (piece && piece.color === playerColor) setSelected(square);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (promo || (!canPlay && !canPremove)) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (e.key === "Escape") {
        setSelected(null);
        setPendingConfirm(null);
        setPremove(null);
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlay, canPremove, promo, orientation, selected, playerColor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canPlay || !selected || promo) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (legalTargets.length === 1) {
        e.preventDefault();
        if (confirmOn) {
          setPendingConfirm({ from: selected, to: legalTargets[0]! });
        } else {
          void tryMove(selected, legalTargets[0]!);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlay, selected, promo, legalTargets, confirmOn, tryMove]);

  const submitSan = () => {
    if (!canPlay || !sanInput.trim()) return;
    const live = new Chess(fen);
    let move;
    try {
      move = live.move(sanInput.trim());
    } catch {
      move = null;
    }
    if (!move) {
      setStatusText("Illegal SAN");
      return;
    }
    setSanInput("");
    void tryMove(
      move.from as Square,
      move.to as Square,
      move.promotion as "q" | "r" | "b" | "n" | undefined,
    );
  };

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
    setPendingConfirm(null);
    setPremove(null);
    setShowOver(false);
    setEloNote("");
    scored.current = false;
    setBaseWhiteMs(props.mode === "ai" ? (props.clockMs ?? AI_CLOCK_MS) : AI_CLOCK_MS);
    setBaseBlackMs(props.mode === "ai" ? (props.clockMs ?? AI_CLOCK_MS) : AI_CLOCK_MS);
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

  const cycleMood = () => {
    const idx = moodId ? MOOD_ORDER.indexOf(moodId) : -1;
    const next = MOOD_ORDER[(idx + 1) % MOOD_ORDER.length]!;
    setMoodId(next);
    setMood(next);
    const pack = MOOD_PACKS[next];
    setAmbientMode(pack.ambient);
    setAmbient(pack.ambient);
  };

  const cyclePieceSet = () => {
    const idx = PIECE_ORDER.indexOf(pieceSet);
    const next = PIECE_ORDER[(idx + 1) % PIECE_ORDER.length]!;
    setPieceSetState(next);
    setPieceSet(next);
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
    try {
      sessionStorage.setItem(REPLAY_KEY, pgn || fen);
    } catch {
      // ignore quota
    }
    router.push("/analyze");
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

  const pieceFilter = PIECE_SETS[pieceSet].filter;
  const premoveHighlight =
    premove && turn !== playerColor
      ? { from: premove.from, to: premove.to }
      : null;
  const boardLastMove = premoveHighlight ?? lastMove;

  return (
    <div className="game-layout relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:gap-10">
      {props.mode === "human" && humanStatus === "waiting" && !spectator && (
        <WaitingRoom
          code={props.code}
          hostName={props.playerName}
          joinTicket={joinTicket || props.joinTicket}
          onTicketChange={setJoinTicket}
        />
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
            spectator
              ? "Lobby"
              : props.mode === "ai"
                ? "Play again"
                : ghostRematch
                  ? "Open rematch table"
                  : "Rematch"
          }
          onPrimary={() => {
            if (spectator) router.push("/play");
            else if (props.mode === "ai") resetAi();
            else if (ghostRematch) router.push(`/game/${ghostRematch.code}`);
            else props.onRematch?.();
          }}
          onGhostRematch={
            props.mode === "human" && !spectator && props.onGhostRematch
              ? () => {
                  void (async () => {
                    const g = await props.onGhostRematch?.();
                    if (g) setGhostRematch(g);
                  })();
                }
              : undefined
          }
          ghostRematch={ghostRematch}
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
        <div className={`player-bar ${topActive ? "active-side" : ""}`}>
          <span className="player-name">{topName}</span>
          <span
            className={`clock ${topActive ? "active" : ""} ${topClock < 30_000 ? "low" : ""}`}
          >
            {formatClockOrUnlimited(topClock, unlimited)}
          </span>
        </div>

        <div
          className={`w-full max-w-[min(92vw,560px)] piece-set-${pieceSet}`}
          style={{ filter: pieceFilter === "none" ? undefined : pieceFilter }}
        >
          <ChessBoard
            pieces={pieces}
            orientation={orientation}
            selected={selected}
            legalTargets={
              canPremove && selected
                ? []
                : pendingConfirm
                  ? [pendingConfirm.to]
                  : legalTargets
            }
            lastMove={boardLastMove}
            inCheckSquare={inCheckSquare}
            interactive={canPlay || canPremove}
            theme={theme}
            showArrow={showArrow}
            vignette={vignette}
            hidePieces={blindfoldOn}
            onSquareClick={onSquareClick}
          />
        </div>

        <div className={`player-bar ${bottomActive ? "active-side" : ""}`}>
          <span className="player-name">{bottomName}</span>
          <span
            className={`clock ${bottomActive ? "active" : ""} ${bottomClock < 30_000 ? "low" : ""}`}
          >
            {formatClockOrUnlimited(bottomClock, unlimited)}
          </span>
        </div>

        {pendingConfirm && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--mist)]">
              Confirm {pendingConfirm.from}→{pendingConfirm.to}?
            </span>
            <button
              type="button"
              className="chip touch-target"
              onClick={() =>
                void tryMove(pendingConfirm.from, pendingConfirm.to)
              }
            >
              Confirm move
            </button>
            <button
              type="button"
              className="chip touch-target"
              onClick={() => {
                setPendingConfirm(null);
                setSelected(null);
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {coachOn && coachMoves.length > 0 && canPlay && (
          <div className="flex flex-wrap justify-center gap-2">
            {coachMoves.map((c) => (
              <button
                key={c.san}
                type="button"
                className="chip touch-target"
                onClick={() =>
                  void tryMove(
                    c.from,
                    c.to,
                    c.promotion as "q" | "r" | "b" | "n" | undefined,
                  )
                }
              >
                Coach {c.san}
              </button>
            ))}
          </div>
        )}

        {blindfoldOn && canPlay && (
          <form
            className="flex w-full max-w-[min(92vw,560px)] gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitSan();
            }}
          >
            <input
              className="field"
              placeholder='Type SAN — e4, Nf3…'
              value={sanInput}
              onChange={(e) => setSanInput(e.target.value)}
              aria-label="Blindfold move (SAN)"
            />
            <button type="submit" className="chip touch-target shrink-0">
              Play
            </button>
          </form>
        )}

        {promo && (
          <div className="flex gap-2 rounded-lg bg-[var(--panel)] p-3 ring-1 ring-[var(--brass-dim)]">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className="touch-target rounded bg-[var(--ink-soft)] p-2"
                onClick={() => void tryMove(promo.from, promo.to, p)}
                aria-label={`Promote to ${p}`}
              >
                <ChessPiece type={p} color={playerColor} size={40} />
              </button>
            ))}
          </div>
        )}

        {(statusText || banter || opening) && !showOver && (
          <p className="status-line">
            {banter || statusText || opening}
          </p>
        )}
        <p className="text-center text-xs text-[var(--brass)]">
          {title}
          {opening ? ` · ${opening}` : ""}
          {spectator ? " · Spectating" : ""}
          {rated ? " · Rated" : " · Casual"}
          {correspondence ? " · Correspondence" : ""}
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
          {!spectator && (
            <button type="button" className="chip touch-target" onClick={resignLocal}>
              Resign
            </button>
          )}
          {props.mode === "human" && !spectator && props.onAction && (
            <>
              <button
                type="button"
                className="chip touch-target"
                onClick={() => void props.onAction?.("offer-draw")}
              >
                Offer draw
              </button>
              <button
                type="button"
                className="chip touch-target"
                onClick={() => void props.onAction?.("offer-takeback")}
              >
                Takeback
              </button>
              {(humanStatus === "waiting" || history.length <= 2) && (
                <button
                  type="button"
                  className="chip touch-target"
                  onClick={() => void props.onAction?.("abort")}
                >
                  Abort
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="chip touch-target"
            onClick={() => setFlipped((f) => !f)}
          >
            Flip
          </button>
          {props.mode === "ai" && (
            <>
              <button type="button" className="chip touch-target" onClick={undoAi}>
                Undo
              </button>
              <button type="button" className="chip touch-target" onClick={resetAi}>
                New game
              </button>
            </>
          )}
          <Link href="/play" className="chip touch-target inline-flex items-center">
            Lobby
          </Link>
        </div>

        <div className="panel space-y-2">
          <button
            type="button"
            className="btn-ghost w-full text-left"
            onClick={() => setTableSettingsOpen((v) => !v)}
          >
            {tableSettingsOpen ? "Hide table settings" : "Table settings"}
          </button>
          {tableSettingsOpen && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip touch-target" onClick={cycleTheme}>
                {BOARD_THEMES[theme].label}
              </button>
              <button
                type="button"
                className="chip touch-target"
                onClick={() => {
                  const next = !soundOn;
                  setSoundOn(next);
                  setSoundEnabled(next);
                }}
              >
                Sound {soundOn ? "On" : "Off"}
              </button>
              <button type="button" className="chip touch-target" onClick={cycleAmbient}>
                Ambient {ambient}
              </button>
              <button
                type="button"
                className="chip touch-target"
                onClick={() => {
                  if (getLampAuto()) {
                    setVignette(lampForHour().vignette);
                  } else {
                    setVignette((v) => !v);
                  }
                }}
              >
                Lamp {vignette ? "On" : "Off"}
              </button>
              <button
                type="button"
                className="chip touch-target"
                onClick={() => setShowArrow((a) => !a)}
              >
                Arrow {showArrow ? "On" : "Off"}
              </button>
              <button
                type="button"
                className={`chip touch-target ${confirmOn ? "ring-1 ring-[var(--brass)]" : ""}`}
                onClick={() => {
                  const next = !confirmOn;
                  setConfirmOn(next);
                  setConfirmMove(next);
                  setPendingConfirm(null);
                }}
              >
                Confirm {confirmOn ? "On" : "Off"}
              </button>
              <button
                type="button"
                className={`chip touch-target ${premoveOn ? "ring-1 ring-[var(--brass)]" : ""}`}
                onClick={() => {
                  const next = !premoveOn;
                  setPremoveOn(next);
                  setPremoveEnabled(next);
                  if (!next) setPremove(null);
                }}
              >
                Premoves {premoveOn ? "On" : "Off"}
              </button>
              <button
                type="button"
                className={`chip touch-target ${coachOn ? "ring-1 ring-[var(--brass)]" : ""}`}
                onClick={() => {
                  const next = !coachOn;
                  setCoachOn(next);
                  setCoachMode(next);
                }}
              >
                Coach {coachOn ? "On" : "Off"}
              </button>
              <button
                type="button"
                className={`chip touch-target ${blindfoldOn ? "ring-1 ring-[var(--brass)]" : ""}`}
                onClick={() => {
                  const next = !blindfoldOn;
                  setBlindfoldOn(next);
                  setBlindfold(next);
                }}
              >
                Blindfold {blindfoldOn ? "On" : "Off"}
              </button>
              <button type="button" className="chip touch-target" onClick={cyclePieceSet}>
                Pieces {PIECE_SETS[pieceSet].label}
              </button>
              <button type="button" className="chip touch-target" onClick={cycleMood}>
                Mood {moodId ? MOOD_PACKS[moodId].label : "Salon"}
              </button>
              <button type="button" className="chip touch-target" onClick={() => void copyPgn()}>
                Copy PGN
              </button>
              {props.mode === "human" && (
                <Link
                  href={`/watch/${props.code}`}
                  className="chip touch-target inline-flex items-center"
                >
                  Watch party
                </Link>
              )}
            </div>
          )}
        </div>

        {props.mode === "human" &&
          !spectator &&
          humanStatus === "active" && (
            <div className="panel space-y-3">
              <h2 className="panel-title">Phone remote</h2>
              <p className="text-xs text-[var(--mist)]">
                Clocks, draw, resign, and emotes on your phone. Moves stay here.
              </p>
              <button
                type="button"
                className="chip touch-target w-full"
                onClick={() => {
                  void (async () => {
                    setPhoneRemoteMsg("");
                    const res = await fetch(`/api/games/${props.code}/handoff`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "create" }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setPhoneRemoteMsg(data.error ?? "Could not create handoff");
                      return;
                    }
                    const path = `${data.urlPath as string}&next=remote`;
                    setPhoneRemoteUrl(`${window.location.origin}${path}`);
                  })();
                }}
              >
                {phoneRemoteUrl ? "Refresh QR" : "Show companion QR"}
              </button>
              {phoneRemoteUrl && (
                <div className="space-y-2">
                  <TableQr
                    url={phoneRemoteUrl}
                    size={140}
                    label="Scan for phone remote"
                  />
                  <button
                    type="button"
                    className="chip touch-target"
                    onClick={() => void navigator.clipboard.writeText(phoneRemoteUrl)}
                  >
                    Copy remote link
                  </button>
                </div>
              )}
              {phoneRemoteMsg && (
                <p className="text-sm text-red-300">{phoneRemoteMsg}</p>
              )}
            </div>
          )}

        {props.mode === "human" && !spectator && (
          <div className="panel">
            <VoiceRoom code={props.code} />
          </div>
        )}

        <p className="text-xs text-[var(--mist)]">Local Elo {getElo()}</p>
      </aside>
    </div>
  );
}
