-- Migration: Replace type (TEXT) column with projectTypeId (FK to ProjectType)
-- Step 1: Add nullable projectTypeId column
ALTER TABLE "Project" ADD COLUMN "projectTypeId" INTEGER;

-- Step 2: Populate projectTypeId by matching the old type text to ProjectType.name
UPDATE "Project" p
SET "projectTypeId" = (
    SELECT pt.id FROM "ProjectType" pt WHERE pt.name = p.type LIMIT 1
);

-- Step 3: For any rows where the match failed, fall back to the lowest-order active type
UPDATE "Project"
SET "projectTypeId" = (
    SELECT id FROM "ProjectType" WHERE "isActive" = true ORDER BY "sortOrder" ASC, id ASC LIMIT 1
)
WHERE "projectTypeId" IS NULL;

-- Step 4: Make the column NOT NULL
ALTER TABLE "Project" ALTER COLUMN "projectTypeId" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE "Project"
    ADD CONSTRAINT "Project_projectTypeId_fkey"
    FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 6: Add index
CREATE INDEX "Project_projectTypeId_idx" ON "Project"("projectTypeId");

-- Step 7: Drop the old type text column
ALTER TABLE "Project" DROP COLUMN "type";
