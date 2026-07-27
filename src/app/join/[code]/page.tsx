"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Deep-link entry: scan QR → /join/CODE → login if needed → sit at table.
 */
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Opening the table…");
  const started = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = `/join/${code}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (started.current) return;
    started.current = true;

    const run = async () => {
      setStatus("Claiming your seat…");
      try {
        const res = await fetch("/api/games/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not join");
        playSound("start");
        setStatus("Seated — dealing…");
        router.replace(`/game/${data.code}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join");
        setStatus("");
      }
    };
    void run();
  }, [loading, user, code, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Atelier</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Table {code}</h1>
      {status && !error && <p className="text-[var(--mist)]">{status}</p>}
      {error && (
        <>
          <p className="text-red-300">{error}</p>
          <Link href="/play" className="btn-primary">
            Lobby
          </Link>
          <Link href={`/game/${code}?spectate=1`} className="text-sm text-[var(--brass)]">
            Spectate instead
          </Link>
        </>
      )}
    </main>
  );
}
