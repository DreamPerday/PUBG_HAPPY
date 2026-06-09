-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pubg_id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'steam',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "player_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "player_id" TEXT NOT NULL,
    "total_matches" INTEGER NOT NULL DEFAULT 0,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "total_kills" INTEGER NOT NULL DEFAULT 0,
    "total_damage" REAL NOT NULL DEFAULT 0,
    "total_headshots" INTEGER NOT NULL DEFAULT 0,
    "avg_kills" REAL NOT NULL DEFAULT 0,
    "avg_damage" REAL NOT NULL DEFAULT 0,
    "avg_survival_time" INTEGER NOT NULL DEFAULT 0,
    "kda" REAL NOT NULL DEFAULT 0,
    "win_rate" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "map_name" TEXT NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "damage" REAL NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL,
    "survival_time" INTEGER NOT NULL,
    "headshots" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "revives" INTEGER NOT NULL DEFAULT 0,
    "team_kills" INTEGER NOT NULL DEFAULT 0,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "played_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matches_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "match_telemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "match_id" TEXT NOT NULL,
    "raw_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_telemetry_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leaderboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "week" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaderboard_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "top_players" TEXT NOT NULL,
    "funny_rankings" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "player_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "players_pubg_id_key" ON "players"("pubg_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_stats_player_id_key" ON "player_stats"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_match_id_key" ON "matches"("match_id");

-- CreateIndex
CREATE INDEX "matches_player_id_played_at_idx" ON "matches"("player_id", "played_at");

-- CreateIndex
CREATE UNIQUE INDEX "match_telemetry_match_id_key" ON "match_telemetry"("match_id");

-- CreateIndex
CREATE INDEX "leaderboard_type_week_idx" ON "leaderboard"("type", "week");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_type_category_player_id_week_key" ON "leaderboard"("type", "category", "player_id", "week");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_report_week_key" ON "weekly_report"("week");

-- CreateIndex
CREATE INDEX "sync_log_player_id_created_at_idx" ON "sync_log"("player_id", "created_at");
