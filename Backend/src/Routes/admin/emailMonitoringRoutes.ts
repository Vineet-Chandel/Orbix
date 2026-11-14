/**
 * Email Monitoring & DLQ Recovery Routes
 * Administrative API for observability, audit history, and manual recovery of failed emails.
 */
import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { query } from "../../database/client.js";
import { EmailDeliveryService, type EmailJobStatus } from "../../services/email/emailDeliveryService.js";
import { EmailDeadLetterService } from "../../services/email/emailDeadLetterService.js";
import { EmailQueueService } from "../../services/email/emailQueueService.js";

export const emailMonitoringRouter = Router();

/**
 * GET /api/admin/email/health
 * System health overview: Redis status, queue health, DLQ backlog count.
 */
emailMonitoringRouter.get("/health", authenticate, async (_req: Request, res: Response) => {
    try {
        const queueHealth = await EmailQueueService.getQueueHealth();

        const dlqCountRes = await query(
            `SELECT COUNT(*)::int AS total FROM public.email_dead_letters WHERE recovered_at IS NULL AND discarded = false;`
        );
        const unrecoveredDlq = dlqCountRes.rows[0]?.total || 0;

        const pendingRes = await query(
            `SELECT COUNT(*)::int AS total FROM public.email_delivery_jobs WHERE status IN ('PENDING', 'RETRY_WAIT');`
        );
        const pendingJobs = pendingRes.rows[0]?.total || 0;

        return res.json({
            success: true,
            status: unrecoveredDlq > 50 ? "DEGRADED" : "HEALTHY",
            queueHealth,
            metrics: {
                pendingJobs,
                unrecoveredDeadLetters: unrecoveredDlq,
            },
        });
    } catch (err: any) {
        console.error("GET /api/admin/email/health error:", err);
        return res.status(500).json({ success: false, message: "Failed to load email system health." });
    }
});

/**
 * GET /api/admin/email/queue/stats
 * Aggregated delivery metrics across all statuses and campaigns.
 */
emailMonitoringRouter.get("/queue/stats", authenticate, async (_req: Request, res: Response) => {
    try {
        const statsRes = await query(
            `SELECT
                status,
                COUNT(*)::int AS count
             FROM public.email_delivery_jobs
             GROUP BY status;`
        );

        const counts: Record<string, number> = {
            PENDING: 0,
            QUEUED: 0,
            PROCESSING: 0,
            RETRY_WAIT: 0,
            SENT: 0,
            DEAD_LETTER: 0,
            CANCELLED: 0,
        };

        for (const row of statsRes.rows || []) {
            counts[row.status] = row.count;
        }

        const queueCounts = await EmailQueueService.getQueueCounts();

        const campaignsRes = await query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
                COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS processing,
                COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
             FROM public.email_outbox_campaigns;`
        );

        return res.json({
            success: true,
            deliveryJobCounts: counts,
            redisQueueCounts: queueCounts,
            campaignSummary: campaignsRes.rows[0] || {},
        });
    } catch (err: any) {
        console.error("GET /api/admin/email/queue/stats error:", err);
        return res.status(500).json({ success: false, message: "Failed to load queue stats." });
    }
});

/**
 * GET /api/admin/email/jobs
 * Paginated list of delivery jobs with filters.
 */
emailMonitoringRouter.get("/jobs", authenticate, async (req: Request, res: Response) => {
    try {
        const status = req.query.status as EmailJobStatus | undefined;
        const emailType = req.query.emailType as string | undefined;
        const campaignId = req.query.campaignId as string | undefined;
        const recipient = req.query.recipient as string | undefined;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;

        const result = await EmailDeliveryService.listJobs({
            status,
            emailType,
            campaignId,
            recipient,
            page,
            limit,
        });

        return res.json({
            success: true,
            ...result,
        });
    } catch (err: any) {
        console.error("GET /api/admin/email/jobs error:", err);
        return res.status(500).json({ success: false, message: "Failed to list email jobs." });
    }
});

/**
 * GET /api/admin/email/jobs/:id
 * Single job details + complete attempt audit trail.
 */
emailMonitoringRouter.get("/jobs/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const job = await EmailDeliveryService.getJobById(id);
        if (!job) {
            return res.status(404).json({ success: false, message: "Email job not found." });
        }

        const attemptsRes = await query(
            `SELECT * FROM public.email_delivery_attempts
             WHERE job_id = $1::uuid
             ORDER BY attempt_number ASC;`,
            [id]
        );

        return res.json({
            success: true,
            job,
            attempts: attemptsRes.rows || [],
        });
    } catch (err: any) {
        console.error(`GET /api/admin/email/jobs/${req.params.id} error:`, err);
        return res.status(500).json({ success: false, message: "Failed to load job details." });
    }
});

/**
 * GET /api/admin/email/dead-letters
 * Paginated list of DLQ records with filters.
 */
emailMonitoringRouter.get("/dead-letters", authenticate, async (req: Request, res: Response) => {
    try {
        const failureCategory = req.query.category as string | undefined;
        const recipient = req.query.recipient as string | undefined;
        const recovered = req.query.recovered ? req.query.recovered === "true" : undefined;
        const discarded = req.query.discarded ? req.query.discarded === "true" : undefined;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;

        const result = await EmailDeadLetterService.listDeadLetters({
            failureCategory,
            recipient,
            recovered,
            discarded,
            page,
            limit,
        });

        return res.json({
            success: true,
            ...result,
        });
    } catch (err: any) {
        console.error("GET /api/admin/email/dead-letters error:", err);
        return res.status(500).json({ success: false, message: "Failed to list dead letters." });
    }
});

/**
 * GET /api/admin/email/dead-letters/:id
 * Single DLQ record diagnostic details.
 */
emailMonitoringRouter.get("/dead-letters/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const deadLetter = await EmailDeadLetterService.getDeadLetterById(id);
        if (!deadLetter) {
            return res.status(404).json({ success: false, message: "Dead letter entry not found." });
        }

        return res.json({
            success: true,
            deadLetter,
        });
    } catch (err: any) {
        console.error(`GET /api/admin/email/dead-letters/${req.params.id} error:`, err);
        return res.status(500).json({ success: false, message: "Failed to load dead letter details." });
    }
});

/**
 * POST /api/admin/email/dead-letters/:id/retry
 * Re-queues a failed email for delivery with fresh attempt budget.
 */
emailMonitoringRouter.post("/dead-letters/:id/retry", authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const adminUserId = req.user?.id;

        const result = await EmailDeadLetterService.retryDeadLetter(id, adminUserId);
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (err: any) {
        console.error(`POST /api/admin/email/dead-letters/${req.params.id}/retry error:`, err);
        return res.status(500).json({ success: false, message: "Failed to retry dead letter." });
    }
});

/**
 * POST /api/admin/email/dead-letters/bulk-retry
 * Bulk re-queues unrecovered dead letters by category.
 */
emailMonitoringRouter.post("/dead-letters/bulk-retry", authenticate, async (req: Request, res: Response) => {
    try {
        const { category, limit = 50 } = req.body || {};
        const adminUserId = req.user?.id;

        const whereSql = category ? `WHERE failure_category = $1 AND recovered_at IS NULL AND discarded = false` : `WHERE recovered_at IS NULL AND discarded = false`;
        const params = category ? [category, limit] : [limit];
        const limitSql = category ? `LIMIT $2` : `LIMIT $1`;

        const candidatesRes = await query(
            `SELECT id FROM public.email_dead_letters ${whereSql} ORDER BY failed_at ASC ${limitSql};`,
            params
        );

        const candidates = candidatesRes.rows || [];
        let retriedCount = 0;

        for (const c of candidates) {
            const ret = await EmailDeadLetterService.retryDeadLetter(c.id, adminUserId);
            if (ret.success) retriedCount++;
        }

        return res.json({
            success: true,
            message: `Successfully re-queued ${retriedCount} of ${candidates.length} candidate dead letters.`,
            retriedCount,
        });
    } catch (err: any) {
        console.error("POST /api/admin/email/dead-letters/bulk-retry error:", err);
        return res.status(500).json({ success: false, message: "Failed to bulk retry dead letters." });
    }
});

/**
 * POST /api/admin/email/dead-letters/:id/discard
 * Marks a dead letter as permanently discarded.
 */
emailMonitoringRouter.post("/dead-letters/:id/discard", authenticate, async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { reason = "Discarded by admin" } = req.body || {};
        const adminUserId = req.user?.id;

        const result = await EmailDeadLetterService.discardDeadLetter(id, reason, adminUserId);
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json(result);
    } catch (err: any) {
        console.error(`POST /api/admin/email/dead-letters/${req.params.id}/discard error:`, err);
        return res.status(500).json({ success: false, message: "Failed to discard dead letter." });
    }
});
