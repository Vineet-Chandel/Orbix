import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { calculateUnifiedSubmissions } from "../../Routes/portals/portals.js";
import { syncLeaderboardForUser } from "../../Routes/leaderboard/leaderboard.js";
import { resetSchemaStateCache } from "./schemaCompatibility.js";

const originalQuery = pool.query;
const originalFetch = globalThis.fetch;
const queries: Array<{ sql: string; values: any[] }> = [];
let leaderboardRead = false;
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
    redis.disconnect();
    resetSchemaStateCache();
    queries.length = 0;
    leaderboardRead = false;
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    (pool as any).query = async (sql: string, values: any[] = []) => {
        queries.push({ sql, values });
        if (sql.includes("information_schema.")) return { rows: [{ exists: 1 }] };
        if (sql.includes("FROM user_links")) return { rows: leaderboardRead ? [] : [{
            portal: "leetcode", portal_username: "connected-user", verified: false, stats: [],
            snapshot: { success: true, portal: "leetcode", username: "connected-user", name: "Connected User", stats: [], totalSolved: 5, totalSubmissions: 2, submissionCalendar: { [today]: 2 } },
        }] };
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

test("leaderboard ignores legacy scores and streaks when there are no verified platform contributions", async () => {
    leaderboardRead = true;
    const result = await syncLeaderboardForUser("coder");
    assert.equal(result?.score, 0);
    assert.equal(result?.totalSolved, 0);
    assert.equal(result?.streak, 0);
    const selection = queries.find(({ sql }) => sql.includes("FROM user_links"));
    assert.ok(selection);
    assert.match(selection.sql, /ownership_status = 'VERIFIED'/);
});
