// In src/index.ts
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./modules/auth/authRoute";
import webhookRoutes from "./webhook/routes";
import dashBoardData from "./dashboard/index";
import { startAgentSyncJob } from "./jobs/syncAgents";
import { processCallRecordingRecords } from "./jobs/generateCallSummary";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// IMPORTANT: capture raw body
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/dashboard", dashBoardData);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
  });
});

// startAgentSyncJob();


processCallRecordingRecords();

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});