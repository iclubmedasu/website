-- AlterTable (idempotent: column may already exist from prisma db push)
DO $$ BEGIN
    ALTER TABLE "EventRegistration" ADD COLUMN "onlineAccessToken" TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventSession" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "label" TEXT,
    "sessionDate" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ONSITE',
    "onlineUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventSessionAttendance" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ONSITE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventSession_eventId_idx" ON "EventSession"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventSession_eventId_sessionDate_idx" ON "EventSession"("eventId", "sessionDate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventSessionAttendance_sessionId_registrationId_mode_key" ON "EventSessionAttendance"("sessionId", "registrationId", "mode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventSessionAttendance_sessionId_idx" ON "EventSessionAttendance"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventSessionAttendance_registrationId_idx" ON "EventSessionAttendance"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventRegistration_onlineAccessToken_key" ON "EventRegistration"("onlineAccessToken");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventSessionAttendance" ADD CONSTRAINT "EventSessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventSessionAttendance" ADD CONSTRAINT "EventSessionAttendance_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
