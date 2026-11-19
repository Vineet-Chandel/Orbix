// Backend/src/services/relationship/relationshipQuotaService.ts
import crypto from "node:crypto";
import redis from "../../redis/client.js";
import { pool, query } from "../../database/client.js";

// Strict quota limits per user requirements:
// - Max 20 connection requests per day, max 50 per week
// - Max 20 blocks per day, max 50 per week
// - Repeated actions to the same user explicitly count against both limits
export const ACTION_LIMITS = {
    request: {
        daily: 20,
        weekly: 50,
        label: "connection request",
    },
    block: {
        daily: 20,
        weekly: 50,
        label: "user block",
    },
} as const;

export type QuotaActionType = "request" | "block";

export const WINDOW_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours (86,400,000 ms)
export const WINDOW_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (604,800,000 ms)
const REDIS_KEY_TTL_SECONDS = 7 * 24 * 60 * 60 + 3600; // 7 days + 1 hour safety margin

export interface QuotaCheckResult {
    allowed: boolean;
    limitType?: "daily" | "weekly";
    maxAllowed: number;
    currentCount: number;
    dailyCount: number;
    weeklyCount: number;
    remainingDaily: number;
    remainingWeekly: number;
    retryAfterSeconds?: number;
    resetAt?: Date;
    message?: string;
}

export interface QuotaStatusSummary {
    requests: {
        daily: { used: number; limit: number; remaining: number };
        weekly: { used: number; limit: number; remaining: number };
    };
    blocks: {
        daily: { used: number; limit: number; remaining: number };
        weekly: { used: number; limit: number; remaining: number };
    };
}

function getRedisQuotaKey(actorId: string, actionType: QuotaActionType): string {
    return `ratelimit:rel:${actionType}:${actorId}`;
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
 * Checks sliding-window quota for connection requests and blocks.
 * Employs Redis sorted sets as Tier 1 (sub-millisecond sliding window)
 * with automatic fallback to PostgreSQL audit logs (Tier 2 durability).
 */
export async function checkActionQuota(
    actorId: string,
    actionType: QuotaActionType
): Promise<QuotaCheckResult> {
    const limits = ACTION_LIMITS[actionType];
    const now = Date.now();
    const dayAgo = now - WINDOW_DAY_MS;
    const weekAgo = now - WINDOW_WEEK_MS;

    // -------------------------------------------------------------------------
    // Tier 1: Redis Sliding Window Sorted Set Check
    // -------------------------------------------------------------------------
    try {
        const key = getRedisQuotaKey(actorId, actionType);

        // 1. Remove events older than 7 days
        await redis.zremrangebyscore(key, 0, weekAgo);

        // 2. Fetch weekly total and daily total within window
        const [weeklyCount, dailyCount] = await Promise.all([
            redis.zcard(key),
            redis.zcount(key, dayAgo, "+inf"),
        ]);

        // 3. Weekly Limit Evaluation (50 per week)
        if (weeklyCount >= limits.weekly) {
            const oldestEntries = await redis.zrangebyscore(key, weekAgo, "+inf", "WITHSCORES", "LIMIT", 0, 1);
            const oldestScore = oldestEntries.length > 1 ? Number(oldestEntries[1]) : weekAgo;
            const resetAt = new Date(oldestScore + WINDOW_WEEK_MS);
            const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

            return {
                allowed: false,
                limitType: "weekly",
                maxAllowed: limits.weekly,
                currentCount: weeklyCount,
                dailyCount,
                weeklyCount,
                remainingDaily: Math.max(0, limits.daily - dailyCount),
                remainingWeekly: 0,
                retryAfterSeconds,
                resetAt,
                message: `Weekly ${limits.label} limit reached (${limits.weekly} per week). Try again in ${formatDuration(retryAfterSeconds)}.`,
            };
        }

        // 4. Daily Limit Evaluation (20 per day)
        if (dailyCount >= limits.daily) {
            const oldestEntries = await redis.zrangebyscore(key, dayAgo, "+inf", "WITHSCORES", "LIMIT", 0, 1);
            const oldestScore = oldestEntries.length > 1 ? Number(oldestEntries[1]) : dayAgo;
            const resetAt = new Date(oldestScore + WINDOW_DAY_MS);
            const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

            return {
                allowed: false,
                limitType: "daily",
                maxAllowed: limits.daily,
                currentCount: dailyCount,
                dailyCount,
                weeklyCount,
                remainingDaily: 0,
                remainingWeekly: Math.max(0, limits.weekly - weeklyCount),
                retryAfterSeconds,
                resetAt,
                message: `Daily ${limits.label} limit reached (${limits.daily} per day). Try again in ${formatDuration(retryAfterSeconds)}.`,
            };
        }

        // Allowed
        return {
            allowed: true,
            maxAllowed: limits.daily,
            currentCount: dailyCount,
            dailyCount,
            weeklyCount,
            remainingDaily: Math.max(0, limits.daily - dailyCount),
            remainingWeekly: Math.max(0, limits.weekly - weeklyCount),
        };
    } catch (redisErr) {
        console.warn("[QuotaService] Redis unavailable or error, falling back to PostgreSQL:", (redisErr as any)?.message);
    }

    // -------------------------------------------------------------------------
    // Tier 2: PostgreSQL Audit Log Sliding Window Fallback
    // -------------------------------------------------------------------------
    const dbRes = await query(
        `SELECT
            COUNT(*) FILTER (WHERE created_at > $3)::int AS daily_count,
            COUNT(*) FILTER (WHERE created_at > $4)::int AS weekly_count,
            MIN(created_at) FILTER (WHERE created_at > $3) AS oldest_daily,
            MIN(created_at) FILTER (WHERE created_at > $4) AS oldest_weekly
         FROM user_relationship_action_logs
         WHERE actor_id = $1
           AND action_type = $2
           AND created_at > $4;`,
        [actorId, actionType, new Date(dayAgo), new Date(weekAgo)]
    );

    const row = dbRes.rows[0] || {};
    const dailyCount = row.daily_count ?? 0;
    const weeklyCount = row.weekly_count ?? 0;
    const oldestDaily = row.oldest_daily ? new Date(row.oldest_daily) : new Date(dayAgo);
    const oldestWeekly = row.oldest_weekly ? new Date(row.oldest_weekly) : new Date(weekAgo);

    if (weeklyCount >= limits.weekly) {
        const resetAt = new Date(oldestWeekly.getTime() + WINDOW_WEEK_MS);
        const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        return {
            allowed: false,
            limitType: "weekly",
            maxAllowed: limits.weekly,
            currentCount: weeklyCount,
            dailyCount,
            weeklyCount,
            remainingDaily: Math.max(0, limits.daily - dailyCount),
            remainingWeekly: 0,
            retryAfterSeconds,
            resetAt,
            message: `Weekly ${limits.label} limit reached (${limits.weekly} per week). Try again in ${formatDuration(retryAfterSeconds)}.`,
        };
    }

    if (dailyCount >= limits.daily) {
        const resetAt = new Date(oldestDaily.getTime() + WINDOW_DAY_MS);
        const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        return {
            allowed: false,
            limitType: "daily",
            maxAllowed: limits.daily,
            currentCount: dailyCount,
            dailyCount,
            weeklyCount,
            remainingDaily: 0,
            remainingWeekly: Math.max(0, limits.weekly - weeklyCount),
            retryAfterSeconds,
            resetAt,
            message: `Daily ${limits.label} limit reached (${limits.daily} per day). Try again in ${formatDuration(retryAfterSeconds)}.`,
        };
    }

    return {
        allowed: true,
        maxAllowed: limits.daily,
        currentCount: dailyCount,
        dailyCount,
        weeklyCount,
        remainingDaily: Math.max(0, limits.daily - dailyCount),
        remainingWeekly: Math.max(0, limits.weekly - weeklyCount),
    };
}

/**
 * Records an action in both durable PostgreSQL log and high-speed Redis sorted set.
 * Repeated actions to the same target explicitly generate distinct entries with unique IDs.
 */
export async function recordAction(
    actorId: string,
    targetId: string,
    actionType: QuotaActionType,
    dbClient?: any
): Promise<void> {
    const now = Date.now();
    const actionId = crypto.randomUUID();

    // 1. PostgreSQL Durable Audit Log
    const sql = `
        INSERT INTO user_relationship_action_logs (id, actor_id, target_id, action_type, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);
    `;
    const params = [actionId, actorId, targetId, actionType];

    if (dbClient) {
        await dbClient.query(sql, params);
    } else {
        await pool.query(sql, params);
    }

    // 2. Redis Sliding Window Sorted Set
    try {
        const key = getRedisQuotaKey(actorId, actionType);
        // Unique member format: ${targetId}:${now}:${actionId} ensures repeated attempts are uniquely tracked
        const member = `${targetId}:${now}:${actionId}`;

        const pipeline = redis.pipeline();
        pipeline.zadd(key, now, member);
        pipeline.expire(key, REDIS_KEY_TTL_SECONDS);
        await pipeline.exec();
    } catch (redisErr) {
        console.warn("[QuotaService] Failed to record in Redis sorted set:", (redisErr as any)?.message);
    }
}

/**
 * Retrieves the full quota status breakdown for an actor.
 */
export async function getActionQuotaStatus(actorId: string): Promise<QuotaStatusSummary> {
    const [requestQuota, blockQuota] = await Promise.all([
        checkActionQuota(actorId, "request"),
        checkActionQuota(actorId, "block"),
    ]);

    return {
        requests: {
            daily: {
                used: requestQuota.dailyCount,
                limit: ACTION_LIMITS.request.daily,
                remaining: requestQuota.remainingDaily,
            },
            weekly: {
                used: requestQuota.weeklyCount,
                limit: ACTION_LIMITS.request.weekly,
                remaining: requestQuota.remainingWeekly,
            },
        },
        blocks: {
            daily: {
                used: blockQuota.dailyCount,
                limit: ACTION_LIMITS.block.daily,
                remaining: blockQuota.remainingDaily,
            },
            weekly: {
                used: blockQuota.weeklyCount,
                limit: ACTION_LIMITS.block.weekly,
                remaining: blockQuota.remainingWeekly,
            },
        },
    };
}
