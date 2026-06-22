/*
  Warnings:

  - You are about to drop the column `ai_trackers` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `flag` on the `calls` table. All the data in the column will be lost.
  - You are about to drop the column `sentiment_opening` on the `calls` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "calls" DROP COLUMN "ai_trackers",
DROP COLUMN "flag",
DROP COLUMN "sentiment_opening",
ADD COLUMN     "academy_collection" TEXT,
ADD COLUMN     "academy_tag" TEXT,
ADD COLUMN     "ai_insights" JSONB,
ADD COLUMN     "bad_tracker_count" INTEGER DEFAULT 0,
ADD COLUMN     "bad_trackers_triggered" JSONB,
ADD COLUMN     "checkpoint_results" JSONB,
ADD COLUMN     "coaching_actions" JSONB,
ADD COLUMN     "compliance_flags" JSONB,
ADD COLUMN     "deviation_flags" JSONB,
ADD COLUMN     "disclosure_adherence" DOUBLE PRECISION,
ADD COLUMN     "good_trackers_hit" JSONB,
ADD COLUMN     "lead_quality" TEXT,
ADD COLUMN     "objection_handled_count" INTEGER,
ADD COLUMN     "risk_flags" JSONB,
ADD COLUMN     "talk_ratio_percent" DOUBLE PRECISION,
ALTER COLUMN "call_quality" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "disclosures_percentage" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "compliance_percentage" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "overall_call_score" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "revenue" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "calls_department_id_idx" ON "calls"("department_id");

-- CreateIndex
CREATE INDEX "calls_overall_call_score_idx" ON "calls"("overall_call_score");

-- CreateIndex
CREATE INDEX "calls_academy_tag_idx" ON "calls"("academy_tag");

-- CreateIndex
CREATE INDEX "calls_bad_tracker_count_idx" ON "calls"("bad_tracker_count");

-- CreateIndex
CREATE INDEX "calls_deleted_at_idx" ON "calls"("deleted_at");
