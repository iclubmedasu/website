-- Backfill Administration system roles: roleType + systemRoleKey
-- Officer = 10 / Officer; President = 11 / Administration; Vice President = 12 / Administration

UPDATE "TeamRole" AS tr
SET
    "roleType" = 'Officer',
    "systemRoleKey" = 10
FROM "Team" AS t
WHERE tr."teamId" = t.id
  AND t.name = 'Administration'
  AND tr."roleName" = 'Officer';

UPDATE "TeamRole" AS tr
SET
    "roleType" = 'Administration',
    "systemRoleKey" = 11
FROM "Team" AS t
WHERE tr."teamId" = t.id
  AND t.name = 'Administration'
  AND tr."roleName" = 'President';

UPDATE "TeamRole" AS tr
SET
    "roleType" = 'Administration',
    "systemRoleKey" = 12
FROM "Team" AS t
WHERE tr."teamId" = t.id
  AND t.name = 'Administration'
  AND tr."roleName" = 'Vice President';
