import test, { describe, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { syncLeaderboardForUser } from "../../Routes/leaderboard/leaderboard.js";
import { resetSchemaStateCache } from "./schemaCompatibility.js";
import { platformVerificationService } from "./platformVerificationService.js";
import cacheLeaderboard from "../../redis/cache/cache-leaderboard.js";

const originalQuery = pool.query;
const originalFetch = globalThis.fetch;
const queries: Array<{ sql: string; values: any[] }> = [];

interface MockLink {
    id?: string;
    user_id: string;
    portal: string;
    portal_username: string;
    verified?: boolean;
    ownership_status?: string | null;
    is_public: boolean;
    stats?: any[];
    leaderboard_snapshot?: any;
}

let mockLinks: MockLink[] = [];
let mockUsers: Record<string, any> = {};
let simulateMissingColumn = false;

function makeSnapshot(portal: string, handle: string, data: Record<string, unknown>) {
    return {
        portal,
        handle,
        profile: {
            success: true,
            stats: [],
            ...data,
        },
    };
}

beforeEach(() => {
    redis.disconnect();
    resetSchemaStateCache();
    queries.length = 0;
    mockLinks = [];
    mockUsers = {
        "user-a-id": {
            id: "user-a-id",
            username: "user_a",
            email: "user_a@example.com",
            firstname: "Alice",
            lastname: "Coder",
            college: "Tech University",
            college_id: "inst-1",
            is_email_verified: true,
            is_public: true,
        },
        "user-b-id": {
            id: "user-b-id",
            username: "user_b",
            email: "user_b@example.com",
            firstname: "Bob",
            lastname: "Hacker",
            college: "Tech University",
            college_id: "inst-1",
            is_email_verified: true,
            is_public: true,
        },
    };
    simulateMissingColumn = false;
    globalThis.fetch = async () => new Response("{}", { status: 503 });

    (pool as any).query = async (sql: string, values: any[] = []) => {
        queries.push({ sql, values });

        // Schema introspection mock
        if (sql.includes("information_schema.columns")) {
            if (simulateMissingColumn) return { rows: [] };
            return { rows: [{ exists: 1 }] };
        }
        if (sql.includes("information_schema.tables")) {
            return { rows: [{ exists: 1 }] };
        }

        // Institutions mock
        if (sql.includes("FROM institutions")) {
            return { rows: [{ id: "inst-1", official_name: "Tech University" }] };
        }

        // Users lookup mock
        if (sql.includes("FROM users")) {
            const val = String(values[0] || "").toLowerCase();
            const matched = Object.values(mockUsers).find(
                (u) => (u.username || "").toLowerCase() === val || (u.id || "").toLowerCase() === val || (u.email || "").toLowerCase() === val
            );
            return { rows: matched ? [matched] : [] };
        }

        // User links query in syncLeaderboardForUser
        if (sql.includes("FROM user_links") && !sql.includes("leaderboard_entries")) {
            const targetUserId = values[0];
            const hasVerifiedCond = sql.includes("ownership_status = 'VERIFIED'");
            const isFailClosed = sql.includes("1 = 0");

            if (isFailClosed) {
                return { rows: [] };
            }

            const filtered = mockLinks.filter((link) => {
                if (link.user_id !== targetUserId) return false;
                if (sql.includes("is_public IS NOT FALSE") && link.is_public === false) return false;
                if (hasVerifiedCond && link.ownership_status !== "VERIFIED") return false;
                return true;
            });
            return { rows: filtered };
        }

        // Users score update mock
        if (sql.includes("UPDATE users") && sql.includes("SET orbix_score")) {
            const targetId = values[7];
            if (mockUsers[targetId]) {
                mockUsers[targetId].orbix_score = values[0];
                mockUsers[targetId].orbix_score_breakdown = values[1];
                mockUsers[targetId].streak = values[3];
                mockUsers[targetId].total_solved = values[4];
                mockUsers[targetId].total_contests = values[5];
                mockUsers[targetId].platform_ratings = values[6];
            }
            return { rowCount: 1, rows: [] };
        }

        // Revoke ownership query mock
        if (sql.includes("UPDATE public.user_links") && sql.includes("SET ownership_status = 'REVOKED'")) {
            const targetUserId = values[0];
            const targetPortal = String(values[1] || "").toLowerCase().trim();
            let count = 0;
            for (const l of mockLinks) {
                if (l.user_id === targetUserId && l.portal.toLowerCase() === targetPortal && l.ownership_status === "VERIFIED") {
                    l.ownership_status = "REVOKED";
                    l.verified = false;
                    count++;
                }
            }
            return { rowCount: count, rows: count > 0 ? [{ id: "revoked-link" }] : [] };
        }

        // Leaderboard entries upsert mock
        if (sql.includes("INSERT INTO leaderboard_entries")) {
            return {
                rows: [{
                    user_id: values[0],
                    username: values[1],
                    display_name: values[2],
                    avatar_url: values[3],
                    college: values[4],
                    college_id: values[5],
                    is_verified: values[6],
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

        return { rows: [], rowCount: 1 };
    };
});

after(async () => {
    (pool as any).query = originalQuery;
    globalThis.fetch = originalFetch;
    redis.disconnect();
    await pool.end();
});

describe("Authoritative Verified-Only Leaderboard Eligibility Enforcement", () => {
    // -------------------------------------------------------------------------
    // TEST GROUP A: Connection Without Ownership Proof (Primary Exploit Scenario)
    // -------------------------------------------------------------------------
    describe("Test Group A — Connection without ownership proof", () => {
        test("connecting a high-scoring LeetCode profile without ownership proof awards 0 score", async () => {
            // Exploit attempt: User connects a top competitive handle (2800 rating, 2500 solved)
            mockLinks.push({
                id: "link-1",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "world_class_coder",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "world_class_coder", {
                    totalSolved: 2500,
                    rating: 2800,
                    badge: "Guardian",
                    ranking: 15,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.ok(result);

            // Strict backend enforcement: score must be 0, solved must be 0, ratings empty
            assert.equal(result.score, 0, "Unverified account must contribute 0 score");
            assert.equal(result.totalSolved, 0, "Unverified account must contribute 0 solved");
            assert.equal(result.totalContests, 0, "Unverified account must contribute 0 contests");
            assert.deepEqual(result.platformRatings, {}, "Unverified account must not expose platform ratings");

            // Verify query enforcement
            const userLinksQuery = queries.find(
                (q) => q.sql.includes("FROM user_links") && q.sql.includes("leaderboard_snapshot")
            );
            assert.ok(userLinksQuery, "Query must inspect user_links");
            assert.match(userLinksQuery.sql, /ownership_status = 'VERIFIED'/, "Query must filter by verified ownership");
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP B: Verified Account
    // -------------------------------------------------------------------------
    describe("Test Group B — Verified account", () => {
        test("cryptographically verified platform account contributes full score and statistics", async () => {
            mockLinks.push({
                id: "link-2",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "alice_verified",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "alice_verified", {
                    totalSolved: 450,
                    rating: 1950,
                    badge: "Knight",
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.ok(result);

            // Verified account must score legitimately
            assert.ok(result.score > 0, "Verified account must contribute positive score");
            assert.equal(result.totalSolved, 450, "Verified account must contribute solved count");
            assert.equal(result.platformRatings.leetcode?.rating, 1950, "Verified rating must be captured");
            assert.equal(result.platformRatings.leetcode?.badge, "Knight");
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP C: Mixed Platform Eligibility
    // -------------------------------------------------------------------------
    describe("Test Group C — Mixed platform eligibility", () => {
        test("only the verified platform contributes when mixed with unverified, pending, failed, and null states", async () => {
            mockLinks.push(
                // 1. Verified LeetCode (eligible)
                {
                    id: "link-c1",
                    user_id: "user-a-id",
                    portal: "leetcode",
                    portal_username: "alice_lc",
                    verified: true,
                    ownership_status: "VERIFIED",
                    is_public: true,
                    leaderboard_snapshot: makeSnapshot("leetcode", "alice_lc", {
                        totalSolved: 300,
                        rating: 1800,
                    }),
                },
                // 2. Unverified Codeforces (ineligible: 3000 solved, 3100 rating)
                {
                    id: "link-c2",
                    user_id: "user-a-id",
                    portal: "codeforces",
                    portal_username: "tourist_copied",
                    verified: false,
                    ownership_status: "CONNECTED_UNVERIFIED",
                    is_public: true,
                    leaderboard_snapshot: makeSnapshot("codeforces", "tourist_copied", {
                        totalSolved: 3000,
                        rating: 3100,
                    }),
                },
                // 3. Verification Pending CodeChef (ineligible: 600 solved, 2400 rating)
                {
                    id: "link-c3",
                    user_id: "user-a-id",
                    portal: "codechef",
                    portal_username: "cc_pending",
                    verified: false,
                    ownership_status: "VERIFICATION_PENDING",
                    is_public: true,
                    leaderboard_snapshot: makeSnapshot("codechef", "cc_pending", {
                        totalSolved: 600,
                        rating: 2400,
                    }),
                },
                // 4. Verification Failed HackerRank (ineligible: 200 solved)
                {
                    id: "link-c4",
                    user_id: "user-a-id",
                    portal: "hackerrank",
                    portal_username: "hr_failed",
                    verified: false,
                    ownership_status: "VERIFICATION_FAILED",
                    is_public: true,
                    leaderboard_snapshot: makeSnapshot("hackerrank", "hr_failed", {
                        totalSolved: 200,
                    }),
                },
                // 5. Missing / Null Ownership Status AtCoder (ineligible: 500 solved)
                {
                    id: "link-c5",
                    user_id: "user-a-id",
                    portal: "atcoder",
                    portal_username: "ac_null",
                    verified: false,
                    ownership_status: null,
                    is_public: true,
                    leaderboard_snapshot: makeSnapshot("atcoder", "ac_null", {
                        totalSolved: 500,
                        rating: 1600,
                    }),
                }
            );

            const result = await syncLeaderboardForUser("user_a");
            assert.ok(result);

            // Total solved must ONLY be from verified LeetCode (300)
            assert.equal(result.totalSolved, 300, "Only verified LeetCode must contribute solved problems");
            assert.equal(result.platformRatings.leetcode?.rating, 1800);
            assert.equal(result.platformRatings.codeforces, undefined, "Unverified Codeforces must be excluded");
            assert.equal(result.platformRatings.codechef, undefined, "Pending CodeChef must be excluded");
            assert.equal(result.platformRatings.hackerrank, undefined, "Failed HackerRank must be excluded");
            assert.equal(result.platformRatings.atcoder, undefined, "Null status AtCoder must be excluded");
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP D: Multiple Users and Copied Profiles
    // -------------------------------------------------------------------------
    describe("Test Group D — Multiple users and copied profiles", () => {
        test("User A cannot siphon points from a copied profile; User B legitimately scores with verified profile", async () => {
            // User A links a high-scoring handle without ownership proof
            mockLinks.push({
                id: "link-d1",
                user_id: "user-a-id",
                portal: "codeforces",
                portal_username: "grandmaster_handle",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("codeforces", "grandmaster_handle", {
                    totalSolved: 3500,
                    rating: 3400,
                }),
            });

            // User B connects and verifies their own handle
            mockLinks.push({
                id: "link-d2",
                user_id: "user-b-id",
                portal: "codeforces",
                portal_username: "bob_handle",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("codeforces", "bob_handle", {
                    totalSolved: 150,
                    rating: 1450,
                }),
            });

            // Sync User A
            const resultA = await syncLeaderboardForUser("user_a");
            assert.ok(resultA);
            assert.equal(resultA.score, 0, "User A with unverified handle must get 0");
            assert.equal(resultA.totalSolved, 0);

            // Sync User B
            const resultB = await syncLeaderboardForUser("user_b");
            assert.ok(resultB);
            assert.ok(resultB.score > 0, "User B with verified handle must get points");
            assert.equal(resultB.totalSolved, 150);
            assert.equal(resultB.platformRatings.codeforces?.rating, 1450);
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP E: Lifecycle Changes
    // -------------------------------------------------------------------------
    describe("Test Group E — Lifecycle changes", () => {
        test("verification success transitions platform from 0 to full eligible score", async () => {
            const link: MockLink = {
                id: "link-e1",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "alice_lc",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "alice_lc", {
                    totalSolved: 200,
                    rating: 1600,
                }),
            };
            mockLinks.push(link);

            // Step 1: Unverified state
            const before = await syncLeaderboardForUser("user_a");
            assert.equal(before?.score, 0);

            // Step 2: Verification completes
            link.ownership_status = "VERIFIED";
            link.verified = true;

            const after = await syncLeaderboardForUser("user_a");
            assert.ok((after?.score || 0) > 0);
            assert.equal(after?.totalSolved, 200);
        });

        test("verification failure keeps platform contribution at 0", async () => {
            const link: MockLink = {
                id: "link-e2",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "alice_lc",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "alice_lc", {
                    totalSolved: 200,
                    rating: 1600,
                }),
            };
            mockLinks.push(link);

            // Verification fails
            link.ownership_status = "VERIFICATION_FAILED";
            const result = await syncLeaderboardForUser("user_a");
            assert.equal(result?.score, 0);
            assert.equal(result?.totalSolved, 0);
        });

        test("unlinking an account removes its score contribution", async () => {
            const link: MockLink = {
                id: "link-e3",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "alice_lc",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "alice_lc", {
                    totalSolved: 200,
                    rating: 1600,
                }),
            };
            mockLinks.push(link);

            // Score with verified link
            const initial = await syncLeaderboardForUser("user_a");
            assert.ok((initial?.score || 0) > 0);

            // Unlink (disconnect)
            mockLinks = [];
            const afterDisconnect = await syncLeaderboardForUser("user_a");
            assert.equal(afterDisconnect?.score, 0);
            assert.equal(afterDisconnect?.totalSolved, 0);
        });

        test("revoking ownership removes its score contribution", async () => {
            const link: MockLink = {
                id: "link-e4",
                user_id: "user-a-id",
                portal: "codeforces",
                portal_username: "alice_cf",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("codeforces", "alice_cf", {
                    totalSolved: 500,
                    rating: 1700,
                }),
            };
            mockLinks.push(link);

            const initial = await syncLeaderboardForUser("user_a");
            assert.ok((initial?.score || 0) > 0);

            // Ownership revoked
            link.ownership_status = "REVOKED";
            link.verified = false;

            const afterRevocation = await syncLeaderboardForUser("user_a");
            assert.equal(afterRevocation?.score, 0);
            assert.equal(afterRevocation?.totalSolved, 0);
        });

        test("resyncing crawler stats never grants ownership or score eligibility to unverified account", async () => {
            const link: MockLink = {
                id: "link-e5",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "alice_lc",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "alice_lc", {
                    totalSolved: 100,
                    rating: 1500,
                }),
            };
            mockLinks.push(link);

            // Initial sync: 0
            const initial = await syncLeaderboardForUser("user_a");
            assert.equal(initial?.score, 0);

            // Crawler resyncs with improved stats
            link.leaderboard_snapshot = makeSnapshot("leetcode", "alice_lc", {
                totalSolved: 300,
                rating: 1850,
            });

            // Resync run: still 0 because unverified!
            const afterResync = await syncLeaderboardForUser("user_a", { refreshProviderStats: false });
            assert.equal(afterResync?.score, 0);
            assert.equal(afterResync?.totalSolved, 0);
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP F: Legacy and Fail-Closed Behavior
    // -------------------------------------------------------------------------
    describe("Test Group F — Legacy and fail-closed behavior", () => {
        test("legacy verified=true with ownership_status=CONNECTED_UNVERIFIED contributes zero", async () => {
            mockLinks.push({
                id: "link-f1",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "legacy_user",
                verified: true, // Legacy boolean was true
                ownership_status: "CONNECTED_UNVERIFIED", // But ownership was never proven!
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "legacy_user", {
                    totalSolved: 800,
                    rating: 2000,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.equal(result?.score, 0);
            assert.equal(result?.totalSolved, 0);
        });

        test("legacy verified=true with ownership_status=null contributes zero", async () => {
            mockLinks.push({
                id: "link-f2",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "legacy_user_null",
                verified: true,
                ownership_status: null,
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "legacy_user_null", {
                    totalSolved: 800,
                    rating: 2000,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.equal(result?.score, 0);
            assert.equal(result?.totalSolved, 0);
        });

        test("missing ownership schema column fails closed to 1 = 0 and contributes zero", async () => {
            simulateMissingColumn = true;
            resetSchemaStateCache();

            mockLinks.push({
                id: "link-f3",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "user_in_unmigrated_db",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "user_in_unmigrated_db", {
                    totalSolved: 500,
                    rating: 1800,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.equal(result?.score, 0, "Unmigrated schema must fail closed to 0 score");
            assert.equal(result?.totalSolved, 0);

            const userLinksQuery = queries.find(
                (q) => q.sql.includes("FROM user_links") && q.sql.includes("leaderboard_snapshot")
            );
            assert.ok(userLinksQuery);
            assert.match(userLinksQuery.sql, /1 = 0/, "Unmigrated query must contain fail-closed 1 = 0");
        });

        test("unknown or invalid status string contributes zero", async () => {
            mockLinks.push({
                id: "link-f4",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "unknown_status_user",
                verified: false,
                ownership_status: "BOGUS_STATUS_OVERRIDE",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "unknown_status_user", {
                    totalSolved: 1000,
                    rating: 2200,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.equal(result?.score, 0);
            assert.equal(result?.totalSolved, 0);
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP G: Cache Invalidation and Recalculation
    // -------------------------------------------------------------------------
    describe("Test Group G — Cache and background jobs", () => {
        test("syncLeaderboardForUser triggers cache invalidation for updated standings", async () => {
            mockLinks.push({
                id: "link-g1",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "alice_lc",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "alice_lc", {
                    totalSolved: 100,
                }),
            });

            // Running sync with invalidateCache (default) should succeed and invalidate cache
            const result = await syncLeaderboardForUser("user_a");
            assert.ok(result);
            assert.equal(result.totalSolved, 100);
        });

        test("batch recalculation evaluates only verified ownership links", async () => {
            // Setup User A: unverified high score
            mockLinks.push({
                id: "link-g2",
                user_id: "user-a-id",
                portal: "codeforces",
                portal_username: "unverified_cf",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("codeforces", "unverified_cf", {
                    totalSolved: 1200,
                    rating: 2100,
                }),
            });

            // Recalculating User A in batch mode
            const resA = await syncLeaderboardForUser("user-a-id", { invalidateCache: false });
            assert.ok(resA);
            assert.equal(resA.score, 0);
            assert.equal(resA.totalSolved, 0);

            // User B: verified
            mockLinks.push({
                id: "link-g3",
                user_id: "user-b-id",
                portal: "leetcode",
                portal_username: "verified_lc",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "verified_lc", {
                    totalSolved: 350,
                    rating: 1750,
                }),
            });

            const resB = await syncLeaderboardForUser("user-b-id", { invalidateCache: false });
            assert.ok(resB);
            assert.ok(resB.score > 0);
            assert.equal(resB.totalSolved, 350);
        });
    });

    // -------------------------------------------------------------------------
    // TEST GROUP H: Release Readiness & Historical Score Cleanup Audit
    // -------------------------------------------------------------------------
    describe("Test Group H — Release Readiness & Historical Score Cleanup Audit", () => {
        test("H1: Historical unverified score is systematically purged during recalculation", async () => {
            mockUsers["user-a-id"].orbix_score = 4500;
            mockUsers["user-a-id"].total_solved = 1200;
            mockLinks.push({
                id: "link-h1",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "unverified_historical",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "unverified_historical", {
                    totalSolved: 1200,
                    rating: 2400,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.ok(result);
            assert.equal(result.score, 0);
            assert.equal(result.totalSolved, 0);
            assert.equal(mockUsers["user-a-id"].orbix_score, 0, "Persisted users.orbix_score must be reset to 0");
            assert.equal(mockUsers["user-a-id"].total_solved, 0, "Persisted users.total_solved must be reset to 0");
        });

        test("H2: Users with no eligible platforms receive zero persisted score", async () => {
            mockUsers["user-a-id"].orbix_score = 3200;
            mockUsers["user-a-id"].total_solved = 900;
            mockLinks = [];

            const result = await syncLeaderboardForUser("user_a");
            assert.ok(result);
            assert.equal(result.score, 0);
            assert.equal(result.totalSolved, 0);
            assert.equal(mockUsers["user-a-id"].orbix_score, 0);
            assert.equal(mockUsers["user-a-id"].total_solved, 0);
        });

        test("H3: Interrupted and repeated batch recalculation is idempotent and gapless", async () => {
            const u1 = "11111111-1111-1111-1111-111111111111";
            const u2 = "22222222-2222-2222-2222-222222222222";
            const u3 = "33333333-3333-3333-3333-333333333333";
            mockUsers = {
                [u1]: { id: u1, username: "user_1", is_public: true, orbix_score: 1000 },
                [u2]: { id: u2, username: "user_2", is_public: true, orbix_score: 2000 },
                [u3]: { id: u3, username: "user_3", is_public: true, orbix_score: 3000 },
            };

            mockLinks = [
                { id: "l1", user_id: u1, portal: "leetcode", portal_username: "u1", ownership_status: "CONNECTED_UNVERIFIED", is_public: true, leaderboard_snapshot: makeSnapshot("leetcode", "u1", { totalSolved: 100 }) },
                { id: "l2", user_id: u2, portal: "leetcode", portal_username: "u2", ownership_status: "CONNECTED_UNVERIFIED", is_public: true, leaderboard_snapshot: makeSnapshot("leetcode", "u2", { totalSolved: 200 }) },
                { id: "l3", user_id: u3, portal: "leetcode", portal_username: "u3", ownership_status: "CONNECTED_UNVERIFIED", is_public: true, leaderboard_snapshot: makeSnapshot("leetcode", "u3", { totalSolved: 300 }) },
            ];

            // Batch 1: first two users
            for (const uid of [u1, u2]) {
                await syncLeaderboardForUser(uid, { invalidateCache: false });
            }

            // Batch 2 (after interruption): remaining user
            for (const uid of [u3]) {
                await syncLeaderboardForUser(uid, { invalidateCache: false });
            }

            assert.equal(mockUsers[u1].orbix_score, 0);
            assert.equal(mockUsers[u2].orbix_score, 0);
            assert.equal(mockUsers[u3].orbix_score, 0);

            // Repeat recalculation: verifying idempotency
            for (const uid of [u1, u2, u3]) {
                const res = await syncLeaderboardForUser(uid, { invalidateCache: false });
                assert.equal(res?.score, 0);
                assert.equal(mockUsers[uid].orbix_score, 0);
            }
        });

        test("H4: Global cache invalidation purges global pages, rankings, and stats", async (t) => {
            const cacheStore = new Map<string, string>();
            const status = redis.status;
            redis.status = "ready";
            t.after(() => { redis.status = status; });

            t.mock.method(redis, "keys", async (pattern: string) => {
                const prefix = pattern.replace(/\*$/, "");
                const matched: string[] = [];
                for (const k of cacheStore.keys()) {
                    if (k.startsWith(prefix) || pattern === "*") matched.push(k);
                }
                return matched;
            });
            t.mock.method(redis, "del", async (...keys: string[]) => {
                for (const k of keys) cacheStore.delete(k);
                return keys.length;
            });

            cacheStore.set("orbix:leaderboard:public-links-v4:live:global:all:all:p1:l50:snone", "{\"page\":1}");
            cacheStore.set("orbix:leaderboard:public-links-v4:live:userrank:user_a:global", "{\"rank\":1}");
            cacheStore.set("orbix:leaderboard:public-links-v4:live:colleges:participating", "{\"count\":10}");

            assert.equal(cacheStore.size, 3);
            await cacheLeaderboard.invalidate();
            assert.equal(cacheStore.size, 0, "Global invalidation must clear all matching keys");
        });

        test("H5: College cache invalidation purges affected college ranking while isolating others", async (t) => {
            const cacheStore = new Map<string, string>();
            const status = redis.status;
            redis.status = "ready";
            t.after(() => { redis.status = status; });

            t.mock.method(redis, "keys", async (pattern: string) => {
                const prefix = pattern.replace(/\*$/, "");
                const matched: string[] = [];
                for (const k of cacheStore.keys()) {
                    if (k.startsWith(prefix)) matched.push(k);
                }
                return matched;
            });
            t.mock.method(redis, "del", async (...keys: string[]) => {
                for (const k of keys) cacheStore.delete(k);
                return keys.length;
            });

            cacheStore.set("orbix:leaderboard:public-links-v4:live:college:inst-1:all:all:p1:l50:snone", "{\"college\":\"Tech\"}");
            cacheStore.set("orbix:leaderboard:public-links-v4:live:college:inst-2:all:all:p1:l50:snone", "{\"college\":\"State\"}");

            // Invalidate inst-1
            await cacheLeaderboard.invalidate({ collegeId: "inst-1" });
            assert.equal(cacheStore.has("orbix:leaderboard:public-links-v4:live:college:inst-1:all:all:p1:l50:snone"), false);
            assert.equal(cacheStore.has("orbix:leaderboard:public-links-v4:live:college:inst-2:all:all:p1:l50:snone"), true);

            // Invalidate all colleges
            await cacheLeaderboard.invalidate();
            assert.equal(cacheStore.has("orbix:leaderboard:public-links-v4:live:college:inst-2:all:all:p1:l50:snone"), false);
        });

        test("H6: Platform ownership revocation immediately strips persisted score and points", async () => {
            mockLinks.push({
                id: "link-h6",
                user_id: "user-a-id",
                portal: "codeforces",
                portal_username: "alice_cf",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("codeforces", "alice_cf", {
                    totalSolved: 200,
                    rating: 1750,
                }),
            });

            const initial = await syncLeaderboardForUser("user_a");
            assert.ok(initial);
            assert.ok(initial.score > 0);
            assert.equal(initial.totalSolved, 200);

            // Revoke ownership
            const revoked = await platformVerificationService.revokeOwnership("user-a-id", "codeforces");
            assert.equal(revoked, true);
            assert.equal(mockLinks[0]!.ownership_status, "REVOKED");

            // Recalculation triggers: score must be 0
            const afterRevocation = await syncLeaderboardForUser("user_a");
            assert.ok(afterRevocation);
            assert.equal(afterRevocation.score, 0);
            assert.equal(afterRevocation.totalSolved, 0);
            assert.equal(mockUsers["user-a-id"].orbix_score, 0);
        });

        test("H7: Successful verification restores eligible contribution after revocation", async () => {
            mockLinks.push({
                id: "link-h7",
                user_id: "user-a-id",
                portal: "codeforces",
                portal_username: "alice_cf",
                verified: false,
                ownership_status: "REVOKED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("codeforces", "alice_cf", {
                    totalSolved: 200,
                    rating: 1750,
                }),
            });

            const zeroRes = await syncLeaderboardForUser("user_a");
            assert.equal(zeroRes?.score, 0);

            // Re-verify
            mockLinks[0]!.ownership_status = "VERIFIED";
            mockLinks[0]!.verified = true;

            const restoredRes = await syncLeaderboardForUser("user_a");
            assert.ok(restoredRes);
            assert.ok(restoredRes.score > 0);
            assert.equal(restoredRes.totalSolved, 200);
            assert.ok(mockUsers["user-a-id"].orbix_score > 0);
        });

        test("H8: Missing ownership schema column strictly fails closed during recalculation", async () => {
            simulateMissingColumn = true;
            resetSchemaStateCache();

            mockLinks.push({
                id: "link-h8",
                user_id: "user-a-id",
                portal: "leetcode",
                portal_username: "user_in_unmigrated_db",
                verified: true,
                ownership_status: "VERIFIED",
                is_public: true,
                leaderboard_snapshot: makeSnapshot("leetcode", "user_in_unmigrated_db", {
                    totalSolved: 600,
                    rating: 1900,
                }),
            });

            const result = await syncLeaderboardForUser("user_a");
            assert.equal(result?.score, 0, "Unmigrated schema must fail closed to 0 score");
            assert.equal(result?.totalSolved, 0);
            assert.equal(mockUsers["user-a-id"].orbix_score, 0);

            const userLinksQuery = queries.find(
                (q) => q.sql.includes("FROM user_links") && q.sql.includes("leaderboard_snapshot")
            );
            assert.ok(userLinksQuery);
            assert.match(userLinksQuery.sql, /1 = 0/);
        });
    });
});
