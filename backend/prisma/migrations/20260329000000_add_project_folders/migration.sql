-- Add project folders and make project files folder-aware

-- CreateTable
CREATE TABLE "ProjectFolder" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdByMemberId" INTEGER NOT NULL,
    "folderName" TEXT NOT NULL,
    "githubPath" TEXT NOT NULL,
    "githubSha" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFolder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ProjectFile" ADD COLUMN "folderId" INTEGER;

-- CreateIndex
CREATE INDEX "ProjectFolder_projectId_idx" ON "ProjectFolder"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFolder_projectId_isActive_idx" ON "ProjectFolder"("projectId", "isActive");

-- CreateIndex
CREATE INDEX "ProjectFolder_createdByMemberId_idx" ON "ProjectFolder"("createdByMemberId");

-- CreateIndex
CREATE INDEX "ProjectFile_folderId_idx" ON "ProjectFile"("folderId");

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFolder" ADD CONSTRAINT "ProjectFolder_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
