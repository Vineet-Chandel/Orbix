// Backend/src/services/notification/quotaService.ts
import { pool, query } from "../../database/client.js";
import { relationshipEvents } from "../relationship/relationshipEvents.js";

export const MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H = 3;
export const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

export interface QuotaCheckResult {
    allowed: boolean;
    remainingQuota: number;
    currentCount: number;
    retryAfterSeconds?: number;
    nextResetAt?: Date;
}

export interface DispatchNotificationOptions {
    recipientId: string;
    actorId: string | null;
    title: string;
    body: string;
    notificationType: string;
    relationshipId?: string | null;
    metadata?: Record<string, any>;
    idempotencyKey?: string | null;
    isUserInitiated?: boolean;
}

/**
 * Generates a 64-bit integer advisory lock key based on actor and recipient UUIDs
 */
function getPairAdvisoryLockKey(actorId: string, recipientId: string): string {
    const combined = [actorId, recipientId].sort().join("-");
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
}

/**
 * Checks rolling 24-hour quota for user-initiated notifications between actor and recipient.
 */
export async function checkNotificationQuota(
    actorId: string,
    recipientId: string
): Promise<QuotaCheckResult> {
    const windowStart = new Date(Date.now() - NOTIFICATION_WINDOW_MS);

    // Query active count within the rolling window and the oldest notification timestamp in window
    const result = await query(
        `SELECT
            COUNT(*)::int AS count,
            MIN(created_at) AS oldest_in_window
         FROM user_notifications
         WHERE actor_id = $1
           AND recipient_id = $2
           AND is_user_initiated = true
           AND created_at > $3;`,
        [actorId, recipientId, windowStart]
    );

    const count = result.rows[0]?.count ?? 0;
    const oldestInWindow = result.rows[0]?.oldest_in_window ? new Date(result.rows[0].oldest_in_window) : null;

    if (count >= MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H) {
        const nextResetAt = oldestInWindow
            ? new Date(oldestInWindow.getTime() + NOTIFICATION_WINDOW_MS)
            : new Date(Date.now() + NOTIFICATION_WINDOW_MS);
        const retryAfterSeconds = Math.max(1, Math.ceil((nextResetAt.getTime() - Date.now()) / 1000));

        return {
            allowed: false,
            remainingQuota: 0,
            currentCount: count,
            retryAfterSeconds,
            nextResetAt,
        };
    }

    return {
        allowed: true,
        remainingQuota: MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H - count,
        currentCount: count,
    };
}

/**
 * Atomically dispatches a notification with rate-limit and idempotency guarantees.
 * Uses a PostgreSQL transaction with an advisory lock on the (actor, recipient) pair
 * to eliminate race conditions under concurrent requests.
 */
export async function dispatchNotification(opts: DispatchNotificationOptions): Promise<{
    success: boolean;
    notification?: any;
    error?: string;
    code?: string;
    retryAfterSeconds?: number;
}> {
    const client = await pool.connect();

    try {
        await client.query("BEGIN;");

        // 1. Idempotency Check
        if (opts.idempotencyKey) {
            const existingRes = await client.query(
                `SELECT * FROM user_notifications WHERE idempotency_key = $1 LIMIT 1;`,
                [opts.idempotencyKey]
            );
            if (existingRes.rows.length > 0) {
                await client.query("COMMIT;");
                return {
                    success: true,
                    notification: existingRes.rows[0],
                };
            }
        }

        // 2. Rate limiting check for user-initiated notifications
        if (opts.isUserInitiated && opts.actorId) {
            // Acquire transaction-scoped advisory lock for pair
            const lockHash = getPairAdvisoryLockKey(opts.actorId, opts.recipientId);
            await client.query(`SELECT pg_advisory_xact_lock($1::bigint);`, [lockHash]);

            const windowStart = new Date(Date.now() - NOTIFICATION_WINDOW_MS);
            const countRes = await client.query(
                `SELECT
                    COUNT(*)::int AS count,
                    MIN(created_at) AS oldest_in_window
                 FROM user_notifications
                 WHERE actor_id = $1
                   AND recipient_id = $2
                   AND is_user_initiated = true
                   AND created_at > $3;`,
                [opts.actorId, opts.recipientId, windowStart]
            );

            const count = countRes.rows[0]?.count ?? 0;
            if (count >= MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H) {
                const oldestInWindow = countRes.rows[0]?.oldest_in_window ? new Date(countRes.rows[0].oldest_in_window) : null;
                const nextResetAt = oldestInWindow
                    ? new Date(oldestInWindow.getTime() + NOTIFICATION_WINDOW_MS)
                    : new Date(Date.now() + NOTIFICATION_WINDOW_MS);
                const retryAfterSeconds = Math.max(1, Math.ceil((nextResetAt.getTime() - Date.now()) / 1000));

                await client.query("ROLLBACK;");

                relationshipEvents.logEvent("notification_limit_reached", {
                    actorId: opts.actorId,
                    targetUserId: opts.recipientId,
                    metadata: { count, retryAfterSeconds },
                });

                return {
                    success: false,
                    code: "NOTIFICATION_LIMIT_REACHED",
                    error: `Notification limit reached for this user (maximum ${MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H} notifications per 24-hour rolling window).`,
                    retryAfterSeconds,
                };
            }
        }

        // 3. Resolve recipient username for backwards compatibility
        const userRes = await client.query(
            `SELECT username, email FROM users WHERE id = $1 LIMIT 1;`,
            [opts.recipientId]
        );
        const recipientUsername = userRes.rows[0]?.username || userRes.rows[0]?.email || "user";

        // 4. Insert notification
        const insertRes = await client.query(
            `INSERT INTO user_notifications (
                recipient_id,
                user_id,
                username,
                actor_id,
                title,
                body,
                type,
                notification_type,
                relationship_id,
                metadata,
                idempotency_key,
                is_user_initiated,
                delivery_status,
                is_read,
                created_at
            ) VALUES (
                $1, $1, $2, $3, $4, $5, $6, $6, $7, $8::jsonb, $9, $10, 'delivered', false, CURRENT_TIMESTAMP
            )
            RETURNING *;`,
            [
                opts.recipientId,
                recipientUsername,
                opts.actorId || null,
                opts.title,
                opts.body,
                opts.notificationType,
                opts.relationshipId || null,
                JSON.stringify(opts.metadata || {}),
                opts.idempotencyKey || null,
                opts.isUserInitiated ?? false,
            ]
        );

        await client.query("COMMIT;");

        return {
            success: true,
            notification: insertRes.rows[0],
        };
    } catch (err: any) {
        await client.query("ROLLBACK;");
        console.error("dispatchNotification error:", err);
        return {
            success: false,
            error: err.message,
            code: "NOTIFICATION_DISPATCH_FAILED",
        };
    } finally {
        client.release();
    }
}
