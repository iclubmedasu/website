-- Rename enum DocumentShareTargetType → DocumentGrantTargetType
ALTER TYPE "DocumentShareTargetType" RENAME TO "DocumentGrantTargetType";

-- Expand DocumentAccessGrant for TEAM | MEMBER targets
ALTER TABLE "DocumentAccessGrant" ADD COLUMN "grantedToType" "DocumentGrantTargetType";
ALTER TABLE "DocumentAccessGrant" ADD COLUMN "teamId" INTEGER;
ALTER TABLE "DocumentAccessGrant" ALTER COLUMN "memberId" DROP NOT NULL;

UPDATE "DocumentAccessGrant"
SET "grantedToType" = 'MEMBER'
WHERE "grantedToType" IS NULL;

ALTER TABLE "DocumentAccessGrant" ALTER COLUMN "grantedToType" SET NOT NULL;

-- Expand DocumentCategoryAccessGrant for TEAM | MEMBER targets
ALTER TABLE "DocumentCategoryAccessGrant" ADD COLUMN "grantedToType" "DocumentGrantTargetType";
ALTER TABLE "DocumentCategoryAccessGrant" ADD COLUMN "teamId" INTEGER;
ALTER TABLE "DocumentCategoryAccessGrant" ALTER COLUMN "memberId" DROP NOT NULL;

UPDATE "DocumentCategoryAccessGrant"
SET "grantedToType" = 'MEMBER'
WHERE "grantedToType" IS NULL;

ALTER TABLE "DocumentCategoryAccessGrant" ALTER COLUMN "grantedToType" SET NOT NULL;

-- Migrate existing document shares → indefinite grants
INSERT INTO "DocumentAccessGrant" (
    "documentId",
    "grantedToType",
    "memberId",
    "teamId",
    "grantedById",
    "expiresAt",
    "createdAt"
)
SELECT
    "documentId",
    "sharedWithType",
    "sharedWithMemberId",
    "sharedWithTeamId",
    "sharedById",
    NULL,
    "createdAt"
FROM "DocumentShare";

-- Migrate existing category shares → indefinite grants
INSERT INTO "DocumentCategoryAccessGrant" (
    "categoryId",
    "grantedToType",
    "memberId",
    "teamId",
    "grantedById",
    "expiresAt",
    "createdAt"
)
SELECT
    "categoryId",
    "sharedWithType",
    "sharedWithMemberId",
    "sharedWithTeamId",
    "sharedById",
    NULL,
    "createdAt"
FROM "DocumentCategoryShare";

-- Drop share tables
DROP TABLE "DocumentShare";
DROP TABLE "DocumentCategoryShare";

-- Team FKs for grants
ALTER TABLE "DocumentAccessGrant"
ADD CONSTRAINT "DocumentAccessGrant_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentCategoryAccessGrant"
ADD CONSTRAINT "DocumentCategoryAccessGrant_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
