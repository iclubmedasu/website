-- Add per-event IANA timezone (defaults to club headquarters)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo';
