import {
  boolean,
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
    rated: boolean("rated").notNull().default(true),
    correspondence: boolean("correspondence").notNull().default(false),
    passwordHash: text("password_hash"),
    maxSpectators: integer("max_spectators").notNull().default(50),
    revealNames: boolean("reveal_names").notNull().default(true),
    clubId: uuid("club_id"),
    arenaId: uuid("arena_id"),
    banterLog: text("banter_log").notNull().default(""),
    /** One-time seat claim for QR join */
    joinTicket: text("join_ticket"),
    handoffWhite: text("handoff_white"),
    handoffBlack: text("handoff_black"),
    blindfoldCafe: boolean("blindfold_cafe").notNull().default(false),
    salonNightId: uuid("salon_night_id"),
    /** Chat policy when seated from a salon night: all | emotes | off */
    chatMode: text("chat_mode").notNull().default("all"),
    /** Desktop table + phone seats + gallery ? Tablecast mode */
    tablecast: boolean("tablecast").notNull().default(false),
    /** Soft gallery count (join/leave heartbeats from /watch) */
    spectatorCount: integer("spectator_count").notNull().default(0),
    /** Soft seasonal ladder ? set on ghost rematch tables */
    ghostLeague: boolean("ghost_league").notNull().default(false),
    /**
     * Same-room / LAN party: QR seat claim + cloud moves with sparse polling.
     * Not a WebRTC mesh ? see /how-to.
     */
    lanMode: boolean("lan_mode").notNull().default(false),
    /** standard | chess960 | antichess */
    variant: text("variant").notNull().default("standard"),
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

export const presenceStatusEnum = pgEnum("presence_status", [
  "offline",
  "online",
  "lfg",
  "ingame",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    avatarId: text("avatar_id").notNull().default("knight-brass"),
    elo: integer("elo").notNull().default(1200),
    seasonElo: integer("season_elo").notNull().default(1200),
    seasonKey: text("season_key").notNull().default(""),
    gamesPlayed: integer("games_played").notNull().default(0),
    /** Soft Atelier Pass ? cosmetics only, no pay-to-win */
    atelierPass: boolean("atelier_pass").notNull().default(false),
    /** JSON list of theme ids unlocked via Pass (or empty) */
    passCosmetics: text("pass_cosmetics").notNull().default("[]"),
    presence: presenceStatusEnum("presence").notNull().default("offline"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activeGameCode: text("active_game_code"),
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

export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "blocked",
]);

export const friendships = pgTable(
  "friendships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("friendships_pair_idx").on(table.requesterId, table.addresseeId),
  ],
);

export const gameInviteStatusEnum = pgEnum("game_invite_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

export const gameInvites = pgTable("game_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameCode: text("game_code").notNull(),
  fromUserId: uuid("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: gameInviteStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const gameArchives = pgTable("game_archives", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  pgn: text("pgn").notNull(),
  result: text("result"),
  opponent: text("opponent"),
  rated: boolean("rated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const matchQueue = pgTable("match_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  timeControl: text("time_control").notNull().default("10|0"),
  elo: integer("elo").notNull().default(1200),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const arenaStatusEnum = pgEnum("arena_status", [
  "open",
  "running",
  "finished",
]);

export const arenas = pgTable("arenas", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  status: arenaStatusEnum("status").notNull().default("open"),
  timeControl: text("time_control").notNull().default("3|2"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const arenaPlayers = pgTable(
  "arena_players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    arenaId: uuid("arena_id")
      .notNull()
      .references(() => arenas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    gamesPlayed: integer("games_played").notNull().default(0),
    waiting: boolean("waiting").notNull().default(true),
  },
  (table) => [uniqueIndex("arena_player_idx").on(table.arenaId, table.userId)],
);

export const clubs = pgTable(
  "clubs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    openTableCode: text("open_table_code"),
    /** Always-on Tablecast House venue for this club */
    houseEnabled: boolean("house_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("clubs_slug_idx").on(table.slug)],
);

export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("club_member_idx").on(table.clubId, table.userId)],
);

export const studies = pgTable("studies", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fen: text("fen")
    .notNull()
    .default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  pgn: text("pgn").notNull().default(""),
  notes: text("notes").notNull().default(""),
  sharedWith: text("shared_with").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const puzzleSets = pgTable("puzzle_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  puzzleIds: text("puzzle_ids").notNull().default(""),
  sharedWith: text("shared_with").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const salonNightStatusEnum = pgEnum("salon_night_status", [
  "open",
  "closed",
]);

export const salonNights = pgTable(
  "salon_nights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: salonNightStatusEnum("status").notNull().default("open"),
    timeControl: text("time_control").notNull().default("10|0"),
    /** blindfold | bullet | emotes | open */
    theme: text("theme").notNull().default("open"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    /** all | emotes | off */
    chatMode: text("chat_mode").notNull().default("all"),
    /** Host-rotated featured board for salon stage / OBS */
    featuredGameCode: text("featured_game_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("salon_nights_slug_idx").on(table.slug)],
);

export const salonQueue = pgTable("salon_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  nightId: uuid("night_id")
    .notNull()
    .references(() => salonNights.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("waiting"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const kioskSessions = pgTable("kiosk_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  matchedCode: text("matched_code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Game = typeof games.$inferSelect;
export type MoveRow = typeof moves.$inferSelect;
export type Puzzle = typeof puzzles.$inferSelect;
export type User = typeof users.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type GameInvite = typeof gameInvites.$inferSelect;

