-- Walk-ins use CHECKED_IN status; source=WALK_IN distinguishes them from pre-registrations
UPDATE "EventRegistration"
SET status = 'CHECKED_IN'
WHERE "isWalkIn" = true AND status = 'WALK_IN';
