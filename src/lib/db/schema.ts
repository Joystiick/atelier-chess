import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const gameStatusEnum = pgEnum("game_status", [
  "waiting",
  "active",
  "finished",
  "abandoned",
]);

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    status: gameStatusEnum("status").notNull().default("waiting"),
    fen: text("fen")
      .notNull()
      .default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    pgn: text("pgn").notNull().default(""),
    turn: text("turn").notNull().default("w"),
    whiteName: text("white_name"),
    blackName: text("black_name"),
    whiteToken: text("white_token"),
    blackToken: text("black_token"),
    winner: text("winner"),
    result: text("result"),
    whiteClockMs: integer("white_clock_ms").notNull().default(600_000),
    blackClockMs: integer("black_clock_ms").notNull().default(600_000),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("games_code_idx").on(table.code)],
);

export const moves = pgTable("moves", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  ply: integer("ply").notNull(),
  uci: text("uci").notNull(),
  san: text("san").notNull(),
  fenAfter: text("fen_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Game = typeof games.$inferSelect;
export type MoveRow = typeof moves.$inferSelect;
