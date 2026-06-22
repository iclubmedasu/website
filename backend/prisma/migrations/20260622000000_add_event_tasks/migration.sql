-- CreateTable
CREATE TABLE "EventTask" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "leaderId" INTEGER,
    "createdByMemberId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "taskDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTaskAssignment" (
    "id" SERIAL NOT NULL,
    "eventTaskId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTask_eventId_idx" ON "EventTask"("eventId");

-- CreateIndex
CREATE INDEX "EventTask_leaderId_idx" ON "EventTask"("leaderId");

-- CreateIndex
CREATE INDEX "EventTask_eventId_taskDate_idx" ON "EventTask"("eventId", "taskDate");

-- CreateIndex
CREATE INDEX "EventTaskAssignment_eventTaskId_idx" ON "EventTaskAssignment"("eventTaskId");

-- CreateIndex
CREATE INDEX "EventTaskAssignment_memberId_idx" ON "EventTaskAssignment"("memberId");

-- CreateIndex
CREATE INDEX "EventTaskAssignment_startDateTime_idx" ON "EventTaskAssignment"("startDateTime");

-- CreateIndex
CREATE INDEX "EventTaskAssignment_endDateTime_idx" ON "EventTaskAssignment"("endDateTime");

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "EventTask_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "EventTask_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTask" ADD CONSTRAINT "EventTask_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTaskAssignment" ADD CONSTRAINT "EventTaskAssignment_eventTaskId_fkey" FOREIGN KEY ("eventTaskId") REFERENCES "EventTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTaskAssignment" ADD CONSTRAINT "EventTaskAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
