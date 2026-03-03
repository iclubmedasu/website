-- AlterTable
ALTER TABLE "ProjectPhase" ADD COLUMN     "wbs" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "wbs" TEXT NOT NULL DEFAULT '';
