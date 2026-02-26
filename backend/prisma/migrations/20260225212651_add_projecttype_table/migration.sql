/*
  Warnings:

  - You are about to drop the column `type` on the `Project` table. All the data in the column will be lost.
  - Added the required column `projectTypeId` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "type",
ADD COLUMN     "projectTypeId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ProjectType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectType_name_key" ON "ProjectType"("name");

-- CreateIndex
CREATE INDEX "ProjectType_category_idx" ON "ProjectType"("category");

-- CreateIndex
CREATE INDEX "ProjectType_isActive_idx" ON "ProjectType"("isActive");

-- CreateIndex
CREATE INDEX "Project_projectTypeId_idx" ON "Project"("projectTypeId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
