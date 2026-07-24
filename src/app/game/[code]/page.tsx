"use client";

import { GameShell } from "@/components/game/GameShell";
import { getPusherClient } from "@/lib/pusher/client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";

type Snapshot = {
  code: string;
  status: "waiting" | "active" | "finished" | "abandoned";
  fen: string;
  whiteName: string | null;
  blackName: string | null;
  you: "w" | "b" | null;
  result: string | null;
  whiteClockMs?: number;
  blackClockMs?: number;
};

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [remoteFen, setRemoteFen] = useState<string | null>(null);
  const [remoteResult, setRemoteResult] = useState<string | null>(null);
  const [whiteClockMs, setWhiteClockMs] = useState(600_000);
  const [blackClockMs, setBlackClockMs] = useState(600_000);
  const [error, setError] = useState("");

  const applySnapshot = useCallback((data: Snapshot) => {
    startTransition(() => {
      setSnap(data);
      setRemoteFen(data.fen);
      if (data.result) setRemoteResult(data.result);
      if (data.whiteClockMs != null) setWhiteClockMs(data.whiteClockMs);
      if (data.blackClockMs != null) setBlackClockMs(data.blackClockMs);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/games/${code}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          startTransition(() => setError(data.error ?? "Table missing"));
          return;
        }
        applySnapshot(data);
      } catch {
        if (!cancelled) {
          startTransition(() => setError("Could not load table"));
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [code, applySnapshot]);

  useEffect(() => {
    if (!snap?.you) return;

    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    let poll = 0;
    const myColor = snap.you;

    const refresh = async () => {
      const res = await fetch(`/api/games/${code}`);
      const data = await res.json();
      if (res.ok) applySnapshot(data);
    };

    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-game-${code}`);
      channel.bind("player.joined", () => void refresh());
      channel.bind(
        "move.made",
        (data: {
          fen: string;
          result?: string | null;
          whiteClockMs?: number;
          blackClockMs?: number;
        }) => {
          startTransition(() => {
            setRemoteFen(data.fen);
            if (data.result) setRemoteResult(data.result);
            if (data.whiteClockMs != null) setWhiteClockMs(data.whiteClockMs);
            if (data.blackClockMs != null) setBlackClockMs(data.blackClockMs);
          });
          void refresh();
        },
      );
      channel.bind("game.ended", (data: { result?: string }) => {
        if (data.result) {
          startTransition(() => setRemoteResult(data.result ?? null));
        }
        void refresh();
      });
      channel.bind(
        "rematch.ready",
        async (data: {
          newCode: string;
          claim: { w: string; b: string };
          mapping: { w: "b"; b: "w" };
        }) => {
          const newColor = data.mapping[myColor];
          const token = data.claim[newColor];
          await fetch(`/api/games/${data.newCode}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ color: newColor, token }),
          });
          router.push(`/game/${data.newCode}`);
        },
      );
      poll = window.setInterval(() => void refresh(), 12000);
    } catch {
      poll = window.setInterval(() => void refresh(), 3000);
    }

    return () => {
      if (poll) window.clearInterval(poll);
      if (channel) {
        channel.unbind_all();
        try {
          getPusherClient().unsubscribe(`private-game-${code}`);
        } catch {
          // ignore
        }
      }
    };
  }, [code, snap?.you, applySnapshot, router]);

  const onLocalMove = async (uci: string) => {
    const res = await fetch(`/api/games/${code}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uci }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Move failed");
    startTransition(() => {
      setRemoteFen(data.fen);
      if (data.result) setRemoteResult(data.result);
      if (data.whiteClockMs != null) setWhiteClockMs(data.whiteClockMs);
      if (data.blackClockMs != null) setBlackClockMs(data.blackClockMs);
    });
    return {
      whiteClockMs: data.whiteClockMs as number | undefined,
      blackClockMs: data.blackClockMs as number | undefined,
    };
  };

  const resign = async () => {
    await fetch(`/api/games/${code}/resign`, { method: "POST" });
    const res = await fetch(`/api/games/${code}`);
    const data = await res.json();
    if (res.ok) applySnapshot(data);
  };

  const rematch = async () => {
    const res = await fetch(`/api/games/${code}/rematch`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Rematch failed");
      return;
    }
    router.push(`/game/${data.code}`);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
  };

  if (error) {
    return (
      <main className="p-8">
        <p className="text-red-300">{error}</p>
        <Link href="/play">Back to lobby</Link>
      </main>
    );
  }

  if (!snap) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Setting the table…
      </main>
    );
  }

  if (!snap.you) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Table {code}
        </h1>
        <p className="text-[var(--mist)]">
          You don&apos;t have a seat for this table. Join from the lobby with the code.
        </p>
        <Link href="/play" className="btn-primary inline-block">
          Lobby
        </Link>
      </main>
    );
  }

  const opponentName = snap.you === "w" ? snap.blackName : snap.whiteName;

  return (
    <main className="min-h-screen pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <button type="button" className="chip" onClick={() => void copyCode()}>
          Code {code} · Copy
        </button>
      </div>
      <GameShell
        mode="human"
        code={code}
        playerColor={snap.you}
        playerName={(snap.you === "w" ? snap.whiteName : snap.blackName) ?? "You"}
        opponentName={opponentName}
        initialFen={snap.fen}
        status={snap.status}
        onLocalMove={onLocalMove}
        remoteFen={remoteFen}
        remoteResult={remoteResult}
        whiteClockMs={whiteClockMs}
        blackClockMs={blackClockMs}
        onRematch={() => void rematch()}
        onResign={() => void resign()}
      />
    </main>
  );
}
