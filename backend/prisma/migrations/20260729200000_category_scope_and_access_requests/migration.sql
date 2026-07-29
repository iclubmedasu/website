-- AlterTable: DocumentCategory.scopeTeamId (nullable → existing folders default to org-owned)
ALTER TABLE "DocumentCategory" ADD COLUMN "scopeTeamId" INTEGER;

-- CreateTable
CREATE TABLE "DocumentCategoryAccessRequest" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" INTEGER,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentCategoryAccessRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_scopeTeamId_fkey" FOREIGN KEY ("scopeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessRequest" ADD CONSTRAINT "DocumentCategoryAccessRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessRequest" ADD CONSTRAINT "DocumentCategoryAccessRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessRequest" ADD CONSTRAINT "DocumentCategoryAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
