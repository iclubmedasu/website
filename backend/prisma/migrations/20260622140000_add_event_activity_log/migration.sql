-- CreateTable
CREATE TABLE "EventActivityLog" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "eventTaskId" INTEGER,
    "memberId" INTEGER,
    "entityType" TEXT NOT NULL DEFAULT 'EVENT',
    "actionType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventActivityLog_eventId_idx" ON "EventActivityLog"("eventId");

-- CreateIndex
CREATE INDEX "EventActivityLog_eventTaskId_idx" ON "EventActivityLog"("eventTaskId");

-- CreateIndex
CREATE INDEX "EventActivityLog_memberId_idx" ON "EventActivityLog"("memberId");

-- CreateIndex
CREATE INDEX "EventActivityLog_eventId_createdAt_idx" ON "EventActivityLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventActivityLog_actionType_idx" ON "EventActivityLog"("actionType");

-- CreateIndex
CREATE INDEX "EventActivityLog_entityType_idx" ON "EventActivityLog"("entityType");

-- AddForeignKey
ALTER TABLE "EventActivityLog" ADD CONSTRAINT "EventActivityLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivityLog" ADD CONSTRAINT "EventActivityLog_eventTaskId_fkey" FOREIGN KEY ("eventTaskId") REFERENCES "EventTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventActivityLog" ADD CONSTRAINT "EventActivityLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
