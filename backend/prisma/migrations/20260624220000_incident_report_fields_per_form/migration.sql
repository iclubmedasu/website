-- Add formId to IncidentReportField and scope fields per form
ALTER TABLE "IncidentReportField" ADD COLUMN "formId" INTEGER;

UPDATE "IncidentReportField" AS f
SET "formId" = t.id
FROM "IncidentReportType" AS t
WHERE t.slug = 'general' AND f."formId" IS NULL;

UPDATE "IncidentReportField" AS f
SET "formId" = (
    SELECT id FROM "IncidentReportType" ORDER BY "sortOrder" ASC LIMIT 1
)
WHERE f."formId" IS NULL;

ALTER TABLE "IncidentReportField" ALTER COLUMN "formId" SET NOT NULL;

ALTER TABLE "IncidentReportField" DROP COLUMN IF EXISTS "showOnPublic";

DROP INDEX IF EXISTS "IncidentReportField_order_idx";

CREATE INDEX "IncidentReportField_formId_order_idx" ON "IncidentReportField"("formId", "order");

ALTER TABLE "IncidentReportField"
ADD CONSTRAINT "IncidentReportField_formId_fkey"
FOREIGN KEY ("formId") REFERENCES "IncidentReportType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
