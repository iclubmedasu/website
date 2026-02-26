/*
  Warnings:

  - Added the required column `type` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "type" TEXT NOT NULL;
