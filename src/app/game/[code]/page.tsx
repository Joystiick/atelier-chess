"use client";

import { GameShell } from "@/components/game/GameShell";
import { startVisibilityAwareInterval } from "@/lib/poll";
import { getPusherClient } from "@/lib/pusher/client";
import { pushRecentTable, setLastOpponent } from "@/lib/names";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, startTransition, useCallback, useEffect, useState } from "react";

/** Backup intervals — realtime is Pusher; shorter only when Pusher fails. */
const POLL_WITH_PUSHER_MS = 30_000;
const POLL_FALLBACK_MS = 5_000;
const POLL_SPECTATOR_MS = 5_000;
/** LAN party: still cloud-backed, but prefer sparse polls when Pusher is live. */
const POLL_LAN_WITH_PUSHER_MS = 60_000;
const POLL_LAN_FALLBACK_MS = 8_000;

type Snapshot = {
  code: string;
  status: "waiting" | "active" | "finished" | "abandoned";
  fen: string;
  pgn?: string;
  whiteName: string | null;
  blackName: string | null;
  you: "w" | "b" | null;
  spectator?: boolean;
  result: string | null;
  whiteClockMs?: number;
  blackClockMs?: number;
  timeControlMs?: number;
  drawOfferBy?: string | null;
  takebackOfferBy?: string | null;
  joinTicket?: string | null;
  blindfoldCafe?: boolean;
  tablecast?: boolean;
  spectatorCount?: number;
  ghostLeague?: boolean;
  lanMode?: boolean;
};

function GamePageInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const wantSpectate = search.get("spectate") === "1";
  const router = useRouter();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [remoteFen, setRemoteFen] = useState<string | null>(null);
  const [remoteResult, setRemoteResult] = useState<string | null>(null);
  const [whiteClockMs, setWhiteClockMs] = useState(600_000);
  const [blackClockMs, setBlackClockMs] = useState(600_000);
  const [drawOfferBy, setDrawOfferBy] = useState<string | null>(null);
  const [takebackOfferBy, setTakebackOfferBy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [forceSpectate, setForceSpectate] = useState(wantSpectate);
  const [tablecast, setTablecast] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [phoneController, setPhoneController] = useState(false);
  const [ghostLeague, setGhostLeague] = useState(false);
  const [lanMode, setLanMode] = useState(false);

  const applySnapshot = useCallback((data: Snapshot) => {
    startTransition(() => {
      setSnap(data);
      setRemoteFen(data.fen);
      if (data.result) setRemoteResult(data.result);
      if (data.whiteClockMs != null) setWhiteClockMs(data.whiteClockMs);
      if (data.blackClockMs != null) setBlackClockMs(data.blackClockMs);
      setDrawOfferBy(data.drawOfferBy ?? null);
      setTakebackOfferBy(data.takebackOfferBy ?? null);
      setTablecast(Boolean(data.tablecast));
      setGhostLeague(Boolean(data.ghostLeague));
      setLanMode(Boolean(data.lanMode));
      if (typeof data.spectatorCount === "number") {
        setSpectatorCount(data.spectatorCount);
      }
    });
  }, []);

  useEffect(() => {
    const narrow =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;
    const desktopUa =
      /\bElectron\//i.test(navigator.userAgent) ||
      /\bAtelierDesktop\//i.test(navigator.userAgent);
    setPhoneController(narrow && !desktopUa);
  }, []);

  useEffect(() => {
    if (!snap?.you || !tablecast) return;
    const surface = phoneController ? "phone" : "desktop";
    void fetch(`/api/games/${code}/tablecast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seat_surface", surface }),
    });
  }, [code, snap?.you, tablecast, phoneController]);

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
        if (data.you && data.blackName && data.whiteName) {
          const opp = data.you === "w" ? data.blackName : data.whiteName;
          if (opp) {
            pushRecentTable(code, opp);
            setLastOpponent(opp);
          }
        }
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
    if (!snap) return;
    const isPlayer = Boolean(snap.you) && !forceSpectate;
    // Spectators poll; seated players use Pusher + poll

    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    let stopPoll: (() => void) | null = null;
    const myColor = snap.you;

    const refresh = async () => {
      const res = await fetch(`/api/games/${code}`);
      const data = await res.json();
      if (res.ok) applySnapshot(data);
    };

    if (isPlayer && myColor) {
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
        channel.bind("draw.offered", () => void refresh());
        channel.bind("draw.declined", () => void refresh());
        channel.bind("takeback.offered", () => void refresh());
        channel.bind("takeback.declined", () => void refresh());
        channel.bind("takeback.accepted", (data: { fen?: string }) => {
          if (data.fen) {
            startTransition(() => setRemoteFen(data.fen!));
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
        channel.bind("tablecast.opened", () => {
          startTransition(() => setTablecast(true));
        });
        channel.bind(
          "tablecast.spectator_count",
          (data: { count?: number }) => {
            if (typeof data.count === "number") {
              startTransition(() => setSpectatorCount(data.count!));
            }
          },
        );
        stopPoll = startVisibilityAwareInterval(
          () => void refresh(),
          lanMode ? POLL_LAN_WITH_PUSHER_MS : POLL_WITH_PUSHER_MS,
        );
      } catch {
        stopPoll = startVisibilityAwareInterval(
          () => void refresh(),
          lanMode ? POLL_LAN_FALLBACK_MS : POLL_FALLBACK_MS,
        );
      }
    } else {
      // Gallery / force-spectate — Pusher after spectator auth fix
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
        channel.bind("tablecast.opened", () => {
          startTransition(() => setTablecast(true));
        });
        channel.bind(
          "tablecast.spectator_count",
          (data: { count?: number }) => {
            if (typeof data.count === "number") {
              startTransition(() => setSpectatorCount(data.count!));
            }
          },
        );
        stopPoll = startVisibilityAwareInterval(
          () => void refresh(),
          lanMode ? POLL_LAN_WITH_PUSHER_MS : POLL_WITH_PUSHER_MS,
        );
      } catch {
        stopPoll = startVisibilityAwareInterval(
          () => void refresh(),
          lanMode ? POLL_LAN_FALLBACK_MS : POLL_SPECTATOR_MS,
        );
      }
    }

    return () => {
      stopPoll?.();
      if (channel) {
        channel.unbind_all();
        try {
          getPusherClient().unsubscribe(`private-game-${code}`);
        } catch {
          // ignore
        }
      }
    };
  }, [code, snap?.you, forceSpectate, applySnapshot, router, snap, lanMode]);

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

  const ghostRematch = async () => {
    const res = await fetch(`/api/games/${code}/rematch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ghost: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Ghost rematch failed");
      return null;
    }
    return {
      code: data.code as string,
      joinTicket: data.joinTicket as string,
    };
  };

  const onAction = async (
    action:
      | "offer-draw"
      | "accept-draw"
      | "decline-draw"
      | "offer-takeback"
      | "accept-takeback"
      | "decline-takeback"
      | "abort",
  ) => {
    const res = await fetch(`/api/games/${code}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Action failed");
      return;
    }
    if (action === "abort") {
      router.push("/play");
      return;
    }
    const refresh = await fetch(`/api/games/${code}`);
    const snapData = await refresh.json();
    if (refresh.ok) applySnapshot(snapData);
    if (data.fen) {
      startTransition(() => setRemoteFen(data.fen));
    }
    if (data.result) {
      startTransition(() => setRemoteResult(data.result));
    }
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

  const isSpectator = forceSpectate || !snap.you;

  if (!snap.you && !forceSpectate && snap.status === "waiting") {
    return (
      <main className="mx-auto max-w-md space-y-4 p-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Table {code}
        </h1>
        <p className="text-[var(--mist)]">
          Join from the lobby with this code, or watch as a spectator.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/play?join=${code}`} className="btn-primary inline-block text-center">
            Join as player
          </Link>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setForceSpectate(true)}
          >
            Spectate
          </button>
          <Link href="/play" className="btn-ghost text-center">
            Lobby
          </Link>
        </div>
      </main>
    );
  }

  const seat = snap.you ?? "w";
  const opponentName =
    isSpectator
      ? `${snap.whiteName ?? "White"} vs ${snap.blackName ?? "Black"}`
      : seat === "w"
        ? snap.blackName
        : snap.whiteName;

  return (
    <main className="min-h-screen pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <div className="flex gap-2">
          {isSpectator && (
            <span className="chip opacity-80">Spectating</span>
          )}
          <button type="button" className="chip" onClick={() => void copyCode()}>
            Code {code} · Copy
          </button>
        </div>
      </div>
      <GameShell
        mode="human"
        code={code}
        playerColor={seat}
        playerName={
          isSpectator
            ? "Spectator"
            : (seat === "w" ? snap.whiteName : snap.blackName) ?? "You"
        }
        opponentName={opponentName}
        initialFen={snap.fen}
        status={snap.status}
        spectator={isSpectator}
        drawOfferBy={drawOfferBy}
        takebackOfferBy={takebackOfferBy}
        onLocalMove={isSpectator ? undefined : onLocalMove}
        remoteFen={remoteFen}
        remoteResult={remoteResult}
        whiteClockMs={whiteClockMs}
        blackClockMs={blackClockMs}
        timeControlMs={snap.timeControlMs}
        onRematch={isSpectator ? undefined : () => void rematch()}
        onGhostRematch={isSpectator ? undefined : ghostRematch}
        onResign={isSpectator ? undefined : () => void resign()}
        onAction={isSpectator ? undefined : (a) => onAction(a)}
        joinTicket={snap.joinTicket}
        blindfoldCafe={snap.blindfoldCafe}
        tablecast={tablecast}
        spectatorCount={spectatorCount}
        ghostLeague={ghostLeague}
        lanMode={lanMode}
        phoneController={phoneController && tablecast && !isSpectator}
        onTablecastChange={setTablecast}
      />
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Setting the table…
        </main>
      }
    >
      <GamePageInner />
    </Suspense>
  );
}
