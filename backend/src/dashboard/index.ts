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

// Mock database query logic
const getCallsFromDatabase = (): Call[] => {
    return [
        {
            id: 1101,
            agentIdx: 0,
            agentName: "Jamison Bray",
            agentDept: "Debt Sales",
            score: 84,
            outcome: "Enrolled",
            flags: [],
            date: new Date(),
            duration: "08:14",
            campaign: "City Lending — Debt Relief",
            client: "James Thompson",
            leadSource: "Facebook",
            subId: "FB_CL_003_CA_25-45",
            expanded: true
        },
        {
            id: 1102,
            agentIdx: 1,
            agentName: "Kaila Minarcin",
            agentDept: "Debt Sales",
            score: 42,
            outcome: "Declined",
            flags: ["Skipped Credit Pull", "Rushed Call"],
            date: new Date(Date.now() - 45 * 60 * 1000),
            duration: "03:41",
            campaign: "Facebook Leads",
            client: "Maria Rodriguez",
            leadSource: "Facebook",
            subId: "FB_CL_007_TX_35-55",
            expanded: false
        },
        {
            id: 1103,
            agentIdx: 2,
            agentName: "Sarah Jenkins",
            agentDept: "Debt Sales",
            score: 95,
            outcome: "Enrolled",
            flags: [],
            date: new Date(Date.now() - 2 * 3600 * 1000),
            duration: "12:15",
            campaign: "Google Search — Debt Consolidation",
            client: "Robert Chen",
            leadSource: "Google",
            subId: "G_SEO_01_US_Core",
            expanded: false
        },
        {
            id: 1104,
            agentIdx: 3,
            agentName: "Marcus Vance",
            agentDept: "Tax Relief",
            score: 55,
            outcome: "Callback",
            flags: ["Interrupted Client"],
            date: new Date(Date.now() - 4 * 3600 * 1000),
            duration: "05:22",
            campaign: "Tax Relief Inbound",
            client: "Linda Hargrove",
            leadSource: "Radio",
            subId: "RAD_TX_04_Morn",
            expanded: false
        },
        {
            id: 1105,
            agentIdx: 0,
            agentName: "Jamison Bray",
            agentDept: "Debt Sales",
            score: 78,
            outcome: "Callback",
            flags: [],
            date: new Date(Date.now() - 6 * 3600 * 1000),
            duration: "06:47",
            campaign: "City Lending — Debt Relief",
            client: "David Miller",
            leadSource: "Facebook",
            subId: "FB_CL_003_CA_25-45",
            expanded: false
        },
        // {
        //     id: 1106,
        //     agentIdx: 4,
        //     agentName: "Elena Rostova",
        //     agentDept: "Debt Sales",
        //     score: 31,
        //     outcome: "Declined",
        //     flags: ["Dead Air Detection", "Missed Mini-Miranda"],
        //     date: new Date(Date.now() - 24 * 3600 * 1000),
        //     duration: "02:10",
        //     campaign: "Cold Outbound List B",
        //     client: "William Fletcher",
        //     leadSource: "Direct Mail",
        //     subId: "DM_DB_V2_NY",
        //     expanded: false
        // },
        // {
        //     id: 1107,
        //     agentIdx: 1,
        //     agentName: "Kaila Minarcin",
        //     agentDept: "Debt Sales",
        //     score: 89,
        //     outcome: "Enrolled",
        //     flags: [],
        //     date: new Date(Date.now() - 26 * 3600 * 1000),
        //     duration: "10:33",
        //     campaign: "Facebook Leads",
        //     client: "Amanda Ross",
        //     leadSource: "Facebook",
        //     subId: "FB_CL_007_TX_35-55",
        //     expanded: false
        // },
        // {
        //     id: 1108,
        //     agentIdx: 5,
        //     agentName: "Derek Brooks",
        //     agentDept: "Tax Relief",
        //     score: 68,
        //     outcome: "Not Qualified",
        //     flags: ["Low Tone/Energy"],
        //     date: new Date(Date.now() - 28 * 3600 * 1000),
        //     duration: "04:15",
        //     campaign: "Tax Back-Taxes Promo",
        //     client: "Gary Oak",
        //     leadSource: "TikTok",
        //     subId: "TT_TX_Vids_02",
        //     expanded: false
        // },
        // {
        //     id: 1109,
        //     agentIdx: 2,
        //     agentName: "Sarah Jenkins",
        //     agentDept: "Debt Sales",
        //     score: 91,
        //     outcome: "Enrolled",
        //     flags: [],
        //     date: new Date(Date.now() - 32 * 3600 * 1000),
        //     duration: "14:02",
        //     campaign: "Google Search — Debt Consolidation",
        //     client: "Patricia Martinez",
        //     leadSource: "Google",
        //     subId: "G_SEO_01_US_Core",
        //     expanded: false
        // },
        // {
        //     id: 1110,
        //     agentIdx: 3,
        //     agentName: "Marcus Vance",
        //     agentDept: "Tax Relief",
        //     score: 72,
        //     outcome: "Enrolled",
        //     flags: [],
        //     date: new Date(Date.now() - 48 * 3600 * 1000),
        //     duration: "09:50",
        //     campaign: "Tax Relief Inbound",
        //     client: "Brian O'Conner",
        //     leadSource: "Radio",
        //     subId: "RAD_TX_04_Morn",
        //     expanded: false
        // }
    ];
};

// GET Route to supply page-load requests
router.get('/calls', async (req: Request, res: Response) => {
    try {
        // Replace with: const liveCalls = await CallModel.find().sort({ date: -1 });
        const liveCalls = getCallsFromDatabase();
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
            // data: dynamicCalls
            data: liveCalls
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
export default router;