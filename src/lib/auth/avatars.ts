export const AVATARS = [
  { id: "knight-brass", label: "Brass Knight", emoji: "♞" },
  { id: "queen-cream", label: "Cream Queen", emoji: "♛" },
  { id: "rook-moss", label: "Moss Rook", emoji: "♜" },
  { id: "bishop-ink", label: "Ink Bishop", emoji: "♝" },
  { id: "pawn-gold", label: "Gold Pawn", emoji: "♟" },
  { id: "king-ember", label: "Ember King", emoji: "♚" },
  { id: "star-salon", label: "Salon Star", emoji: "✦" },
  { id: "lamp-glow", label: "Lamp", emoji: "🕯" },
  { id: "leaf", label: "Atelier Leaf", emoji: "🌿" },
  { id: "mask", label: "Opera Mask", emoji: "🎭" },
  { id: "compass", label: "Compass", emoji: "◎" },
  { id: "quill", label: "Quill", emoji: "✒" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export function isAvatarId(v: string): v is AvatarId {
  return AVATARS.some((a) => a.id === v);
}

export function avatarEmoji(id: string): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? "♞";
}
