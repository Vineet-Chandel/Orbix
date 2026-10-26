import express, { type Request, type Response } from "express";
import multer from "multer";
import { query } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { importProfileDataForUser } from "../../services/resume/profileImporter.js";
import { analyzeResumeContent } from "../../services/resume/resumeAnalyzer.js";
import { runJobMatchAnalysis } from "../../services/resume/jobMatcher.js";
import { generateAtsPdf } from "../../services/resume/pdfGenerator.js";
import { generateAtsDocx } from "../../services/resume/docxGenerator.js";
import { parseUploadedDocument } from "../../services/resume/documentParser.js";
import type { ResumeContent } from "../../services/resume/resumeTypes.js";

const intelligenceRouter = express.Router();

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
// 1. ONE-CLICK PROFILE IMPORT
// =========================================================================
intelligenceRouter.get("/builder/profile-data", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const summary = await importProfileDataForUser(
            authUser.id,
            authUser.username,
            authUser.gmail
        );

        return res.status(200).json({
            success: true,
            ...summary,
        });
    } catch (err: any) {
        console.error("GET /builder/profile-data error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to import profile information",
            error: err.message,
        });
    }
});

// =========================================================================
// 2. SAVED RESUME DOCUMENTS (CRUD & VERSIONS)
// =========================================================================
intelligenceRouter.get("/documents", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const result = await query(
            `SELECT
                r.id,
                r.title,
                r.target_role AS "targetRole",
                r.template_id AS "templateId",
                r.completeness_score AS "completenessScore",
                r.is_primary AS "isPrimary",
                r.content,
                r.created_at AS "createdAt",
                r.updated_at AS "updatedAt",
                (SELECT COUNT(*)::int FROM resume_versions v WHERE v.resume_id = r.id) AS "versionCount"
            FROM user_resumes r
            WHERE r.user_id = $1 OR r.username = $2
            ORDER BY r.is_primary DESC, r.updated_at DESC;`,
            [authUser.id, authUser.username]
        );

        return res.status(200).json({
            success: true,
            documents: result.rows || [],
        });
    } catch (err: any) {
        console.error("GET /documents error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve resumes", error: err.message });
    }
});

intelligenceRouter.get("/documents/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { id } = req.params;
        const resumeResult = await query(
            `SELECT
                id,
                user_id AS "userId",
                username,
                title,
                target_role AS "targetRole",
                template_id AS "templateId",
                completeness_score AS "completenessScore",
                is_primary AS "isPrimary",
                content,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM user_resumes
            WHERE id = $1 AND (user_id = $2 OR username = $3)
            LIMIT 1;`,
            [id, authUser.id, authUser.username]
        );

        if (!resumeResult.rows[0]) {
            return res.status(404).json({ success: false, message: "Resume document not found or access denied." });
        }

        const versionsResult = await query(
            `SELECT
                id,
                version_number AS "versionNumber",
                version_label AS "versionLabel",
                target_role AS "targetRole",
                company_name AS "companyName",
                job_description AS "jobDescription",
                content,
                created_at AS "createdAt"
            FROM resume_versions
            WHERE resume_id = $1
            ORDER BY version_number DESC;`,
            [id]
        );

        const analysesResult = await query(
            `SELECT
                id,
                analyzer_version AS "analyzerVersion",
                overall_score AS "overallScore",
                score_breakdown AS "scoreBreakdown",
                findings,
                checks_summary AS "checksSummary",
                created_at AS "createdAt"
            FROM resume_analyses
            WHERE resume_id = $1
            ORDER BY created_at DESC
            LIMIT 5;`,
            [id]
        );

        return res.status(200).json({
            success: true,
            document: resumeResult.rows[0],
            versions: versionsResult.rows || [],
            analyses: analysesResult.rows || [],
        });
    } catch (err: any) {
        console.error("GET /documents/:id error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch resume", error: err.message });
    }
});

intelligenceRouter.post("/documents", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { title, targetRole, templateId, content, completenessScore, isPrimary } = req.body;
        if (!content || typeof content !== "object") {
            return res.status(400).json({ success: false, message: "Resume content is required" });
        }

        const safeTitle = (title || "My Developer Resume").trim().slice(0, 150);
        const safeRole = (targetRole || "Full Stack Engineer").trim().slice(0, 150);
        const safeTemplate = templateId || "ats_clean_single";
        const score = typeof completenessScore === "number" ? Math.min(100, Math.max(0, completenessScore)) : 60;

        if (isPrimary) {
            await query(
                `UPDATE user_resumes SET is_primary = false WHERE user_id = $1 OR username = $2;`,
                [authUser.id, authUser.username]
            );
        }

        const insertRes = await query(
            `INSERT INTO user_resumes (
                user_id,
                username,
                title,
                target_role,
                template_id,
                content,
                completeness_score,
                is_primary
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
            RETURNING id, title, target_role AS "targetRole", template_id AS "templateId", completeness_score AS "completenessScore", is_primary AS "isPrimary", content, created_at AS "createdAt", updated_at AS "updatedAt";`,
            [authUser.id, authUser.username, safeTitle, safeRole, safeTemplate, JSON.stringify(content), score, isPrimary !== false]
        );

        const newDoc = insertRes.rows[0];

        // Save Initial Version
        await query(
            `INSERT INTO resume_versions (
                resume_id,
                user_id,
                username,
                version_number,
                version_label,
                target_role,
                content
            ) VALUES ($1, $2, $3, 1, 'Initial Draft', $4, $5::jsonb);`,
            [newDoc.id, authUser.id, authUser.username, safeRole, JSON.stringify(content)]
        );

        return res.status(201).json({
            success: true,
            document: newDoc,
        });
    } catch (err: any) {
        console.error("POST /documents error:", err);
        return res.status(500).json({ success: false, message: "Failed to create resume", error: err.message });
    }
});

intelligenceRouter.put("/documents/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { id } = req.params;
        const { title, targetRole, templateId, content, completenessScore, isPrimary } = req.body;

        const checkOwnership = await query(
            `SELECT id FROM user_resumes WHERE id = $1 AND (user_id = $2 OR username = $3);`,
            [id, authUser.id, authUser.username]
        );
        if (!checkOwnership.rows[0]) {
            return res.status(403).json({ success: false, message: "Unauthorized or document not found." });
        }

        const updateRes = await query(
            `UPDATE user_resumes
            SET
                title = COALESCE($1, title),
                target_role = COALESCE($2, target_role),
                template_id = COALESCE($3, template_id),
                content = COALESCE($4::jsonb, content),
                completeness_score = COALESCE($5, completeness_score),
                is_primary = COALESCE($6, is_primary),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING id, title, target_role AS "targetRole", template_id AS "templateId", completeness_score AS "completenessScore", is_primary AS "isPrimary", content, updated_at AS "updatedAt";`,
            [
                title ? title.trim().slice(0, 150) : null,
                targetRole ? targetRole.trim().slice(0, 150) : null,
                templateId || null,
                content ? JSON.stringify(content) : null,
                typeof completenessScore === "number" ? completenessScore : null,
                typeof isPrimary === "boolean" ? isPrimary : null,
                id,
            ]
        );

        return res.status(200).json({
            success: true,
            document: updateRes.rows[0],
        });
    } catch (err: any) {
        console.error("PUT /documents/:id error:", err);
        return res.status(500).json({ success: false, message: "Failed to update resume", error: err.message });
    }
});

intelligenceRouter.delete("/documents/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { id } = req.params;
        const delRes = await query(
            `DELETE FROM user_resumes WHERE id = $1 AND (user_id = $2 OR username = $3) RETURNING id;`,
            [id, authUser.id, authUser.username]
        );

        if (!delRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Resume not found or unauthorized" });
        }

        return res.status(200).json({ success: true, message: "Resume document deleted successfully." });
    } catch (err: any) {
        console.error("DELETE /documents/:id error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete resume", error: err.message });
    }
});

// Save a separate version for this resume (role-specific or tailored)
intelligenceRouter.post("/documents/:id/versions", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { id } = req.params;
        const { versionLabel, targetRole, companyName, jobDescription, content } = req.body;

        const checkOwnership = await query(
            `SELECT id FROM user_resumes WHERE id = $1 AND (user_id = $2 OR username = $3);`,
            [id, authUser.id, authUser.username]
        );
        if (!checkOwnership.rows[0]) {
            return res.status(403).json({ success: false, message: "Unauthorized or document not found." });
        }

        const countRes = await query(
            `SELECT COALESCE(MAX(version_number), 0) + 1 AS "nextVersion" FROM resume_versions WHERE resume_id = $1;`,
            [id]
        );
        const nextVersion = countRes.rows[0]?.nextVersion || 2;

        const insertRes = await query(
            `INSERT INTO resume_versions (
                resume_id,
                user_id,
                username,
                version_number,
                version_label,
                target_role,
                company_name,
                job_description,
                content
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            RETURNING id, version_number AS "versionNumber", version_label AS "versionLabel", target_role AS "targetRole", company_name AS "companyName", created_at AS "createdAt";`,
            [
                id,
                authUser.id,
                authUser.username,
                nextVersion,
                versionLabel || `Version ${nextVersion}`,
                targetRole || null,
                companyName || null,
                jobDescription || null,
                JSON.stringify(content),
            ]
        );

        return res.status(201).json({
            success: true,
            version: insertRes.rows[0],
        });
    } catch (err: any) {
        console.error("POST /documents/:id/versions error:", err);
        return res.status(500).json({ success: false, message: "Failed to save version", error: err.message });
    }
});

// =========================================================================
// 3. RESUME INTELLIGENCE: REAL 8-CHECK ANALYZER
// =========================================================================
intelligenceRouter.post("/analyze", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) return res.status(401).json({ success: false, message: "Authentication required" });

        const { resumeId, versionId, content, fileSizeMb } = req.body;
        if (!content || typeof content !== "object") {
            return res.status(400).json({ success: false, message: "Resume content is required for analysis." });
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

        const report = analyzeResumeContent(content as ResumeContent, verifiedPlatforms, fileSizeMb);

        // Store analysis result
        if (resumeId) {
            await query(
                `INSERT INTO resume_analyses (
                    resume_id,
                    version_id,
                    user_id,
                    username,
                    analyzer_version,
                    overall_score,
                    score_breakdown,
                    findings,
                    checks_summary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb);`,
                [
                    resumeId,
                    versionId || null,
                    authUser.id,
                    authUser.username,
                    report.analyzerVersion,
                    report.overallScore,
                    JSON.stringify(report.scoreBreakdown),
                    JSON.stringify(report.findings),
                    JSON.stringify(report.checks),
                ]
            );
        }

        return res.status(200).json({
            success: true,
            report,
        });
    } catch (err: any) {
        console.error("POST /analyze error:", err);
        return res.status(500).json({ success: false, message: "Analysis failed", error: err.message });
    }
});

// =========================================================================
// 4. JOB MATCH & TAILORING
// =========================================================================
intelligenceRouter.post("/job-match", authenticate, async (req: Request, res: Response) => {
    try {
        const { content, targetRole, companyName, jobDescription } = req.body;
        if (!content || !targetRole) {
            return res.status(400).json({ success: false, message: "Resume content and target role are required." });
        }

        const matchReport = runJobMatchAnalysis(
            content as ResumeContent,
            targetRole,
            companyName || "",
            jobDescription || ""
        );

        return res.status(200).json({
            success: true,
            matchReport,
        });
    } catch (err: any) {
        console.error("POST /job-match error:", err);
        return res.status(500).json({ success: false, message: "Job match analysis failed", error: err.message });
    }
});

// =========================================================================
// 5. EXPORT ENGINE: NATIVE ATS PDF & EDITABLE DOCX WITH VALIDATION
// =========================================================================
intelligenceRouter.post("/export/pdf", authenticate, async (req: Request, res: Response) => {
    try {
        const { content, templateId, filename } = req.body;
        if (!content || typeof content !== "object") {
            return res.status(400).json({ success: false, message: "Resume content is required for export." });
        }

        const { pdfBuffer, validation } = await generateAtsPdf(content as ResumeContent, { templateId });

        if (!validation.success) {
            return res.status(422).json({
                success: false,
                message: "PDF validation check failed.",
                validation,
            });
        }

        const cleanName = (filename || `${(content.contact.fullName || "Resume").replace(/\s+/g, "_")}_Orbix.pdf`).replace(/[^a-zA-Z0-9._-]/g, "");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${cleanName}"`);
        res.setHeader("X-Orbix-Validation-Success", "true");
        res.setHeader("X-Orbix-Filesize-Bytes", String(validation.filesizeBytes));
        res.setHeader("X-Orbix-Page-Count", String(validation.pageCount));

        return res.send(pdfBuffer);
    } catch (err: any) {
        console.error("POST /export/pdf error:", err);
        return res.status(500).json({ success: false, message: "PDF generation failed", error: err.message });
    }
});

intelligenceRouter.post("/export/docx", authenticate, async (req: Request, res: Response) => {
    try {
        const { content, templateId, filename } = req.body;
        if (!content || typeof content !== "object") {
            return res.status(400).json({ success: false, message: "Resume content is required for export." });
        }

        const { docxBuffer, validation } = await generateAtsDocx(content as ResumeContent, { templateId });

        if (!validation.success) {
            return res.status(422).json({
                success: false,
                message: "DOCX validation check failed.",
                validation,
            });
        }

        const cleanName = (filename || `${(content.contact.fullName || "Resume").replace(/\s+/g, "_")}_Orbix.docx`).replace(/[^a-zA-Z0-9._-]/g, "");

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${cleanName}"`);
        res.setHeader("X-Orbix-Validation-Success", "true");
        res.setHeader("X-Orbix-Filesize-Bytes", String(validation.filesizeBytes));

        return res.send(docxBuffer);
    } catch (err: any) {
        console.error("POST /export/docx error:", err);
        return res.status(500).json({ success: false, message: "DOCX generation failed", error: err.message });
    }
});

// =========================================================================
// 6. UPLOAD EXISTING RESUME (PDF / DOCX) FOR TEXT EXTRACTION & ANALYSIS
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

            // Run 8-check analysis on the parsed draft
            const report = analyzeResumeContent(
                parseResult.parsedDraft,
                [],
                req.file.size / (1024 * 1024)
            );

            return res.status(200).json({
                success: true,
                filename: parseResult.filename,
                filesizeBytes: parseResult.filesizeBytes,
                pageCount: parseResult.pageCount,
                detectedSections: parseResult.detectedSections,
                rawTextPreview: parseResult.rawText.slice(0, 1500),
                parsedDraft: parseResult.parsedDraft,
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

export default intelligenceRouter;
