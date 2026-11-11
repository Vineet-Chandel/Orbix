// Backend/src/redis/workspaceRedis.ts
import redis from "./client.js";
import type {
    TeamWorkspace,
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
    MemberCapabilityResolution,
} from "../types/workspaceTypes.js";

const DEFAULT_NAMESPACE = "orbix:team-workspace:";
const NAMESPACE = process.env.WORKSPACE_REDIS_NAMESPACE || DEFAULT_NAMESPACE;
const CACHE_VERSION = "v1";

// Standard Cache Time-To-Live (in seconds)
const WORKSPACE_META_TTL = 900;       // 15 minutes
const PERMISSIONS_TTL = 600;          // 10 minutes
const MEMBER_STATE_TTL = 600;         // 10 minutes
const MEMBER_DIRECTORY_TTL = 120;     // 2 minutes
const DASHBOARD_METRICS_TTL = 300;    // 5 minutes
const TASK_ACCOUNTABILITY_TTL = 180;  // 3 minutes
const UNREAD_COUNTS_TTL = 60;         // 1 minute

export class WorkspaceRedisService {
    private static namespace = NAMESPACE;
    private static version = CACHE_VERSION;
    private static inFlight = new Map<string, Promise<any>>();

    /**
     * Builds namespaced, versioned key: orbix:team-workspace:<version>:<domain>:<segments>
     */
    static buildKey(domain: string, ...segments: string[]): string {
        const cleaned = segments.filter(Boolean).map((s) => String(s).trim().toLowerCase());
        return `${this.namespace}${this.version}:${domain}:${cleaned.join(":")}`;
    }

    /**
     * Retrieves current dynamic workspace generation counter for instant invalidation
     */
    static async getWorkspaceCacheVersion(workspaceId: string): Promise<number> {
        try {
            if (!redis || redis.status !== "ready") return 1;
            const key = `${this.namespace}ws_ver:${workspaceId.toLowerCase()}`;
            const ver = await redis.get(key);
            return ver ? parseInt(ver, 10) : 1;
        } catch {
            return 1;
        }
    }

    /**
     * Bumps workspace generation counter to invalidate all generation-dependent caches
     */
    static async bumpWorkspaceCacheVersion(workspaceId: string): Promise<number> {
        try {
            if (!redis || redis.status !== "ready") return 1;
            const key = `${this.namespace}ws_ver:${workspaceId.toLowerCase()}`;
            return await redis.incr(key);
        } catch {
            return 1;
        }
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
            // Invalidate capabilities cache simultaneously to prevent stale authorization
            await this.invalidateMemberCapabilities(workspaceId, userId);
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
            await this.invalidateAllWorkspaceCapabilities(workspaceId);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to sweep workspace permissions:`, err.message);
        }
    }

    // =========================================================================
    // 2.1 MEMBER CAPABILITIES CACHE (PHASE 01)
    // =========================================================================

    static async getCachedCapabilities(
        workspaceId: string,
        userId: string
    ): Promise<MemberCapabilityResolution | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("caps", workspaceId, userId);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to read capabilities cache for user ${userId}:`, err.message);
            return null;
        }
    }

    static async setCachedCapabilities(
        workspaceId: string,
        userId: string,
        capabilities: MemberCapabilityResolution,
        ttl = PERMISSIONS_TTL
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("caps", workspaceId, userId);
            await redis.setex(key, ttl, JSON.stringify(capabilities));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to cache capabilities for user ${userId}:`, err.message);
        }
    }

    static async invalidateMemberCapabilities(workspaceId: string, userId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("caps", workspaceId, userId);
            await redis.del(key);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Failed to invalidate capabilities cache for user ${userId}:`, err.message);
        }
    }

    static async invalidateAllWorkspaceCapabilities(workspaceId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const pattern = this.buildKey("caps", workspaceId, "*");
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
            console.warn(`[WorkspaceRedis] Failed to sweep workspace capabilities:`, err.message);
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

    // =========================================================================
    // 5. MEMBER DIRECTORY CACHE (PHASE 09)
    // =========================================================================

    /**
     * Retrieves cached member directory page
     */
    static async getCachedMemberDirectory(workspaceId: string, pageKey: string): Promise<any | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("members", workspaceId, pageKey);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Member directory cache read error:`, err.message);
            return null;
        }
    }

    /**
     * Caches member directory page (TTL: 2 minutes)
     */
    static async setCachedMemberDirectory(
        workspaceId: string,
        pageKey: string,
        data: any,
        ttl = MEMBER_DIRECTORY_TTL
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("members", workspaceId, pageKey);
            await redis.setex(key, ttl, JSON.stringify(data));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Member directory cache write error:`, err.message);
        }
    }

    /**
     * Evicts cached member directory pages for a workspace
     */
    static async invalidateMemberDirectory(workspaceId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const pattern = this.buildKey("members", workspaceId, "*");
            const stream = redis.scanStream({ match: pattern, count: 50 });
            await new Promise<void>((resolve) => {
                stream.on("data", async (keys: string[]) => {
                    if (keys.length > 0) {
                        try {
                            await redis.del(...keys);
                        } catch {}
                    }
                });
                stream.on("end", () => resolve());
                stream.on("error", () => resolve());
            });
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Member directory cache invalidation error:`, err.message);
        }
    }

    // =========================================================================
    // 6. TASK ACCOUNTABILITY & WORKLOAD CACHE (PHASE 09)
    // =========================================================================

    /**
     * Retrieves cached task accountability overview
     */
    static async getCachedTaskAccountability(workspaceId: string, scopeKey: string): Promise<any | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("taskcounts", workspaceId, scopeKey);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Task accountability cache read error:`, err.message);
            return null;
        }
    }

    /**
     * Caches task accountability metrics (TTL: 3 minutes)
     */
    static async setCachedTaskAccountability(
        workspaceId: string,
        scopeKey: string,
        data: any,
        ttl = TASK_ACCOUNTABILITY_TTL
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("taskcounts", workspaceId, scopeKey);
            await redis.setex(key, ttl, JSON.stringify(data));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Task accountability cache write error:`, err.message);
        }
    }

    /**
     * Evicts cached task accountability metrics
     */
    static async invalidateTaskAccountability(workspaceId: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const pattern = this.buildKey("taskcounts", workspaceId, "*");
            const stream = redis.scanStream({ match: pattern, count: 50 });
            await new Promise<void>((resolve) => {
                stream.on("data", async (keys: string[]) => {
                    if (keys.length > 0) {
                        try {
                            await redis.del(...keys);
                        } catch {}
                    }
                });
                stream.on("end", () => resolve());
                stream.on("error", () => resolve());
            });
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Task accountability cache invalidation error:`, err.message);
        }
    }

    // =========================================================================
    // 7. UNREAD COUNTS CACHE (PHASE 09)
    // =========================================================================

    /**
     * Retrieves cached unread counts for a user
     */
    static async getCachedUnreadCounts(workspaceId: string, userId: string): Promise<Record<string, number> | null> {
        try {
            if (!redis || redis.status !== "ready") return null;
            const key = this.buildKey("unread", workspaceId, userId);
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Unread counts cache read error:`, err.message);
            return null;
        }
    }

    /**
     * Caches channel unread counts (TTL: 1 minute)
     */
    static async setCachedUnreadCounts(
        workspaceId: string,
        userId: string,
        counts: Record<string, number>,
        ttl = UNREAD_COUNTS_TTL
    ): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            const key = this.buildKey("unread", workspaceId, userId);
            await redis.setex(key, ttl, JSON.stringify(counts));
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Unread counts cache write error:`, err.message);
        }
    }

    /**
     * Evicts cached unread counts for a specific user or all users in workspace
     */
    static async invalidateUnreadCounts(workspaceId: string, userId?: string): Promise<void> {
        try {
            if (!redis || redis.status !== "ready") return;
            if (userId) {
                const key = this.buildKey("unread", workspaceId, userId);
                await redis.del(key);
            } else {
                const pattern = this.buildKey("unread", workspaceId, "*");
                const stream = redis.scanStream({ match: pattern, count: 50 });
                await new Promise<void>((resolve) => {
                    stream.on("data", async (keys: string[]) => {
                        if (keys.length > 0) {
                            try {
                                await redis.del(...keys);
                            } catch {}
                        }
                    });
                    stream.on("end", () => resolve());
                    stream.on("error", () => resolve());
                });
            }
        } catch (err: any) {
            console.warn(`[WorkspaceRedis] Unread counts cache invalidation error:`, err.message);
        }
    }

    // =========================================================================
    // 8. MASTER COMPOSITE INVALIDATORS (PHASE 09)
    // =========================================================================

    /**
     * Comprehensive cache invalidation after security-sensitive changes
     * Invalidate appropriate cached data after:
     * - Role assignments / updates / permission changes
     * - Member suspension / removal
     * - Department transfers
     * - Channel access changes
     */
    static async invalidateOnSecurityChange(workspaceId: string, targetUserId?: string): Promise<void> {
        const promises: Promise<any>[] = [
            this.invalidateMemberDirectory(workspaceId),
            this.invalidateDashboardMetrics(workspaceId),
            this.invalidateTaskAccountability(workspaceId),
            this.bumpWorkspaceCacheVersion(workspaceId),
        ];

        if (targetUserId) {
            promises.push(this.invalidateMemberPermissions(workspaceId, targetUserId));
            promises.push(this.invalidateMemberCapabilities(workspaceId, targetUserId));
            promises.push(this.invalidateUnreadCounts(workspaceId, targetUserId));
        } else {
            promises.push(this.invalidateAllWorkspacePermissions(workspaceId));
            promises.push(this.invalidateAllWorkspaceCapabilities(workspaceId));
            promises.push(this.invalidateUnreadCounts(workspaceId));
        }

        await Promise.allSettled(promises);
    }

    /**
     * Cache invalidation triggered by task lifecycle events
     */
    static async invalidateOnTaskChange(workspaceId: string, taskId?: string): Promise<void> {
        await Promise.allSettled([
            this.invalidateTaskAccountability(workspaceId),
            this.invalidateDashboardMetrics(workspaceId),
            this.bumpWorkspaceCacheVersion(workspaceId),
        ]);
    }

    /**
     * Cache invalidation triggered by channel / category changes
     */
    static async invalidateOnChannelChange(workspaceId: string, channelId?: string): Promise<void> {
        await Promise.allSettled([
            this.invalidateUnreadCounts(workspaceId),
            this.invalidateDashboardMetrics(workspaceId),
            this.bumpWorkspaceCacheVersion(workspaceId),
        ]);
    }

    /**
     * Cache invalidation triggered by department changes
     */
    static async invalidateOnDepartmentChange(workspaceId: string, departmentId?: string): Promise<void> {
        const promises: Promise<any>[] = [
            this.invalidateDashboardMetrics(workspaceId),
            this.invalidateMemberDirectory(workspaceId),
            this.invalidateTaskAccountability(workspaceId),
            this.bumpWorkspaceCacheVersion(workspaceId),
        ];
        if (departmentId) {
            promises.push(this.invalidateDepartmentInsight(workspaceId, departmentId));
        }
        await Promise.allSettled(promises);
    }
}
