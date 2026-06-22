-- CreateTable
CREATE TABLE "EventFile" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "folderId" INTEGER,
    "uploadedByMemberId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "githubPath" TEXT NOT NULL,
    "githubSha" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventFileComment" (
    "id" SERIAL NOT NULL,
    "fileId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFileComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventFolder" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "createdByMemberId" INTEGER NOT NULL,
    "folderName" TEXT NOT NULL,
    "githubPath" TEXT NOT NULL,
    "githubSha" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventFile_eventId_idx" ON "EventFile"("eventId");

-- CreateIndex
CREATE INDEX "EventFile_folderId_idx" ON "EventFile"("folderId");

-- CreateIndex
CREATE INDEX "EventFile_uploadedByMemberId_idx" ON "EventFile"("uploadedByMemberId");

-- CreateIndex
CREATE INDEX "EventFileComment_fileId_idx" ON "EventFileComment"("fileId");

-- CreateIndex
CREATE INDEX "EventFileComment_memberId_idx" ON "EventFileComment"("memberId");

-- CreateIndex
CREATE INDEX "EventFileComment_fileId_createdAt_idx" ON "EventFileComment"("fileId", "createdAt");

-- CreateIndex
CREATE INDEX "EventFolder_eventId_idx" ON "EventFolder"("eventId");

-- CreateIndex
CREATE INDEX "EventFolder_eventId_isActive_idx" ON "EventFolder"("eventId", "isActive");

-- CreateIndex
CREATE INDEX "EventFolder_createdByMemberId_idx" ON "EventFolder"("createdByMemberId");

-- AddForeignKey
ALTER TABLE "EventFile" ADD CONSTRAINT "EventFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFile" ADD CONSTRAINT "EventFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "EventFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFile" ADD CONSTRAINT "EventFile_uploadedByMemberId_fkey" FOREIGN KEY ("uploadedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFileComment" ADD CONSTRAINT "EventFileComment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "EventFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFileComment" ADD CONSTRAINT "EventFileComment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFolder" ADD CONSTRAINT "EventFolder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFolder" ADD CONSTRAINT "EventFolder_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
