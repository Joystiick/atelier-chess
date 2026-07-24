/** Tiny opening book: SAN sequence → name */
const OPENINGS: { moves: string[]; name: string }[] = [
  { moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"], name: "Italian Game" },
  { moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"], name: "Ruy Lopez" },
  { moves: ["e4", "e5", "Nf3", "Nc6", "d4"], name: "Scotch Game" },
  { moves: ["e4", "c5"], name: "Sicilian Defense" },
  { moves: ["e4", "e6"], name: "French Defense" },
  { moves: ["e4", "c6"], name: "Caro-Kann Defense" },
  { moves: ["e4", "e5", "Nf3", "Nf6"], name: "Petrov's Defense" },
  { moves: ["d4", "d5", "c4"], name: "Queen's Gambit" },
  { moves: ["d4", "Nf6", "c4", "g6"], name: "King's Indian setup" },
  { moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"], name: "Nimzo-Indian" },
  { moves: ["d4", "d5"], name: "Closed Game" },
  { moves: ["e4", "e5", "f4"], name: "King's Gambit" },
  { moves: ["e4", "e5", "Nf3", "Nc6", "Nc3", "Nf6"], name: "Four Knights" },
  { moves: ["c4"], name: "English Opening" },
  { moves: ["Nf3"], name: "Réti / flexible" },
  { moves: ["e4"], name: "King's Pawn" },
  { moves: ["d4"], name: "Queen's Pawn" },
];

export function detectOpening(sans: string[]): string | null {
  if (sans.length === 0) return null;
  let best: string | null = null;
  let bestLen = 0;
  for (const o of OPENINGS) {
    if (o.moves.length > sans.length) continue;
    if (o.moves.length <= bestLen) continue;
    const match = o.moves.every((m, i) => sans[i] === m);
    if (match) {
      best = o.name;
      bestLen = o.moves.length;
    }
  }
  return best;
}
