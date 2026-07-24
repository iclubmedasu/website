-- CreateTable
CREATE TABLE "EventPhoto" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "uploadedByMemberId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "githubPath" TEXT NOT NULL,
    "githubSha" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "eventDay" DATE,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "showOnPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventPhoto_eventId_idx" ON "EventPhoto"("eventId");

-- CreateIndex
CREATE INDEX "EventPhoto_eventId_eventDay_idx" ON "EventPhoto"("eventId", "eventDay");

-- CreateIndex
CREATE INDEX "EventPhoto_uploadedByMemberId_idx" ON "EventPhoto"("uploadedByMemberId");

-- AddForeignKey
ALTER TABLE "EventPhoto" ADD CONSTRAINT "EventPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPhoto" ADD CONSTRAINT "EventPhoto_uploadedByMemberId_fkey" FOREIGN KEY ("uploadedByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
