"use client";

import { useDesktopClient } from "@/hooks/useDesktopClient";
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

type CtaProps = {
  label: string;
  href: string | null;
  primary?: boolean;
  available: boolean;
};

function DownloadCta({ label, href, primary, available }: CtaProps) {
  const className = `${primary ? "btn-primary" : "btn-ghost"} inline-flex w-full items-center justify-center sm:w-auto`;

  if (!available || !href) {
    return (
      <span
        className={`${className} cursor-not-allowed opacity-55`}
        aria-disabled="true"
        title="Installer not published yet"
      >
        {label} · Coming soon
      </span>
    );
  }

  return (
    <a href={href} className={`${className} no-underline`} download>
      {label}
    </a>
  );
}

export function DownloadCtas() {
  const { isDesktop, ready } = useDesktopClient();
  const [latest, setLatest] = useState<DesktopLatest | null>(null);
  const [os, setOs] = useState<OsKind>("other");
  const [openingPlay, setOpeningPlay] = useState(false);

  useEffect(() => {
    setOs(detectOs());
    let cancelled = false;
    void fetchDesktopLatest({ cache: "no-store" }).then((data) => {
      if (!cancelled) setLatest(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const win = latest?.windows.x64;
  const mac = latest?.mac.universal;
  const winOk = hasDownloadUrl(win);
  const macOk = hasDownloadUrl(mac);

  const platformOrder = useMemo(() => {
    const windows = {
      key: "windows" as const,
      label: "Download for Windows",
      href: winOk ? win!.url : null,
      available: winOk,
    };
    const macintosh = {
      key: "mac" as const,
      label: "Download for Mac",
      href: macOk ? mac!.url : null,
      available: macOk,
    };
    if (os === "mac") return [macintosh, windows];
    return [windows, macintosh];
  }, [os, win, mac, winOk, macOk]);

  if (!ready) {
    return (
      <div className="hero-reveal hero-reveal-delay-2 mt-10 flex flex-col items-center gap-3">
        <span
          className="btn-primary inline-flex min-w-[12rem] cursor-wait items-center justify-center opacity-55"
          aria-busy="true"
        >
          Loading…
        </span>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="hero-reveal hero-reveal-delay-2 mt-10 flex flex-col items-center gap-3">
        {/* Hard navigation avoids soft-nav blank shells when a SW was active. */}
        <a
          href="/play"
          className="btn-primary inline-flex min-w-[12rem] items-center justify-center no-underline"
          aria-disabled={openingPlay}
          onClick={(e) => {
            if (openingPlay) {
              e.preventDefault();
              return;
            }
            setOpeningPlay(true);
          }}
        >
          {openingPlay ? "Opening…" : "Open Play"}
        </a>
        <p className="text-xs text-[var(--mist)]">
          Desktop client{latest?.version ? ` · v${latest.version}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="hero-reveal hero-reveal-delay-2 mt-10 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:items-center">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
        {platformOrder.map((cta, i) => (
          <DownloadCta
            key={cta.key}
            label={cta.label}
            href={cta.href}
            available={cta.available}
            primary={i === 0}
          />
        ))}
      </div>
      <p className="text-center text-xs text-[var(--mist)]">
        Play only in the desktop app
        {" · "}
        <Link href="/download" className="text-[var(--brass)] hover:underline">
          Installer help
        </Link>
      </p>
    </div>
  );
}
