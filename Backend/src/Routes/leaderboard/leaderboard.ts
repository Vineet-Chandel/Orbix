import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import {
    computeOrbixScoreFromPortals,
    type OrbixScoreResult,
} from "../../scoring/orbixScore.js";
import {
    getCodeforcesTier,
    getLeetCodeTier,
    getCodeChefTier,
    getAtCoderTier,
} from "../../utils/ratingSystems.js";

const leaderboardRouter = express.Router();

export interface LeaderboardEntryDTO {
    rank: number;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    college: string | null;
    isVerified: boolean;
    score: number;
    scoreBreakdown: any;
    totalSolved: number;
    totalContests: number;
    platformRatings: Record<string, {
        rating: number;
        tier?: string;
        color?: string;
        badge?: string;
    }>;
    streak: number;
    updatedAt: string;
}

/**
 * Recalculates and updates the leaderboard projection for a single user.
 */
export async function syncLeaderboardForUser(username: string): Promise<LeaderboardEntryDTO | null> {
    const cleanUser = (username || "").trim();
    if (!cleanUser) return null;

    // 1. Fetch user record
    const userRes = await query(
        `SELECT id, username, firstname, lastname, avatar_url, photo_url, college, is_verified_coder, is_public,
                orbix_score, orbix_score_breakdown, total_solved, total_contests, streak, platform_ratings
         FROM users
         WHERE username = $1
         LIMIT 1;`,
        [cleanUser]
    );

    if (userRes.rows.length === 0) {
        return null;
    }

    const u = userRes.rows[0];
    const userId = u.id;
    const displayName = `${u.firstname || u.firstName || ""} ${u.lastname || u.lastName || ""}`.trim() || u.username;
    const avatarUrl = u.photo_url || u.avatar_url || null;
    const college = u.college || null;
    const isVerified = Boolean(u.is_verified_coder);
    const isPublic = u.is_public !== false;

    // 2. Fetch all linked portals for this user
    const linksRes = await query(
        `SELECT portal, portal_username, display_name, avatar_url, stats, snapshot, verified, last_sync_status
         FROM user_links
         WHERE username = $1 AND is_public = true;`,
        [cleanUser]
    );

    // If user has no user_links entries but already has a precomputed orbix_score > 0 in users table, preserve it
    if (linksRes.rows.length === 0 && u.orbix_score && Number(u.orbix_score) > 0) {
        const score = Number(u.orbix_score);
        const scoreBreakdown = u.orbix_score_breakdown || {};
        const finalSolved = Number(u.total_solved || 0);
        const finalContests = Number(u.total_contests || 0);
        const streak = Number(u.streak || 0);
        const platRatings = u.platform_ratings || {};

        const upsertRes = await query(
            `INSERT INTO leaderboard_entries (
                user_id, username, display_name, avatar_url, college, is_verified,
                score, score_breakdown, total_solved, total_contests, platform_ratings,
                streak, is_public, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url,
                college = EXCLUDED.college,
                is_verified = EXCLUDED.is_verified,
                score = EXCLUDED.score,
                score_breakdown = EXCLUDED.score_breakdown,
                total_solved = EXCLUDED.total_solved,
                total_contests = EXCLUDED.total_contests,
                platform_ratings = EXCLUDED.platform_ratings,
                streak = EXCLUDED.streak,
                is_public = EXCLUDED.is_public,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *;`,
            [
                userId,
                cleanUser,
                displayName,
                avatarUrl,
                college,
                isVerified,
                score,
                JSON.stringify(scoreBreakdown),
                finalSolved,
                finalContests,
                JSON.stringify(platRatings),
                streak,
                isPublic,
            ]
        );

        await clearLeaderboardCache();
        const row = upsertRes.rows[0];
        return {
            rank: row.global_rank || 1,
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            college: row.college,
            isVerified: row.is_verified,
            score: row.score,
            scoreBreakdown: row.score_breakdown,
            totalSolved: row.total_solved,
            totalContests: row.total_contests,
            platformRatings: row.platform_ratings,
            streak: row.streak,
            updatedAt: row.updated_at,
        };
    }

    const portalsMap: Record<string, any> = {};
    const platformRatings: Record<string, { rating: number; tier?: string; color?: string; badge?: string }> = {};

    let totalSolvedAcc = 0;
    let totalContestsAcc = 0;

    for (const link of linksRes.rows) {
        const portal = link.portal.toLowerCase().trim();
        const snap = link.snapshot && typeof link.snapshot === "object" ? link.snapshot : {};
        const stats = Array.isArray(link.stats) ? link.stats : [];

        // Build composite profile
        portalsMap[portal] = {
            ...snap,
            portal,
            portal_username: link.portal_username,
            stats,
            verified: link.verified !== false,
        };

        // Extract rating chips
        let rVal = snap.rating || snap.contestRating || snap.currentRating;
        if (typeof rVal !== "number" || rVal <= 0) {
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                if (lbl === "rating" || lbl.includes("rating")) {
                    const m = (s.value || "").match(/(\d+)/);
                    if (m && m[1]) {
                        rVal = parseInt(m[1], 10);
                        break;
                    }
                }
            }
        }

        if (typeof rVal === "number" && rVal > 0) {
            if (portal === "codeforces") {
                const tier = getCodeforcesTier(rVal);
                platformRatings.codeforces = { rating: rVal, tier: tier.name, color: tier.color };
            } else if (portal === "leetcode") {
                const tier = getLeetCodeTier(rVal, snap.badge || snap.officialBadge);
                platformRatings.leetcode = { rating: rVal, badge: tier.name, color: tier.color };
            } else if (portal === "codechef") {
                const tier = getCodeChefTier(rVal);
                platformRatings.codechef = { rating: rVal, tier: tier.name, color: tier.color };
            } else if (portal === "atcoder") {
                const tier = getAtCoderTier(rVal);
                platformRatings.atcoder = { rating: rVal, tier: tier.name, color: tier.color };
            } else if (portal === "topcoder") {
                platformRatings.topcoder = { rating: rVal, color: "#00aaff" };
            }
        }

        // Extract solves
        const solved = snap.difficulty?.total || snap.solvedTotal;
        if (typeof solved === "number" && solved > 0) {
            totalSolvedAcc += solved;
        } else {
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                if (lbl.includes("solved") || lbl.includes("problems")) {
                    const m = (s.value || "").match(/(\d+)/);
                    if (m) totalSolvedAcc += parseInt(m[1], 10);
                }
            }
        }

        // Extract contests
        if (typeof snap.ratedContestsCount === "number") {
            totalContestsAcc += snap.ratedContestsCount;
        } else {
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                if (lbl === "contests" || lbl.includes("contest")) {
                    const m = (s.value || "").match(/(\d+)/);
                    if (m && m[1]) totalContestsAcc += parseInt(m[1], 10);
                }
            }
        }
    }

    // 3. Compute score using the official Orbix Score Engine
    const scoreResult: OrbixScoreResult = computeOrbixScoreFromPortals(portalsMap, [], {
        activeDays: 0,
        currentStreak: 0,
    });

    const score = scoreResult.totalScore;
    const scoreBreakdown = scoreResult.breakdown;
    const finalSolved = Math.max(totalSolvedAcc, scoreBreakdown.problems.totalSolved);
    const finalContests = Math.max(totalContestsAcc, scoreBreakdown.contests.ratedCount);
    const streak = scoreBreakdown.activity.currentStreak || 0;

    // 4. Update users table with calculated metrics
    await query(
        `UPDATE users
         SET orbix_score = $1,
             orbix_score_breakdown = $2,
             orbix_score_version = $3,
             orbix_score_updated_at = CURRENT_TIMESTAMP,
             streak = $4,
             total_solved = $5,
             total_contests = $6,
             platform_ratings = $7
         WHERE id = $8;`,
        [
            score,
            JSON.stringify(scoreBreakdown),
            scoreResult.version,
            streak,
            finalSolved,
            finalContests,
            JSON.stringify(platformRatings),
            userId,
        ]
    );

    // 5. Upsert into leaderboard_entries projection
    const upsertRes = await query(
        `INSERT INTO leaderboard_entries (
            user_id, username, display_name, avatar_url, college, is_verified,
            score, score_breakdown, total_solved, total_contests, platform_ratings,
            streak, is_public, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            avatar_url = EXCLUDED.avatar_url,
            college = EXCLUDED.college,
            is_verified = EXCLUDED.is_verified,
            score = EXCLUDED.score,
            score_breakdown = EXCLUDED.score_breakdown,
            total_solved = EXCLUDED.total_solved,
            total_contests = EXCLUDED.total_contests,
            platform_ratings = EXCLUDED.platform_ratings,
            streak = EXCLUDED.streak,
            is_public = EXCLUDED.is_public,
            updated_at = CURRENT_TIMESTAMP
         RETURNING *;`,
        [
            userId,
            cleanUser,
            displayName,
            avatarUrl,
            college,
            isVerified,
            score,
            JSON.stringify(scoreBreakdown),
            finalSolved,
            finalContests,
            JSON.stringify(platformRatings),
            streak,
            isPublic,
        ]
    );

    // Invalidate Redis caches
    await clearLeaderboardCache();

    const row = upsertRes.rows[0];
    return {
        rank: row.global_rank || 1,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        college: row.college,
        isVerified: row.is_verified,
        score: row.score,
        scoreBreakdown: row.score_breakdown,
        totalSolved: row.total_solved,
        totalContests: row.total_contests,
        platformRatings: row.platform_ratings,
        streak: row.streak,
        updatedAt: row.updated_at,
    };
}

/**
 * Clear Redis cache keys matching leaderboard query patterns
 */
export async function clearLeaderboardCache(): Promise<void> {
    try {
        if (!redis) return;
        const keys = await redis.keys("orbix:leaderboard:*");
        if (keys && keys.length > 0) {
            await redis.del(...keys);
        }
    } catch (err) {
        console.warn("Failed to clear leaderboard Redis cache:", err);
    }
}

/**
 * GET /api/leaderboard
 * Paginated global coding leaderboard with top-3 podium and caller ranking.
 */
leaderboardRouter.get("/", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
        const period = String(req.query.period || "all_time").toLowerCase().trim();
        const search = req.query.search ? String(req.query.search).trim() : "";
        const filter = String(req.query.filter || "all").toLowerCase().trim(); // "all" | "verified"

        const cacheKey = `orbix:leaderboard:${period}:${filter}:p${page}:l${limit}:s${search}`;
        const targetUser = String(req.query.user || req.query.username || req.user?.username || "").trim();

        // 1. Check Redis cache for fast read response
        if (redis && !search) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    // Attach caller's real-time rank if requested or authenticated
                    if (targetUser) {
                        parsed.currentUser = await getUserRank(targetUser);
                    } else {
                        parsed.currentUser = null;
                    }
                    return res.status(200).json({ ...parsed, cached: true });
                }
            } catch {
                // Ignore cache read error and proceed to DB
            }
        }

        // 2. Query Total Count
        const countParams: any[] = [];
        let countWhere = "WHERE is_public = true";
        if (filter === "verified") {
            countWhere += " AND is_verified = true";
        }
        if (search) {
            countParams.push(`%${search}%`);
            countWhere += ` AND (username ILIKE $${countParams.length} OR display_name ILIKE $${countParams.length} OR college ILIKE $${countParams.length})`;
        }

        const countQuery = `SELECT COUNT(*) as total FROM leaderboard_entries ${countWhere};`;
        const countRes = await query(countQuery, countParams);
        const totalCoders = parseInt(countRes.rows[0]?.total || "0", 10);
        const totalPages = Math.max(1, Math.ceil(totalCoders / limit));

        // 3. Top-3 Podium Query (Always fetch overall rank 1, 2, 3)
        const podiumQuery = `
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
        `;
        const podiumRes = await query(podiumQuery);
        const podium: LeaderboardEntryDTO[] = podiumRes.rows.map((r: any) => ({
            rank: parseInt(r.rank, 10),
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            college: r.college,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 4. Paginated Ranking Query
        const offset = (page - 1) * limit;
        const queryParams: any[] = [];
        let whereClause = "WHERE is_public = true";

        if (filter === "verified") {
            whereClause += " AND is_verified = true";
        }
        if (search) {
            queryParams.push(`%${search}%`);
            whereClause += ` AND (username ILIKE $${queryParams.length} OR display_name ILIKE $${queryParams.length} OR college ILIKE $${queryParams.length})`;
        }

        queryParams.push(limit);
        const limitParamIdx = queryParams.length;
        queryParams.push(offset);
        const offsetParamIdx = queryParams.length;

        const paginatedQuery = `
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
                ${whereClause}
            ) ranked
            ORDER BY rank ASC
            LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
        `;

        const pageRes = await query(paginatedQuery, queryParams);
        const entries: LeaderboardEntryDTO[] = pageRes.rows.map((r: any) => ({
            rank: parseInt(r.rank, 10),
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            college: r.college,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 5. Current User Rank
        let currentUser: any = null;
        if (targetUser) {
            currentUser = await getUserRank(targetUser);
        }

        const responsePayload = {
            success: true,
            metadata: {
                title: "Global Ranking",
                description:
                    "Ranked by Orbix Score, a unified measure of problem-solving performance, rated contest participation, coding consistency, and supported developer contributions.",
                period,
                totalCoders,
                page,
                limit,
                totalPages,
                lastUpdated: new Date().toISOString(),
            },
            podium,
            entries,
            currentUser,
        };

        // Cache in Redis for 5 minutes if not a personalized search (without caller-specific currentUser)
        if (redis && !search) {
            try {
                const cachePayload = { ...responsePayload, currentUser: null };
                await redis.setex(cacheKey, 300, JSON.stringify(cachePayload));
            } catch {
                // Ignore cache write error
            }
        }

        return res.status(200).json(responsePayload);
    } catch (error: any) {
        console.error("Error in GET /api/leaderboard:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch global coding leaderboard",
            error: error.message || error,
        });
    }
});

/**
 * Helper to fetch a single user's rank position and metrics
 */
async function getUserRank(username: string): Promise<LeaderboardEntryDTO | null> {
    try {
        let rankRes = await query(
            `SELECT 
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
            WHERE username = $1
            LIMIT 1;`,
            [username]
        );

        if (rankRes.rows.length === 0) {
            // Attempt automatic synchronization
            await syncLeaderboardForUser(username);
            rankRes = await query(
                `SELECT 
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
                WHERE username = $1
                LIMIT 1;`,
                [username]
            );
        }

        if (rankRes.rows.length === 0) return null;
        const r = rankRes.rows[0];
        return {
            rank: parseInt(r.rank, 10),
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            college: r.college,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        };
    } catch {
        return null;
    }
}

/**
 * GET /api/leaderboard/rank/:username
 * Fetch rank and breakdown for a given public coder
 */
leaderboardRouter.get("/rank/:username", async (req: Request, res: Response) => {
    try {
        const rawUser = req.params.username;
        const username = Array.isArray(rawUser) ? rawUser[0] : rawUser;
        if (!username) {
            return res.status(400).json({ success: false, message: "Username is required" });
        }

        const userRank = await getUserRank(username);
        if (!userRank) {
            return res.status(404).json({ success: false, message: "Coder not found on the leaderboard" });
        }

        return res.status(200).json({
            success: true,
            user: userRank,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user rank",
            error: error.message || error,
        });
    }
});

/**
 * POST /api/leaderboard/sync
 * Authorized manual Sync Now endpoint.
 * Recalculates caller's Orbix Score and updates their position on the Global Leaderboard.
 */
leaderboardRouter.post("/sync", authenticate, async (req: Request, res: Response) => {
    try {
        const effectiveUser = req.user?.username;
        if (!effectiveUser) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Synchronize and update leaderboard projection
        const updatedEntry = await syncLeaderboardForUser(effectiveUser);

        if (!updatedEntry) {
            return res.status(404).json({ success: false, message: "User account not found for synchronization" });
        }

        return res.status(200).json({
            success: true,
            message: "Successfully synchronized coding profile and updated Orbix Score",
            entry: updatedEntry,
        });
    } catch (error: any) {
        console.error("Error in POST /api/leaderboard/sync:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to sync leaderboard profile",
            error: error.message || error,
        });
    }
});

/**
 * POST /api/leaderboard/recalculate-all
 * Internal batch recalculation of all public profiles
 */
leaderboardRouter.post("/recalculate-all", async (req: Request, res: Response) => {
    try {
        const usersRes = await query("SELECT username FROM users WHERE is_public = true LIMIT 500;");
        let updatedCount = 0;

        for (const row of usersRes.rows) {
            try {
                await syncLeaderboardForUser(row.username);
                updatedCount++;
            } catch (e) {
                console.warn(`Failed to sync leaderboard for ${row.username}:`, e);
            }
        }

        await clearLeaderboardCache();

        return res.status(200).json({
            success: true,
            message: `Successfully recalculated Orbix Scores for ${updatedCount} coders`,
            updatedCount,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Failed to recalculate leaderboard",
            error: error.message || error,
        });
    }
});

export default leaderboardRouter;
