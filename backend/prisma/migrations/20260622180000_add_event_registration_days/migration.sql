-- CreateTable
CREATE TABLE "EventRegistrationDay" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "eventDay" DATE NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistrationDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRegistrationDay_registrationId_idx" ON "EventRegistrationDay"("registrationId");

-- CreateIndex
CREATE INDEX "EventRegistrationDay_eventDay_idx" ON "EventRegistrationDay"("eventDay");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistrationDay_registrationId_eventDay_key" ON "EventRegistrationDay"("registrationId", "eventDay");

-- AddForeignKey
ALTER TABLE "EventRegistrationDay" ADD CONSTRAINT "EventRegistrationDay_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing check-ins as single-day attendance
INSERT INTO "EventRegistrationDay" ("registrationId", "eventDay", "checkedInAt")
SELECT
    id,
    COALESCE("checkedInAt", "createdAt")::date,
    COALESCE("checkedInAt", "createdAt")
FROM "EventRegistration"
WHERE status = 'CHECKED_IN'
  AND "checkedInAt" IS NOT NULL
ON CONFLICT ("registrationId", "eventDay") DO NOTHING;
