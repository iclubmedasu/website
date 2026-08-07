-- Add per-event toggle for session check-in/out duration tracking.
ALTER TABLE "Event" ADD COLUMN "trackSessionCheckOut" BOOLEAN NOT NULL DEFAULT false;

-- Support multiple ONSITE attendance segments (visits) per session+registration.
ALTER TABLE "EventSessionAttendance" ADD COLUMN "checkedOutAt" TIMESTAMP(3);

-- Drop the one-row-per-session-person-mode uniqueness (blocks multi-visit ONSITE).
DROP INDEX IF EXISTS "EventSessionAttendance_sessionId_registrationId_mode_key";

-- Helps lookup of open segments and session rolls.
CREATE INDEX IF NOT EXISTS "EventSessionAttendance_sessionId_registrationId_idx"
  ON "EventSessionAttendance"("sessionId", "registrationId");

CREATE INDEX IF NOT EXISTS "EventSessionAttendance_sessionId_mode_checkedOutAt_idx"
  ON "EventSessionAttendance"("sessionId", "mode", "checkedOutAt");

-- At most one open ONSITE visit per person per session (race-safe concurrent door scans).
CREATE UNIQUE INDEX "EventSessionAttendance_open_onsite_segment_key"
  ON "EventSessionAttendance"("sessionId", "registrationId")
  WHERE mode = 'ONSITE' AND "checkedOutAt" IS NULL;

-- ONLINE stays single-row per person per session.
CREATE UNIQUE INDEX "EventSessionAttendance_online_session_registration_key"
  ON "EventSessionAttendance"("sessionId", "registrationId")
  WHERE mode = 'ONLINE';
