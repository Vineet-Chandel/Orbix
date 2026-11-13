import { Router, type Request, type Response } from "express";
import multer from "multer";
import { authenticate, optionalAuthenticate, requireClubAccount } from "../../middlewares/auth.middleware.js";
import { query } from "../../database/client.js";
import { CertificateTemplateService } from "../../services/club/certificateTemplateService.js";
import { CertificateUploadService } from "../../services/club/certificateUploadService.js";
import { CertificateIssuanceService } from "../../services/club/certificateIssuanceService.js";
import { CertificatePdfService } from "../../services/club/certificatePdfService.js";
import { CertificateQueueService } from "../../services/club/certificateQueueService.js";
import { CertificateCsvService } from "../../services/club/certificateCsvService.js";
import { CertificatePreviewService } from "../../services/club/certificatePreviewService.js";
import { CertificateVerificationService } from "../../services/club/certificateVerificationService.js";
import type { DynamicDataSnapshot } from "../../types/certificateStudio.js";

const certificateRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

/**
 * Helper to fetch club where user is owner or authorized staff
 * Optionally enforces specific targetClubId to prevent IDOR
 */
async function getStaffClub(userId: string, targetClubId?: string) {
    let sql = `SELECT vc.id, vc.name, vc.slug, vc.college_name, vc.college_id, vc.logo_url
         FROM verified_clubs vc
         LEFT JOIN club_memberships cm ON cm.club_id = vc.id AND cm.user_id = $1 AND cm.status = 'active'
         WHERE (vc.auth_user_id = $1 OR cm.access_role IN ('owner', 'admin', 'team_lead', 'advisor'))`;
    const params: any[] = [userId];
    if (targetClubId) {
        sql += ` AND vc.id = $2`;
        params.push(targetClubId);
    }
    sql += ` LIMIT 1;`;
    const res = await query(sql, params);
    return res.rows[0] || null;
}

// =========================================================================
// 1. TEMPLATE LIBRARY ENDPOINTS
// =========================================================================

/**
 * GET /api/club/certificates/templates
 * Lists all system templates and club-owned templates
 */
certificateRouter.get("/templates", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { category } = req.query as { category?: string };
        const result = await CertificateTemplateService.getTemplates(club.id, category);

        return res.json({
            success: true,
            systemTemplates: result.systemTemplates,
            clubTemplates: result.clubTemplates,
        });
    } catch (err: any) {
        console.error("Fetch certificate templates error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to load templates." });
    }
});

/**
 * GET /api/club/certificates/templates/:templateId
 * Retrieves a single template by ID
 */
certificateRouter.get("/templates/:templateId", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const templateId = String(req.params.templateId);
        const template = await CertificateTemplateService.getTemplateById(templateId, club.id);

        if (!template) {
            return res.status(404).json({ success: false, message: "Template not found." });
        }

        return res.json({ success: true, template });
    } catch (err: any) {
        console.error("Fetch template details error:", err);
        return res.status(500).json({ success: false, message: "Failed to load template." });
    }
});

/**
 * POST /api/club/certificates/templates
 * Creates a new template (blank canvas or custom)
 */
certificateRouter.post("/templates", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { name, category, design, backgroundAssetUrl, backgroundFit, orientation, pageWidth, pageHeight } = req.body;

        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Please provide a valid template name (minimum 2 characters)." });
        }

        if (!design || typeof design !== "object") {
            return res.status(400).json({ success: false, message: "A valid structured design object is required." });
        }

        const created = await CertificateTemplateService.createTemplate(club.id, req.user!.id, {
            name: name.trim(),
            category: category || "event",
            design,
            backgroundAssetUrl,
            backgroundFit,
            orientation,
            pageWidth,
            pageHeight,
        });

        return res.status(201).json({ success: true, template: created });
    } catch (err: any) {
        console.error("Create template error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to create template." });
    }
});

/**
 * PUT /api/club/certificates/templates/:templateId
 * Updates an existing club-owned template
 */
certificateRouter.put("/templates/:templateId", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const templateId = String(req.params.templateId);
        const { name, category, design, backgroundAssetUrl, backgroundFit, status } = req.body;

        const updated = await CertificateTemplateService.updateTemplate(templateId, club.id, req.user!.id, {
            name,
            category,
            design,
            backgroundAssetUrl,
            backgroundFit,
            status,
        });

        return res.json({ success: true, template: updated });
    } catch (err: any) {
        console.error("Update template error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to update template." });
    }
});

/**
 * POST /api/club/certificates/templates/:templateId/duplicate
 * Duplicates a template (system or club) into a new club-owned editable template
 */
certificateRouter.post("/templates/:templateId/duplicate", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const templateId = String(req.params.templateId);
        const { customName } = req.body;

        const duplicated = await CertificateTemplateService.duplicateTemplate(
            templateId,
            club.id,
            req.user!.id,
            customName
        );

        return res.status(201).json({ success: true, template: duplicated });
    } catch (err: any) {
        console.error("Duplicate template error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to duplicate template." });
    }
});

/**
 * POST /api/club/certificates/templates/:templateId/rename
 * Renames a club-owned template
 */
certificateRouter.post("/templates/:templateId/rename", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const templateId = String(req.params.templateId);
        const { name } = req.body;
        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Valid template name required (min 2 characters)." });
        }

        const renamed = await CertificateTemplateService.renameTemplate(templateId, club.id, name);
        return res.json({ success: true, template: renamed });
    } catch (err: any) {
        console.error("Rename template error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to rename template." });
    }
});

/**
 * DELETE /api/club/certificates/templates/:templateId
 * Archives a club-owned template
 */
certificateRouter.delete("/templates/:templateId", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const templateId = String(req.params.templateId);
        await CertificateTemplateService.archiveTemplate(templateId, club.id);

        return res.json({ success: true, message: "Template archived successfully." });
    } catch (err: any) {
        console.error("Archive template error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to archive template." });
    }
});

// =========================================================================
// 2. BACKGROUND UPLOAD & SANITIZATION
// =========================================================================

/**
 * POST /api/club/certificates/upload-background
 * Strictly validated background upload (PNG, JPG, JPEG, and sanitized SVG)
 */
certificateRouter.post(
    "/upload-background",
    authenticate,
    requireClubAccount,
    upload.single("background"),
    async (req: Request, res: Response) => {
        try {
            const club = await getStaffClub(req.user!.id);
            if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

            if (!req.file) {
                return res.status(400).json({ success: false, message: "No file was uploaded." });
            }

            const result = await CertificateUploadService.processBackgroundUpload(req.file, club.id);

            return res.json({
                success: true,
                assetUrl: result.assetUrl,
                format: result.format,
                width: result.width,
                height: result.height,
                bytes: result.bytes,
                aspectRatio: result.aspectRatio,
                message: "Background asset processed and validated successfully.",
            });
        } catch (err: any) {
            console.error("Upload certificate background error:", err);
            return res.status(400).json({ success: false, message: err.message || "Upload processing failed." });
        }
    }
);

// =========================================================================
// 3. BATCH ISSUANCE & BATCH MONITORING
// =========================================================================

/**
 * GET /api/club/certificates/events/:eventId/eligibility
 * Evaluates comprehensive participant eligibility for an event according to category rules (Phase 10)
 */
certificateRouter.get("/events/:eventId/eligibility", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const eventId = String(req.params.eventId);
        const { category = "participation", teamId } = req.query as { category?: string; teamId?: string };

        const report = await CertificateIssuanceService.evaluateEventEligibility(
            club.id,
            eventId,
            category,
            teamId
        );

        return res.json({ success: true, report });
    } catch (err: any) {
        console.error("Evaluate event eligibility error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to evaluate event eligibility." });
    }
});

/**
 * GET /api/club/certificates/recipient-directory
 * Searches authorized recipient sources with strict privacy protection (Phase 11)
 */
certificateRouter.get("/recipient-directory", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { source = "all", query: search = "" } = req.query as {
            source?: "all" | "orbix_user" | "username" | "club_members" | "event_participants" | "team_members" | "teams";
            query?: string;
        };

        const result = await CertificateIssuanceService.searchRecipientDirectory(club.id, source, search);

        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("Recipient directory search error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to search directory." });
    }
});

/**
 * POST /api/club/certificates/issue-batch
 * Comprehensive batch issuance with eligibility checks and PDF generation
 */
certificateRouter.post("/issue-batch", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id, req.body.clubId);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const {
            templateId,
            customDesign,
            title,
            certificateType = "participation",
            issuanceSource = "event",
            eventId,
            teamId,
            awardPosition,
            description,
            signerName,
            signerRole,
            issueDate,
            metadata,
            recipients,
            teamIssuanceMode,
            teamSnapshots,
            allowManualOverride,
            overrideReason,
            asyncMode,
            idempotencyKey,
        } = req.body;

        const result = await CertificateIssuanceService.issueBatch({
            clubId: club.id,
            staffUserId: req.user!.id,
            templateId,
            customDesign,
            title,
            certificateType,
            issuanceSource,
            eventId,
            teamId,
            awardPosition,
            description,
            signerName,
            signerRole,
            issueDate,
            metadata,
            recipients,
            teamIssuanceMode,
            teamSnapshots,
            allowManualOverride,
            overrideReason,
            asyncMode,
            idempotencyKey,
        });

        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("Batch issuance error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to issue certificate batch." });
    }
});

/**
 * GET /api/club/certificates/teams/:teamId/roster
 * Retrieves authoritative team membership roster for review before issuance (Phase 12)
 */
certificateRouter.get("/teams/:teamId/roster", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const teamId = String(req.params.teamId);
        const { eventId } = req.query as { eventId?: string };

        const team = await CertificateIssuanceService.getTeamRosterForReview(club.id, teamId, eventId);
        return res.json({ success: true, team });
    } catch (err: any) {
        console.error("Fetch team roster error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to fetch team roster." });
    }
});

/**
 * GET /api/club/certificates/batches
 * Lists all certificate batches issued by the club
 */
certificateRouter.get("/batches", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
        const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

        const countRes = await query(
            `SELECT COUNT(*)::int AS total FROM certificate_batches WHERE club_id = $1;`,
            [club.id]
        );
        const total = countRes.rows[0]?.total || 0;

        const batchesRes = await query(
            `SELECT
                b.id,
                b.event_id AS "eventId",
                e.title AS "eventTitle",
                b.template_id AS "templateId",
                t.name AS "templateName",
                b.template_version AS "templateVersion",
                b.title,
                b.certificate_type AS "certificateType",
                b.issuance_source AS "issuanceSource",
                b.total_recipients AS "totalRecipients",
                b.successful_count AS "successfulCount",
                b.failed_count AS "failedCount",
                b.status,
                b.created_at AS "createdAt",
                b.updated_at AS "updatedAt"
             FROM certificate_batches b
             LEFT JOIN club_events e ON e.id = b.event_id
             LEFT JOIN certificate_templates t ON t.id = b.template_id
             WHERE b.club_id = $1
             ORDER BY b.created_at DESC
             LIMIT $2 OFFSET $3;`,
            [club.id, limit, offset]
        );

        return res.json({
            success: true,
            batches: batchesRes.rows,
            pagination: {
                total,
                limit,
                offset,
                hasMore: (offset + batchesRes.rows.length) < total,
            },
        });
    } catch (err: any) {
        console.error("Fetch certificate batches error:", err);
        return res.status(500).json({ success: false, message: "Failed to load batches." });
    }
});

/**
 * GET /api/club/certificates/queue/metrics
 * Returns real-time telemetry metrics for asynchronous certificate generation (Phase 19)
 */
certificateRouter.get("/queue/metrics", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const metrics = CertificateQueueService.getQueueMetrics(club.id);
        return res.json({ success: true, metrics });
    } catch (err: any) {
        console.error("Fetch queue metrics error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve queue metrics." });
    }
});

/**
 * GET /api/club/certificates/batches/:batchId/progress
 * Retrieves real-time async generation progress and throughput for a batch (Phase 13)
 */
certificateRouter.get("/batches/:batchId/progress", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const batchId = String(req.params.batchId);
        const progress = await CertificateQueueService.getBatchProgress(batchId, club.id);

        if (!progress) {
            return res.status(404).json({ success: false, message: "Batch not found." });
        }

        return res.json({ success: true, progress });
    } catch (err: any) {
        console.error("Fetch batch progress error:", err);
        return res.status(500).json({ success: false, message: "Failed to load batch progress." });
    }
});

/**
 * POST /api/club/certificates/batches/:batchId/retry-failed
 * Partial batch recovery: retries ONLY the failed recipients in a batch without duplicating successful ones (Phase 13)
 */
certificateRouter.post("/batches/:batchId/retry-failed", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const batchId = String(req.params.batchId);
        const result = await CertificateQueueService.retryFailedBatch(batchId, club.id, req.user!.id);

        return res.json({
            success: true,
            message: `Retrying ${result.retriedCount} unissued/failed recipients in background queue.`,
            retriedCount: result.retriedCount,
        });
    } catch (err: any) {
        console.error("Retry failed batch error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to retry batch." });
    }
});

/**
 * POST /api/club/certificates/batches/:batchId/cancel
 * Aborts an active or queued batch, preventing unprocessed recipients from issuing (Phase 14)
 */
certificateRouter.post("/batches/:batchId/cancel", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const batchId = String(req.params.batchId);
        const result = await CertificateQueueService.cancelBatch(batchId, club.id, req.user!.id);

        return res.json({
            success: result.success,
            message: result.message,
            cancelledUnprocessedCount: result.cancelledUnprocessedCount,
        });
    } catch (err: any) {
        console.error("Cancel batch error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to cancel batch." });
    }
});

/**
 * GET /api/club/certificates/batches/:batchId/errors
 * Returns detailed item-level error logs for a failed or partially completed batch (Phase 14)
 */
certificateRouter.get("/batches/:batchId/errors", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const batchId = String(req.params.batchId);
        const errorDetails = await CertificateQueueService.getBatchErrors(batchId, club.id);

        return res.json({ success: true, ...errorDetails });
    } catch (err: any) {
        console.error("Fetch batch errors error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to load error details." });
    }
});

/**
 * GET /api/club/certificates/batches/:batchId/report
 * Exports comprehensive generation audit report (JSON or CSV download) (Phase 14)
 */
certificateRouter.get("/batches/:batchId/report", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const batchId = String(req.params.batchId);
        const report = await CertificateQueueService.generateBatchReport(batchId, club.id);

        if (req.query.format === "csv") {
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="batch-${batchId}-audit-report.csv"`);
            return res.send(report.csvString);
        }

        return res.json({
            success: true,
            summary: report.summary,
            records: report.records,
        });
    } catch (err: any) {
        console.error("Generate batch report error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to generate report." });
    }
});

/**
 * POST /api/club/certificates/batches/:batchId/resume
 * Resumes an interrupted batch after worker or server interruption (Phase 14)
 */
certificateRouter.post("/batches/:batchId/resume", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const batchId = String(req.params.batchId);
        const result = await CertificateQueueService.retryFailedBatch(batchId, club.id, req.user!.id);

        return res.json({
            success: true,
            message: `Batch resumed. ${result.retriedCount} remaining recipients enqueued for processing.`,
            retriedCount: result.retriedCount,
        });
    } catch (err: any) {
        console.error("Resume batch error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to resume batch." });
    }
});

/**
 * POST /api/club/certificates/batches/resume-stalled
 * System audit: Scans and resumes any stalled batches for the club (Phase 14)
 */
certificateRouter.post("/batches/resume-stalled", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const result = await CertificateQueueService.resumeWorkerProcessing(club.id);

        return res.json({
            success: true,
            message: `Scanned active batches. Resumed ${result.resumedCount} stalled jobs.`,
            resumedBatchIds: result.batchIds,
        });
    } catch (err: any) {
        console.error("Resume stalled batches error:", err);
        return res.status(500).json({ success: false, message: "Failed to resume stalled batches." });
    }
});

/**
 * POST /api/club/certificates/csv/reconcile
 * Parses, sanitizes against formula injection, and reconciles CSV recipients with campus directory (Phase 14)
 */
certificateRouter.post(
    "/csv/reconcile",
    authenticate,
    requireClubAccount,
    upload.single("file"),
    async (req: Request, res: Response) => {
        try {
            const club = await getStaffClub(req.user!.id);
            if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

            let csvContent: string | undefined = req.body?.csvText ? String(req.body.csvText) : undefined;
            let fileBuffer: Buffer | undefined = req.file?.buffer;
            let filename: string | undefined = req.file?.originalname;
            let eventId: string | undefined = req.body?.eventId;
            let customColumnMapping: Record<string, string> | undefined;

            if (req.body?.customColumnMapping) {
                try {
                    customColumnMapping = typeof req.body.customColumnMapping === "string"
                        ? JSON.parse(req.body.customColumnMapping)
                        : req.body.customColumnMapping;
                } catch {
                    // Fall back to auto-detection
                }
            }

            if (!fileBuffer && (!csvContent || csvContent.trim().length === 0)) {
                return res.status(400).json({ success: false, message: "No CSV/XLSX content or file provided." });
            }

            const result = await CertificateCsvService.reconcileCsv({
                clubId: club.id,
                csvContent,
                fileBuffer,
                filename,
                eventId,
                customColumnMapping,
            });

            return res.json({ success: true, reconciliation: result });
        } catch (err: any) {
            console.error("CSV/XLSX reconcile error:", err);
            return res.status(400).json({ success: false, message: err.message || "Failed to reconcile spreadsheet." });
        }
    }
);

/**
 * GET /api/club/certificates/csv/sample-template
 * Downloads an official sanitized CSV or XLSX recipient template (Phase 13 & 14)
 */
certificateRouter.get("/csv/sample-template", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const format = String(req.query.format || "csv").toLowerCase();
        if (format === "xlsx" || format === "excel") {
            const xlsxBuffer = CertificateCsvService.generateSampleXlsx();
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", 'attachment; filename="orbix_recipient_template.xlsx"');
            return res.send(xlsxBuffer);
        }

        const sampleCsv = CertificateCsvService.generateSampleCsv();
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="orbix_recipient_template.csv"');
        return res.send(sampleCsv);
    } catch (err: any) {
        console.error("Sample template download error:", err);
        return res.status(500).json({ success: false, message: "Failed to generate recipient template." });
    }
});

/**
 * GET /api/club/certificates/stats
 * Computes all 8 Phase 1 dashboard metrics
 */
certificateRouter.get("/stats", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const statsRes = await query(
            `SELECT
                COUNT(*) FILTER (WHERE is_revoked = false)::int AS "totalCertificatesIssued",
                COUNT(*) FILTER (WHERE event_id IS NOT NULL AND is_revoked = false)::int AS "eventCertificates",
                COUNT(*) FILTER (WHERE event_id IS NULL AND team_id IS NULL AND is_revoked = false)::int AS "manualCertificates",
                COUNT(*) FILTER (WHERE team_id IS NULL AND is_revoked = false)::int AS "individualCertificates",
                COUNT(*) FILTER (WHERE team_id IS NOT NULL AND is_revoked = false)::int AS "teamCertificates",
                COALESCE((SELECT SUM(total_recipients - successful_count - failed_count) FROM certificate_batches WHERE club_id = $1 AND status IN ('queued', 'processing', 'validating')), 0)::int AS "pendingIssuance",
                COALESCE((SELECT SUM(failed_count) FROM certificate_batches WHERE club_id = $1), 0)::int AS "failedGenerations",
                COUNT(*) FILTER (WHERE is_revoked = true)::int AS "revokedCertificates"
             FROM club_certificates
             WHERE club_id = $1;`,
            [club.id]
        );

        return res.json({
            success: true,
            stats: statsRes.rows[0] || {
                totalCertificatesIssued: 0,
                eventCertificates: 0,
                manualCertificates: 0,
                individualCertificates: 0,
                teamCertificates: 0,
                pendingIssuance: 0,
                failedGenerations: 0,
                revokedCertificates: 0,
            },
        });
    } catch (err: any) {
        console.error("Fetch certificate stats error:", err);
        return res.status(500).json({ success: false, message: "Failed to load stats." });
    }
});

/**
 * GET /api/club/certificates/history
 * Comprehensive search, filtering, sorting and server-side pagination of issued certificates
 */
certificateRouter.get("/history", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
        const offset = (page - 1) * limit;
        const search = ((req.query.search as string) || "").trim();
        const filter = ((req.query.filter as string) || "all").trim();
        const sortBy = ((req.query.sortBy as string) || "newest").trim();

        const params: any[] = [club.id];
        const whereClauses: string[] = ["c.club_id = $1"];

        if (search) {
            params.push(`%${search}%`);
            const pIdx = params.length;
            whereClauses.push(`(
                c.recipient_name ILIKE $${pIdx} OR
                c.credential_code ILIKE $${pIdx} OR
                c.title ILIKE $${pIdx} OR
                COALESCE(e.title, '') ILIKE $${pIdx}
            )`);
        }

        if (filter === "event") {
            whereClauses.push("c.event_id IS NOT NULL");
        } else if (filter === "manual") {
            whereClauses.push("c.event_id IS NULL AND c.team_id IS NULL");
        } else if (filter === "team") {
            whereClauses.push("c.team_id IS NOT NULL");
        } else if (filter === "revoked") {
            whereClauses.push("c.is_revoked = true");
        } else if (filter !== "all") {
            params.push(filter);
            whereClauses.push(`c.certificate_type = $${params.length}`);
        }

        let orderBy = "c.issue_date DESC, c.created_at DESC";
        if (sortBy === "oldest") orderBy = "c.issue_date ASC, c.created_at ASC";
        else if (sortBy === "name_asc") orderBy = "c.recipient_name ASC";
        else if (sortBy === "name_desc") orderBy = "c.recipient_name DESC";
        else if (sortBy === "verifications") orderBy = "c.verification_count DESC, c.created_at DESC";

        params.push(limit, offset);
        const limitIdx = params.length - 1;
        const offsetIdx = params.length;

        const certsQuery = `
            SELECT
                c.id,
                c.recipient_name AS "recipientName",
                c.recipient_email AS "recipientEmail",
                c.title,
                c.certificate_type AS "certificateType",
                c.credential_code AS "credentialCode",
                c.signer_name AS "signerName",
                c.signer_role AS "signerRole",
                c.issue_date AS "issueDate",
                c.is_revoked AS "isRevoked",
                c.revoked_at AS "revokedAt",
                c.revocation_reason AS "revocationReason",
                c.verification_count AS "verificationCount",
                c.sha256_hash AS "sha256Hash",
                c.pdf_url AS "pdfUrl",
                c.created_at AS "createdAt",
                e.title AS "eventTitle",
                COUNT(*) OVER()::int AS "totalCount"
            FROM club_certificates c
            LEFT JOIN club_events e ON e.id = c.event_id
            WHERE ${whereClauses.join(" AND ")}
            ORDER BY ${orderBy}
            LIMIT $${limitIdx} OFFSET $${offsetIdx};
        `;

        const certsRes = await query(certsQuery, params);
        const total = certsRes.rows[0]?.totalCount || 0;
        const totalPages = Math.ceil(total / limit) || 1;

        return res.json({
            success: true,
            certificates: certsRes.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
        });
    } catch (err: any) {
        console.error("Fetch certificate history error:", err);
        return res.status(500).json({ success: false, message: "Failed to load certificate history." });
    }
});

/**
 * GET /api/club/certificates/settings
 */
certificateRouter.get("/settings", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const setRes = await query(
            `SELECT
                default_signer_name AS "defaultSignerName",
                default_signer_role AS "defaultSignerRole",
                default_title AS "defaultTitle",
                require_attendance AS "requireAttendance",
                verification_public AS "verificationPublic",
                signature_asset_url AS "signatureAssetUrl"
             FROM club_certificate_settings
             WHERE club_id = $1;`,
            [club.id]
        );

        return res.json({
            success: true,
            settings: setRes.rows[0] || {
                defaultSignerName: "",
                defaultSignerRole: "Faculty Advisor",
                defaultTitle: "Certificate of Recognition",
                requireAttendance: true,
                verificationPublic: true,
                signatureAssetUrl: null,
            },
        });
    } catch (err: any) {
        console.error("Fetch certificate settings error:", err);
        return res.status(500).json({ success: false, message: "Failed to load settings." });
    }
});

/**
 * PUT /api/club/certificates/settings
 */
certificateRouter.put("/settings", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const {
            defaultSignerName,
            defaultSignerRole,
            defaultTitle,
            requireAttendance,
            verificationPublic,
            signatureAssetUrl,
        } = req.body;

        await query(
            `INSERT INTO club_certificate_settings (
                club_id, default_signer_name, default_signer_role, default_title,
                require_attendance, verification_public, signature_asset_url, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (club_id) DO UPDATE SET
                default_signer_name = EXCLUDED.default_signer_name,
                default_signer_role = EXCLUDED.default_signer_role,
                default_title = EXCLUDED.default_title,
                require_attendance = EXCLUDED.require_attendance,
                verification_public = EXCLUDED.verification_public,
                signature_asset_url = EXCLUDED.signature_asset_url,
                updated_at = NOW();`,
            [
                club.id,
                defaultSignerName || null,
                defaultSignerRole || null,
                defaultTitle || "Certificate of Recognition",
                requireAttendance !== false,
                verificationPublic !== false,
                signatureAssetUrl || null,
            ]
        );

        return res.json({ success: true, message: "Certificate settings saved successfully." });
    } catch (err: any) {
        console.error("Save certificate settings error:", err);
        return res.status(500).json({ success: false, message: "Failed to save settings." });
    }
});

// =========================================================================
// 4. LIVE PREVIEW & OFFICIAL PDF DOWNLOAD
// =========================================================================

/**
 * POST /api/club/certificates/preview-sample
 * Generates test PDF buffer from design + sample data for immediate visual verification
 */
certificateRouter.post("/preview-sample", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { design, sampleData } = req.body;
        if (!design || !design.elements) {
            return res.status(400).json({ success: false, message: "Valid design document required." });
        }

        const snapshot: DynamicDataSnapshot = sampleData || {
            recipient: {
                id: req.user!.id,
                name: "Aarav Sharma",
                fullName: "Aarav Sharma",
                firstName: "Aarav",
                middleName: "Kumar",
                lastName: "Sharma",
                username: "aarav_dev",
                headline: "Full-Stack Developer & Open Source Contributor",
                collegeName: club.college_name || "Delhi Technological University",
                institution: club.college_name || "Delhi Technological University",
                campus: "Main Campus (Shahbad Daulatpur)",
                department: "Computer Science & Engineering",
                rollNumber: "2K22/CO/142",
                city: "New Delhi",
                state: "Delhi",
            },
            event: {
                id: "sample_evt_01",
                title: "Annual HackSphere 2026",
                name: "Annual HackSphere 2026",
                category: "Hackathon & Design Sprint",
                date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                venue: "Pragyan Auditorium, Hall B",
                location: "New Delhi, India",
                organizingClub: club.name || "Orbix Developer Society",
            },
            club: {
                id: club.id,
                name: club.name,
                slug: club.slug,
                collegeName: club.college_name,
                logoUrl: club.logo_url,
                leadName: "Ananya Roy",
            },
            award: {
                title: "Certificate of Achievement",
                type: "achievement",
                description: "In recognition of outstanding algorithmic problem solving, exceptional teamwork, and demonstrated commitment to technical excellence.",
                position: "Winner — 1st Place",
                rank: "Rank #1",
                awardCategory: "Best AI Innovation",
                participationStatus: "Verified Attendee",
                completionStatus: "Distinction Honors",
            },
            team: {
                id: "team_01",
                name: "Team NeuralForge",
                identifier: "TEAM-NF-09",
                role: "Lead ML Architect",
                members: "Aarav Sharma, Rhea Patel, Rohan Gupta",
                position: "Winning Team (1st Place)",
                achievement: "Best Full-Stack System Architecture",
            },
            certificate: {
                credentialCode: "ORB-PREVIEW-2026-TEST",
                number: "ORB-2026-0042",
                issueDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                verificationUrl: `https://orbix.dev/verify/certificate/ORB-PREVIEW-2026-TEST`,
                issuingAuthority: "Orbix Credential Council & Chapter Senate",
                signerName: "Prof. Rajesh Verma",
                signerRole: "Faculty Advisor & Head of Dept",
            },
            custom: design.customAttributes?.reduce((acc: Record<string, string>, curr: any) => {
                if (curr.key) {
                    const cleanKey = curr.key.replace(/^custom\./, "");
                    acc[cleanKey] = curr.sampleValue || "Sample Custom Value";
                    acc[curr.key] = curr.sampleValue || "Sample Custom Value";
                }
                return acc;
            }, {}) || {},
        };

        const renderRes = await CertificatePdfService.renderCertificatePdf(design, snapshot);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'inline; filename="sample_certificate.pdf"');
        res.setHeader("X-Certificate-SHA256", renderRes.sha256Hash);

        return res.send(renderRes.pdfBuffer);
    } catch (err: any) {
        console.error("Preview certificate error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to generate preview." });
    }
});

/**
 * GET /api/club/certificates/:certificateId/preview
 * Returns authorized low-resolution vector SVG preview (Phase 15)
 * Supports ?blurred=true for spoiler preview without full PDF download.
 * Eliminates full PDF download overhead and sandbox memory strain.
 */
certificateRouter.get("/:certificateId/preview", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const certificateId = String(req.params.certificateId || "");
        const blurred = req.query.blurred === "true" || req.query.blurred === "1";

        const previewData = await CertificatePreviewService.getCertificatePreview(certificateId, blurred);
        if (!previewData) {
            return res.status(404).json({ success: false, message: "Certificate not found." });
        }

        // Strict CSP header for SVG to prevent SVG script execution (CWE-79)
        res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
        res.setHeader("Cache-Control", "private, max-age=1800");
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com"
        );
        res.setHeader("X-Content-Type-Options", "nosniff");

        return res.send(previewData.svg);
    } catch (err: any) {
        console.error("Certificate SVG preview error:", err);
        return res.status(500).json({ success: false, message: "Failed to render certificate preview." });
    }
});

/**
 * GET /api/club/certificates/:certificateId/preview-data
 * Returns structured metadata and vector preview SVG string for interactive reveal card (Phase 15)
 */
certificateRouter.get("/:certificateId/preview-data", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const certificateId = String(req.params.certificateId || "");
        const blurred = req.query.blurred === "true" || req.query.blurred === "1";

        const previewData = await CertificatePreviewService.getCertificatePreview(certificateId, blurred);
        if (!previewData) {
            return res.status(404).json({ success: false, message: "Certificate not found." });
        }

        const cert = previewData.cert;
        return res.json({
            success: true,
            certificate: {
                id: cert.id,
                credentialCode: cert.credential_code,
                title: cert.title,
                certificateType: cert.certificate_type,
                recipientName: cert.recipient_name,
                issueDate: cert.issue_date,
                clubName: cert.clubName,
                clubSlug: cert.clubSlug,
                clubLogoUrl: cert.clubLogoUrl,
                eventTitle: cert.eventTitle,
                sha256Hash: cert.sha256_hash,
                isRevoked: Boolean(cert.is_revoked),
                verificationUrl: `https://orbix.dev/verify/certificate/${cert.credential_code}`,
                downloadUrl: `/api/club/certificates/${cert.credential_code}/download`,
                previewUrl: `/api/club/certificates/${cert.credential_code}/preview`,
                previewBlurredUrl: `/api/club/certificates/${cert.credential_code}/preview?blurred=true`,
            },
            previewSvg: previewData.svg,
        });
    } catch (err: any) {
        console.error("Certificate preview-data error:", err);
        return res.status(500).json({ success: false, message: "Failed to load certificate preview data." });
    }
});

/**
 * GET /api/club/certificates/:certificateId/download
 * Renders or streams the authoritative high-resolution PDF for any issued certificate
 */
certificateRouter.get("/:certificateId/download", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { certificateId } = req.params;

        const certRes = await query(
            `SELECT
                c.id, c.club_id, c.title, c.certificate_type, c.recipient_name,
                c.credential_code, c.signer_name, c.signer_role, c.issue_date,
                c.design_snapshot, c.recipient_snapshot, c.description,
                vc.name AS "clubName", vc.slug AS "clubSlug", vc.college_name AS "collegeName",
                vc.logo_url AS "clubLogoUrl",
                e.title AS "eventTitle", e.starts_at AS "eventDate"
             FROM club_certificates c
             JOIN verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN club_events e ON e.id = c.event_id
             WHERE c.id = $1 OR LOWER(c.credential_code) = LOWER($1)
             LIMIT 1;`,
            [certificateId]
        );

        if (!certRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Certificate not found." });
        }

        const cert = certRes.rows[0];

        // Retrieve design: from design_snapshot, or fallback to first system template
        let design: any = cert.design_snapshot;
        if (!design || !design.elements || design.elements.length === 0) {
            const sysList = await CertificateTemplateService.getTemplates(cert.club_id);
            design = sysList.systemTemplates[0]?.design;
        }

        // Retrieve or build snapshot
        let snapshot: any = cert.recipient_snapshot;
        if (!snapshot || !snapshot.recipient) {
            snapshot = {
                recipient: {
                    id: cert.user_id,
                    name: cert.recipient_name,
                    username: "",
                    collegeName: cert.collegeName,
                },
                event: cert.eventTitle
                    ? {
                          title: cert.eventTitle,
                          date: cert.eventDate ? new Date(cert.eventDate).toLocaleDateString() : undefined,
                      }
                    : undefined,
                club: {
                    id: cert.club_id,
                    name: cert.clubName,
                    slug: cert.clubSlug,
                    collegeName: cert.collegeName,
                    logoUrl: cert.clubLogoUrl,
                },
                award: {
                    title: cert.title,
                    type: cert.certificate_type,
                    description: cert.description,
                },
                certificate: {
                    credentialCode: cert.credential_code,
                    issueDate: new Date(cert.issue_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    }),
                    verificationUrl: `https://orbix.dev/verify/certificate/${cert.credential_code}`,
                    signerName: cert.signer_name || cert.clubName,
                    signerRole: cert.signer_role || "Club Coordinator",
                },
            };
        }

        const renderRes = await CertificatePdfService.renderCertificatePdf(design, snapshot);

        const safeFilename = `${cert.credential_code || "certificate"}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
        res.setHeader("X-Certificate-SHA256", renderRes.sha256Hash);

        return res.send(renderRes.pdfBuffer);
    } catch (err: any) {
        console.error("Certificate download error:", err);
        return res.status(500).json({ success: false, message: "Failed to render PDF." });
    }
});

// =========================================================================
// 5. PUBLIC VERIFICATION & NOTIFICATION REVEAL
// =========================================================================

/**
 * GET /api/club/certificates/verify/:credentialCode
 * Enhanced public verification endpoint with audit count & SHA-256 digest
 */
/**
 * GET /api/club/certificates/verify/:credentialCode
 * Public verification endpoint with validity status (valid, revoked, superseded),
 * SHA-256 digest fingerprint, zero PII exposure, and version traceability.
 */
certificateRouter.get("/verify/:credentialCode", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { credentialCode } = req.params;
        const result = await CertificateVerificationService.verifyPublic(String(credentialCode));

        if (!result.verified || !result.certificate) {
            return res.status(404).json({
                success: false,
                verified: false,
                status: result.status,
                message: result.message,
            });
        }

        const cert = result.certificate;

        return res.json({
            success: true,
            verified: cert.status === "valid",
            status: cert.status,
            message: result.message,
            certificate: {
                credentialCode: cert.credentialCode,
                title: cert.title,
                certificateType: cert.certificateType,
                recipientName: cert.recipientName,
                achievement: cert.achievement,
                description: cert.description,
                issueDate: cert.issueDate,
                status: cert.status,
                version: cert.version,
                sha256Hash: cert.sha256Hash,
                isRevoked: cert.status === "revoked",
                revokedAt: cert.revokedAt,
                revocationReason: cert.revocationReason,
                supersededBy: cert.supersededBy,
                reissuedFrom: cert.reissuedFrom,
                signerName: cert.signerName,
                signerRole: cert.signerRole,
                verificationCount: cert.verificationCount,
                lastVerifiedAt: cert.lastVerifiedAt,
                signingMetadata: cert.signingMetadata,
                clubName: cert.issuingClub.name,
                clubSlug: cert.issuingClub.slug,
                collegeName: cert.issuingClub.collegeName,
                clubLogoUrl: cert.issuingClub.logoUrl,
                eventTitle: cert.event?.title || null,
                isTeam: cert.isTeam,
                teamName: cert.teamSnapshot?.teamName || null,
                teamMembers: cert.teamSnapshot?.members,
                memberCount: cert.teamSnapshot?.memberCount,
            },
        });
    } catch (err: any) {
        console.error("Verification error:", err);
        return res.status(500).json({ success: false, message: "Verification failed." });
    }
});

/**
 * GET /api/club/certificates/public/verify/:identifier
 * Canonical Phase 16 public verification route (supports opaque-id or credential-code)
 */
certificateRouter.get("/public/verify/:identifier", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { identifier } = req.params;
        const result = await CertificateVerificationService.verifyPublic(String(identifier));

        if (!result.verified) {
            return res.status(404).json(result);
        }

        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("Public verification error:", err);
        return res.status(500).json({ success: false, message: "Verification failed." });
    }
});

/**
 * POST /api/club/certificates/:certificateId/revoke
 * Officially revokes an issued certificate with mandatory reason and immutable audit log (Phase 16)
 */
certificateRouter.post("/:certificateId/revoke", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { certificateId } = req.params;
        const { reason } = req.body;

        const result = await CertificateVerificationService.revokeCertificate({
            certificateId: String(certificateId),
            clubId: club.id,
            staffUserId: req.user!.id,
            reason: reason || "Administrative revocation",
        });

        return res.json({
            message: "Certificate successfully revoked and recorded in audit ledger.",
            ...result,
        });
    } catch (err: any) {
        console.error("Revocation error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to revoke certificate." });
    }
});

/**
 * POST /api/club/certificates/:certificateId/reissue
 * Reissues a certificate: creates version N+1 and supersedes old record (Phase 16)
 */
certificateRouter.post("/:certificateId/reissue", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { certificateId } = req.params;
        const { recipientName, awardPosition, description, signerName, signerRole, reissueReason } = req.body;

        const result = await CertificateVerificationService.reissueCertificate({
            certificateId: String(certificateId),
            clubId: club.id,
            staffUserId: req.user!.id,
            updates: {
                recipientName,
                awardPosition,
                description,
                signerName,
                signerRole,
                reissueReason,
            },
        });

        return res.json({
            message: `Certificate successfully reissued to version ${result.newVersion}.`,
            ...result,
        });
    } catch (err: any) {
        console.error("Reissue error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to reissue certificate." });
    }
});

/**
 * GET /api/club/certificates/:certificateId/audit-history
 * Retrieves immutable audit history for an individual certificate
 */
certificateRouter.get("/:certificateId/audit-history", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { certificateId } = req.params;
        const history = await CertificateVerificationService.getAuditHistory(String(certificateId), club.id);

        return res.json({ success: true, auditHistory: history });
    } catch (err: any) {
        console.error("Fetch certificate audit history error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve audit history." });
    }
});

/**
 * GET /api/club/user/wallet
 * Returns student's Certificate Wallet collection (individual + authorized team credentials)
 */
certificateRouter.get("/user/wallet", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { clubId, eventId, status, category, query: searchQuery, isTeam, limit, offset } = req.query;

        const filterOpts: any = {};
        if (typeof clubId === "string") filterOpts.clubId = clubId;
        if (typeof eventId === "string") filterOpts.eventId = eventId;
        if (typeof status === "string") filterOpts.status = status;
        if (typeof category === "string") filterOpts.category = category;
        if (typeof searchQuery === "string") filterOpts.query = searchQuery;
        if (isTeam === "true") filterOpts.isTeam = true;
        if (isTeam === "false") filterOpts.isTeam = false;
        if (limit) filterOpts.limit = parseInt(limit as string, 10);
        if (offset) filterOpts.offset = parseInt(offset as string, 10);

        const walletData = await CertificateVerificationService.getUserWallet(userId, filterOpts);

        return res.json({ success: true, ...walletData });
    } catch (err: any) {
        console.error("Fetch student wallet error:", err);
        return res.status(500).json({ success: false, message: "Failed to load certificate wallet." });
    }
});

/**
 * GET /api/club/certificates/audit-logs
 * Retrieves immutable audit records for the club
 */
certificateRouter.get("/audit-logs", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const logsRes = await query(
            `SELECT
                l.id, l.action, l.entity_type AS "entityType", l.entity_id AS "entityId",
                l.metadata, l.created_at AS "createdAt",
                u.username AS "actorUsername",
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS "actorName"
             FROM certificate_audit_logs l
             LEFT JOIN users u ON u.id = l.actor_user_id
             WHERE l.club_id = $1
             ORDER BY l.created_at DESC
             LIMIT 100;`,
            [club.id]
        );

        return res.json({ success: true, auditLogs: logsRes.rows });
    } catch (err: any) {
        console.error("Fetch certificate audit logs error:", err);
        return res.status(500).json({ success: false, message: "Failed to load audit logs." });
    }
});

/**
 * POST /api/club/user/certificates/:certificateId/reveal
 * Marks certificate as revealed in student's notification (Phase 15)
 * Supports both single certificates and grouped batch notifications.
 * Records immutable reveal audit log in certificate_audit_logs.
 */
certificateRouter.post("/user/:certificateId/reveal", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const certificateId = String(req.params.certificateId || "");

        // Find matching notification: by direct certId, credentialCode, batchId, or inside grouped certificates array
        const notifRes = await query(
            `SELECT id, metadata, notification_type FROM user_notifications
             WHERE (user_id = $1 OR recipient_id = $1) AND (
                 metadata->>'certificateId' = $2 OR
                 LOWER(metadata->>'credentialCode') = LOWER($2) OR
                 idempotency_key = $3 OR
                 metadata->>'batchId' = $2 OR
                 idempotency_key LIKE 'cert-batch-' || $2 || '%' OR
                 metadata->'certificates' @> jsonb_build_array(jsonb_build_object('certificateId', $2::text)) OR
                 metadata->'certificates' @> jsonb_build_array(jsonb_build_object('credentialCode', $2::text))
             )
             ORDER BY created_at DESC
             LIMIT 1;`,
            [userId, certificateId, `cert-${certificateId}`]
        );

        const notif = notifRes.rows[0];
        let clubId: string | null = null;
        let revealedCertificate: any = null;

        if (notif) {
            const meta = notif.metadata || {};
            clubId = meta.clubId || null;

            if (meta.isGrouped && Array.isArray(meta.certificates)) {
                // Grouped batch notification: update status for matching certificate or all
                const updatedCerts = meta.certificates.map((c: any) => {
                    if (
                        certificateId === "all" ||
                        c.certificateId === certificateId ||
                        (c.credentialCode && c.credentialCode.toLowerCase() === certificateId.toLowerCase())
                    ) {
                        revealedCertificate = c;
                        return { ...c, isRevealed: true };
                    }
                    return c;
                });
                const allRevealed = updatedCerts.every((c: any) => c.isRevealed);
                await query(
                    `UPDATE user_notifications
                     SET metadata = jsonb_set(
                         jsonb_set(metadata, '{certificates}', $1::jsonb),
                         '{isRevealed}',
                         $2::jsonb
                     ), is_read = true, read_at = NOW()
                     WHERE id = $3;`,
                    [JSON.stringify(updatedCerts), JSON.stringify(allRevealed), notif.id]
                );
            } else {
                revealedCertificate = meta;
                await query(
                    `UPDATE user_notifications
                     SET metadata = jsonb_set(metadata, '{isRevealed}', 'true'::jsonb), is_read = true, read_at = NOW()
                     WHERE id = $1;`,
                    [notif.id]
                );
            }
        } else {
            // Fallback direct update by certificateId / idempotency key
            await query(
                `UPDATE user_notifications
                 SET metadata = jsonb_set(metadata, '{isRevealed}', 'true'::jsonb), is_read = true, read_at = NOW()
                 WHERE (user_id = $1 OR recipient_id = $1) AND (metadata->>'certificateId' = $2 OR idempotency_key = $3);`,
                [userId, certificateId, `cert-${certificateId}`]
            );
        }

        // Fetch certificate details for audit log and response if available
        const certDetailRes = await query(
            `SELECT c.id, c.club_id, c.credential_code, c.title, c.certificate_type, c.recipient_name, c.issue_date
             FROM club_certificates c
             WHERE c.id::text = $1 OR LOWER(c.credential_code) = LOWER($1)
             LIMIT 1;`,
            [certificateId]
        );
        if (certDetailRes.rows[0]) {
            const c = certDetailRes.rows[0];
            clubId = clubId || c.club_id;
            revealedCertificate = {
                id: c.id,
                credentialCode: c.credential_code,
                title: c.title,
                certificateType: c.certificate_type,
                recipientName: c.recipient_name,
                issueDate: c.issue_date,
            };
        }

        // Record audit log entry (Phase 17)
        if (clubId) {
            await query(
                `INSERT INTO certificate_audit_logs (
                    club_id, actor_user_id, action, entity_type, entity_id, metadata
                ) VALUES ($1, $2, 'certificate_revealed', 'certificate', $3, $4::jsonb);`,
                [clubId, userId, certificateId, JSON.stringify({ revealedAt: new Date().toISOString() })]
            );
        }

        return res.json({
            success: true,
            message: "Certificate revealed.",
            revealedId: certificateId,
            certificate: revealedCertificate,
        });
    } catch (err: any) {
        console.error("Reveal certificate error:", err);
        return res.status(500).json({ success: false, message: "Failed to reveal certificate." });
    }
});

/**
 * GET /api/club/certificates/claim/:claimToken
 * Retrieves claimable certificate summary for external recipients (Phase 11)
 */
certificateRouter.get("/claim/:claimToken", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const claimToken = String(req.params.claimToken || "");
        const details = await CertificateIssuanceService.getClaimDetails(claimToken);

        if (!details) {
            return res.status(404).json({
                success: false,
                message: "Certificate claim link is invalid or does not exist.",
            });
        }

        return res.json({ success: true, claim: details });
    } catch (err: any) {
        console.error("Get claim details error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve claim details." });
    }
});

/**
 * POST /api/club/certificates/claim/:claimToken
 * Authenticated claim action: links external certificate to logged-in user profile (Phase 11)
 */
certificateRouter.post("/claim/:claimToken", authenticate, async (req: Request, res: Response) => {
    try {
        const claimToken = String(req.params.claimToken || "");
        const userId = req.user!.id;

        const result = await CertificateIssuanceService.claimCertificate(claimToken, userId);

        return res.json({ success: true, ...result });
    } catch (err: any) {
        console.error("Claim certificate error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to claim certificate." });
    }
});

export default certificateRouter;
