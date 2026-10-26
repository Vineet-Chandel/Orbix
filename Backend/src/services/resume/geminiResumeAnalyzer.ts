import type { CodingProfileEntry } from "./resumeTypes.js";
import type {
    ComprehensiveIntelligenceReport,
    StructuredResumeFacts
} from "./resumeTypes.js";
import { parseUploadedDocument } from "./documentParser.js";
import { extractStructuredFacts } from "./factExtractor.js";
import { ResumeScoringEngine } from "./scoringEngine.js";
import { RoleIntelligenceEngine } from "./roleIntelligence.js";
import { ProfileSyncService, type UserProfileRow } from "./profileSyncService.js";

const scoringEngine = new ResumeScoringEngine();
const roleEngine = new RoleIntelligenceEngine();
const profileSyncService = new ProfileSyncService();

/**
 * Builds the comprehensive intelligence report deterministically from parsed facts.
 */
export function buildDeterministicReport(
    facts: StructuredResumeFacts,
    filename: string,
    filesizeBytes: number,
    currentUserProfile?: Partial<UserProfileRow>
): ComprehensiveIntelligenceReport {
    // 1. Role and Seniority Analysis
    const roleIntelligence = roleEngine.evaluateRoleAndSeniority(facts);

    // 2. Deterministic 7-Dimension Scoring Engine
    const scoring = scoringEngine.evaluate(facts, roleIntelligence.primaryTargetRole);

    // 3. Grounded Improvements and Recruiter Checks
    const improvements = roleEngine.generateGroundedImprovements(facts);
    const checks = roleEngine.generateRecruiterChecks(facts);
    const missingKeywords = roleEngine.identifyMissingKeywords(facts, roleIntelligence.primaryTargetRole);

    // 4. Missing Profile Sync Proposal
    const profileSyncProposal = profileSyncService.buildSyncProposal(currentUserProfile || {}, facts);

    // 5. Strengths
    const strengths: Array<{ title: string; description: string }> = [];
    for (const dimKey of Object.keys(scoring.dimensions) as (keyof typeof scoring.dimensions)[]) {
        const dim = scoring.dimensions[dimKey];
        if (dim.strengths && dim.strengths.length > 0) {
            strengths.push({
                title: dim.label,
                description: dim.strengths[0]
            });
        }
    }

    const summary = `Candidate evaluated for ${roleIntelligence.primaryTargetRole} (${roleIntelligence.seniorityLevel}). ` +
        `Scored ${scoring.overallScore}/100 across 7 weighted dimensions with ${scoring.extractionConfidence}% extraction confidence. ` +
        `Profile exhibits ${facts.competencies.languages.length} languages, ${facts.competencies.frameworks.length} frameworks, and ` +
        `${facts.quantifiedAchievements.length} quantified impact achievement(s).`;

    return {
        analyzerVersion: "orbix-intelligence-v3.0",
        modelUsed: "orbix-deterministic-engine",
        filename,
        filesizeBytes,
        createdAt: new Date().toISOString(),

        overallScore: scoring.overallScore,
        scoreGrade: scoring.scoreGrade,
        summary,

        scoring,
        roleIntelligence,
        structuredFacts: facts,
        profileSyncProposal,

        strengths: strengths.length > 0 ? strengths : [
            { title: "Technical Profile", description: "Structured engineering experience and competency portfolio." }
        ],
        improvements,
        checks,
        missingKeywords,
        roleSpecificTips: [
            "Quantify key accomplishments using measurable metrics (% latency drop, throughput, users, test coverage).",
            "Keep technical skills organized cleanly by category (Languages, Frameworks, Databases, Tools).",
            "Maintain verified code repository links (GitHub) and live project deployments."
        ],

        // Backwards compatibility fields
        targetRoleDetected: roleIntelligence.primaryTargetRole,
        experienceLevel: roleIntelligence.seniorityLevel,
        scoreBreakdown: {
            impactAndMetrics: scoring.dimensions.impactAndMetrics.score,
            technicalDepth: scoring.dimensions.technicalDepth.score,
            targetRoleAlignment: scoring.dimensions.targetRoleAlignment.score,
            atsParsability: scoring.dimensions.atsStructure.score,
            clarityAndStructure: scoring.dimensions.clarityAndActionWriting.score,
            verifiedProfiles: scoring.dimensions.verifiedProfiles.score,
            contactCompleteness: scoring.dimensions.contactAndCompleteness.score
        },
        detectedSkills: {
            languages: facts.competencies.languages.map(l => l.value),
            frameworks: facts.competencies.frameworks.map(f => f.value),
            databasesAndTools: [
                ...facts.competencies.databasesAndStores.map(d => d.value),
                ...facts.competencies.toolsAndCloud.map(t => t.value)
            ],
            concepts: facts.competencies.engineeringConcepts.map(c => c.value)
        }
    };
}

/**
 * Primary entry point: Runs complete fact extraction, scoring, role intelligence,
 * and profile sync pipeline. Refines narrative with Gemini if GEMINI_API_KEY is available.
 */
export async function analyzeResumeWithGemini(
    rawText: string,
    filename: string,
    filesizeBytes: number,
    verifiedPlatforms: CodingProfileEntry[] = [],
    currentUserProfile?: Partial<UserProfileRow>
): Promise<ComprehensiveIntelligenceReport> {
    // 1. Stage A & B: Document parsing and structured fact extraction
    const parsedDoc = await parseUploadedDocument(Buffer.from(rawText), filename, "text/plain");
    const facts = extractStructuredFacts(parsedDoc, verifiedPlatforms);

    // 2. Base deterministic analysis report
    const baseReport = buildDeterministicReport(facts, filename, filesizeBytes, currentUserProfile);

    // 3. Optional Gemini AI enhancement for narrative summary & bullet rewrites
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return baseReport;
    }

    try {
        const systemPrompt = `You are a Principal Technical Recruiter and Resume Intelligence Engine.
Refine the provided base analysis without altering the calculated numeric scores.
Return a STRICT JSON object with:
- "summary": string (3-4 sentences authoritative executive summary)
- "roleSpecificTips": array of 3 actionable high-impact suggestions tailored to the candidate's target role.
Do not output markdown code blocks or backticks.`;

        const userPrompt = `Candidate Role: ${baseReport.roleIntelligence.primaryTargetRole} (${baseReport.roleIntelligence.seniorityLevel})
Overall Score: ${baseReport.overallScore}/100
Languages: ${facts.competencies.languages.map(l => l.value).join(", ")}
Frameworks: ${facts.competencies.frameworks.map(f => f.value).join(", ")}
Resume Excerpt:
${rawText.slice(0, 3500)}`;

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userPrompt }] }],
                generationConfig: {
                    response_mime_type: "application/json",
                    temperature: 0.2
                }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (responseText) {
                const cleaned = responseText.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
                const parsed = JSON.parse(cleaned);

                if (parsed.summary) baseReport.summary = parsed.summary;
                if (Array.isArray(parsed.roleSpecificTips) && parsed.roleSpecificTips.length > 0) {
                    baseReport.roleSpecificTips = parsed.roleSpecificTips;
                }
                baseReport.modelUsed = "gemini-2.0-flash + orbix-deterministic-engine";
            }
        }
    } catch (err: any) {
        console.warn("Gemini refinement optional call failed, returning deterministic report:", err?.message || err);
    }

    return baseReport;
}

export type GeminiAnalysisReport = ComprehensiveIntelligenceReport;
export { analyzeResumeWithGemini as analyzeResume };
