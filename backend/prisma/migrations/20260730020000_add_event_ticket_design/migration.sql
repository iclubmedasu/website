-- AlterTable
ALTER TABLE "Event" ADD COLUMN "ticketAccentColor" TEXT,
ADD COLUMN "ticketHeaderTitle" TEXT,
ADD COLUMN "ticketHeaderSubtitle" TEXT,
ADD COLUMN "ticketFooterNote" TEXT,
ADD COLUMN "ticketHeaderImageGithubPath" TEXT,
ADD COLUMN "ticketHeaderImageGithubSha" TEXT,
ADD COLUMN "ticketHeaderImageFileSize" INTEGER,
ADD COLUMN "ticketHeaderImageMimeType" TEXT,
ADD COLUMN "ticketFooterImageGithubPath" TEXT,
ADD COLUMN "ticketFooterImageGithubSha" TEXT,
ADD COLUMN "ticketFooterImageFileSize" INTEGER,
ADD COLUMN "ticketFooterImageMimeType" TEXT;
