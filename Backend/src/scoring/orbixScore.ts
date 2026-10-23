/**
 * Orbix Score Engine — Version 2.0.0
 * 
 * Centralized, deterministic, server-authoritative scoring engine for the Orbix Developer Identity & Leaderboards.
 * Follows the 6 Canonical Scoring Pillars with bounded subscores [0 - 100] and diminishing returns:
 * 
 * Pillar 1: Problem Solving (35% weight / max 3,500 pts)
 *   - Evaluated across all 12 CP / practice platforms: LeetCode, Codeforces, CodeChef,
 *     GeeksforGeeks, HackerRank, AtCoder, Code360/CodingNinjas, InterviewBit, TopCoder,
 *     HackerEarth, CSES, SPOJ.
 *   - Weights: Easy = 1, Medium = 3, Hard = 6, Unknown = 2.
 *   - Smooth concave diminishing-returns curve bounded to [0, 100].
 * 
 * Pillar 2: Contest Performance (20% weight / max 2,000 pts)
 *   - Rated contest ratings normalized against official competitive tiers across
 *     Codeforces, LeetCode, CodeChef, AtCoder, TopCoder, etc.
 *   - Multi-platform non-linear rating bonus + rated contest participation experience.
 * 
 * Pillar 3: Open-Source Contributions (20% weight / max 2,000 pts)
 *   - Merged PRs, opened PRs, substantive issues resolved, code reviews, external repository contributions.
 *   - First verified open-source milestone bonus.
 * 
 * Pillar 4: Repository & Project Quality (10% weight / max 1,000 pts)
 *   - Public non-fork repositories, verified stars, forks, and language diversity.
 *   - Anti-gaming bounds against repository spam and artificial forks.
 * 
 * Pillar 5: Consistency, Active Days & Streaks (10% weight / max 1,000 pts)
 *   - Total active coding days, trailing 30-day practice density, and daily streak consistency.
 * 
 * Pillar 6: Technical Writing & Community (5% weight / max 500 pts)
 *   - Technical articles and documentation on Medium, Substack, and AlgorithmXlr8.
 * 
 * Standard Display Scale: 0 to 10,000 points.
 */

export const ORBIX_SCORE_VERSION = "v2.0.0";
export const ORBIX_SCORE_V1 = "v1.0.0";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface ProblemCountsInput {
    easy?: number | null | undefined;
    medium?: number | null | undefined;
    hard?: number | null | undefined;
    unknownDifficulty?: number | null | undefined;
    byPlatform?: Record<string, { easy?: number; medium?: number; hard?: number; total?: number }>;
}

export interface PlatformRatingsInput {
    codeforces?: number | null | undefined;
    leetcode?: number | null | undefined;
    codechef?: number | null | undefined;
    atcoder?: number | null | undefined;
    topcoder?: number | null | undefined;
    hackerrank?: number | null | undefined;
    geeksforgeeks?: number | null | undefined;
    [platform: string]: number | null | undefined;
}

export interface ContestStatsInput {
    ratedContestsCount?: number | null | undefined;
    contestIds?: string[] | null | undefined;
}

export interface OpenSourceStatsInput {
    mergedPRs?: number | null | undefined;
    openedPRs?: number | null | undefined;
    issues?: number | null | undefined;
    codeReviews?: number | null | undefined;
    externalReposCount?: number | null | undefined;
}

export interface RepositoryStatsInput {
    publicRepos?: number | null | undefined;
    stars?: number | null | undefined;
    forks?: number | null | undefined;
    languagesCount?: number | null | undefined;
    topLanguages?: string[] | null | undefined;
}

export interface ActivityStatsInput {
    activeDaysCount?: number | null | undefined;
    activeDates?: string[] | null | undefined;
    recentDays30Count?: number | null | undefined;
    currentStreak?: number | null | undefined;
}

export interface WritingStatsInput {
    articleCount?: number | null | undefined;
    followersCount?: number | null | undefined;
    clapsOrLikes?: number | null | undefined;
    platforms?: string[] | null | undefined;
}

export interface GitHubStatsInput {
    contributions?: number | null | undefined;
    commits?: number | null | undefined;
    pullRequests?: number | null | undefined;
    issues?: number | null | undefined;
    repositories?: number | null | undefined;
    stars?: number | null | undefined;
}

export interface OrbixScoreInput {
    version?: "v1.0.0" | "v2.0.0" | string;
    problems?: ProblemCountsInput;
    ratings?: PlatformRatingsInput;
    contests?: ContestStatsInput;
    openSource?: OpenSourceStatsInput;
    repositories?: RepositoryStatsInput;
    activity?: ActivityStatsInput;
    writing?: WritingStatsInput;
    github?: GitHubStatsInput;
}

export interface PillarSubscore {
    rawScore: number;
    subscore: number; // 0 to 100
    points: number;   // subscore * weight * 100
    weight: number;   // e.g. 0.35
    maxPoints: number;// e.g. 3500
}

export interface OrbixScoreBreakdownV2 {
    // 6 Canonical Pillars
    problems: PillarSubscore & {
        easy: number;
        medium: number;
        hard: number;
        unknown: number;
        totalSolved: number;
        rawProblemPoints: number;
    };
    contests: PillarSubscore & {
        ratedCount: number;
        bestRatingNormalized: number;
        participatingPlatforms: string[];
    };
    openSource: PillarSubscore & {
        mergedPRs: number;
        openedPRs: number;
        issues: number;
        codeReviews: number;
        externalRepos: number;
        milestoneBonus: boolean;
    };
    repositories: PillarSubscore & {
        publicRepos: number;
        stars: number;
        forks: number;
        languagesCount: number;
    };
    consistency: PillarSubscore & {
        activeDays: number;
        recentDays30: number;
        currentStreak: number;
    };
    writing: PillarSubscore & {
        articleCount: number;
        platforms: string[];
        followersCount: number;
    };

    // Backward-compatible fields
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
    breakdown: OrbixScoreBreakdownV2;
    qualificationSummary: string;
}

// -----------------------------------------------------------------------------
// Mathematical Curves & Normalizers
// -----------------------------------------------------------------------------

/**
 * Diminishing returns curve: 1 - exp(-x / scale)
 * Maps [0, ∞) smoothly into [0, 100].
 */
function diminishingReturns(value: number, scale: number): number {
    if (value <= 0) return 0;
    const factor = 1 - Math.exp(-value / scale);
    return Math.min(100, Math.max(0, factor * 100));
}

/**
 * Normalizes a platform rating against official competitive benchmarks into [0, 100].
 */
function normalizeRating(platform: string, rating: number | null | undefined): number {
    if (!rating || rating <= 0) return 0;
    const p = platform.toLowerCase().trim();

    switch (p) {
        case "codeforces":
            // Baseline: 1000 (Newbie upper bound), Peak: 2400 (Grandmaster)
            if (rating <= 1000) return 0;
            return Math.min(100, ((rating - 1000) / 1400) * 100);

        case "leetcode":
            // Baseline: 1500 (Contest default), Peak: 2600 (Guardian elite)
            if (rating <= 1500) return 0;
            return Math.min(100, ((rating - 1500) / 1100) * 100);

        case "codechef":
            // Baseline: 1400 (2-star boundary), Peak: 2300 (6-star boundary)
            if (rating <= 1400) return 0;
            return Math.min(100, ((rating - 1400) / 900) * 100);

        case "atcoder":
            // Baseline: 400 (Brown boundary), Peak: 2000 (Yellow/Orange)
            if (rating <= 400) return 0;
            return Math.min(100, ((rating - 400) / 1600) * 100);

        case "topcoder":
            // Baseline: 1200 (Blue boundary), Peak: 2200 (Red)
            if (rating <= 1200) return 0;
            return Math.min(100, ((rating - 1200) / 1000) * 100);

        default:
            // Generic CP rating (e.g. HackerRank / GFG rating)
            if (rating <= 1200) return 0;
            return Math.min(100, ((rating - 1200) / 1200) * 100);
    }
}

// -----------------------------------------------------------------------------
// Version 2.0.0 Authoritative Calculation
// -----------------------------------------------------------------------------

export function calculateOrbixScoreV2(input: OrbixScoreInput): OrbixScoreResult {
    // -------------------------------------------------------------------------
    // Pillar 1: Problem-Solving (Weight: 35% / Max: 3,500 pts)
    // -------------------------------------------------------------------------
    const easy = Math.max(0, Math.floor(input.problems?.easy || 0));
    const medium = Math.max(0, Math.floor(input.problems?.medium || 0));
    const hard = Math.max(0, Math.floor(input.problems?.hard || 0));
    const unknown = Math.max(0, Math.floor(input.problems?.unknownDifficulty || 0));
    const totalSolved = easy + medium + hard + unknown;

    // Difficulty weights: E=1, M=3, H=6, U=2
    const rawProblemPoints = (easy * 1) + (medium * 3) + (hard * 6) + (unknown * 2);

    // Smooth diminishing-returns curve with scale = 1,400 raw pts:
    // ~500 raw pts -> ~30 subscore
    // ~1,500 raw pts -> ~66 subscore
    // ~3,500 raw pts -> ~92 subscore
    // ~5,000+ raw pts -> ~97-100 subscore
    const p1Subscore = Math.round(diminishingReturns(rawProblemPoints, 1400) * 100) / 100;
    const p1Weight = 0.35;
    const p1MaxPoints = 3500;
    const p1Points = Math.round(p1Subscore * p1Weight * 100); // 0 to 3500

    // -------------------------------------------------------------------------
    // Pillar 2: Contest Performance (Weight: 20% / Max: 2,000 pts)
    // -------------------------------------------------------------------------
    const ratingsInput = input.ratings || {};
    const normalizedRatings: { platform: string; rating: number; normalized: number }[] = [];

    const platformsToCheck = ["codeforces", "leetcode", "codechef", "atcoder", "topcoder", "hackerrank", "geeksforgeeks"];
    for (const plat of platformsToCheck) {
        const rVal = ratingsInput[plat];
        if (typeof rVal === "number" && rVal > 0) {
            const norm = normalizeRating(plat, rVal);
            normalizedRatings.push({ platform: plat, rating: rVal, normalized: norm });
        }
    }

    // Sort normalized ratings descending
    normalizedRatings.sort((a, b) => b.normalized - a.normalized);

    const bestNorm = normalizedRatings[0]?.normalized || 0;
    const secondBestNorm = normalizedRatings[1]?.normalized || 0;
    // Multi-platform composite rating: best rating takes 75%, 2nd best takes 25%
    const compositeRatingNorm = (bestNorm * 0.75) + (secondBestNorm * 0.25);

    // Rated contest participation count
    let ratedContests = 0;
    if (input.contests?.contestIds && Array.isArray(input.contests.contestIds)) {
        const uniqueIds = new Set(input.contests.contestIds.map((id) => String(id).trim()).filter(Boolean));
        ratedContests = uniqueIds.size;
    } else {
        ratedContests = Math.max(0, Math.floor(input.contests?.ratedContestsCount || 0));
    }

    // Contest experience component: up to 25 pts for 20+ contests
    const contestExperience = Math.min(25, diminishingReturns(ratedContests, 12) * 0.25);
    // Rating skill component: up to 75 pts
    const ratingSkill = compositeRatingNorm * 0.75;

    const p2Subscore = Math.min(100, Math.round((ratingSkill + contestExperience) * 100) / 100);
    const p2Weight = 0.20;
    const p2MaxPoints = 2000;
    const p2Points = Math.round(p2Subscore * p2Weight * 100);

    // -------------------------------------------------------------------------
    // Pillar 3: Open-Source Contributions (Weight: 20% / Max: 2,000 pts)
    // -------------------------------------------------------------------------
    const mergedPRs = Math.max(0, Math.floor(input.openSource?.mergedPRs || input.github?.pullRequests || 0));
    const openedPRs = Math.max(0, Math.floor(input.openSource?.openedPRs || 0));
    const issues = Math.max(0, Math.floor(input.openSource?.issues || input.github?.issues || 0));
    const codeReviews = Math.max(0, Math.floor(input.openSource?.codeReviews || 0));
    const externalRepos = Math.max(0, Math.floor(input.openSource?.externalReposCount || 0));

    // First verified contribution milestone bonus
    const milestoneBonus = (mergedPRs > 0 || externalRepos > 0);
    const milestoneBonusPoints = milestoneBonus ? 5 : 0;

    // Quality weights: Merged PRs=10, External Repos=12, Code Reviews=6, Opened PRs=3, Issues=2
    const rawOSScore = (mergedPRs * 10) + (externalRepos * 12) + (codeReviews * 6) + (openedPRs * 3) + (issues * 2);
    // Scale = 120 raw pts: ~60 pts (5 merged PRs) -> ~40 subscore, ~200 pts -> ~81 subscore
    const p3Curve = diminishingReturns(rawOSScore, 120);
    const p3Subscore = Math.min(100, Math.round((p3Curve + milestoneBonusPoints) * 100) / 100);
    const p3Weight = 0.20;
    const p3MaxPoints = 2000;
    const p3Points = Math.round(p3Subscore * p3Weight * 100);

    // -------------------------------------------------------------------------
    // Pillar 4: Repository & Project Quality (Weight: 10% / Max: 1,000 pts)
    // -------------------------------------------------------------------------
    const publicRepos = Math.max(0, Math.floor(input.repositories?.publicRepos || input.github?.repositories || 0));
    const stars = Math.max(0, Math.floor(input.repositories?.stars || input.github?.stars || 0));
    const forks = Math.max(0, Math.floor(input.repositories?.forks || 0));
    const languagesCount = Math.max(0, Math.floor(input.repositories?.languagesCount || 0));

    // Anti-gaming: repos capped at 15 to prevent repo-spamming
    const repoBonus = Math.min(30, Math.min(publicRepos, 15) * 2);
    // Logarithmic stars bonus: 10 stars -> ~23 pts, 100 stars -> ~46 pts, 500 stars -> ~62 pts
    const starsBonus = Math.min(45, Math.log1p(stars) * 7.5);
    // Forks bonus
    const forksBonus = Math.min(15, Math.log1p(forks) * 4);
    // Polyglot diversity bonus (languages used)
    const langBonus = Math.min(10, languagesCount * 2.5);

    const p4Subscore = Math.min(100, Math.round((repoBonus + starsBonus + forksBonus + langBonus) * 100) / 100);
    const p4Weight = 0.10;
    const p4MaxPoints = 1000;
    const p4Points = Math.round(p4Subscore * p4Weight * 100);

    // -------------------------------------------------------------------------
    // Pillar 5: Consistency, Active Days & Streaks (Weight: 10% / Max: 1,000 pts)
    // -------------------------------------------------------------------------
    let activeDays = 0;
    if (input.activity?.activeDates && Array.isArray(input.activity.activeDates)) {
        const uniqueDates = new Set(input.activity.activeDates.map((d) => String(d).trim().split("T")[0]).filter(Boolean));
        activeDays = uniqueDates.size;
    } else {
        activeDays = Math.max(0, Math.floor(input.activity?.activeDaysCount || 0));
    }

    const recentDays30 = Math.max(0, Math.floor(input.activity?.recentDays30Count || Math.min(30, Math.round(activeDays * 0.15))));
    const currentStreak = Math.max(0, Math.floor(input.activity?.currentStreak || 0));

    // All-time active days: up to 50 pts (diminishing at scale 150 days)
    const activeDaysComponent = diminishingReturns(activeDays, 150) * 0.50;
    // Trailing 30-day practice density: up to 25 pts (20 active days = 25 pts)
    const recentComponent = Math.min(25, (recentDays30 / 20) * 25);
    // Daily streak: up to 25 pts (diminishing at scale 60 days)
    const streakComponent = diminishingReturns(currentStreak, 60) * 0.25;

    const p5Subscore = Math.min(100, Math.round((activeDaysComponent + recentComponent + streakComponent) * 100) / 100);
    const p5Weight = 0.10;
    const p5MaxPoints = 1000;
    const p5Points = Math.round(p5Subscore * p5Weight * 100);

    // -------------------------------------------------------------------------
    // Pillar 6: Technical Writing & Community (Weight: 5% / Max: 500 pts)
    // -------------------------------------------------------------------------
    const articleCount = Math.max(0, Math.floor(input.writing?.articleCount || 0));
    const followers = Math.max(0, Math.floor(input.writing?.followersCount || 0));
    const writingPlatforms = Array.isArray(input.writing?.platforms) ? input.writing.platforms : [];

    // Articles published: up to 50 pts (10 articles = 50 pts)
    const articlesBonus = Math.min(50, articleCount * 5);
    // Readership / followers: up to 30 pts
    const followersBonus = Math.min(30, Math.log1p(followers) * 5);
    // Platform diversity bonus: 10 pts per writing platform (Medium, Substack)
    const platformBonus = Math.min(20, writingPlatforms.length * 10);

    const p6Subscore = Math.min(100, Math.round((articlesBonus + followersBonus + platformBonus) * 100) / 100);
    const p6Weight = 0.05;
    const p6MaxPoints = 500;
    const p6Points = Math.round(p6Subscore * p6Weight * 100);

    // -------------------------------------------------------------------------
    // Total Authoritative Orbix Score [0 to 10,000]
    // -------------------------------------------------------------------------
    const totalScore = Math.min(10000, p1Points + p2Points + p3Points + p4Points + p5Points + p6Points);
    const rawTotalScore = (p1Subscore * p1Weight * 100) +
                          (p2Subscore * p2Weight * 100) +
                          (p3Subscore * p3Weight * 100) +
                          (p4Subscore * p4Weight * 100) +
                          (p5Subscore * p5Weight * 100) +
                          (p6Subscore * p6Weight * 100);

    // Backward-compatible legacy ratings fields
    const cfRating = typeof ratingsInput.codeforces === "number" && ratingsInput.codeforces > 0 ? Math.round(ratingsInput.codeforces) : null;
    const cfPointsLegacy = cfRating !== null ? Math.max(0, cfRating - 1000) : 0;
    const lcRating = typeof ratingsInput.leetcode === "number" && ratingsInput.leetcode > 0 ? Math.round(ratingsInput.leetcode) : null;
    const lcPointsLegacy = lcRating !== null ? Math.max(0, lcRating - 1500) : 0;
    const ccRating = typeof ratingsInput.codechef === "number" && ratingsInput.codechef > 0 ? Math.round(ratingsInput.codechef) : null;
    const ccPointsLegacy = ccRating !== null ? Math.max(0, 0.8 * (ccRating - 1400)) : 0;
    const acRating = typeof ratingsInput.atcoder === "number" && ratingsInput.atcoder > 0 ? Math.round(ratingsInput.atcoder) : null;
    const acPointsLegacy = acRating !== null ? Math.max(0, 0.8 * (acRating - 400)) : 0;
    const tcRating = typeof ratingsInput.topcoder === "number" && ratingsInput.topcoder > 0 ? Math.round(ratingsInput.topcoder) : null;
    const tcPointsLegacy = tcRating !== null ? Math.max(0, 0.8 * (tcRating - 1200)) : 0;

    const ghRaw = Math.max(0, Math.floor(input.github?.contributions || 0));
    const ghCapped = Math.min(ghRaw, 2000);
    const sGitHubLegacy = Math.round(ghCapped * 0.25 * 100) / 100;

    const breakdown: OrbixScoreBreakdownV2 = {
        problems: {
            rawScore: rawProblemPoints,
            subscore: p1Subscore,
            points: p1Points,
            weight: p1Weight,
            maxPoints: p1MaxPoints,
            easy,
            medium,
            hard,
            unknown,
            totalSolved,
            rawProblemPoints,
        },
        contests: {
            rawScore: ratedContests,
            subscore: p2Subscore,
            points: p2Points,
            weight: p2Weight,
            maxPoints: p2MaxPoints,
            ratedCount: ratedContests,
            bestRatingNormalized: bestNorm,
            participatingPlatforms: normalizedRatings.map((r) => r.platform),
        },
        openSource: {
            rawScore: rawOSScore,
            subscore: p3Subscore,
            points: p3Points,
            weight: p3Weight,
            maxPoints: p3MaxPoints,
            mergedPRs,
            openedPRs,
            issues,
            codeReviews,
            externalRepos,
            milestoneBonus,
        },
        repositories: {
            rawScore: publicRepos,
            subscore: p4Subscore,
            points: p4Points,
            weight: p4Weight,
            maxPoints: p4MaxPoints,
            publicRepos,
            stars,
            forks,
            languagesCount,
        },
        consistency: {
            rawScore: activeDays,
            subscore: p5Subscore,
            points: p5Points,
            weight: p5Weight,
            maxPoints: p5MaxPoints,
            activeDays,
            recentDays30,
            currentStreak,
        },
        writing: {
            rawScore: articleCount,
            subscore: p6Subscore,
            points: p6Points,
            weight: p6Weight,
            maxPoints: p6MaxPoints,
            articleCount,
            platforms: writingPlatforms,
            followersCount: followers,
        },

        // Legacy compatibility
        activity: {
            activeDays,
            points: activeDays * 2,
            currentStreak,
        },
        ratings: {
            codeforces: { rating: cfRating, baseline: 1000, points: cfPointsLegacy },
            leetcode: { rating: lcRating, baseline: 1500, points: Math.round(lcPointsLegacy * 100) / 100 },
            codechef: { rating: ccRating, baseline: 1400, multiplier: 0.8, points: Math.round(ccPointsLegacy * 100) / 100 },
            atcoder: { rating: acRating, baseline: 400, multiplier: 0.8, points: Math.round(acPointsLegacy * 100) / 100 },
            topcoder: { rating: tcRating, baseline: 1200, multiplier: 0.8, points: Math.round(tcPointsLegacy * 100) / 100 },
            totalRatingPoints: cfPointsLegacy + lcPointsLegacy + ccPointsLegacy + acPointsLegacy + tcPointsLegacy,
        },
        github: {
            contributions: ghRaw,
            cappedContributions: ghCapped,
            points: sGitHubLegacy,
        },
    };

    const parts: string[] = [];
    if (totalSolved > 0) parts.push(`${totalSolved} problems solved (${p1Points} pts)`);
    if (ratedContests > 0 || normalizedRatings.length > 0) parts.push(`Contests (${p2Points} pts)`);
    if (mergedPRs > 0 || externalRepos > 0) parts.push(`Open Source (${p3Points} pts)`);
    if (publicRepos > 0 || stars > 0) parts.push(`Repositories (${p4Points} pts)`);
    if (activeDays > 0 || currentStreak > 0) parts.push(`${activeDays} active days • ${currentStreak}d streak (${p5Points} pts)`);
    if (articleCount > 0) parts.push(`Technical Writing (${p6Points} pts)`);

    const qualificationSummary = parts.length > 0 ? parts.join(" • ") : "No qualifying developer activity recorded yet.";

    return {
        totalScore,
        rawTotalScore: Math.round(rawTotalScore * 100) / 100,
        version: ORBIX_SCORE_VERSION,
        calculatedAt: new Date().toISOString(),
        breakdown,
        qualificationSummary,
    };
}

// -----------------------------------------------------------------------------
// Version 1.0.0 Legacy Engine (Preserved for backward-compatibility)
// -----------------------------------------------------------------------------

export function calculateOrbixScoreV1(input: OrbixScoreInput): OrbixScoreResult {
    const easy = Math.max(0, Math.floor(input.problems?.easy || 0));
    const medium = Math.max(0, Math.floor(input.problems?.medium || 0));
    const hard = Math.max(0, Math.floor(input.problems?.hard || 0));
    const unknown = Math.max(0, Math.floor(input.problems?.unknownDifficulty || 0));
    const totalSolved = easy + medium + hard + unknown;
    const sProblems = (easy * 1) + (medium * 3) + (hard * 6) + (unknown * 2);

    let ratedContests = 0;
    if (input.contests?.contestIds && Array.isArray(input.contests.contestIds)) {
        const uniqueIds = new Set(input.contests.contestIds.map((id) => String(id).trim()).filter(Boolean));
        ratedContests = uniqueIds.size;
    } else {
        ratedContests = Math.max(0, Math.floor(input.contests?.ratedContestsCount || 0));
    }
    const sContests = ratedContests * 8;

    let activeDays = 0;
    if (input.activity?.activeDates && Array.isArray(input.activity.activeDates)) {
        const uniqueDates = new Set(input.activity.activeDates.map((d) => String(d).trim().split("T")[0]).filter(Boolean));
        activeDays = uniqueDates.size;
    } else {
        activeDays = Math.max(0, Math.floor(input.activity?.activeDaysCount || 0));
    }
    const sActivity = activeDays * 2;
    const currentStreak = Math.max(0, Math.floor(input.activity?.currentStreak || 0));

    const cfRating = typeof input.ratings?.codeforces === "number" && input.ratings.codeforces > 0 ? Math.round(input.ratings.codeforces) : null;
    const cfPoints = cfRating !== null ? Math.max(0, cfRating - 1000) : 0;

    const lcRating = typeof input.ratings?.leetcode === "number" && input.ratings.leetcode > 0 ? Math.round(input.ratings.leetcode) : null;
    const lcPoints = lcRating !== null ? Math.max(0, lcRating - 1500) : 0;

    const ccRating = typeof input.ratings?.codechef === "number" && input.ratings.codechef > 0 ? Math.round(input.ratings.codechef) : null;
    const ccPoints = ccRating !== null ? Math.max(0, 0.8 * (ccRating - 1400)) : 0;

    const acRating = typeof input.ratings?.atcoder === "number" && input.ratings.atcoder > 0 ? Math.round(input.ratings.atcoder) : null;
    const acPoints = acRating !== null ? Math.max(0, 0.8 * (acRating - 400)) : 0;

    const tcRating = typeof input.ratings?.topcoder === "number" && input.ratings.topcoder > 0 ? Math.round(input.ratings.topcoder) : null;
    const tcPoints = tcRating !== null ? Math.max(0, 0.8 * (tcRating - 1200)) : 0;

    const sRatingsRaw = cfPoints + lcPoints + ccPoints + acPoints + tcPoints;
    const sRatings = Math.round(sRatingsRaw * 100) / 100;

    const ghRaw = Math.max(0, Math.floor(input.github?.contributions || 0));
    const ghCapped = Math.min(ghRaw, 2000);
    const sGitHub = Math.round(ghCapped * 0.25 * 100) / 100;

    const rawTotal = sProblems + sContests + sActivity + sRatings + sGitHub;
    const totalScore = Math.round(rawTotal);

    const breakdown: any = {
        problems: {
            rawScore: sProblems,
            subscore: Math.min(100, (sProblems / 3000) * 100),
            points: sProblems,
            weight: 0.35,
            maxPoints: 3500,
            easy,
            medium,
            hard,
            unknown,
            totalSolved,
            rawProblemPoints: sProblems,
        },
        contests: {
            rawScore: ratedContests,
            subscore: Math.min(100, (sContests / 500) * 100),
            points: sContests,
            weight: 0.20,
            maxPoints: 2000,
            ratedCount: ratedContests,
            bestRatingNormalized: 0,
            participatingPlatforms: [],
        },
        openSource: {
            rawScore: 0,
            subscore: 0,
            points: 0,
            weight: 0.20,
            maxPoints: 2000,
            mergedPRs: 0,
            openedPRs: 0,
            issues: 0,
            codeReviews: 0,
            externalRepos: 0,
            milestoneBonus: false,
        },
        repositories: {
            rawScore: 0,
            subscore: 0,
            points: 0,
            weight: 0.10,
            maxPoints: 1000,
            publicRepos: 0,
            stars: 0,
            forks: 0,
            languagesCount: 0,
        },
        consistency: {
            rawScore: activeDays,
            subscore: Math.min(100, (activeDays / 200) * 100),
            points: sActivity,
            weight: 0.10,
            maxPoints: 1000,
            activeDays,
            recentDays30: 0,
            currentStreak,
        },
        writing: {
            rawScore: 0,
            subscore: 0,
            points: 0,
            weight: 0.05,
            maxPoints: 500,
            articleCount: 0,
            platforms: [],
            followersCount: 0,
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
        version: ORBIX_SCORE_V1,
        calculatedAt: new Date().toISOString(),
        breakdown,
        qualificationSummary,
    };
}

/**
 * Universal calculateOrbixScore dispatcher:
 * Defaults to v2.0.0 engine. If explicit v1.0.0 requested, uses v1.0.0 engine.
 */
export function calculateOrbixScore(input: OrbixScoreInput): OrbixScoreResult {
    if (input.version === ORBIX_SCORE_V1) {
        return calculateOrbixScoreV1(input);
    }
    return calculateOrbixScoreV2(input);
}

// -----------------------------------------------------------------------------
// Universal Portal Aggregator Across All 16 Supported Platforms
// -----------------------------------------------------------------------------

export function computeOrbixScoreFromPortals(
    portalsMap: Record<string, any>,
    contestsHistory: any[] = [],
    activityCalendar: { activeDays?: number; distinctDates?: string[]; currentStreak?: number; recentDays30?: number } = {},
    options: { version?: string } = {}
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
        hackerrank: null,
        geeksforgeeks: null,
    };

    let ghContributions = 0;
    let ghCommits = 0;
    let ghPRs = 0;
    let ghIssues = 0;
    let ghRepos = 0;
    let ghStars = 0;
    let ghForks = 0;

    let writingArticles = 0;
    let writingFollowers = 0;
    const writingPlatforms: string[] = [];

    let maxStatsActiveDays = 0;
    let maxStatsStreak = 0;

    for (const [pId, rawData] of Object.entries(portalsMap || {})) {
        if (!rawData) continue;
        const portal = pId.toLowerCase().trim();
        const snap = rawData.snapshot && typeof rawData.snapshot === "object" ? rawData.snapshot : rawData;
        const stats = Array.isArray(rawData.stats) ? rawData.stats : (Array.isArray(snap.stats) ? snap.stats : []);

        // 1. Difficulty breakdown from snapshot or stats
        let hasDiff = false;
        const diffObj = snap.difficulty || rawData.difficulty;
        if (diffObj && typeof diffObj === "object") {
            if (typeof diffObj.easy === "number" || typeof diffObj.medium === "number" || typeof diffObj.hard === "number") {
                easy += Math.max(0, diffObj.easy || 0);
                medium += Math.max(0, diffObj.medium || 0);
                hard += Math.max(0, diffObj.hard || 0);
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

        // Solves without difficulty (unknownDifficulty)
        if (!hasDiff && portal !== "github" && portal !== "medium" && portal !== "substack") {
            let solved = typeof snap.totalSolved === "number" ? snap.totalSolved : (
                typeof snap.solvedTotal === "number" ? snap.solvedTotal : 0
            );
            if (solved === 0) {
                for (const s of stats) {
                    const lbl = (s.label || "").toLowerCase();
                    if (lbl.includes("solved") || lbl.includes("problems") || lbl.includes("challenges") || lbl.includes("accepted")) {
                        const m = (s.value || "").match(/(\d+)/);
                        if (m) solved = parseInt(m[1], 10);
                    }
                }
            }
            if (solved > 0) {
                unknownDifficulty += solved;
            }
        }

        // 2. Ratings extraction across competitive platforms
        let ratingVal = typeof snap.rating === "number" ? snap.rating : (
            snap.currentRating || (typeof snap.contestRating === "number" ? snap.contestRating : null)
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
        else if (portal === "hackerrank") ratings.hackerrank = ratingVal;
        else if (portal === "geeksforgeeks") ratings.geeksforgeeks = ratingVal;

        // 3. Activity & Streaks
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

        // 4. GitHub metrics
        if (portal === "github") {
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                const m = (s.value || "").match(/([\d,]+)/);
                const count = m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
                if (lbl.includes("contribution")) ghContributions = count || ghContributions;
                if (lbl.includes("commit")) ghCommits = count || ghCommits;
                if (lbl.includes("repo")) ghRepos = count || ghRepos;
                if (lbl.includes("follower")) writingFollowers += count;
                if (lbl.includes("pr") || lbl.includes("pull request")) ghPRs = count || ghPRs;
                if (lbl.includes("issue")) ghIssues = count || ghIssues;
                if (lbl.includes("star")) ghStars = count || ghStars;
            }
            if (snap.repositories && typeof snap.repositories === "number") ghRepos = snap.repositories;
            if (snap.stars && typeof snap.stars === "number") ghStars = snap.stars;
            if (snap.forks && typeof snap.forks === "number") ghForks = snap.forks;
            if (snap.pullRequests && typeof snap.pullRequests === "number") ghPRs = snap.pullRequests;
        }

        // 5. Technical Writing (Medium, Substack, AlgorithmXlr8)
        if (portal === "medium" || portal === "substack" || portal === "algorithmxlr8") {
            writingPlatforms.push(portal);
            for (const s of stats) {
                const lbl = (s.label || "").toLowerCase();
                const m = (s.value || "").match(/(\d+)/);
                const count = m ? parseInt(m[1], 10) : 0;
                if (lbl.includes("article") || lbl.includes("post") || lbl.includes("story") || lbl.includes("solution")) {
                    writingArticles += count;
                }
                if (lbl.includes("follower") || lbl.includes("subscriber")) {
                    writingFollowers += count;
                }
            }
        }
    }

    // 6. Rated contests deduplication
    let ratedContestsCount = 0;
    const contestIds: string[] = [];

    if (Array.isArray(contestsHistory) && contestsHistory.length > 0) {
        for (const c of contestsHistory) {
            const portal = (c.portal || "").toLowerCase();
            const id = c.contestId || `${portal}-${c.timestamp || c.date}`;
            contestIds.push(String(id));
        }
        ratedContestsCount = new Set(contestIds).size;
    } else {
        for (const [pId, rawData] of Object.entries(portalsMap || {})) {
            if (!rawData) continue;
            const snap = rawData.snapshot || rawData;
            if (typeof snap.ratedContestsCount === "number") {
                ratedContestsCount += snap.ratedContestsCount;
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

    const finalActiveDays = activityCalendar.activeDays || (activityCalendar.distinctDates?.length || 0) || maxStatsActiveDays;
    const finalStreak = activityCalendar.currentStreak || maxStatsStreak;
    const finalRecent30 = activityCalendar.recentDays30 || Math.min(30, Math.round(finalActiveDays * 0.15));

    const selectedVersion = options.version || ORBIX_SCORE_VERSION;

    return calculateOrbixScore({
        version: selectedVersion,
        problems: { easy, medium, hard, unknownDifficulty },
        ratings,
        contests: { ratedContestsCount, contestIds },
        openSource: {
            mergedPRs: ghPRs,
            openedPRs: Math.round(ghPRs * 0.3),
            issues: ghIssues,
            codeReviews: Math.round(ghPRs * 0.4),
            externalReposCount: ghRepos > 2 ? Math.min(ghRepos, 5) : 0,
        },
        repositories: {
            publicRepos: ghRepos,
            stars: ghStars,
            forks: ghForks,
            languagesCount: ghRepos > 0 ? 3 : 0,
        },
        activity: {
            activeDaysCount: finalActiveDays,
            activeDates: activityCalendar.distinctDates,
            recentDays30Count: finalRecent30,
            currentStreak: finalStreak,
        },
        writing: {
            articleCount: writingArticles,
            followersCount: writingFollowers,
            platforms: writingPlatforms,
        },
        github: {
            contributions: ghContributions,
            commits: ghCommits,
            pullRequests: ghPRs,
            issues: ghIssues,
            repositories: ghRepos,
            stars: ghStars,
        },
    });
}
