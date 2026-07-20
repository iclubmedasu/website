-- CreateEnum (idempotent: may already exist from db push)
DO $$ BEGIN
    CREATE TYPE "CertificateType" AS ENUM ('ATTENDANCE', 'ORGANIZATION', 'CONTRIBUTION', 'LEADERSHIP', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CertificateStatus" AS ENUM ('DRAFT', 'ISSUED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CertificateTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "backgroundImagePath" TEXT,
    "backgroundImageSha" TEXT,
    "canvasWidth" INTEGER NOT NULL DEFAULT 1122,
    "canvasHeight" INTEGER NOT NULL DEFAULT 794,
    "layout" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Certificate" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER,
    "type" "CertificateType" NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'DRAFT',
    "eventId" INTEGER,
    "projectId" INTEGER,
    "recipientMemberId" INTEGER,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fieldValues" JSONB NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificateTemplate_isActive_idx" ON "CertificateTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_verificationCode_key" ON "Certificate"("verificationCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_templateId_idx" ON "Certificate"("templateId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_eventId_idx" ON "Certificate"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_projectId_idx" ON "Certificate"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_recipientMemberId_idx" ON "Certificate"("recipientMemberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_verificationCode_idx" ON "Certificate"("verificationCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_status_idx" ON "Certificate"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_type_idx" ON "Certificate"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_createdAt_idx" ON "Certificate"("createdAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_recipientMemberId_fkey" FOREIGN KEY ("recipientMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
