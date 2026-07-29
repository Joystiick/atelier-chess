"use client";

import { TableQr } from "@/components/game/TableQr";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import { startVisibilityAwareInterval } from "@/lib/poll";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const KIOSK_POLL_MS = 4_000;
const LOCK_KEY = "atelier.kioskLocked";

type Slot = {
  token: string;
  user: { id: string | null; username: string; elo: number; guest?: boolean } | null;
};

type Pair = {
  code: string;
  tablecast?: boolean;
  hostPath?: string;
  watchPath?: string;
  broadcastPath?: string;
  white: { username: string; seatPath: string };
  black: { username: string; seatPath: string };
};

export default function KioskPage() {
  const [booth, setBooth] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pair, setPair] = useState<Pair | null>(null);
  const [tc, setTc] = useState<TimeControlId>("10|0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);
  const [unlockHold, setUnlockHold] = useState(0);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://atelierchess.netlify.app";

  useEffect(() => {
    setLocked(localStorage.getItem(LOCK_KEY) === "1");
  }, []);

  const setLock = (on: boolean) => {
    setLocked(on);
    localStorage.setItem(LOCK_KEY, on ? "1" : "0");
  };

  const openBooth = async () => {
    setBusy(true);
    setError("");
    setPair(null);
    try {
      const res = await fetch("/api/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeControl: tc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setBooth(data.booth);
      setSlots(
        (data.slots as { token: string }[]).map((s) => ({
          token: s.token,
          user: null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open kiosk");
    } finally {
      setBusy(false);
    }
  };

  const poll = useCallback(async () => {
    if (!booth) return;
    const res = await fetch(
      `/api/kiosk?booth=${encodeURIComponent(booth)}&tc=${encodeURIComponent(tc)}`,
    );
    const data = await res.json();
    if (!res.ok) return;
    setSlots(data.slots ?? []);
    if (data.pair) setPair(data.pair);
  }, [booth, tc]);

  useEffect(() => {
    if (!booth) return;
    void poll();
    return startVisibilityAwareInterval(() => void poll(), KIOSK_POLL_MS);
  }, [booth, poll]);

  return (
    <main
      className={`mx-auto min-h-screen max-w-2xl space-y-6 px-4 py-8 ${
        locked ? "bg-[var(--ink)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        {locked ? (
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
            Café booth · locked
          </p>
        ) : (
          <Link href="/play" className="text-sm text-[var(--mist)]">
            ← Lobby
          </Link>
        )}
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
          Local QR only
        </p>
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        {locked ? "Walk-up table" : "Kiosk"}
      </h1>
      <p className="text-[var(--mist)]">
        {locked
          ? "Scan a slot on your phone. Guests welcome — no account needed. Seat QRs appear when both sides are ready."
          : "Leave this tablet at the café or library desk. Players scan a local slot QR — sign in or join as guest — then seat QRs appear."}
      </p>

      {!booth && (
        <section className="panel space-y-3">
          <label className="block text-sm text-[var(--mist)]">
            Time control
            <select
              className="field mt-1"
              value={tc}
              onChange={(e) => setTc(e.target.value as TimeControlId)}
            >
              {(Object.keys(TIME_CONTROLS) as TimeControlId[])
                .filter((id) => id !== "∞")
                .map((id) => (
                  <option key={id} value={id}>
                    {TIME_CONTROLS[id].label}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void openBooth()}
          >
            {busy ? "Opening…" : "Open booth"}
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => setLock(true)}
          >
            Lock booth (hide lobby)
          </button>
        </section>
      )}

      {booth && !pair && (
        <section className="grid gap-6 sm:grid-cols-2">
          {slots.map((s, i) => (
            <div key={s.token} className="panel space-y-2 text-center">
              <p className="text-sm text-[var(--brass)]">Player {i + 1}</p>
              {s.user ? (
                <p className="font-[family-name:var(--font-display)] text-2xl">
                  {s.user.username}
                  <span className="ml-2 text-sm text-[var(--mist)]">
                    {s.user.guest ? "guest" : s.user.elo}
                  </span>
                </p>
              ) : (
                <TableQr
                  url={`${origin}/kiosk/join?t=${encodeURIComponent(s.token)}`}
                  size={160}
                  label="Scan to claim slot"
                />
              )}
            </div>
          ))}
          {!locked && (
            <button
              type="button"
              className="btn-ghost sm:col-span-2"
              onClick={() => {
                setBooth(null);
                setSlots([]);
              }}
            >
              Reset booth
            </button>
          )}
        </section>
      )}

      {pair && (
        <section className="grid gap-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-center text-[var(--brass)]">
            Tablecast matched · table {pair.code}
          </p>
          <div className="sm:col-span-2 flex flex-wrap justify-center gap-2">
            {pair.hostPath && (
              <Link href={pair.hostPath} className="btn-ghost">
                Host desk
              </Link>
            )}
            {pair.watchPath && (
              <Link href={pair.watchPath} className="chip">
                Gallery
              </Link>
            )}
            {pair.broadcastPath && (
              <Link href={pair.broadcastPath} className="chip">
                OBS
              </Link>
            )}
          </div>
          <div className="panel space-y-2 text-center">
            <p className="text-sm">White · {pair.white.username}</p>
            <TableQr
              url={`${origin}${pair.white.seatPath}`}
              size={160}
              label="Scan to sit white"
            />
          </div>
          <div className="panel space-y-2 text-center">
            <p className="text-sm">Black · {pair.black.username}</p>
            <TableQr
              url={`${origin}${pair.black.seatPath}`}
              size={160}
              label="Scan to sit black"
            />
          </div>
          <button
            type="button"
            className="btn-primary sm:col-span-2"
            onClick={() => void openBooth()}
          >
            Next booth
          </button>
        </section>
      )}

      {locked && (
        <button
          type="button"
          className="chip w-full text-xs text-[var(--mist)]"
          onPointerDown={() => {
            const start = Date.now();
            const id = window.setInterval(() => {
              const held = Date.now() - start;
              setUnlockHold(held);
              if (held >= 2000) {
                window.clearInterval(id);
                setLock(false);
                setUnlockHold(0);
              }
            }, 100);
            const stop = () => {
              window.clearInterval(id);
              setUnlockHold(0);
              window.removeEventListener("pointerup", stop);
              window.removeEventListener("pointercancel", stop);
            };
            window.addEventListener("pointerup", stop);
            window.addEventListener("pointercancel", stop);
          }}
        >
          {unlockHold > 0
            ? `Hold to unlock… ${Math.min(100, Math.round((unlockHold / 2000) * 100))}%`
            : "Staff · hold 2s to unlock"}
        </button>
      )}

      {error && <p className="text-red-300">{error}</p>}
    </main>
  );
}
