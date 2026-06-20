-- AlterTable
ALTER TABLE "Event" ADD COLUMN "isFinalized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Event_isFinalized_idx" ON "Event"("isFinalized");
CREATE INDEX "Event_isArchived_idx" ON "Event"("isArchived");
