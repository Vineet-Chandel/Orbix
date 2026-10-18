import "dotenv/config";
import { query, pool } from "./src/database/client.js";

async function testLeaderboardQuery() {
    console.log("Testing Leaderboard Database Queries...");

    // 1. Total count
    const countRes = await query("SELECT COUNT(*) as total FROM leaderboard_entries WHERE is_public = true;");
    console.log("Total coders:", countRes.rows[0].total);

    // 2. Podium (Top 3)
    const podiumRes = await query(`
        SELECT 
            user_id, username, display_name, avatar_url, college, is_verified,
            score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
            rank, updated_at
        FROM (
            SELECT 
                user_id, username, display_name, avatar_url, college, is_verified,
                score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
                DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank,
                updated_at
            FROM leaderboard_entries
            WHERE is_public = true
        ) ranked
        WHERE rank <= 3
        ORDER BY rank ASC;
    `);

    console.log("Podium count:", podiumRes.rows.length);
    podiumRes.rows.forEach(r => {
        console.log(`  Rank ${r.rank}: ${r.display_name} (@${r.username}) - ${r.score} pts [${r.college}]`);
    });

    // 3. Paginated page 1
    const page1Res = await query(`
        SELECT 
            user_id, username, display_name, avatar_url, college, is_verified,
            score, total_solved, total_contests, streak, rank
        FROM (
            SELECT 
                user_id, username, display_name, avatar_url, college, is_verified,
                score, total_solved, total_contests, streak,
                DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
            FROM leaderboard_entries
            WHERE is_public = true
        ) ranked
        ORDER BY rank ASC
        LIMIT 5 OFFSET 0;
    `);

    console.log("\nPage 1 (first 5 coders):");
    page1Res.rows.forEach(r => {
        console.log(`  #${r.rank}: ${r.display_name} (@${r.username}) - ${r.score} pts`);
    });

    // 4. Test search filter
    const searchRes = await query(`
        SELECT 
            user_id, username, display_name, college, score, rank
        FROM (
            SELECT 
                user_id, username, display_name, college, score,
                DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
            FROM leaderboard_entries
            WHERE is_public = true AND (username ILIKE $1 OR display_name ILIKE $1 OR college ILIKE $1)
        ) ranked
        ORDER BY rank ASC;
    `, ["%IIT%"]);

    console.log("\nSearch for 'IIT' count:", searchRes.rows.length);
    searchRes.rows.forEach(r => {
        console.log(`  #${r.rank}: ${r.display_name} (@${r.username}) - ${r.college}`);
    });

    await pool.end();
    console.log("\n✅ All Leaderboard DB Queries Passed!");
}

testLeaderboardQuery().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
