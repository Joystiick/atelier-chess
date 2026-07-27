"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import {
  TIME_CONTROLS,
  getPreferredTimeControl,
  setPreferredTimeControl,
  type TimeControlId,
} from "@/lib/names";
import { getPusherClient } from "@/lib/pusher/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const RANKED_TCS = (Object.keys(TIME_CONTROLS) as TimeControlId[]).filter(
  (id) => id !== "∞",
);

export default function RankedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [timeControl, setTimeControl] = useState<TimeControlId>("10|0");
  const [queued, setQueued] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const poll = useCallback(async () => {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (!res.ok) return;
    if (data.matched && data.code) {
      await fetch("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.code }),
      });
      playSound("start");
      router.push(`/game/${data.code}`);
      return;
    }
    setQueued(Boolean(data.queued));
  }, [router]);

  useEffect(() => {
    setTimeControl(getPreferredTimeControl() === "∞" ? "10|0" : getPreferredTimeControl());
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/ranked");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => window.clearInterval(id);
  }, [user, poll]);

  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-user-${user.id}`);
      channel.bind("queue.match", (payload: { code?: string }) => {
        if (!payload?.code) return;
        void (async () => {
          await fetch("/api/games/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: payload.code }),
          });
          playSound("start");
          router.push(`/game/${payload.code}`);
        })();
      });
    } catch {
      // polling covers it
    }
    return () => {
      if (channel) {
        channel.unbind_all();
        try {
          getPusherClient().unsubscribe(`private-user-${user.id}`);
        } catch {
          // ignore
        }
      }
    };
  }, [user, router]);

  const join = async () => {
    setBusy(true);
    setMsg("");
    setPreferredTimeControl(timeControl);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (data.matched && data.code) {
        playSound("start");
        router.push(`/game/${data.code}`);
        return;
      }
      setQueued(true);
      setMsg("Searching for an opponent…");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join queue");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await fetch("/api/queue", { method: "DELETE" });
      setQueued(false);
      setMsg("Left the queue.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Ranked</h1>
      <p className="mt-1 text-[var(--mist)]">
        Match within ±200 Elo · your rating {user.elo}
      </p>

      <section className="panel mt-6 space-y-3">
        <h2 className="panel-title">Time control</h2>
        <div className="flex flex-wrap gap-2">
          {RANKED_TCS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${timeControl === id ? "ring-1 ring-[var(--brass)]" : ""}`}
              disabled={queued}
              onClick={() => setTimeControl(id)}
            >
              {TIME_CONTROLS[id].label}
            </button>
          ))}
        </div>

        {!queued ? (
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy}
            onClick={() => void join()}
          >
            Find match
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy}
            onClick={() => void leave()}
          >
            Leave queue
          </button>
        )}

        {queued && (
          <p className="animate-pulse text-center text-sm text-[var(--brass)]">
            Waiting in queue…
          </p>
        )}
        {msg && <p className="text-sm text-[var(--mist)]">{msg}</p>}
      </section>
    </main>
  );
}
