"use client";

import { TIME_CONTROLS, type TimeControlId } from "@/lib/names";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Night = {
  id: string;
  slug: string;
  name: string;
  status: string;
  timeControl: string;
};

export default function SalonIndexPage() {
  const router = useRouter();
  const [nights, setNights] = useState<Night[]>([]);
  const [name, setName] = useState("Friday salon");
  const [timeControl, setTimeControl] = useState<TimeControlId>("10|0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/salon");
    const data = await res.json();
    if (res.ok) setNights(data.nights ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timeControl }),
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
        ← Lobby
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-4xl">Salon night</h1>
      <p className="text-[var(--mist)]">
        Host a lobby QR. Guests queue; you pair tables and hand out seat QRs.
      </p>

      <section className="panel space-y-3">
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
          className="btn-primary w-full"
          disabled={busy}
          onClick={() => void create()}
        >
          {busy ? "Opening…" : "Open host desk"}
        </button>
        {error && <p className="text-sm text-red-300">{error}</p>}
      </section>

      {nights.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[var(--mist)]">Your nights</p>
          {nights.map((n) => (
            <Link key={n.id} href={`/salon/${n.slug}`} className="chip block">
              {n.name} · {n.status}
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
