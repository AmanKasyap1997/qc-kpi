import express from "express";
import { verifyForthSignature } from "../webhook/verifyForthSignature";
import { captureFourthRawBody } from "../webhook/fourth/index";
import { captureGHLRawBody } from "../webhook/GHL/index";
import { captureCallsRawBody } from "../webhook/calls/index";
import { captureZendeskRawBody } from "../webhook/zendesk/index";
const router = express.Router();
router.post("/fourth", verifyForthSignature, captureFourthRawBody);
router.post("/lead", verifyForthSignature, captureGHLRawBody);
router.post("/calls", captureCallsRawBody);
router.post("/zendesk", verifyForthSignature, captureZendeskRawBody);

export default router;