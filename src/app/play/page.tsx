"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { useFriendsFeed } from "@/hooks/useFriendsFeed";
import { AI_RIVALS, type AiLevel } from "@/lib/chess/engine";
import { playSound } from "@/lib/chess/sound";
import {
  TIME_CONTROLS,
  getPreferredTimeControl,
  getRecentTables,
  setPreferredTimeControl,
  type TimeControlId,
} from "@/lib/names";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Step = "modes" | "human" | "ai" | "invite";

function PlayPageInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const joinParam = search.get("join")?.replace(/\D/g, "").slice(0, 8) ?? "";

  const { friends, invites, incoming, refresh } = useFriendsFeed();
  const [step, setStep] = useState<Step>(joinParam ? "human" : "modes");
  const [code, setCode] = useState(joinParam);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [timeControl, setTimeControl] = useState<TimeControlId>("10|0");
  const [recent, setRecent] = useState<{ code: string; opponent: string }[]>([]);
  const [inviteFriendId, setInviteFriendId] = useState<string | null>(null);

  useEffect(() => {
    setTimeControl(getPreferredTimeControl());
    setRecent(getRecentTables());
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent("/play" + (joinParam ? `?join=${joinParam}` : ""))}`);
    }
  }, [authLoading, user, router, joinParam]);

  const createGame = async (friendId?: string | null) => {
    setBusy(true);
    setError("");
    setPreferredTimeControl(timeControl);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeControl,
          inviteFriendId: friendId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open a table");
    } finally {
      setBusy(false);
    }
  };

  const joinGame = async (joinCode = code) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.replace(/\D/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async (inviteId: string) => {
    const res = await fetch(`/api/friends/invite/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not join");
      return;
    }
    playSound("start");
    router.push(`/game/${data.code}`);
  };

  if (authLoading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Checking account…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Atelier
        </Link>
        <UserChip />
      </div>

      {(invites.length > 0 || incoming.length > 0) && step === "modes" && (
        <section className="panel mb-4 space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-sm">
              <span>
                Invite from {inv.from?.avatar} {inv.from?.username}
              </span>
              <button
                type="button"
                className="chip"
                onClick={() => void acceptInvite(inv.id)}
              >
                Join
              </button>
            </div>
          ))}
          {incoming.length > 0 && (
            <Link href="/friends" className="block text-sm text-[var(--brass)]">
              {incoming.length} friend request{incoming.length > 1 ? "s" : ""} →
            </Link>
          )}
        </section>
      )}

      {step === "modes" && (
        <section className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            Choose a mode
          </h1>
          <p className="mb-2 text-[var(--mist)]">
            {user.username} · Elo {user.elo}
          </p>
          <button
            type="button"
            className="mode-card"
            onClick={() => {
              playSound("click");
              setStep("human");
            }}
          >
            <h3>Human</h3>
            <p>Create a table, join a code, or invite a friend.</p>
          </button>
          <button
            type="button"
            className="mode-card"
            onClick={() => {
              playSound("click");
              setStep("ai");
            }}
          >
            <h3>AI</h3>
            <p>Easy, Medium, or Hard — powered by Garbochess.</p>
          </button>
          <button
            type="button"
            className="mode-card"
            onClick={() => {
              playSound("click");
              router.push("/friends");
            }}
          >
            <h3>Friends</h3>
            <p>
              {friends.length} friend{friends.length === 1 ? "" : "s"}
              {invites.length ? ` · ${invites.length} invite${invites.length > 1 ? "s" : ""}` : ""}
            </p>
          </button>
          <button
            type="button"
            className="mode-card"
            onClick={() => {
              playSound("click");
              router.push("/puzzle");
            }}
          >
            <h3>Puzzles</h3>
            <p>Daily puzzle or rush.</p>
          </button>
          {recent.length > 0 && (
            <div className="panel mt-2">
              <h2 className="panel-title">Recent tables</h2>
              <ul className="space-y-1 text-sm">
                {recent.map((t) => (
                  <li key={t.code}>
                    <button
                      type="button"
                      className="text-[var(--brass)] hover:underline"
                      onClick={() => {
                        setCode(t.code);
                        setStep("human");
                      }}
                    >
                      {t.code} · {t.opponent}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link href="/how-to" className="block text-center text-sm text-[var(--mist)]">
            How to play
          </Link>
        </section>
      )}

      {step === "human" && (
        <section className="space-y-4">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Human</h1>
          <label className="block text-sm text-[var(--mist)]">
            Time control
            <select
              className="field mt-1"
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value as TimeControlId)}
            >
              {(Object.keys(TIME_CONTROLS) as TimeControlId[]).map((id) => (
                <option key={id} value={id}>
                  {TIME_CONTROLS[id].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void createGame(null)}
          >
            {busy ? "Creating…" : "Create table"}
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy || friends.length === 0}
            onClick={() => {
              playSound("click");
              setStep("invite");
              void refresh();
            }}
          >
            Invite a friend…
          </button>
          <div className="relative py-2 text-center text-xs uppercase tracking-widest text-[var(--mist)]">
            or join
          </div>
          <input
            className="field tracking-[0.35em]"
            inputMode="numeric"
            placeholder="12345678"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy || code.length !== 8}
            onClick={() => void joinGame()}
          >
            Enter code
          </button>
          {code.length === 8 && (
            <Link
              href={`/game/${code}?spectate=1`}
              className="block text-center text-sm text-[var(--brass)]"
            >
              Spectate this table
            </Link>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="button" className="btn-ghost" onClick={() => setStep("modes")}>
            Back
          </button>
        </section>
      )}

      {step === "invite" && (
        <section className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            Invite friend
          </h1>
          <p className="text-sm text-[var(--mist)]">
            Opens a table and sends them an invite ({TIME_CONTROLS[timeControl].label}).
          </p>
          {friends.length === 0 && (
            <p className="text-sm text-[var(--mist)]">
              No friends yet.{" "}
              <Link href="/friends" className="text-[var(--brass)]">
                Add some
              </Link>
            </p>
          )}
          {friends.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`mode-card text-left ${inviteFriendId === f.id ? "ring-1 ring-[var(--brass)]" : ""}`}
              disabled={busy}
              onClick={() => {
                setInviteFriendId(f.id);
                void createGame(f.id);
              }}
            >
              <h3>
                {f.avatar} {f.username}
              </h3>
              <p>Elo {f.elo} · Challenge</p>
            </button>
          ))}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="button" className="btn-ghost" onClick={() => setStep("human")}>
            Back
          </button>
        </section>
      )}

      {step === "ai" && (
        <section className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">AI difficulty</h1>
          {(Object.keys(AI_RIVALS) as AiLevel[]).map((level) => {
            const r = AI_RIVALS[level];
            return (
              <button
                key={level}
                type="button"
                className="mode-card"
                onClick={() => {
                  playSound("click");
                  router.push(`/ai/${level}`);
                }}
              >
                <h3>
                  {r.title} — {r.name}
                </h3>
                <p>{r.blurb}</p>
              </button>
            );
          })}
          <button type="button" className="btn-ghost" onClick={() => setStep("modes")}>
            Back
          </button>
        </section>
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Loading…
        </main>
      }
    >
      <PlayPageInner />
    </Suspense>
  );
}
