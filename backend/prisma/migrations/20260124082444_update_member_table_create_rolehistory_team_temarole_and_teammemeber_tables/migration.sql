/*
  Warnings:

  - You are about to drop the column `department` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Member` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phoneNumber]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId]` on the table `Member` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phoneNumber` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `Member` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Member" DROP COLUMN "department",
DROP COLUMN "role",
ADD COLUMN     "linkedInUrl" TEXT,
ADD COLUMN     "phoneNumber" TEXT NOT NULL,
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "studentId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "establishedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRole" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "roleName" TEXT NOT NULL,
    "description" TEXT,
    "maxCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "joinedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRoleHistory" (
    "id" SERIAL NOT NULL,
    "memberId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "changeReason" TEXT,
    "notes" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberRoleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "TeamRole_teamId_idx" ON "TeamRole"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRole_teamId_roleName_key" ON "TeamRole"("teamId", "roleName");

-- CreateIndex
CREATE INDEX "TeamMember_memberId_idx" ON "TeamMember"("memberId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_isActive_idx" ON "TeamMember"("teamId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_memberId_key" ON "TeamMember"("teamId", "memberId");

-- CreateIndex
CREATE INDEX "MemberRoleHistory_memberId_startDate_idx" ON "MemberRoleHistory"("memberId", "startDate");

-- CreateIndex
CREATE INDEX "MemberRoleHistory_teamId_startDate_idx" ON "MemberRoleHistory"("teamId", "startDate");

-- CreateIndex
CREATE INDEX "MemberRoleHistory_memberId_isActive_idx" ON "MemberRoleHistory"("memberId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Member_phoneNumber_key" ON "Member"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Member_studentId_key" ON "Member"("studentId");

-- AddForeignKey
ALTER TABLE "TeamRole" ADD CONSTRAINT "TeamRole_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRoleHistory" ADD CONSTRAINT "MemberRoleHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRoleHistory" ADD CONSTRAINT "MemberRoleHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRoleHistory" ADD CONSTRAINT "MemberRoleHistory_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
