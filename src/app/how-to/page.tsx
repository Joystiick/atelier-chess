import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to play · Atelier Chess",
  description: "Quick rules and controls for Atelier Chess.",
};

export default function HowToPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link href="/download" className="text-sm text-[var(--mist)] hover:text-[var(--brass)]">
        ← Download
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-[var(--cream)]">
        How to play
      </h1>
      <div className="mt-6 space-y-4 text-[var(--mist)]">
        <p>
          Atelier is a desktop chess client — download for Windows or Mac, then
          open tables with room codes, friends, AI, and puzzles. Phones can still
          scan a QR to join or watch.
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Human tables
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sign in is required to play (AI, human tables, and friends).</li>
          <li>Create a table, share the 8-digit code, or invite a friend from your list.</li>
          <li>Pick a time control before creating (Unlimited, 3+2, 5+0, 10+0, 15+10).</li>
          <li>Offer draw, takeback, or abort early; resign later.</li>
          <li>Open <code className="text-[var(--brass)]">?spectate=1</code> to watch.</li>
        </ul>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          LAN party tables
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Create a <strong className="text-[var(--cream)]">LAN party table</strong>{" "}
            from the lobby when everyone is in the same room.
          </li>
          <li>
            Seat claim still uses the QR / join link (works on the same Wi‑Fi). Moves
            sync through Atelier&apos;s cloud — this is not peer-to-peer WebRTC.
          </li>
          <li>
            LAN tables show a <strong className="text-[var(--cream)]">LAN</strong>{" "}
            badge and poll less often when live updates are connected, to ease
            shared networks.
          </li>
        </ul>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Variants café
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Weekly special rotates Chess960 and antichess (café lite — capture
            mandatory when available).
          </li>
          <li>Variant tables are unrated. Chess960 shuffles the back rank; castling is best-effort.</li>
        </ul>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Watch &amp; broadcast
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Open <code className="text-[var(--brass)]">/watch/CODE?overlay=1</code>{" "}
            (or <code className="text-[var(--brass)]">/broadcast/CODE</code>) for an OBS-friendly board.
          </li>
        </ul>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Board controls
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Click or drag pieces. Arrow keys move the selection; Enter plays the only legal target.</li>
          <li>Themes unlock as you finish games. Ambient and lamp are cosmetic.</li>
          <li>Copy PGN or open Analyze after a game. Elo is stored on this device only.</li>
        </ul>
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          Pieces &amp; engine
        </h2>
        <p>
          Piece art based on Lichess Cburnett SVGs (multi-license). AI uses Garbochess-JS (BSD).
        </p>
      </div>
      <Link href="/download" className="btn-primary mt-8 inline-block">
        Download the app
      </Link>
    </main>
  );
}
