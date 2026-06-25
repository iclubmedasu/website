-- CreateEnum
CREATE TYPE "SupportLocale" AS ENUM ('EN', 'AR');

-- CreateEnum
CREATE TYPE "IncidentReportSource" AS ENUM ('PUBLIC', 'PORTAL');

-- CreateTable
CREATE TABLE "SupportNoticeBlock" (
    "id" SERIAL NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "locale" "SupportLocale" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportNoticeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReportField" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReportField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" SERIAL NOT NULL,
    "answers" JSONB NOT NULL,
    "source" "IncidentReportSource" NOT NULL,
    "submitterMemberId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportNoticeBlock_sortOrder_idx" ON "SupportNoticeBlock"("sortOrder");

-- CreateIndex
CREATE INDEX "SupportNoticeBlock_locale_sortOrder_idx" ON "SupportNoticeBlock"("locale", "sortOrder");

-- CreateIndex
CREATE INDEX "IncidentReportField_order_idx" ON "IncidentReportField"("order");

-- CreateIndex
CREATE INDEX "IncidentReport_createdAt_idx" ON "IncidentReport"("createdAt");

-- CreateIndex
CREATE INDEX "IncidentReport_submitterMemberId_idx" ON "IncidentReport"("submitterMemberId");

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_submitterMemberId_fkey" FOREIGN KEY ("submitterMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
