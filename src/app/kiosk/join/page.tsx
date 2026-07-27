"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function JoinInner() {
  const search = useSearchParams();
  const token = search.get("t") ?? "";
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        `/login?next=${encodeURIComponent(`/kiosk/join?t=${encodeURIComponent(token)}`)}`,
      );
      return;
    }
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await fetch("/api/kiosk", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not claim slot");
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, [loading, user, token, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Kiosk</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Walk-up slot</h1>
      {!error && !done && <p className="text-[var(--mist)]">Signing you into the booth…</p>}
      {done && (
        <>
          <p className="text-[var(--cream)]">You&apos;re in. Look at the tablet for your seat QR.</p>
          <Link href="/play" className="btn-ghost">
            Lobby
          </Link>
        </>
      )}
      {error && (
        <>
          <p className="text-red-300">{error}</p>
          <Link href="/kiosk" className="btn-primary">
            Kiosk home
          </Link>
        </>
      )}
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
