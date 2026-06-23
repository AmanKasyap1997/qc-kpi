import express from "express";
import { Request, Response } from "express";
import db from "../db/pool";
import { any } from "joi";
const router = express.Router();

// Your interface/type definition for safety
interface Call {
    id: number;
    agentIdx: number;
    agentName: string;
    agentDept: string;
    score: number;
    outcome: string;
    flags: string[];
    date: Date;
    duration: string;
    campaign: string;
    client: string;
    leadSource: string;
    subId: string;
    expanded: boolean;
}

router.get("/zendesk", async (req: Request, res: Response) => {
    const { dateFrom } = req.query;
    try {
        const today = dateFrom || new Date().toISOString().slice(0, 10);
        const statsQuery = `SELECT COUNT(*) FILTER (WHERE entity = 'TAX') AS tax_total, COUNT(*) FILTER (WHERE entity = 'TAX' AND status = 'PENDING') AS tax_pending, COUNT(*) FILTER (WHERE entity = 'TAX' AND status = 'PENDING' AND priority = 'urgent') AS tax_urgent_pending, COUNT(*) FILTER (WHERE entity = 'TAX' AND status = 'SOLVED') AS tax_solved, COUNT(*) FILTER (WHERE entity = 'DEBT') AS debt_total, COUNT(*) FILTER (WHERE entity = 'DEBT' AND status = 'OPEN') AS debt_open, COUNT(*) FILTER (WHERE entity = 'DEBT' AND assignee_id IS NULL) AS debt_unassigned, COUNT(*) FILTER (WHERE entity = 'DEBT' AND status = 'SOLVED') AS debt_solved FROM zendesk_tickets WHERE DATE(created_at) = $1`;
        const result = await db.query(statsQuery, [today]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.get("/live-feed-widget-data", async (req: Request, res: Response) => {
    const client = await db.connect();

    try {
        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo   = req.query.dateTo   as string | undefined;

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
                WHERE ${whereClause}
            )
            SELECT
                COUNT(*) AS "totalCalls",
                ROUND(AVG(score)::numeric, 2) AS "avgScore",
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
            success:   true,
            data:      summary,
            agentData: agentResult.rows,
            flagsData: flagsData,   // already an array from jsonb_agg
        });

    } catch (error: any) {
        console.error("GET /live-feed-widget-data error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to read call data",
            error:   error.message,
        });
    } finally {
        client.release();
    }
});


router.get("/calls", async (req: Request, res: Response) => {
    const mode = String(req.query.mode || 'all');
    const rawDateFrom = String(req.query.dateFrom || '2026-06-16');
    const rawDateTo = String(req.query.dateTo || '2026-06-18');
    const dateFrom = `${rawDateFrom} 00:00:00`;
    const dateTo = `${rawDateTo} 23:59:59`;

    const client = await db.connect();

    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50));
        const offset = (page - 1) * pageSize;

        const dateFrom = req.query.dateFrom as string | undefined;
        const dateTo = req.query.dateTo as string | undefined;

        // Build WHERE clause
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

        // Count query for total
        const countResult = await client.query(
            `SELECT COUNT(*) AS total FROM calls c WHERE ${whereClause}`,
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
                SUM(CASE WHEN c.outcome = 'Converted' THEN 1 ELSE 0 END) AS "enrolls",
                SUM(CASE WHEN jsonb_array_length(COALESCE(ca.flags, '[]'::jsonb)) > 0 THEN 1 ELSE 0 END) AS "flagged"
            FROM calls c
            LEFT JOIN agents a ON c.agent_id = a.id
            LEFT JOIN call_analytics ca ON ca.call_id = c.id
            WHERE c.deleted_at IS NULL
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
                name: row.name || "Unknown Agent",
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
        // Extract query parameters (ready for when you transition to dynamic data)
        const { dateFrom, dateTo } = req.query;

        const staticAnalyticsData = {
            overview: {
                totalCalls: 5555,
                avgAdherence: 53.6,
                avgLength: "6:46",
                scored: 2273,
                pending: 0,
                errors: 0
            },
            conversionRates: {
                rates: {
                    enrollment: { percentage: 3.3, count: 74, total: 2273 },
                    debtPitch: { percentage: 2.3, count: 52, total: 2273 },
                    other: { percentage: 0.0, count: null, total: null }
                },
                breakdown: {
                    enrolled: 74,
                    debtPitch: 82,
                    callback: 622,
                    declined: 148,
                    hotique: 242
                }
            },
            dailyQaTrend: [
                { date: '3/22', value: 48 },
                { date: '3/23', value: 52 },
                { date: '3/24', value: 49 },
                { date: '3/25', value: 55 },
                { date: '3/26', value: 51 },
                { date: '3/27', value: 54 },
                { date: '3/28', value: 50 },
                { date: '3/29', value: 53.6 }
            ],
            scoreDistribution: [
                { min: 0, max: 9, count: 22 },
                { min: 10, max: 19, count: 105 },
                { min: 20, max: 29, count: 195 },
                { min: 30, max: 39, count: 327 },
                { min: 40, max: 49, count: 119 },
                { min: 50, max: 59, count: 401 },
                { min: 60, max: 69, count: 614 },
                { min: 70, max: 79, count: 401 },
                { min: 80, max: 89, count: 119 },
                { min: 90, max: 100, count: 8 }
            ],
            // Note: Substitute mock records here matching your AGENTS structure
            agentComparison: [
                { name: "Agent 1", score: 85 },
                { name: "Agent 2", score: 72 },
                { name: "Agent 3", score: 54 },
                { name: "Agent 4", score: 91 },
                { name: "Agent 5", score: 43 },
                { name: "Agent 6", score: 68 }
            ]
        };

        res.status(200).json(staticAnalyticsData);
    } catch (error) {
        console.error("Error generating analytics data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get('/academy', async (req: Request, res: Response): Promise<void> => {
    try {
        const { dateFrom, dateTo } = req.query;
        const sqlQuery = `
                        SELECT 
                            c.id,
                            a.name AS agent_name,
                            a.id AS agent_idx,
                            d.name AS agent_dept,
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
                            COALESCE(ca.risk_flags, '[]'::jsonb) AS "riskFlags",
                            COALESCE(ca.good_trackers_hit, '[]'::jsonb) AS "goodTrackersHit",
                            COALESCE(ca.bad_trackers_triggered, '[]'::jsonb) AS "badTrackersTriggered"
                        FROM calls c
                        INNER JOIN agents a ON c.agent_id = a.id
                        INNER JOIN departments d ON a.department_id = d.id
                        LEFT JOIN call_analytics ca ON ca.call_id = c.id
                        WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
                        ORDER BY c.started_at DESC;
                    `;

        const dbResult = await db.query(sqlQuery, [dateFrom, dateTo]);
        const formatDuration = (totalSeconds: number | null): string => {
            if (!totalSeconds) return "0:00";
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        };

        // 2. Map database rows into the clean object layout your frontend requires
        const mappedCalls = dbResult.rows.map((row: any) => {
            const collectionGroup = row.collection || "Common Mistakes";
            const score = row.score !== undefined && row.score !== null ? Number(row.score) : 0;
            let tag = 'featured';
            if (score >= 85) {
                tag = 'exemplar';
            } else if (score <= 35) {
                tag = 'warning';
            }
            let cleanAudioUrl = row.audio_url;
            if (typeof cleanAudioUrl === 'string') {
                cleanAudioUrl = cleanAudioUrl.replace(/&amp;/g, '&');
            }
            // --- DYNAMIC AUDIO TIMESTAMP JUMP CALCULATION ---
            const durationSec = row.duration_seconds ? Number(row.duration_seconds) : 0;
            const jumpSeconds = durationSec > 0 ? Math.floor(durationSec * 0.20) : 75;
            const readableMarkerTime = formatDuration(jumpSeconds);

            // Append standard media fragment hash (#t=seconds) so browsers jump instantly on load
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
                score: score,     // Database doesn't have a score column, generating static/dynamic value
                collection: collectionGroup,
                flags: [], // Static property requested
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
                academyTag: row.academyTag,
                academyCollection: row.academyCollection,
                insights: row.insights,
                checkpointResults: row.checkpointResults,
                riskFlags: row.riskFlags,
                goodTrackersHit: row.goodTrackersHit,
                badTrackersTriggered: row.badTrackersTriggered,
            };
        });

        // 3. Combine with the remaining dashboard aggregation properties
        const finalAcademyData = {
            aggregations: {
                exemplarCount: mappedCalls.filter((c: any) => c.academyTag === 'exemplar').length,
                featuredCount: mappedCalls.filter((c: any) => c.academyTag === 'featured').length,
                warningCount: mappedCalls.filter((c: any) => c.academyTag === 'warning').length,
                totalTaggedCount: mappedCalls.length
            },
            collections: [
                { name: 'Disclosure Excellence', count: mappedCalls.filter((c: any) => c.collection === 'Disclosure Excellence').length },
                { name: 'Discovery Masters', count: 4 },
                { name: 'Common Mistakes', count: mappedCalls.filter((c: any) => c.collection === 'Common Mistakes').length },
                { name: 'Featured Calls', count: 3 },
                { name: 'Objection Handlers', count: 7 }
            ],
            recentActivity: [
                { id: 1, icon: '⭐', text: 'Summer Spence — tagged Exemplar', timeOffset: '2m ago' },
                { id: 2, icon: '⏱', text: 'Marker added: "Great Opening" at 1:22 — Kaila Minarcin', timeOffset: '8m ago' },
                { id: 3, icon: '📁', text: '3 calls added to Disclosure Excellence', timeOffset: '14m ago' }
            ],
            calls: mappedCalls // Real live data loaded right here
        };

        res.status(200).json(finalAcademyData);

    } catch (error: any) {
        console.error("Failed to parse database academy call data:", error);
        res.status(500).json({ success: false, error: error.message });
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

export default router;