-- CreateTable
CREATE TABLE "player_relations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "player_a" TEXT NOT NULL,
    "player_b" TEXT NOT NULL,
    "together_matches" INTEGER NOT NULL DEFAULT 0,
    "total_matches_a" INTEGER NOT NULL DEFAULT 0,
    "total_matches_b" INTEGER NOT NULL DEFAULT 0,
    "relation_strength" REAL NOT NULL DEFAULT 0,
    "last_played_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "team_graph_clusters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cluster_name" TEXT NOT NULL,
    "member_pubg_ids" TEXT NOT NULL,
    "avg_strength" REAL NOT NULL DEFAULT 0,
    "stability_score" REAL NOT NULL DEFAULT 0,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "player_relations_player_a_idx" ON "player_relations"("player_a");

-- CreateIndex
CREATE INDEX "player_relations_player_b_idx" ON "player_relations"("player_b");

-- CreateIndex
CREATE UNIQUE INDEX "player_relations_player_a_player_b_key" ON "player_relations"("player_a", "player_b");
