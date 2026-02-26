-- DropForeignKey
ALTER TABLE "Subteam" DROP CONSTRAINT "Subteam_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TeamRole" DROP CONSTRAINT "TeamRole_teamId_fkey";

-- AddForeignKey
ALTER TABLE "TeamRole" ADD CONSTRAINT "TeamRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subteam" ADD CONSTRAINT "Subteam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
