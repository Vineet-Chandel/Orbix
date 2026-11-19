/**
 * Email Dead Letter Service
 * Dedicated service for managing and recovering permanently failed emails (DLQ).
 */
import { query } from "../../database/client.js";

export interface InsertDeadLetterParams {
    originalJobId?: string | null | undefined;
    idempotencyKey: string;
    campaignId?: string | null | undefined;
    eventId?: string | null | undefined;
    userId?: string | null | undefined;
    recipientEmail: string;
    emailType: string;
    subject?: string | null | undefined;
    payload?: Record<string, any> | undefined;
    failureStage: string;
    failureCategory: string;
    errorCode?: string | null | undefined;
    errorMessage?: string | null | undefined;
    errorStack?: string | null | undefined;
    totalAttempts: number;
    firstAttemptAt?: string | null | undefined;
    lastAttemptAt?: string | null | undefined;
    provider?: string | null | undefined;
    providerMessageId?: string | null | undefined;
    providerResponse?: Record<string, any> | undefined;
}

export interface EmailDeadLetter {
    id: string;
    originalJobId: string | null;
    idempotencyKey: string;
    campaignId: string | null;
    eventId: string | null;
    userId: string | null;
    recipientEmail: string;
    emailType: string;
    subject: string | null;
    payload: Record<string, any> | null;
    failureStage: string;
    failureCategory: string;
    errorCode: string | null;
    errorMessage: string | null;
    errorStack: string | null;
    totalAttempts: number;
    firstAttemptAt: string | null;
    lastAttemptAt: string | null;
    failedAt: string;
    provider: string | null;
    providerMessageId: string | null;
    providerResponse: Record<string, any> | null;
    recoveredAt: string | null;
    recoveredBy: string | null;
    discarded: boolean;
    discardedAt: string | null;
    discardedReason: string | null;
    createdAt: string;
    updatedAt: string;
}

export class EmailDeadLetterService {
    /**
     * Inserts a record into the Dead Letter Queue.
     */
    static async insertDeadLetter(params: InsertDeadLetterParams): Promise<EmailDeadLetter | null> {
        try {
            const res = await query(
                `INSERT INTO public.email_dead_letters (
                    original_job_id,
                    idempotency_key,
                    campaign_id,
                    event_id,
                    user_id,
                    recipient_email,
                    email_type,
                    subject,
                    payload,
                    failure_stage,
                    failure_category,
                    error_code,
                    error_message,
                    error_stack,
                    total_attempts,
                    first_attempt_at,
                    last_attempt_at,
                    failed_at,
                    provider,
                    provider_message_id,
                    provider_response,
                    created_at,
                    updated_at
                ) VALUES (
                    $1::uuid,
                    $2,
                    $3::uuid,
                    $4::uuid,
                    $5::uuid,
                    $6,
                    $7,
                    $8,
                    $9::jsonb,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    now(),
                    $18,
                    $19,
                    $20::jsonb,
                    now(),
                    now()
                )
                ON CONFLICT (idempotency_key) DO UPDATE
                SET total_attempts = EXCLUDED.total_attempts,
                    last_attempt_at = EXCLUDED.last_attempt_at,
                    error_message = EXCLUDED.error_message,
                    updated_at = now()
                RETURNING *;`,
                [
                    params.originalJobId || null,
                    params.idempotencyKey,
                    params.campaignId || null,
                    params.eventId || null,
                    params.userId || null,
                    params.recipientEmail.trim().toLowerCase(),
                    params.emailType,
                    params.subject || null,
                    params.payload ? JSON.stringify(params.payload) : null,
                    params.failureStage,
                    params.failureCategory,
                    params.errorCode || null,
                    params.errorMessage || null,
                    params.errorStack || null,
                    params.totalAttempts,
                    params.firstAttemptAt || null,
                    params.lastAttemptAt || null,
                    params.provider || null,
                    params.providerMessageId || null,
                    params.providerResponse ? JSON.stringify(params.providerResponse) : null,
                ]
            );

            return res.rows[0] ? this.mapRowToDeadLetter(res.rows[0]) : null;
        } catch (err: any) {
            console.error(`[EmailDeadLetterService.insertDeadLetter] Error inserting DLQ record:`, err.message);
            return null;
        }
    }

    /**
     * Safely retries a dead-lettered email by re-queueing the underlying job
     * with reset attempt budget and marking the DLQ record recovered.
     */
    static async retryDeadLetter(deadLetterId: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
        const dlqRes = await query(
            `SELECT * FROM public.email_dead_letters WHERE id = $1::uuid LIMIT 1;`,
            [deadLetterId]
        );

        if (!dlqRes.rows[0]) {
            return { success: false, message: "Dead letter entry not found." };
        }

        const dlq = this.mapRowToDeadLetter(dlqRes.rows[0]);

        if (dlq.recoveredAt) {
            return { success: false, message: "This email has already been recovered and re-queued." };
        }

        if (dlq.discarded) {
            return { success: false, message: "This email was marked as permanently discarded." };
        }

        if (dlq.originalJobId) {
            // Re-arm the original job in email_delivery_jobs
            await query(
                `UPDATE public.email_delivery_jobs
                 SET status = 'PENDING',
                     attempts = 0,
                     next_attempt_at = now(),
                     failed_at = NULL,
                     last_error = CONCAT('Manually re-queued by admin: ', COALESCE($2::text, 'system')),
                     locked_by = NULL,
                     locked_at = NULL,
                     updated_at = now()
                 WHERE id = $1::uuid;`,
                [dlq.originalJobId, adminUserId || null]
            );
        }

        // Mark DLQ entry as recovered
        await query(
            `UPDATE public.email_dead_letters
             SET recovered_at = now(),
                 recovered_by = $2::uuid,
                 updated_at = now()
             WHERE id = $1::uuid;`,
            [deadLetterId, adminUserId || null]
        );

        return { success: true, message: `Dead letter successfully recovered and re-queued for delivery.` };
    }

    /**
     * Marks a dead letter as permanently discarded.
     */
    static async discardDeadLetter(deadLetterId: string, reason: string, adminUserId?: string): Promise<{ success: boolean; message: string }> {
        const res = await query(
            `UPDATE public.email_dead_letters
             SET discarded = true,
                 discarded_at = now(),
                 discarded_reason = $2,
                 recovered_by = $3::uuid,
                 updated_at = now()
             WHERE id = $1::uuid AND discarded = false
             RETURNING id;`,
            [deadLetterId, reason, adminUserId || null]
        );

        if (!res.rows[0]) {
            return { success: false, message: "Dead letter not found or already discarded." };
        }

        return { success: true, message: "Dead letter marked as permanently discarded." };
    }

    /**
     * Lists dead letter records with optional filters.
     */
    static async listDeadLetters(options?: {
        failureCategory?: string | undefined;
        recipient?: string | undefined;
        recovered?: boolean | undefined;
        discarded?: boolean | undefined;
        page?: number | undefined;
        limit?: number | undefined;
    }): Promise<{ items: EmailDeadLetter[]; total: number; page: number; totalPages: number }> {
        const page = Math.max(1, options?.page || 1);
        const limit = Math.min(100, Math.max(1, options?.limit || 20));
        const offset = (page - 1) * limit;

        const whereClauses: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        if (options?.failureCategory) {
            whereClauses.push(`failure_category = $${paramIdx++}`);
            params.push(options.failureCategory);
        }
        if (options?.recipient) {
            whereClauses.push(`recipient_email ILIKE $${paramIdx++}`);
            params.push(`%${options.recipient.trim()}%`);
        }
        if (options?.recovered !== undefined) {
            if (options.recovered) {
                whereClauses.push(`recovered_at IS NOT NULL`);
            } else {
                whereClauses.push(`recovered_at IS NULL`);
            }
        }
        if (options?.discarded !== undefined) {
            whereClauses.push(`discarded = $${paramIdx++}`);
            params.push(options.discarded);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

        const countRes = await query(
            `SELECT COUNT(*)::int AS total FROM public.email_dead_letters ${whereSql};`,
            params
        );
        const total = countRes.rows[0]?.total || 0;

        params.push(limit);
        params.push(offset);
        const rowsRes = await query(
            `SELECT * FROM public.email_dead_letters
             ${whereSql}
             ORDER BY failed_at DESC
             LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
            params
        );

        return {
            items: rowsRes.rows.map((r: any) => this.mapRowToDeadLetter(r)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Fetches dead letter by ID (validates UUID format safely).
     */
    static async getDeadLetterById(id: string): Promise<EmailDeadLetter | null> {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        if (!isUuid) return null;
        const res = await query(
            `SELECT * FROM public.email_dead_letters WHERE id = $1::uuid LIMIT 1;`,
            [id]
        );
        return res.rows[0] ? this.mapRowToDeadLetter(res.rows[0]) : null;
    }

    /**
     * Fetches dead letter by its unique idempotency key.
     */
    static async getDeadLetterByIdempotencyKey(key: string): Promise<EmailDeadLetter | null> {
        const res = await query(
            `SELECT * FROM public.email_dead_letters WHERE idempotency_key = $1 LIMIT 1;`,
            [key]
        );
        return res.rows[0] ? this.mapRowToDeadLetter(res.rows[0]) : null;
    }

    private static mapRowToDeadLetter(r: any): EmailDeadLetter {
        return {
            id: r.id,
            originalJobId: r.original_job_id,
            idempotencyKey: r.idempotency_key,
            campaignId: r.campaign_id,
            eventId: r.event_id,
            userId: r.user_id,
            recipientEmail: r.recipient_email,
            emailType: r.email_type,
            subject: r.subject,
            payload: r.payload,
            failureStage: r.failure_stage,
            failureCategory: r.failure_category,
            errorCode: r.error_code,
            errorMessage: r.error_message,
            errorStack: r.error_stack,
            totalAttempts: r.total_attempts,
            firstAttemptAt: r.first_attempt_at,
            lastAttemptAt: r.last_attempt_at,
            failedAt: r.failed_at,
            provider: r.provider,
            providerMessageId: r.provider_message_id,
            providerResponse: r.provider_response,
            recoveredAt: r.recovered_at,
            recoveredBy: r.recovered_by,
            discarded: Boolean(r.discarded),
            discardedAt: r.discarded_at,
            discardedReason: r.discarded_reason,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}
