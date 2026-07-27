"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { LoadingStatus } from "@/components/ui/LoadingStatus";
import { useFriendsFeed, type FriendUser } from "@/hooks/useFriendsFeed";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { friends, incoming, outgoing, invites, loading, refresh } =
    useFriendsFeed();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendUser[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (authLoading) {
    return <LoadingStatus message="Checking account…" />;
  }
  if (!user) {
    router.replace("/login?next=/friends");
    return null;
  }

  const search = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.users ?? []);
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async (username: string) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("click");
      setMsg(
        data.status === "accepted"
          ? `You and ${username} are now friends`
          : `Request sent to ${username}`,
      );
      setResults([]);
      setQuery("");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send request");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (friendshipId: string, action: "accept" | "decline") => {
    const res = await fetch(`/api/friends/${friendshipId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      playSound("click");
      await refresh();
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!confirm("Remove this friend?")) return;
    await fetch(`/api/friends/${friendId}`, { method: "DELETE" });
    await refresh();
  };

  const acceptInvite = async (inviteId: string) => {
    const res = await fetch(`/api/friends/invite/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not join");
      return;
    }
    playSound("start");
    router.push(`/game/${data.code}`);
  };

  const declineInvite = async (inviteId: string) => {
    await fetch(`/api/friends/invite/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    await refresh();
  };

  const challenge = async (friendId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: "10|0", inviteFriendId: friendId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not challenge");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Friends</h1>
      <p className="mt-1 text-[var(--mist)]">
        Add players, accept requests, challenge to a table.
      </p>

      {invites.length > 0 && (
        <section className="panel mt-6 space-y-2">
          <h2 className="panel-title">Game invites</h2>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                {inv.from?.avatar} {inv.from?.username ?? "Someone"} · table{" "}
                {inv.code}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="chip"
                  onClick={() => void acceptInvite(inv.id)}
                >
                  Join
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => void declineInvite(inv.id)}
                >
                  Decline
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      {incoming.length > 0 && (
        <section className="panel mt-4 space-y-2">
          <h2 className="panel-title">Friend requests</h2>
          {incoming.map((r) => (
            <div
              key={r.friendshipId}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                {r.user.avatar} {r.user.username} · {r.user.elo}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="chip"
                  onClick={() => void respond(r.friendshipId, "accept")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => void respond(r.friendshipId, "decline")}
                >
                  Decline
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6 space-y-2">
        <h2 className="panel-title">Add friend</h2>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            placeholder="Username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void search();
            }}
          />
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || query.length < 2}
            onClick={() => void search()}
          >
            Search
          </button>
        </div>
        {results.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-3 py-2 text-sm"
          >
            <span>
              {u.avatar} {u.username} · {u.elo}
            </span>
            <button
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void sendRequest(u.username)}
            >
              Add
            </button>
          </div>
        ))}
      </section>

      {msg && <p className="mt-3 text-sm text-[var(--brass)]">{msg}</p>}

      <section className="mt-8 space-y-2">
        <h2 className="panel-title">
          Your friends {loading ? "" : `(${friends.length})`}
        </h2>
        {friends.length === 0 && !loading && (
          <div className="panel space-y-3 text-center">
            <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
              Your circle is empty
            </p>
            <p className="text-sm text-[var(--mist)]">
              Search a username above to send a friend request — then challenge them to a table.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>(
                  'input[placeholder="Username"]',
                );
                el?.focus();
              }}
            >
              Search a username
            </button>
          </div>
        )}
        {friends.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"
          >
            <div>
              <p className="text-[var(--cream)]">
                {f.avatar} {f.username}
              </p>
              <p className="text-xs text-[var(--mist)]">
                Elo {f.elo}
                {f.presence ? ` · ${f.presence}` : ""}
              </p>
            </div>
            <div className="flex gap-1">
              {f.spectateHref && (
                <Link href={f.spectateHref} className="chip">
                  Spectate
                </Link>
              )}
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => void challenge(f.id)}
              >
                Challenge
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => void removeFriend(f.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </section>

      {outgoing.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="panel-title">Outgoing</h2>
          {outgoing.map((r) => (
            <p key={r.friendshipId} className="text-sm text-[var(--mist)]">
              Waiting on {r.user.avatar} {r.user.username}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
