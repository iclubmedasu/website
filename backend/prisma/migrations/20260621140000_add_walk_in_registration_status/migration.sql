-- Backfill walk-in registrations to WALK_IN status (distinct from pre-registration CHECKED_IN)
UPDATE "EventRegistration"
SET status = 'WALK_IN'
WHERE "isWalkIn" = true AND status IN ('REGISTERED', 'CHECKED_IN');
