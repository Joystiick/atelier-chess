"use client";

import { AI_RIVALS, type AiLevel } from "@/lib/chess/engine";
import { playSound } from "@/lib/chess/sound";
import {
  getCachedDisplayName,
  sanitizeDisplayName,
  setCachedDisplayName,
} from "@/lib/names";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

type Step = "name" | "modes" | "human" | "ai";

function initialName() {
  if (typeof window === "undefined") return "";
  return getCachedDisplayName();
}

function PlayPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const joinParam = search.get("join")?.replace(/\D/g, "").slice(0, 8) ?? "";

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(joinParam);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmName = () => {
    const cleaned = sanitizeDisplayName(name);
    setName(cleaned);
    setCachedDisplayName(cleaned);
    playSound("click");
    if (joinParam.length === 8) {
      setCode(joinParam);
      setStep("human");
    } else {
      setStep("modes");
    }
  };

  const createGame = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open a table");
    } finally {
      setBusy(false);
    }
  };

  const joinGame = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/games/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.replace(/\D/g, ""),
          displayName: name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      playSound("start");
      router.push(`/game/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Atelier
      </Link>

      {step === "name" && (
        <section className="space-y-4">
          <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--cream)]">
            Your name
          </h1>
          <p className="text-[var(--mist)]">
            Change it every visit. Saved on this device.
          </p>
          <input
            className="field"
            value={name}
            maxLength={20}
            placeholder="Display name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmName();
            }}
          />
          <button type="button" className="btn-primary w-full" onClick={confirmName}>
            Continue
          </button>
        </section>
      )}

      {step === "modes" && (
        <section className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-4xl">
            Choose a mode
          </h1>
          <p className="mb-2 text-[var(--mist)]">Playing as {name}</p>
          <button
            type="button"
            className="mode-card"
            onClick={() => {
              playSound("click");
              setStep("human");
            }}
          >
            <h3>Human</h3>
            <p>Create a table or join with an 8-digit code.</p>
          </button>
          <button
            type="button"
            className="mode-card"
            onClick={() => {
              playSound("click");
              setStep("ai");
            }}
          >
            <h3>AI</h3>
            <p>Easy, Medium, or Hard — powered by Garbochess.</p>
          </button>
          <button type="button" className="btn-ghost mt-2" onClick={() => setStep("name")}>
            Change name
          </button>
        </section>
      )}

      {step === "human" && (
        <section className="space-y-4">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Human</h1>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void createGame()}
          >
            {busy ? "Creating…" : "Create table"}
          </button>
          <div className="relative py-2 text-center text-xs uppercase tracking-widest text-[var(--mist)]">
            or join
          </div>
          <input
            className="field tracking-[0.35em]"
            inputMode="numeric"
            placeholder="12345678"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          <button
            type="button"
            className="btn-ghost w-full"
            disabled={busy || code.length !== 8}
            onClick={() => void joinGame()}
          >
            Enter code
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button type="button" className="btn-ghost" onClick={() => setStep("modes")}>
            Back
          </button>
        </section>
      )}

      {step === "ai" && (
        <section className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">AI difficulty</h1>
          {(Object.keys(AI_RIVALS) as AiLevel[]).map((level) => {
            const r = AI_RIVALS[level];
            return (
              <button
                key={level}
                type="button"
                className="mode-card"
                onClick={() => {
                  playSound("click");
                  router.push(`/ai/${level}`);
                }}
              >
                <h3>
                  {r.title} — {r.name}
                </h3>
                <p>{r.blurb}</p>
              </button>
            );
          })}
          <button type="button" className="btn-ghost" onClick={() => setStep("modes")}>
            Back
          </button>
        </section>
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center text-[var(--mist)]">
          Loading…
        </main>
      }
    >
      <PlayPageInner />
    </Suspense>
  );
}
