-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdByMemberId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeam" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTag" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "tagName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "parentTaskId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTeam" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "assignedBy" INTEGER,
    "isSelfAssigned" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "tagType" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "dependsOnTaskId" INTEGER NOT NULL,
    "dependencyType" TEXT NOT NULL DEFAULT 'FINISH_TO_START',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityLog" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_createdByMemberId_idx" ON "Project"("createdByMemberId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_dueDate_idx" ON "Project"("dueDate");

-- CreateIndex
CREATE INDEX "Project_priority_idx" ON "Project"("priority");

-- CreateIndex
CREATE INDEX "ProjectTeam_projectId_idx" ON "ProjectTeam"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTeam_teamId_idx" ON "ProjectTeam"("teamId");

-- CreateIndex
CREATE INDEX "ProjectTeam_projectId_canEdit_idx" ON "ProjectTeam"("projectId", "canEdit");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeam_projectId_teamId_key" ON "ProjectTeam"("projectId", "teamId");

-- CreateIndex
CREATE INDEX "ProjectTag_projectId_idx" ON "ProjectTag"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTag_tagName_idx" ON "ProjectTag"("tagName");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTag_projectId_tagName_key" ON "ProjectTag"("projectId", "tagName");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "TaskTeam_taskId_idx" ON "TaskTeam"("taskId");

-- CreateIndex
CREATE INDEX "TaskTeam_teamId_idx" ON "TaskTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTeam_taskId_teamId_key" ON "TaskTeam"("taskId", "teamId");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_idx" ON "TaskAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignment_memberId_idx" ON "TaskAssignment"("memberId");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_status_idx" ON "TaskAssignment"("taskId", "status");

-- CreateIndex
CREATE INDEX "TaskAssignment_memberId_status_idx" ON "TaskAssignment"("memberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_memberId_key" ON "TaskAssignment"("taskId", "memberId");

-- CreateIndex
CREATE INDEX "TaskTag_taskId_idx" ON "TaskTag"("taskId");

-- CreateIndex
CREATE INDEX "TaskTag_tagName_idx" ON "TaskTag"("tagName");

-- CreateIndex
CREATE INDEX "TaskTag_taskId_tagType_idx" ON "TaskTag"("taskId", "tagType");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_taskId_tagName_key" ON "TaskTag"("taskId", "tagName");

-- CreateIndex
CREATE INDEX "TaskDependency_taskId_idx" ON "TaskDependency"("taskId");

-- CreateIndex
CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "TaskDependency"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "TaskDependency"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "TaskComment_memberId_idx" ON "TaskComment"("memberId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivityLog_taskId_idx" ON "TaskActivityLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskActivityLog_memberId_idx" ON "TaskActivityLog"("memberId");

-- CreateIndex
CREATE INDEX "TaskActivityLog_taskId_createdAt_idx" ON "TaskActivityLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivityLog_actionType_idx" ON "TaskActivityLog"("actionType");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTeam" ADD CONSTRAINT "TaskTeam_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTeam" ADD CONSTRAINT "TaskTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
