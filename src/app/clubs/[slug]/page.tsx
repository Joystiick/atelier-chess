"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Club = {
  id: string;
  name: string;
  slug: string;
  description: string;
  openTableCode: string | null;
  ownerId: string;
};

type Member = {
  userId: string;
  username: string;
  elo: number;
};

export default function ClubDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = String(params.slug ?? "");
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [joined, setJoined] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    const res = await fetch(`/api/clubs/${slug}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Not found");
      return;
    }
    setClub(data.club);
    setMembers(data.members ?? []);
    if (user) {
      setJoined(
        (data.members as Member[]).some((m) => m.userId === user.id),
      );
    }
  }, [slug, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=/clubs/${slug}`);
    }
  }, [authLoading, user, router, slug]);

  useEffect(() => {
    if (user && slug) void load();
  }, [user, slug, load]);

  const join = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/clubs/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setJoined(true);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  const openTable = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/clubs/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open-table" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not open table");
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

  if (!club) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <Link href="/clubs" className="text-sm text-[var(--mist)]">
          ← Clubs
        </Link>
        <p className="mt-6 text-[var(--mist)]">{msg || "Loading…"}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/clubs" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
          ← Clubs
        </Link>
        <UserChip />
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {club.name}
      </h1>
      <p className="mt-1 text-[var(--mist)]">{club.description || "A quiet salon."}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {!joined ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void join()}
          >
            Join club
          </button>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => void openTable()}
          >
            Open table
          </button>
        )}
        {club.openTableCode && (
          <Link href={`/game/${club.openTableCode}`} className="chip">
            Join open table
          </Link>
        )}
      </div>

      {msg && <p className="mt-3 text-sm text-[var(--brass)]">{msg}</p>}

      <section className="mt-8 space-y-2">
        <h2 className="panel-title">Members ({members.length})</h2>
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex justify-between rounded-lg bg-[var(--panel)] px-3 py-2 text-sm"
          >
            <span>{m.username}</span>
            <span className="text-[var(--brass)]">{m.elo}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
