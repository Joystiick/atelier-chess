import { Chess } from "chess.js";

export type GameVariant = "standard" | "chess960" | "antichess";

export const VARIANT_LABELS: Record<GameVariant, string> = {
  standard: "Classical",
  chess960: "Chess960",
  antichess: "Antichess (café)",
};

/** ISO week number → rotating café special (never standard). */
export function weeklyVariantSpecial(at = new Date()): GameVariant {
  const start = new Date(Date.UTC(at.getUTCFullYear(), 0, 1));
  const day = Math.floor((at.getTime() - start.getTime()) / 86_400_000);
  const week = Math.floor((day + start.getUTCDay()) / 7);
  return week % 2 === 0 ? "chess960" : "antichess";
}

export function isGameVariant(v: string | null | undefined): v is GameVariant {
  return v === "standard" || v === "chess960" || v === "antichess";
}

/** Chess960 starting FEN — shuffled back rank with bishops on opposite colors, king between rooks. */
export function startingFen(variant: GameVariant): string {
  if (variant === "chess960") {
    return randomChess960Fen();
  }
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

function randomChess960Fen(): string {
  // Place bishops on opposite colors, then queen/knights, then king between rooks.
  const files = Array.from({ length: 8 }, (_, i) => i);
  const dark = files.filter((f) => f % 2 === 0);
  const light = files.filter((f) => f % 2 === 1);
  const b1 = dark[Math.floor(Math.random() * dark.length)]!;
  const b2 = light[Math.floor(Math.random() * light.length)]!;
  const remaining = files.filter((f) => f !== b1 && f !== b2);
  const q = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]!;
  const n1 = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]!;
  const n2 = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]!;
  remaining.sort((a, b) => a - b);
  const [r1, k, r2] = remaining as [number, number, number];

  const back: string[] = Array(8).fill("");
  back[b1] = "b";
  back[b2] = "b";
  back[q] = "q";
  back[n1] = "n";
  back[n2] = "n";
  back[r1] = "r";
  back[k] = "k";
  back[r2] = "r";
  const white = back.join("").toUpperCase();
  const black = back.join("");
  // Soft castling rights: chess.js classical KQkq — castling may be imperfect off-standard.
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

export function createChess(fen: string, _variant: GameVariant): Chess {
  return new Chess(fen);
}

type UciParts = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

/**
 * Apply a UCI move with variant rules.
 * Antichess café MVP: must capture when any capture is legal (standard legality).
 */
export function tryVariantMove(
  fen: string,
  variant: GameVariant,
  parts: UciParts,
):
  | { ok: true; chess: Chess; move: ReturnType<Chess["move"]> }
  | { ok: false; error: string } {
  const chess = createChess(fen, variant);

  if (variant === "antichess") {
    const legal = chess.moves({ verbose: true });
    const captures = legal.filter((m) => m.captured);
    if (captures.length > 0) {
      const match = captures.find(
        (m) =>
          m.from === parts.from &&
          m.to === parts.to &&
          (!parts.promotion || m.promotion === parts.promotion),
      );
      if (!match) {
        return { ok: false, error: "Antichess: a capture is available — you must take" };
      }
    }
  }

  let move;
  try {
    move = chess.move({
      from: parts.from as never,
      to: parts.to as never,
      promotion: parts.promotion,
    });
  } catch {
    return { ok: false, error: "Illegal move" };
  }
  if (!move) return { ok: false, error: "Illegal move" };
  return { ok: true, chess, move };
}

/** Result after a successful move under variant rules. */
export function variantEndState(
  chess: Chess,
  variant: GameVariant,
  mover: "w" | "b",
): { status: "active" | "finished"; winner: string | null; result: string | null } {
  if (variant === "antichess") {
    // Café lite: if opponent has no legal moves, current mover wins (they forced the bare side).
    if (chess.isCheckmate() || chess.isStalemate() || chess.moves().length === 0) {
      return {
        status: "finished",
        winner: mover,
        result: `Antichess — ${mover === "w" ? "White" : "Black"} wins`,
      };
    }
    return { status: "active", winner: null, result: null };
  }

  if (chess.isCheckmate()) {
    return {
      status: "finished",
      winner: mover,
      result: `Checkmate — ${mover === "w" ? "White" : "Black"} wins`,
    };
  }
  if (chess.isDraw()) {
    return {
      status: "finished",
      winner: null,
      result: chess.isStalemate() ? "Stalemate" : "Draw",
    };
  }
  return { status: "active", winner: null, result: null };
}
