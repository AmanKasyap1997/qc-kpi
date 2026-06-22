import { Request, Response } from "express";
import db from "../../db/pool";
import axios from "axios";

async function resolveRecordingUrl(recordingUrl: string): Promise<string | null> {
    try {
        if (!recordingUrl?.trim()) {
            return null;
        }

        if (/\.(mp3|wav|m4a|ogg)(\?|$)/i.test(recordingUrl)) {
            return recordingUrl;
        }

        const response = await axios.get(recordingUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const html = response.data as string;

        const match = html.match(
            /<source[^>]+src=["']([^"']+)["']/i
        );

        if (!match?.[1]) {
            console.log(`Recording URL not accessible: ${recordingUrl}`);
            return null;
        }

        let audioUrl = match[1];

        if (audioUrl.startsWith("/")) {
            const baseUrl = new URL(recordingUrl);
            audioUrl = `${baseUrl.protocol}//${baseUrl.host}${audioUrl}`;
        }

        return audioUrl;
    } catch {
        console.log(`Recording URL not accessible: ${recordingUrl}`);
        return null;
    }
}

export async function captureCallsRawBody(req: Request, res: Response) {
    console.log("Webhook Received:", req.body);

    const payload = req.body.data;
    const client = await db.connect();
    let acutualCallRecordingUrl = await resolveRecordingUrl(payload.recording)

    try {
        if (req.body.primaryKey == "CallSid") {
            await client.query("BEGIN");

            const leadPhone = payload.lead?.replace(/\D/g, "") || "";
            const agentPhone = payload.campaign_number?.replace(/\D/g, "") || "";
            const direction = payload.Inbdphonedid === "NO" ? "outbound" : "inbound";

            // Find lead (optional)
            const leadResult = await client.query(
                `SELECT id, lead_attribution_id, first_name FROM leads WHERE phone = $1 LIMIT 1`,
                [leadPhone]
            );
            const lead = leadResult.rows[0] || null;

            // Find agent (required)
            const agentResult = await client.query(
                `SELECT id, department_id FROM agents WHERE phone = $1 LIMIT 1`,
                [agentPhone]
            );

            const agent = agentResult.rows[0];
            if (!agent) {
                console.log(`Agent not found for phone ${agentPhone}`);
                return res.status(404).json({
                    status: "failed",
                    message: `Agent not found for phone ${agentPhone}`,
                });
            }

            // Insert call
            const callResult = await client.query(
                `INSERT INTO calls (
                    external_call_id, lead_attribution_id, lead_id, agent_id, department_id,
                    client_phone, client_name, direction, started_at, ended_at, duration_seconds,
                    recording_url, transcript_url, outcome, campaign,
                    connected, location, revenue,updated_at
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                    $16,$17,$18,NOW()
                )
                ON CONFLICT (external_call_id) DO UPDATE SET updated_at = NOW()
                RETURNING id`,
                [
                    payload.CallSid,
                    lead?.lead_attribution_id ?? null,
                    lead?.id ?? null,
                    agent.id,
                    agent.department_id,
                    leadPhone,
                    lead?.first_name ?? payload.first_name ?? payload.Customername ?? "Unknown",
                    direction,
                    payload.start_date_time ?? new Date(),
                    null,
                    payload.call_time_seconds ?? null,
                    acutualCallRecordingUrl,
                    payload.transcript ?? null,
                    payload.callend_outcome ?? null,
                    payload.campaigncode,
                    payload.connected,
                    payload.location,
                    payload.revenue,
                ]
            );

            // Update lead attribution only if lead exists
            if (lead?.lead_attribution_id) {
                const attributionResult = await client.query(
                    `SELECT contact_at FROM lead_attributions WHERE id = $1`,
                    [lead.lead_attribution_id]
                );

                if (
                    attributionResult.rows.length > 0 &&
                    !attributionResult.rows[0].contact_at
                ) {
                    await client.query(
                        `UPDATE lead_attributions SET contact_at = NOW(), contact_made = true WHERE id = $1`,
                        [lead.lead_attribution_id]
                    );
                }
            }

            await client.query("COMMIT");
            return res.status(201).json({
                status: "success",
                message: "Call processed successfully",
                data: {
                    callId: callResult.rows[0].id,
                    leadId: lead?.id ?? null,
                    leadAttributionId: lead?.lead_attribution_id ?? null,
                    agentId: agent.id,
                    leadFound: !!lead,
                },
            });
        }
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        console.error("Capture Call Error:", error);
        const err = error as { message?: string; code?: string };
        return res.status(500).json({
            status: "error",
            message: err.message || "Internal server error",
            code: err.code || null,
        });
    } finally {
        client.release();
    }
}
