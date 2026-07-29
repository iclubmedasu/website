-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "createdByMemberId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'NONE',
    "eventId" INTEGER,
    "projectId" INTEGER,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementResponse" (
    "id" SERIAL NOT NULL,
    "announcementId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementResponseDay" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementResponseDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_createdByMemberId_idx" ON "Announcement"("createdByMemberId");

-- CreateIndex
CREATE INDEX "Announcement_eventId_idx" ON "Announcement"("eventId");

-- CreateIndex
CREATE INDEX "Announcement_projectId_idx" ON "Announcement"("projectId");

-- CreateIndex
CREATE INDEX "Announcement_isActive_createdAt_idx" ON "Announcement"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "AnnouncementResponse_announcementId_idx" ON "AnnouncementResponse"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementResponse_memberId_idx" ON "AnnouncementResponse"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementResponse_announcementId_memberId_key" ON "AnnouncementResponse"("announcementId", "memberId");

-- CreateIndex
CREATE INDEX "AnnouncementResponseDay_responseId_idx" ON "AnnouncementResponseDay"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementResponseDay_responseId_day_key" ON "AnnouncementResponseDay"("responseId", "day");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementResponse" ADD CONSTRAINT "AnnouncementResponse_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementResponse" ADD CONSTRAINT "AnnouncementResponse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementResponseDay" ADD CONSTRAINT "AnnouncementResponseDay_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AnnouncementResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
