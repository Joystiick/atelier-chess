"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import {
  SOFT_RANKS,
  effectiveSeasonElo,
  formatSeasonLabel,
  softRankForSeasonElo,
} from "@/lib/ghostLeague";
import { currentSeasonKey } from "@/lib/prefs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Self-only Ghost League standings ÔÇö soft seasonal ladder from ghost rematch. */
export default function GhostLeaguePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/ghost-league");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        LoadingÔÇª
      </main>
    );
  }

  const season = currentSeasonKey();
  const seasonScore = effectiveSeasonElo(
    user.seasonKey ?? "",
    user.seasonElo ?? 1200,
    season,
  );
  const softRank = softRankForSeasonElo(seasonScore);
  const inSeason = (user.seasonKey ?? "") === season;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ÔåÉ Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        Ghost League
      </h1>
      <p className="mt-1 text-[var(--mist)]">
        Soft monthly ladder from ghost rematch ÔÇö not harsh ranked, not pay-to-win.
      </p>

      <section className="panel mt-6 space-y-3">
        <h2 className="panel-title">{formatSeasonLabel(season)}</h2>
        <p className="text-sm text-[var(--mist)]">Season key {season}</p>
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]">
          {softRank.label}
        </p>
        <p className="text-[var(--brass)] text-xl">{seasonScore}</p>
        <p className="text-sm text-[var(--mist)]">
          {inSeason
            ? "Your soft score this month"
            : "No ghost rematch games yet this month ÔÇö you start at 1200"}
        </p>
      </section>

      <section className="panel mt-4 space-y-2">
        <h2 className="panel-title">Bands</h2>
        <ul className="space-y-1 text-sm text-[var(--mist)]">
          {SOFT_RANKS.map((band) => (
            <li
              key={band.id}
              className={
                band.id === softRank.id ? "text-[var(--brass)]" : undefined
              }
            >
              {band.label}
              {band.maxElo == null
                ? ` ┬À ${band.minElo}+`
                : ` ┬À ${band.minElo}ÔÇô${band.maxElo}`}
              {band.id === softRank.id ? " ┬À you" : ""}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-sm text-[var(--mist)]">
        Finish a game, tap Ghost rematch QR, play the next table ÔÇö that counts for
        the season.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/profile" className="btn-ghost">
          Profile
        </Link>
        <Link href="/ranked" className="btn-ghost">
          Ranked matchmaking
        </Link>
      </div>
    </main>
  );
}
