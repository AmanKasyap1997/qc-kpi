import catchAsync from "../../utils/catchAsync";
import { Request, Response } from 'express';
import { logWebhook } from '../webhookLogger';
import db from '../../../src/db/pool';

export async function captureGHLRawBody(req: Request, res: Response) {
    try {
        const result = await processGHLLead(req.body);
        return res.status(201).json(result);
    } catch (error: any) {
        return res.status(500).json({
            status: 'error',
            message: error.message || 'Internal server error',
            code: error.code || null,
        });
    }
}

export async function processGHLLead(payload: any) {
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const phone = payload.phone?.replace(/\D/g, '') || '';

        const leadSourceResult = await client.query(
            `INSERT INTO lead_sources
             (name, platform, active, created_at, updated_at)
             VALUES ($1,$2,$3,NOW(),NOW())
             ON CONFLICT (name)
             DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
             RETURNING id`,
            [payload.lead_source, payload.platform, payload.active ?? true]
        );

        const leadSourceId = leadSourceResult.rows[0]?.id;

        const subIdResult = await client.query(
            `INSERT INTO sub_ids
             (source_id, sub_id, campaign, active, created_at, updated_at)
             VALUES ($1,$2,$3,true,NOW(),NOW())
             ON CONFLICT (sub_id)
             DO UPDATE SET updated_at = NOW()
             RETURNING id`,
            [leadSourceId, payload.campaign, payload.campaign]
        );

        const subIdId = subIdResult.rows[0]?.id;

        const existingLead = await client.query(
            `SELECT * FROM leads WHERE phone = $1 LIMIT 1`,
            [phone]
        );

        if (existingLead.rows.length > 0) {
            await client.query('COMMIT');

            return {
                status: 'Success',
                message: 'Lead already exists',
                data: {
                    leadId: existingLead.rows[0].id,
                    sourceId: leadSourceId,
                    subIdId,
                },
            };
        }

        const attributionResult = await client.query(
            `INSERT INTO lead_attributions
             (source_id, sub_id_id, lead_date, created_at, updated_at)
             VALUES ($1,$2,NOW(),NOW(),NOW())
             RETURNING id`,
            [leadSourceId, subIdId]
        );

        const attributionId = attributionResult.rows[0]?.id;

        const leadResult = await client.query(
            `INSERT INTO leads
             (lead_attribution_id, first_name, last_name, email, phone, state, city, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'NEW',NOW(),NOW())
             RETURNING *`,
            [
                attributionId,
                payload.first_name,
                payload.last_name,
                payload.email,
                phone,
                payload.state,
                payload.city,
            ]
        );

        await client.query('COMMIT');

        return {
            status: 'Success',
            message: 'Lead processed successfully',
            data: {
                leadId: leadResult.rows[0].id,
                attributionId,
                sourceId: leadSourceId,
                subIdId,
            },
        };
    } catch (error: any) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}