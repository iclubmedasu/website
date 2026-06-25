-- Backfill liability accountId from first active finance account
ALTER TABLE "FinanceLiability" ADD COLUMN "accountId" INTEGER;

UPDATE "FinanceLiability"
SET "accountId" = (
    SELECT id FROM "FinanceAccount"
    WHERE "isActive" = true
    ORDER BY id ASC
    LIMIT 1
);

ALTER TABLE "FinanceLiability" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "FinanceLiability"
ADD CONSTRAINT "FinanceLiability_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "FinanceLiability_accountId_idx" ON "FinanceLiability"("accountId");

-- Backfill scheduled item accountId where null
UPDATE "FinanceScheduledItem"
SET "accountId" = (
    SELECT id FROM "FinanceAccount"
    WHERE "isActive" = true
    ORDER BY id ASC
    LIMIT 1
)
WHERE "accountId" IS NULL;

ALTER TABLE "FinanceScheduledItem" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "FinanceScheduledItem" DROP CONSTRAINT IF EXISTS "FinanceScheduledItem_accountId_fkey";

ALTER TABLE "FinanceScheduledItem"
ADD CONSTRAINT "FinanceScheduledItem_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
