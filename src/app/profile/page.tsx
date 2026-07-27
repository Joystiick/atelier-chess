"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { AVATARS, avatarEmoji, type AvatarId } from "@/lib/auth/avatars";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { user, loading, refresh, logout } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>("knight-brass");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (user) {
      setUsername(user.username);
      setAvatarId(user.avatarId as AvatarId);
    }
  }, [user, loading, router]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, avatarId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg("Saved");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Atelier
        </Link>
        <button
          type="button"
          className="chip"
          onClick={() => {
            void logout().then(() => router.push("/"));
          }}
        >
          Sign out
        </button>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-5xl" aria-hidden>
          {avatarEmoji(avatarId)}
        </span>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">{user.username}</h1>
          <p className="text-[var(--brass)]">Elo {user.elo}</p>
          <p className="text-sm text-[var(--mist)]">
            {user.gamesPlayed} games · {user.email}
          </p>
          <Link
            href={`/challenge/${encodeURIComponent(user.username)}`}
            className="mt-2 inline-block text-sm text-[var(--brass)]"
          >
            Challenge card →
          </Link>
        </div>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="panel-title">Edit profile</h2>
        <input
          className="field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
        <div className="grid grid-cols-4 gap-2">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`rounded-lg p-3 text-2xl ring-1 ${
                avatarId === a.id
                  ? "bg-[var(--panel)] ring-[var(--brass)]"
                  : "ring-white/10"
              }`}
              onClick={() => setAvatarId(a.id)}
              title={a.label}
            >
              {a.emoji}
            </button>
          ))}
        </div>
        {msg && <p className="text-sm text-[var(--cream)]">{msg}</p>}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
        <Link href="/play" className="btn-ghost block w-full text-center">
          Play
        </Link>
      </section>
    </main>
  );
}
