"use client";

import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
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
      window.location.href = "/profile";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Atelier
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-4xl">Sign in</h1>
      <div className="mt-6 space-y-3">
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
          <Link href="/register" className="text-[var(--brass)]">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
