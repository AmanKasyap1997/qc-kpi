/*
  Warnings:

  - The `agent_strengths` column on the `calls` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `agent_improvements` column on the `calls` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `flag` column on the `calls` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "ai_trackers" JSONB,
ADD COLUMN     "next_action " TEXT,
DROP COLUMN "agent_strengths",
ADD COLUMN     "agent_strengths" JSONB,
DROP COLUMN "agent_improvements",
ADD COLUMN     "agent_improvements" JSONB,
DROP COLUMN "flag",
ADD COLUMN     "flag" JSONB;
