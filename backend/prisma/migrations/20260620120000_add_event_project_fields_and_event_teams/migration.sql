-- AlterTable
ALTER TABLE "Event" ADD COLUMN "projectTypeId" INTEGER;
ALTER TABLE "Event" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Event" ADD COLUMN "progressStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "EventTeam" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_projectTypeId_idx" ON "Event"("projectTypeId");
CREATE INDEX "Event_priority_idx" ON "Event"("priority");
CREATE INDEX "Event_progressStatus_idx" ON "Event"("progressStatus");
CREATE INDEX "EventTeam_eventId_idx" ON "EventTeam"("eventId");
CREATE INDEX "EventTeam_teamId_idx" ON "EventTeam"("teamId");
CREATE INDEX "EventTeam_eventId_canEdit_idx" ON "EventTeam"("eventId", "canEdit");
CREATE UNIQUE INDEX "EventTeam_eventId_teamId_key" ON "EventTeam"("eventId", "teamId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventTeam" ADD CONSTRAINT "EventTeam_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTeam" ADD CONSTRAINT "EventTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
