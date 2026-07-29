-- AlterEnum: DocumentCreatorRank OFFICER → ORG_LEADERSHIP
ALTER TYPE "DocumentCreatorRank" RENAME VALUE 'OFFICER' TO 'ORG_LEADERSHIP';

-- AlterTable: Document.categoryId nullable (root / uncategorized uploads)
ALTER TABLE "Document" ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocumentCategoryShare" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "sharedWithType" "DocumentShareTargetType" NOT NULL,
    "sharedWithTeamId" INTEGER,
    "sharedWithMemberId" INTEGER,
    "sharedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCategoryShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCategoryAccessGrant" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "grantedById" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCategoryAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCategoryAccessLog" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "action" "DocumentAccessAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCategoryAccessLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DocumentCategoryShare" ADD CONSTRAINT "DocumentCategoryShare_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryShare" ADD CONSTRAINT "DocumentCategoryShare_sharedWithTeamId_fkey" FOREIGN KEY ("sharedWithTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryShare" ADD CONSTRAINT "DocumentCategoryShare_sharedWithMemberId_fkey" FOREIGN KEY ("sharedWithMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryShare" ADD CONSTRAINT "DocumentCategoryShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessGrant" ADD CONSTRAINT "DocumentCategoryAccessGrant_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessGrant" ADD CONSTRAINT "DocumentCategoryAccessGrant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessGrant" ADD CONSTRAINT "DocumentCategoryAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessGrant" ADD CONSTRAINT "DocumentCategoryAccessGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessLog" ADD CONSTRAINT "DocumentCategoryAccessLog_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCategoryAccessLog" ADD CONSTRAINT "DocumentCategoryAccessLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
