UPDATE "EventRegistration"
SET "checkedInAt" = "createdAt"
WHERE status = 'CHECKED_IN' AND "checkedInAt" IS NULL;
