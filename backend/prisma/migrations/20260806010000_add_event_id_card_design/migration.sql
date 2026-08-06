-- AlterTable
ALTER TABLE "Event" ADD COLUMN "idCardCanvasWidth" INTEGER NOT NULL DEFAULT 384,
ADD COLUMN "idCardCanvasHeight" INTEGER NOT NULL DEFAULT 576,
ADD COLUMN "idCardLayout" JSONB,
ADD COLUMN "idCardBackgroundImageGithubPath" TEXT,
ADD COLUMN "idCardBackgroundImageGithubSha" TEXT,
ADD COLUMN "idCardBackgroundImageFileSize" INTEGER,
ADD COLUMN "idCardBackgroundImageMimeType" TEXT;
