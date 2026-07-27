"use client";

import { LoadingStatus } from "@/components/ui/LoadingStatus";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginInner() {
  const search = useSearchParams();
  const next = search.get("next") || "/play";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("click");
      const dest = next.startsWith("/") ? next : "/play";
      window.location.href = dest;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
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
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Sign in</h1>
        <p className="text-sm text-[var(--mist)]">An account is required to play.</p>
        <input
          className="field"
          placeholder="Email or username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[var(--mist)]">
          <Link href="/forgot-password" className="text-[var(--brass)]">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-[var(--mist)]">
          New here?{" "}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="text-[var(--brass)]"
          >
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingStatus message="Opening the salon…" />}>
      <LoginInner />
    </Suspense>
  );
}
