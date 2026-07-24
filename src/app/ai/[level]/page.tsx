"use client";

import { GameShell } from "@/components/game/GameShell";
import type { AiLevel } from "@/lib/chess/engine";
import { AI_RIVALS } from "@/lib/chess/engine";
import { getCachedDisplayName, sanitizeDisplayName } from "@/lib/names";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function initialName() {
  if (typeof window === "undefined") return "Wanderer";
  return sanitizeDisplayName(getCachedDisplayName());
}

export default function AiPage() {
  const params = useParams<{ level: string }>();
  const level = (params.level as AiLevel) ?? "medium";
  const valid = level in AI_RIVALS;
  const [name] = useState(initialName);

  if (!valid) {
    return (
      <main className="p-8">
        <p>Unknown rival.</p>
        <Link href="/play">Back</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-10">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <span className="font-[family-name:var(--font-display)] text-[var(--brass)]">
          Atelier
        </span>
      </div>
      <GameShell mode="ai" level={level} playerName={name} />
    </main>
  );
}
