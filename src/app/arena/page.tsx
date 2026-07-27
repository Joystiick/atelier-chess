"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { getPusherClient } from "@/lib/pusher/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ArenaRow = {
  id: string;
  name: string;
  status: string;
  timeControl: string;
  startsAt: string;
  endsAt: string;
};

type Standing = {
  userId: string;
  username: string;
  elo: number;
  score: number;
  gamesPlayed: number;
  waiting: boolean;
};

export default function ArenaPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<ArenaRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [arenaMeta, setArenaMeta] = useState<ArenaRow | null>(null);
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [timeControl, setTimeControl] = useState<TimeControlId>("3|2");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/arenas");
    const data = await res.json();
    if (res.ok) setList(data.arenas ?? []);
  }, []);

  const loadArena = useCallback(async (id: string) => {
    const res = await fetch(`/api/arenas/${id}`);
    const data = await res.json();
    if (!res.ok) return;
    setArenaMeta(data.arena);
    setStandings(data.standings ?? []);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/arena");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    void loadList();
  }, [user, loadList]);

  useEffect(() => {
    if (!selected) return;
    void loadArena(selected);
    const id = window.setInterval(() => void loadArena(selected), 8000);
    return () => window.clearInterval(id);
  }, [selected, loadArena]);

  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<ReturnType<typeof getPusherClient>["subscribe"]> | null =
      null;
    try {
      const pusher = getPusherClient();
      channel = pusher.subscribe(`private-user-${user.id}`);
      channel.bind("arena.pair", (payload: { code?: string }) => {
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
      // ignore
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

  const create = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/arenas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minutes, timeControl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setName("");
      await loadList();
      setSelected(data.arena.id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create");
    } finally {
      setBusy(false);
    }
  };

  const join = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/arenas/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSelected(id);
      setMsg("Joined — waiting for pair.");
      await loadArena(id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  const pair = async () => {
    if (!selected) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/arenas/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg(`Paired ${data.paired ?? 0} game(s).`);
      await loadArena(selected);
      const mine = (data.pairs as { code: string; white: string; black: string }[] | undefined)?.find(
        (p) => p.white === user?.username || p.black === user?.username,
      );
      if (mine) {
        playSound("start");
        router.push(`/game/${mine.code}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not pair");
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

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Arena</h1>
      <p className="mt-1 text-[var(--mist)]">Join a Swiss-style burst of games.</p>

      <section className="panel mt-6 space-y-2">
        <h2 className="panel-title">Create arena</h2>
        <input
          className="field w-full"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="field w-24"
            type="number"
            min={5}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
          <select
            className="field flex-1"
            value={timeControl}
            onChange={(e) => setTimeControl(e.target.value as TimeControlId)}
          >
            {(Object.keys(TIME_CONTROLS) as TimeControlId[])
              .filter((id) => id !== "∞")
              .map((id) => (
                <option key={id} value={id}>
                  {TIME_CONTROLS[id].label}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={busy || !name.trim()}
          onClick={() => void create()}
        >
          Create
        </button>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="panel-title">Open arenas</h2>
        {list.length === 0 && (
          <p className="text-sm text-[var(--mist)]">None right now — create one.</p>
        )}
        {list.map((a) => (
          <div
            key={a.id}
            className={`flex items-center justify-between gap-2 rounded-lg bg-[var(--panel)] px-3 py-2 ${selected === a.id ? "ring-1 ring-[var(--brass)]" : ""}`}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setSelected(a.id)}
            >
              <p className="truncate text-[var(--cream)]">{a.name}</p>
              <p className="text-xs text-[var(--mist)]">
                {a.status} · {a.timeControl}
              </p>
            </button>
            <button
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void join(a.id)}
            >
              Join
            </button>
          </div>
        ))}
      </section>

      {selected && arenaMeta && (
        <section className="panel mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="panel-title">{arenaMeta.name}</h2>
            <button
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void pair()}
            >
              Pair waiting
            </button>
          </div>
          {standings.length === 0 && (
            <p className="text-sm text-[var(--mist)]">No players yet.</p>
          )}
          {standings.map((s, i) => (
            <div
              key={s.userId}
              className="flex justify-between text-sm text-[var(--cream)]"
            >
              <span>
                {i + 1}. {s.username}
                {s.waiting ? " · waiting" : ""}
              </span>
              <span className="text-[var(--brass)]">
                {s.score} pts · {s.gamesPlayed}g
              </span>
            </div>
          ))}
        </section>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--brass)]">{msg}</p>}
    </main>
  );
}
