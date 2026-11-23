import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { calculateUnifiedSubmissions } from "../../Routes/portals/portals.js";
import leaderboardRouter, { syncLeaderboardForUser } from "../../Routes/leaderboard/leaderboard.js";
import { resetSchemaStateCache } from "./schemaCompatibility.js";

const originalQuery = pool.query;
const originalFetch = globalThis.fetch;
const queries: Array<{ sql: string; values: any[] }> = [];
const unverifiedLink = {
    portal: "leetcode",
    portal_username: "connected-user",
    verified: false,
    is_public: true,
    stats: [],
};
let links: Array<Record<string, unknown>> = [];

function providerSnapshot(portal: string, handle: string, data: Record<string, unknown>) {
    return { portal, handle, profile: { success: true, stats: [], ...data } };
}
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
    redis.disconnect();
    resetSchemaStateCache();
    queries.length = 0;
    links = [{
        ...unverifiedLink,
        leaderboard_snapshot: providerSnapshot("leetcode", "connected-user", { totalSolved: 5 }),
        snapshot: { success: true, portal: "leetcode", username: "connected-user", name: "Connected User", stats: [], totalSolved: 5, totalSubmissions: 2, submissionCalendar: { [today]: 2 } },
    }];
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    (pool as any).query = async (sql: string, values: any[] = []) => {
        queries.push({ sql, values });
        if (sql.includes("information_schema.")) return { rows: [{ exists: 1 }] };
        if (sql.includes("FROM user_links") && !sql.includes("leaderboard_entries")) {
            const publicOnly = sql.includes("is_public IS NOT FALSE");
            return { rows: links.filter((link) => !publicOnly || link.is_public !== false) };
        }
        if (sql.includes("FROM users")) return { rows: [{ id: "user-id", username: "coder", email: "coder@example.test", orbix_score: 9000, total_solved: 9000, total_contests: 100, streak: 365, is_public: true }] };
        if (sql.includes("INSERT INTO leaderboard_entries")) return { rows: [{ user_id: values[0], username: values[1], score: values[7], score_breakdown: JSON.parse(values[8]), total_solved: values[9], total_contests: values[10], platform_ratings: JSON.parse(values[11]), streak: values[12] }] };
        return { rows: [], rowCount: 1 };
    };
});

after(async () => {
    (pool as any).query = originalQuery;
    globalThis.fetch = originalFetch;
    redis.disconnect();
    await pool.end();
});

test("an unverified saved connection contributes its real calendar to dashboard activity", async () => {
    const result = await calculateUnifiedSubmissions("coder");
    assert.equal(result.dailyMerged[today]?.count, 2);
    assert.equal(result.platformBreakdown.leetcode?.username, "connected-user");
    const selection = queries.find(({ sql }) => sql.includes("FROM user_links"));
    assert.ok(selection);
    assert.doesNotMatch(selection.sql, /ownership_status|verified\s*=\s*true/);
});

test("unverified public platform activity contributes to the Orbix Score", async () => {
    const result = await syncLeaderboardForUser("coder");
    assert.ok(result);
    assert.ok(result.score > 0);
    assert.equal(result.totalSolved, 5);
    const selection = queries.find(({ sql }) => sql.includes("FROM user_links"));
    assert.ok(selection);
    assert.match(selection.sql, /WHERE user_id = \$1 AND is_public IS NOT FALSE/);
    assert.doesNotMatch(selection.sql, /ownership_status|verified/);
    assert.deepEqual(selection.values, ["user-id"]);
});

test("mixed ownership states contribute while private connections stay out", async () => {
    const publicOnly = await syncLeaderboardForUser("coder");
    links.push(
        { portal: "codeforces", portal_username: "cf-user", verified: true, is_public: true, stats: [], leaderboard_snapshot: providerSnapshot("codeforces", "cf-user", { totalSolved: 17, rating: 1400 }) },
        { portal: "codechef", portal_username: "private-user", verified: true, is_public: false, stats: [], leaderboard_snapshot: providerSnapshot("codechef", "private-user", { totalSolved: 5000, rating: 2800 }) },
    );
    const result = await syncLeaderboardForUser("user-id");
    assert.ok(result && publicOnly);
    assert.equal(result.username, "coder");
    assert.equal(result.totalSolved, 22);
    assert.ok(result.score > publicOnly.score);
    assert.equal(result.platformRatings.codeforces?.rating, 1400);
    assert.equal(result.platformRatings.codechef, undefined);
});

test("a newly linked unverified handle can score using the server's provider data", async (t) => {
    delete links[0]?.leaderboard_snapshot;
    const status = redis.status;
    redis.status = "ready";
    t.after(() => { redis.status = status; });
    t.mock.method(redis, "get", async (key: string) => {
        assert.equal(key, "portal:profile:leetcode:connected-user");
        return JSON.stringify({ success: true, stats: [], totalSolved: 8 });
    });

    const result = await syncLeaderboardForUser("coder", { invalidateCache: false });
    assert.equal(result?.totalSolved, 8);
    const stored = queries.find(({ sql }) => sql.includes("SET leaderboard_snapshot"));
    assert.ok(stored);
    assert.equal(JSON.parse(stored.values[0]).handle, "connected-user");
    assert.match(stored.sql, /AND portal_username = \$5/);
});

test("client snapshots and cached stats for a replaced handle cannot set the score", async () => {
    links[0] = {
        ...links[0],
        portal_username: "different-user",
        snapshot: { totalSolved: 5000, rating: 4000 },
        stats: [{ label: "Streak", value: "365" }],
    };
    const result = await syncLeaderboardForUser("coder");
    assert.equal(result?.score, 0);
    assert.equal(result?.totalSolved, 0);
    assert.equal(result?.streak, 0);
    const selection = queries.find(({ sql }) => sql.includes("FROM user_links"));
    assert.ok(selection);
    assert.match(selection.sql, /portal_username, leaderboard_snapshot/);
    assert.doesNotMatch(selection.sql, /, (?:stats|snapshot)\b/);
});

test("leaderboard ignores legacy scores and streaks when there are no public platform connections", async () => {
    links[0] = { ...links[0], is_public: false };
    const result = await syncLeaderboardForUser("coder");
    assert.equal(result?.score, 0);
    assert.equal(result?.totalSolved, 0);
    assert.equal(result?.streak, 0);
    const selection = queries.find(({ sql }) => sql.includes("FROM user_links"));
    assert.ok(selection);
    assert.match(selection.sql, /is_public IS NOT FALSE/);
});


test("all public ranking views use public connection eligibility", async () => {
    const collegeId = "11111111-1111-1111-1111-111111111111";
    const row = { user_id: "user-id", username: "coder", score: 123, total_solved: 5, rank: 1, college_id: collegeId, is_verified: false, updated_at: today };
    const publicQueries: string[] = [];
    (pool as any).query = async (sql: string) => {
        if (sql.includes("FROM leaderboard_entries") || sql.includes("JOIN leaderboard_entries")) {
            publicQueries.push(sql);
            if (sql.includes("COUNT(*)::int as total")) return { rows: [{ total: 1 }] };
            if (sql.includes("COUNT(DISTINCT college_id)")) return { rows: [{ count: 1 }] };
            return { rows: [row] };
        }
        if (sql.includes("FROM institutions")) return { rows: [{ id: collegeId, officialName: "Example College" }] };
        throw new Error("Unexpected leaderboard test query");
    };

    for (const [path, params] of [
        ["/global", {}],
        ["/colleges/participating", {}],
        ["/colleges/:collegeId", { collegeId }],
        ["/rank/:username", { username: "coder" }],
    ] as const) {
        const layer = leaderboardRouter.stack.find(({ route }) => [route?.path].flat().includes(path));
        assert.ok(layer?.route);
        let status = 200;
        let success = false;
        const res = {
            setHeader: () => undefined,
            status(code: number) { status = code; return this; },
            json(payload: { success: boolean }) { success = payload.success; return this; },
        };
        const start = publicQueries.length;
        const handler = layer.route.stack.at(-1)?.handle;
        assert.ok(handler);
        await handler({ params, query: {} } as any, res as any, (error?: unknown) => { if (error) throw error; });
        assert.equal(status, 200, path);
        assert.equal(success, true, path);
        assert.ok(publicQueries.length > start, path);
        for (const sql of publicQueries.slice(start)) {
            assert.match(sql, /owner\.is_public IS NOT FALSE/, path);
            assert.match(sql, /IN \(SELECT user_id FROM user_links WHERE is_public IS NOT FALSE\)/, path);
            assert.doesNotMatch(sql, /ownership_status|verified\s*=\s*true/, path);
            const demoEnabled = process.env.ORBIX_LEADERBOARD_DEMO === "true" && process.env.NODE_ENV !== "production";
            assert.match(sql, demoEnabled ? /OR EXISTS \(/ : /AND NOT EXISTS \(/, path);
            assert.match(sql, /"demoFixture": true/, path);
        }
    }
});
