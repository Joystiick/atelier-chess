"use client";

import type { BoardPiece } from "@/components/board/ChessBoard";
import Image from "next/image";

const NAMES: Record<BoardPiece["type"], string> = {
  k: "King",
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
  p: "Pawn",
};

type ChessPieceProps = {
  type: BoardPiece["type"];
  color: BoardPiece["color"];
  className?: string;
  size?: number;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

export function ChessPiece({
  type,
  color,
  className = "",
  size = 64,
  draggable = false,
  onDragStart,
  onDragEnd,
}: ChessPieceProps) {
  const key = `${color}${type.toUpperCase()}`;
  const label = `${color === "w" ? "White" : "Black"} ${NAMES[type]}`;

  return (
    <Image
      src={`/pieces/${key}.svg`}
      alt={label}
      width={size}
      height={size}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", key);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`piece-asset pointer-events-auto select-none drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)] ${className}`}
      priority={false}
      unoptimized
    />
  );
}

export function pieceSrc(color: "w" | "b", type: string) {
  return `/pieces/${color}${type.toUpperCase()}.svg`;
}
