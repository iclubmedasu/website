-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "leaderId" INTEGER;

-- CreateIndex
CREATE INDEX "Task_leaderId_idx" ON "Task"("leaderId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
