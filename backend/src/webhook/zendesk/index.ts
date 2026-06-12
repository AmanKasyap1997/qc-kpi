import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Request, Response } from "express";
import db from '../../../src/db/pool'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, "zendesk_entries.json");

export async function captureZendeskRawBody(req: Request, res: Response) {
    try {
        const payload = req.body;
        const tags: string[] = payload.detail?.tags || [];
        const taxTags = ["taxticket", "tax_urgent"];
        const debtTags = ["cityfinancial", "debt_urgent", "new_debt_urgent", "debtticket"];

        let entity = null;
        if (tags.some(tag => taxTags.includes(tag))) {
            entity = "TAX";
        }
        if (tags.some(tag => debtTags.includes(tag))) {
            entity = "DEBT";
        }

        // ✅ Safe integer parser — returns null if value is missing or NaN
        const toIntOrNull = (val: any): number | null => {
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? null : parsed;
        };

        const ticketId = toIntOrNull(payload.detail?.id);

        // ✅ Reject early if ticket_id is null (it's a required primary key)
        if (ticketId === null) {
            console.error("Zendesk Webhook: Missing or invalid ticket ID", payload.detail?.id);
            return res.status(400).json({
                status: "error",
                message: "Invalid or missing ticket ID",
            });
        }

        const ticketDbId = (await db.query(`INSERT INTO zendesk_tickets (ticket_id, subject, status, priority, assignee_id, requester_id, group_id, form_id, entity, webhook_trigger, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (ticket_id) DO UPDATE SET updated_at = NOW() RETURNING id`, [ticketId, payload.detail?.subject ?? null, payload.detail?.status ?? null, payload.detail?.priority ?? null, toIntOrNull(payload.detail?.assignee_id), toIntOrNull(payload.detail?.requester_id), toIntOrNull(payload.detail?.group_id), toIntOrNull(payload.detail?.form_id), entity, new Date().toISOString(), payload.detail?.created_at])).rows[0].id;

        const logEntry = {
            receivedAt: new Date().toISOString(),
            event: "zendesk-webhook",
            data: payload,
        };

        let existingLogs = [];

        if (fs.existsSync(LOG_FILE)) {
            try {
                const fileContent = fs.readFileSync(LOG_FILE, "utf8");
                existingLogs = fileContent ? JSON.parse(fileContent) : [];
            } catch {
                existingLogs = [];
            }
        }

        existingLogs.push(logEntry);
        fs.writeFileSync(LOG_FILE, JSON.stringify(existingLogs, null, 2));

        return res.status(200).json({
            status: "Success",
            message: "Webhook received Successfully"
        });
    } catch (error: any) {
        console.error("Zendesk Webhook Error:", error);

        return res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
}