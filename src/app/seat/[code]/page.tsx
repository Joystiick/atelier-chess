"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";

function SeatInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const color = search.get("c") === "b" ? "b" : "w";
  const token = search.get("t") ?? "";
  const router = useRouter();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const run = async () => {
      try {
        const res = await fetch(`/api/games/${code}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ color, token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Claim failed");
        router.replace(`/game/${code}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Claim failed");
      }
    };
    void run();
  }, [code, color, token, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Seat claim</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Table {code}</h1>
      {!error && <p className="text-[var(--mist)]">Claiming your seat…</p>}
      {error && (
        <>
          <p className="text-red-300">{error}</p>
          <Link href="/play" className="btn-primary">
            Lobby
          </Link>
        </>
      )}
    </main>
  );
}

export default function SeatPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Claiming seat…
        </main>
      }
    >
      <SeatInner />
    </Suspense>
  );
}
