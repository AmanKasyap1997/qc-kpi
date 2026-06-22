import axios from "axios";
import cron from "node-cron";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../db/pool";

const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let isRunning = false;

interface TranscriptAnalysis {
    // Modal: Overview tab
    callQuality: number;           // scoreBreakdown: "Call Quality" (45% weight display)
    disclosuresPercentage: number; // scoreBreakdown: "Disclosures" (40% weight display)
    compliancePercentage: number;  // scoreBreakdown: "Compliance" (15% weight display)
    overallCallScore: number;      // modal-score-badge + scoreColor
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    agentStrengths: string[];      // ✅ Strengths list (up to 4)
    agentImprovements: string[];   // ⚠️ Areas Needing Improvement list (up to 4)

    // Modal: Call Summary tab
    callSummary: string;           // Prose summary paragraph
    loanType: string;              // e.g. "Debt Relief", "Personal Loan"
    leadQuality: string;           // e.g. "High", "Medium", "Low"
    customerIntent: string;        // e.g. "Enrolled", "Callback", "Declined"
    nextAction: string;            // e.g. "Send agreement", "Schedule follow-up"

    // Modal: Trackers tab — maps to CHECKPOINTS_ALL categories
    checkpointResults: {
        callQualityRapport: Record<string, 'pass' | 'fail' | 'na'>;     // CQ01–CQ12
        discoveryQualification: Record<string, 'pass' | 'fail' | 'na'>; // DQ01–DQ07
        complianceDisclosures: Record<string, 'pass' | 'fail' | 'na'>;  // CD01–CD15
        objectionHandlingClose: Record<string, 'pass' | 'fail' | 'na'>; // OH01–OH06
    };

    // Good/Bad trackers (GOOD_TRACKERS / BAD_TRACKERS arrays in frontend)
    goodTrackersHit: string[];     // Which good tracker strings were detected
    badTrackersTriggered: string[]; // Which bad tracker strings were triggered

    // Modal: AI Coach tab
    aiInsights: Array<{
        icon: string;    // emoji e.g. "🎯" "🗣️" "⚡" "💡"
        text: string;    // HTML string with <strong> for bold phrases
    }>;
    coachingActions: string[];     // Numbered action items e.g. "1. Review CD01-CD05..."

    // Live Feed row data
    outcome: 'Enrolled' | 'Callback' | 'Declined' | 'Debt Pitch' | 'Hotique' | 'Loan Transfer' | 'Not Qualified';
    flags: Array<'Early Debt Pitch' | 'Skipped Qualifying' | 'Early Decline' | 'Skipped Credit Pull' | 'Rushed Call'>;
    duration: string;   // e.g. "8:34"
    campaign: string;   // e.g. "City Lending — Debt Relief"
    leadSource: string; // e.g. "Facebook", "Google", "Inbound Web"
    subId: string;      // e.g. "FB_CL_003_CA_25-45"

    // Sidebar / Leaderboard stats
    department: string; // "Debt Sales" | "Verification" | "SDR" | "Jr Closer" | "Sr Closer" | "Customer Service"
    enrollmentValue: number; // dollar value if enrolled, else 0

    // Auto-tagging for CF Academy
    academyTag: 'exemplar' | 'featured' | 'warning' | null; // exemplar ≥82, warning ≤38
    academyCollection: string; // e.g. "Disclosure Excellence", "Common Mistakes"

    // Compliance flags (used in alerts sidebar + PIP triggers)
    complianceFlags: string[];  // e.g. ["CD02 auto-fail", "Bad tracker triggered"]
    riskFlags: string[];        // e.g. ["Mentioned no credit impact", "Moved forward under $7K"]

    // SDR pipeline dimensions (if agent is SDR/Jr Closer)
    disclosureAdherence: number;  // 0-100, CD01-CD05 pass rate
    talkRatioPercent: number;     // 0-100, agent % of talk time
    badTrackerCount: number;      // count of bad trackers triggered
    objectionHandledCount: number; // count of OH01-OH06 passes
}

interface CallRecord {
    id: number;
    recording_url: string;
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTranscript(audioUrl: string): Promise<string> {
    const submitResponse = await axios.post(
        "https://api.assemblyai.com/v2/transcript",
        {
            audio_url: audioUrl,
            speaker_labels: true
        },
        {
            headers: {
                authorization: ASSEMBLY_API_KEY,
                "content-type": "application/json"
            }
        }
    );

    const transcriptId = submitResponse.data.id;

    while (true) {
        const poll = await axios.get(
            `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
            {
                headers: {
                    authorization: ASSEMBLY_API_KEY
                }
            }
        );

        const status = poll.data.status;

        if (status === "completed") {
            return poll.data.text || "";
        }

        if (status === "error") {
            throw new Error(poll.data.error);
        }

        console.log(`AssemblyAI Status: ${status}`);
        await sleep(5000);
    }
}

async function analyzeTranscript(transcript: string): Promise<TranscriptAnalysis> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are a QA analyst for City Financial, a debt relief and lending company.
Analyze this call transcript and return ONLY a valid JSON object. No markdown, no explanation, no preamble.

SCORING RULES:
- callQuality (0-100): rapport, empathy, listening, tone, interruptions (maps to CQ01-CQ12 checkpoints)
- disclosuresPercentage (0-100): rate of required disclosures delivered (CD01-CD05 are AUTO-FAIL if missed)
- compliancePercentage (0-100): overall regulatory compliance
- overallCallScore (0-100): weighted average — callQuality×0.45 + disclosuresPercentage×0.40 + compliancePercentage×0.15
- If ANY of CD01-CD05 are 'fail', disclosuresPercentage must be ≤ 40 and overallCallScore ≤ 50

CHECKPOINT IDs to evaluate (return 'pass', 'fail', or 'na'):
callQualityRapport: CQ01(professional greeting), CQ02(permission to record — AUTO-FAIL), CQ03(stated purpose), CQ04(acknowledged client by name), CQ05(acknowledged financial stress), CQ06(used empathetic statements), CQ07(avoided judgmental language), CQ08(allowed client to explain), CQ09(minimized interruptions), CQ10(asked follow-up questions), CQ11(paraphrased client), CQ12(warm tone throughout)
discoveryQualification: DQ01(asked about debt type/amount/status), DQ02(identified client goals), DQ03(explained options), DQ04(explained settlement/litigation), DQ05(avoided jargon), DQ06(set realistic expectations), DQ07(addressed risks/benefits honestly)
complianceDisclosures: CD01(disclosed NOT debt settlement — AUTO-FAIL), CD02(disclosed NOT credit repair — AUTO-FAIL), CD03(explained lawsuit representation scope — AUTO-FAIL), CD04(obtained consent for soft credit pull — AUTO-FAIL), CD05(verified client identity — AUTO-FAIL), CD06(disclosed credit impact), CD07(disclosed asset repossession risk), CD08(explained settlement responsibility), CD09(clarified payments not to creditors), CD10(explained payments for legal fees), CD11(stopping payments implications), CD12(summons disclosure), CD13(required disclaimers), CD14(no legal/financial guarantees), CD15(avoided prohibited language)
objectionHandlingClose: OH01(acknowledged objections calmly), OH02(provided factual responses), OH03(confidence without pressure), OH04(explained next steps), OH05(confirmed client understanding), OH06(ended with reassurance)

GOOD TRACKERS (return which ones were detected):
"Asked how much debt do you currently owe", "Asked about total personal loan debt", "Asked about accounts in collections", "Asked if current on payments or falling behind", "Asked if employed or receiving income", "Asked how much they bring home after taxes", "Asked if in active bankruptcy", "Asked for verbal authorization for soft pull", "Mentioned cease and desist letters", "Mentioned power of attorney", "Mentioned all communication directed to legal team", "Complete contract walk through", "Verified all info before sending agreement"

BAD TRACKERS (return which ones were triggered — these are violations):
"Moved forward after debt stated under $7K", "Mentioned will wipe out all debt", "Mentioned these will be the only fees", "Mentioned this will not affect their credit", "Did not obtain consent before pulling credit"

FLAGS to detect (only include if clearly present):
"Early Debt Pitch" — pitched debt program before qualifying
"Skipped Qualifying" — didn't ask required qualifying questions
"Early Decline" — declined too quickly without full discovery
"Skipped Credit Pull" — failed to get consent before pulling credit
"Rushed Call" — call felt hurried, disclosures speed-read

OUTCOMES (pick exactly one):
"Enrolled" — client signed up / agreed to proceed
"Callback" — scheduled a follow-up call
"Declined" — client said no
"Debt Pitch" — pitched the debt program but no decision
"Hotique" — client is very interested, needs follow-up urgently
"Loan Transfer" — transferred to loan officer
"Not Qualified" — client does not meet program criteria

ACADEMY TAG rules:
- overallCallScore ≥ 82 → "exemplar", collection: "Disclosure Excellence" or "Discovery Masters"
- overallCallScore ≤ 38 → "warning", collection: "Common Mistakes"
- null otherwise (do not assign "featured" — that is manual only)

Return this exact JSON structure:
{
  "callQuality": <0-100>,
  "disclosuresPercentage": <0-100>,
  "compliancePercentage": <0-100>,
  "overallCallScore": <0-100>,
  "sentiment": <"positive"|"neutral"|"negative"|"mixed">,
  "agentStrengths": [<up to 4 specific observed strengths as plain strings>],
  "agentImprovements": [<up to 4 specific improvement areas as plain strings>],
  "callSummary": "<2-3 sentence prose summary of the call>",
  "loanType": "<detected product type e.g. Debt Relief, Personal Loan, Tax Debt, or Unknown>",
  "leadQuality": "<High|Medium|Low based on client engagement and qualification>",
  "customerIntent": "<what the customer ultimately decided or expressed>",
  "nextAction": "<recommended next step for the agent>",
  "checkpointResults": {
    "callQualityRapport": { "CQ01": "<pass|fail|na>", "CQ02": "<pass|fail|na>", "CQ03": "<pass|fail|na>", "CQ04": "<pass|fail|na>", "CQ05": "<pass|fail|na>", "CQ06": "<pass|fail|na>", "CQ07": "<pass|fail|na>", "CQ08": "<pass|fail|na>", "CQ09": "<pass|fail|na>", "CQ10": "<pass|fail|na>", "CQ11": "<pass|fail|na>", "CQ12": "<pass|fail|na>" },
    "discoveryQualification": { "DQ01": "<pass|fail|na>", "DQ02": "<pass|fail|na>", "DQ03": "<pass|fail|na>", "DQ04": "<pass|fail|na>", "DQ05": "<pass|fail|na>", "DQ06": "<pass|fail|na>", "DQ07": "<pass|fail|na>" },
    "complianceDisclosures": { "CD01": "<pass|fail|na>", "CD02": "<pass|fail|na>", "CD03": "<pass|fail|na>", "CD04": "<pass|fail|na>", "CD05": "<pass|fail|na>", "CD06": "<pass|fail|na>", "CD07": "<pass|fail|na>", "CD08": "<pass|fail|na>", "CD09": "<pass|fail|na>", "CD10": "<pass|fail|na>", "CD11": "<pass|fail|na>", "CD12": "<pass|fail|na>", "CD13": "<pass|fail|na>", "CD14": "<pass|fail|na>", "CD15": "<pass|fail|na>" },
    "objectionHandlingClose": { "OH01": "<pass|fail|na>", "OH02": "<pass|fail|na>", "OH03": "<pass|fail|na>", "OH04": "<pass|fail|na>", "OH05": "<pass|fail|na>", "OH06": "<pass|fail|na>" }
  },
  "goodTrackersHit": [<array of exact good tracker strings detected>],
  "badTrackersTriggered": [<array of exact bad tracker strings triggered>],
  "aiInsights": [
    { "icon": "🎯", "text": "<HTML string — wrap key phrase in <strong>: phrase</strong>. 1-2 sentences.>" },
    { "icon": "🗣️", "text": "<talk ratio insight with <strong> emphasis>" },
    { "icon": "⚡", "text": "<pacing or disclosure rush insight>" },
    { "icon": "💡", "text": "<one genuine strength observed>" }
  ],
  "coachingActions": [
    "<numbered action 1 — most critical compliance or disclosure issue>",
    "<numbered action 2 — process or scripting improvement>",
    "<numbered action 3 — rapport or technique improvement>"
  ],
  "outcome": "<one of: Enrolled|Callback|Declined|Debt Pitch|Hotique|Loan Transfer|Not Qualified>",
  "flags": [<array of flag strings that apply, or empty array>],
  "duration": "<estimated call duration as MM:SS e.g. 8:34>",
  "campaign": "<infer from context e.g. City Lending — Debt Relief, or Unknown>",
  "leadSource": "<infer if mentioned e.g. Facebook, Google, Inbound Web, or Unknown>",
  "subId": "<sub ID if mentioned, else empty string>",
  "department": "<Debt Sales|Verification|SDR|Jr Closer|Sr Closer|Customer Service — infer from agent role>",
  "enrollmentValue": <dollar amount if enrolled based on debt discussed, else 0>,
  "academyTag": <"exemplar"|"warning"|null>,
  "academyCollection": "<Disclosure Excellence|Discovery Masters|Common Mistakes|empty string if null tag>",
  "complianceFlags": [<specific compliance violations as short strings e.g. "CD02 auto-fail">],
  "riskFlags": [<specific risk phrases detected e.g. "Mentioned no credit impact">],
  "disclosureAdherence": <0-100 — percentage of CD01-CD05 that passed>,
  "talkRatioPercent": <0-100 — estimated agent talk time percentage>,
  "badTrackerCount": <integer count of bad trackers triggered>,
  "objectionHandledCount": <integer count of OH01-OH06 that passed>
}

Transcript:
${transcript}
`;

    const result = await model.generateContent(prompt);

    let text = result.response.text()
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const parsed = JSON.parse(text) as TranscriptAnalysis;

    // Enforce AUTO-FAIL scoring on the server side as a safety net
    const autoFailIds = ['CD01', 'CD02', 'CD03', 'CD04', 'CD05', 'CQ02'];
    const hasAutoFail = autoFailIds.some(id => {
        const cat = id.startsWith('CD')
            ? parsed.checkpointResults?.complianceDisclosures
            : parsed.checkpointResults?.callQualityRapport;
        return cat?.[id] === 'fail';
    });

    if (hasAutoFail) {
        parsed.disclosuresPercentage = Math.min(parsed.disclosuresPercentage, 40);
        parsed.overallCallScore = Math.min(parsed.overallCallScore, 50);
        if (!parsed.complianceFlags.includes('AUTO-FAIL triggered')) {
            parsed.complianceFlags.push('AUTO-FAIL triggered');
        }
    }

    // Enforce academy tag thresholds
    if (parsed.overallCallScore >= 82) {
        parsed.academyTag = 'exemplar';
        if (!parsed.academyCollection) parsed.academyCollection = 'Disclosure Excellence';
    } else if (parsed.overallCallScore <= 38) {
        parsed.academyTag = 'warning';
        parsed.academyCollection = 'Common Mistakes';
    } else {
        parsed.academyTag = null;
        parsed.academyCollection = '';
    }

    // Enforce bad tracker count
    parsed.badTrackerCount = parsed.badTrackersTriggered?.length ?? 0;

    return parsed;
}

export async function generateAiSummary(recordingUrl: string): Promise<{
    transcript: string;
    analysis: TranscriptAnalysis;
}> {
    const transcript = await getTranscript(recordingUrl);
    console.log(transcript, 'transcript');
    const analysis = await analyzeTranscript(transcript);
    console.log(analysis, 'analysis');
    return {
        transcript,
        analysis
    };
}



export async function updateRecordAiData(
    callId: number,
    transcript: string,
    analysis: TranscriptAnalysis
): Promise<void> {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        // Update transcript on calls table
        await client.query(`UPDATE calls SET transcript_details = $2, outcome = $3, next_action = $4, revenue = $5, campaign = $6, updated_at = NOW() WHERE id = $1 `,
            [callId, transcript, analysis.outcome, analysis.nextAction, analysis.enrollmentValue,analysis.campaign]
        );

        // Upsert analytics
        await client.query(`INSERT INTO call_analytics (
        call_id,
        call_quality,
        disclosures_percentage,
        compliance_percentage,
        overall_call_score,
        sentiment_overall,
        agent_strengths,
        agent_improvements,
        call_summary,
        checkpoint_results,
        good_trackers_hit,
        bad_trackers_triggered,
        ai_insights,
        coaching_actions,
        flags,
        academy_tag,
        academy_collection,
        compliance_flags,
        risk_flags,
        disclosure_adherence,
        talk_ratio_percent,
        bad_tracker_count,
        objection_handled_count,
        ai_generated_department,
        updated_at
    )
    VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,NOW()
    )
    ON CONFLICT (call_id)
    DO UPDATE SET
        call_quality = EXCLUDED.call_quality,
        disclosures_percentage = EXCLUDED.disclosures_percentage,
        compliance_percentage = EXCLUDED.compliance_percentage,
        overall_call_score = EXCLUDED.overall_call_score,
        sentiment_overall = EXCLUDED.sentiment_overall,
        agent_strengths = EXCLUDED.agent_strengths,
        agent_improvements = EXCLUDED.agent_improvements,
        call_summary = EXCLUDED.call_summary,
        checkpoint_results = EXCLUDED.checkpoint_results,
        good_trackers_hit = EXCLUDED.good_trackers_hit,
        bad_trackers_triggered = EXCLUDED.bad_trackers_triggered,
        ai_insights = EXCLUDED.ai_insights,
        coaching_actions = EXCLUDED.coaching_actions,
        flags = EXCLUDED.flags,
        academy_tag = EXCLUDED.academy_tag,
        academy_collection = EXCLUDED.academy_collection,
        compliance_flags = EXCLUDED.compliance_flags,
        risk_flags = EXCLUDED.risk_flags,
        disclosure_adherence = EXCLUDED.disclosure_adherence,
        talk_ratio_percent = EXCLUDED.talk_ratio_percent,
        bad_tracker_count = EXCLUDED.bad_tracker_count,
        objection_handled_count = EXCLUDED.objection_handled_count,
        updated_at = NOW()
    `,
            [
                callId,
                analysis.callQuality,
                analysis.disclosuresPercentage,
                analysis.compliancePercentage,
                analysis.overallCallScore,
                analysis.sentiment,
                JSON.stringify(analysis.agentStrengths ?? []),
                JSON.stringify(analysis.agentImprovements ?? []),
                analysis.callSummary,
                JSON.stringify(analysis.checkpointResults ?? {}),
                JSON.stringify(analysis.goodTrackersHit ?? []),
                JSON.stringify(analysis.badTrackersTriggered ?? []),
                JSON.stringify(analysis.aiInsights ?? []),
                JSON.stringify(analysis.coachingActions ?? []),
                JSON.stringify(analysis.flags ?? []),
                analysis.academyTag,
                analysis.academyCollection,
                JSON.stringify(analysis.complianceFlags ?? []),
                JSON.stringify(analysis.riskFlags ?? []),
                analysis.disclosureAdherence,
                analysis.talkRatioPercent,
                analysis.badTrackerCount,
                analysis.objectionHandledCount,
                analysis.department,
            ]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getRecordingRecords(): Promise<CallRecord[]> {
    const client = await db.connect();

    try {
        const result = await client.query(`SELECT id, recording_url FROM calls WHERE recording_url IS NOT NULL AND recording_url <> '' AND transcript_details IS NULL ORDER BY id
            LIMIT 10`);
        return result.rows;
    } finally {
        client.release();
    }
}

export async function processSingleCall(call: CallRecord): Promise<void> {
    try {
        console.log(`Processing Call ID: ${call.id}`);
        const result = await generateAiSummary(call.recording_url);
        await updateRecordAiData(
            call.id,
            result.transcript,
            result.analysis
        );
        console.log(`✅ Completed Call ${call.id}`);
    } catch (error) {
        console.error(
            `❌ Failed Call ${call.id}`,
            error
        );
    }
}

export function processCallRecordingRecords(): void {
    cron.schedule("*/1 * * * *", async () => {
        if (isRunning) {
            console.log(
                "⛔ Recording processor already running"
            );
            return;
        }
        isRunning = true;
        try {
            console.log(
                "🚀 Recording processing started",
                new Date().toISOString()
            );
            const calls = await getRecordingRecords();
            console.log(
                `Found ${calls.length} calls to process`
            );
            for (const call of calls) {
                await processSingleCall(call);
            }
            console.log("✅ Processing completed");
        } catch (error) {
            console.error(
                "❌ Recording processing failed",
                error
            );
        } finally {
            isRunning = false;
        }
    });

    console.log(
        "📅 Recording processor cron started (every minute)"
    );
}
