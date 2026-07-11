-- AlterTable
ALTER TABLE "Event" ADD COLUMN "slug" TEXT;
ALTER TABLE "Project" ADD COLUMN "slug" TEXT;

-- Backfill unique 12-char hex-derived slugs (collision-safe via id + random salt)
UPDATE "Event"
SET "slug" = lower(substr(md5(id::text || '-' || random()::text || '-' || clock_timestamp()::text), 1, 12))
WHERE "slug" IS NULL;

UPDATE "Project"
SET "slug" = lower(substr(md5(id::text || '-' || random()::text || '-' || clock_timestamp()::text), 1, 12))
WHERE "slug" IS NULL;

-- Resolve any residual collisions by appending id suffix (extremely unlikely)
UPDATE "Event" e
SET "slug" = lower(substr(md5(e.id::text || '-retry-' || random()::text), 1, 10)) || lpad((e.id % 100)::text, 2, '0')
WHERE e.id IN (
  SELECT id FROM (
    SELECT id, "slug", ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY id) AS rn
    FROM "Event"
  ) ranked
  WHERE rn > 1
);

UPDATE "Project" p
SET "slug" = lower(substr(md5(p.id::text || '-retry-' || random()::text), 1, 10)) || lpad((p.id % 100)::text, 2, '0')
WHERE p.id IN (
  SELECT id FROM (
    SELECT id, "slug", ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY id) AS rn
    FROM "Project"
  ) ranked
  WHERE rn > 1
);

ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
