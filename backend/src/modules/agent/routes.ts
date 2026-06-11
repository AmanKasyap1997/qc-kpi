import express from "express";
import { authenticateToken } from "../../middleware/auth";
import controller, { getAgent, addAgent, updateAgent,deleteAgent } from "./controller";


const router = express.Router();

router.get("/list", authenticateToken, controller.getAgent );
router.post("/create", authenticateToken, addAgent);
router.put("/update/:id", authenticateToken, updateAgent);
router.delete("/delete/:id", authenticateToken, deleteAgent)

export default router;