"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Study = {
  id: string;
  title: string;
  updatedAt: string;
};

export default function StudyListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [studies, setStudies] = useState<Study[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/studies");
    const data = await res.json();
    if (res.ok) setStudies(data.studies ?? []);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/study");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Untitled study" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/study/${data.study.id}`);
    } finally {
      setBusy(false);
    }
  };

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

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Study</h1>
      <p className="mt-1 text-[var(--mist)]">Boards for analysis and notes.</p>

      <section className="panel mt-6 space-y-2">
        <h2 className="panel-title">New study</h2>
        <input
          className="field w-full"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={busy}
          onClick={() => void create()}
        >
          Create
        </button>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="panel-title">Your studies</h2>
        {studies.length === 0 && (
          <p className="text-sm text-[var(--mist)]">None yet.</p>
        )}
        {studies.map((s) => (
          <Link
            key={s.id}
            href={`/study/${s.id}`}
            className="block rounded-lg bg-[var(--panel)] px-3 py-2 hover:ring-1 hover:ring-[var(--brass)]"
          >
            <p className="text-[var(--cream)]">{s.title}</p>
            <p className="text-xs text-[var(--mist)]">
              Updated {new Date(s.updatedAt).toLocaleString()}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
