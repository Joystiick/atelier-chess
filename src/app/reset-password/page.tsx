"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetInner() {
  const search = useSearchParams();
  const router = useRouter();
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/login" className="mb-6 text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Sign in
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-4xl">New password</h1>
      {!token ? (
        <p className="mt-4 text-red-300">Missing reset token.</p>
      ) : (
        <div className="mt-6 space-y-3">
          <input
            className="field"
            type="password"
            placeholder="New password (8+)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </div>
      )}
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Loading…
        </main>
      }
    >
      <ResetInner />
    </Suspense>
  );
}
