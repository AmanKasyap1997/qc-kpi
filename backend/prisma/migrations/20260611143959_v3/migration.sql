/*
  Warnings:

  - You are about to drop the column `ad_set` on the `sub_ids` table. All the data in the column will be lost.
  - You are about to drop the column `creative` on the `sub_ids` table. All the data in the column will be lost.
  - You are about to drop the column `dailyBudget` on the `sub_ids` table. All the data in the column will be lost.
  - You are about to drop the column `target_audience` on the `sub_ids` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sub_ids" DROP COLUMN "ad_set",
DROP COLUMN "creative",
DROP COLUMN "dailyBudget",
DROP COLUMN "target_audience";
