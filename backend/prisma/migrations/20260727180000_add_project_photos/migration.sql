-- CreateTable
CREATE TABLE "ProjectPhoto" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "uploadedByMemberId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "githubPath" TEXT NOT NULL,
    "githubSha" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "previewGithubPath" TEXT,
    "previewGithubSha" TEXT,
    "previewFileSize" INTEGER,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "showOnPublic" BOOLEAN NOT NULL DEFAULT true,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPhoto_projectId_idx" ON "ProjectPhoto"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPhoto_uploadedByMemberId_idx" ON "ProjectPhoto"("uploadedByMemberId");

-- AddForeignKey
ALTER TABLE "ProjectPhoto" ADD CONSTRAINT "ProjectPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhoto" ADD CONSTRAINT "ProjectPhoto_uploadedByMemberId_fkey" FOREIGN KEY ("uploadedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
