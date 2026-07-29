-- CreateTable
CREATE TABLE "AnnouncementResponsePeriod" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementResponsePeriod_pkey" PRIMARY KEY ("id")
);

-- Migrate existing day rows into single-day periods
INSERT INTO "AnnouncementResponsePeriod" ("responseId", "startDate", "endDate", "createdAt")
SELECT "responseId", "day", "day", "createdAt"
FROM "AnnouncementResponseDay";

-- CreateIndex
CREATE INDEX "AnnouncementResponsePeriod_responseId_idx" ON "AnnouncementResponsePeriod"("responseId");

-- CreateIndex
CREATE INDEX "AnnouncementResponsePeriod_responseId_startDate_endDate_idx" ON "AnnouncementResponsePeriod"("responseId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "AnnouncementResponsePeriod" ADD CONSTRAINT "AnnouncementResponsePeriod_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AnnouncementResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "AnnouncementResponseDay";
