import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Request, Response } from "express";
import db from "../../db/pool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE_CR = path.join(__dirname, "cr_events.json");

export async function captureCallsRawBody(req: Request, res: Response) {
    try {

        console.log("Webhook Received:");
        console.log(JSON.stringify(req.body, null, 2));
        const { clientPhone } = req.body;

        // 1️⃣ CHECK PHONE
        if (!clientPhone) return res.status(400).json({ status: "Error", message: "client's Phone is required", });

        // 2️⃣ FIND LEAD
        const leadResult = await db.query(`SELECT id, lead_attribution_id FROM leads WHERE phone = $1 LIMIT 1`, [clientPhone]);
        const leadId = leadResult.rows[0]?.id || null;
        const leadAttributionId = leadResult.rows[0]?.lead_attribution_id || null;
        if (!leadId || !leadAttributionId) return res.status(404).json({ status: "Error", message: "Lead not found for this phone", });

        const query = `INSERT INTO calls (external_call_id, lead_attribution_id, lead_id, agent_id, department_id, client_phone, client_name, direction, started_at, ended_at, duration_seconds, recording_url, transcript_url, words_per_minute, wpm_classification, interruption_count, sentiment_opening, sentiment_overall, outcome, campaign, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW()) RETURNING *;`;
        const values = [req.body.externalCallId, leadAttributionId, leadId, req.body.agentId, req.body.departmentId, req.body.clientPhone, req.body.clientName, req.body.direction, req.body.startedAt, req.body.endedAt, req.body.durationSeconds, req.body.recordingUrl, req.body.transcriptUrl, req.body.wordsPerMinute, req.body.wpmClassification, req.body.interruptionCount ?? 0, req.body.sentimentOpening, req.body.sentimentOverall, req.body.outcome, req.body.campaign];
        const result = await db.query(query, values);
        let events: any[] = [];
        if (fs.existsSync(LOG_FILE_CR)) {
            try {
                const fileContent = fs.readFileSync(LOG_FILE_CR, "utf8");

                events = fileContent.trim()
                    ? JSON.parse(fileContent)
                    : [];

            } catch (err) {
                console.error("Invalid JSON file. Recreating file...");
                events = [];
            }
        }

        events.push({
            receivedAt: new Date().toISOString(),
            payload: req.body
        });

        fs.writeFileSync(
            LOG_FILE_CR,
            JSON.stringify(events, null, 2),
            "utf8"
        );

        console.log("Webhook saved:", LOG_FILE_CR);

        return res.status(200).json({
            success: true,
            message: "Webhook logged successfully",
        });

    } catch (error: any) {

        console.error("Webhook Error:", error);

        return res.status(500).json({
            success: false,
            message: error?.message || "Internal Server Error"
        });
    }
}