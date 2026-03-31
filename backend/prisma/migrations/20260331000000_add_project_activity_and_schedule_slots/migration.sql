-- CreateTable
CREATE TABLE "ProjectActivityLog" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "phaseId" INTEGER,
    "memberId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'PROJECT',
    "actionType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScheduleSlot" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "memberId" INTEGER NOT NULL,
    "createdByMemberId" INTEGER,
    "title" TEXT,
    "notes" TEXT,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectActivityLog_projectId_idx" ON "ProjectActivityLog"("projectId");

-- CreateIndex
CREATE INDEX "ProjectActivityLog_taskId_idx" ON "ProjectActivityLog"("taskId");

-- CreateIndex
CREATE INDEX "ProjectActivityLog_phaseId_idx" ON "ProjectActivityLog"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectActivityLog_memberId_idx" ON "ProjectActivityLog"("memberId");

-- CreateIndex
CREATE INDEX "ProjectActivityLog_projectId_createdAt_idx" ON "ProjectActivityLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivityLog_actionType_idx" ON "ProjectActivityLog"("actionType");

-- CreateIndex
CREATE INDEX "ProjectActivityLog_entityType_idx" ON "ProjectActivityLog"("entityType");

-- CreateIndex
CREATE INDEX "ProjectScheduleSlot_projectId_idx" ON "ProjectScheduleSlot"("projectId");

-- CreateIndex
CREATE INDEX "ProjectScheduleSlot_taskId_idx" ON "ProjectScheduleSlot"("taskId");

-- CreateIndex
CREATE INDEX "ProjectScheduleSlot_memberId_idx" ON "ProjectScheduleSlot"("memberId");

-- CreateIndex
CREATE INDEX "ProjectScheduleSlot_startDateTime_idx" ON "ProjectScheduleSlot"("startDateTime");

-- CreateIndex
CREATE INDEX "ProjectScheduleSlot_endDateTime_idx" ON "ProjectScheduleSlot"("endDateTime");

-- CreateIndex
CREATE INDEX "ProjectScheduleSlot_projectId_memberId_startDateTime_idx" ON "ProjectScheduleSlot"("projectId", "memberId", "startDateTime");

-- AddForeignKey
ALTER TABLE "ProjectActivityLog" ADD CONSTRAINT "ProjectActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityLog" ADD CONSTRAINT "ProjectActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityLog" ADD CONSTRAINT "ProjectActivityLog_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivityLog" ADD CONSTRAINT "ProjectActivityLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleSlot" ADD CONSTRAINT "ProjectScheduleSlot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleSlot" ADD CONSTRAINT "ProjectScheduleSlot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleSlot" ADD CONSTRAINT "ProjectScheduleSlot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleSlot" ADD CONSTRAINT "ProjectScheduleSlot_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
