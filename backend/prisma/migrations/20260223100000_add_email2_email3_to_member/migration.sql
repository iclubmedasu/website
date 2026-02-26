-- AlterTable
ALTER TABLE "Member" ADD COLUMN "email2" TEXT;
ALTER TABLE "Member" ADD COLUMN "email3" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_email2_key" ON "Member"("email2");
CREATE UNIQUE INDEX "Member_email3_key" ON "Member"("email3");
