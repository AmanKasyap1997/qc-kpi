import { Request, Response } from "express";
import db from "../../db/pool";
import axios from "axios";
import { CAMPAIGN } from "../../../enums/campaignTracker";
import { processGHLLead } from "../GHL";
import { callType } from "../../../enums/callType";

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
            const direction = payload.type === callType.INBD ? callType.INBOUND : callType.OUTBOUND;
            let ghlLoansPayload;
            let newLeadId;
            let newLeadAttributionId;
            let departmentId;
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

            let agent = agentResult.rows[0];
            let agentId = agent?.id;
            let agentDepartmentId = agent?.department_id;
            if (!agent && payload.first_agent_call_center?.length > 0 && payload.campaign_number?.length > 0) {
                const departmentData = await client.query(
                    `SELECT id FROM departments WHERE name = $1 LIMIT 1`,
                    [payload.location]
                );
                departmentId = departmentData.rows[0]?.id || 1;

                const newAgentResult = await client.query(
                    `INSERT INTO agents (
                    name,email,phone,department_id,updated_at
                ) VALUES (
                    $1,$2,$3,$4,NOW()
                )
                ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
                RETURNING id, department_id`, [payload.first_agent_call_center, payload.first_agent_email, agentPhone, departmentId],
                );

                agentId = newAgentResult.rows[0].id;
                agentDepartmentId = newAgentResult.rows[0].department_id;

                console.log(`Created new agent for phone ${agentPhone}`);
            }
            if (!lead) {
                if (payload.location == CAMPAIGN.GHL_LOANS || payload.location == CAMPAIGN.HARDSHIP) {

                    if (payload.location == CAMPAIGN.GHL_LOANS) {
                        ghlLoansPayload = {
                            first_name: payload.first_name,
                            last_name: payload.last_name,
                            phone: payload.caller_id,
                            state: payload.state,
                            lead_source: "GHL Loans",
                            platform: "GHL",
                            active: true,
                            campaign: "GHL_LOANS"
                        }
                    }
                    if (payload.location == CAMPAIGN.HARDSHIP) {
                        ghlLoansPayload = {
                            first_name: payload.first_name,
                            last_name: payload.last_name,
                            phone: payload.caller_id,
                            state: payload.state,
                            lead_source: "Hardship",
                            platform: "Hardship",
                            active: true,
                            campaign: "Hardship"
                        }
                    }

                    const newlead = await processGHLLead(ghlLoansPayload)
                    newLeadId = newlead.data.leadId;
                    newLeadAttributionId = newlead.data.attributionId;
                }
            }
            const shouldInsertCall =
                !!lead ||
                !!newLeadId ||
                !!agentId ||
                payload.location === CAMPAIGN.GHL_LOANS ||
                payload.location === CAMPAIGN.HARDSHIP;
            if (!shouldInsertCall) {
                await client.query("ROLLBACK");

                return res.status(200).json({
                    status: "skipped",
                    message: "Call does not meet save criteria.",
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
                    lead?.lead_attribution_id ?? newLeadAttributionId ?? null,
                    lead?.id ?? newLeadId ?? null,
                    agentId,
                    agentDepartmentId,
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
            const attributionId =
                lead?.lead_attribution_id ?? newLeadAttributionId;

            if (attributionId) {
                const attributionResult = await client.query(
                    `SELECT contact_at
                    FROM lead_attributions
                    WHERE id = $1`,
                    [attributionId]
                );

                if (
                    attributionResult.rows.length > 0 &&
                    !attributionResult.rows[0].contact_at
                ) {
                    await client.query(
                        `UPDATE lead_attributions
                        SET contact_at = NOW(),
                        contact_made = true
                        WHERE id = $1`,
                        [attributionId]
                    );
                }
            }

            await client.query("COMMIT");
            return res.status(201).json({
                status: "success",
                message: "Call processed successfully",
                data: {
                    callId: callResult.rows[0].id,
                    leadId: lead?.id ?? newLeadId ?? null,
                    leadAttributionId: lead?.lead_attribution_id ?? newLeadAttributionId ?? null,
                    agentId: agentId,
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
