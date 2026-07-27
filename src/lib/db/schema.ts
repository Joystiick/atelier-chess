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
    timeControlMs: integer("time_control_ms").notNull().default(600_000),
    incrementMs: integer("increment_ms").notNull().default(0),
    drawOfferBy: text("draw_offer_by"),
    takebackOfferBy: text("takeback_offer_by"),
    whiteUserId: uuid("white_user_id"),
    blackUserId: uuid("black_user_id"),
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

export const puzzles = pgTable("puzzles", {
  id: uuid("id").defaultRandom().primaryKey(),
  fen: text("fen").notNull(),
  solution: text("solution").notNull(),
  title: text("title").notNull().default("Mate puzzle"),
  rating: integer("rating").notNull().default(1200),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarId: text("avatar_id").notNull().default("knight-brass"),
    elo: integer("elo").notNull().default(1200),
    gamesPlayed: integer("games_played").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_username_idx").on(table.username),
  ],
);

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Game = typeof games.$inferSelect;
export type MoveRow = typeof moves.$inferSelect;
export type Puzzle = typeof puzzles.$inferSelect;
export type User = typeof users.$inferSelect;
