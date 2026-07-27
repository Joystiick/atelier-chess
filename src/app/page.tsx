import { UserChip } from "@/components/auth/AuthProvider";
import { PlayButton } from "@/components/home/PlayButton";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hero">
      <div className="absolute right-4 top-4 z-10">
        <UserChip />
      </div>
      <div className="hero-stage">
        <h1 className="brand">Atelier</h1>
        <p className="brand-sub">
          Play a friend with a code, or face the AI.
        </p>
        <PlayButton />
        <p className="mt-6 text-sm">
          <Link href="/how-to" className="text-[var(--brass)] hover:underline">
            How to play
          </Link>
          {" · "}
          <Link href="/friends" className="text-[var(--brass)] hover:underline">
            Friends
          </Link>
          {" · "}
          <Link href="/login" className="text-[var(--brass)] hover:underline">
            Account
          </Link>
        </p>
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
