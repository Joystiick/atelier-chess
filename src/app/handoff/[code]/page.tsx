"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";

function HandoffInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const handoff = search.get("h") ?? "";
  /** Default stays `/game`; phone companion uses `next=remote`. */
  const nextDest = search.get("next") === "remote" ? "remote" : "game";
  const code = (params.code ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8);
  const router = useRouter();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const run = async () => {
      try {
        const res = await fetch(`/api/games/${code}/handoff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claim", handoff }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Handoff failed");
        router.replace(
          nextDest === "remote" ? `/remote/${code}` : `/game/${code}`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Handoff failed");
      }
    };
    void run();
  }, [code, handoff, nextDest, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">Seat handoff</p>
      <h1 className="font-[family-name:var(--font-display)] text-3xl">Table {code}</h1>
      {!error && <p className="text-[var(--mist)]">Moving your seat to this deviceÔÇª</p>}
      {error && (
        <>
          <p className="text-red-300">{error}</p>
          <Link
            href={nextDest === "remote" ? `/remote/${code}` : `/game/${code}`}
            className="btn-primary"
          >
            Open {nextDest === "remote" ? "remote" : "table"}
          </Link>
        </>
      )}
    </main>
  );
}

export default function HandoffPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          HandoffÔÇª
        </main>
      }
    >
      <HandoffInner />
    </Suspense>
  );
}
