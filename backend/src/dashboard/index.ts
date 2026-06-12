import express from "express";
import { Request, Response } from "express";
import db from "../db/pool";

const router = express.Router();
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

export default router;