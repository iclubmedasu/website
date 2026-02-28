-- CreateTable
CREATE TABLE "ProjectType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectType_name_key" ON "ProjectType"("name");

-- CreateIndex
CREATE INDEX "ProjectType_category_idx" ON "ProjectType"("category");

-- CreateIndex
CREATE INDEX "ProjectType_isActive_idx" ON "ProjectType"("isActive");

-- Seed default project types
INSERT INTO "ProjectType" ("name", "category", "description", "sortOrder") VALUES
  -- Events & Activities
  ('Conference',         'Events & Activities', 'Academic or professional conference',   1),
  ('Workshop',           'Events & Activities', 'Hands-on learning workshop',            2),
  ('Social Event',       'Events & Activities', 'Community or social gathering',         3),
  ('Competition',        'Events & Activities', 'Student competition or hackathon',      4),
  ('Seminar',            'Events & Activities', 'Educational seminar or talk',           5),

  -- Technology
  ('Web Development',    'Technology',          'Website or web app project',            10),
  ('Mobile App',         'Technology',          'iOS or Android application',            11),
  ('Data / AI',          'Technology',          'Data science, ML or AI initiative',     12),
  ('Infrastructure',     'Technology',          'DevOps, servers or tooling',            13),

  -- Research & Academic
  ('Research',           'Research & Academic', 'Scientific or academic research',       20),
  ('Publication',        'Research & Academic', 'Paper, article or media production',   21),
  ('Curriculum',         'Research & Academic', 'Educational material development',     22),

  -- Operations
  ('Marketing',          'Operations',          'Promotion, branding or outreach',       30),
  ('Fundraising',        'Operations',          'Sponsorship or fundraising campaign',   31),
  ('Administrative',     'Operations',          'Internal club operations',              32),

  -- Other
  ('General',            'Other',               'General or uncategorised project',      99);
