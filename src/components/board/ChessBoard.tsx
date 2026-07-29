import { ChessPiece } from "@/components/board/ChessPiece";
import { FILES, RANKS } from "@/lib/chess/pieces";
import { BOARD_THEMES, type BoardTheme } from "@/lib/names";
import type { Square } from "chess.js";
import { useEffect, useMemo, useRef, useState } from "react";

export type BoardPiece = {
  square: Square;
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: "w" | "b";
};

type ChessBoardProps = {
  pieces: BoardPiece[];
  orientation?: "white" | "black";
  selected?: Square | null;
  legalTargets?: Square[];
  lastMove?: { from: Square; to: Square } | null;
  inCheckSquare?: Square | null;
  interactive?: boolean;
  theme?: BoardTheme;
  showArrow?: boolean;
  vignette?: boolean;
  /** Ghost board for blindfold — keep highlights, hide pieces */
  hidePieces?: boolean;
  onSquareClick?: (square: Square) => void;
};

function themeColors(theme: BoardTheme) {
  const t = BOARD_THEMES[theme];
  return {
    light: t.light,
    dark: t.dark,
    selected: "rgba(201, 162, 39, 0.55)",
    target: "rgba(244, 228, 180, 0.55)",
    last: "rgba(180, 140, 40, 0.35)",
    check: "rgba(190, 50, 40, 0.55)",
  };
}

function squareToGrid(
  square: Square,
  orientation: "white" | "black",
): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  if (orientation === "white") {
    return { col: file, row: 7 - rank };
  }
  return { col: 7 - file, row: rank };
}

function arrowPoints(
  from: Square,
  to: Square,
  orientation: "white" | "black",
  size: number,
) {
  const a = squareToGrid(from, orientation);
  const b = squareToGrid(to, orientation);
  const x1 = (a.col + 0.5) * size;
  const y1 = (a.row + 0.5) * size;
  const x2 = (b.col + 0.5) * size;
  const y2 = (b.row + 0.5) * size;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = size * 0.22;
  const hx1 = x2 - head * Math.cos(angle - 0.45);
  const hy1 = y2 - head * Math.sin(angle - 0.45);
  const hx2 = x2 - head * Math.cos(angle + 0.45);
  const hy2 = y2 - head * Math.sin(angle + 0.45);
  return { x1, y1, x2, y2, hx1, hy1, hx2, hy2 };
}

export function ChessBoard({
  pieces,
  orientation = "white",
  selected = null,
  legalTargets = [],
  lastMove = null,
  inCheckSquare = null,
  interactive = true,
  theme = "salon-emerald",
  showArrow = true,
  vignette = false,
  hidePieces = false,
  onSquareClick,
}: ChessBoardProps) {
  const [dragging, setDragging] = useState<Square | null>(null);
  const [fly, setFly] = useState<{
    piece: BoardPiece;
    cell: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const [boardSize, setBoardSize] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const prevMove = useRef<string | null>(null);
  const colors = themeColors(theme);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardSize(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pieceMap = useMemo(() => {
    const map = new Map<string, BoardPiece>();
    for (const p of pieces) map.set(p.square, p);
    return map;
  }, [pieces]);

  const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();
  const files = orientation === "white" ? FILES : [...FILES].reverse();

  useEffect(() => {
    if (!lastMove || boardSize <= 0) return;
    const key = `${lastMove.from}${lastMove.to}`;
    if (prevMove.current === key) return;
    prevMove.current = key;

    const moved = pieces.find((p) => p.square === lastMove.to);
    if (!moved) return;

    const size = boardSize / 8;
    const from = squareToGrid(lastMove.from, orientation);
    const to = squareToGrid(lastMove.to, orientation);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    setFly({
      piece: moved,
      cell: size,
      from: { x: from.col * size, y: from.row * size },
      to: { x: from.col * size, y: from.row * size },
    });

    const id = requestAnimationFrame(() => {
      setFly({
        piece: moved,
        cell: size,
        from: { x: from.col * size, y: from.row * size },
        to: { x: to.col * size, y: to.row * size },
      });
    });
    const clear = window.setTimeout(() => setFly(null), 200);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(clear);
    };
  }, [lastMove, pieces, orientation, boardSize]);

  const hideSquare = fly ? lastMove?.to : null;
  const frameMod = BOARD_THEMES[theme].frame;
  const frameClass = ["board-frame", frameMod].filter(Boolean).join(" ");

  return (
    <div
      ref={boardRef}
      className={`${frameClass} relative aspect-square w-full max-w-[min(92vw,560px)] overflow-hidden rounded-sm shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/10`}
      role="grid"
      aria-label="Chess board"
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {ranks.map((rank, ri) =>
          files.map((file, fi) => {
            const square = `${file}${rank}` as Square;
            const piece = pieceMap.get(square);
            const isDark = (fi + ri) % 2 === 1;
            const isSelected = selected === square || dragging === square;
            const isTarget = legalTargets.includes(square);
            const isLast =
              Boolean(lastMove) &&
              (lastMove!.from === square || lastMove!.to === square);
            const isCheck = inCheckSquare === square;
            const labelCoord = isDark ? "text-white/50" : "text-black/45";
            const showPiece = !hidePieces && piece && square !== hideSquare;

            return (
              <button
                key={square}
                type="button"
                role="gridcell"
                aria-label={
                  piece
                    ? `${square}, ${piece.color === "w" ? "white" : "black"} ${piece.type}`
                    : square
                }
                disabled={!interactive}
                onClick={() => onSquareClick?.(square)}
                onDragOver={(e) => {
                  if (interactive) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(null);
                  onSquareClick?.(square);
                }}
                className="relative flex items-center justify-center border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)] focus-visible:ring-inset"
                style={{
                  background: isDark ? colors.dark : colors.light,
                  cursor: interactive ? "pointer" : "default",
                }}
              >
                {isLast && (
                  <span className="absolute inset-0" style={{ background: colors.last }} />
                )}
                {isSelected && (
                  <span className="absolute inset-0" style={{ background: colors.selected }} />
                )}
                {isCheck && (
                  <span
                    className="absolute inset-0 animate-pulse"
                    style={{ background: colors.check }}
                  />
                )}
                {isTarget && !piece && (
                  <span
                    className="absolute h-[26%] w-[26%] rounded-full"
                    style={{ background: colors.target }}
                  />
                )}
                {isTarget && piece && (
                  <span
                    className="absolute inset-[6%] rounded-[4px]"
                    style={{ boxShadow: `inset 0 0 0 3px ${colors.target}` }}
                  />
                )}
                {showPiece && (
                  <span className="relative z-[1] flex h-[86%] w-[86%] items-center justify-center">
                    <ChessPiece
                      type={piece.type}
                      color={piece.color}
                      size={72}
                      draggable={interactive}
                      className="h-full w-full object-contain"
                      onDragStart={() => {
                        setDragging(square);
                        onSquareClick?.(square);
                      }}
                      onDragEnd={() => setDragging(null)}
                    />
                  </span>
                )}
                {fi === 0 && (
                  <span className={`absolute left-1 top-0.5 text-[10px] font-semibold ${labelCoord}`}>
                    {rank}
                  </span>
                )}
                {ri === 7 && (
                  <span className={`absolute bottom-0.5 right-1 text-[10px] font-semibold ${labelCoord}`}>
                    {file}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {fly && !hidePieces && (
        <div
          className="piece-flying flex items-center justify-center"
          style={{
            width: fly.cell,
            height: fly.cell,
            transform: `translate(${fly.to.x}px, ${fly.to.y}px)`,
          }}
        >
          <ChessPiece
            type={fly.piece.type}
            color={fly.piece.color}
            size={72}
            className="h-[86%] w-[86%] object-contain"
          />
        </div>
      )}

      {showArrow && lastMove && boardSize > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
          viewBox={`0 0 ${boardSize} ${boardSize}`}
          aria-hidden
        >
          {(() => {
            const a = arrowPoints(lastMove.from, lastMove.to, orientation, boardSize / 8);
            return (
              <g opacity={0.75}>
                <line
                  x1={a.x1}
                  y1={a.y1}
                  x2={a.x2}
                  y2={a.y2}
                  stroke="rgba(201,162,39,0.85)"
                  strokeWidth={boardSize / 48}
                  strokeLinecap="round"
                />
                <polygon
                  points={`${a.x2},${a.y2} ${a.hx1},${a.hy1} ${a.hx2},${a.hy2}`}
                  fill="rgba(201,162,39,0.9)"
                />
              </g>
            );
          })()}
        </svg>
      )}

      {vignette && (
        <div
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.45) 100%)",
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
