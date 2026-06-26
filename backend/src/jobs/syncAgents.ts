import cron from "node-cron";
import { fetchCallerReadyAgents, handelAgentsLogic } from "../integrations/callerreadyAgents";
import { syncCallerReadyDepartments } from "../integrations/getDepartmentDetails";

let isRunning = false;

export function startAgentSyncJob() {
    cron.schedule("*/2 * * * *", async () => {
        if (isRunning) {
            console.log("⛔ Sync already running, skipping...");
            return;
        }
        isRunning = true;
        try {
            console.log("⏱️  Department and Agents Sync started at - ", new Date());
            await syncCallerReadyDepartments();
            const agents = await fetchCallerReadyAgents();
            await handelAgentsLogic(agents);
        } catch (error) {
            console.error("❌ Agent sync failed:", error);
        } finally {
            isRunning = false;
        }
    });
}