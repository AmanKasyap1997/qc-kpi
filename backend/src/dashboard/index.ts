import express from "express";
import { Request, Response } from "express";
import db from "../db/pool";
const router = express.Router();


router.get("/zendesk", async (req: Request, res: Response) => {
    const rawDateFrom = String(req.query.dateFrom || '2026-06-16');
    const rawDateTo = String(req.query.dateTo || '2026-06-18');
    const dateFrom = `${rawDateFrom} 00:00:00`;
    const dateTo = `${rawDateTo} 23:59:59`;
    try {
        const statsQuery = `
                            SELECT 
                                COUNT(*) FILTER (WHERE entity = 'TAX') AS tax_total, 
                                COUNT(*) FILTER (WHERE entity = 'TAX' AND LOWER(status) = 'pending') AS tax_pending, 
                                COUNT(*) FILTER (WHERE entity = 'TAX' AND LOWER(status) = 'pending' AND LOWER(priority) = 'urgent') AS tax_urgent_pending, 
                                COUNT(*) FILTER (WHERE entity = 'TAX' AND LOWER(status) = 'solved') AS tax_solved, 
                                COUNT(*) FILTER (WHERE entity = 'DEBT') AS debt_total, 
                                COUNT(*) FILTER (WHERE entity = 'DEBT' AND LOWER(status) = 'open') AS debt_open, 
                                COUNT(*) FILTER (WHERE entity = 'DEBT' AND assignee_id IS NULL) AS debt_unassigned, 
                                COUNT(*) FILTER (WHERE entity = 'DEBT' AND LOWER(status) = 'solved') AS debt_solved 
                            FROM zendesk_tickets 
                            WHERE webhook_trigger >= CAST($1 AS TIMESTAMP) AND webhook_trigger <= CAST($2 AS TIMESTAMP);
        `;
        const result = await db.query(statsQuery, [dateFrom, dateTo]);

        res.json(result.rows[0] || { tax_total: 0, tax_pending: 0, tax_urgent_pending: 0, tax_solved: 0, debt_total: 0, debt_open: 0, debt_unassigned: 0, debt_solved: 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/live-feed-widget-data", async (req: Request, res: Response) => {
    const client = await db.connect();

    try {
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;

        const conditions: string[] = ["c.deleted_at IS NULL"];
        const params: any[] = [];

        if (dateFrom) {
            params.push(dateFrom);
            conditions.push(`c.started_at >= $${params.length}::date`);
        }
        if (dateTo) {
            params.push(dateTo);
            conditions.push(`c.started_at < ($${params.length}::date + INTERVAL '1 day')`);
        }

        const whereClause = conditions.join(" AND ");

        // ── Query 1: summary stats + flags in a single scan via CTE ──────────
        const mainResult = await client.query(
            `
            WITH base AS (
                SELECT
                    c.id,
                    c.outcome,
                    c.started_at,
                    COALESCE(ca.overall_call_score, 0)  AS score,
                    COALESCE(ca.flags::jsonb, '[]'::jsonb) AS flags
                FROM calls c
                LEFT JOIN call_analytics ca ON ca.call_id = c.id
                WHERE ${whereClause} AND c.agent_id IS NOT NULL
            )
            SELECT
                COUNT(*) AS "totalCalls",
                COALESCE(ROUND(AVG(score)::numeric, 2), 0) AS "avgScore",
                COUNT(*) FILTER (WHERE outcome = 'Enrolled') AS "totalEnrolled",
                COUNT(*) FILTER (WHERE outcome = 'Debt Pitch') AS "totalPitch",
                COUNT(*) FILTER (WHERE outcome = 'Callback') AS "totalCallback",
                COUNT(*) FILTER (WHERE outcome = 'Declined') AS "totalDeclined",
                COUNT(*) FILTER (WHERE outcome = 'Hotique') AS "totalHotique",
                COUNT(*) FILTER (WHERE flags @> '["Early Debt Pitch"]'::jsonb) AS "earlyDebtPitch",
                COUNT(*) FILTER (WHERE flags @> '["Skipped Qualifying"]'::jsonb) AS "skippedQualifying",
                COUNT(*) FILTER (WHERE flags @> '["Rushed Call"]'::jsonb) AS "rushedCall",
                COUNT(*) FILTER (WHERE flags @> '["Skipped Credit Pull"]'::jsonb) AS "skippedCreditPull",
                COUNT(*) FILTER (WHERE flags @> '["Early Decline"]'::jsonb) AS "earlyDecline",
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object('id', id, 'flags', flags)
                        ORDER BY started_at DESC
                    ),
                    '[]'::jsonb
                ) AS "flagsData"

            FROM base
            `,
            params
        );

        // ── Query 2: agent stats (needs GROUP BY, stays separate) ─────────────
        const agentResult = await client.query(
            `
            SELECT
                a.id,
                a.name AS "agentName",
                COUNT(c.id) AS "totalCalls",
                ROUND(
                    SUM(COALESCE(ca.overall_call_score, 0))::numeric
                    / NULLIF(COUNT(c.id), 0),
                    2
                ) AS "avgScore"
            FROM calls c
            INNER JOIN agents a  ON a.id  = c.agent_id
            LEFT  JOIN call_analytics ca ON ca.call_id = c.id
            WHERE ${whereClause}
            GROUP BY a.id, a.name
            ORDER BY "avgScore" DESC, a.name ASC
            `,
            params
        );

        const { flagsData, ...summary } = mainResult.rows[0];

        return res.status(200).json({
            success: true,
            data: summary,
            agentData: agentResult.rows,
            flagsData: flagsData,   // already an array from jsonb_agg
        });

    } catch (error: any) {
        console.error("GET /live-feed-widget-data error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to read call data",
            error: error.message,
        });
    } finally {
        client.release();
    }
});

router.get("/calls", async (req: Request, res: Response) => {

    const client = await db.connect();

    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50));
        const offset = (page - 1) * pageSize;

        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;
        const flags = req.query.flags as string | undefined;
        const agentDept = req.query.agentDept as string | undefined;
        const score = req.query.score as string | undefined;
        const outcome = req.query.outcome as string | undefined;

        // Build WHERE clause
        const conditions: string[] = [
            "c.deleted_at IS NULL",
            "a.name IS NOT NULL"
        ];

        const params: any[] = [];

        // Date From
        if (dateFrom) {
            params.push(dateFrom);
            conditions.push(`c.started_at >= $${params.length}::date`);
        }

        // Date To
        if (dateTo) {
            params.push(dateTo);
            conditions.push(`c.started_at < ($${params.length}::date + INTERVAL '1 day')`);
        }

        // Outcome
        if (
            outcome &&
            outcome !== "All Outcome"
        ) {
            params.push(outcome);
            conditions.push(`c.outcome = $${params.length}`);
        }

        // Department
        if (
            agentDept &&
            agentDept !== "All Depts"
        ) {
            params.push(agentDept);
            conditions.push(`ca.ai_generated_department = $${params.length}`);
        }

        // Score
        if (score && score !== "All Scores") {
            const [min, max] = score.split("-").map(Number);

            if (!isNaN(min) && !isNaN(max)) {
                params.push(min);
                const minParam = params.length;

                params.push(max);
                const maxParam = params.length;

                conditions.push(
                    `ca.overall_call_score BETWEEN $${minParam} AND $${maxParam}`
                );
            }
        }

        // Flags
        if (
            flags &&
            flags !== "All Flags"
        ) {
            params.push(flags);

            // flags column is JSONB array
            conditions.push(`
        EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(ca.flags) f
            WHERE f = $${params.length}
        )
    `);
        }

        const whereClause = conditions.join(" AND ");

        // Count query for total
        const countResult = await client.query(
            `
            SELECT COUNT(*) AS total
            FROM calls c
            LEFT JOIN agents a ON a.id = c.agent_id
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE ${whereClause}
            `,
            params
        );
        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / pageSize);

        // Data query
        params.push(pageSize);
        const limitParam = params.length;
        params.push(offset);
        const offsetParam = params.length;

        const result = await client.query(`
            SELECT
                a.id AS "agentIdx",
                a.name AS "agentName",
                COALESCE(ca.ai_generated_department, '') AS "agentDept",
                COALESCE(ca.overall_call_score, 0) AS "score",
                c.id AS "id",
                COALESCE(c.client_name, '') AS "client",
                COALESCE(c.client_phone, '') AS "clientPhone",
                COALESCE(c.outcome, 'Unknown') AS "outcome",
                COALESCE(c.duration_seconds, 0) AS "duration",
                COALESCE(c.campaign, '') AS "campaign",
                COALESCE(ca.flags, '[]'::jsonb) AS "flags",
                COALESCE(ca.call_quality, 0) AS "callQuality",
                COALESCE(ca.disclosures_percentage, 0) AS "disclosuresPercentage",
                COALESCE(ca.compliance_percentage, 0) AS "compliancePercentage",
                COALESCE(ca.call_summary, '') AS "callSummary",
                COALESCE(ca.agent_strengths, '[]'::jsonb) AS "agentStrengths",
                COALESCE(ca.agent_improvements, '[]'::jsonb) AS "agentImprovements",
                COALESCE(ca.coaching_actions, '[]'::jsonb) AS "coachingActions",
                COALESCE(ca.academy_tag, '') AS "academyTag",
                COALESCE(ca.academy_collection, '') AS "academyCollection",
                COALESCE(ca.ai_insights, '{}'::jsonb) AS "insights",
                COALESCE(ca.checkpoint_results, '[]'::jsonb) AS "checkpointResults",
                COALESCE(ca.risk_flags, '[]'::jsonb) AS "riskFlags",
                COALESCE(ca.good_trackers_hit, '[]'::jsonb) AS "goodTrackersHit",
                COALESCE(ca.bad_trackers_triggered, '[]'::jsonb) AS "badTrackersTriggered",
                c.started_at AS "startedAt",
                c.started_at AS "date",
                c.ended_at AS "endedAt"
            FROM calls c
            LEFT JOIN agents a ON a.id = c.agent_id
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE ${whereClause}
            ORDER BY c.started_at DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `, params);

        return res.status(200).json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            }
        });
    } catch (error: any) {
        console.error("GET /calls error:", error);
        return res.status(500).json({ success: false, message: "Failed to read call data", error: error.message });
    } finally {
        client.release();
    }
});

router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
    try {
        const mode = String(req.query.mode || 'all');
        const rawDateFrom = String(req.query.dateFrom || '2026-06-16');
        const rawDateTo = String(req.query.dateTo || '2026-06-18');
        const dateFrom = `${rawDateFrom} 00:00:00`;
        const dateTo = `${rawDateTo} 23:59:59`;

        // 1. Super simple SQL query getting only core metrics
        const sqlQuery = `
            SELECT 
                a.name AS "name",
                COALESCE(ca.ai_generated_department, 'Sales') AS "dept",
                COUNT(c.id) AS "calls",
                AVG(COALESCE(ca.overall_call_score, 0))::INT AS "avgScore",
                AVG(COALESCE(c.duration_seconds, 0))::INT AS "avgDurationSeconds",
                SUM(CASE WHEN c.outcome = 'Enrolled' THEN 1 ELSE 0 END) AS "enrolls",
                SUM(CASE WHEN jsonb_array_length(COALESCE(ca.flags, '[]'::jsonb)) > 0 THEN 1 ELSE 0 END) AS "flagged"
            FROM calls c
            LEFT JOIN agents a ON c.agent_id = a.id
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE c.deleted_at IS NULL and a.name IS NOT NULL
              AND (c.started_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
            GROUP BY a.id, a.name, ca.ai_generated_department;
        `;

        const queryParams = [dateFrom, dateTo];
        const result = await db.query(sqlQuery, queryParams);

        // 2. Format DB results, falling back to static generation only where missing
        const formattedRows = result.rows.map((row: any) => {
            const callsCount = Number(row.calls || 0);
            const enrollsCount = Number(row.enrolls || 0);
            const flaggedCount = Number(row.flagged || 0);

            // Calculate exact Average Length from db (MM:SS)
            const avgSecondsTotal = Number(row.avgDurationSeconds || 0);
            const minutes = Math.floor(avgSecondsTotal / 60);
            const seconds = String(avgSecondsTotal % 60).padStart(2, '0');
            const calculatedAvgLen = `${minutes}:${seconds}`;

            // Calculate exact Flag Rate from live data flags
            const calculatedFlagRate = callsCount > 0
                ? Math.round((flaggedCount / callsCount) * 100) + '%'
                : '0%';
            const mockEff = (Math.random() * 1.75 + 1.25).toFixed(2) + 'x';

            return {
                name: row.name,
                dept: row.dept,
                score: row.avgScore || 0, // Uses real call quality score average, falls back safely
                calls: callsCount,
                enrolls: enrollsCount,
                avgLen: calculatedAvgLen,
                eff: mockEff,
                flagged: flaggedCount,
                flagRate: calculatedFlagRate
            };
        });

        res.status(200).json(formattedRows);
    } catch (error) {
        console.error("Database query failed:", error);
        res.status(500).json({ message: "Failed to fetch leaderboard data from DB", error });
    }
});

router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
    try {
        const { dateFrom, dateTo } = req.query;

        if (!dateFrom || !dateTo) {
            res.status(400).json({ error: "dateFrom and dateTo query parameters are required." });
            return;
        }

        // 1. OVERVIEW & CONVERSION BREAKDOWN (Single-pass conditional query)
        const overviewQuery = `
            SELECT 
                COUNT(c.id)::int AS "totalCalls",
                COALESCE(AVG(ca.disclosure_adherence), 0)::float AS "avgAdherence",
                COALESCE(AVG(c.duration_seconds), 0)::float AS "avgDurationSeconds",
                COUNT(CASE WHEN ca.overall_call_score IS NOT NULL THEN 1 END)::int AS "scored",
                
                -- Conversions / Outcomes Breakdown
                COUNT(CASE WHEN LOWER(TRIM(c.outcome)) = 'enrolled' THEN 1 END)::int AS "enrolled",
                COUNT(CASE WHEN LOWER(TRIM(c.outcome)) = 'debt pitch' OR LOWER(TRIM(c.outcome)) = 'debtpitch' THEN 1 END)::int AS "debtPitch",
                COUNT(CASE WHEN LOWER(TRIM(c.outcome)) = 'callback' THEN 1 END)::int AS "callback",
                COUNT(CASE WHEN LOWER(TRIM(c.outcome)) = 'declined' THEN 1 END)::int AS "declined",
                COUNT(CASE WHEN LOWER(TRIM(c.outcome)) = 'hotique' THEN 1 END)::int AS "hotique"
            FROM calls c
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE (c.started_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP)) AND c.agent_id IS NOT NULL;
        `;
        const overviewRes = await db.query(overviewQuery, [dateFrom, dateTo]);
        const overviewData = overviewRes.rows[0];

        // Format Duration from Seconds into MM:SS
        const formatDuration = (totalSeconds: number): string => {
            const mins = Math.floor(totalSeconds / 60);
            const secs = Math.floor(totalSeconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        };

        const totalCalls = overviewData.totalCalls || 0;
        const scoredCount = overviewData.scored || 0;

        // Calculate Rate Percentages safely
        const enrollmentPercent = scoredCount > 0 ? parseFloat(((overviewData.enrolled / totalCalls) * 100).toFixed(1)) : 0.0;
        const debtPitchPercent = scoredCount > 0 ? parseFloat(((overviewData.debtPitch / totalCalls) * 100).toFixed(1)) : 0.0;
        const otherPercentage = totalCalls ? (((overviewData.hotique + overviewData.declined + overviewData.callback) / totalCalls) * 100).toFixed(1) : '0';
        // 2. DAILY QA TREND (Grouped by Day)
        const dailyTrendQuery = `
            SELECT 
                TO_CHAR(c.created_at, 'MM/DD') AS "date",
                ROUND(AVG(COALESCE(ca.overall_call_score, 0))::numeric, 1)::float AS "value"
            FROM calls c
            INNER JOIN call_analytics ca ON ca.call_id = c.id
            WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
            GROUP BY TO_CHAR(c.created_at, 'MM/DD'), DATE(c.created_at)
            ORDER BY DATE(c.created_at) ASC;
        `;
        const dailyTrendRes = await db.query(dailyTrendQuery, [dateFrom, dateTo]);

        // 3. SCORE DISTRIBUTION histogram (0-9, 10-19, etc.)
        const scoreDistQuery = `
            SELECT 
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 0 AND 9 THEN 1 END)::int AS "bucket_0_9",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 10 AND 19 THEN 1 END)::int AS "bucket_10_19",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 20 AND 29 THEN 1 END)::int AS "bucket_20_29",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 30 AND 39 THEN 1 END)::int AS "bucket_30_39",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 40 AND 49 THEN 1 END)::int AS "bucket_40_49",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 50 AND 59 THEN 1 END)::int AS "bucket_50_59",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 60 AND 69 THEN 1 END)::int AS "bucket_60_69",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 70 AND 79 THEN 1 END)::int AS "bucket_70_79",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 80 AND 89 THEN 1 END)::int AS "bucket_80_89",
                COUNT(CASE WHEN ca.overall_call_score BETWEEN 90 AND 100 THEN 1 END)::int AS "bucket_90_100"
            FROM calls c
            INNER JOIN call_analytics ca ON ca.call_id = c.id
            WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP));
        `;
        const scoreDistRes = await db.query(scoreDistQuery, [dateFrom, dateTo]);
        const distData = scoreDistRes.rows[0];

        const scoreDistribution = [
            { min: 0, max: 9, count: distData?.bucket_0_9 || 0 },
            { min: 10, max: 19, count: distData?.bucket_10_19 || 0 },
            { min: 20, max: 29, count: distData?.bucket_20_29 || 0 },
            { min: 30, max: 39, count: distData?.bucket_30_39 || 0 },
            { min: 40, max: 49, count: distData?.bucket_40_49 || 0 },
            { min: 50, max: 59, count: distData?.bucket_50_59 || 0 },
            { min: 60, max: 69, count: distData?.bucket_60_69 || 0 },
            { min: 70, max: 79, count: distData?.bucket_70_79 || 0 },
            { min: 80, max: 89, count: distData?.bucket_80_89 || 0 },
            { min: 90, max: 100, count: distData?.bucket_90_100 || 0 }
        ];

        // 4. AGENT COMPARISON RANKINGS
        const agentCompQuery = `
            SELECT 
                a.name AS "name",
                ROUND(AVG(COALESCE(ca.overall_call_score, 0))::numeric, 1)::float AS "score"
            FROM calls c
            INNER JOIN agents a ON c.agent_id = a.id
            INNER JOIN call_analytics ca ON ca.call_id = c.id
            WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
            GROUP BY a.id, a.name
            ORDER BY score DESC;
        `;
        const agentCompRes = await db.query(agentCompQuery, [dateFrom, dateTo]);

        // 5. ASSEMBLE DYNAMIC RESPONSE OBJECT
        const dynamicAnalyticsData = {
            overview: {
                totalCalls: totalCalls,
                avgAdherence: parseFloat(Number(overviewData.avgAdherence).toFixed(1)),
                avgLength: formatDuration(overviewData.avgDurationSeconds || 0),
                scored: scoredCount,
                pending: 0, // Hardcoded or link to tracking system if necessary
                errors: 0
            },
            conversionRates: {
                rates: {
                    enrollment: { percentage: enrollmentPercent, count: overviewData.enrolled, total: totalCalls },
                    debtPitch: { percentage: debtPitchPercent, count: overviewData.debtPitch, total: totalCalls },
                    other: { percentage: otherPercentage, count: overviewData.hotique + overviewData.declined + overviewData.callback, total: totalCalls }
                },
                breakdown: {
                    enrolled: overviewData.enrolled || 0,
                    debtPitch: overviewData.debtPitch || 0,
                    callback: overviewData.callback || 0,
                    declined: overviewData.declined || 0,
                    hotique: overviewData.hotique || 0
                }
            },
            dailyQaTrend: dailyTrendRes.rows,
            scoreDistribution: scoreDistribution,
            agentComparison: agentCompRes.rows
        };

        res.status(200).json(dynamicAnalyticsData);
    } catch (error: any) {
        console.error("Error generating dynamic analytics data:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

router.get('/academy', async (req: Request, res: Response): Promise<void> => {
    try {
        const { dateFrom, dateTo } = req.query;

        // 1. Parse pagination parameters with safe fallbacks
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;
        const offset = (page - 1) * pageSize;

        // 2. Query to get the global total match count for pagination math
        const countQuery = `
            SELECT COUNT(*) as total
            FROM calls c
            WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP));
        `;
        const countResult = await db.query(countQuery, [dateFrom, dateTo]);
        const totalCallsCount = parseInt(countResult.rows[0].total) || 0;

        const collectionsQuery = ` SELECT 
                COUNT(CASE WHEN TRIM(ca.academy_collection) = 'Disclosure Excellence' THEN 1 END)::int AS "disclosureExcellence",
                COUNT(CASE WHEN TRIM(ca.academy_collection) = 'Discovery Masters' THEN 1 END)::int AS "discoveryMasters",
                COUNT(CASE WHEN TRIM(ca.academy_collection) = 'Common Mistakes' THEN 1 END)::int AS "commonMistakes",
                COUNT(CASE WHEN TRIM(ca.academy_collection) = 'Objection Handlers' THEN 1 END)::int AS "objectionHandlers",
                COUNT(CASE WHEN TRIM(ca.academy_tag) = 'featured' THEN 1 END)::int AS "featuredCalls"
                FROM calls c
                INNER JOIN agents a ON c.agent_id = a.id
                LEFT JOIN call_analytics ca ON ca.call_id = c.id
                WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP));
        `;

        const collectionsResult = await db.query(collectionsQuery, [dateFrom, dateTo]);
        const counts = collectionsResult.rows[0] || {
            disclosureExcellence: 0,
            discoveryMasters: 0,
            commonMistakes: 0,
            objectionHandlers: 0,
            featuredCalls: 0
        };
        const finalCollections = [
            { name: 'Disclosure Excellence', count: counts.disclosureExcellence },
            { name: 'Discovery Masters', count: counts.discoveryMasters },
            { name: 'Common Mistakes', count: counts.commonMistakes },
            { name: 'Featured Calls', count: counts.featuredCalls },
            { name: 'Objection Handlers', count: counts.objectionHandlers }
        ];

        // 3. Paginated Main Query matching your setup
        const sqlQuery = `
            SELECT 
                c.id,
                a.name AS agent_name,
                a.id AS agent_idx,
                ca.ai_generated_department AS agent_dept,
                c.started_at AS date,
                c.duration_seconds,
                c.recording_url AS audio_url,
                c.campaign,
                COALESCE(c.outcome, 'Unknown') AS "outcome",
                COALESCE(ca.overall_call_score, 0) AS "score",
                COALESCE(ca.call_quality, 0) AS "callQuality",
                COALESCE(ca.disclosures_percentage, 0) AS "disclosuresPercentage",
                COALESCE(ca.compliance_percentage, 0) AS "compliancePercentage",
                COALESCE(ca.call_summary, '') AS "callSummary",
                COALESCE(ca.agent_strengths, '[]'::jsonb) AS "agentStrengths",
                COALESCE(ca.agent_improvements, '[]'::jsonb) AS "agentImprovements",
                COALESCE(ca.coaching_actions, '[]'::jsonb) AS "coachingActions",
                COALESCE(ca.academy_tag, '') AS "academyTag",
                COALESCE(ca.academy_collection, '') AS "academyCollection",
                COALESCE(ca.ai_insights, '{}'::jsonb) AS "insights",
                COALESCE(ca.checkpoint_results, '[]'::jsonb) AS "checkpointResults",
                COALESCE(ca.flags, '[]'::jsonb) AS "flags",
                COALESCE(ca.risk_flags, '[]'::jsonb) AS "riskFlags",
                COALESCE(ca.good_trackers_hit, '[]'::jsonb) AS "goodTrackersHit",
                COALESCE(ca.bad_trackers_triggered, '[]'::jsonb) AS "badTrackersTriggered"
            FROM calls c
            INNER JOIN agents a ON c.agent_id = a.id
            INNER JOIN departments d ON a.department_id = d.id
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
            ORDER BY c.started_at DESC
            LIMIT $3 OFFSET $4;
        `;

        const dbResult = await db.query(sqlQuery, [dateFrom, dateTo, pageSize, offset]);

        const formatDuration = (totalSeconds: number | null): string => {
            if (!totalSeconds) return "0:00";
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        };

        const mappedCalls = dbResult.rows.map((row: any) => {
            const collectionGroup = row.academyCollection || "Common Mistakes";
            const score = row.score !== undefined && row.score !== null ? Number(row.score) : 0;

            let tag = 'featured';
            if (score >= 85) { tag = 'exemplar'; }
            else if (score <= 35) { tag = 'warning'; }

            let cleanAudioUrl = row.audio_url;
            if (typeof cleanAudioUrl === 'string') {
                cleanAudioUrl = cleanAudioUrl.replace(/&amp;/g, '&');
            }

            const durationSec = row.duration_seconds ? Number(row.duration_seconds) : 0;
            const jumpSeconds = durationSec > 0 ? Math.floor(durationSec * 0.20) : 75;
            const readableMarkerTime = formatDuration(jumpSeconds);
            const audioUrlWithJump = cleanAudioUrl ? `${cleanAudioUrl}#t=${jumpSeconds}` : "";

            return {
                id: String(row.id),
                agentName: row.agent_name,
                agentIdx: row.agent_idx,
                agentDept: row.agent_dept,
                outcome: row.outcome,
                date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
                duration: formatDuration(row.duration_seconds),
                campaign: row.campaign || "General Support — Inbound",
                score: score,
                collection: collectionGroup,
                flags: row.flags,
                audioUrl: audioUrlWithJump,
                markers: [
                    { id: `m_${row.id}`, time: readableMarkerTime, label: "Customer Conversation", color: "green", rawSeconds: jumpSeconds }
                ],
                callQuality: row.callQuality,
                disclosuresPercentage: row.disclosuresPercentage,
                compliancePercentage: row.compliancePercentage,
                callSummary: row.callSummary,
                agentStrengths: row.agentStrengths,
                agentImprovements: row.agentImprovements,
                coachingActions: row.coachingActions,
                academyTag: row.academyTag || tag,
                academyCollection: row.academyCollection,
                insights: row.insights,
                checkpointResults: row.checkpointResults,
                riskFlags: row.riskFlags,
                goodTrackersHit: row.goodTrackersHit,
                badTrackersTriggered: row.badTrackersTriggered,
            };
        });

        const finalAcademyData = {
            aggregations: {
                exemplarCount: mappedCalls.filter((c: any) => c.academyTag === 'exemplar').length,
                featuredCount: mappedCalls.filter((c: any) => c.academyTag === 'featured').length,
                warningCount: mappedCalls.filter((c: any) => c.academyTag === 'warning').length,
                totalTaggedCount: totalCallsCount // Pass global total matching records count metric
            },
            collections: finalCollections,
            recentActivity: [
                { id: 1, icon: '⭐', text: 'Summer Spence — tagged Exemplar', timeOffset: '2m ago' },
                { id: 2, icon: '⏱', text: 'Marker added: "Great Opening" at 1:22 — Kaila Minarcin', timeOffset: '8m ago' },
                { id: 3, icon: '📁', text: '3 calls added to Disclosure Excellence', timeOffset: '14m ago' }
            ],
            calls: mappedCalls,
            totalCallsCount: totalCallsCount // Explicit pagination parameter target
        };

        res.status(200).json(finalAcademyData);

    } catch (error: any) {
        console.error("Failed to parse database academy call data:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/sdr-pipeline', async (req: Request, res: Response): Promise<void> => {
    try {
        const rawDateFrom = String(req.query.dateFrom || '2026-06-16');
        const rawDateTo = String(req.query.dateTo || '2026-06-18');
        const dateFrom = `${rawDateFrom} 00:00:00`;
        const dateTo = `${rawDateTo} 23:59:59`;

        // Helper function to generate an absolute unique/consistent color based on string hash
        const getAgentColor = (name: string): string => {
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            return "#" + "00000".substring(0, 6 - c.length) + c;
        };

        // Query fetching all active agents with safe JSONB array handles
        const sqlQuery = `
    SELECT 
        a.name AS "name",
        COALESCE(ca.ai_generated_department, 'SDR') AS "dept",
        COUNT(c.id)::INT AS "calls",
        ROUND(AVG(COALESCE(ca.overall_call_score, 0))::NUMERIC, 1)::FLOAT AS "qa",
        ROUND(AVG(COALESCE(ca.disclosures_percentage, 0))::NUMERIC, 1)::FLOAT AS "discAdh",
        ROUND(COALESCE(AVG(ca.talk_ratio_percent::NUMERIC), 49.2)::NUMERIC, 1)::FLOAT AS "talkRatio",
        
        SUM(COALESCE(ca.objection_handled_count, 0))::INT AS "objRate",        
        SUM(COALESCE(ca.bad_tracker_count, 0))::INT AS "badTrack",
        
        -- Dynamic conversion outcome aggregations
        SUM(CASE WHEN LOWER(TRIM(c.outcome)) = 'enrolled' THEN 1 ELSE 0 END)::INT AS "enrolls",
        GREATEST(1, EXTRACT(DAY FROM (NOW() - MIN(c.started_at))))::INT AS "computedDay",
        
        -- Subquery tracking the precise final score achieved by this agent
        (
            SELECT COALESCE(inner_ca.overall_call_score, 0)
            FROM calls inner_c
            LEFT JOIN call_analytics inner_ca ON inner_ca.call_id = inner_c.id
            WHERE inner_c.agent_id = a.id AND inner_c.deleted_at IS NULL
            ORDER BY inner_c.started_at DESC
            LIMIT 1
        )::INT AS "lastScore"
    FROM calls c
    INNER JOIN agents a ON c.agent_id = a.id
    LEFT JOIN call_analytics ca ON ca.call_id = c.id
    WHERE c.deleted_at IS NULL
      AND (c.started_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
      AND (
           ca.ai_generated_department ILIKE '%SDR%' 
           OR LOWER(TRIM(ca.ai_generated_department)) = 'jr closer'
      )
    GROUP BY a.id, a.name, ca.ai_generated_department;
`;

        const queryParams = [dateFrom, dateTo];
        const result = await db.query(sqlQuery, queryParams);

        // Map database records into standard layout entities
        const sdrAgents = result.rows.map((row: any) => {
            // Determine active days tracked on the platform (cap timeline scale contextually at 14 days)
            const dynamicDay = Math.min(14, row.computedDay || 1);

            // Calculate overall metric readiness score dynamically using weighted formula matrices
            const computedReadiness = Math.round(
                (row.qa * 0.4) +
                (row.discAdh * 0.4) +
                (Math.max(0, 100 - (row.badTrack * 12)) * 0.2)
            );
            const finalReadiness = Math.min(100, Math.max(0, computedReadiness));

            // Dynamic evaluation gate status rule calculations
            let dynamicStatus = "NOT_YET";
            if (finalReadiness >= 82 && dynamicDay >= 12) {
                dynamicStatus = "READY";
            } else if (finalReadiness >= 92 && dynamicDay === 14) {
                dynamicStatus = "PROMOTED";
            } else if (row.qa < 70 || row.badTrack > 3) {
                dynamicStatus = "WATCH";
            }

            // Trend flag matching current performance vs their final historical call
            const dynamicTrend = row.lastScore >= row.qa ? "up" : "flat";

            return {
                name: row.name,
                day: dynamicDay,
                qa: row.qa,
                discAdh: row.discAdh,
                talkRatio: row.talkRatio,
                objRate: row.objRate,
                badTrack: row.badTrack,
                readiness: finalReadiness,
                status: dynamicStatus,
                agentColor: getAgentColor(row.name),
                dept: row.dept,
                calls: row.calls,
                trend: dynamicTrend,
                enrolls: row.enrolls,
                lastScore: row.lastScore || Math.round(row.qa),
                dims: {
                    qaDim: row.qa,
                    discDim: row.discAdh,
                    talkDim: row.talkRatio,
                    badDim: row.badTrack,
                    objDim: row.objRate
                }
            };
        });

        res.status(200).json({
            success: true,
            sdrAgents
        });
    } catch (error: any) {
        console.error("GET /sdr-pipeline production error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error Pipeline", error: error.message });
    }
});

router.get("/pips", async (req: Request, res: Response) => {
    try {
        const rawDateFrom = String(req.query.dateFrom || '2026-06-16');
        const rawDateTo = String(req.query.dateTo || '2026-06-18');
        const dateFrom = `${rawDateFrom} 00:00:00`;
        const dateTo = `${rawDateTo} 23:59:59`;
        const queryParams = [dateFrom, dateTo];

        // --- QUERY 1: Active PIP Cards ---
        const pipSqlQuery = `
            SELECT 
                a.name AS "agent",
                d.name AS "dept",
                d.pip_duration_days AS "maxDays",
                d.qa_threshold_warning AS "threshold",
                COALESCE(d.max_strikes, 2) AS "maxStrikes",
                AVG(COALESCE(ca.overall_call_score, 0))::INT AS "avgScore",
                COUNT(CASE WHEN jsonb_array_length(COALESCE(ca.flags, '[]'::jsonb)) > 0 THEN 1 END) AS "strikeCount",
                MIN(c.started_at) AS "firstFailureDate"
            FROM calls c
            INNER JOIN agents a ON c.agent_id = a.id
            INNER JOIN departments d ON a.department_id = d.id
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE c.deleted_at IS NULL
              AND (c.started_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
            GROUP BY a.id, a.name, d.id, d.name, d.pip_duration_days, d.qa_threshold_warning, d.max_strikes
            HAVING AVG(COALESCE(ca.overall_call_score, 0)) < d.qa_threshold_warning;
        `;
        const pipResult = await db.query(pipSqlQuery, queryParams);

        // Track how many agents fall into each milestone tier dynamically
        let stage1Count = 0; // System auto-flags / Real-time
        let stage2Count = 0; // Floor Manager (Day 1-7)
        let stage3Count = 0; // Operations Director (Day 7)
        let stage4Count = 0; // Executive Decision (Day 14)

        const formattedPips = pipResult.rows.map((row: any) => {
            let dayValue = 1;
            const maxDaysAllowed = row.maxDays || 14;

            if (row.firstFailureDate) {
                const start = new Date(row.firstFailureDate).getTime();
                const currentOrEndWindow = new Date(dateTo).getTime();
                const diffTime = Math.abs(currentOrEndWindow - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                dayValue = Math.max(1, diffDays);
            }

            if (row.strikeCount >= row.maxStrikes) {
                dayValue = Math.max(dayValue, Math.floor(maxDaysAllowed * 0.85));
            } else if (row.strikeCount > 0) {
                const strikeProgression = Math.floor((row.strikeCount / row.maxStrikes) * maxDaysAllowed);
                dayValue = Math.max(dayValue, strikeProgression);
            }
            dayValue = Math.min(maxDaysAllowed, dayValue);

            // Dynamically allocate agent count into escalation stages based on their computed dayValue
            const midPoint = Math.floor(maxDaysAllowed / 2);
            if (dayValue >= maxDaysAllowed) {
                stage4Count++;
            } else if (dayValue === midPoint) {
                stage3Count++;
            } else if (dayValue > 1 && dayValue < midPoint) {
                stage2Count++;
            } else {
                stage1Count++;
            }

            return {
                agent: row.agent,
                dept: row.dept,
                reason: `QA avg ${row.avgScore}% over active logging window (threshold: ${row.threshold}%) with ${row.strikeCount}/${row.maxStrikes} policy strikes`,
                day: dayValue,
                target: `QA ≥ ${Number(row.threshold) + 10}% by Day ${maxDaysAllowed}`,
                // manager: 'Floor Manager',
                color: dayValue >= (maxDaysAllowed - 2) ? 'var(--red)' : dayValue >= Math.floor(maxDaysAllowed / 2) ? 'var(--orange)' : 'var(--gold)'
            };
        });

        // --- QUERY 2: Zero-Tolerance Real-Time Statistics Panel ---
        const ztSqlQuery = `
            SELECT 
                COUNT(CASE WHEN jsonb_array_length(COALESCE(ca.flags, '[]'::jsonb)) > 0 THEN 1 END) AS "agentStrikes"
            FROM agents a
            INNER JOIN departments d ON a.department_id = d.id
            LEFT JOIN calls c ON c.agent_id = a.id AND c.deleted_at IS NULL AND (c.started_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE d.zero_tolerance = true AND a.deleted_at IS NULL
            GROUP BY a.id;
        `;
        const ztResult = await db.query(ztSqlQuery, queryParams);

        let strike1s = 0;
        let strike2s = 0;
        let clean = 0;

        ztResult.rows.forEach((row: any) => {
            const strikes = parseInt(row.agentStrikes || 0);
            if (strikes === 1) strike1s++;
            else if (strikes >= 2) strike2s++;
            else clean++;
        });

        // Pull general rules setup from the database configuration
        const deptConfigQuery = `SELECT COALESCE(MAX(pip_duration_days), 14) AS "maxDays" FROM departments WHERE deleted_at IS NULL;`;
        const configResult = await db.query(deptConfigQuery);
        const generalMaxDays = configResult.rows[0]?.maxDays || 14;
        const dynamicMidPoint = Math.floor(generalMaxDays / 2);

        // --- COMPILING COMPLETELY DYNAMIC CODES ---
        const escalationHierarchy = [
            {
                level: 1,
                role: "Agent",
                description: `System auto-flags instantly (${stage1Count} active)`,
                badgeText: "Real-time",
                badgeColor: "grey"
            },
            {
                level: 2,
                role: "Floor Manager",
                description: `Daily coaching, documents everything (${stage2Count} active)`,
                badgeText: `Day 1-${dynamicMidPoint}`,
                badgeColor: "gold"
            },
            {
                level: 3,
                role: "Operations Director",
                description: `Midpoint review (${stage3Count} active)`,
                badgeText: `Day ${dynamicMidPoint}`,
                badgeColor: "orange"
            },
            {
                level: 4,
                role: "Nick — Executive Decision",
                description: `Final assessment panel (${stage4Count} active)`,
                badgeText: `Day ${generalMaxDays}`,
                badgeColor: "gold",
                isExecutive: true
            }
        ];

        return res.status(200).json({
            success: true,
            pips: formattedPips,
            zeroToleranceStats: { strike1s, strike2s, clean },
            escalationHierarchy
        });

    } catch (error: any) {
        console.error("GET /pips calculation failure:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/flag', async (req: Request, res: Response): Promise<void> => {
    try {
        const { callId } = req.body;

        if (!callId) {
            res.status(400).json({ error: "Missing callId parameter." });
            return;
        }

        const updateQuery = `
            UPDATE call_analytics 
            SET flags = COALESCE(flags, '[]'::jsonb) || '["🚩 Flag"]'::jsonb
            WHERE call_id = $1
            RETURNING flags;
        `;

        const result = await db.query(updateQuery, [callId]);

        if (result.rowCount === 0) {
            res.status(404).json({ error: "Call analytics record not found for this ID." });
            return;
        }

        res.status(200).json({
            success: true,
            message: "Record marked as 🚩 Flag",
            updatedFlags: result.rows[0].risk_flags
        });

    } catch (error: any) {
        console.error("Error flagging call:", error);
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

router.get('/conversion-board', async (req: Request, res: Response): Promise<void> => {
    const client = await db.connect();
    try {
        // Use the current date for real-time live floor tracking metrics
        const rawDateFrom = String(req.query.dateFrom || '2026-06-16');
        const rawDateTo = String(req.query.dateTo || '2026-06-18');
        const dateFrom = `${rawDateFrom} 00:00:00`;
        const dateTo = `${rawDateTo} 23:59:59`;

        // 1. Fetch Funnel Funnel Funnel Overview / Top cards for the day
        const metricsQuery = `
            SELECT 
                COUNT(c.id) AS "total",
                SUM(CASE WHEN c.duration_seconds > 0 THEN 1 ELSE 0 END) AS "connected",
                SUM(CASE WHEN ca.overall_call_score >= 50 THEN 1 ELSE 0 END) AS "qualified",
                SUM(CASE WHEN c.outcome = 'Enrolled' THEN 1 ELSE 0 END) AS "converted"
            FROM calls c
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE c.deleted_at IS NULL
              AND c.started_at BETWEEN $1::timestamp AND $2::timestamp;
        `;
        const metricsResult = await client.query(metricsQuery, [dateFrom, dateTo]);
        const m = metricsResult.rows[0];

        const total = Math.max(0, parseInt(m.total || 0));
        const connected = Math.max(0, parseInt(m.connected || 0));
        const qualified = Math.max(0, parseInt(m.qualified || 0));
        const converted = Math.max(0, parseInt(m.converted || 0));

        // Constants matching UI rule assumptions
        const PAYOUT = 40;
        const GOAL = 75;

        // Calculate business day timeline progress (8 AM to 8 PM window)
        const now = new Date();
        const startHour = 8;
        const endHour = 20;
        const currentHour = now.getHours();
        let elapsed = 0.05; // Default minimal start value

        if (currentHour >= startHour && currentHour < endHour) {
            const totalSecs = (endHour - startHour) * 3600;
            const currentSecs = ((currentHour - startHour) * 3600) + (now.getMinutes() * 60) + now.getSeconds();
            elapsed = parseFloat((currentSecs / totalSecs).toFixed(2));
        } else if (currentHour >= endHour) {
            elapsed = 1.0;
        }

        const cvr = total > 0 ? parseFloat(((converted / total) * 100).toFixed(1)) : 0;
        const revenue = converted * PAYOUT;
        const projected = Math.round(converted / Math.max(0.01, elapsed));
        const expectedNow = Math.round(GOAL * elapsed);
        const runRate = Math.round(revenue / Math.max(0.01, elapsed));

        // 2. Fetch Hourly Trend Sequence
        const hourlyQuery = `
            SELECT 
                EXTRACT(HOUR FROM c.started_at)::int AS "hour",
                SUM(CASE WHEN c.outcome = 'Enrolled' THEN 1 ELSE 0 END)::int AS "conv"
            FROM calls c
            WHERE c.deleted_at IS NULL
              AND c.started_at BETWEEN $1::timestamp AND $2::timestamp
            GROUP BY EXTRACT(HOUR FROM c.started_at)
            ORDER BY "hour" ASC;
        `;
        const hourlyResult = await client.query(hourlyQuery, [dateFrom, dateTo]);

        // Structure standard operational hours skeleton list (8am - 8pm)
        const hours = Array.from({ length: 13 }, (_, i) => {
            const h = i + 8;
            const match = hourlyResult.rows.find((row: any) => row.hour === h);
            return { hour: h, conv: match ? match.conv : 0 };
        });

        // 3. Fetch Top Lines Performance (Campaign Leaderboard)
        const sourcesQuery = `
            SELECT 
                c.campaign AS "name",
                COUNT(c.id)::int AS "calls",
                SUM(CASE WHEN c.outcome = 'Enrolled' THEN 1 ELSE 0 END)::int AS "converted"
            FROM calls c
            WHERE c.deleted_at IS NULL
              AND c.started_at BETWEEN $1::timestamp AND $2::timestamp
              AND c.campaign IS NOT NULL AND c.campaign != '' AND c.campaign != 'Unknown'
            GROUP BY c.campaign
            ORDER BY "converted" DESC, "calls" DESC
            LIMIT 5;
        `;
        const sourcesResult = await client.query(sourcesQuery, [dateFrom, dateTo]);
        const sources = sourcesResult.rows.map((row: any, index: number) => ({
            id: `s${index + 1}`,
            name: row.name,
            calls: row.calls,
            converted: row.converted
        }));

        // Handle fallback structure context if sources display is clean empty
        if (sources.length === 0) {
            sources.push(
                { id: "s1", name: "Inbound General Campaign", calls: total, converted: converted }
            );
        }

        // 4. Fetch Live Recent Conversions Ticker Feed
        const feedQuery = `
            SELECT 
                c.id::text AS "id",
                c.client_phone AS "phone",
                COALESCE(c.campaign, 'Direct Inbound') AS "source",
                TO_CHAR(c.started_at, 'HH:MI PM') AS "time"
            FROM calls c
            WHERE c.deleted_at IS NULL
              AND c.outcome = 'Enrolled' AND c.started_at BETWEEN $1::timestamp AND $2::timestamp
            ORDER BY c.started_at DESC
            LIMIT 5;
        `;
        const feedResult = await client.query(feedQuery, [dateFrom, dateTo]);
        const feed = feedResult.rows.map((row: any) => {
            // Mask phone numbers dynamically matching user client snapshot masking style
            let rawPhone = row.phone || "(555) 000-0000";
            let maskedPhone = rawPhone;
            if (rawPhone.length >= 5) {
                maskedPhone = rawPhone.substring(0, 3) + "•••" + rawPhone.substring(rawPhone.length - 4);
            }
            return {
                id: row.id,
                phone: maskedPhone,
                state: "Live", // Static fallback where state lookup field isn't on base call table
                source: row.source,
                payout: PAYOUT,
                time: row.time
            };
        });

        // Assemble the uniform payload contract object matching frontend requirements
        const conversionBoardData = {
            total,
            connected,
            qualified,
            converted,
            revenue,
            projected,
            expectedNow,
            elapsed,
            cvr,
            runRate,
            ydayRevenue: 2000, // Static baseline benchmark fallback value
            hours,
            sources,
            feed
        };

        res.status(200).json(conversionBoardData);
    } catch (error: any) {
        console.error("Database compilation failed for conversion board metrics:", error);
        res.status(500).json({ error: 'Failed to fetch live conversion board data context pipeline', details: error.message });
    } finally {
        client.release();
    }
})

export default router;