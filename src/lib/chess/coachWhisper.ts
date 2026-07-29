import { Chess, type Move } from "chess.js";

const PIECE_VAL: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export type CoachWhisper = {
  blunder: string;
  tactic: string;
  clock: string;
};

function materialFor(color: "w" | "b", chess: Chess): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const p of row) {
      if (p && p.color === color) total += PIECE_VAL[p.type] ?? 0;
    }
  }
  return total;
}

function materialSwing(before: Chess, after: Chess, mover: "w" | "b"): number {
  const opp = mover === "w" ? "b" : "w";
  const beforeDiff = materialFor(mover, before) - materialFor(opp, before);
  const afterDiff = materialFor(mover, after) - materialFor(opp, after);
  return afterDiff - beforeDiff;
}

function formatPly(move: Move, plyIndex: number): string {
  const num = Math.floor(plyIndex / 2) + 1;
  const prefix = plyIndex % 2 === 0 ? `${num}.` : `${num}…`;
  return `${prefix} ${move.san}`;
}

/**
 * Lightweight post-game coach: three short bullets from PGN + clocks.
 * Heuristic only — not a Stockfish dump.
 */
export function buildCoachWhisper(opts: {
  pgn?: string;
  fen?: string;
  whiteMs?: number;
  blackMs?: number;
  baseMs?: number;
  playerColor?: "w" | "b";
  timedOut?: boolean;
}): CoachWhisper {
  const player = opts.playerColor ?? "w";
  const moves: Move[] = [];
  let blunderHint =
    "No clear material swing stood out — keep asking what each piece does.";
  let tacticHint =
    "Look back for checks and captures you skipped — tactics hide in forcing moves.";

  try {
    const game = opts.pgn
      ? new Chess()
      : opts.fen
        ? new Chess(opts.fen)
        : new Chess();
    if (opts.pgn) {
      game.loadPgn(opts.pgn);
    }
    const verbose = game.history({ verbose: true });
    moves.push(...verbose);

    let worstSwing = 0;
    let worstMove: Move | null = null;
    let worstPly = 0;
    let checks = 0;
    let captures = 0;

    const replay = new Chess();
    verbose.forEach((move, i) => {
      const before = new Chess(replay.fen());
      replay.move(move);
      if (move.san.includes("+") || move.san.includes("#")) checks += 1;
      if (move.captured) captures += 1;
      if (move.color !== player) return;
      const swing = materialSwing(before, replay, player);
      if (swing < worstSwing) {
        worstSwing = swing;
        worstMove = move;
        worstPly = i;
      }
    });

    if (worstMove && worstSwing <= -3) {
      blunderHint = `Watch ${formatPly(worstMove, worstPly)} — about ${Math.abs(worstSwing)} points of material slipped away.`;
    } else if (worstMove && worstSwing <= -1) {
      blunderHint = `Soft slip at ${formatPly(worstMove, worstPly)} — a quieter way to lose a tempo or pawn.`;
    }

    const playerMoves = verbose.filter((m) => m.color === player);
    const playerChecks = playerMoves.filter(
      (m) => m.san.includes("+") || m.san.includes("#"),
    ).length;
    if (verbose.some((m) => m.san.includes("#"))) {
      tacticHint = "Mate landed — rewind the last forcing checks; those are the pattern.";
    } else if (playerChecks === 0 && playerMoves.length >= 8) {
      tacticHint =
        "You gave few checks — pause for checks, captures, and threats before each move.";
    } else if (captures >= 4 && worstSwing <= -2) {
      tacticHint =
        "Busy board with captures — after each exchange, ask if a piece was hanging.";
    } else if (playerMoves.length < 12) {
      tacticHint =
        "Short game — the missed tactic often sits one move before the collapse.";
    }
  } catch {
    // keep defaults
  }

  const whiteMs = opts.whiteMs ?? 0;
  const blackMs = opts.blackMs ?? 0;
  const base = opts.baseMs ?? Math.max(whiteMs, blackMs, 1);
  const myMs = player === "w" ? whiteMs : blackMs;
  const theirMs = player === "w" ? blackMs : whiteMs;
  let clockHint =
    "Clocks were quiet — still good to spend a few seconds on forcing lines.";

  if (opts.timedOut || myMs <= 0 && base > 0) {
    clockHint =
      "Flag fell — bank 5–10 seconds for the critical move instead of burning the opening.";
  } else if (base > 0 && myMs > base * 0.7 && moves.length >= 20) {
    clockHint =
      "Lots of time left unused — invest a bit more on moments that change material.";
  } else if (base > 0 && myMs < base * 0.1 && theirMs > base * 0.4) {
    clockHint =
      "You were low while they were flush — simplify earlier when the clock gets sharp.";
  } else if (base > 0 && Math.abs(myMs - theirMs) > base * 0.35) {
    clockHint =
      theirMs > myMs
        ? "Opponent had a healthier clock — avoid deep thinks on quiet moves."
        : "You held a clock edge — use it to press when the position opens.";
  } else if (base === 0) {
    clockHint = "Unlimited clock — still set a personal think budget so games stay crisp.";
  }

  return {
    blunder: blunderHint,
    tactic: tacticHint,
    clock: clockHint,
  };
}
