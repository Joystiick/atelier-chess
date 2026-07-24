export type AiLevel = "easy" | "medium" | "hard";

export const AI_RIVALS: Record<
  AiLevel,
  { name: string; title: string; blurb: string; searchMs: number }
> = {
  easy: {
    name: "The Apprentice",
    title: "Easy",
    blurb: "Curious, careless, and still learning the weight of a pawn.",
    searchMs: 300,
  },
  medium: {
    name: "The Clerk",
    title: "Medium",
    blurb: "Keeps tidy ledgers. Punishes the obvious mistake.",
    searchMs: 1000,
  },
  hard: {
    name: "The Grandmaster's Shadow",
    title: "Hard",
    blurb: "Strong and patient. Punishes mistakes.",
    searchMs: 2500,
  },
};

export type EngineBestMove = {
  uci: string;
  pv?: string;
};

export function createGarboWorker(): Worker {
  return new Worker("/engine/garbochess.js");
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
      // Best move in UCI-ish form e.g. e2e4 or e7e8q
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
