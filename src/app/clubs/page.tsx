"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Club = {
  id: string;
  name: string;
  slug: string;
  description: string;
  openTableCode: string | null;
};

export default function ClubsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mine, setMine] = useState<Club[]>([]);
  const [all, setAll] = useState<Club[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/clubs");
    const data = await res.json();
    if (res.ok) {
      setMine(data.mine ?? []);
      setAll(data.clubs ?? []);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/clubs");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const create = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/clubs/${data.club.slug}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create");
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

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Clubs</h1>
      <p className="mt-1 text-[var(--mist)]">Salons with open tables.</p>

      <section className="panel mt-6 space-y-2">
        <h2 className="panel-title">Found a club</h2>
        <input
          className="field w-full"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="field w-full min-h-[4rem]"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          className="btn-ghost w-full"
          disabled={busy || !name.trim()}
          onClick={() => void create()}
        >
          Create
        </button>
        {msg && <p className="text-sm text-[var(--brass)]">{msg}</p>}
      </section>

      {mine.length > 0 && (
        <section className="mt-6 space-y-2">
          <h2 className="panel-title">Your clubs</h2>
          {mine.map((c) => (
            <Link
              key={c.id}
              href={`/clubs/${c.slug}`}
              className="block rounded-lg bg-[var(--panel)] px-3 py-2 hover:ring-1 hover:ring-[var(--brass)]"
            >
              <p className="text-[var(--cream)]">{c.name}</p>
              <p className="truncate text-xs text-[var(--mist)]">{c.description}</p>
            </Link>
          ))}
        </section>
      )}

      <section className="mt-6 space-y-2">
        <h2 className="panel-title">All clubs</h2>
        {all.length === 0 && (
          <p className="text-sm text-[var(--mist)]">No clubs yet.</p>
        )}
        {all.map((c) => (
          <Link
            key={c.id}
            href={`/clubs/${c.slug}`}
            className="block rounded-lg bg-[var(--panel)] px-3 py-2 hover:ring-1 hover:ring-[var(--brass)]"
          >
            <p className="text-[var(--cream)]">{c.name}</p>
            <p className="truncate text-xs text-[var(--mist)]">{c.description || "—"}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
