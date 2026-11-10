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
    private static inFlight = new Map<string, Promise<any>>();

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
            console.warn(`[WorkspaceRedis] Failed to sweep workspace permissions:`, err.message);
        }
    }

    // =========================================================================
    // 3. DISTRIBUTED MUTEX & CACHE STAMPEDE PROTECTION
    // =========================================================================

    /**
     * Acquires a distributed lock using SET NX EX
     */
    static async acquireLock(lockName: string, ttlSeconds = 5): Promise<string | null> {
        try {
            if (!redis || redis.status !== "ready") return "fallback-token";
            const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
            const key = this.buildKey("lock", lockName);
            const res = await redis.set(key, token, "EX", ttlSeconds, "NX");
            return res === "OK" ? token : null;
        } catch {
            return "fallback-token";
        }
    }

    /**
     * Atomically releases a distributed lock using Lua script verification
     */
    static async releaseLock(lockName: string, token: string): Promise<boolean> {
        try {
            if (!redis || redis.status !== "ready" || token === "fallback-token") return true;
            const key = this.buildKey("lock", lockName);
            const script = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;
            const res = await redis.eval(script, 1, key, token);
            return res === 1;
        } catch {
            return false;
        }
    }

    /**
     * Coalesces concurrent cache misses to protect PostgreSQL from cache stampedes / thundering herds.
     * Uses in-process single-flight coalescing and distributed Redis mutex.
     */
    static async getOrComputeWithStampedeProtection<T>(
        cacheKey: string,
        computeFn: () => Promise<T>,
        ttlSeconds: number
    ): Promise<T> {
        // 1. Try reading cache first
        try {
            if (redis && redis.status === "ready") {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    return JSON.parse(cached);
                }
            }
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Cache read error for ${cacheKey}:`, err.message);
        }

        // 2. In-process single-flight deduplication: coalesce identical concurrent requests in same event tick
        if (this.inFlight.has(cacheKey)) {
            return (await this.inFlight.get(cacheKey)) as T;
        }

        const computePromise = (async () => {
            // 3. Distributed cross-instance mutex to avoid cluster stampede
            const lockToken = await this.acquireLock(`compute:${cacheKey}`, 8);
            try {
                // Double-check cache in case another worker just populated it
                if (redis && redis.status === "ready") {
                    const cached = await redis.get(cacheKey);
                    if (cached) {
                        return JSON.parse(cached);
                    }
                }

                // 4. Compute fresh value from database
                const freshValue = await computeFn();

                // 5. Populate cache
                if (redis && redis.status === "ready" && freshValue !== undefined && freshValue !== null) {
                    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(freshValue));
                }

                return freshValue;
            } finally {
                if (lockToken) {
                    await this.releaseLock(`compute:${cacheKey}`, lockToken);
                }
            }
        })();

        this.inFlight.set(cacheKey, computePromise);
        try {
            return await computePromise;
        } finally {
            this.inFlight.delete(cacheKey);
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
