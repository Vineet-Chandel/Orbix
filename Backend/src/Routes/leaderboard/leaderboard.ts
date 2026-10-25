import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
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
import cacheLeaderboard from "../../redis/cache/cache-leaderboard.js";

const leaderboardRouter = express.Router();

export interface LeaderboardEntryDTO {
    rank: number;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    college: string | null;
    collegeId: string | null;
    collegeCity?: string | null;
    collegeState?: string | null;
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

export interface CollegeMetadataDTO {
    id: string;
    officialName: string;
    city: string | null;
    state: string | null;
    district?: string | null;
    institutionType?: string | null;
    aisheCode?: string | null;
    verificationStatus?: string | null;
    totalCoders: number;
    topScore?: number;
}

/**
 * Recalculates and updates the leaderboard projection for a single user,
 * keeping both Global and College League projections synchronized.
 */
export async function syncLeaderboardForUser(username: string): Promise<LeaderboardEntryDTO | null> {
    const cleanUser = (username || "").trim();
    if (!cleanUser) return null;

    // 1. Fetch user record including college_id
    const userRes = await query(
        `SELECT id, username, firstname, lastname, avatar_url, photo_url, college, college_id, is_verified_coder, is_public,
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
    let college = u.college || null;
    let collegeId = u.college_id || null;
    const isVerified = Boolean(u.is_verified_coder);
    const isPublic = u.is_public !== false;

    // Harmonize college and college_id with verified institutions directory
    if (collegeId) {
        try {
            const instRes = await query("SELECT official_name FROM institutions WHERE id = $1 LIMIT 1;", [collegeId]);
            if (instRes.rows[0]) {
                college = instRes.rows[0].official_name;
            }
        } catch {
            // Ignore lookup failure
        }
    } else if (college) {
        try {
            const instRes = await query("SELECT id, official_name FROM institutions WHERE official_name ILIKE $1 LIMIT 1;", [college]);
            if (instRes.rows[0]) {
                collegeId = instRes.rows[0].id;
                college = instRes.rows[0].official_name;
            }
        } catch {
            // Ignore lookup failure
        }
    }

    if (college && collegeId && (u.college !== college || u.college_id !== collegeId)) {
        await query("UPDATE users SET college = $1, college_id = $2 WHERE id = $3;", [college, collegeId, userId]).catch(() => null);
    }

    // 2. Fetch all linked portals for this user
    const linksRes = await query(
        `SELECT portal, portal_username, display_name, avatar_url, stats, snapshot, verified, last_sync_status
         FROM user_links
         WHERE (username = $1 OR user_id = $2) AND (is_public IS NULL OR is_public = true);`,
        [cleanUser, userId]
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
                user_id, username, display_name, avatar_url, college, college_id, is_verified,
                score, score_breakdown, total_solved, total_contests, platform_ratings,
                streak, is_public, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                display_name = EXCLUDED.display_name,
                avatar_url = EXCLUDED.avatar_url,
                college = EXCLUDED.college,
                college_id = EXCLUDED.college_id,
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
                collegeId,
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

        await cacheLeaderboard.invalidate({ collegeId: collegeId || undefined });
        const row = upsertRes.rows[0];
        return {
            rank: row.global_rank || 1,
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            college: row.college,
            collegeId: row.college_id,
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

        portalsMap[portal] = {
            ...snap,
            portal,
            portal_username: link.portal_username,
            stats,
            verified: link.verified !== false,
        };

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

    // Extract maximum verified active days and streak from links and user record
    let maxActiveDays = Number(u.streak || 0);
    let maxStreak = Number(u.streak || 0);

    for (const link of linksRes.rows) {
        const stats = Array.isArray(link.stats) ? link.stats : [];
        for (const s of stats) {
            const lbl = (s.label || "").toLowerCase();
            const m = (s.value || "").match(/(\d+)/);
            const count = m ? parseInt(m[1], 10) : 0;
            if (lbl.includes("activedays") || lbl.includes("active days")) {
                if (count > maxActiveDays) maxActiveDays = count;
            }
            if (lbl.includes("streak")) {
                if (count > maxStreak) maxStreak = count;
            }
        }
    }

    // 3. Compute score using the authoritative Orbix Score Engine v2.0.0
    const scoreResult: OrbixScoreResult = computeOrbixScoreFromPortals(portalsMap, [], {
        activeDays: maxActiveDays,
        currentStreak: maxStreak,
    });

    const score = scoreResult.totalScore;
    const scoreBreakdown = scoreResult.breakdown;
    const finalSolved = Math.max(totalSolvedAcc, scoreBreakdown.problems.totalSolved);
    const finalContests = Math.max(totalContestsAcc, scoreBreakdown.contests.ratedCount);
    const streak = Math.max(maxStreak, scoreBreakdown.consistency?.currentStreak || scoreBreakdown.activity?.currentStreak || 0);

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
            user_id, username, display_name, avatar_url, college, college_id, is_verified,
            score, score_breakdown, total_solved, total_contests, platform_ratings,
            streak, is_public, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            avatar_url = EXCLUDED.avatar_url,
            college = EXCLUDED.college,
            college_id = EXCLUDED.college_id,
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
            collegeId,
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
    await cacheLeaderboard.invalidate({ collegeId: collegeId || undefined });

    const row = upsertRes.rows[0];
    return {
        rank: row.global_rank || 1,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        college: row.college,
        collegeId: row.college_id,
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

export async function clearLeaderboardCache(): Promise<void> {
    await cacheLeaderboard.invalidate();
}

/**
 * Fetch distinct count of canonical colleges represented by eligible students
 */
async function getCollegesRepresentedCount(): Promise<number> {
    try {
        const cached = await cacheLeaderboard.getParticipatingColleges();
        if (cached && typeof cached.collegesRepresentedCount === "number") {
            return cached.collegesRepresentedCount;
        }

        const res = await query(`
            SELECT COUNT(DISTINCT college_id)::int as count 
            FROM leaderboard_entries 
            WHERE is_public = true AND college_id IS NOT NULL;
        `);
        return parseInt(res.rows[0]?.count || "0", 10);
    } catch {
        return 0;
    }
}

/**
 * Helper to fetch a single user's global and college rank positions
 */
async function getUserRank(username: string, collegeIdContext?: string | null): Promise<any | null> {
    try {
        let rankRes = await query(
            `SELECT 
                le.user_id, le.username, le.display_name, le.avatar_url, le.college, le.college_id, le.is_verified,
                le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                ranked.rank, le.updated_at,
                i.city as "collegeCity", i.state as "collegeState"
            FROM (
                SELECT 
                    user_id,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                FROM leaderboard_entries
                WHERE is_public = true
            ) ranked
            JOIN leaderboard_entries le ON le.user_id = ranked.user_id
            LEFT JOIN institutions i ON i.id = le.college_id
            WHERE le.username = $1
            LIMIT 1;`,
            [username]
        );

        if (rankRes.rows.length === 0) {
            await syncLeaderboardForUser(username);
            rankRes = await query(
                `SELECT 
                    le.user_id, le.username, le.display_name, le.avatar_url, le.college, le.college_id, le.is_verified,
                    le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                    ranked.rank, le.updated_at,
                    i.city as "collegeCity", i.state as "collegeState"
                FROM (
                    SELECT 
                        user_id,
                        DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                    FROM leaderboard_entries
                    WHERE is_public = true
                ) ranked
                JOIN leaderboard_entries le ON le.user_id = ranked.user_id
                LEFT JOIN institutions i ON i.id = le.college_id
                WHERE le.username = $1
                LIMIT 1;`,
                [username]
            );
        }

        if (rankRes.rows.length === 0) return null;
        const r = rankRes.rows[0];

        // Also determine college rank if user has a college or context is given
        let collegeRank: number | null = null;
        const effectiveCollegeId = collegeIdContext || r.college_id;
        if (effectiveCollegeId) {
            const colRes = await query(`
                SELECT rank FROM (
                    SELECT 
                        user_id,
                        DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                    FROM leaderboard_entries
                    WHERE is_public = true AND college_id = $1
                ) col_ranked
                WHERE user_id = $2
                LIMIT 1;
            `, [effectiveCollegeId, r.user_id]);
            if (colRes.rows[0]) {
                collegeRank = parseInt(colRes.rows[0].rank, 10);
            }
        }

        return {
            rank: parseInt(r.rank, 10),
            collegeRank,
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            college: r.college,
            collegeId: r.college_id,
            collegeCity: r.collegeCity,
            collegeState: r.collegeState,
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
 * GET /api/leaderboard/algorithm
 * Returns authoritative specification, scoring pillars, diminishing returns formulas,
 * platform capability matrix, and anti-gaming rules for the Orbix Score Engine.
 */
leaderboardRouter.get("/algorithm", async (_req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        version: "v2.0.0",
        engineName: "Orbix Score Engine",
        scale: {
            min: 0,
            max: 10000,
            description: "Deterministic 0 to 10,000 Points developer identity rating",
        },
        pillars: [
            {
                id: "problems",
                name: "Problem Solving",
                weight: 0.35,
                weightPercentage: 35,
                maxPoints: 3500,
                description: "Multi-platform problem solving across Easy, Medium, Hard, and Unknown difficulties with logarithmic diminishing returns.",
                formula: "S_problems = min(100, (1 - exp(-RP / 1400)) * 100) where RP = 1*Easy + 3*Medium + 6*Hard + 2*Unknown",
                supportedPlatforms: [
                    "LeetCode", "Codeforces", "CodeChef", "GeeksforGeeks", "HackerRank",
                    "AtCoder", "Code360 / CodingNinjas", "InterviewBit", "TopCoder",
                    "HackerEarth", "CSES", "SPOJ"
                ],
            },
            {
                id: "contests",
                name: "Contest Performance",
                weight: 0.20,
                weightPercentage: 20,
                maxPoints: 2000,
                description: "Competitive contest rating percentiles against official platform tiers and rated contest participation experience.",
                formula: "S_contests = min(100, CompositeRatingNorm * 0.75 + min(25, (1 - exp(-Contests / 12)) * 25))",
                baselines: {
                    codeforces: { baseline: 1000, peak: 2400 },
                    leetcode: { baseline: 1500, peak: 2600 },
                    codechef: { baseline: 1400, peak: 2300 },
                    atcoder: { baseline: 400, peak: 2000 },
                    topcoder: { baseline: 1200, peak: 2200 },
                },
            },
            {
                id: "openSource",
                name: "Open-Source Contributions",
                weight: 0.20,
                weightPercentage: 20,
                maxPoints: 2000,
                description: "Merged pull requests, public code reviews, external repository contributions, and substantive issues resolved.",
                formula: "S_opensource = min(100, (1 - exp(-RawOS / 120)) * 100 + MilestoneBonus) where RawOS = 10*MergedPRs + 12*ExternalRepos + 6*CodeReviews + 3*OpenedPRs + 2*Issues",
                milestoneBonus: "+5 subscore points upon first verified external contribution",
            },
            {
                id: "repositories",
                name: "Repository & Project Quality",
                weight: 0.10,
                weightPercentage: 10,
                maxPoints: 1000,
                description: "Public non-fork repositories, verified community stars, forks, and polyglot language diversity with anti-spam capping.",
                formula: "S_repos = min(100, min(30, Repos*2) + min(45, ln(1+Stars)*7.5) + min(15, ln(1+Forks)*4) + min(10, Languages*2.5))",
            },
            {
                id: "consistency",
                name: "Consistency & Streaks",
                weight: 0.10,
                weightPercentage: 10,
                maxPoints: 1000,
                description: "All-time active coding days, trailing 30-day practice density, and daily streak consistency.",
                formula: "S_consistency = min(100, (1 - exp(-ActiveDays / 150)) * 50 + min(25, (RecentDays30 / 20) * 25) + (1 - exp(-Streak / 60)) * 25)",
            },
            {
                id: "writing",
                name: "Technical Writing & Community",
                weight: 0.05,
                weightPercentage: 5,
                maxPoints: 500,
                description: "Published technical articles, developer guides, and newsletter publications on Medium and Substack.",
                formula: "S_writing = min(100, min(50, Articles * 5) + min(30, ln(1 + Followers) * 5) + min(20, Platforms * 10))",
            },
        ],
        platformCapabilityMatrix: [
            {
                platform: "LeetCode",
                providerId: "leetcode",
                category: "Competitive Programming & Problem Solving",
                connectionSource: "user_links",
                syncMechanism: "Live GraphQL API + Scheduled Resync",
                availableMetrics: "Total solved, Easy/Medium/Hard breakdown, Contest rating, Global rank, Streak, Active days",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 2 (Contests 20%), Pillar 5 (Consistency 10%)",
            },
            {
                platform: "Codeforces",
                providerId: "codeforces",
                category: "Competitive Programming",
                connectionSource: "user_links",
                syncMechanism: "Live REST API + Scheduled Resync",
                availableMetrics: "Total solved, Rating, Max rating, Competitive rank tier, Contest history",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 2 (Contests 20%)",
            },
            {
                platform: "CodeChef",
                providerId: "codechef",
                category: "Competitive Programming",
                connectionSource: "user_links",
                syncMechanism: "Live Scraper / API + Scheduled Resync",
                availableMetrics: "Total solved, Star tier (1★-7★), Global rating, Division",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 2 (Contests 20%)",
            },
            {
                platform: "GeeksforGeeks",
                providerId: "geeksforgeeks",
                category: "Coding Practice",
                connectionSource: "user_links",
                syncMechanism: "Live Profile Fetcher + Scheduled Resync",
                availableMetrics: "Coding score, Problems solved, Difficulty breakdown (School, Basic, Easy, Medium, Hard)",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%)",
            },
            {
                platform: "HackerRank",
                providerId: "hackerrank",
                category: "Coding Practice",
                connectionSource: "user_links",
                syncMechanism: "Live REST API + Scheduled Resync",
                availableMetrics: "Badges, Problem solving stars (1★-6★), Challenges solved",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%)",
            },
            {
                platform: "AtCoder",
                providerId: "atcoder",
                category: "Competitive Programming",
                connectionSource: "user_links",
                syncMechanism: "Kenkoooo API / Live Profile",
                availableMetrics: "Current rating, Highest rating, Tier color (Gray to Red), Rated contests count",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 2 (Contests 20%)",
            },
            {
                platform: "Code360 / CodingNinjas",
                providerId: "code360",
                category: "Coding Practice",
                connectionSource: "user_links",
                syncMechanism: "Live Profile Scraper / API",
                availableMetrics: "Problems solved, Experience points, Streaks",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 5 (Consistency 10%)",
            },
            {
                platform: "InterviewBit",
                providerId: "interviewbit",
                category: "Interview Prep & Practice",
                connectionSource: "user_links",
                syncMechanism: "Live Profile Scraper / REST API",
                availableMetrics: "Score, Problems solved, Streak",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 5 (Consistency 10%)",
            },
            {
                platform: "TopCoder",
                providerId: "topcoder",
                category: "Competitive Programming",
                connectionSource: "user_links",
                syncMechanism: "Live Community API",
                availableMetrics: "SRM rating, Rated contests count",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 2 (Contests 20%)",
            },
            {
                platform: "HackerEarth",
                providerId: "hackerearth",
                category: "Coding Practice",
                connectionSource: "user_links",
                syncMechanism: "Live Profile Fetcher",
                availableMetrics: "Problems solved, Contests attended",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%), Pillar 2 (Contests 20%)",
            },
            {
                platform: "CSES",
                providerId: "cses",
                category: "Algorithm Practice",
                connectionSource: "user_links",
                syncMechanism: "Profile Scraper",
                availableMetrics: "Task count solved in CSES problem set",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%)",
            },
            {
                platform: "SPOJ",
                providerId: "spoj",
                category: "Competitive Programming",
                connectionSource: "user_links",
                syncMechanism: "Profile Scraper / API",
                availableMetrics: "Classical problems solved, World rank",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 1 (Problems 35%)",
            },
            {
                platform: "GitHub",
                providerId: "github",
                category: "Code Hosting & Open Source",
                connectionSource: "user_links",
                syncMechanism: "Live GitHub GraphQL / REST API",
                availableMetrics: "Public repositories, Stars, Commits, PRs merged/opened, Issues, Followers",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 3 (Open Source 20%), Pillar 4 (Repositories 10%)",
            },
            {
                platform: "Medium",
                providerId: "medium",
                category: "Technical Writing",
                connectionSource: "user_links",
                syncMechanism: "RSS / Public Feed Scraper",
                availableMetrics: "Articles published, Followers count, Publication claps",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 6 (Writing 5%)",
            },
            {
                platform: "Substack",
                providerId: "substack",
                category: "Technical Writing & Newsletters",
                connectionSource: "user_links",
                syncMechanism: "Public Feed / Newsletter API",
                availableMetrics: "Posts published, Subscribers/Readers",
                dataCompleteness: "Full",
                scoreIntegration: "Pillar 6 (Writing 5%)",
            },
        ],
        tieBreakingOrder: [
            "1. Authoritative Orbix Score (DESC)",
            "2. Total Problems Solved across all platforms (DESC)",
            "3. Username (ASC, deterministic alphabetical)",
        ],
        antiGamingPolicy: [
            "Logarithmic saturation curves prevent infinite score inflation from repetitive easy problems.",
            "GitHub repository points are strictly bounded to prevent repository spamming or empty repo creation.",
            "Contests and active calendar dates are deduplicated across platforms so the same activity is not counted multiple times.",
            "Server-authoritative resynchronization validates all handles against live external provider APIs.",
        ],
    });
});

/**
 * GET /api/leaderboard/colleges/participating (and /colleges/represented)
 * Returns the distinct canonical colleges currently represented by at least one eligible coder.
 */
leaderboardRouter.get(["/colleges/participating", "/colleges/represented"], async (req: Request, res: Response) => {
    try {
        const cached = await cacheLeaderboard.getParticipatingColleges();
        if (cached) {
            return res.status(200).json({ ...cached, cached: true });
        }

        const collegesRes = await query(`
            SELECT 
                i.id,
                i.official_name as "officialName",
                i.city,
                i.state,
                i.district,
                i.institution_type as "institutionType",
                i.aishe_code as "aisheCode",
                COUNT(le.user_id)::int as "totalCoders",
                MAX(le.score)::int as "topScore"
            FROM institutions i
            INNER JOIN leaderboard_entries le ON le.college_id = i.id
            WHERE le.is_public = true
            GROUP BY i.id, i.official_name, i.city, i.state, i.district, i.institution_type, i.aishe_code
            ORDER BY "totalCoders" DESC, "topScore" DESC, i.official_name ASC;
        `);

        const colleges = collegesRes.rows;
        const collegesRepresentedCount = colleges.length;

        const responsePayload = {
            success: true,
            collegesRepresentedCount,
            total: collegesRepresentedCount,
            colleges,
            lastUpdated: new Date().toISOString(),
        };

        await cacheLeaderboard.setParticipatingColleges(responsePayload);
        return res.status(200).json(responsePayload);
    } catch (error: any) {
        console.error("Error in GET /api/leaderboard/colleges/participating:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch participating colleges",
            error: error.message || error,
        });
    }
});

/**
 * GET /api/leaderboard/colleges/:collegeId
 * Returns the college-specific leaderboard for students of the specified canonical college.
 */
leaderboardRouter.get("/colleges/:collegeId", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const rawCollegeId = String(req.params.collegeId || "").trim();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(rawCollegeId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid college identifier format (UUID required)",
            });
        }

        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
        const period = String(req.query.period || "all_time").toLowerCase().trim();
        const search = req.query.search ? String(req.query.search).trim() : "";
        const filter = String(req.query.filter || "all").toLowerCase().trim();

        const targetUser = String(req.query.user || req.query.username || req.user?.username || "").trim();

        // 1. Verify canonical college exists in institutions directory
        const instRes = await query(`
            SELECT id, official_name as "officialName", city, state, district,
                   institution_type as "institutionType", aishe_code as "aisheCode",
                   verification_status as "verificationStatus"
            FROM institutions
            WHERE id = $1
            LIMIT 1;
        `, [rawCollegeId]);

        if (instRes.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "College not found in verified institutions directory",
            });
        }

        const collegeMeta = instRes.rows[0];

        // 2. Check Redis cache (cache-aside)
        if (!search) {
            const cached = await cacheLeaderboard.getCollegePage(rawCollegeId, period, filter, page, limit);
            if (cached) {
                if (targetUser) {
                    cached.currentUser = await getUserRank(targetUser, rawCollegeId);
                } else {
                    cached.currentUser = null;
                }
                return res.status(200).json({ ...cached, cached: true });
            }
        }

        // 3. Total Eligible Coders in this College
        const countParams: any[] = [rawCollegeId];
        let countWhere = "WHERE is_public = true AND college_id = $1";
        if (filter === "verified") {
            countWhere += " AND is_verified = true";
        }
        if (search) {
            countParams.push(`%${search}%`);
            countWhere += ` AND (username ILIKE $${countParams.length} OR display_name ILIKE $${countParams.length})`;
        }

        const countRes = await query(`SELECT COUNT(*)::int as total FROM leaderboard_entries ${countWhere};`, countParams);
        const totalCoders = countRes.rows[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(totalCoders / limit));

        // 4. College Podium (Top 3 in this college)
        const podiumQuery = `
            SELECT 
                user_id, username, display_name, avatar_url, college, college_id, is_verified,
                score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
                rank, updated_at
            FROM (
                SELECT 
                    user_id, username, display_name, avatar_url, college, college_id, is_verified,
                    score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank,
                    updated_at
                FROM leaderboard_entries
                WHERE is_public = true AND college_id = $1
            ) ranked
            WHERE rank <= 3
            ORDER BY rank ASC;
        `;
        const podiumRes = await query(podiumQuery, [rawCollegeId]);
        const podium: LeaderboardEntryDTO[] = podiumRes.rows.map((r: any) => ({
            rank: parseInt(r.rank, 10),
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            college: r.college,
            collegeId: r.college_id,
            collegeCity: collegeMeta.city,
            collegeState: collegeMeta.state,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 5. Paginated College Standings
        const offset = (page - 1) * limit;
        const queryParams: any[] = [rawCollegeId];
        let whereClause = "WHERE is_public = true AND college_id = $1";

        if (filter === "verified") {
            whereClause += " AND is_verified = true";
        }
        if (search) {
            queryParams.push(`%${search}%`);
            whereClause += ` AND (username ILIKE $${queryParams.length} OR display_name ILIKE $${queryParams.length})`;
        }

        queryParams.push(limit);
        const limitParamIdx = queryParams.length;
        queryParams.push(offset);
        const offsetParamIdx = queryParams.length;

        const paginatedQuery = `
            SELECT 
                user_id, username, display_name, avatar_url, college, college_id, is_verified,
                score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
                rank, updated_at
            FROM (
                SELECT 
                    user_id, username, display_name, avatar_url, college, college_id, is_verified,
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
            collegeId: r.college_id,
            collegeCity: collegeMeta.city,
            collegeState: collegeMeta.state,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 6. Current User Rank within this College
        let currentUser: any = null;
        if (targetUser) {
            currentUser = await getUserRank(targetUser, rawCollegeId);
        }

        // 7. Represented colleges count across the whole platform
        const collegesRepresentedCount = await getCollegesRepresentedCount();

        const responsePayload = {
            success: true,
            scope: "college",
            college: {
                ...collegeMeta,
                totalCoders,
            },
            metadata: {
                title: `${collegeMeta.officialName} League`,
                description: `College standings for ${collegeMeta.officialName} (${collegeMeta.city}, ${collegeMeta.state}) ranked by Orbix Score.`,
                period,
                totalCoders,
                page,
                limit,
                totalPages,
                collegesRepresentedCount,
                lastUpdated: new Date().toISOString(),
            },
            podium,
            entries,
            currentUser,
        };

        if (!search) {
            await cacheLeaderboard.setCollegePage(rawCollegeId, period, filter, page, limit, responsePayload);
        }

        return res.status(200).json(responsePayload);
    } catch (error: any) {
        console.error("Error in GET /api/leaderboard/colleges/:collegeId:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch college leaderboard",
            error: error.message || error,
        });
    }
});

/**
 * GET /api/leaderboard (and /api/leaderboard/global)
 * Paginated global coding leaderboard with top-3 podium, distinct colleges counter, and caller ranking.
 */
leaderboardRouter.get(["/", "/global"], optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
        const period = String(req.query.period || "all_time").toLowerCase().trim();
        const search = req.query.search ? String(req.query.search).trim() : "";
        const filter = String(req.query.filter || "all").toLowerCase().trim(); // "all" | "verified"

        const targetUser = String(req.query.user || req.query.username || req.user?.username || "").trim();

        // 1. Check Redis cache
        if (!search) {
            const cached = await cacheLeaderboard.getGlobalPage(period, filter, page, limit);
            if (cached) {
                if (targetUser) {
                    cached.currentUser = await getUserRank(targetUser);
                } else {
                    cached.currentUser = null;
                }
                return res.status(200).json({ ...cached, cached: true });
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

        const countQuery = `SELECT COUNT(*)::int as total FROM leaderboard_entries ${countWhere};`;
        const countRes = await query(countQuery, countParams);
        const totalCoders = countRes.rows[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(totalCoders / limit));

        // 3. Distinct Colleges Represented Count
        const collegesRepresentedCount = await getCollegesRepresentedCount();

        // 4. Top-3 Podium Query (Always fetch overall rank 1, 2, 3)
        const podiumQuery = `
            SELECT 
                le.user_id, le.username, le.display_name, le.avatar_url, le.college, le.college_id, le.is_verified,
                le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                ranked.rank, le.updated_at,
                i.city as "collegeCity", i.state as "collegeState"
            FROM (
                SELECT 
                    user_id,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                FROM leaderboard_entries
                WHERE is_public = true
            ) ranked
            JOIN leaderboard_entries le ON le.user_id = ranked.user_id
            LEFT JOIN institutions i ON i.id = le.college_id
            WHERE ranked.rank <= 3
            ORDER BY ranked.rank ASC;
        `;
        const podiumRes = await query(podiumQuery);
        const podium: LeaderboardEntryDTO[] = podiumRes.rows.map((r: any) => ({
            rank: parseInt(r.rank, 10),
            userId: r.user_id,
            username: r.username,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
            college: r.college,
            collegeId: r.college_id,
            collegeCity: r.collegeCity,
            collegeState: r.collegeState,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 5. Paginated Ranking Query
        const offset = (page - 1) * limit;
        const queryParams: any[] = [];
        let whereClause = "WHERE le.is_public = true";

        if (filter === "verified") {
            whereClause += " AND le.is_verified = true";
        }
        if (search) {
            queryParams.push(`%${search}%`);
            whereClause += ` AND (le.username ILIKE $${queryParams.length} OR le.display_name ILIKE $${queryParams.length} OR le.college ILIKE $${queryParams.length})`;
        }

        queryParams.push(limit);
        const limitParamIdx = queryParams.length;
        queryParams.push(offset);
        const offsetParamIdx = queryParams.length;

        const paginatedQuery = `
            SELECT 
                le.user_id, le.username, le.display_name, le.avatar_url, le.college, le.college_id, le.is_verified,
                le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                ranked.rank, le.updated_at,
                i.city as "collegeCity", i.state as "collegeState"
            FROM (
                SELECT 
                    user_id,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                FROM leaderboard_entries
                WHERE is_public = true
            ) ranked
            JOIN leaderboard_entries le ON le.user_id = ranked.user_id
            LEFT JOIN institutions i ON i.id = le.college_id
            ${whereClause}
            ORDER BY ranked.rank ASC
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
            collegeId: r.college_id,
            collegeCity: r.collegeCity,
            collegeState: r.collegeState,
            isVerified: Boolean(r.is_verified),
            score: parseInt(r.score, 10),
            scoreBreakdown: r.score_breakdown || {},
            totalSolved: parseInt(r.total_solved, 10),
            totalContests: parseInt(r.total_contests, 10),
            platformRatings: r.platform_ratings || {},
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 6. Current User Rank
        let currentUser: any = null;
        if (targetUser) {
            currentUser = await getUserRank(targetUser);
        }

        const responsePayload = {
            success: true,
            scope: "global",
            metadata: {
                title: "Global Ranking",
                description:
                    "Ranked by Orbix Score, a unified measure of problem-solving performance, rated contest participation, coding consistency, and supported developer contributions.",
                period,
                totalCoders,
                page,
                limit,
                totalPages,
                collegesRepresentedCount,
                lastUpdated: new Date().toISOString(),
            },
            podium,
            entries,
            currentUser,
        };

        if (!search) {
            await cacheLeaderboard.setGlobalPage(period, filter, page, limit, responsePayload);
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
 * Recalculates caller's Orbix Score and updates their position on both Global and College Leaderboards.
 */
leaderboardRouter.post("/sync", authenticate, async (req: Request, res: Response) => {
    try {
        const effectiveUser = req.user?.username;
        if (!effectiveUser) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

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

        await cacheLeaderboard.invalidate();

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
