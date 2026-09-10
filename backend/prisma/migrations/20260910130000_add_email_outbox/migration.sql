-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "EmailOutboxKind" AS ENUM ('TICKET', 'REMINDER', 'CERTIFICATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailOutbox" (
    "id" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" "EmailOutboxKind" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "context" TEXT NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailOutbox_batchId_idx" ON "EmailOutbox"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailOutbox_kind_entityId_status_idx" ON "EmailOutbox"("kind", "entityId", "status");
