-- AlterTable
ALTER TABLE "TeamRole" ADD COLUMN "systemRoleKey" INTEGER;

-- CreateIndex (one system role per key per team; multiple NULLs allowed for custom roles)
CREATE UNIQUE INDEX "TeamRole_teamId_systemRoleKey_key" ON "TeamRole"("teamId", "systemRoleKey");
