// Backend/src/redis/workspaceRecognitionRedis.ts
import redis from "./client.js";
import { query } from "../database/client.js";
import type {
    LeaderboardPeriod,
    ContributorLeaderboardEntry,
    DepartmentLeaderboardEntry,
} from "../types/workspaceTypes.js";

export type RecognitionBoardType = "contributors" | "leaders" | "departments";

export interface RedisRankEntry {
    entityId: string;
    score: number;
    rank: number;
    isTarget?: boolean;
}

export class WorkspaceRecognitionRedisService {
    private static basePrefix = "orbix:recognition:leaderboard:";

    /**
     * Constructs standard Redis sorted set key:
     * orbix:recognition:leaderboard:{workspaceId}:{boardType}:{period}[:dept:{departmentId}]
     */
    static buildZSetKey(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        departmentId?: string
    ): string {
        const wsId = workspaceId.toLowerCase().trim();
        const base = `${this.basePrefix}${wsId}:${boardType}:${period}`;
        if (departmentId && departmentId !== "all") {
            return `${base}:dept:${departmentId.toLowerCase().trim()}`;
        }
        return base;
    }

    /**
     * Verifies if Redis client is available and ready
     */
    static isAvailable(): boolean {
        return !!redis && redis.status === "ready";
    }

    /**
     * Updates an entity's absolute score in a sorted set (Authoritative projection)
     * Using absolute score ZADD ensures idempotency and immunity to outbox retries.
     */
    static async updateScore(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        entityId: string,
        score: number,
        departmentId?: string
    ): Promise<boolean> {
        try {
            if (!this.isAvailable()) return false;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);
            const safeScore = Number.isFinite(score) ? score : 0;
            await redis.zadd(key, safeScore, entityId);
            return true;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to update score for ${entityId}:`, err.message);
            return false;
        }
    }

    /**
     * Batch update multiple entity scores atomically using a pipeline.
     */
    static async batchUpdateScores(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        entries: Array<{ entityId: string; score: number }>,
        departmentId?: string
    ): Promise<boolean> {
        try {
            if (!this.isAvailable() || entries.length === 0) return false;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);
            const pipeline = redis.pipeline();

            for (const entry of entries) {
                const safeScore = Number.isFinite(entry.score) ? entry.score : 0;
                pipeline.zadd(key, safeScore, entry.entityId);
            }

            await pipeline.exec();
            return true;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to batch update scores:`, err.message);
            return false;
        }
    }

    /**
     * Retrieves the top rankings from the sorted set in descending order.
     */
    static async getTopRankings(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        limit = 50,
        offset = 0,
        departmentId?: string
    ): Promise<RedisRankEntry[] | null> {
        try {
            if (!this.isAvailable()) return null;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);

            // Bounded limit: max 100 entries
            const boundedLimit = Math.min(Math.max(1, limit), 100);
            const stop = offset + boundedLimit - 1;

            const raw = await redis.zrevrange(key, offset, stop, "WITHSCORES");
            if (!raw || raw.length === 0) return null;

            const results: RedisRankEntry[] = [];
            for (let i = 0; i < raw.length; i += 2) {
                const entityId = raw[i];
                const score = parseFloat(raw[i + 1]) || 0;
                const rank = offset + Math.floor(i / 2) + 1;
                results.push({ entityId, score, rank });
            }

            return results;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to get top rankings:`, err.message);
            return null; // Fallback to PostgreSQL
        }
    }

    /**
     * Retrieves a single entity's rank and score.
     */
    static async getEntityRank(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        entityId: string,
        departmentId?: string
    ): Promise<{ rank: number | null; score: number | null }> {
        try {
            if (!this.isAvailable()) return { rank: null, score: null };
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);

            const pipeline = redis.pipeline();
            pipeline.zrevrank(key, entityId);
            pipeline.zscore(key, entityId);

            const results = await pipeline.exec();
            if (!results) return { rank: null, score: null };

            const [rankErr, rankIdx] = results[0];
            const [scoreErr, rawScore] = results[1];

            if (rankErr || rankIdx === null || rankIdx === undefined) {
                return { rank: null, score: null };
            }

            const rank = (rankIdx as number) + 1; // 1-based rank
            const score = rawScore !== null ? parseFloat(rawScore as string) : null;

            return { rank, score };
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to get entity rank for ${entityId}:`, err.message);
            return { rank: null, score: null };
        }
    }

    /**
     * Retrieves nearby members around an entity (e.g. ±radius positions)
     */
    static async getNearbyRankings(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        entityId: string,
        radius = 2,
        departmentId?: string
    ): Promise<RedisRankEntry[] | null> {
        try {
            if (!this.isAvailable()) return null;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);

            const targetIdx = await redis.zrevrank(key, entityId);
            if (targetIdx === null) return null;

            const safeRadius = Math.min(Math.max(1, radius), 10);
            const start = Math.max(0, targetIdx - safeRadius);
            const stop = targetIdx + safeRadius;

            const raw = await redis.zrevrange(key, start, stop, "WITHSCORES");
            if (!raw || raw.length === 0) return null;

            const results: RedisRankEntry[] = [];
            for (let i = 0; i < raw.length; i += 2) {
                const id = raw[i];
                const score = parseFloat(raw[i + 1]) || 0;
                const rank = start + Math.floor(i / 2) + 1;
                results.push({
                    entityId: id,
                    score,
                    rank,
                    isTarget: id === entityId,
                });
            }

            return results;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to get nearby rankings for ${entityId}:`, err.message);
            return null;
        }
    }

    /**
     * Removes an entity from a sorted set (e.g. on member removal or role change)
     */
    static async removeEntity(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        entityId: string,
        departmentId?: string
    ): Promise<boolean> {
        try {
            if (!this.isAvailable()) return false;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);
            await redis.zrem(key, entityId);
            return true;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to remove entity ${entityId}:`, err.message);
            return false;
        }
    }

    /**
     * Clears a specific leaderboard sorted set
     */
    static async clearLeaderboard(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        departmentId?: string
    ): Promise<boolean> {
        try {
            if (!this.isAvailable()) return false;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);
            await redis.del(key);
            return true;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to clear leaderboard ${boardType}:`, err.message);
            return false;
        }
    }

    /**
     * Purges all leaderboard keys for a given workspace
     */
    static async clearAllWorkspaceLeaderboards(workspaceId: string): Promise<number> {
        try {
            if (!this.isAvailable()) return 0;
            const pattern = `${this.basePrefix}${workspaceId.toLowerCase().trim()}:*`;
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                return keys.length;
            }
            return 0;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Failed to clear all leaderboards for ${workspaceId}:`, err.message);
            return 0;
        }
    }

    /**
     * Rate limits high-frequency operations per user (e.g. max 25 requests per 10 seconds)
     */
    static async checkBurstRateLimit(
        actionKey: string,
        maxHits: number = 25,
        windowSeconds: number = 10
    ): Promise<{ allowed: boolean; remaining: number }> {
        try {
            if (!this.isAvailable()) return { allowed: true, remaining: maxHits };
            const key = `orbix:ratelimit:rec:${actionKey}`;
            const current = await redis.incr(key);
            if (current === 1) {
                await redis.expire(key, windowSeconds);
            }
            if (current > maxHits) {
                return { allowed: false, remaining: 0 };
            }
            return { allowed: true, remaining: maxHits - current };
        } catch {
            return { allowed: true, remaining: maxHits };
        }
    }

    /**
     * Checks if a leaderboard key exists in Redis and contains entries
     */
    static async hasLeaderboard(
        workspaceId: string,
        boardType: RecognitionBoardType,
        period: LeaderboardPeriod,
        departmentId?: string
    ): Promise<boolean> {
        try {
            if (!this.isAvailable()) return false;
            const key = this.buildZSetKey(workspaceId, boardType, period, departmentId);
            const count = await redis.zcard(key);
            return count > 0;
        } catch {
            return false;
        }
    }

    // =========================================================================
    // HYDRATED LEADERBOARD PROJECTIONS WITH POSTGRESQL SOURCE OF TRUTH
    // =========================================================================

    /**
     * Reads top contributor rankings from Redis sorted set, then hydratively
     * decorates member identity from PostgreSQL without storing PII in Redis.
     * Returns null on cache miss or Redis offline to trigger PostgreSQL fallback.
     */
    static async getHydratedTopContributors(
        workspaceId: string,
        period: LeaderboardPeriod,
        limit = 50,
        offset = 0,
        departmentId?: string
    ): Promise<ContributorLeaderboardEntry[] | null> {
        try {
            const rawRankings = await this.getTopRankings(
                workspaceId,
                "contributors",
                period,
                limit,
                offset,
                departmentId
            );

            if (!rawRankings || rawRankings.length === 0) {
                return null; // Cache miss or empty -> Fall back to DB
            }

            const userIds = rawRankings.map((r) => r.entityId);

            // Hydrate member profiles and departments in a single query
            const profileRes = await query(
                `SELECT
                    u.id AS "userId",
                    TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS "name",
                    u.username,
                    u.avatar_url AS "avatarUrl",
                    wd.id AS "departmentId",
                    wd.name AS "departmentName",
                    wd.color AS "departmentColor"
                 FROM public.users u
                 LEFT JOIN public.workspace_department_members wdm ON wdm.user_id = u.id AND wdm.workspace_id = $1
                 LEFT JOIN public.workspace_departments wd ON wd.id = wdm.department_id
                 WHERE u.id = ANY($2);`,
                [workspaceId, userIds]
            );

            const profileMap = new Map<string, any>();
            profileRes.rows.forEach((p: any) => {
                profileMap.set(p.userId, p);
            });

            const entries: ContributorLeaderboardEntry[] = [];
            for (const item of rawRankings) {
                const profile = profileMap.get(item.entityId);
                if (!profile) continue;

                entries.push({
                    rank: item.rank,
                    userId: item.entityId,
                    name: profile.name || profile.username,
                    username: profile.username,
                    avatarUrl: profile.avatarUrl || undefined,
                    departmentId: profile.departmentId || undefined,
                    departmentName: profile.departmentName || undefined,
                    departmentColor: profile.departmentColor || undefined,
                    totalOrbits: Math.round(item.score),
                    categoryBreakdown: [],
                    periodDelta: 0,
                    trend: "stable",
                });
            }

            return entries;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Hydration failed for top contributors:`, err.message);
            return null; // Fallback to DB
        }
    }

    /**
     * Reads top department rankings from Redis sorted set, then hydratively
     * decorates department information from PostgreSQL.
     */
    static async getHydratedTopDepartments(
        workspaceId: string,
        period: LeaderboardPeriod,
        limit = 50,
        offset = 0
    ): Promise<DepartmentLeaderboardEntry[] | null> {
        try {
            const rawRankings = await this.getTopRankings(
                workspaceId,
                "departments",
                period,
                limit,
                offset
            );

            if (!rawRankings || rawRankings.length === 0) {
                return null;
            }

            const deptIds = rawRankings.map((r) => r.entityId);

            const deptRes = await query(
                `SELECT
                    wd.id AS "departmentId",
                    wd.name AS "departmentName",
                    wd.slug AS "departmentSlug",
                    wd.color,
                    (SELECT COUNT(*)::int FROM public.workspace_department_members WHERE department_id = wd.id) AS "memberCount"
                 FROM public.workspace_departments wd
                 WHERE wd.workspace_id = $1 AND wd.id = ANY($2);`,
                [workspaceId, deptIds]
            );

            const deptMap = new Map<string, any>();
            deptRes.rows.forEach((d: any) => {
                deptMap.set(d.departmentId, d);
            });

            const entries: DepartmentLeaderboardEntry[] = [];
            for (const item of rawRankings) {
                const dept = deptMap.get(item.entityId);
                if (!dept) continue;

                entries.push({
                    rank: item.rank,
                    departmentId: item.entityId,
                    departmentName: dept.departmentName,
                    departmentSlug: dept.departmentSlug,
                    departmentColor: dept.color,
                    memberCount: dept.memberCount || 0,
                    departmentPerformanceIndex: item.score,
                    hasSufficientData: true,
                    deliveryStatistics: {
                        tasksAssigned: 0,
                        tasksCompleted: 0,
                        tasksApproved: 0,
                        overdueTasks: 0,
                        onTimeDeliveryRate: 100,
                        participationRate: 100,
                        reworkRate: 0,
                        totalOrbits: 0,
                        cappedRecognitionScore: 0,
                    },
                    trend: "stable",
                });
            }

            return entries;
        } catch (err: any) {
            console.warn(`[RecognitionRedis] Hydration failed for top departments:`, err.message);
            return null;
        }
    }
}
