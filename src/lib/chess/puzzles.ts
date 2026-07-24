/** Built-in puzzles so daily/rush work without a DB seed. */
export type BuiltInPuzzle = {
  id: string;
  fen: string;
  /** UCI moves the solver must play (opponent replies auto-applied between) */
  solution: string[];
  title: string;
  rating: number;
};

export const BUILTIN_PUZZLES: BuiltInPuzzle[] = [
  {
    id: "mate1-backrank",
    fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    title: "Back-rank mate",
    rating: 800,
  },
  {
    id: "mate1-scholar",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["h5f7"],
    title: "Scholar's mate",
    rating: 600,
  },
  {
    id: "mate1-corridor",
    fen: "6rk/6pp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    title: "Corridor mate",
    rating: 900,
  },
  {
    id: "mate1-queen",
    fen: "5k2/8/5K2/8/8/8/8/7Q w - - 0 1",
    solution: ["h1h8"],
    title: "Queen mate",
    rating: 500,
  },
  {
    id: "mate1-rook",
    fen: "7k/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    title: "Rook on the eighth",
    rating: 700,
  },
  {
    id: "mate1-ladder",
    fen: "7k/8/8/8/8/8/5PPP/4RRK1 w - - 0 1",
    solution: ["e1e8"],
    title: "Ladder start",
    rating: 850,
  },
  {
    id: "mate1-skewer",
    fen: "4k3/8/8/8/8/8/4R3/4K2R w K - 0 1",
    solution: ["h1h8"],
    title: "Rook check",
    rating: 950,
  },
  {
    id: "mate1-two-rooks",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R3K2R w KQ - 0 1",
    solution: ["h1h8"],
    title: "Rook to the corner",
    rating: 750,
  },
];

export function puzzleOfTheDay(date = new Date()): BuiltInPuzzle {
  const day = Math.floor(date.getTime() / 86_400_000);
  return BUILTIN_PUZZLES[day % BUILTIN_PUZZLES.length]!;
}

export function shufflePuzzles(count = 8): BuiltInPuzzle[] {
  const copy = [...BUILTIN_PUZZLES];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(count, copy.length));
}
