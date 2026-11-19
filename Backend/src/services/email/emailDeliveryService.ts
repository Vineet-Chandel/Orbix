/**
 * Email Delivery Service
 * Manages the persistent PostgreSQL state machine for all individual recipient email jobs
 * and maintains the audit trail of delivery attempts.
 */
import { query } from "../../database/client.js";
import { calculateNextAttemptDate, getEmailRetryConfig } from "./emailRetryService.js";
import { classifyEmailError, type ClassifiedEmailError } from "./emailErrorClassifier.js";
import { EmailDeadLetterService } from "./emailDeadLetterService.js";

export type EmailJobPriority = "HIGH" | "NORMAL" | "LOW";
export type EmailJobStatus =
    | "PENDING"
    | "QUEUED"
    | "PROCESSING"
    | "RETRY_WAIT"
    | "SENT"
    | "DEAD_LETTER"
    | "CANCELLED";

export interface CreateDeliveryJobParams {
    campaignId?: string | null | undefined;
    eventId?: string | null | undefined;
    userId?: string | null | undefined;
    recipientEmail: string;
    recipientName?: string | null | undefined;
    subject: string;
    htmlBody: string;
    textBody?: string | null | undefined;
    emailType: string;
    priority?: EmailJobPriority | undefined;
    idempotencyKey: string;
    metadata?: Record<string, any> | undefined;
    maxAttempts?: number | undefined;
}

export interface EmailDeliveryJob {
    id: string;
    campaignId: string | null;
    eventId: string | null;
    userId: string | null;
    recipientEmail: string;
    recipientName: string | null;
    subject: string;
    htmlBody: string;
    textBody: string | null;
    emailType: string;
    priority: EmailJobPriority;
    status: EmailJobStatus;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt: string;
    lastAttemptAt: string | null;
    sentAt: string | null;
    failedAt: string | null;
    provider: string | null;
    providerMessageId: string | null;
    idempotencyKey: string;
    metadata: Record<string, any>;
    errorCategory: string | null;
    lastError: string | null;
    lockedBy: string | null;
    lockedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export class EmailDeliveryService {
    /**
     * Creates a new delivery job in PostgreSQL.
     * Enforces idempotency via ON CONFLICT (idempotency_key) DO NOTHING.
     */
    static async createDeliveryJob(params: CreateDeliveryJobParams): Promise<{ job: EmailDeliveryJob; isNew: boolean }> {
        const config = getEmailRetryConfig();
        const maxAttempts = params.maxAttempts || config.maxAttempts;
        const priority = params.priority || "NORMAL";
        const metadataJson = JSON.stringify(params.metadata || {});

        const insertRes = await query(
            `INSERT INTO public.email_delivery_jobs (
                campaign_id,
                event_id,
                user_id,
                recipient_email,
                recipient_name,
                subject,
                html_body,
                text_body,
                email_type,
                priority,
                status,
                attempts,
                max_attempts,
                next_attempt_at,
                idempotency_key,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                $1::uuid,
                $2::uuid,
                $3::uuid,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                'PENDING',
                0,
                $11,
                now(),
                $12,
                $13::jsonb,
                now(),
                now()
            )
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING *;`,
            [
                params.campaignId || null,
                params.eventId || null,
                params.userId || null,
                params.recipientEmail.trim().toLowerCase(),
                params.recipientName || null,
                params.subject,
                params.htmlBody,
                params.textBody || null,
                params.emailType,
                priority,
                maxAttempts,
                params.idempotencyKey,
                metadataJson,
            ]
        );

        if (insertRes.rows[0]) {
            return { job: this.mapRowToJob(insertRes.rows[0]), isNew: true };
        }

        // Job already exists for this idempotency key — fetch and return it safely
        const existing = await query(
            `SELECT * FROM public.email_delivery_jobs WHERE idempotency_key = $1 LIMIT 1;`,
            [params.idempotencyKey]
        );

        return { job: this.mapRowToJob(existing.rows[0]), isNew: false };
    }

    /**
     * Atomically claims a job for processing by a specific worker.
     */
    static async claimJob(jobId: string, workerId: string): Promise<boolean> {
        const res = await query(
            `UPDATE public.email_delivery_jobs
             SET status = 'PROCESSING',
                 locked_by = $2,
                 locked_at = now(),
                 updated_at = now()
             WHERE id = $1::uuid
               AND status IN ('PENDING', 'QUEUED', 'RETRY_WAIT')
             RETURNING id;`,
            [jobId, workerId]
        );
        return Boolean(res.rows[0]);
    }

    /**
     * Records a delivery attempt in the audit table.
     */
    static async recordAttempt(params: {
        jobId: string;
        attemptNumber: number;
        workerId: string;
        startedAt: Date;
        completedAt: Date;
        durationMs: number;
        status: "SUCCESS" | "TRANSIENT_FAILURE" | "PERMANENT_FAILURE" | "SYSTEMIC_FAILURE";
        provider?: string | undefined;
        providerMessageId?: string | undefined;
        providerResponse?: Record<string, any> | undefined;
        errorCategory?: string | undefined;
        errorCode?: string | undefined;
        errorMessage?: string | undefined;
        nextRetryAt?: Date | undefined;
    }): Promise<void> {
        try {
            await query(
                `INSERT INTO public.email_delivery_attempts (
                    job_id,
                    attempt_number,
                    worker_id,
                    started_at,
                    completed_at,
                    duration_ms,
                    status,
                    provider,
                    provider_message_id,
                    provider_response,
                    error_category,
                    error_code,
                    error_message,
                    next_retry_at,
                    created_at
                ) VALUES (
                    $1::uuid,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10::jsonb,
                    $11,
                    $12,
                    $13,
                    $14,
                    now()
                );`,
                [
                    params.jobId,
                    params.attemptNumber,
                    params.workerId,
                    params.startedAt,
                    params.completedAt,
                    params.durationMs,
                    params.status,
                    params.provider || null,
                    params.providerMessageId || null,
                    params.providerResponse ? JSON.stringify(params.providerResponse) : null,
                    params.errorCategory || null,
                    params.errorCode || null,
                    params.errorMessage || null,
                    params.nextRetryAt || null,
                ]
            );
        } catch (err: any) {
            if (err?.code === "23503") {
                console.warn(`[EmailDeliveryService.recordAttempt] Job ${params.jobId} was deleted from database; skipping attempt record.`);
                return;
            }
            console.error(`[EmailDeliveryService.recordAttempt] Failed to record attempt for job ${params.jobId}:`, err.message);
        }
    }

    /**
     * Marks a job as successfully sent.
     */
    static async markSuccess(jobId: string, provider: string, providerMessageId?: string | null): Promise<void> {
        const res = await query(
            `UPDATE public.email_delivery_jobs
             SET status = 'SENT',
                 sent_at = now(),
                 last_attempt_at = now(),
                 attempts = attempts + 1,
                 provider = $2,
                 provider_message_id = $3,
                 locked_by = NULL,
                 locked_at = NULL,
                 updated_at = now()
             WHERE id = $1::uuid
             RETURNING campaign_id;`,
            [jobId, provider, providerMessageId || null]
        );

        if (!res.rows[0]) {
            console.warn(`[EmailDeliveryService.markSuccess] Job ${jobId} was deleted from database; status update skipped.`);
            return;
        }

        const campaignId = res.rows[0].campaign_id;
        if (campaignId) {
            await query(
                `UPDATE public.email_outbox_campaigns
                 SET processed_recipients = processed_recipients + 1,
                     successful_recipients = successful_recipients + 1,
                     updated_at = now()
                 WHERE id = $1::uuid;`,
                [campaignId]
            );
        }
    }

    /**
     * Marks a job failure, scheduling exponential backoff or moving to DLQ.
     */
    static async markFailure(
        jobId: string,
        rawError: any,
        workerId: string,
        attemptNumber: number
    ): Promise<{ nextStatus: EmailJobStatus; isDeadLetter: boolean }> {
        const classified: ClassifiedEmailError = classifyEmailError(rawError);

        const currentJobRes = await query(
            `SELECT * FROM public.email_delivery_jobs WHERE id = $1::uuid LIMIT 1;`,
            [jobId]
        );

        if (!currentJobRes.rows[0]) {
            return { nextStatus: "DEAD_LETTER", isDeadLetter: true };
        }

        const job = this.mapRowToJob(currentJobRes.rows[0]);
        const nextAttemptNumber = attemptNumber > 0 ? attemptNumber : job.attempts + 1;
        const maxAttemptsExceeded = nextAttemptNumber >= job.maxAttempts;

        if (classified.isRetryable && !maxAttemptsExceeded) {
            // Schedule Retry with Exponential Backoff + Jitter
            const nextAttemptDate = calculateNextAttemptDate(nextAttemptNumber);

            await query(
                `UPDATE public.email_delivery_jobs
                 SET status = 'RETRY_WAIT',
                     attempts = $2,
                     next_attempt_at = $3,
                     last_attempt_at = now(),
                     error_category = $4,
                     last_error = $5,
                     locked_by = NULL,
                     locked_at = NULL,
                     updated_at = now()
                 WHERE id = $1::uuid;`,
                [jobId, nextAttemptNumber, nextAttemptDate, classified.category, classified.message]
            );

            return { nextStatus: "RETRY_WAIT", isDeadLetter: false };
        }

        // Permanent Failure or Attempts Exhausted -> Move to Dead Letter Queue (DLQ)
        await query(
            `UPDATE public.email_delivery_jobs
             SET status = 'DEAD_LETTER',
                 attempts = $2,
                 failed_at = now(),
                 last_attempt_at = now(),
                 error_category = $3,
                 last_error = $4,
                 locked_by = NULL,
                 locked_at = NULL,
                 updated_at = now()
             WHERE id = $1::uuid;`,
            [jobId, nextAttemptNumber, classified.category, classified.message]
        );

        // Insert into dedicated email_dead_letters table
        await EmailDeadLetterService.insertDeadLetter({
            originalJobId: job.id,
            idempotencyKey: `dlq-${job.idempotencyKey}`,
            campaignId: job.campaignId,
            eventId: job.eventId,
            userId: job.userId,
            recipientEmail: job.recipientEmail,
            emailType: job.emailType,
            subject: job.subject,
            payload: {
                htmlBody: job.htmlBody,
                textBody: job.textBody,
                metadata: job.metadata,
            },
            failureStage: "WORKER_DISPATCH",
            failureCategory: classified.category,
            errorCode: classified.code,
            errorMessage: classified.message,
            errorStack: classified.stack,
            totalAttempts: nextAttemptNumber,
            firstAttemptAt: job.createdAt,
            lastAttemptAt: new Date().toISOString(),
            provider: job.provider,
            providerResponse: classified.providerDetails,
        });

        if (job.campaignId) {
            await query(
                `UPDATE public.email_outbox_campaigns
                 SET processed_recipients = processed_recipients + 1,
                     failed_recipients = failed_recipients + 1,
                     updated_at = now()
                 WHERE id = $1::uuid;`,
                [job.campaignId]
            );
        }

        return { nextStatus: "DEAD_LETTER", isDeadLetter: true };
    }

    /**
     * Fetches job by ID (validates UUID format safely).
     */
    static async getJobById(jobId: string): Promise<EmailDeliveryJob | null> {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId);
        if (!isUuid) return null;
        const res = await query(
            `SELECT * FROM public.email_delivery_jobs WHERE id = $1::uuid LIMIT 1;`,
            [jobId]
        );
        return res.rows[0] ? this.mapRowToJob(res.rows[0]) : null;
    }

    /**
     * Lists jobs with optional filtering.
     */
    static async listJobs(options?: {
        status?: EmailJobStatus | undefined;
        emailType?: string | undefined;
        campaignId?: string | undefined;
        recipient?: string | undefined;
        page?: number | undefined;
        limit?: number | undefined;
    }): Promise<{ jobs: EmailDeliveryJob[]; total: number; page: number; totalPages: number }> {
        const page = Math.max(1, options?.page || 1);
        const limit = Math.min(100, Math.max(1, options?.limit || 20));
        const offset = (page - 1) * limit;

        const whereClauses: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        if (options?.status) {
            whereClauses.push(`status = $${paramIdx++}`);
            params.push(options.status);
        }
        if (options?.emailType) {
            whereClauses.push(`email_type = $${paramIdx++}`);
            params.push(options.emailType);
        }
        if (options?.campaignId) {
            whereClauses.push(`campaign_id = $${paramIdx++}::uuid`);
            params.push(options.campaignId);
        }
        if (options?.recipient) {
            whereClauses.push(`recipient_email ILIKE $${paramIdx++}`);
            params.push(`%${options.recipient.trim()}%`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const countRes = await query(
            `SELECT COUNT(*)::int AS total FROM public.email_delivery_jobs ${whereSql};`,
            params
        );
        const total = countRes.rows[0]?.total || 0;

        params.push(limit);
        params.push(offset);
        const rowsRes = await query(
            `SELECT * FROM public.email_delivery_jobs
             ${whereSql}
             ORDER BY created_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
            params
        );

        return {
            jobs: rowsRes.rows.map((r: any) => this.mapRowToJob(r)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    private static mapRowToJob(r: any): EmailDeliveryJob {
        return {
            id: r.id,
            campaignId: r.campaign_id,
            eventId: r.event_id,
            userId: r.user_id,
            recipientEmail: r.recipient_email,
            recipientName: r.recipient_name,
            subject: r.subject,
            htmlBody: r.html_body,
            textBody: r.text_body,
            emailType: r.email_type,
            priority: r.priority,
            status: r.status,
            attempts: r.attempts,
            maxAttempts: r.max_attempts,
            nextAttemptAt: r.next_attempt_at,
            lastAttemptAt: r.last_attempt_at,
            sentAt: r.sent_at,
            failedAt: r.failed_at,
            provider: r.provider,
            providerMessageId: r.provider_message_id,
            idempotencyKey: r.idempotency_key,
            metadata: r.metadata || {},
            errorCategory: r.error_category,
            lastError: r.last_error,
            lockedBy: r.locked_by,
            lockedAt: r.locked_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}
