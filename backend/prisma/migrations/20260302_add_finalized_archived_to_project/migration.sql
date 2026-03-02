ALTER TABLE "Project" ADD COLUMN "isFinalized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Project_isFinalized_idx" ON "Project"("isFinalized");
CREATE INDEX "Project_isArchived_idx" ON "Project"("isArchived");
