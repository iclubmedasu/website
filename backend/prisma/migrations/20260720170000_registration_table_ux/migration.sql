-- Add registration table UX fields on Event (idempotent: may already exist from db push)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "phoneFieldRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "sessionFieldOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "tierFieldOrder" INTEGER NOT NULL DEFAULT 1;

-- Reserve order 0/1 for sessions/tier; shift existing custom field orders.
-- Only bump events that still have fields occupying the reserved low orders,
-- so a re-run after a partial apply does not double-shift.
UPDATE "EventCustomField" AS ecf
SET "order" = ecf."order" + 2
WHERE EXISTS (
  SELECT 1
  FROM "EventCustomField" AS other
  WHERE other."eventId" = ecf."eventId"
    AND other."order" < 2
);
