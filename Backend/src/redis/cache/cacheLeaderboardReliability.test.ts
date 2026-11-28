import test, { describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import redis from "../client.js";
import cacheLeaderboard, { type InvalidateCacheResult } from "./cache-leaderboard.js";
import { pool } from "../../database/client.js";
import { syncLeaderboardForUser, clearLeaderboardCache } from "../../Routes/leaderboard/leaderboard.js";
import { platformVerificationService } from "../../services/verification/platformVerificationService.js";

const originalQuery = pool.query;
const originalFetch = globalThis.fetch;
let mockStore = new Map<string, string>();
let mockUsers: Record<string, any> = {};
let mockLinks: any[] = [];

beforeEach(() => {
    redis.disconnect();
    mockStore.clear();
    mockUsers = {
        "user-a-id": {
            id: "user-a-id",
            username: "user_a",
            email: "user_a@example.com",
            firstname: "Alice",
            lastname: "Coder",
            is_email_verified: true,
            is_public: true,
            orbix_score: 5000,
            total_solved: 1000,
        },
    };
    mockLinks = [];
    globalThis.fetch = async () => new Response("{}", { status: 503 });

    (pool as any).query = async (sql: string, values: any[] = []) => {
        if (sql.includes("information_schema.")) return { rows: [{ exists: 1 }] };
        if (sql.includes("FROM institutions")) return { rows: [] };
        if (sql.includes("FROM users")) {
            const val = String(values[0] || "").toLowerCase();
            const matched = Object.values(mockUsers).find(
                (u) => (u.username || "").toLowerCase() === val || (u.id || "").toLowerCase() === val
            );
            return { rows: matched ? [matched] : [] };
        }
        if (sql.includes("FROM user_links") && !sql.includes("leaderboard_entries")) {
            return { rows: mockLinks.filter((l) => l.ownership_status === "VERIFIED") };
        }
        if (sql.includes("UPDATE users") && sql.includes("SET orbix_score")) {
            const targetId = values[7];
            if (mockUsers[targetId]) {
                mockUsers[targetId].orbix_score = values[0];
                mockUsers[targetId].total_solved = values[4];
            }
            return { rowCount: 1, rows: [] };
        }
        if (sql.includes("INSERT INTO leaderboard_entries")) {
            return {
                rows: [{
                    user_id: values[0],
                    username: values[1],
                    score: values[7],
                    score_breakdown: JSON.parse(values[8]),
                    total_solved: values[9],
                    total_contests: values[10],
                    platform_ratings: JSON.parse(values[11]),
                    streak: values[12],
                    is_public: values[13],
                    updated_at: new Date().toISOString(),
                    global_rank: 1,
                }],
                rowCount: 1,
            };
        }
        if (sql.includes("UPDATE public.user_links") && sql.includes("SET ownership_status = 'REVOKED'")) {
            return { rowCount: 1, rows: [{ id: "link-revoked" }] };
        }
        return { rows: [], rowCount: 1 };
    };
});

after(async () => {
    (pool as any).query = originalQuery;
    globalThis.fetch = originalFetch;
    redis.disconnect();
    await pool.end();
});

describe("Reliable Redis Leaderboard Cache Invalidation", () => {
    // -------------------------------------------------------------------------
    // TEST 1: Redis unavailable before invalidation
    // -------------------------------------------------------------------------
    test("1. Redis unavailable before invalidation returns observable 'unavailable' status", async () => {
        redis.status = "close";

        const res = await cacheLeaderboard.invalidate();
        assert.equal(res.success, false, "Must not report success when Redis is closed");
        assert.equal(res.status, "unavailable");
        assert.equal(res.clearedKeysCount, 0);
        assert.ok(res.error?.includes("Redis unavailable"));
        assert.equal(res.details.global, "skipped");
        assert.equal(res.details.colleges, "skipped");
        assert.equal(res.details.userrank, "skipped");
        assert.equal(res.details.college, "skipped");
    });

    // -------------------------------------------------------------------------
    // TEST 2: Redis becoming unavailable during invalidation
    // -------------------------------------------------------------------------
    test("2. Redis becoming unavailable during invalidation is captured as partial/failure", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });

        let callCount = 0;
        t.mock.method(redis, "keys", async () => {
            callCount++;
            if (callCount === 1) {
                redis.status = "connecting";
                return ["key1"];
            }
            return [];
        });
        t.mock.method(redis, "del", async () => 1);

        const res = await cacheLeaderboard.invalidate();
        assert.equal(res.success, false);
        assert.equal(res.status, "partial");
        assert.equal(res.clearedKeysCount, 1);
        assert.equal(res.details.global, "cleared");
        assert.equal(res.details.colleges, "failed");
    });

    // -------------------------------------------------------------------------
    // TEST 3: Redis command failure
    // -------------------------------------------------------------------------
    test("3. Redis command failure logs diagnostic and returns observable 'failed' status", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });

        t.mock.method(redis, "keys", async () => {
            throw new Error("ECONNRESET: connection reset by peer");
        });

        const res = await cacheLeaderboard.invalidate();
        assert.equal(res.success, false);
        assert.equal(res.status, "failed");
        assert.equal(res.clearedKeysCount, 0);
        assert.ok(res.error?.includes("ECONNRESET"));
    });

    // -------------------------------------------------------------------------
    // TEST 4: Successful global cache invalidation
    // -------------------------------------------------------------------------
    test("4. Successful global cache invalidation purges global, college, and user rank keys", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });

        mockStore.set("orbix:leaderboard:public-links-v4:live:global:all:all:p1:l50:snone", "data");
        mockStore.set("orbix:leaderboard:public-links-v4:live:colleges:participating", "data");
        mockStore.set("orbix:leaderboard:public-links-v4:live:userrank:user_a:global", "data");
        mockStore.set("orbix:leaderboard:public-links-v4:live:college:all:all:p1:l50:snone", "data");

        t.mock.method(redis, "keys", async (pattern: string) => {
            const prefix = pattern.replace(/\*$/, "");
            return Array.from(mockStore.keys()).filter((k) => k.startsWith(prefix));
        });
        t.mock.method(redis, "del", async (...keys: string[]) => {
            for (const k of keys) mockStore.delete(k);
            return keys.length;
        });

        const res = await cacheLeaderboard.invalidate();
        assert.equal(res.success, true);
        assert.equal(res.status, "cleared");
        assert.equal(res.clearedKeysCount, 4);
        assert.equal(mockStore.size, 0);
        assert.equal(res.details.global, "cleared");
        assert.equal(res.details.colleges, "cleared");
        assert.equal(res.details.userrank, "cleared");
        assert.equal(res.details.college, "cleared");
    });

    // -------------------------------------------------------------------------
    // TEST 5: Successful college cache invalidation
    // -------------------------------------------------------------------------
    test("5. Successful college cache invalidation targets specific institution while preserving others", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });

        const inst1Key = "orbix:leaderboard:public-links-v4:live:college:inst-1:all:all:p1:l50:snone";
        const inst2Key = "orbix:leaderboard:public-links-v4:live:college:inst-2:all:all:p1:l50:snone";
        mockStore.set(inst1Key, "data1");
        mockStore.set(inst2Key, "data2");

        t.mock.method(redis, "keys", async (pattern: string) => {
            const prefix = pattern.replace(/\*$/, "");
            return Array.from(mockStore.keys()).filter((k) => k.startsWith(prefix));
        });
        t.mock.method(redis, "del", async (...keys: string[]) => {
            for (const k of keys) mockStore.delete(k);
            return keys.length;
        });

        const res = await cacheLeaderboard.invalidate({ collegeId: "inst-1" });
        assert.equal(res.success, true);
        assert.equal(res.status, "cleared");
        assert.equal(mockStore.has(inst1Key), false, "Target college key must be deleted");
        assert.equal(mockStore.has(inst2Key), true, "Other college key must be preserved");
    });

    // -------------------------------------------------------------------------
    // TEST 6: Partial invalidation failure
    // -------------------------------------------------------------------------
    test("6. Partial invalidation failure accurately reflects cleared count and failure details", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });

        let scanned = 0;
        t.mock.method(redis, "keys", async (pattern: string) => {
            scanned++;
            if (scanned === 1) return ["global_key_1", "global_key_2"];
            if (scanned === 2) throw new Error("Cluster partition error");
            return [];
        });
        t.mock.method(redis, "del", async (...keys: string[]) => keys.length);

        const res = await cacheLeaderboard.invalidate();
        assert.equal(res.success, false);
        assert.equal(res.status, "partial");
        assert.equal(res.clearedKeysCount, 2);
        assert.equal(res.details.global, "cleared");
        assert.equal(res.details.colleges, "failed");
        assert.ok(res.error?.includes("Cluster partition error"));
    });

    // -------------------------------------------------------------------------
    // TEST 7: Retry after Redis becomes available
    // -------------------------------------------------------------------------
    test("7. Retry succeeds after Redis transitions from unavailable to ready", async (t) => {
        // Step 1: Redis is unavailable
        redis.status = "close";
        const failRes = await cacheLeaderboard.invalidate();
        assert.equal(failRes.success, false);
        assert.equal(failRes.status, "unavailable");

        // Step 2: Redis reconnects
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });
        t.mock.method(redis, "keys", async () => ["key_a"]);
        t.mock.method(redis, "del", async () => 1);

        const retryRes = await cacheLeaderboard.invalidate();
        assert.equal(retryRes.success, true);
        assert.equal(retryRes.status, "cleared");
        assert.equal(retryRes.clearedKeysCount, 4);
    });

    // -------------------------------------------------------------------------
    // TEST 8: Repeated retry is safe and idempotent
    // -------------------------------------------------------------------------
    test("8. Repeated retry invocations are completely safe, idempotent, and non-destructive", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });
        t.mock.method(redis, "keys", async () => []);
        t.mock.method(redis, "del", async () => 0);

        const first = await cacheLeaderboard.invalidate();
        assert.equal(first.success, true);
        assert.equal(first.status, "cleared");

        const second = await cacheLeaderboard.invalidate();
        assert.equal(second.success, true);
        assert.equal(second.status, "cleared");

        const third = await cacheLeaderboard.invalidate({ collegeId: "inst-1" });
        assert.equal(third.success, true);
        assert.equal(third.status, "cleared");
    });

    // -------------------------------------------------------------------------
    // TEST 9: Historical database rebuild succeeding while cache cleanup remains pending
    // -------------------------------------------------------------------------
    test("9. Historical database rebuild updates DB score while accurately surfacing pending cache status", async () => {
        // Redis is down
        redis.status = "close";

        // User A has unverified handle with 5,000 historical points in DB
        assert.equal(mockUsers["user-a-id"].orbix_score, 5000);
        mockLinks = [{ portal: "leetcode", portal_username: "user_a", ownership_status: "CONNECTED_UNVERIFIED", is_public: true }];

        const result = await syncLeaderboardForUser("user_a");
        assert.ok(result);

        // Database score was successfully and truthfully updated to 0
        assert.equal(result.score, 0);
        assert.equal(mockUsers["user-a-id"].orbix_score, 0, "PostgreSQL score must be updated to 0");

        // Cache status is truthfully surfaced as unavailable (not falsely reported as cleared!)
        assert.equal(result.cacheInvalidated, false);
        assert.equal(result.cacheStatus, "unavailable");
    });

    // -------------------------------------------------------------------------
    // TEST 10: Cache cleanup completing without repeating database score recalculation
    // -------------------------------------------------------------------------
    test("10. Cache cleanup completes via standalone clearLeaderboardCache without re-running DB queries", async (t) => {
        redis.status = "ready";
        t.after(() => { redis.status = "close"; });

        let delCalled = false;
        t.mock.method(redis, "keys", async () => ["some_key"]);
        t.mock.method(redis, "del", async () => { delCalled = true; return 1; });

        let dbQueriesCount = 0;
        const originalMock = (pool as any).query;
        (pool as any).query = async (sql: string, values: any[]) => {
            dbQueriesCount++;
            return originalMock(sql, values);
        };

        // Standalone invalidation
        const cacheRes = await clearLeaderboardCache();
        assert.equal(cacheRes.success, true);
        assert.equal(cacheRes.status, "cleared");
        assert.equal(delCalled, true);
        assert.equal(dbQueriesCount, 0, "Standalone cache invalidation must not execute database score queries");
    });

    // -------------------------------------------------------------------------
    // TEST 11: Verification and unlink lifecycle paths surfacing invalidation failures
    // -------------------------------------------------------------------------
    test("11. Verification post-commit hook and revocation handle Redis downtime gracefully", async () => {
        redis.status = "close";

        // 1. Post-commit refresh hook when Redis is down
        const hookRes = await platformVerificationService.refreshOwnershipAfterCommit("user-a-id");
        assert.equal(typeof hookRes.leaderboardSyncTriggered, "boolean");
        assert.equal(hookRes.leaderboardSyncTriggered, true);

        // 2. Revocation when Redis is down
        const revokeRes = await platformVerificationService.revokeOwnership("user-a-id", "leetcode");
        assert.equal(revokeRes, true);
    });
});
