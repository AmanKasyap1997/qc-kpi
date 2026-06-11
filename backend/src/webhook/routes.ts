import express from "express";
import { verifyForthSignature } from "../webhook/verifyForthSignature";
import { captureFourthRawBody } from "../webhook/fourth/index";
const router = express.Router();
router.post("/fourth", verifyForthSignature, captureFourthRawBody );

export default router;