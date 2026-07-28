"use client";

import {
  fetchDesktopLatest,
  hasDownloadUrl,
  type DesktopLatest,
} from "@/lib/desktop/latest";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OsKind = "windows" | "mac" | "other";

function detectOs(): OsKind {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return "other";
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  return "other";
}

function formatReleasedAt(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AssetBlock({
  title,
  requirements,
  url,
  sha256,
  available,
}: {
  title: string;
  requirements: string;
  url: string;
  sha256: string | null;
  available: boolean;
}) {
  const headingId = title.replace(/\s+/g, "-");
  return (
    <section className="panel" aria-labelledby={headingId}>
      <h2 id={headingId} className="panel-title">
        {title}
      </h2>
      <p className="text-sm text-[var(--mist)]">{requirements}</p>
      <div className="mt-4">
        {available ? (
          <a
            href={url}
            className="btn-primary inline-flex w-full items-center justify-center no-underline sm:w-auto"
            download
          >
            Download installer
          </a>
        ) : (
          <span
            className="btn-primary inline-flex w-full cursor-not-allowed items-center justify-center opacity-55 sm:w-auto"
            aria-disabled="true"
          >
            Coming soon
          </span>
        )}
      </div>
      <dl className="mt-4 space-y-2 text-sm text-[var(--mist)]">
        <div>
          <dt className="inline text-[var(--cream)]">SHA-256 · </dt>
          <dd className="inline break-all font-mono text-xs">
            {sha256?.trim() ? sha256 : "Published with the release"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function DownloadPageClient() {
  const [latest, setLatest] = useState<DesktopLatest | null>(null);
  const [error, setError] = useState(false);
  const [os, setOs] = useState<OsKind>("other");

  useEffect(() => {
    setOs(detectOs());
    let cancelled = false;
    void fetchDesktopLatest({ cache: "no-store" }).then((data) => {
      if (cancelled) return;
      if (!data) setError(true);
      else setLatest(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const win = latest?.windows.x64;
  const mac = latest?.mac.universal;

  const platforms = useMemo(() => {
    const windows = {
      key: "windows" as const,
      title: "Windows",
      requirements: "Windows 10 or later · 64-bit (x64) only",
      url: win?.url ?? "",
      sha256: win?.sha256 ?? null,
      available: hasDownloadUrl(win),
    };
    const macintosh = {
      key: "mac" as const,
      title: "macOS",
      requirements: "macOS 12 or later · Universal (Apple silicon & Intel)",
      url: mac?.url ?? "",
      sha256: mac?.sha256 ?? null,
      available: hasDownloadUrl(mac),
    };
    if (os === "mac") return [macintosh, windows];
    return [windows, macintosh];
  }, [os, win, mac]);

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link href="/" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Home
      </Link>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-[var(--cream)]">
        Download
      </h1>
      <p className="mt-3 text-[var(--mist)]">
        Install Atelier on your computer. Multiplayer, accounts, and AI stay on
        the same cloud as the browser app.
      </p>

      {latest ? (
        <p className="mt-4 text-sm text-[var(--brass)]">
          Version {latest.version}
          {latest.releasedAt
            ? ` · ${formatReleasedAt(latest.releasedAt)}`
            : ""}
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-[var(--mist)]" role="status">
          Release info is temporarily unavailable. Check back shortly.
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--mist)]" role="status">
          Loading release info…
        </p>
      )}

      {latest?.notes ? (
        <p className="mt-2 text-sm text-[var(--mist)]">{latest.notes}</p>
      ) : null}

      <div className="mt-8 space-y-4">
        {platforms.map((p) => (
          <AssetBlock
            key={p.key}
            title={p.title}
            requirements={p.requirements}
            url={p.url}
            sha256={p.sha256}
            available={p.available}
          />
        ))}
      </div>

      <section className="mt-10 space-y-6 text-[var(--mist)]" aria-labelledby="install-help">
        <h2
          id="install-help"
          className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]"
        >
          First-run help
        </h2>

        <div>
          <h3 className="text-base text-[var(--cream)]">Windows SmartScreen</h3>
          <p className="mt-1 text-sm leading-relaxed">
            Early builds may be unsigned. If Windows shows “Windows protected
            your PC”, choose{" "}
            <strong className="font-medium text-[var(--cream)]">More info</strong>,
            then{" "}
            <strong className="font-medium text-[var(--cream)]">Run anyway</strong>.
            Only install from this site or the official GitHub release.
          </p>
        </div>

        <div>
          <h3 className="text-base text-[var(--cream)]">macOS Gatekeeper</h3>
          <p className="mt-1 text-sm leading-relaxed">
            If macOS says the app “cannot be opened because it is from an
            unidentified developer”, open{" "}
            <strong className="font-medium text-[var(--cream)]">
              System Settings → Privacy &amp; Security
            </strong>
            , scroll to the message about Atelier, and click{" "}
            <strong className="font-medium text-[var(--cream)]">Open Anyway</strong>.
            You can also right-click the app and choose Open the first time.
          </p>
        </div>
      </section>

      <p className="mt-10 text-sm text-[var(--mist)]">
        Playing is desktop-only — install above, then open Atelier Chess.
      </p>
    </main>
  );
}
