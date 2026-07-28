"use client";

import { LoadingStatus } from "@/components/ui/LoadingStatus";
import { AVATARS, type AvatarId } from "@/lib/auth/avatars";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function RegisterInner() {
  const search = useSearchParams();
  const next = search.get("next") || "/download";
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>("knight-brass");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, avatarId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      const dest = next.startsWith("/") ? next : "/download";
      window.location.href = dest;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not register");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link
        href="/"
        className="mb-8 font-[family-name:var(--font-display)] text-2xl text-[var(--brass)] hover:text-[var(--cream)]"
      >
        Atelier Chess
      </Link>
      <div className="panel space-y-4 p-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Create account</h1>
        <p className="text-sm text-[var(--mist)]">
          Required to play — Elo, friends, and invites.
        </p>
        <input
          className="field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="field"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="field"
          type="password"
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div>
          <p className="mb-2 text-sm text-[var(--mist)]">Avatar</p>
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
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-[var(--mist)]">
          Already have one?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-[var(--brass)]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingStatus message="Opening the salon…" />}>
      <RegisterInner />
    </Suspense>
  );
}
