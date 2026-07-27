"use client";

import { TableQr } from "@/components/game/TableQr";
import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Slot = {
  token: string;
  user: { id: string; username: string; elo: number } | null;
};

type Pair = {
  code: string;
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

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://atelierchess.netlify.app";

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
    const res = await fetch(`/api/kiosk?booth=${encodeURIComponent(booth)}&tc=${encodeURIComponent(tc)}`);
    const data = await res.json();
    if (!res.ok) return;
    setSlots(data.slots ?? []);
    if (data.pair) setPair(data.pair);
  }, [booth, tc]);

  useEffect(() => {
    if (!booth) return;
    void poll();
    const id = window.setInterval(() => void poll(), 2500);
    return () => window.clearInterval(id);
  }, [booth, poll]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/play" className="text-sm text-[var(--mist)]">
          ← Lobby
        </Link>
        <p className="text-xs uppercase tracking-[0.25em] text-[var(--brass)]">
          Ranked walk-up
        </p>
      </div>

      <h1 className="font-[family-name:var(--font-display)] text-4xl">Kiosk</h1>
      <p className="text-[var(--mist)]">
        Leave this tablet at the desk. Players scan a slot QR on their phones to
        sign in, then seat QRs appear when both are ready.
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
                  <span className="ml-2 text-sm text-[var(--mist)]">{s.user.elo}</span>
                </p>
              ) : (
                <TableQr
                  url={`${origin}/kiosk/join?t=${encodeURIComponent(s.token)}`}
                  size={160}
                  label="Scan to sign in & claim slot"
                />
              )}
            </div>
          ))}
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
        </section>
      )}

      {pair && (
        <section className="grid gap-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-center text-[var(--brass)]">
            Matched · table {pair.code}
          </p>
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

      {error && <p className="text-red-300">{error}</p>}
    </main>
  );
}
