"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TrainPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/train");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Train</h1>
      <p className="mt-1 mb-6 text-[var(--mist)]">
        Openings, coach hints, blunder tips, and puzzle sets.
      </p>

      <section className="space-y-3">
        <Link
          href="/train/openings"
          className="mode-card block"
          onClick={() => playSound("click")}
        >
          <h3>Opening trainer</h3>
          <p>Practice book lines move by move.</p>
        </Link>
        <Link
          href="/ai/easy?coach=1"
          className="mode-card block"
          onClick={() => playSound("click")}
        >
          <h3>Coach AI</h3>
          <p>Play Easy with coach candidates on.</p>
        </Link>
        <Link
          href="/train/blunders"
          className="mode-card block"
          onClick={() => playSound("click")}
        >
          <h3>Blunder tips</h3>
          <p>Scan a PGN for hanging pieces.</p>
        </Link>
        <Link
          href="/puzzles/sets"
          className="mode-card block"
          onClick={() => playSound("click")}
        >
          <h3>Puzzle sets</h3>
          <p>Build and play curated puzzle lists.</p>
        </Link>
      </section>
    </main>
  );
}
