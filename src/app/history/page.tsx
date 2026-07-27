"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Archive = {
  id: string;
  code: string;
  pgn: string;
  result: string | null;
  opponent: string | null;
  rated: boolean;
  createdAt: string;
};

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/archive");
      const data = await res.json();
      if (res.ok) setArchives(data.archives ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/history");
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

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/play" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Lobby
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">History</h1>
      <p className="mt-1 text-[var(--mist)]">Archived games ready for analysis.</p>

      <section className="mt-6 space-y-2">
        {loading && (
          <p className="text-sm text-[var(--mist)]">Loading archives…</p>
        )}
        {!loading && archives.length === 0 && (
          <p className="text-sm text-[var(--mist)]">No archived games yet.</p>
        )}
        {archives.map((a) => {
          const analyzeHref = a.pgn
            ? `/analyze?pgn=${encodeURIComponent(a.pgn)}`
            : `/analyze`;
          return (
            <div
              key={a.id}
              className="rounded-lg bg-[var(--panel)] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[var(--cream)]">
                    vs {a.opponent ?? "Unknown"}
                  </p>
                  <p className="text-xs text-[var(--mist)]">
                    {a.result ?? "—"}
                    {a.rated ? " · rated" : ""} ·{" "}
                    {new Date(a.createdAt).toLocaleDateString()} · {a.code}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Link href={`/game/${a.code}`} className="chip">
                    Table
                  </Link>
                  <Link href={analyzeHref} className="chip">
                    Analyze
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
