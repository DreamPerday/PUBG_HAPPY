-- AlterTable
ALTER TABLE "matches" ADD COLUMN "participants" TEXT;

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");
