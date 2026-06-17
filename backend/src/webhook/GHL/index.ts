import catchAsync from "../../utils/catchAsync";
import { Request, Response } from 'express';
import { logWebhook } from '../webhookLogger';
import db from '../../../src/db/pool';

export async function captureGHLRawBody(req: Request, res: Response) {
    const payload = req.body;
    const client = await db.connect();
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        await client.query('BEGIN');

        const phone = payload.phone?.replace(/\D/g, '') || '';

        // 1. Lead Source
        const leadSourceResult = await client.query(`INSERT INTO lead_sources (name, platform, active, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW()) ON CONFLICT (name) DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW() RETURNING id`, [payload.lead_source, payload.platform, payload.active ?? true]);
        const leadSourceId = leadSourceResult.rows[0]?.id;

        // 2. Campaign / SubId
        const subIdResult = await client.query(`INSERT INTO sub_ids (source_id, sub_id, campaign, active, created_at, updated_at) VALUES ($1,$2,$3,true,NOW(),NOW()) ON CONFLICT (sub_id) DO UPDATE SET updated_at = NOW() RETURNING id`, [leadSourceId, payload.campaign, payload.campaign]);
        const subIdId = subIdResult.rows[0]?.id;

        // 3. Existing Lead Check
        const existingLead = await client.query(`SELECT * FROM leads WHERE phone = $1 LIMIT 1`, [phone]);
        if (existingLead.rows.length > 0) {
            console.log('Lead already exists. Lead ID:', existingLead.rows[0].id);
            await client.query('COMMIT');
            return res.status(201).json({
                status: 'Success',
                message: 'Lead alredy exist',
                data: { leadId: existingLead.rows[0]?.id, sourceId: leadSourceId, subIdId }
            });
        }

        // 4. Create Attribution
        const attributionResult = await client.query(`INSERT INTO lead_attributions (source_id, sub_id_id, lead_date, created_at, updated_at) VALUES ($1,$2,NOW(),NOW(),NOW()) RETURNING id`, [leadSourceId, subIdId]);
        const attributionId = attributionResult.rows[0]?.id;

        // 5. Create Lead
        const leadResult = await client.query(`INSERT INTO leads (lead_attribution_id, first_name, last_name, email, phone, state, city, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'NEW',NOW(),NOW()) RETURNING *`, [attributionId, payload.first_name, payload.last_name, payload.email, phone, payload.state, payload.city]);

        await client.query('COMMIT');
        return res.status(201).json({
            status: 'Success',
            message: 'Lead processed successfully',
            data: { leadId: leadResult.rows[0]?.id, attributionId, sourceId: leadSourceId, subIdId }
        });

    } catch (error: any) {

        await client.query('ROLLBACK');
        return res.status(500).json({ status: 'error', message: error.message || 'Internal server error', code: error.code || null });

    } finally {
        console.log('RELEASING DB CONNECTION');

        client.release();
    }
}