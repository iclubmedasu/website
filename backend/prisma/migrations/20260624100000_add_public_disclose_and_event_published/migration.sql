-- AlterTable
ALTER TABLE "Project" ADD COLUMN "isDisclosed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "isDisclosed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: active events with PUBLISHED status remain registerable on the public site
UPDATE "Event"
SET "isPublished" = true
WHERE "status" = 'PUBLISHED' AND "isArchived" = false;

-- CreateIndex
CREATE INDEX "Project_isDisclosed_idx" ON "Project"("isDisclosed");

-- CreateIndex
CREATE INDEX "Event_isPublished_idx" ON "Event"("isPublished");
CREATE INDEX "Event_isDisclosed_idx" ON "Event"("isDisclosed");
