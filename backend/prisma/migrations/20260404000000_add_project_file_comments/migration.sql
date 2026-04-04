-- CreateTable
CREATE TABLE "ProjectFileComment" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFileComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFileComment_fileId_idx" ON "ProjectFileComment"("fileId");

-- CreateIndex
CREATE INDEX "ProjectFileComment_memberId_idx" ON "ProjectFileComment"("memberId");

-- CreateIndex
CREATE INDEX "ProjectFileComment_fileId_createdAt_idx" ON "ProjectFileComment"("fileId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectFileComment" ADD CONSTRAINT "ProjectFileComment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "ProjectFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFileComment" ADD CONSTRAINT "ProjectFileComment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
