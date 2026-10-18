/**
 * Orbix Score Engine — Version 1.0.0
 * 
 * Centralized, deterministic, server-authoritative scoring engine for the Global Coding Leaderboard.
 * Follows the official Orbix Score specification:
 * - Problems: E + 3*M + 6*H + 2*U
 * - Rated Contests: 8 * C
 * - Active Days: 2 * D
 * - Rating points:
 *     CF: max(0, R_CF - 1000)
 *     LC: max(0, R_LC - 1500)
 *     CC: 0.8 * max(0, R_CC - 1400)
 *     AC: 0.8 * max(0, R_AC - 400)
 *     TC: 0.8 * max(0, R_TC - 1200)
 * - GitHub: 0.25 * min(G, 2000) (max 500 points)
 */

export const ORBIX_SCORE_VERSION = "v1.0.0";

export interface ProblemCountsInput {
    easy?: number | null | undefined;
    medium?: number | null | undefined;
    hard?: number | null | undefined;
    unknownDifficulty?: number | null | undefined;
}

export interface PlatformRatingsInput {
    codeforces?: number | null | undefined;
    leetcode?: number | null | undefined;
    codechef?: number | null | undefined;
    atcoder?: number | null | undefined;
    topcoder?: number | null | undefined;
}

export interface ContestStatsInput {
    ratedContestsCount?: number | null | undefined;
    contestIds?: string[] | null | undefined;
}

export interface ActivityStatsInput {
    activeDaysCount?: number | null | undefined;
    activeDates?: string[] | null | undefined;
    currentStreak?: number | null | undefined;
}

export interface GitHubStatsInput {
    contributions?: number | null | undefined;
}

export interface OrbixScoreInput {
    problems?: ProblemCountsInput;
    ratings?: PlatformRatingsInput;
    contests?: ContestStatsInput;
    activity?: ActivityStatsInput;
    github?: GitHubStatsInput;
}

export interface OrbixScoreBreakdown {
    problems: {
        easy: number;
        medium: number;
        hard: number;
        unknown: number;
        totalSolved: number;
        points: number;
    };
    contests: {
        ratedCount: number;
        points: number;
    };
    activity: {
        activeDays: number;
        points: number;
        currentStreak: number;
    };
    ratings: {
        codeforces: { rating: number | null; baseline: number; points: number };
        leetcode: { rating: number | null; baseline: number; points: number };
        codechef: { rating: number | null; baseline: number; multiplier: number; points: number };
        atcoder: { rating: number | null; baseline: number; multiplier: number; points: number };
        topcoder: { rating: number | null; baseline: number; multiplier: number; points: number };
        totalRatingPoints: number;
    };
    github: {
        contributions: number;
        cappedContributions: number;
        points: number;
    };
}

export interface OrbixScoreResult {
    totalScore: number;
    rawTotalScore: number;
    version: string;
    calculatedAt: string;
    breakdown: OrbixScoreBreakdown;
    qualificationSummary: string;
}

/**
 * Core mathematical calculation of the Orbix Score according to specification.
 */
export function calculateOrbixScore(input: OrbixScoreInput): OrbixScoreResult {
    // 1. Problem-solving points: S_problems = E + 3M + 6H + 2U
    const easy = Math.max(0, Math.floor(input.problems?.easy || 0));
    const medium = Math.max(0, Math.floor(input.problems?.medium || 0));
    const hard = Math.max(0, Math.floor(input.problems?.hard || 0));
    const unknown = Math.max(0, Math.floor(input.problems?.unknownDifficulty || 0));
    const totalSolved = easy + medium + hard + unknown;

    const sProblems = (easy * 1) + (medium * 3) + (hard * 6) + (unknown * 2);

    // 2. Rated contest participation: S_contests = 8 * C
    let ratedContests = 0;
    if (input.contests?.contestIds && Array.isArray(input.contests.contestIds)) {
        // Deduplicate contest IDs if list is provided
        const uniqueIds = new Set(input.contests.contestIds.map((id) => String(id).trim()).filter(Boolean));
        ratedContests = uniqueIds.size;
    } else {
        ratedContests = Math.max(0, Math.floor(input.contests?.ratedContestsCount || 0));
    }
    const sContests = ratedContests * 8;

    // 3. Active coding days: S_activity = 2 * D
    let activeDays = 0;
    if (input.activity?.activeDates && Array.isArray(input.activity.activeDates)) {
        // Distinct eligible calendar dates
        const uniqueDates = new Set(input.activity.activeDates.map((d) => String(d).trim().split("T")[0]).filter(Boolean));
        activeDays = uniqueDates.size;
    } else {
        activeDays = Math.max(0, Math.floor(input.activity?.activeDaysCount || 0));
    }
    const sActivity = activeDays * 2;
    const currentStreak = Math.max(0, Math.floor(input.activity?.currentStreak || 0));

    // 4. Rating-based points: S_ratings
    // Codeforces: max(0, R_CF - 1000)
    const cfRating = typeof input.ratings?.codeforces === "number" && input.ratings.codeforces > 0 ? Math.round(input.ratings.codeforces) : null;
    const cfPoints = cfRating !== null ? Math.max(0, cfRating - 1000) : 0;

    // LeetCode: max(0, R_LC - 1500)
    const lcRating = typeof input.ratings?.leetcode === "number" && input.ratings.leetcode > 0 ? Math.round(input.ratings.leetcode) : null;
    const lcPoints = lcRating !== null ? Math.max(0, lcRating - 1500) : 0;

    // CodeChef: 0.8 * max(0, R_CC - 1400)
    const ccRating = typeof input.ratings?.codechef === "number" && input.ratings.codechef > 0 ? Math.round(input.ratings.codechef) : null;
    const ccPoints = ccRating !== null ? Math.max(0, 0.8 * (ccRating - 1400)) : 0;

    // AtCoder: 0.8 * max(0, R_AC - 400)
    const acRating = typeof input.ratings?.atcoder === "number" && input.ratings.atcoder > 0 ? Math.round(input.ratings.atcoder) : null;
    const acPoints = acRating !== null ? Math.max(0, 0.8 * (acRating - 400)) : 0;

    // TopCoder: 0.8 * max(0, R_TC - 1200)
    const tcRating = typeof input.ratings?.topcoder === "number" && input.ratings.topcoder > 0 ? Math.round(input.ratings.topcoder) : null;
    const tcPoints = tcRating !== null ? Math.max(0, 0.8 * (tcRating - 1200)) : 0;

    const sRatingsRaw = cfPoints + lcPoints + ccPoints + acPoints + tcPoints;
    const sRatings = Math.round(sRatingsRaw * 100) / 100;

    // 5. GitHub contributions: S_GitHub = 0.25 * min(G, 2000)
    const ghRaw = Math.max(0, Math.floor(input.github?.contributions || 0));
    const ghCapped = Math.min(ghRaw, 2000);
    const sGitHub = Math.round(ghCapped * 0.25 * 100) / 100;

    // Total Orbix Score: S_total = S_problems + S_contests + S_activity + S_ratings + S_GitHub
    const rawTotal = sProblems + sContests + sActivity + sRatings + sGitHub;
    const totalScore = Math.round(rawTotal);

    const breakdown: OrbixScoreBreakdown = {
        problems: {
            easy,
            medium,
            hard,
            unknown,
            totalSolved,
            points: sProblems,
        },
        contests: {
            ratedCount: ratedContests,
            points: sContests,
        },
        activity: {
            activeDays,
            points: sActivity,
            currentStreak,
        },
        ratings: {
            codeforces: { rating: cfRating, baseline: 1000, points: cfPoints },
            leetcode: { rating: lcRating, baseline: 1500, points: Math.round(lcPoints * 100) / 100 },
            codechef: { rating: ccRating, baseline: 1400, multiplier: 0.8, points: Math.round(ccPoints * 100) / 100 },
            atcoder: { rating: acRating, baseline: 400, multiplier: 0.8, points: Math.round(acPoints * 100) / 100 },
            topcoder: { rating: tcRating, baseline: 1200, multiplier: 0.8, points: Math.round(tcPoints * 100) / 100 },
            totalRatingPoints: sRatings,
        },
        github: {
            contributions: ghRaw,
            cappedContributions: ghCapped,
            points: sGitHub,
        },
    };

    const parts: string[] = [];
    if (totalSolved > 0) parts.push(`${totalSolved} solved (${sProblems} pts)`);
    if (ratedContests > 0) parts.push(`${ratedContests} rated contests (${sContests} pts)`);
    if (activeDays > 0) parts.push(`${activeDays} active days (${sActivity} pts)`);
    if (sRatings > 0) parts.push(`Rating bonuses (${sRatings} pts)`);
    if (sGitHub > 0) parts.push(`GitHub (${sGitHub} pts)`);

    const qualificationSummary = parts.length > 0 ? parts.join(" • ") : "No qualifying coding activity recorded yet.";

    return {
        totalScore,
        rawTotalScore: Math.round(rawTotal * 100) / 100,
        version: ORBIX_SCORE_VERSION,
        calculatedAt: new Date().toISOString(),
        breakdown,
        qualificationSummary,
    };
}

/**
 * Aggregates portal profiles (from database user_links or API sync responses)
 * and feeds them directly into the Orbix Score calculator.
 */
export function computeOrbixScoreFromPortals(
    portalsMap: Record<string, any>,
    contestsHistory: any[] = [],
    activityCalendar: { activeDays?: number; distinctDates?: string[]; currentStreak?: number } = {}
): OrbixScoreResult {
    let easy = 0;
    let medium = 0;
    let hard = 0;
    let unknownDifficulty = 0;

    const ratings: PlatformRatingsInput = {
        codeforces: null,
        leetcode: null,
        codechef: null,
        atcoder: null,
        topcoder: null,
    };

    let ghContributions = 0;

    let maxStatsActiveDays = 0;
    let maxStatsStreak = 0;

    for (const [pId, rawData] of Object.entries(portalsMap || {})) {
        if (!rawData) continue;
        const portal = pId.toLowerCase().trim();
        const stats = Array.isArray(rawData.stats) ? rawData.stats : [];

        // Check if platform provided difficulty breakdown
        let hasDiff = false;
        if (rawData.difficulty && typeof rawData.difficulty === "object") {
            const d = rawData.difficulty;
            if (typeof d.easy === "number" || typeof d.medium === "number" || typeof d.hard === "number") {
                easy += Math.max(0, d.easy || 0);
                medium += Math.max(0, d.medium || 0);
                hard += Math.max(0, d.hard || 0);
                hasDiff = true;
            }
        }
        
        if (!hasDiff && stats.length > 0) {
            let foundE = 0;
            let foundM = 0;
            let foundH = 0;
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                const m = (s.value || "").match(/(\d+)/);
                const count = m ? parseInt(m[1], 10) : 0;
                if (lbl === "easy" || lbl.includes("school") || lbl.includes("basic")) foundE += count;
                else if (lbl === "medium") foundM += count;
                else if (lbl === "hard") foundH += count;
            }
            if (foundE > 0 || foundM > 0 || foundH > 0) {
                easy += foundE;
                medium += foundM;
                hard += foundH;
                hasDiff = true;
            }
        }

        if (!hasDiff && portal !== "github") {
            // Count solves without explicit difficulty label as unknownDifficulty (U)
            let solves = 0;
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                if (lbl.includes("solved") || lbl.includes("problems") || lbl.includes("challenges")) {
                    const m = (s.value || "").match(/(\d+)/);
                    if (m) solves = parseInt(m[1], 10);
                }
            }
            if (solves > 0) {
                unknownDifficulty += solves;
            }
        }

        // Ratings extraction
        let ratingVal = typeof rawData.rating === "number" ? rawData.rating : (
            rawData.currentRating || (typeof rawData.contestRating === "number" ? rawData.contestRating : null)
        );
        if (!ratingVal && stats.length > 0) {
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                if (lbl === "rating" || lbl.includes("rating")) {
                    const m = (s.value || "").match(/(\d+)/);
                    if (m && m[1]) {
                        ratingVal = parseInt(m[1], 10);
                        break;
                    }
                }
            }
        }

        if (portal === "codeforces") ratings.codeforces = ratingVal;
        else if (portal === "leetcode") ratings.leetcode = ratingVal;
        else if (portal === "codechef") ratings.codechef = ratingVal;
        else if (portal === "atcoder") ratings.atcoder = ratingVal;
        else if (portal === "topcoder") ratings.topcoder = ratingVal;

        // Activity and streaks from stats
        for (const s of stats) {
            const lbl = (s.label || "").toLowerCase();
            const m = (s.value || "").match(/(\d+)/);
            const count = m ? parseInt(m[1], 10) : 0;
            if (lbl.includes("activedays") || lbl.includes("active days")) {
                if (count > maxStatsActiveDays) maxStatsActiveDays = count;
            }
            if (lbl.includes("streak")) {
                if (count > maxStatsStreak) maxStatsStreak = count;
            }
        }

        // GitHub contributions
        if (portal === "github") {
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                if (lbl.includes("contribution") || lbl.includes("commit")) {
                    const m = (s.value || "").match(/([\d,]+)/);
                    if (m) ghContributions = parseInt(m[1].replace(/,/g, ""), 10) || ghContributions;
                }
            }
            if (ghContributions === 0 && typeof rawData.contributions === "number") {
                ghContributions = rawData.contributions;
            }
        }
    }

    // Rated contests extraction
    let ratedContestsCount = 0;
    const contestIds: string[] = [];

    if (Array.isArray(contestsHistory) && contestsHistory.length > 0) {
        for (const c of contestsHistory) {
            const portal = (c.portal || "").toLowerCase();
            if (portal === "codeforces" || portal === "leetcode" || portal === "codechef" || portal === "atcoder" || portal === "topcoder") {
                const id = c.contestId || `${portal}-${c.timestamp || c.date}`;
                contestIds.push(String(id));
            }
        }
        ratedContestsCount = new Set(contestIds).size;
    } else {
        // Fallback: sum ratedContestsCount from portal profiles
        for (const [pId, rawData] of Object.entries(portalsMap || {})) {
            if (!rawData) continue;
            const p = pId.toLowerCase();
            if (p === "codeforces" || p === "leetcode" || p === "codechef" || p === "atcoder" || p === "topcoder") {
                if (typeof rawData.ratedContestsCount === "number") {
                    ratedContestsCount += rawData.ratedContestsCount;
                } else if (Array.isArray(rawData.stats)) {
                    for (const s of rawData.stats) {
                        const lbl = (s.label || "").toLowerCase();
                        if (lbl === "contests" || lbl.includes("contest")) {
                            const m = (s.value || "").match(/(\d+)/);
                            if (m && m[1]) ratedContestsCount += parseInt(m[1], 10);
                        }
                    }
                }
            }
        }
    }

    const finalActiveDays = activityCalendar.activeDays || (activityCalendar.distinctDates?.length || 0) || maxStatsActiveDays;
    const finalStreak = activityCalendar.currentStreak || maxStatsStreak;

    return calculateOrbixScore({
        problems: { easy, medium, hard, unknownDifficulty },
        ratings,
        contests: { ratedContestsCount, contestIds },
        activity: {
            activeDaysCount: finalActiveDays,
            activeDates: activityCalendar.distinctDates,
            currentStreak: finalStreak,
        },
        github: { contributions: ghContributions },
    });
}
