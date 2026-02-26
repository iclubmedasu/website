-- Add explicit assignment status to Member for reliable "Unassigned" filtering
ALTER TABLE "Member" ADD COLUMN "assignmentStatus" TEXT NOT NULL DEFAULT 'UNASSIGNED';

-- Backfill: ASSIGNED = has at least one active TeamMember
UPDATE "Member" m
SET "assignmentStatus" = 'ASSIGNED'
WHERE EXISTS (
  SELECT 1 FROM "TeamMember" tm
  WHERE tm."memberId" = m.id AND tm."isActive" = true
);

-- Backfill: ALUMNI = appears in Alumni (overrides ASSIGNED/UNASSIGNED)
UPDATE "Member" m
SET "assignmentStatus" = 'ALUMNI'
WHERE EXISTS (
  SELECT 1 FROM "Alumni" a WHERE a."memberId" = m.id
);
