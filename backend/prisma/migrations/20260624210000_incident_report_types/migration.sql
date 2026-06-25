-- AlterTable
ALTER TABLE "IncidentReportField" ADD COLUMN "showOnPublic" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "IncidentReportType" (
    "id" SERIAL NOT NULL,
    "slug" TEXT,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReportType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncidentReportType_slug_key" ON "IncidentReportType"("slug");

-- CreateIndex
CREATE INDEX "IncidentReportType_sortOrder_idx" ON "IncidentReportType"("sortOrder");

-- Seed system report types
INSERT INTO "IncidentReportType" ("slug", "label", "sortOrder", "isSystem", "isActive", "updatedAt")
VALUES
    ('general', 'General Report', 0, true, true, CURRENT_TIMESTAMP),
    ('personal', 'Personal Report', 1, true, true, CURRENT_TIMESTAMP),
    ('request', 'Request Report', 2, true, true, CURRENT_TIMESTAMP);

-- Remove legacy dynamic fields that are now fixed form fields
DELETE FROM "IncidentReportField"
WHERE "label" IN ('Report type', 'Description', 'Your name', 'Contact number');
