"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingStatus } from "@/components/ui/LoadingStatus";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

function JoinInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const ticket = search.get("t") ?? "";
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Opening the table…");
  const started = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = `/join/${code}${ticket ? `?t=${ticket}` : ""}`;
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
          body: JSON.stringify({ code, ticket: ticket || undefined }),
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
  }, [loading, user, code, ticket, router]);

  if (loading || (!error && status)) {
    return <LoadingStatus message={status || "Opening the table…"} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Atelier</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Table {code}</h1>
      {error && (
        <>
          <p className="text-red-300">{error}</p>
          <Link href="/play" className="btn-primary">
            Lobby
          </Link>
          <Link href={`/watch/${code}`} className="text-sm text-[var(--brass)]">
            Spectate instead
          </Link>
        </>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingStatus message="Opening the table…" />}>
      <JoinInner />
    </Suspense>
  );
}
