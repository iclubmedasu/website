-- Fix RLS auto-enable for Prisma quoted table names (object_identity includes quotes).
CREATE OR REPLACE FUNCTION public.auto_enable_rls_on_public_table()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE obj record;
DECLARE table_name text;
BEGIN
  FOR obj IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    table_name := trim(both '"' from split_part(obj.object_identity, '.', 2));
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );
  END LOOP;
END;
$$;

-- CreateEnum
CREATE TYPE "AboutSectionType" AS ENUM ('TWO_COLUMN', 'BULLET_LIST', 'SPONSORS');

-- CreateEnum
CREATE TYPE "ContactMethodType" AS ENUM ('EMAIL', 'PHONE', 'ADDRESS', 'OTHER');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'LINKEDIN', 'IHUB', 'OTHER');

-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AboutSection" (
    "id" SERIAL NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "type" "AboutSectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "leftLabel" TEXT,
    "leftText" TEXT,
    "rightLabel" TEXT,
    "rightText" TEXT,
    "bullets" JSONB,
    "emptyMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AboutSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AboutSponsor" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AboutSponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMethod" (
    "id" SERIAL NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "type" "ContactMethodType" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialLink" (
    "id" SERIAL NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AboutSection_sortOrder_idx" ON "AboutSection"("sortOrder");

-- CreateIndex
CREATE INDEX "AboutSponsor_sectionId_idx" ON "AboutSponsor"("sectionId");

-- CreateIndex
CREATE INDEX "AboutSponsor_sectionId_sortOrder_idx" ON "AboutSponsor"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ContactMethod_sortOrder_idx" ON "ContactMethod"("sortOrder");

-- CreateIndex
CREATE INDEX "SocialLink_sortOrder_idx" ON "SocialLink"("sortOrder");

-- AddForeignKey
ALTER TABLE "AboutSponsor" ADD CONSTRAINT "AboutSponsor_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AboutSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
