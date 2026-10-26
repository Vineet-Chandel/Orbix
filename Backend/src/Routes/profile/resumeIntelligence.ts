import express, { type Request, type Response } from "express";
import multer from "multer";
import { query } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { parseUploadedDocument } from "../../services/resume/documentParser.js";
import { analyzeResumeWithGemini } from "../../services/resume/geminiResumeAnalyzer.js";
import { ProfileSyncService } from "../../services/resume/profileSyncService.js";

const intelligenceRouter = express.Router();
const profileSyncService = new ProfileSyncService();

// Memory storage for analyzing uploaded resumes (PDF / DOCX up to 5 MB)
const uploadDoc = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        const isPdf = file.mimetype.includes("pdf") || file.originalname.toLowerCase().endsWith(".pdf");
        const isDocx = file.mimetype.includes("wordprocessingml") || file.originalname.toLowerCase().endsWith(".docx");
        if (isPdf || isDocx) {
            cb(null, true);
        } else {
            cb(new Error("Only .pdf and .docx documents are supported."));
        }
    },
});

// =========================================================================
// 1. UPLOAD RESUME (PDF / DOCX) FOR TEXT EXTRACTION & INTELLIGENCE ANALYSIS
// =========================================================================
intelligenceRouter.post(
    "/upload-analyze",
    authenticate,
    uploadDoc.single("resume"),
    async (req: Request, res: Response) => {
        try {
            const authUser = req.user;
            if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ success: false, message: "Document file is required (.pdf or .docx)" });
            }

            const parseResult = await parseUploadedDocument(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );

            // Fetch verified platforms from database for ground-truth comparison
            const platformsRes = await query(
                `SELECT portal, portal_username AS "portalUsername", link AS url, verified, stats, last_sync_status AS "lastSyncStatus", last_sync_at AS "lastSyncAt"
                 FROM user_links WHERE username = $1 OR username = $2;`,
                [authUser.username, authUser.gmail]
            );

            const verifiedPlatforms = (platformsRes.rows || []).map((row: any) => ({
                portal: row.portal,
                username: row.portalUsername,
                url: row.url,
                verified: row.verified !== false && row.lastSyncStatus === "valid",
                lastSyncAt: row.lastSyncAt,
                lastSyncStatus: row.lastSyncStatus,
            }));

            // Fetch current user profile to determine missing fields for sync proposal
            const userProfileRes = await query(
                `SELECT id, username, headline, bio, location, website, github, linkedin, skills, college FROM users WHERE id = $1 OR username = $2 LIMIT 1;`,
                [authUser.id || "", authUser.username || ""]
            );
            const currentUserProfile = userProfileRes.rows[0] || {};

            // Run Intelligence Pipeline
            const report = await analyzeResumeWithGemini(
                parseResult.rawText,
                parseResult.filename,
                parseResult.filesizeBytes,
                verifiedPlatforms,
                currentUserProfile
            );

            return res.status(200).json({
                success: true,
                filename: parseResult.filename,
                filesizeBytes: parseResult.filesizeBytes,
                pageCount: parseResult.pageCount,
                detectedSections: parseResult.detectedSections,
                rawTextPreview: parseResult.rawText.slice(0, 1500),
                report,
            });
        } catch (err: any) {
            console.error("POST /upload-analyze error:", err);
            return res.status(400).json({
                success: false,
                message: err.message || "Failed to analyze document",
            });
        }
    }
);

// =========================================================================
// 2. RUN INTELLIGENCE ANALYSIS ON TEXT CONTENT
// =========================================================================
intelligenceRouter.post("/analyze", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { rawText, filename, filesizeBytes } = req.body;
        if (!rawText || typeof rawText !== "string") {
            return res.status(400).json({ success: false, message: "Resume raw text is required for analysis." });
        }

        // Fetch verified platforms from database for ground-truth comparison
        const platformsRes = await query(
            `SELECT portal, portal_username AS "portalUsername", link AS url, verified, stats, last_sync_status AS "lastSyncStatus", last_sync_at AS "lastSyncAt"
             FROM user_links WHERE username = $1 OR username = $2;`,
            [authUser.username, authUser.gmail]
        );

        const verifiedPlatforms = (platformsRes.rows || []).map((row: any) => ({
            portal: row.portal,
            username: row.portalUsername,
            url: row.url,
            verified: row.verified !== false && row.lastSyncStatus === "valid",
            lastSyncAt: row.lastSyncAt,
            lastSyncStatus: row.lastSyncStatus,
        }));

        const userProfileRes = await query(
            `SELECT id, username, headline, bio, location, website, github, linkedin, skills, college FROM users WHERE id = $1 OR username = $2 LIMIT 1;`,
            [authUser.id || "", authUser.username || ""]
        );
        const currentUserProfile = userProfileRes.rows[0] || {};

        const report = await analyzeResumeWithGemini(
            rawText,
            filename || "resume.pdf",
            filesizeBytes || 150000,
            verifiedPlatforms,
            currentUserProfile
        );

        return res.status(200).json({
            success: true,
            report,
        });
    } catch (err: any) {
        console.error("POST /analyze error:", err);
        return res.status(500).json({ success: false, message: "Resume analysis failed", error: err.message });
    }
});

// =========================================================================
// 3. GET PROFILE SYNC PROPOSAL (Eligible missing fields only)
// =========================================================================
intelligenceRouter.get("/sync-proposal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const userRes = await query(
            `SELECT id, username, headline, bio, location, website, github, linkedin, skills, college, resume_metadata AS "resumeMetadata"
             FROM users WHERE id = $1 OR username = $2 LIMIT 1;`,
            [authUser.id || "", authUser.username || ""]
        );

        if (!userRes.rows[0]) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = userRes.rows[0];
        const structuredFacts = user.resumeMetadata?.analysisReport?.structuredFacts;

        if (!structuredFacts) {
            return res.status(200).json({
                success: true,
                proposal: {
                    proposedFields: [],
                    totalEligibleFields: 0,
                    hasMissingFields: false
                }
            });
        }

        const proposal = profileSyncService.buildSyncProposal(user, structuredFacts);

        return res.status(200).json({
            success: true,
            proposal
        });
    } catch (err: any) {
        console.error("GET /sync-proposal error:", err);
        return res.status(500).json({ success: false, message: "Failed to build sync proposal", error: err.message });
    }
});

// =========================================================================
// 4. APPLY PROFILE SYNC (User reviewed & approved fields)
// =========================================================================
intelligenceRouter.post("/apply-sync", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { approvedFields } = req.body;
        if (!Array.isArray(approvedFields) || approvedFields.length === 0) {
            return res.status(400).json({ success: false, message: "approvedFields array is required" });
        }

        const userRes = await query(
            `SELECT id, username, headline, bio, location, website, github, linkedin, skills, college, resume_metadata AS "resumeMetadata"
             FROM users WHERE id = $1 OR username = $2 LIMIT 1;`,
            [authUser.id || "", authUser.username || ""]
        );

        if (!userRes.rows[0]) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = userRes.rows[0];
        const structuredFacts = user.resumeMetadata?.analysisReport?.structuredFacts;

        if (!structuredFacts) {
            return res.status(400).json({
                success: false,
                message: "No structured resume facts found. Please analyze your resume first."
            });
        }

        const proposal = profileSyncService.buildSyncProposal(user, structuredFacts);
        const result = await profileSyncService.applyProfileSync(authUser.id || authUser.username, approvedFields, proposal);

        return res.status(200).json({
            success: true,
            message: `Successfully synced ${result.updatedFields.length} field(s) to your Orbix profile.`,
            updatedFields: result.updatedFields
        });
    } catch (err: any) {
        console.error("POST /apply-sync error:", err);
        return res.status(500).json({ success: false, message: "Failed to apply profile sync", error: err.message });
    }
});

export default intelligenceRouter;
