"use client";

import { UserChip, useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type Club = {
  id: string;
  name: string;
  slug: string;
  description: string;
  openTableCode: string | null;
  ownerId: string;
  invitePath?: string;
};

type Member = {
  userId: string;
  username: string;
  elo: number;
  presence?: string;
  lastSeenAt?: string;
  activeGameCode?: string | null;
  free?: boolean;
};

function ClubDetailInner() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params.slug ?? "");
  const inviteMode = searchParams.get("invite") === "1";
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

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
      const next = inviteMode
        ? `/clubs/${slug}?invite=1`
        : `/clubs/${slug}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [authLoading, user, router, slug, inviteMode]);

  useEffect(() => {
    if (user && slug) void load();
  }, [user, slug, load]);

  useEffect(() => {
    if (!user || !slug) return;
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [user, slug, load]);

  const freeMembers = useMemo(
    () => members.filter((m) => m.free),
    [members],
  );

  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined" || !club) return "";
    const path = club.invitePath ?? `/clubs/${club.slug}?invite=1`;
    return `${window.location.origin}${path}`;
  }, [club]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setMsg("Invite link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Could not copy — select the link below");
    }
  };

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
      setMsg("You’re in the club");
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

      {inviteMode && !joined && (
        <div className="panel mt-4 space-y-2">
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
            You’re invited
          </p>
          <p className="text-sm text-[var(--mist)]">
            Join this club to see who’s free and sit at the open table.
          </p>
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy}
            onClick={() => void join()}
          >
            Accept invite
          </button>
        </div>
      )}

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
            {club.openTableCode ? "New open table" : "Open table"}
          </button>
        )}
        <button
          type="button"
          className="chip"
          onClick={() => void copyInvite()}
        >
          {copied ? "Copied" : "Copy invite"}
        </button>
      </div>

      {joined && (
        <section className="panel mt-4 space-y-2">
          <h2 className="panel-title">Open table</h2>
          {club.openTableCode ? (
            <>
              <p className="font-mono text-2xl tracking-widest text-[var(--cream)]">
                {club.openTableCode}
              </p>
              <p className="text-xs text-[var(--mist)]">
                Persistent club table — share the code or join below.
              </p>
              <Link
                href={`/game/${club.openTableCode}`}
                className="btn-ghost block w-full text-center"
              >
                Join open table
              </Link>
            </>
          ) : (
            <p className="text-sm text-[var(--mist)]">
              No table open yet. Open one for the club to sit at.
            </p>
          )}
        </section>
      )}

      {msg && <p className="mt-3 text-sm text-[var(--brass)]">{msg}</p>}

      <section className="mt-8 space-y-2">
        <h2 className="panel-title">
          Who’s free ({freeMembers.length})
        </h2>
        {freeMembers.length === 0 ? (
          <p className="text-sm text-[var(--mist)]">
            Nobody free right now — invite a friend or open a table.
          </p>
        ) : (
          freeMembers.map((m) => (
            <div
              key={m.userId}
              className="flex justify-between rounded-lg bg-[var(--panel)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--cream)]">{m.username}</span>
              <span className="text-[var(--brass)]">
                {m.presence === "lfg" ? "looking" : "online"}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="panel-title">Members ({members.length})</h2>
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex justify-between rounded-lg bg-[var(--panel)] px-3 py-2 text-sm"
          >
            <div>
              <span className="text-[var(--cream)]">{m.username}</span>
              <p className="text-xs text-[var(--mist)]">
                {m.presence ?? "offline"}
                {m.activeGameCode ? " · at a table" : m.free ? " · free" : ""}
              </p>
            </div>
            <span className="text-[var(--brass)]">{m.elo}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

export default function ClubDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Loading…
        </main>
      }
    >
      <ClubDetailInner />
    </Suspense>
  );
}
