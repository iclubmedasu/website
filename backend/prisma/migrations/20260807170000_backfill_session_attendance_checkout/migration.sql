-- Data-only: backfill remaining session UTC instants, then close open ONSITE
-- attendance segments for already-ended sessions.

-- 1) Backfill null startDateTime from Cairo wall-clock fields (legacy sessions).
UPDATE "EventSession"
SET
    "startDateTime" = CASE
        WHEN "startTime" IS NOT NULL AND btrim("startTime") <> '' THEN
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T' || "startTime" || ':00')::timestamp AT TIME ZONE 'Africa/Cairo')
        ELSE
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T00:00:00')::timestamp AT TIME ZONE 'Africa/Cairo')
    END
WHERE "startDateTime" IS NULL;

-- 1b) Backfill null endDateTime from Cairo wall-clock fields (legacy sessions).
UPDATE "EventSession"
SET
    "endDateTime" = CASE
        WHEN "endTime" IS NOT NULL AND btrim("endTime") <> '' THEN
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T' || "endTime" || ':00')::timestamp AT TIME ZONE 'Africa/Cairo')
        WHEN "startTime" IS NOT NULL AND btrim("startTime") <> '' THEN
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T' || "startTime" || ':00')::timestamp AT TIME ZONE 'Africa/Cairo')
        ELSE
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T23:59:00')::timestamp AT TIME ZONE 'Africa/Cairo')
    END
WHERE "endDateTime" IS NULL;

-- 2) Close open ONSITE segments for sessions that have already ended.
--    ONLINE excluded; live sessions (endDateTime >= NOW()) left open.
UPDATE "EventSessionAttendance" AS a
SET "checkedOutAt" = GREATEST(a."joinedAt", s."endDateTime")
FROM "EventSession" AS s
WHERE a."sessionId" = s.id
  AND a.mode = 'ONSITE'
  AND a."checkedOutAt" IS NULL
  AND s."endDateTime" IS NOT NULL
  AND s."endDateTime" < NOW();
