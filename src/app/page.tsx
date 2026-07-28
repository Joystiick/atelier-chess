import { UserChip } from "@/components/auth/AuthProvider";
import { DownloadCtas } from "@/components/home/DownloadCtas";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Atelier Chess",
  description:
    "Download Atelier Chess for Windows and Mac — native desktop chess with room codes, friends, and AI.",
};

export default function HomePage() {
  return (
    <main>
      <section className="hero" aria-label="Atelier Chess">
        <div className="absolute right-4 top-4 z-10">
          <UserChip />
        </div>
        <div className="hero-stage">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={88}
            height={88}
            priority
            className="hero-logo hero-reveal mb-4 rounded-[1.35rem] shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-1 ring-[var(--brass-dim)]"
          />
          <h1 className="brand hero-reveal hero-reveal-delay-1">Atelier</h1>
          <p className="brand-headline hero-reveal hero-reveal-delay-1">
            Chess for your desk.
          </p>
          <p className="brand-sub hero-reveal hero-reveal-delay-2">
            Native Windows and Mac apps with the same tables, codes, and AI.
          </p>
          <DownloadCtas />
        </div>
      </section>

      <footer className="hero-foot">
        <p className="text-sm">
          <Link href="/download" className="text-[var(--brass)] hover:underline">
            Download
          </Link>
          {" · "}
          <Link href="/how-to" className="text-[var(--brass)] hover:underline">
            How to play
          </Link>
          {" · "}
          <Link href="/login" className="text-[var(--brass)] hover:underline">
            Account
          </Link>
        </p>
        <p className="mt-3 text-xs text-[var(--mist)]">
          Engine by{" "}
          <Link
            href="https://github.com/glinscott/Garbochess-JS"
            className="underline decoration-[var(--brass-dim)] underline-offset-2 hover:text-[var(--brass)]"
            target="_blank"
            rel="noreferrer"
          >
            Garbochess-JS
          </Link>
          {" · "}
          Pieces by Cburnett
        </p>
      </footer>
    </main>
  );
}
