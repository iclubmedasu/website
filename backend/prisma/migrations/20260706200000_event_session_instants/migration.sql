-- Add UTC instants for event sessions and backfill from legacy Cairo wall-clock fields.

ALTER TABLE "EventSession" ADD COLUMN IF NOT EXISTS "startDateTime" TIMESTAMP(3);
ALTER TABLE "EventSession" ADD COLUMN IF NOT EXISTS "endDateTime" TIMESTAMP(3);

UPDATE "EventSession"
SET
    "startDateTime" = CASE
        WHEN "startTime" IS NOT NULL AND btrim("startTime") <> '' THEN
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T' || "startTime" || ':00')::timestamp AT TIME ZONE 'Africa/Cairo')
        ELSE
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T00:00:00')::timestamp AT TIME ZONE 'Africa/Cairo')
    END,
    "endDateTime" = CASE
        WHEN "endTime" IS NOT NULL AND btrim("endTime") <> '' THEN
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T' || "endTime" || ':00')::timestamp AT TIME ZONE 'Africa/Cairo')
        WHEN "startTime" IS NOT NULL AND btrim("startTime") <> '' THEN
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T' || "startTime" || ':00')::timestamp AT TIME ZONE 'Africa/Cairo')
        ELSE
            ((to_char("sessionDate", 'YYYY-MM-DD') || 'T23:59:00')::timestamp AT TIME ZONE 'Africa/Cairo')
    END
WHERE "startDateTime" IS NULL;

CREATE INDEX IF NOT EXISTS "EventSession_startDateTime_idx" ON "EventSession"("startDateTime");
