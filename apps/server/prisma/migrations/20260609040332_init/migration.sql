/*
  Warnings:

  - You are about to drop the `players` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `player_id` on the `leaderboard` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `match_telemetry` table. All the data in the column will be lost.
  - You are about to drop the column `player_id` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `player_id` on the `sync_log` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `leaderboard` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pubg_id` to the `matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `sync_log` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "players_pubg_id_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "players";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "pubg_id" TEXT NOT NULL,
    "avatar" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "danmaku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ff9500',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "danmaku_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_leaderboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "score" REAL NOT NULL,
    "week" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leaderboard_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_leaderboard" ("category", "created_at", "id", "score", "type", "week") SELECT "category", "created_at", "id", "score", "type", "week" FROM "leaderboard";
DROP TABLE "leaderboard";
ALTER TABLE "new_leaderboard" RENAME TO "leaderboard";
CREATE INDEX "leaderboard_type_week_idx" ON "leaderboard"("type", "week");
CREATE UNIQUE INDEX "leaderboard_type_category_user_id_week_key" ON "leaderboard"("type", "category", "user_id", "week");
CREATE TABLE "new_match_telemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "match_id" TEXT NOT NULL,
    "raw_json" TEXT NOT NULL,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_match_telemetry" ("id", "match_id", "raw_json") SELECT "id", "match_id", "raw_json" FROM "match_telemetry";
DROP TABLE "match_telemetry";
ALTER TABLE "new_match_telemetry" RENAME TO "match_telemetry";
CREATE UNIQUE INDEX "match_telemetry_match_id_key" ON "match_telemetry"("match_id");
CREATE TABLE "new_matches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "match_id" TEXT NOT NULL,
    "pubg_id" TEXT NOT NULL,
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
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "matches_pubg_id_fkey" FOREIGN KEY ("pubg_id") REFERENCES "users" ("pubg_id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_matches" ("assists", "created_at", "damage", "headshots", "id", "kills", "map_name", "match_id", "mode", "played_at", "rank", "revives", "survival_time", "team_kills", "won") SELECT "assists", "created_at", "damage", "headshots", "id", "kills", "map_name", "match_id", "mode", "played_at", "rank", "revives", "survival_time", "team_kills", "won" FROM "matches";
DROP TABLE "matches";
ALTER TABLE "new_matches" RENAME TO "matches";
CREATE INDEX "matches_pubg_id_played_at_idx" ON "matches"("pubg_id", "played_at");
CREATE INDEX "matches_match_id_idx" ON "matches"("match_id");
CREATE UNIQUE INDEX "matches_match_id_pubg_id_key" ON "matches"("match_id", "pubg_id");
CREATE TABLE "new_player_stats" (
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
    "best_rank" INTEGER NOT NULL DEFAULT 99,
    "kda" REAL NOT NULL DEFAULT 0,
    "win_rate" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "player_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_player_stats" ("avg_damage", "avg_kills", "avg_survival_time", "id", "kda", "player_id", "total_damage", "total_headshots", "total_kills", "total_matches", "total_wins", "updated_at", "win_rate") SELECT "avg_damage", "avg_kills", "avg_survival_time", "id", "kda", "player_id", "total_damage", "total_headshots", "total_kills", "total_matches", "total_wins", "updated_at", "win_rate" FROM "player_stats";
DROP TABLE "player_stats";
ALTER TABLE "new_player_stats" RENAME TO "player_stats";
CREATE UNIQUE INDEX "player_stats_player_id_key" ON "player_stats"("player_id");
CREATE TABLE "new_sync_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_sync_log" ("created_at", "id", "message", "status") SELECT "created_at", "id", "message", "status" FROM "sync_log";
DROP TABLE "sync_log";
ALTER TABLE "new_sync_log" RENAME TO "sync_log";
CREATE INDEX "sync_log_user_id_created_at_idx" ON "sync_log"("user_id", "created_at");
CREATE TABLE "new_weekly_report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week" TEXT NOT NULL,
    "team_id" TEXT,
    "title" TEXT NOT NULL,
    "content_json" TEXT NOT NULL,
    "top_players" TEXT NOT NULL,
    "funny_rankings" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weekly_report_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_weekly_report" ("content_json", "created_at", "funny_rankings", "id", "title", "top_players", "week") SELECT "content_json", "created_at", "funny_rankings", "id", "title", "top_players", "week" FROM "weekly_report";
DROP TABLE "weekly_report";
ALTER TABLE "new_weekly_report" RENAME TO "weekly_report";
CREATE UNIQUE INDEX "weekly_report_week_team_id_key" ON "weekly_report"("week", "team_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "users_pubg_id_key" ON "users"("pubg_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE INDEX "comments_page_id_created_at_idx" ON "comments"("page_id", "created_at");

-- CreateIndex
CREATE INDEX "danmaku_page_id_created_at_idx" ON "danmaku"("page_id", "created_at");
