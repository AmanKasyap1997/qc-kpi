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
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Client } from 'pg'; // Import the Client class for a dedicated connection

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

// Initialize Socket.IO with CORS configurations matching your ecosystem
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


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


// processCallRecordingRecords();

app.use(errorHandler);

// Create a dedicated, single persistent client connection specifically for LISTEN/NOTIFY
const realtimeClient = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function connectRealtimePipeline() {
  try {
    // Connect our dedicated real-time client stream
    await realtimeClient.connect();

    // Command PostgreSQL to start listening on our trigger channel
    await realtimeClient.query('LISTEN calls_changed_channel');
    console.log('Real-time Postgres trigger started...');

    // The 'notification' event is natively fully typed on the Client instance!
    realtimeClient.on('notification', (msg) => {
      if (msg.channel === 'calls_changed_channel') {
        console.log('Database change detected on table [calls]. Pushing WebSocket signal...');

        // Broadcast a real-time frame update to all frontend clients instantly
        io.emit('db_calls_updated');
      }
    });

    // Handle unexpected connection dropouts gracefully
    realtimeClient.on('error', async (err) => {
      console.error('Realtime client connection error, attempting reconnect...', err);
      try {
        await connectRealtimePipeline();
      } catch (reconnectErr) {
        console.error('Reconnection to Postgres notification channel failed:', reconnectErr);
      }
    });

  } catch (error) {
    console.error('Failed to initialize connection engine for database listener:', error);
  }
}

// Fire up our updated real-time pipeline handler
connectRealtimePipeline();

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

httpServer.listen(PORT, () => {
  console.log(`Server successfully active on port ${PORT}`);
});