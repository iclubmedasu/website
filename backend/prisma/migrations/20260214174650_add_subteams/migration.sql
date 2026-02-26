-- AlterTable
ALTER TABLE "MemberRoleHistory" ADD COLUMN     "subteamId" INTEGER;

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "subteamId" INTEGER;

-- CreateTable
CREATE TABLE "Subteam" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subteam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subteam_teamId_idx" ON "Subteam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Subteam_teamId_name_key" ON "Subteam"("teamId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_subteamId_idx" ON "TeamMember"("subteamId");

-- AddForeignKey
ALTER TABLE "Subteam" ADD CONSTRAINT "Subteam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRoleHistory" ADD CONSTRAINT "MemberRoleHistory_subteamId_fkey" FOREIGN KEY ("subteamId") REFERENCES "Subteam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
