import axios from "axios";
import dotenv from "dotenv";
import db from "../db/pool";

dotenv.config();

export async function fetchCallerReadyAgents() {
    try {
        const response = await axios.get(
            `${process.env.CALLERREADY_BASE_URL}/api/ci/GetRepresentativesStatus`,
            {
                headers: {
                    apikey: process.env.CALLERREADY_API_KEY,
                },
            }
        );

        return response.data;
    } catch (error: any) {
        console.error(
            "CallerReady API Error:",
            error.response?.data || error.message
        );
        throw error;
    }
}

export async function handelAgentsLogic(agents: any) {
    for (const agent of agents) {
        let departmentId = 2;
        if (agent.location_code) {
            const deptResult = await db.query(`SELECT id FROM departments WHERE code = $1`, [agent.location_code]);
            departmentId = deptResult.rows[0]?.id || null;
        }
        const query = `INSERT INTO agents (name,email,phone,rc_extension_id,department_id,updated_at) VALUES ($1,$2,$3,$4,$5, NOW()) ON CONFLICT (phone) DO UPDATE SET updated_at = NOW() RETURNING *;`;
        const phone = agent.rep_did?.replace(/\D/g, '');
        if (!phone) continue;
        await db.query(query, [agent.rep_name, agent.email, phone, agent.contact_id, departmentId]);
    }
    console.log(`✅ Agents sync completed: ${agents.length}`);
}
