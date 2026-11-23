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
import cacheLeaderboard, { leaderboardDemoEnabled } from "../../redis/cache/cache-leaderboard.js";
import { requireGovernanceAdmin } from "../../middlewares/staff.middleware.js";

const leaderboardRouter = express.Router();

// Shared by score sync and every public ranking surface.
const PUBLIC_PLATFORM_LINK = "is_public IS NOT FALSE";
const LINKED_PARTICIPANT = `owner.id IN (SELECT user_id FROM user_links WHERE ${PUBLIC_PLATFORM_LINK})`;
const DEMO_PARTICIPANT = `EXISTS (
    SELECT 1 FROM leaderboard_entries demo
    WHERE demo.user_id = owner.id AND demo.score_breakdown @> '{"demoFixture": true}'::jsonb
)`;
const leaderboardParticipants = (includeDemo: boolean) => `
    SELECT owner.id
    FROM users owner
    WHERE owner.is_public IS NOT FALSE
      AND (${LINKED_PARTICIPANT} ${includeDemo ? "OR" : "AND NOT"} ${DEMO_PARTICIPANT})`;
const LEADERBOARD_PARTICIPANTS = leaderboardParticipants(leaderboardDemoEnabled);

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
 * Safely parses and normalizes platform ratings from JSON, string, or fallback score breakdown.
 * Ensures consistent structure: { codeforces: { rating, tier, color }, leetcode: { rating, badge, color }, ... }
 */
export function parseRatingsSafe(
    raw: any,
    scoreBreakdown?: any
): Record<string, { rating: number; tier?: string; color?: string; badge?: string }> {
    let result: Record<string, any> = {};
    if (raw) {
        if (typeof raw === "string") {
            try {
                let parsed = JSON.parse(raw);
                if (typeof parsed === "string") {
                    parsed = JSON.parse(parsed);
                }
                if (parsed && typeof parsed === "object") {
                    result = parsed;
                }
            } catch {
                result = {};
            }
        } else if (typeof raw === "object") {
            result = { ...raw };
        }
    }

    // Normalize any platforms where value might be just a raw number or nested object
    const normalized: Record<string, { rating: number; tier?: string; color?: string; badge?: string }> = {};
    for (const [key, val] of Object.entries(result)) {
        if (!val) continue;
        const pKey = key.toLowerCase();
        let rNum: number | null = null;
        let color = typeof val === "object" ? val.color : undefined;
        let tier = typeof val === "object" ? (val.tier || val.badge) : undefined;

        if (typeof val === "number" && val > 0) {
            rNum = Math.round(val);
        } else if (typeof val === "object" && typeof val.rating === "number" && val.rating > 0) {
            rNum = Math.round(val.rating);
        } else if (typeof val === "string") {
            const cleanStr = val.replace(/,/g, "").trim();
            const parsed = parseInt(cleanStr, 10);
            if (!isNaN(parsed) && parsed > 0) {
                rNum = parsed;
            }
        }

        if (rNum && rNum > 0) {
            if (pKey === "codeforces" || pKey === "cf") {
                const t = getCodeforcesTier(rNum);
                normalized.codeforces = { rating: rNum, tier: tier || t.name, color: color || t.color };
            } else if (pKey === "leetcode" || pKey === "lc") {
                const t = getLeetCodeTier(rNum, tier);
                normalized.leetcode = { rating: rNum, badge: tier || t.name, color: color || t.color };
            } else if (pKey === "codechef" || pKey === "cc") {
                const t = getCodeChefTier(rNum);
                normalized.codechef = { rating: rNum, tier: tier || t.name, color: color || t.color };
            } else if (pKey === "atcoder" || pKey === "ac") {
                const t = getAtCoderTier(rNum);
                normalized.atcoder = { rating: rNum, tier: tier || t.name, color: color || t.color };
            } else if (pKey === "topcoder" || pKey === "tc") {
                normalized.topcoder = { rating: rNum, color: color || "#00aaff" };
            } else {
                normalized[pKey] = { rating: rNum, tier, color };
            }
        }
    }

    // Fallback: If normalized has no ratings, check scoreBreakdown.ratings
    if (Object.keys(normalized).length === 0 && scoreBreakdown) {
        let sb = scoreBreakdown;
        if (typeof sb === "string") {
            try { sb = JSON.parse(sb); } catch { sb = null; }
        }
        if (sb && typeof sb === "object" && sb.ratings) {
            const r = sb.ratings;
            if (r.codeforces?.rating && r.codeforces.rating > 0) {
                const t = getCodeforcesTier(r.codeforces.rating);
                normalized.codeforces = { rating: r.codeforces.rating, tier: t.name, color: t.color };
            }
            if (r.leetcode?.rating && r.leetcode.rating > 0) {
                const t = getLeetCodeTier(r.leetcode.rating);
                normalized.leetcode = { rating: r.leetcode.rating, badge: t.name, color: t.color };
            }
            if (r.codechef?.rating && r.codechef.rating > 0) {
                const t = getCodeChefTier(r.codechef.rating);
                normalized.codechef = { rating: r.codechef.rating, tier: t.name, color: t.color };
            }
            if (r.atcoder?.rating && r.atcoder.rating > 0) {
                const t = getAtCoderTier(r.atcoder.rating);
                normalized.atcoder = { rating: r.atcoder.rating, tier: t.name, color: t.color };
            }
            if (r.topcoder?.rating && r.topcoder.rating > 0) {
                normalized.topcoder = { rating: r.topcoder.rating, color: "#00aaff" };
            }
        }
    }

    return normalized;
}

/**
 * Recalculates and updates the leaderboard projection for a single user,
 * keeping both Global and College League projections synchronized.
 */
export async function syncLeaderboardForUser(
    username: string,
    options: { refreshProviderStats?: boolean; invalidateCache?: boolean } = {},
): Promise<LeaderboardEntryDTO | null> {
    const cleanUser = (username || "").trim();
    if (!cleanUser) return null;

    // 1. Fetch user record including college_id (case-insensitive + id fallback)
    const userRes = await query(
        `SELECT id, username, email, firstname, lastname, avatar_url, photo_url, college, college_id, is_email_verified, is_public
         FROM users
         WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) OR id::text = $1
         LIMIT 1;`,
        [cleanUser]
    );

    if (userRes.rows.length === 0) {
        return null;
    }

    const u = userRes.rows[0];
    const userId = u.id;
    const displayName = `${u.firstname || u.firstName || ""} ${u.lastname || u.lastName || ""}`.trim() || u.username;
    const avatarUrl = u.photo_url || u.avatar_url || "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png";
    let college = u.college || null;
    let collegeId = u.college_id || null;
    // In personal user case, only persons verified via email OTP are verified
    const isVerified = Boolean(u.is_email_verified);
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

    // Ownership verification is independent of scoring eligibility.
    const linksRes = await query(
        `SELECT id, portal, portal_username, leaderboard_snapshot
         FROM user_links
         WHERE user_id = $1 AND ${PUBLIC_PLATFORM_LINK};`,
        [userId]
    );

    const portalsMap: Record<string, any> = {};
    const platformRatings: Record<string, { rating: number; tier?: string; color?: string; badge?: string }> = {};

    let totalSolvedAcc = 0;
    let totalContestsAcc = 0;

    const scoredLinks = await Promise.all(linksRes.rows.map(async (link) => {
        const portal = (link.portal || "").toLowerCase().trim();
        const handle = link.portal_username;
        const saved = link.leaderboard_snapshot;
        let snapshot = saved?.handle === handle && saved?.portal === portal && saved?.profile?.success
            ? saved.profile
            : null;

        if ((!snapshot || options.refreshProviderStats) && portal && handle) {
            try {
                const { verifyAndFetchPortal } = await import("../portals/portals.js");
                const profile = await verifyAndFetchPortal(portal, handle);
                if (profile?.success) {
                    const stored = await query(
                        `UPDATE user_links
                         SET leaderboard_snapshot = $1::jsonb
                         WHERE id = $2 AND user_id = $3 AND portal = $4 AND portal_username = $5
                           AND ${PUBLIC_PLATFORM_LINK};`,
                        [JSON.stringify({ portal, handle, profile }), link.id, userId, link.portal, handle]
                    );
                    if (!stored.rowCount) return null;
                    snapshot = profile;
                }
            } catch {
                // A provider outage can fall back to that handle's last provider-fetched data.
            }
        }

        return snapshot ? { portal, handle, snapshot } : null;
    }));

    for (const link of scoredLinks) {
        if (!link) continue;
        const { portal, handle, snapshot: snap } = link;
        const stats: Array<{ label?: string; value?: string }> = Array.isArray(snap.stats) ? snap.stats : [];

        portalsMap[portal] = {
            ...snap,
            portal,
            portal_username: handle,
            stats,
        };

        let rVal: number | null = null;
        if (typeof snap.rating === "number" && snap.rating > 0) {
            rVal = snap.rating;
        } else if (typeof snap.contestRating === "number" && snap.contestRating > 0) {
            rVal = Math.round(snap.contestRating);
        } else if (typeof snap.currentRating === "number" && snap.currentRating > 0) {
            rVal = snap.currentRating;
        } else if (typeof snap.rating === "string") {
            const clean = snap.rating.replace(/,/g, "").trim();
            if (!isNaN(parseInt(clean, 10)) && parseInt(clean, 10) > 0) {
                rVal = parseInt(clean, 10);
            }
        }

        if (!rVal || rVal <= 0) {
            for (const s of stats) {
                if (!s) continue;
                const lbl = String(s.label || "").toLowerCase();
                if (lbl === "rating" || lbl.includes("rating")) {
                    const strVal = String(s.value || "").replace(/,/g, "");
                    const m = strVal.match(/(\d+)/);
                    if (m && m[1]) {
                        rVal = parseInt(m[1], 10);
                        break;
                    }
                }
            }
        }

        if (typeof rVal === "number" && rVal > 0) {
            if (portal === "codeforces" || portal === "cf") {
                const tier = getCodeforcesTier(rVal);
                platformRatings.codeforces = { rating: rVal, tier: tier.name, color: tier.color };
            } else if (portal === "leetcode" || portal === "lc") {
                const tier = getLeetCodeTier(rVal, snap.badge || snap.officialBadge);
                platformRatings.leetcode = { rating: rVal, badge: tier.name, color: tier.color };
            } else if (portal === "codechef" || portal === "cc") {
                const tier = getCodeChefTier(rVal);
                platformRatings.codechef = { rating: rVal, tier: tier.name, color: tier.color };
            } else if (portal === "atcoder" || portal === "ac") {
                const tier = getAtCoderTier(rVal);
                platformRatings.atcoder = { rating: rVal, tier: tier.name, color: tier.color };
            } else if (portal === "topcoder" || portal === "tc") {
                platformRatings.topcoder = { rating: rVal, color: "#00aaff" };
            }
        }

        const solved = snap.difficulty?.total || snap.solvedTotal;
        if (typeof solved === "number" && solved > 0) {
            totalSolvedAcc += solved;
        } else {
            for (const s of stats) {
                if (!s) continue;
                const lbl = String(s.label || "").toLowerCase();
                if (lbl.includes("solved") || lbl.includes("problems")) {
                    const m = String(s.value || "").match(/(\d+)/);
                    if (m && m[1]) totalSolvedAcc += parseInt(m[1], 10);
                }
            }
        }

        if (typeof snap.ratedContestsCount === "number") {
            totalContestsAcc += snap.ratedContestsCount;
        } else {
            for (const s of stats) {
                if (!s) continue;
                const lbl = String(s.label || "").toLowerCase();
                if (lbl === "contests" || lbl.includes("contest")) {
                    const m = String(s.value || "").match(/(\d+)/);
                    if (m && m[1]) totalContestsAcc += parseInt(m[1], 10);
                }
            }
        }
    }

    // Extract active days and streak from the same public links used for the score.
    let maxActiveDays = 0;
    let maxStreak = 0;

    for (const link of scoredLinks) {
        const stats = link?.snapshot.stats;
        if (!Array.isArray(stats)) continue;
        for (const s of stats) {
            if (!s) continue;
            const lbl = String(s.label || "").toLowerCase();
            const m = String(s.value || "").match(/(\d+)/);
            const count = m && m[1] ? parseInt(m[1], 10) : 0;
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

    // Fallback: If platformRatings has no ratings extracted yet, check scoreResult.breakdown.ratings
    if (Object.keys(platformRatings).length === 0 && scoreResult.breakdown?.ratings) {
        const sbRatings = scoreResult.breakdown.ratings;
        if (sbRatings.codeforces?.rating && sbRatings.codeforces.rating > 0) {
            const tier = getCodeforcesTier(sbRatings.codeforces.rating);
            platformRatings.codeforces = { rating: sbRatings.codeforces.rating, tier: tier.name, color: tier.color };
        }
        if (sbRatings.leetcode?.rating && sbRatings.leetcode.rating > 0) {
            const tier = getLeetCodeTier(sbRatings.leetcode.rating);
            platformRatings.leetcode = { rating: sbRatings.leetcode.rating, badge: tier.name, color: tier.color };
        }
        if (sbRatings.codechef?.rating && sbRatings.codechef.rating > 0) {
            const tier = getCodeChefTier(sbRatings.codechef.rating);
            platformRatings.codechef = { rating: sbRatings.codechef.rating, tier: tier.name, color: tier.color };
        }
        if (sbRatings.atcoder?.rating && sbRatings.atcoder.rating > 0) {
            const tier = getAtCoderTier(sbRatings.atcoder.rating);
            platformRatings.atcoder = { rating: sbRatings.atcoder.rating, tier: tier.name, color: tier.color };
        }
        if (sbRatings.topcoder?.rating && sbRatings.topcoder.rating > 0) {
            platformRatings.topcoder = { rating: sbRatings.topcoder.rating, color: "#00aaff" };
        }
    }

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
            u.username,
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
    if (options.invalidateCache !== false) {
        await cacheLeaderboard.invalidate(collegeId ? { collegeId } : undefined);
    }

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
        platformRatings: parseRatingsSafe(row.platform_ratings, row.score_breakdown),
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
            WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS}) AND college_id IS NOT NULL;
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
    const cleanUser = (username || "").trim();
    if (!cleanUser) return null;

    const cacheContext = collegeIdContext || "global";
    try {
        const cachedRank = await cacheLeaderboard.getUserRank(cleanUser, cacheContext);
        if (cachedRank) {
            return cachedRank;
        }

        let rankRes = await query(
            `SELECT 
                le.user_id, le.username, COALESCE(le.display_name, le.username) AS display_name, COALESCE(le.avatar_url, '') AS avatar_url, le.college, le.college_id, le.is_verified,
                le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                ranked.rank, le.updated_at,
                i.city as "collegeCity", i.state as "collegeState"
            FROM (
                SELECT 
                    user_id,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                FROM leaderboard_entries
                WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS})
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
                    le.user_id, le.username, COALESCE(le.display_name, le.username) AS display_name, COALESCE(le.avatar_url, '') AS avatar_url, le.college, le.college_id, le.is_verified,
                    le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                    ranked.rank, le.updated_at,
                    i.city as "collegeCity", i.state as "collegeState"
                FROM (
                    SELECT 
                        user_id,
                        DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                    FROM leaderboard_entries
                    WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS})
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
                    WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS}) AND college_id = $1
                ) col_ranked
                WHERE user_id = $2
                LIMIT 1;
            `, [effectiveCollegeId, r.user_id]);
            if (colRes.rows[0]) {
                collegeRank = parseInt(colRes.rows[0].rank, 10);
            }
        }

        const result = {
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
            platformRatings: parseRatingsSafe(r.platform_ratings, r.score_breakdown),
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        };

        await cacheLeaderboard.setUserRank(cleanUser, cacheContext, result);
        return result;
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
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
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
            WHERE le.is_public = true AND le.user_id IN (${LEADERBOARD_PARTICIPANTS})
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

        res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=45");

        // 2. Check Redis cache (cache-aside)
        if (!search) {
            const cached = await cacheLeaderboard.getCollegePage(rawCollegeId, period, filter, page, limit);
            if (cached) {
                if (targetUser) {
                    const uLower = targetUser.toLowerCase();
                    const found =
                        cached.podium?.find((p: any) => p.username?.toLowerCase() === uLower) ||
                        cached.entries?.find((e: any) => e.username?.toLowerCase() === uLower);
                    if (found) {
                        cached.currentUser = found;
                    } else {
                        cached.currentUser = await getUserRank(targetUser, rawCollegeId);
                    }
                } else {
                    cached.currentUser = null;
                }
                return res.status(200).json({ ...cached, cached: true });
            }
        }

        // 3. Total Eligible Coders in this College
        const countParams: any[] = [rawCollegeId];
        let countWhere = `WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS}) AND college_id = $1`;
        if (filter === "verified") {
            countWhere += " AND is_verified = true";
        }
        if (search) {
            countParams.push(`%${search}%`);
            countWhere += ` AND (username ILIKE $${countParams.length} OR COALESCE(display_name, '') ILIKE $${countParams.length})`;
        }

        const countRes = await query(`SELECT COUNT(*)::int as total FROM leaderboard_entries ${countWhere};`, countParams);
        const totalCoders = countRes.rows[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(totalCoders / limit));

        // If no coders exist in this college yet, return clean empty payload immediately
        if (totalCoders === 0) {
            const emptyPayload = {
                success: true,
                college: {
                    id: collegeMeta.id,
                    name: collegeMeta.name,
                    code: collegeMeta.code,
                    city: collegeMeta.city,
                    country: collegeMeta.country,
                    totalStudents: 0,
                },
                metadata: {
                    title: `${collegeMeta.name} Coding League`,
                    description: `Internal competitive programming standings for ${collegeMeta.name}.`,
                    period,
                    totalCoders: 0,
                    page: 1,
                    limit,
                    totalPages: 1,
                    lastUpdated: new Date().toISOString(),
                },
                podium: [],
                entries: [],
                currentUser: null,
            };
            return res.status(200).json(emptyPayload);
        }

        // 4. College Podium (Top 3 in this college)
        const podiumQuery = `
            SELECT 
                user_id, username, COALESCE(display_name, username) AS display_name, COALESCE(avatar_url, '') AS avatar_url, college, college_id, is_verified,
                score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
                rank, updated_at
            FROM (
                SELECT 
                    user_id, username, display_name, avatar_url, college, college_id, is_verified,
                    score, score_breakdown, total_solved, total_contests, platform_ratings, streak,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank,
                    updated_at
                FROM leaderboard_entries
                WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS}) AND college_id = $1
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
            platformRatings: parseRatingsSafe(r.platform_ratings, r.score_breakdown),
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 5. Paginated College Standings
        const offset = (page - 1) * limit;
        const queryParams: any[] = [rawCollegeId];
        let whereClause = `WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS}) AND college_id = $1`;

        if (filter === "verified") {
            whereClause += " AND is_verified = true";
        }
        if (search) {
            queryParams.push(`%${search}%`);
            whereClause += ` AND (username ILIKE $${queryParams.length} OR COALESCE(display_name, '') ILIKE $${queryParams.length})`;
        }

        queryParams.push(limit);
        const limitParamIdx = queryParams.length;
        queryParams.push(offset);
        const offsetParamIdx = queryParams.length;

        const paginatedQuery = `
            SELECT 
                user_id, username, COALESCE(display_name, username) AS display_name, COALESCE(avatar_url, '') AS avatar_url, college, college_id, is_verified,
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
            platformRatings: parseRatingsSafe(r.platform_ratings, r.score_breakdown),
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 6. Current User Rank within this College
        let currentUser: any = null;
        if (targetUser) {
            const uLower = targetUser.toLowerCase();
            const found =
                podium.find((p) => p.username?.toLowerCase() === uLower) ||
                entries.find((e) => e.username?.toLowerCase() === uLower);
            if (found) {
                currentUser = found;
            } else {
                currentUser = await getUserRank(targetUser, rawCollegeId);
            }
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
            message: "College standings are syncing. Please refresh shortly.",
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

        res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=45");

        // 1. Check Redis cache
        if (!search) {
            const cached = await cacheLeaderboard.getGlobalPage(period, filter, page, limit);
            if (cached) {
                if (targetUser) {
                    const uLower = targetUser.toLowerCase();
                    const found =
                        cached.podium?.find((p: any) => p.username?.toLowerCase() === uLower) ||
                        cached.entries?.find((e: any) => e.username?.toLowerCase() === uLower);
                    if (found) {
                        cached.currentUser = found;
                    } else {
                        cached.currentUser = await getUserRank(targetUser);
                    }
                } else {
                    cached.currentUser = null;
                }
                return res.status(200).json({ ...cached, cached: true });
            }
        }

        // 2. Query Total Count
        const countParams: any[] = [];
        let countWhere = `WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS})`;
        if (filter === "verified") {
            countWhere += " AND is_verified = true";
        }
        if (search) {
            countParams.push(`%${search}%`);
            countWhere += ` AND (username ILIKE $${countParams.length} OR COALESCE(display_name, '') ILIKE $${countParams.length} OR COALESCE(college, '') ILIKE $${countParams.length})`;
        }

        const countQuery = `SELECT COUNT(*)::int as total FROM leaderboard_entries ${countWhere};`;
        const countRes = await query(countQuery, countParams);
        const totalCoders = countRes.rows[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(totalCoders / limit));

        // 3. Distinct Colleges Represented Count
        const collegesRepresentedCount = await getCollegesRepresentedCount();

        // If no coders exist on the leaderboard yet, return clean empty payload immediately
        if (totalCoders === 0) {
            const emptyPayload = {
                success: true,
                scope: "global",
                metadata: {
                    title: "Global Ranking",
                    description:
                        "Ranked by Orbix Score, a unified measure of problem-solving performance, rated contest participation, coding consistency, and supported developer contributions.",
                    period,
                    totalCoders: 0,
                    page: 1,
                    limit,
                    totalPages: 1,
                    collegesRepresentedCount: 0,
                    lastUpdated: new Date().toISOString(),
                },
                podium: [],
                entries: [],
                currentUser: null,
            };
            return res.status(200).json(emptyPayload);
        }

        // 4. Top-3 Podium Query (Always fetch overall rank 1, 2, 3)
        const podiumQuery = `
            SELECT 
                le.user_id, le.username, COALESCE(le.display_name, le.username) AS display_name, COALESCE(le.avatar_url, '') AS avatar_url, le.college, le.college_id, le.is_verified,
                le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                ranked.rank, le.updated_at,
                i.city as "collegeCity", i.state as "collegeState"
            FROM (
                SELECT 
                    user_id,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                FROM leaderboard_entries
                WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS})
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
            platformRatings: parseRatingsSafe(r.platform_ratings, r.score_breakdown),
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 5. Paginated Ranking Query
        const offset = (page - 1) * limit;
        const queryParams: any[] = [];
        let whereClause = `WHERE le.is_public = true AND le.user_id IN (${LEADERBOARD_PARTICIPANTS})`;

        if (filter === "verified") {
            whereClause += " AND le.is_verified = true";
        }
        if (search) {
            queryParams.push(`%${search}%`);
            whereClause += ` AND (le.username ILIKE $${queryParams.length} OR COALESCE(le.display_name, '') ILIKE $${queryParams.length} OR COALESCE(le.college, '') ILIKE $${queryParams.length})`;
        }

        queryParams.push(limit);
        const limitParamIdx = queryParams.length;
        queryParams.push(offset);
        const offsetParamIdx = queryParams.length;

        const paginatedQuery = `
            SELECT 
                le.user_id, le.username, COALESCE(le.display_name, le.username) AS display_name, COALESCE(le.avatar_url, '') AS avatar_url, le.college, le.college_id, le.is_verified,
                le.score, le.score_breakdown, le.total_solved, le.total_contests, le.platform_ratings, le.streak,
                ranked.rank, le.updated_at,
                i.city as "collegeCity", i.state as "collegeState"
            FROM (
                SELECT 
                    user_id,
                    DENSE_RANK() OVER (ORDER BY score DESC, total_solved DESC, username ASC) as rank
                FROM leaderboard_entries
                WHERE is_public = true AND user_id IN (${LEADERBOARD_PARTICIPANTS})
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
            platformRatings: parseRatingsSafe(r.platform_ratings, r.score_breakdown),
            streak: parseInt(r.streak, 10),
            updatedAt: r.updated_at,
        }));

        // 6. Current User Rank
        let currentUser: any = null;
        if (targetUser) {
            const uLower = targetUser.toLowerCase();
            const found =
                podium.find((p) => p.username?.toLowerCase() === uLower) ||
                entries.find((e) => e.username?.toLowerCase() === uLower);
            if (found) {
                currentUser = found;
            } else {
                currentUser = await getUserRank(targetUser);
            }
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
            message: "Leaderboard standings are syncing. Please refresh shortly.",
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

        const updatedEntry = await syncLeaderboardForUser(effectiveUser, { refreshProviderStats: true });

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
 * Staff-only backfill for public profiles with public platform links.
 * Start without a cursor and pass nextAfterUserId as afterUserId until it is null.
 */
leaderboardRouter.post("/recalculate-all", authenticate, requireGovernanceAdmin, async (req: Request, res: Response) => {
    const afterUserId: unknown = req.body?.afterUserId ?? null;
    if (afterUserId !== null && (typeof afterUserId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(afterUserId))) {
        return res.status(400).json({ success: false, message: "afterUserId must be a UUID." });
    }

    const batchSize = 10;
    try {
        const usersRes = await query(
            `SELECT id
             FROM users
             WHERE ($1::uuid IS NULL OR id > $1::uuid)
               AND is_public = true
               AND id IN (${leaderboardParticipants(false)})
             ORDER BY id
             LIMIT $2;`,
            [afterUserId, batchSize + 1]
        );
        const batch = usersRes.rows.slice(0, batchSize);
        let updatedCount = 0;
        for (const user of batch) {
            const result = await syncLeaderboardForUser(user.id, {
                invalidateCache: false,
            });
            if (result) updatedCount++;
        }

        await cacheLeaderboard.invalidate();
        return res.json({
            success: true,
            updatedCount,
            nextAfterUserId: usersRes.rows.length > batchSize ? batch.at(-1)?.id : null,
        });
    } catch (error) {
        await cacheLeaderboard.invalidate();
        console.error("Leaderboard batch recalculation failed:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to recalculate this leaderboard batch. Retry with the same cursor.",
        });
    }
});

export default leaderboardRouter;
