"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MineGame = {
  code: string;
  status: string;
  turn: string;
  whiteName: string | null;
  blackName: string | null;
  rated: boolean;
  correspondence: boolean;
  yourColor: "w" | "b";
  updatedAt: string;
};

export default function CorrespondencePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<MineGame[]>([]);
  const [rated, setRated] = useState<MineGame[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/games/mine");
      const data = await res.json();
      if (res.ok) {
        setGames(data.correspondence ?? []);
        setRated(data.rated ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/correspondence");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (authLoading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  const row = (g: MineGame) => {
    const opp =
      g.yourColor === "w"
        ? (g.blackName ?? "Opponent")
        : (g.whiteName ?? "Opponent");
    const yourTurn = g.turn === g.yourColor;
    return (
      <Link
        key={g.code}
        href={`/game/${g.code}`}
        className="mode-card block"
      >
        <h3>
          {g.code} · vs {opp}
        </h3>
        <p>
          {yourTurn ? "Your move" : "Their move"}
          {g.rated ? " · Rated" : " · Casual"}
        </p>
      </Link>
    );
  };

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Correspondence
      </h1>
      <p className="mt-1 text-[var(--mist)]">
        Active postal-style and rated tables you are seated at.
      </p>

      <section className="mt-6 space-y-2">
        <h2 className="panel-title">Correspondence</h2>
        {loading && <p className="text-sm text-[var(--mist)]">Loading…</p>}
        {!loading && games.length === 0 && (
          <p className="text-sm text-[var(--mist)]">No active correspondence games.</p>
        )}
        {games.map(row)}
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="panel-title">Active rated</h2>
        {!loading && rated.length === 0 && (
          <p className="text-sm text-[var(--mist)]">No active rated games.</p>
        )}
        {rated.map(row)}
      </section>
    </main>
  );
}
