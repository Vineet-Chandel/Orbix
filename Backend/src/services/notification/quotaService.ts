// Backend/src/services/notification/quotaService.ts
import { pool, query } from "../../database/client.js";
import { relationshipEvents } from "../relationship/relationshipEvents.js";

export const MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H = 3;
export const NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms
export const EVENT_SHARE_WINDOW_MS = 60 * 60 * 1000; // 1 hour (cooldown window)
export const MAX_EVENT_SHARES_PER_WINDOW = 3; // 3 successful shares per window

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
    windowMs?: number;
    maxAllowance?: number;
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
 * Evaluates event-share cooldown quota based on authoritative persisted notification timestamps.
 * A complete 1-hour cooldown activates immediately upon the 3rd successful invitation in a cycle.
 * Reset time is strictly: third_successful_share_created_at + EVENT_SHARE_WINDOW_MS.
 */
export function evaluateEventShareQuota(
    notificationTimestamps: (Date | string)[],
    now: Date = new Date(),
    windowMs: number = EVENT_SHARE_WINDOW_MS,
    maxAllowance: number = MAX_EVENT_SHARES_PER_WINDOW
): QuotaCheckResult {
    let cycleCount = 0;
    let cooldownUntil: Date | null = null;
    let lastShareTime: number | null = null;

    for (const raw of notificationTimestamps) {
        const ts = raw instanceof Date ? raw : new Date(raw);
        const timeMs = ts.getTime();

        // 1. If currently in a cooldown and this notification occurred after cooldown expiry:
        if (cooldownUntil && timeMs >= cooldownUntil.getTime()) {
            cycleCount = 0;
            cooldownUntil = null;
            lastShareTime = null;
        }
        // 2. Or if not in a cooldown, but more than windowMs passed since last share:
        else if (!cooldownUntil && lastShareTime !== null && timeMs - lastShareTime >= windowMs) {
            cycleCount = 0;
            lastShareTime = null;
        }

        cycleCount++;
        lastShareTime = timeMs;

        // When maxAllowance (3) is reached, activate 1-hour cooldown starting from this 3rd share!
        if (cycleCount >= maxAllowance) {
            cooldownUntil = new Date(timeMs + windowMs);
        }
    }

    const nowMs = now.getTime();

    // Check if we are currently inside an active cooldown
    if (cooldownUntil) {
        if (nowMs < cooldownUntil.getTime()) {
            const retryAfterSeconds = Math.max(1, Math.ceil((cooldownUntil.getTime() - nowMs) / 1000));
            return {
                allowed: false,
                remainingQuota: 0,
                currentCount: maxAllowance,
                retryAfterSeconds,
                nextResetAt: cooldownUntil,
            };
        } else {
            // Cooldown has expired at `now`! Allowance resets to maxAllowance.
            return {
                allowed: true,
                remainingQuota: maxAllowance,
                currentCount: 0,
            };
        }
    }

    // If not in a cooldown, check if an unexhausted cycle has timed out (> windowMs since last share)
    if (lastShareTime !== null && nowMs - lastShareTime >= windowMs) {
        return {
            allowed: true,
            remainingQuota: maxAllowance,
            currentCount: 0,
        };
    }

    return {
        allowed: cycleCount < maxAllowance,
        remainingQuota: Math.max(0, maxAllowance - cycleCount),
        currentCount: cycleCount,
    };
}

/**
 * Checks quota for user-initiated notifications between actor and recipient.
 * For 'event_share': evaluates cycle cooldown starting strictly from the 3rd successful share.
 * For other notifications: evaluates rolling 24-hour quota.
 */
export async function checkNotificationQuota(
    actorId: string,
    recipientId: string,
    notificationType?: string,
    customWindowMs?: number,
    customMaxAllowance?: number,
    eventId?: string
): Promise<QuotaCheckResult> {
    const isEventShare = notificationType === "event_share";
    const windowMs = customWindowMs ?? (isEventShare ? EVENT_SHARE_WINDOW_MS : NOTIFICATION_WINDOW_MS);
    const maxAllowance = customMaxAllowance ?? (isEventShare ? MAX_EVENT_SHARES_PER_WINDOW : MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H);

    if (isEventShare) {
        const rowsRes = await query(
            `SELECT created_at
             FROM user_notifications
             WHERE actor_id = $1
               AND recipient_id = $2
               AND is_user_initiated = true
               AND notification_type = 'event_share'
               AND (
                   ($3::text IS NOT NULL AND metadata IS NOT NULL AND metadata->>'eventId' = $3)
                   OR ($3::text IS NULL)
               )
             ORDER BY created_at ASC;`,
            [actorId, recipientId, eventId || null]
        );
        const timestamps = rowsRes.rows.map((r: any) => new Date(r.created_at));
        return evaluateEventShareQuota(timestamps, new Date(), windowMs, maxAllowance);
    }

    // Standard rolling window check for other notifications
    const windowStart = new Date(Date.now() - windowMs);
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

    if (count >= maxAllowance) {
        const nextResetAt = oldestInWindow
            ? new Date(oldestInWindow.getTime() + windowMs)
            : new Date(Date.now() + windowMs);
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
        remainingQuota: maxAllowance - count,
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

            const isEventShare = opts.notificationType === "event_share";
            const windowMs = opts.windowMs ?? (isEventShare ? EVENT_SHARE_WINDOW_MS : NOTIFICATION_WINDOW_MS);
            const maxAllowance = opts.maxAllowance ?? (isEventShare ? MAX_EVENT_SHARES_PER_WINDOW : MAX_USER_NOTIFICATIONS_PER_PAIR_PER_24H);

            if (isEventShare) {
                const eventId = opts.metadata?.eventId as string | undefined;
                const rowsRes = await client.query(
                    `SELECT created_at
                     FROM user_notifications
                     WHERE actor_id = $1
                       AND recipient_id = $2
                       AND is_user_initiated = true
                       AND notification_type = 'event_share'
                       AND (
                           ($3::text IS NOT NULL AND metadata IS NOT NULL AND metadata->>'eventId' = $3)
                           OR ($3::text IS NULL)
                       )
                     ORDER BY created_at ASC;`,
                    [opts.actorId, opts.recipientId, eventId || null]
                );
                const timestamps = rowsRes.rows.map((r: any) => new Date(r.created_at));
                const quotaCheck = evaluateEventShareQuota(timestamps, new Date(), windowMs, maxAllowance);

                if (!quotaCheck.allowed) {
                    await client.query("ROLLBACK;");
                    const retryAfterSeconds = quotaCheck.retryAfterSeconds || 1;

                    relationshipEvents.logEvent("notification_limit_reached", {
                        actorId: opts.actorId,
                        targetUserId: opts.recipientId,
                        metadata: { count: maxAllowance, retryAfterSeconds, notificationType: opts.notificationType },
                    });

                    return {
                        success: false,
                        code: "NOTIFICATION_LIMIT_REACHED",
                        error: `Notification limit reached for this user (maximum ${maxAllowance} notifications per 1-hour cooldown window).`,
                        retryAfterSeconds,
                    };
                }
            } else {
                // Standard rolling window check for other notifications
                const windowStart = new Date(Date.now() - windowMs);
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
                if (count >= maxAllowance) {
                    const oldestInWindow = countRes.rows[0]?.oldest_in_window ? new Date(countRes.rows[0].oldest_in_window) : null;
                    const nextResetAt = oldestInWindow
                        ? new Date(oldestInWindow.getTime() + windowMs)
                        : new Date(Date.now() + windowMs);
                    const retryAfterSeconds = Math.max(1, Math.ceil((nextResetAt.getTime() - Date.now()) / 1000));

                    await client.query("ROLLBACK;");

                    relationshipEvents.logEvent("notification_limit_reached", {
                        actorId: opts.actorId,
                        targetUserId: opts.recipientId,
                        metadata: { count, retryAfterSeconds, notificationType: opts.notificationType },
                    });

                    return {
                        success: false,
                        code: "NOTIFICATION_LIMIT_REACHED",
                        error: `Notification limit reached for this user (maximum ${maxAllowance} notifications per 24-hour rolling window).`,
                        retryAfterSeconds,
                    };
                }
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
