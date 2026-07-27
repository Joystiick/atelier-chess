"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { GameShell } from "@/components/game/GameShell";
import type { AiLevel } from "@/lib/chess/engine";
import { AI_RIVALS } from "@/lib/chess/engine";
import {
  TIME_CONTROLS,
  getPreferredTimeControl,
  type TimeControlId,
} from "@/lib/names";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function AiPage() {
  const params = useParams<{ level: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const level = (params.level as AiLevel) ?? "medium";
  const valid = level in AI_RIVALS;
  const [tcId, setTcId] = useState<TimeControlId>(() => {
    if (typeof window === "undefined") return "∞";
    return getPreferredTimeControl();
  });

  const clockMs = useMemo(() => TIME_CONTROLS[tcId]?.baseMs ?? 0, [tcId]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/ai/" + level);
  }, [loading, user, router, level]);

  if (!valid) {
    return (
      <main className="p-8">
        <p>Unknown rival.</p>
        <Link href="/play">Back</Link>
      </main>
    );
  }

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Checking account…
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <div className="flex items-center gap-2">
          <select
            className="chip bg-transparent"
            value={tcId}
            onChange={(e) => setTcId(e.target.value as TimeControlId)}
            aria-label="Time control"
          >
            {(Object.keys(TIME_CONTROLS) as TimeControlId[]).map((id) => (
              <option key={id} value={id}>
                {TIME_CONTROLS[id].label}
              </option>
            ))}
          </select>
          <UserChip />
        </div>
      </div>
      <GameShell
        mode="ai"
        level={level}
        playerName={user.username}
        clockMs={clockMs}
        key={`${level}-${tcId}`}
      />
    </main>
  );
}
