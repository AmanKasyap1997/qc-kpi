/*
  Warnings:

  - You are about to drop the column `academy_collection` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `academy_tag` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `agent_improvements` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `agent_strengths` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `ai_insights` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `bad_tracker_count` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `bad_trackers_triggered` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `call_quality` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `call_summary` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `checkpoint_results` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `coaching_actions` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `compliance_flags` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `compliance_percentage` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `deviation_flags` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `disclosure_adherence` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `disclosures_percentage` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `flags` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `good_trackers_hit` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `lead_quality` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `objection_handled_count` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `overall_call_score` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `risk_flags` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `sentiment_overall` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `talk_ratio_percent` on the `calls` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "calls_academy_tag_idx";

-- DropIndex
DROP INDEX "calls_bad_tracker_count_idx";

-- DropIndex
DROP INDEX "calls_overall_call_score_idx";

-- AlterTable
ALTER TABLE "calls" DROP COLUMN "academy_collection",
DROP COLUMN "academy_tag",
DROP COLUMN "agent_improvements",
DROP COLUMN "agent_strengths",
DROP COLUMN "ai_insights",
DROP COLUMN "bad_tracker_count",
DROP COLUMN "bad_trackers_triggered",
DROP COLUMN "call_quality",
DROP COLUMN "call_summary",
DROP COLUMN "checkpoint_results",
DROP COLUMN "coaching_actions",
DROP COLUMN "compliance_flags",
DROP COLUMN "compliance_percentage",
DROP COLUMN "deviation_flags",
DROP COLUMN "disclosure_adherence",
DROP COLUMN "disclosures_percentage",
DROP COLUMN "flags",
DROP COLUMN "good_trackers_hit",
DROP COLUMN "lead_quality",
DROP COLUMN "objection_handled_count",
DROP COLUMN "overall_call_score",
DROP COLUMN "risk_flags",
DROP COLUMN "sentiment_overall",
DROP COLUMN "talk_ratio_percent";

-- CreateTable
CREATE TABLE "call_analytics" (
    "id" SERIAL NOT NULL,
    "call_id" INTEGER NOT NULL,
    "overall_call_score" DOUBLE PRECISION,
    "call_quality" DOUBLE PRECISION,
    "disclosures_percentage" DOUBLE PRECISION,
    "compliance_percentage" DOUBLE PRECISION,
    "sentiment_overall" TEXT,
    "lead_quality" TEXT,
    "call_summary" TEXT,
    "agent_strengths" JSONB,
    "agent_improvements" JSONB,
    "ai_insights" JSONB,
    "coaching_actions" JSONB,
    "checkpoint_results" JSONB,
    "good_trackers_hit" JSONB,
    "bad_trackers_triggered" JSONB,
    "bad_tracker_count" INTEGER DEFAULT 0,
    "deviation_flags" JSONB,
    "flags" JSONB,
    "compliance_flags" JSONB,
    "risk_flags" JSONB,
    "academy_tag" TEXT,
    "academy_collection" TEXT,
    "disclosure_adherence" DOUBLE PRECISION,
    "talk_ratio_percent" DOUBLE PRECISION,
    "objection_handled_count" INTEGER,
    "processed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_analytics_call_id_key" ON "call_analytics"("call_id");

-- CreateIndex
CREATE INDEX "call_analytics_overall_call_score_idx" ON "call_analytics"("overall_call_score");

-- CreateIndex
CREATE INDEX "call_analytics_academy_tag_idx" ON "call_analytics"("academy_tag");

-- CreateIndex
CREATE INDEX "call_analytics_bad_tracker_count_idx" ON "call_analytics"("bad_tracker_count");

-- AddForeignKey
ALTER TABLE "call_analytics" ADD CONSTRAINT "call_analytics_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
