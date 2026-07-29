"use client";

import { TableQr } from "@/components/game/TableQr";
import { startVisibilityAwareInterval } from "@/lib/poll";
import type { SalonWindowStatus } from "@/lib/salon/themes";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const SALON_POLL_MS = 8_000;

type QueueRow = {
  id: string;
  position: number;
  username: string;
  userId?: string;
  me?: boolean;
};

type PairResult = {
  code: string;
  white: { username: string; seatPath: string };
  black: { username: string; seatPath: string };
};

function formatWhen(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function windowCopy(
  window: SalonWindowStatus,
  startsAt?: string | null,
  endsAt?: string | null,
) {
  if (window === "opens_at") {
    const when = formatWhen(startsAt);
    return when ? `Opens at ${when}` : "Opens soon";
  }
  if (window === "closed") {
    const when = formatWhen(endsAt);
    return when ? `Closed ┬À ended ${when}` : "Closed";
  }
  return "Lobby open";
}

export default function SalonNightPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [name, setName] = useState("");
  const [status, setStatus] = useState("open");
  const [themeLabel, setThemeLabel] = useState("Salon");
  const [windowStatus, setWindowStatus] = useState<SalonWindowStatus>("open");
  const [accepting, setAccepting] = useState(true);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [pair, setPair] = useState<PairResult | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const lobbyUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://atelierchess.netlify.app/salon/${slug}`;
    return `${window.location.origin}/salon/${slug}`;
  }, [slug]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/salon/${slug}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Not found");
      return;
    }
    setName(data.night.name);
    setStatus(data.night.status);
    setThemeLabel(data.night.themeLabel ?? "Salon");
    setWindowStatus(data.night.window ?? "open");
    setAccepting(Boolean(data.night.accepting));
    setStartsAt(data.night.startsAt ?? null);
    setEndsAt(data.night.endsAt ?? null);
    setIsHost(data.night.isHost);
    setInQueue(data.inQueue);
    setQueue(data.queue ?? []);
  }, [slug]);

  useEffect(() => {
    void load();
    return startVisibilityAwareInterval(() => void load(), SALON_POLL_MS);
  }, [load]);

  const act = async (action: string, extra?: Record<string, string>) => {
    setMsg("");
    const res = await fetch(`/api/salon/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    if (action === "pair") {
      setPair(data as PairResult);
      setPicked([]);
    }
    await load();
  };

  const togglePick = (userId: string) => {
    setPicked((prev) => {
      if (prev.includes(userId)) return prev.filter((x) => x !== userId);
      if (prev.length >= 2) return [prev[1]!, userId];
      return [...prev, userId];
    });
  };

  if (error) {
    return (
      <main className="p-8">
        <p className="text-red-300">{error}</p>
        <Link href="/salon">Back</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
      {isHost ? (
        <Link href="/salon" className="text-sm text-[var(--mist)]">
          ÔåÉ Salon desk
        </Link>
      ) : (
        <p className="text-sm text-[var(--mist)]">Salon lobby</p>
      )}
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-4xl">
          {name || "Salon"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">{themeLabel}</span>
          <span className="text-sm text-[var(--mist)]">
            {windowCopy(windowStatus, startsAt, endsAt)} ┬À {queue.length} waiting
          </span>
        </div>
        {status === "open" && windowStatus === "opens_at" && startsAt && (
          <p className="text-xs text-[var(--mist)]">
            Queue opens {formatWhen(startsAt)}.
          </p>
        )}
      </div>

      {isHost && (
        <div className="panel space-y-3">
          <TableQr url={lobbyUrl} size={160} label="Guests scan to enter the lobby queue" />
          <p className="break-all text-[10px] text-[var(--mist)]">{lobbyUrl}</p>
        </div>
      )}

      {!isHost && accepting && (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => void act(inQueue ? "leave" : "join")}
        >
          {inQueue ? "Leave queue" : "Join lobby queue"}
        </button>
      )}

      {!isHost && !accepting && (
        <p className="panel text-sm text-[var(--mist)]">
          {windowStatus === "opens_at"
            ? "This night has not opened yet ÔÇö check back at the start time."
            : "This salon is closed. Ask the host for the next night."}
        </p>
      )}

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-[var(--mist)]">Queue</p>
        {queue.length === 0 && (
          <p className="text-sm text-[var(--mist)]">No one waiting yet.</p>
        )}
        {queue.map((q) => (
          <button
            key={q.id}
            type="button"
            disabled={!isHost || !q.userId || !accepting}
            className={`chip touch-target w-full text-left ${
              q.userId && picked.includes(q.userId) ? "ring-1 ring-[var(--brass)]" : ""
            }`}
            onClick={() => q.userId && togglePick(q.userId)}
          >
            #{q.position} {q.username}
            {q.me ? " (you)" : ""}
          </button>
        ))}
      </section>

      {isHost && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={picked.length !== 2 || !accepting}
            onClick={() =>
              void act("pair", { a: picked[0]!, b: picked[1]! })
            }
          >
            Pair selected ({picked.length}/2)
          </button>
          {!accepting && (
            <p className="text-xs text-[var(--mist)]">
              Pairing is paused outside the night window.
            </p>
          )}
          <button type="button" className="btn-ghost" onClick={() => void act("close")}>
            Close salon
          </button>
        </div>
      )}

      {pair && (
        <section className="panel space-y-4">
          <p className="text-sm text-[var(--brass)]">Table {pair.code} ready</p>
          <div>
            <p className="mb-2 text-xs text-[var(--mist)]">
              White ┬À {pair.white.username}
            </p>
            <TableQr
              url={
                typeof window !== "undefined"
                  ? `${window.location.origin}${pair.white.seatPath}`
                  : pair.white.seatPath
              }
              size={140}
              label="White seat QR"
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-[var(--mist)]">
              Black ┬À {pair.black.username}
            </p>
            <TableQr
              url={
                typeof window !== "undefined"
                  ? `${window.location.origin}${pair.black.seatPath}`
                  : pair.black.seatPath
              }
              size={140}
              label="Black seat QR"
            />
          </div>
        </section>
      )}

      {msg && <p className="text-sm text-[var(--brass)]">{msg}</p>}
    </main>
  );
}
