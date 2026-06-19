import express from "express";
import { Request, Response } from "express";
import db from "../db/pool";
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

// GET Route to supply page-load requests
router.get('/calls', async (req: Request, res: Response) => {
    try {
        const queryText = ` SELECT c.id, a.id AS "agentIdx", a.name AS "agentName", c.outcome, c.created_at as date, c.duration_seconds as duration, c.campaign, c.client_name as client
                            FROM calls c LEFT JOIN agents a ON c.agent_id = a.id ORDER BY c.created_at DESC; `;
        const result = await db.query(queryText);

        // Inject the 'expanded: false' field required by UI component mapping
        const dynamicCalls: Call[] = result.rows.map((row: any) => ({
            ...row,
            expanded: false,
            // Fallback for agent index/ID if the join result returns null values
            agentIdx: row.agentIdx ?? 0,
            agentName: row.agentName || "Unknown Agent",
            agentDept: row.agentDept || "Sales",
            score: row.score || Math.floor(Math.random() * 101),
            flags: row.flags || [],
            leadSource: row.leadSource || "CallerReady"
        }));
        res.status(200).json({
            success: true,
            data: dynamicCalls
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: "Failed to read data logs from database",
            error: error.message
        });
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
        const sqlQuery = `SELECT a.name, d.name AS dept, COUNT(c.id) AS calls FROM calls c
                          INNER JOIN agents a ON c.agent_id = a.id
                          INNER JOIN departments d ON a.department_id = d.id
                          WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
                          GROUP BY a.id, a.name, d.name;`;

        const queryParams = [dateFrom, dateTo];
        const result = await db.query(sqlQuery, queryParams);

        // 2. Format database results with your clean static placeholders
        const formattedRows = result.rows.map((row: any) => {
            const callsCount = Number(row.calls);
            const mockEnrolls = callsCount > 0 ? Math.floor(Math.random() * (callsCount / 2)) : 0;
            const mockFlagged = callsCount > 0 ? Math.floor(Math.random() * Math.min(4, callsCount)) : 0;
            const randomMinutes = Math.floor(Math.random() * 6) + 2;
            const randomSeconds = String(Math.floor(Math.random() * 60)).padStart(2, '0');
            const mockAvgLen = `${randomMinutes}:${randomSeconds}`;
            const mockEff = (Math.random() * 1.75 + 1.25).toFixed(2) + 'x';
            const calculatedFlagRate = callsCount > 0
                ? Math.round((mockFlagged / callsCount) * 100) + '%'
                : '0%';

            return {
                name: row.name,
                dept: row.dept,
                score: Math.floor(Math.random() * 50) + 50, // Static score between 50 and 100
                calls: callsCount,
                enrolls: mockEnrolls,
                avgLen: mockAvgLen,
                eff: mockEff,
                flagged: mockFlagged,
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

        // 1. Fetch real details from database instead of an aggregated count
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
            c.outcome AS collection
        FROM calls c
        INNER JOIN agents a ON c.agent_id = a.id
        INNER JOIN departments d ON a.department_id = d.id
        WHERE (c.created_at BETWEEN CAST($1 AS TIMESTAMP) AND CAST($2 AS TIMESTAMP))
        ORDER BY c.started_at DESC;
    `;

        // Assuming you are using 'pg' (node-postgres) client instance named db/pool
        // const dbResult = await db.query(sqlQuery, [dateFrom, dateTo]);
        const dbResult = await db.query(sqlQuery, [dateFrom, dateTo]);

        // Helper to format duration_seconds into "M:SS" string format
        const formatDuration = (totalSeconds: number | null): string => {
            if (!totalSeconds) return "0:00";
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        };

        // 2. Map database rows into the clean object layout your frontend requires
        const mappedCalls = dbResult.rows.map((row: any) => {
            const collectionGroup = row.collection || "Common Mistakes";
            const randomSeed = Math.random();
            let score = 70; // fallback default
            if (randomSeed < 0.25) {
                score = Math.floor(Math.random() * 16) + 85; // 85 - 100 (Exemplar)
            } else if (randomSeed < 0.45) {
                score = Math.floor(Math.random() * 36);      // 0 - 35 (Warning)
            } else {
                score = Math.floor(Math.random() * 49) + 36; // 36 - 84 (Featured)
            }

            // B. Score-Based Academy Auto-Tag Logic Mapping
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

            return {
                id: String(row.id),
                agentName: row.agent_name,
                agentIdx: row.agent_idx,
                agentDept: row.agent_dept,
                // Kept as an ISO string or native date instance depending on frontend mapping layer
                date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
                duration: formatDuration(row.duration_seconds),
                campaign: row.campaign || "General Support — Inbound",
                academyTag: tag, // Safe mapping fallback
                score: score,     // Database doesn't have a score column, generating static/dynamic value
                collection: collectionGroup,
                flags: [], // Static property requested
                audioUrl: cleanAudioUrl,
                markers: [
                    { id: `m_${row.id}`, time: "1:15", label: "Customer Conversation", color: "green" }
                ]
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
export default router;