ALTER TABLE "Event" ADD COLUMN "eventEndDate" TIMESTAMP(3);

UPDATE "Event" SET "eventEndDate" = "eventDate" WHERE "eventEndDate" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "eventEndDate" SET NOT NULL;

CREATE INDEX "Event_eventEndDate_idx" ON "Event"("eventEndDate");
