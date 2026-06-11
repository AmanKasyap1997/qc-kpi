import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Request, Response } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE_CR = path.join(__dirname, "cr_events.json");

export async function captureCallsRawBody(req: Request, res: Response) {
    try {

        console.log("Webhook Received:");
        console.log(JSON.stringify(req.body, null, 2));

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
            message: "Webhook logged successfully"
        });

    } catch (error: any) {

        console.error("Webhook Error:", error);

        return res.status(500).json({
            success: false,
            message: error?.message || "Internal Server Error"
        });
    }
}