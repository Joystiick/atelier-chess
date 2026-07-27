import { Chess } from "chess.js";

export type AiLevel = "easy" | "medium" | "hard";

export const AI_RIVALS: Record<
  AiLevel,
  {
    name: string;
    title: string;
    blurb: string;
    searchMs: number;
    /** Chance to ignore the engine and play a weaker/random move */
    blunderRate: number;
  }
> = {
  easy: {
    name: "The Apprentice",
    title: "Easy",
    blurb: "Plays casually — great for learning. Classmates should win often.",
    searchMs: 40,
    blunderRate: 0.82,
  },
  medium: {
    name: "The Clerk",
    title: "Medium",
    blurb: "Solid club strength. Punishes loose pieces, still missable.",
    searchMs: 450,
    blunderRate: 0.22,
  },
  hard: {
    name: "The Grandmaster's Shadow",
    title: "Hard",
    blurb: "Strong and patient. Few free mistakes.",
    searchMs: 2200,
    blunderRate: 0.03,
  },
};

export type EngineBestMove = {
  uci: string;
  pv?: string;
};

export function createGarboWorker(): Worker {
  return new Worker("/engine/garbochess.js");
}

function moveToUci(m: {
  from: string;
  to: string;
  promotion?: string | undefined;
}): string {
  return `${m.from}${m.to}${m.promotion ?? ""}`;
}

/** Prefer quieter mistakes on Easy — not always hanging the queen on move 1. */
function pickHumanishMove(fen: string): EngineBestMove {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) {
    throw new Error("No legal moves");
  }

  // Weight: checks & captures a bit more often (looks intentional), else random
  const checks = legal.filter((m) => {
    const c = new Chess(fen);
    c.move(m);
    return c.inCheck();
  });
  const captures = legal.filter((m) => Boolean(m.captured));
  const pool =
    Math.random() < 0.2 && checks.length > 0
      ? checks
      : Math.random() < 0.35 && captures.length > 0
        ? captures
        : legal;

  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  return { uci: moveToUci(pick) };
}

export function askEngineMove(
  fen: string,
  searchMs: number,
  signal?: AbortSignal,
): Promise<EngineBestMove> {
  return new Promise((resolve, reject) => {
    const worker = createGarboWorker();
    let settled = false;

    const cleanup = () => {
      worker.terminate();
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const succeed = (move: EngineBestMove) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(move);
    };

    const onAbort = () => fail(new Error("Engine search aborted"));
    signal?.addEventListener("abort", onAbort);

    let lastPv = "";

    worker.onmessage = (e: MessageEvent<string>) => {
      const data = e.data;
      if (typeof data !== "string") return;
      if (data.startsWith("pv ")) {
        lastPv = data.slice(3);
        return;
      }
      if (data.startsWith("message ")) {
        fail(new Error(data.slice(8)));
        return;
      }
      if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(data)) {
        succeed({ uci: data, pv: lastPv || undefined });
      }
    };

    worker.onerror = () => fail(new Error("Engine worker failed"));

    worker.postMessage("go");
    worker.postMessage(`position ${fen}`);
    worker.postMessage(`search ${searchMs}`);

    window.setTimeout(() => {
      if (!settled) fail(new Error("Engine timed out"));
    }, searchMs + 8000);
  });
}

/** Difficulty-aware move: Easy is mostly humanish random, Hard is near-full engine. */
export async function askAiMove(
  level: AiLevel,
  fen: string,
  signal?: AbortSignal,
): Promise<EngineBestMove> {
  const rival = AI_RIVALS[level];
  if (Math.random() < rival.blunderRate) {
    return pickHumanishMove(fen);
  }
  try {
    return await askEngineMove(fen, rival.searchMs, signal);
  } catch {
    return pickHumanishMove(fen);
  }
}

export function uciToMove(uci: string): {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
} {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promo = uci[4] as "q" | "r" | "b" | "n" | undefined;
  return promo ? { from, to, promotion: promo } : { from, to };
}
