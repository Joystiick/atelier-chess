"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function JoinInner() {
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestName, setGuestName] = useState("");

  const claim = async (opts: { asGuest?: boolean; guestName?: string }) => {
    if (!token) {
      setError("Missing slot token");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/kiosk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          asGuest: opts.asGuest,
          guestName: opts.guestName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not claim slot");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Kiosk</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">You’re in</h1>
        <p className="text-[var(--cream)]">
          Look at the tablet for your seat QR when both players are ready.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Kiosk</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Walk-up slot</h1>
      <p className="text-sm text-[var(--mist)]">
        Café & library seats — claim with an account or as a guest.
      </p>

      {!loading && user && (
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy || !token}
          onClick={() => void claim({})}
        >
          {busy ? "Claiming…" : `Claim as ${user.username}`}
        </button>
      )}

      <div className="panel w-full space-y-2 text-left">
        <p className="panel-title">Guest seat</p>
        <input
          className="field w-full"
          placeholder="Display name"
          value={guestName}
          maxLength={20}
          onChange={(e) => setGuestName(e.target.value)}
        />
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={busy || !token || !guestName.trim()}
          onClick={() => void claim({ asGuest: true, guestName })}
        >
          {busy ? "Claiming…" : "Join as guest"}
        </button>
      </div>

      {!loading && !user && (
        <button
          type="button"
          className="chip"
          onClick={() =>
            router.push(
              `/login?next=${encodeURIComponent(`/kiosk/join?t=${encodeURIComponent(token)}`)}`,
            )
          }
        >
          Or sign in
        </button>
      )}

      {error && <p className="text-red-300">{error}</p>}
      <Link href="/play" className="text-sm text-[var(--mist)]">
        Lobby
      </Link>
    </main>
  );
}

export default function KioskJoinPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Joining booth…
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
