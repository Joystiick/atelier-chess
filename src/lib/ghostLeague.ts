/** Soft seasonal ladder bands for Ghost League (not harsh ranked). */

export type SoftRankId =
  | "cafe-regular"
  | "salon-regular"
  | "house-favorite"
  | "atelier-darling";

export type SoftRank = {
  id: SoftRankId;
  label: string;
  minElo: number;
  maxElo: number | null;
};

export const SOFT_RANKS: SoftRank[] = [
  {
    id: "cafe-regular",
    label: "Caf├® Regular",
    minElo: 0,
    maxElo: 1199,
  },
  {
    id: "salon-regular",
    label: "Salon Regular",
    minElo: 1200,
    maxElo: 1399,
  },
  {
    id: "house-favorite",
    label: "House Favorite",
    minElo: 1400,
    maxElo: 1599,
  },
  {
    id: "atelier-darling",
    label: "Atelier Darling",
    minElo: 1600,
    maxElo: null,
  },
];

export function softRankForSeasonElo(seasonElo: number): SoftRank {
  const elo = Number.isFinite(seasonElo) ? seasonElo : 1200;
  for (let i = SOFT_RANKS.length - 1; i >= 0; i--) {
    const band = SOFT_RANKS[i]!;
    if (elo >= band.minElo) return band;
  }
  return SOFT_RANKS[0]!;
}

export function formatSeasonLabel(seasonKey: string) {
  if (!/^\d{4}-\d{2}$/.test(seasonKey)) return seasonKey || "ÔÇö";
  const [y, m] = seasonKey.split("-");
  const month = Number(m);
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${names[month - 1] ?? m} ${y}`;
}

export function effectiveSeasonElo(
  seasonKey: string,
  seasonElo: number,
  currentKey: string,
) {
  if (seasonKey === currentKey) return seasonElo;
  return 1200;
}
