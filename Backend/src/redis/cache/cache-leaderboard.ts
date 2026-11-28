import redis from "../client.js";

export const leaderboardDemoEnabled = process.env.ORBIX_LEADERBOARD_DEMO === "true" && process.env.NODE_ENV !== "production";
const KEY_PREFIX = `orbix:leaderboard:public-links-v4:${leaderboardDemoEnabled ? "demo" : "live"}`;

/**
 * Cache TTL configuration (in seconds)
 */
const GLOBAL_LEADERBOARD_TTL = 60; // 1 minute
const COLLEGE_LEADERBOARD_TTL = 60; // 1 minute
const PARTICIPATING_COLLEGES_TTL = 180; // 3 minutes
const COLLEGE_METADATA_TTL = 86400; // 24 hours

/**
 * Generates bounded random jitter to prevent cache stampedes on expiry
 */
function getJitter(baseTtl: number, percent = 0.15): number {
    const delta = Math.floor(baseTtl * percent);
    const offset = Math.floor(Math.random() * (2 * delta + 1)) - delta;
    return Math.max(10, baseTtl + offset);
}

/**
 * Normalizes search strings for deterministic cache keys
 */
function normalizeQuery(q?: string): string {
    if (!q) return "none";
    return encodeURIComponent(q.trim().toLowerCase().slice(0, 50));
}

export interface InvalidateCacheResult {
    success: boolean;
    status: "cleared" | "unavailable" | "partial" | "failed";
    clearedKeysCount: number;
    patterns: string[];
    details: {
        global: "cleared" | "skipped" | "failed";
        colleges: "cleared" | "skipped" | "failed";
        userrank: "cleared" | "skipped" | "failed";
        college: "cleared" | "skipped" | "failed";
    };
    error?: string;
}

export const cacheLeaderboard = {
    /**
     * Fetch cached global leaderboard page
     */
    async getGlobalPage(period: string, filter: string, page: number, limit: number, search?: string) {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = `${KEY_PREFIX}:global:${period}:${filter}:p${page}:l${limit}:s${normalizeQuery(search)}`;
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.warn("Redis getGlobalPage error (falling back to DB):", err);
            return null;
        }
    },

    /**
     * Store global leaderboard page in cache (without user-specific caller context)
     */
    async setGlobalPage(period: string, filter: string, page: number, limit: number, payload: any, search?: string) {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = `${KEY_PREFIX}:global:${period}:${filter}:p${page}:l${limit}:s${normalizeQuery(search)}`;
            const sanitized = { ...payload, currentUser: null, cached: true };
            const ttl = getJitter(GLOBAL_LEADERBOARD_TTL);
            await redis.setex(key, ttl, JSON.stringify(sanitized));
        } catch (err) {
            console.warn("Redis setGlobalPage error:", err);
        }
    },

    /**
     * Fetch cached college leaderboard page
     */
    async getCollegePage(collegeId: string, period: string, filter: string, page: number, limit: number, search?: string) {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = `${KEY_PREFIX}:college:${collegeId}:${period}:${filter}:p${page}:l${limit}:s${normalizeQuery(search)}`;
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.warn("Redis getCollegePage error (falling back to DB):", err);
            return null;
        }
    },

    /**
     * Store college leaderboard page in cache
     */
    async setCollegePage(collegeId: string, period: string, filter: string, page: number, limit: number, payload: any, search?: string) {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = `${KEY_PREFIX}:college:${collegeId}:${period}:${filter}:p${page}:l${limit}:s${normalizeQuery(search)}`;
            const sanitized = { ...payload, currentUser: null, cached: true };
            const ttl = getJitter(COLLEGE_LEADERBOARD_TTL);
            await redis.setex(key, ttl, JSON.stringify(sanitized));
        } catch (err) {
            console.warn("Redis setCollegePage error:", err);
        }
    },

    /**
     * Fetch cached participating colleges list & count
     */
    async getParticipatingColleges() {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = `${KEY_PREFIX}:colleges:participating`;
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.warn("Redis getParticipatingColleges error:", err);
            return null;
        }
    },

    /**
     * Store participating colleges list & count
     */
    async setParticipatingColleges(payload: any) {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = `${KEY_PREFIX}:colleges:participating`;
            const ttl = getJitter(PARTICIPATING_COLLEGES_TTL);
            await redis.setex(key, ttl, JSON.stringify(payload));
        } catch (err) {
            console.warn("Redis setParticipatingColleges error:", err);
        }
    },

    /**
     * Fetch cached individual user rank
     */
    async getUserRank(username: string, context = "global") {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = `${KEY_PREFIX}:userrank:${encodeURIComponent(username.toLowerCase())}:${context}`;
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            return null;
        }
    },

    /**
     * Store individual user rank in Redis cache
     */
    async setUserRank(username: string, context = "global", payload: any) {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = `${KEY_PREFIX}:userrank:${encodeURIComponent(username.toLowerCase())}:${context}`;
            const ttl = getJitter(GLOBAL_LEADERBOARD_TTL);
            await redis.setex(key, ttl, JSON.stringify(payload));
        } catch (err) {
            // Non-blocking error
        }
    },

    /**
     * Invalidate leaderboard cache keys with observable status and failure reporting.
     * @param options.collegeId Specific college to invalidate, or all if omitted
     */
    async invalidate(options?: { collegeId?: string }): Promise<InvalidateCacheResult> {
        const collegePattern = options?.collegeId
            ? `${KEY_PREFIX}:college:${options.collegeId}:*`
            : `${KEY_PREFIX}:college:*`;

        const patternMap: Array<{ key: "global" | "colleges" | "userrank" | "college"; pattern: string }> = [
            { key: "global", pattern: `${KEY_PREFIX}:global:*` },
            { key: "colleges", pattern: `${KEY_PREFIX}:colleges:*` },
            { key: "userrank", pattern: `${KEY_PREFIX}:userrank:*` },
            { key: "college", pattern: collegePattern },
        ];

        const targetPatterns = patternMap.map((p) => p.pattern);
        const details: InvalidateCacheResult["details"] = {
            global: "skipped",
            colleges: "skipped",
            userrank: "skipped",
            college: "skipped",
        };

        if (!redis || redis.status !== "ready") {
            const statusMsg = !redis ? "Client not configured" : `Redis status is '${redis.status}'`;
            console.warn(`[LeaderboardCache] Invalidation skipped: ${statusMsg}`);
            return {
                success: false,
                status: "unavailable",
                clearedKeysCount: 0,
                patterns: targetPatterns,
                details,
                error: `Redis unavailable (${statusMsg})`,
            };
        }

        let clearedKeysCount = 0;
        let hasFailure = false;
        let lastError: string | undefined;

        for (const item of patternMap) {
            try {
                if (redis.status !== "ready") {
                    throw new Error(`Redis connection dropped (status: '${redis.status}') during pattern '${item.key}'`);
                }
                const keys = await redis.keys(item.pattern);
                if (keys && keys.length > 0) {
                    const deleted = await redis.del(...keys);
                    clearedKeysCount += typeof deleted === "number" ? deleted : keys.length;
                }
                details[item.key] = "cleared";
            } catch (err: any) {
                hasFailure = true;
                details[item.key] = "failed";
                lastError = err?.message || String(err);
                console.warn(`[LeaderboardCache] Failed to invalidate pattern '${item.pattern}':`, lastError);
            }
        }

        const success = !hasFailure;
        let status: InvalidateCacheResult["status"] = "cleared";
        if (hasFailure) {
            status = clearedKeysCount > 0 ? "partial" : "failed";
        }

        return {
            success,
            status,
            clearedKeysCount,
            patterns: targetPatterns,
            details,
            ...(lastError ? { error: lastError } : {}),
        };
    },
};

export default cacheLeaderboard;
