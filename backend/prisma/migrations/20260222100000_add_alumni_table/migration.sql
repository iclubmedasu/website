-- CreateTable
CREATE TABLE "Alumni" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "roleId" INTEGER,
    "subteamId" INTEGER,
    "leaveType" TEXT NOT NULL,
    "leftDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alumni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alumni_memberId_idx" ON "Alumni"("memberId");

-- CreateIndex
CREATE INDEX "Alumni_teamId_idx" ON "Alumni"("teamId");

-- CreateIndex
CREATE INDEX "Alumni_leftDate_idx" ON "Alumni"("leftDate");

-- AddForeignKey
ALTER TABLE "Alumni" ADD CONSTRAINT "Alumni_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumni" ADD CONSTRAINT "Alumni_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumni" ADD CONSTRAINT "Alumni_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumni" ADD CONSTRAINT "Alumni_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
