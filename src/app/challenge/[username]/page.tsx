"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { playSound } from "@/lib/chess/sound";
import {
  TIME_CONTROLS,
  getPreferredTimeControl,
  type TimeControlId,
} from "@/lib/names";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  username: string;
  avatar: string;
  elo: number;
};

export default function ChallengePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "").replace(/^@/, "");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeControl, setTimeControl] = useState<TimeControlId>("10|0");

  useEffect(() => {
    setTimeControl(getPreferredTimeControl());
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        `/login?next=${encodeURIComponent(`/challenge/${encodeURIComponent(username)}`)}`,
      );
    }
  }, [loading, user, router, username]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Player not found");
        return;
      }
      setProfile(data.user ?? data);
    };
    void load();
  }, [username]);

  const challenge = async () => {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeControl,
          rated: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Challenge failed");

      // Best-effort friend invite if you're already friends
      try {
        await fetch("/api/friends/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ friendId: profile.id, code: data.code }),
        });
      } catch {
        // QR waiting room covers non-friends
      }

      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-[var(--mist)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 py-10">
      <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
        Challenge card
      </p>
      {profile ? (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            @{profile.username}
          </h1>
          <p className="text-[var(--mist)]">
            {profile.avatar} · Elo {profile.elo}
          </p>
          <label className="block text-sm text-[var(--mist)]">
            Time control
            <select
              className="field mt-1"
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value as TimeControlId)}
            >
              {(Object.keys(TIME_CONTROLS) as TimeControlId[]).map((id) => (
                <option key={id} value={id}>
                  {TIME_CONTROLS[id].label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || profile.id === user.id}
            onClick={() => void challenge()}
          >
            {profile.id === user.id
              ? "That's you"
              : busy
                ? "Opening…"
                : "Challenge to rated game"}
          </button>
          <p className="text-xs text-[var(--mist)]">
            Opens your table and sends them an invite. Share this page URL as your
            AirDrop card.
          </p>
        </>
      ) : (
        <p className="text-[var(--mist)]">Looking up {username}…</p>
      )}
      {error && <p className="text-red-300">{error}</p>}
      <Link href="/play" className="text-sm text-[var(--brass)]">
        Lobby
      </Link>
    </main>
  );
}
