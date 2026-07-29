"use client";

import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import {
  SALON_PRESETS,
  type SalonPresetId,
} from "@/lib/salon/themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Night = {
  id: string;
  slug: string;
  name: string;
  status: string;
  timeControl: string;
  theme?: string;
};

const PRESET_IDS = Object.keys(SALON_PRESETS) as SalonPresetId[];

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SalonIndexPage() {
  const router = useRouter();
  const [nights, setNights] = useState<Night[]>([]);
  const [preset, setPreset] = useState<SalonPresetId>("open");
  const [name, setName] = useState(SALON_PRESETS.open.defaultName);
  const [timeControl, setTimeControl] = useState<TimeControlId>("10|0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = SALON_PRESETS[preset];
  const lockTimeControl = preset === "bullet";

  const load = async () => {
    const res = await fetch("/api/salon");
    const data = await res.json();
    if (res.ok) setNights(data.nights ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setName(selected.defaultName);
    setTimeControl(selected.timeControl);
  }, [selected]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          preset,
          timeControl: lockTimeControl ? "3|2" : timeControl,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/salon/${data.night.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open salon");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <Link href="/play" className="text-sm text-[var(--mist)]">
        ÔåÉ Lobby
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-4xl">Salon night</h1>
      <p className="text-[var(--mist)]">
        Host a themed lobby. Guests queue on their phones; you pair tables and hand out seat
        QRs.
      </p>

      <section className="panel space-y-3">
        <label className="block text-sm text-[var(--mist)]">
          Theme preset
          <select
            className="field mt-1"
            value={preset}
            onChange={(e) => setPreset(e.target.value as SalonPresetId)}
          >
            {PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {SALON_PRESETS[id].label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-[var(--mist)]">{selected.description}</p>

        <label className="block text-sm text-[var(--mist)]">
          Night name
          <input
            className="field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block text-sm text-[var(--mist)]">
          Time control
          <select
            className="field mt-1"
            value={lockTimeControl ? "3|2" : timeControl}
            disabled={lockTimeControl}
            onChange={(e) => setTimeControl(e.target.value as TimeControlId)}
          >
            {(Object.keys(TIME_CONTROLS) as TimeControlId[]).map((id) => (
              <option key={id} value={id}>
                {TIME_CONTROLS[id].label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-[var(--mist)]">
            Opens at (optional)
            <input
              type="datetime-local"
              className="field mt-1"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="block text-sm text-[var(--mist)]">
            Ends at (optional)
            <input
              type="datetime-local"
              className="field mt-1"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => {
            const now = new Date();
            const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            setStartsAt(toLocalInputValue(now));
            setEndsAt(toLocalInputValue(later));
          }}
        >
          Fill next 2 hours
        </button>

        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={() => void create()}
        >
          {busy ? "OpeningÔÇª" : "Open host desk"}
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </section>

      {nights.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[var(--mist)]">Your nights</p>
          {nights.map((n) => (
            <Link key={n.id} href={`/salon/${n.slug}`} className="chip block">
              {n.name}
              {n.theme ? ` ┬À ${SALON_PRESETS[n.theme as SalonPresetId]?.label ?? n.theme}` : ""}
              {" ┬À "}
              {n.status}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
