-- AlterTable
ALTER TABLE "Member" ADD COLUMN "phoneNumber2" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_phoneNumber2_key" ON "Member"("phoneNumber2");
