import { pool, query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { getClubModerationState } from "./clubModerationService.js";
import { dispatchNotification } from "../notification/quotaService.js";

// Reusing Personal Account Rate Limit Rules:
// 20 per day, 50 per week, 200 per month (rolling windows)
// 3 messages per single user-club pair per 24 hours (anti-spam)
export const CLUB_MESSAGE_LIMITS = {
    pairDaily: 3,
    globalDaily: 20,
    globalWeekly: 50,
    globalMonthly: 200,
} as const;

export const WINDOW_DAY_MS = 24 * 60 * 60 * 1000;
export const WINDOW_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const WINDOW_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const REDIS_TTL_SEC = 30 * 24 * 60 * 60 + 3600; // 30 days + safety margin

export interface ClubMessageQuotaCheck {
    allowed: boolean;
    limitType?: "pair_daily" | "daily" | "weekly" | "monthly";
    maxAllowed: number;
    currentCount: number;
    remaining: number;
    retryAfterSeconds?: number;
    resetAt?: Date;
    message?: string;
}

function formatDuration(seconds: number): string {
    if (seconds >= 86400) {
        const days = Math.ceil(seconds / 86400);
        return `${days} day${days > 1 ? "s" : ""}`;
    }
    if (seconds >= 3600) {
        const hours = Math.ceil(seconds / 3600);
        return `${hours} hour${hours > 1 ? "s" : ""}`;
    }
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/**
 * Checks sliding-window rate limit quotas for user messaging to clubs.
 * Reuses identical Redis sorted-set sliding window with PostgreSQL durable audit fallback.
 */
export async function checkClubMessageQuota(
    userId: string,
    clubId: string
): Promise<ClubMessageQuotaCheck> {
    const now = Date.now();
    const dayAgo = now - WINDOW_DAY_MS;
    const weekAgo = now - WINDOW_WEEK_MS;
    const monthAgo = now - WINDOW_MONTH_MS;

    const globalKey = `ratelimit:club_msg:${userId}`;
    const pairKey = `ratelimit:club_msg_pair:${userId}:${clubId}`;

    try {
        // 1. Cleanup old events in Redis
        await Promise.all([
            redis.zremrangebyscore(globalKey, 0, monthAgo),
            redis.zremrangebyscore(pairKey, 0, dayAgo),
        ]);

        // 2. Query counts
        const [pairDailyCount, globalDailyCount, globalWeeklyCount, globalMonthlyCount] = await Promise.all([
            redis.zcount(pairKey, dayAgo, "+inf"),
            redis.zcount(globalKey, dayAgo, "+inf"),
            redis.zcount(globalKey, weekAgo, "+inf"),
            redis.zcard(globalKey),
        ]);

        // 3. Evaluate Limits
        // 3a. Pair Daily Limit (3 messages to same club per 24h)
        if (pairDailyCount >= CLUB_MESSAGE_LIMITS.pairDaily) {
            const oldestPair: string[] = await (redis as any).zrange(pairKey, 0, 0, "WITHSCORES");
            const oldestTime = oldestPair[1] ? parseInt(oldestPair[1], 10) : dayAgo;
            const resetAt = new Date(oldestTime + WINDOW_DAY_MS);
            const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

            return {
                allowed: false,
                limitType: "pair_daily",
                maxAllowed: CLUB_MESSAGE_LIMITS.pairDaily,
                currentCount: pairDailyCount,
                remaining: 0,
                retryAfterSeconds,
                resetAt,
                message: `You can only send ${CLUB_MESSAGE_LIMITS.pairDaily} messages to this club every 24 hours. Try again in ${formatDuration(retryAfterSeconds)}.`,
            };
        }

        // 3b. Global Daily Limit (20 per day)
        if (globalDailyCount >= CLUB_MESSAGE_LIMITS.globalDaily) {
            const oldestDaily: string[] = await (redis as any).zrangebyscore(globalKey, dayAgo, "+inf", "WITHSCORES", "LIMIT", 0, 1);
            const oldestTime = oldestDaily[1] ? parseInt(oldestDaily[1], 10) : dayAgo;
            const resetAt = new Date(oldestTime + WINDOW_DAY_MS);
            const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

            return {
                allowed: false,
                limitType: "daily",
                maxAllowed: CLUB_MESSAGE_LIMITS.globalDaily,
                currentCount: globalDailyCount,
                remaining: 0,
                retryAfterSeconds,
                resetAt,
                message: `Daily club messaging limit reached (${CLUB_MESSAGE_LIMITS.globalDaily} per day). Try again in ${formatDuration(retryAfterSeconds)}.`,
            };
        }

        // 3c. Global Weekly Limit (50 per week)
        if (globalWeeklyCount >= CLUB_MESSAGE_LIMITS.globalWeekly) {
            const oldestWeekly: string[] = await (redis as any).zrangebyscore(globalKey, weekAgo, "+inf", "WITHSCORES", "LIMIT", 0, 1);
            const oldestTime = oldestWeekly[1] ? parseInt(oldestWeekly[1], 10) : weekAgo;
            const resetAt = new Date(oldestTime + WINDOW_WEEK_MS);
            const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

            return {
                allowed: false,
                limitType: "weekly",
                maxAllowed: CLUB_MESSAGE_LIMITS.globalWeekly,
                currentCount: globalWeeklyCount,
                remaining: 0,
                retryAfterSeconds,
                resetAt,
                message: `Weekly club messaging limit reached (${CLUB_MESSAGE_LIMITS.globalWeekly} per week). Try again in ${formatDuration(retryAfterSeconds)}.`,
            };
        }

        // 3d. Global Monthly Limit (200 per month)
        if (globalMonthlyCount >= CLUB_MESSAGE_LIMITS.globalMonthly) {
            const oldestMonthly: string[] = await (redis as any).zrange(globalKey, 0, 0, "WITHSCORES");
            const oldestTime = oldestMonthly[1] ? parseInt(oldestMonthly[1], 10) : monthAgo;
            const resetAt = new Date(oldestTime + WINDOW_MONTH_MS);
            const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

            return {
                allowed: false,
                limitType: "monthly",
                maxAllowed: CLUB_MESSAGE_LIMITS.globalMonthly,
                currentCount: globalMonthlyCount,
                remaining: 0,
                retryAfterSeconds,
                resetAt,
                message: `Monthly club messaging limit reached (${CLUB_MESSAGE_LIMITS.globalMonthly} per month). Try again in ${formatDuration(retryAfterSeconds)}.`,
            };
        }

        return {
            allowed: true,
            maxAllowed: CLUB_MESSAGE_LIMITS.globalWeekly,
            currentCount: globalWeeklyCount,
            remaining: Math.max(0, CLUB_MESSAGE_LIMITS.globalWeekly - globalWeeklyCount),
        };
    } catch {
        // Tier 2: Durable PostgreSQL Database Fallback
        return checkDatabaseFallbackQuota(userId, clubId);
    }
}

async function checkDatabaseFallbackQuota(userId: string, clubId: string): Promise<ClubMessageQuotaCheck> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - WINDOW_DAY_MS);
    const weekAgo = new Date(now.getTime() - WINDOW_WEEK_MS);
    const monthAgo = new Date(now.getTime() - WINDOW_MONTH_MS);

    const [pairRes, globalRes] = await Promise.all([
        query(
            `SELECT COUNT(*)::int AS pair_daily_count,
                    MIN(created_at) AS oldest_pair
             FROM club_message_action_logs
             WHERE user_id = $1 AND club_id = $2 AND created_at > $3;`,
            [userId, clubId, dayAgo]
        ),
        query(
            `SELECT
                COUNT(*) FILTER (WHERE created_at > $2)::int AS daily_count,
                COUNT(*) FILTER (WHERE created_at > $3)::int AS weekly_count,
                COUNT(*)::int AS monthly_count,
                MIN(created_at) FILTER (WHERE created_at > $2) AS oldest_daily,
                MIN(created_at) FILTER (WHERE created_at > $3) AS oldest_weekly,
                MIN(created_at) AS oldest_monthly
             FROM club_message_action_logs
             WHERE user_id = $1 AND created_at > $4;`,
            [userId, dayAgo, weekAgo, monthAgo]
        ),
    ]);

    const pairDailyCount = pairRes.rows[0]?.pair_daily_count || 0;
    if (pairDailyCount >= CLUB_MESSAGE_LIMITS.pairDaily) {
        const oldest = pairRes.rows[0]?.oldest_pair ? new Date(pairRes.rows[0].oldest_pair) : dayAgo;
        const resetAt = new Date(oldest.getTime() + WINDOW_DAY_MS);
        const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
        return {
            allowed: false,
            limitType: "pair_daily",
            maxAllowed: CLUB_MESSAGE_LIMITS.pairDaily,
            currentCount: pairDailyCount,
            remaining: 0,
            retryAfterSeconds,
            resetAt,
            message: `You can only send ${CLUB_MESSAGE_LIMITS.pairDaily} messages to this club every 24 hours.`,
        };
    }

    const gRow = globalRes.rows[0] || {};
    const dailyCount = gRow.daily_count || 0;
    const weeklyCount = gRow.weekly_count || 0;
    const monthlyCount = gRow.monthly_count || 0;

    if (dailyCount >= CLUB_MESSAGE_LIMITS.globalDaily) {
        return {
            allowed: false,
            limitType: "daily",
            maxAllowed: CLUB_MESSAGE_LIMITS.globalDaily,
            currentCount: dailyCount,
            remaining: 0,
            message: `Daily club messaging limit reached (${CLUB_MESSAGE_LIMITS.globalDaily} per day).`,
        };
    }

    if (weeklyCount >= CLUB_MESSAGE_LIMITS.globalWeekly) {
        return {
            allowed: false,
            limitType: "weekly",
            maxAllowed: CLUB_MESSAGE_LIMITS.globalWeekly,
            currentCount: weeklyCount,
            remaining: 0,
            message: `Weekly club messaging limit reached (${CLUB_MESSAGE_LIMITS.globalWeekly} per week).`,
        };
    }

    if (monthlyCount >= CLUB_MESSAGE_LIMITS.globalMonthly) {
        return {
            allowed: false,
            limitType: "monthly",
            maxAllowed: CLUB_MESSAGE_LIMITS.globalMonthly,
            currentCount: monthlyCount,
            remaining: 0,
            message: `Monthly club messaging limit reached (${CLUB_MESSAGE_LIMITS.globalMonthly} per month).`,
        };
    }

    return {
        allowed: true,
        maxAllowed: CLUB_MESSAGE_LIMITS.globalWeekly,
        currentCount: weeklyCount,
        remaining: Math.max(0, CLUB_MESSAGE_LIMITS.globalWeekly - weeklyCount),
    };
}

/**
 * Records a message action for quota consumption in Redis and PostgreSQL.
 */
export async function recordClubMessageAction(userId: string, clubId: string) {
    const now = Date.now();
    const eventId = `${now}-${Math.random().toString(36).substring(2, 8)}`;
    const globalKey = `ratelimit:club_msg:${userId}`;
    const pairKey = `ratelimit:club_msg_pair:${userId}:${clubId}`;

    try {
        await Promise.all([
            redis.zadd(globalKey, now, eventId),
            redis.expire(globalKey, REDIS_TTL_SEC),
            redis.zadd(pairKey, now, eventId),
            redis.expire(pairKey, 24 * 3600),
        ]);
    } catch {
        // non-blocking
    }

    await query(
        `INSERT INTO club_message_action_logs (user_id, club_id, created_at)
         VALUES ($1, $2, NOW());`,
        [userId, clubId]
    ).catch(() => {});
}

/**
 * Sends a message from an authenticated public user to a verified club.
 * Validates club state, checks blocks, enforces rate limits, checks mute state,
 * records message, and dispatches notification if not muted.
 */
export async function sendMessageToClub({
    senderId,
    senderName,
    clubId,
    subject = "General Inquiry",
    body,
}: {
    senderId: string;
    senderName: string;
    clubId: string;
    subject?: string;
    body: string;
}): Promise<{
    success: boolean;
    conversationId?: string | undefined;
    messageId?: string | undefined;
    isMutedDelivery?: boolean | undefined;
    error?: string | undefined;
    code?: string | undefined;
    retryAfterSeconds?: number | undefined;
}> {
    const cleanBody = (body || "").trim();
    if (cleanBody.length < 2 || cleanBody.length > 5000) {
        return {
            success: false,
            code: "VALIDATION_ERROR",
            error: "Message must be between 2 and 5,000 characters.",
        };
    }

    // 1. Verify club exists and is active
    const clubRes = await query(
        `SELECT id, name, slug, auth_user_id, is_active FROM verified_clubs WHERE id = $1 LIMIT 1;`,
        [clubId]
    );
    if (!clubRes.rows[0] || !clubRes.rows[0].is_active) {
        return {
            success: false,
            code: "CLUB_NOT_AVAILABLE",
            error: "This club is not currently open to public inquiries.",
        };
    }
    const club = clubRes.rows[0];

    // Club owner cannot message themselves as an external user
    if (club.auth_user_id === senderId) {
        return {
            success: false,
            code: "SELF_CONTACT_NOT_ALLOWED",
            error: "You cannot initiate an external inquiry to your own club.",
        };
    }

    // 2. Check Moderation (Block Check)
    const modState = await getClubModerationState(clubId, senderId);
    if (modState.isBlocked) {
        return {
            success: false,
            code: "USER_BLOCKED_BY_CLUB",
            error: "You don't have permission to message this club.",
        };
    }

    // 3. Enforce sliding-window rate limits
    const quotaCheck = await checkClubMessageQuota(senderId, clubId);
    if (!quotaCheck.allowed) {
        return {
            success: false,
            code: "RATE_LIMIT_EXCEEDED",
            error: quotaCheck.message || "Messaging quota exceeded.",
            retryAfterSeconds: quotaCheck.retryAfterSeconds,
        };
    }

    // 4. Upsert Conversation and Insert Message in a Database Transaction
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const convRes = await client.query(
            `INSERT INTO club_conversations (
                club_id, user_id, subject, status, is_read_by_club, is_read_by_user,
                last_message_preview, last_message_at, updated_at
            ) VALUES ($1, $2, $3, 'open', false, true, $4, NOW(), NOW())
            ON CONFLICT (club_id, user_id) DO UPDATE SET
                subject = EXCLUDED.subject,
                status = 'open',
                is_read_by_club = false,
                is_read_by_user = true,
                last_message_preview = EXCLUDED.last_message_preview,
                last_message_at = NOW(),
                updated_at = NOW()
            RETURNING id;`,
            [clubId, senderId, subject.slice(0, 100), cleanBody.slice(0, 150)]
        );
        const conversationId = convRes.rows[0].id;

        const isMutedDelivery = modState.isMuted;
        const msgRes = await client.query(
            `INSERT INTO club_messages (
                conversation_id, club_id, sender_id, sender_type, body, is_muted_delivery, created_at
            ) VALUES ($1, $2, $3, 'user', $4, $5, NOW())
            RETURNING id;`,
            [conversationId, clubId, senderId, cleanBody, isMutedDelivery]
        );
        const messageId = msgRes.rows[0].id;

        await client.query("COMMIT");

        // 5. Consume rate limit action
        await recordClubMessageAction(senderId, clubId);

        // 6. Notification Dispatch (ONLY if NOT muted!)
        if (!isMutedDelivery && club.auth_user_id) {
            await dispatchNotification({
                recipientId: club.auth_user_id,
                actorId: senderId,
                title: `New message from ${senderName}`,
                body: cleanBody.length > 120 ? `${cleanBody.slice(0, 120)}...` : cleanBody,
                notificationType: "club_message",
                metadata: {
                    clubId,
                    clubName: club.name,
                    conversationId,
                    subject,
                },
                isUserInitiated: true,
            }).catch((err) => console.warn("Notice: club message notification dispatch:", err));
        }

        return {
            success: true,
            conversationId,
            messageId,
            isMutedDelivery,
        };
    } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("sendMessageToClub error:", err);
        return {
            success: false,
            code: "INTERNAL_ERROR",
            error: "Failed to dispatch message to club.",
        };
    } finally {
        client.release();
    }
}

/**
 * Sends a reply from authorized club staff back to the user.
 */
export async function sendClubReply({
    clubId,
    staffId,
    conversationId,
    body,
}: {
    clubId: string;
    staffId: string;
    conversationId: string;
    body: string;
}): Promise<{
    success: boolean;
    message?: any;
    error?: string;
}> {
    const cleanBody = (body || "").trim();
    if (cleanBody.length < 1 || cleanBody.length > 5000) {
        return { success: false, error: "Reply body must be between 1 and 5,000 characters." };
    }

    // Verify conversation belongs to this club
    const convRes = await query(
        `SELECT c.id, c.user_id, c.subject, vc.name AS "clubName"
         FROM club_conversations c
         JOIN verified_clubs vc ON vc.id = c.club_id
         WHERE c.id = $1 AND c.club_id = $2
         LIMIT 1;`,
        [conversationId, clubId]
    );
    if (!convRes.rows[0]) {
        return { success: false, error: "Conversation not found." };
    }
    const conv = convRes.rows[0];

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const msgRes = await client.query(
            `INSERT INTO club_messages (
                conversation_id, club_id, sender_id, sender_type, body, created_at
            ) VALUES ($1, $2, $3, 'club', $4, NOW())
            RETURNING *;`,
            [conversationId, clubId, staffId, cleanBody]
        );

        await client.query(
            `UPDATE club_conversations
             SET last_message_preview = $1,
                 last_message_at = NOW(),
                 is_read_by_club = true,
                 is_read_by_user = false,
                 updated_at = NOW()
             WHERE id = $2;`,
            [cleanBody.slice(0, 150), conversationId]
        );

        await client.query("COMMIT");

        // Notify recipient user
        await dispatchNotification({
            recipientId: conv.user_id,
            actorId: staffId,
            title: `${conv.clubName} replied to your message`,
            body: cleanBody.length > 120 ? `${cleanBody.slice(0, 120)}...` : cleanBody,
            notificationType: "club_reply",
            metadata: {
                clubId,
                conversationId,
                subject: conv.subject,
            },
            isUserInitiated: false,
        }).catch((err) => console.warn("Notice: user notification for club reply:", err));

        return {
            success: true,
            message: msgRes.rows[0],
        };
    } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("sendClubReply error:", err);
        return { success: false, error: "Failed to send club reply." };
    } finally {
        client.release();
    }
}
