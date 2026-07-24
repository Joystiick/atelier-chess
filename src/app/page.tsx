import { PlayButton } from "@/components/home/PlayButton";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero">
      <div className="hero-stage">
        <h1 className="brand">Atelier</h1>
        <p className="brand-sub">
          Play a friend with a code, or face the AI.
        </p>
        <PlayButton />
        <p className="mt-8 text-xs text-[var(--mist)]">
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
      </div>
    </main>
  );
}
