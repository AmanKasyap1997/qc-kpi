/*
  Warnings:

  - You are about to drop the column `next_action ` on the `calls` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "calls" DROP COLUMN "next_action ",
ADD COLUMN     "next_action" TEXT;
