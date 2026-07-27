"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg("");
    setPreviewUrl("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg("If that email is registered, a reset link is ready.");
      if (data.previewUrl) setPreviewUrl(data.previewUrl as string);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send reset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/login" className="mb-6 text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Sign in
      </Link>
      <h1 className="font-[family-name:var(--font-display)] text-4xl">Reset password</h1>
      <p className="mt-2 text-[var(--mist)]">
        We&apos;ll email a link (or show it here if email isn&apos;t configured yet).
      </p>
      <div className="mt-6 space-y-3">
        <input
          className="field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
        {msg && <p className="text-sm text-[var(--cream)]">{msg}</p>}
        {previewUrl && (
          <p className="break-all text-sm text-[var(--brass)]">
            <a href={previewUrl}>{previewUrl}</a>
          </p>
        )}
      </div>
    </main>
  );
}
