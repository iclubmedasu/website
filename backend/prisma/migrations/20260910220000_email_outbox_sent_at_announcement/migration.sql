-- AlterEnum
ALTER TYPE "EmailOutboxKind" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "resendMessageId" TEXT;
ALTER TABLE "EmailOutbox" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailOutbox_resendMessageId_key" ON "EmailOutbox"("resendMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailOutbox_sentAt_idx" ON "EmailOutbox"("sentAt");
