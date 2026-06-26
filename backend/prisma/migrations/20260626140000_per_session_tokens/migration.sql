-- AlterTable Event: registration column flags (idempotent)
DO $$ BEGIN
    ALTER TABLE "Event" ADD COLUMN "tierFieldShowOnPublic" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Event" ADD COLUMN "tierFieldRequired" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Event" ADD COLUMN "sessionFieldShowOnPublic" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Event" ADD COLUMN "sessionFieldRequired" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- CreateTable EventSessionToken
CREATE TABLE IF NOT EXISTS "EventSessionToken" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable EventRegistrationSession
CREATE TABLE IF NOT EXISTS "EventRegistrationSession" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRegistrationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventSessionToken_token_key" ON "EventSessionToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventSessionToken_sessionId_registrationId_key" ON "EventSessionToken"("sessionId", "registrationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventSessionToken_sessionId_idx" ON "EventSessionToken"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventSessionToken_registrationId_idx" ON "EventSessionToken"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventRegistrationSession_registrationId_sessionId_key" ON "EventRegistrationSession"("registrationId", "sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventRegistrationSession_registrationId_idx" ON "EventRegistrationSession"("registrationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventRegistrationSession_sessionId_idx" ON "EventRegistrationSession"("sessionId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "EventSessionToken" ADD CONSTRAINT "EventSessionToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventSessionToken" ADD CONSTRAINT "EventSessionToken_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventRegistrationSession" ADD CONSTRAINT "EventRegistrationSession_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "EventRegistrationSession" ADD CONSTRAINT "EventRegistrationSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
