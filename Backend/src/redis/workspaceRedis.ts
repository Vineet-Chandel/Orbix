// Backend/src/redis/workspaceRedis.ts
import redis from "./client.js";
import type {
    TeamWorkspace,
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
} from "../types/workspaceTypes.js";

const DEFAULT_NAMESPACE = "orbix:team-workspace:";
const NAMESPACE = process.env.WORKSPACE_REDIS_NAMESPACE || DEFAULT_NAMESPACE;

// Standard Cache Time-To-Live (in seconds)
const WORKSPACE_META_TTL = 900; // 15 minutes
const PERMISSIONS_TTL = 600;    // 10 minutes
const MEMBER_STATE_TTL = 600;   // 10 minutes

export class WorkspaceRedisService {
    private static namespace = NAMESPACE;

    /**
     * Builds namespaced key: orbix:team-workspace:<domain>:<segments>
     */
    static buildKey(domain: string, ...segments: string[]): string {
        const cleaned = segments.filter(Boolean).map((s) => String(s).trim().toLowerCase());
        return `${this.namespace}${domain}:${cleaned.join(":")}`;
    }

    /**
     * Health check verifying Redis connectivity
     */
    static async isHealthy(): Promise<boolean> {
        try {
            if (!redis || redis.status !== "ready") return false;
            const res = await redis.ping();
            return res === "PONG";
        } catch {
            return false;
        }
    }

    // =========================================================================
    // 1. WORKSPACE METADATA CACHE
    // =========================================================================

    static async getCachedWorkspace(clubId: string): Promise<TeamWorkspace | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("meta", clubId);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to read workspace cache for club ${clubId}:`, err.message);
            return null; // Fallback to DB
        }
    }

    static async setCachedWorkspace(clubId: string, workspace: TeamWorkspace, ttl = WORKSPACE_META_TTL): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("meta", clubId);
            await redis.setex(key, ttl, JSON.stringify(workspace));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to write workspace cache for club ${clubId}:`, err.message);
        }
    }

    static async invalidateWorkspace(clubId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("meta", clubId);
            await redis.del(key);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to invalidate workspace cache for club ${clubId}:`, err.message);
        }
    }

    // =========================================================================
    // 2. MEMBER PERMISSIONS CACHE (Non-authoritative acceleration)
    // =========================================================================

    static async getCachedPermissions(workspaceId: string, userId: string): Promise<string[] | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("perms", workspaceId, userId);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to read permissions cache for user ${userId}:`, err.message);
            return null; // Fallback to PostgreSQL
        }
    }

    static async setCachedPermissions(
        workspaceId: string,
        userId: string,
        permissions: string[],
        ttl = PERMISSIONS_TTL
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("perms", workspaceId, userId);
            await redis.setex(key, ttl, JSON.stringify(permissions));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to cache permissions for user ${userId}:`, err.message);
        }
    }

    static async invalidateMemberPermissions(workspaceId: string, userId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("perms", workspaceId, userId);
            await redis.del(key);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to invalidate member permissions for user ${userId}:`, err.message);
        }
    }

    static async invalidateAllWorkspacePermissions(workspaceId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const pattern = this.buildKey("perms", workspaceId, "*");
            const stream = redis.scanStream({ match: pattern, count: 100 });
            stream.on("data", async (keys: string[]) => {
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            });
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to sweep workspace permissions:`, err.message);
        }
    }

    // =========================================================================
    // 3. RATE LIMITING PRIMITIVE
    // =========================================================================

    static async checkRateLimit(
        actionKey: string,
        limit: number,
        windowSeconds: number
    ): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
        try {
            if (!redis || redis.status !== "ready") {
                // If Redis is down, fail open safely for rate limits so service remains operational
                return { allowed: true, remaining: 1, retryAfterSeconds: 0 };
            }

            const key = this.buildKey("ratelimit", actionKey);
            const current = await redis.incr(key);

            if (current === 1) {
                await redis.expire(key, windowSeconds);
            }

            if (current > limit) {
                const ttl = await redis.ttl(key);
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
                };
            }

            return {
                allowed: true,
                remaining: limit - current,
                retryAfterSeconds: 0,
            };
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Rate-limit check error:`, err.message);
            return { allowed: true, remaining: 1, retryAfterSeconds: 0 };
        }
    }

    // =========================================================================
    // 4. WORKSPACE DASHBOARD & INSIGHTS CACHE (PHASE 08)
    // =========================================================================

    /**
     * Retrieves cached dashboard metrics for a specific permission tier
     */
    static async getCachedDashboardMetrics(
        workspaceId: string,
        permissionTier: string
    ): Promise<WorkspaceOverviewMetrics | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("dashboard", workspaceId, permissionTier);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Dashboard cache read error:`, err.message);
            return null;
        }
    }

    /**
     * Caches dashboard metrics partitioned by permission tier (TTL: 5 minutes)
     */
    static async setCachedDashboardMetrics(
        workspaceId: string,
        permissionTier: string,
        metrics: WorkspaceOverviewMetrics,
        ttl = 300
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("dashboard", workspaceId, permissionTier);
            await redis.setex(key, ttl, JSON.stringify(metrics));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Dashboard cache write error:`, err.message);
        }
    }

    /**
     * Evicts all cached dashboard metrics for a workspace
     */
    static async invalidateDashboardMetrics(workspaceId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const globalKey = this.buildKey("dashboard", workspaceId, "global");
            await redis.del(globalKey);

            const pattern = this.buildKey("dashboard", workspaceId, "*");
            const stream = redis.scanStream({ match: pattern, count: 50 });
            await new Promise<void>((resolve) => {
                stream.on("data", async (keys: string[]) => {
                    if (keys.length > 0) {
                        try {
                            await redis.del(...keys);
                        } catch {
                            // ignore
                        }
                    }
                });
                stream.on("end", () => resolve());
                stream.on("error", () => resolve());
            });
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Dashboard cache invalidation error:`, err.message);
        }
    }

    /**
     * Retrieves cached department insight
     */
    static async getCachedDepartmentInsight(
        workspaceId: string,
        departmentId: string
    ): Promise<WorkspaceDepartmentInsight | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("deptinsight", workspaceId, departmentId);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Dept insight cache read error:`, err.message);
            return null;
        }
    }

    /**
     * Caches department insight (TTL: 5 minutes)
     */
    static async setCachedDepartmentInsight(
        workspaceId: string,
        departmentId: string,
        insight: WorkspaceDepartmentInsight,
        ttl = 300
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("deptinsight", workspaceId, departmentId);
            await redis.setex(key, ttl, JSON.stringify(insight));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Dept insight cache write error:`, err.message);
        }
    }

    /**
     * Evicts cached department insight
     */
    static async invalidateDepartmentInsight(workspaceId: string, departmentId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("deptinsight", workspaceId, departmentId);
            await redis.del(key);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Dept insight cache invalidation error:`, err.message);
        }
    }
}
