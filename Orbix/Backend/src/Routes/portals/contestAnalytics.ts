import { query } from "../../database/client.js";
import {
    getCodeforcesTier as getCfTierOfficial,
    getLeetCodeTier as getLtTierOfficial,
    getCodeChefTier as getCcTierOfficial,
    getAtCoderTier as getAcTierOfficial,
} from "../../utils/ratingSystems.js";

export interface ContestHistoryPoint {
    contestId: string | number;
    contestName: string;
    date: string; // ISO date string "YYYY-MM-DD"
    timestamp: number; // Unix timestamp in milliseconds
    rating: number; // Rating after contest
    ratingBefore?: number | null | undefined;
    ratingChange?: number | null | undefined;
    rank?: number | null | undefined;
    division?: string | null | undefined;
    problemsSolved?: number | null | undefined;
    totalProblems?: number | null | undefined;
}

export interface PlatformTierInfo {
    name: string;
    color: string;
    badgeBg?: string | undefined;
    description?: string | undefined;
    nextTierName?: string | null | undefined;
    pointsToNextTier?: number | null | undefined;
    progressPercent?: number | null | undefined;
}

export interface PlatformContestAnalytics {
    portal: string;
    portalName: string;
    portalUsername: string;
    profileUrl: string;
    connected: boolean;
    currentRating: number | null;
    peakRating: number | null;
    tier: string | null;
    tierColor: string | null;
    tierInfo: PlatformTierInfo | null;
    officialRank: number | null;
    percentile?: number | null | undefined;
    ratedContestsCount: number;
    history: ContestHistoryPoint[];
    recentChange90d?: number | null | undefined;
    lastSyncAt: string;
    status: "valid" | "no_contests" | "history_unavailable" | "syncing" | "error" | "not_connected";
    statusMessage?: string | undefined;
    exploreContestsUrl: string;
}

export interface UnifiedRecentContestItem {
    portal: string;
    portalName: string;
    contestId: string;
    contestName: string;
    contestUrl: string;
    date: string;
    timestamp: number;
    rank: number | null;
    rating: number;
    ratingBefore: number | null;
    ratingChange: number | null;
    division?: string | null;
    problemsSolved?: number | null;
    totalProblems?: number | null;
}

export function getContestUrl(portal: string, contestId: string | number, contestName?: string): string {
    const p = portal.toLowerCase().trim();
    const id = String(contestId || "").trim();
    if (p === "codeforces") {
        return /^\d+$/.test(id) ? `https://codeforces.com/contest/${id}` : `https://codeforces.com/contests`;
    }
    if (p === "leetcode") {
        if (contestName) {
            const slug = contestName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            return `https://leetcode.com/contest/${slug}`;
        }
        return `https://leetcode.com/contest/`;
    }
    if (p === "codechef") {
        return id ? `https://www.codechef.com/${id}` : `https://www.codechef.com/contests`;
    }
    if (p === "atcoder") {
        return id ? `https://atcoder.jp/contests/${id}` : `https://atcoder.jp/contests/`;
    }
    if (p === "hackerrank") {
        return id ? `https://www.hackerrank.com/contests/${id}` : `https://www.hackerrank.com/contests`;
    }
    return `https://${portal}.com`;
}

export interface UnifiedContestResponse {
    success: boolean;
    username: string;
    timestamp: string;
    platforms: PlatformContestAnalytics[];
    recentContests?: UnifiedRecentContestItem[];
    summary: {
        totalRatedContests: number;
        platformContestCounts: Record<string, number>;
    };
}

// --- Official Platform Tier Definitions (Delegating to ratingSystems.ts) ---

export function getCodeforcesTier(rating: number): PlatformTierInfo {
    const tier = getCfTierOfficial(rating);
    return {
        name: tier.name,
        color: tier.color,
        badgeBg: tier.badgeBg,
        description: tier.description,
        nextTierName: tier.nextTierName,
        pointsToNextTier: tier.pointsToNextTier,
        progressPercent: tier.progressPercent,
    };
}

export function getLeetCodeTier(rating: number, badgeName?: string | null | undefined): PlatformTierInfo {
    const tier = getLtTierOfficial(rating, badgeName);
    return {
        name: tier.name,
        color: tier.color,
        badgeBg: tier.badgeBg,
        description: tier.description,
        nextTierName: tier.nextTierName,
        pointsToNextTier: tier.pointsToNextTier,
        progressPercent: tier.progressPercent,
    };
}

export function getCodeChefTier(rating: number): PlatformTierInfo {
    const tier = getCcTierOfficial(rating);
    return {
        name: tier.name,
        color: tier.color,
        badgeBg: tier.badgeBg,
        description: tier.description,
        nextTierName: tier.nextTierName,
        pointsToNextTier: tier.pointsToNextTier,
        progressPercent: tier.progressPercent,
    };
}

export function getAtCoderTier(rating: number): PlatformTierInfo {
    const tier = getAcTierOfficial(rating);
    return {
        name: tier.name,
        color: tier.color,
        badgeBg: tier.badgeBg,
        description: tier.description,
        nextTierName: tier.nextTierName,
        pointsToNextTier: tier.pointsToNextTier,
        progressPercent: tier.progressPercent,
    };
}

export function getHackerRankTier(rating: number): PlatformTierInfo {
    if (rating < 1500) {
        const next = 1500;
        return {
            name: "Bronze",
            color: "#94a3b8",
            nextTierName: "Silver",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Bronze competitive tier on HackerRank (< 1500)",
        };
    }
    if (rating < 1850) {
        const min = 1500;
        const next = 1850;
        return {
            name: "Silver",
            color: "#22c55e",
            nextTierName: "Gold",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Silver competitive tier on HackerRank (1500 - 1849)",
        };
    }
    if (rating < 2200) {
        const min = 1850;
        const next = 2200;
        return {
            name: "Gold",
            color: "#3b82f6",
            nextTierName: "Platinum",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Gold competitive tier on HackerRank (1850 - 2199)",
        };
    }
    if (rating < 2500) {
        const min = 2200;
        const next = 2500;
        return {
            name: "Platinum",
            color: "#a855f7",
            nextTierName: "Diamond",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Platinum master tier on HackerRank (2200 - 2499)",
        };
    }
    return {
        name: "Diamond",
        color: "#f59e0b",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Diamond grandmaster tier on HackerRank (>= 2500)",
    };
}

export function getTopCoderTier(rating: number): PlatformTierInfo {
    if (rating < 900) {
        const next = 900;
        return {
            name: "Grey",
            color: "#94a3b8",
            nextTierName: "Green",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Grey competitive tier on TopCoder (< 900)",
        };
    }
    if (rating < 1200) {
        const min = 900;
        const next = 1200;
        return {
            name: "Green",
            color: "#22c55e",
            nextTierName: "Blue",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Green division tier on TopCoder (900 - 1199)",
        };
    }
    if (rating < 1500) {
        const min = 1200;
        const next = 1500;
        return {
            name: "Blue",
            color: "#2563eb",
            nextTierName: "Yellow",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Blue division tier on TopCoder (1200 - 1499)",
        };
    }
    if (rating < 2200) {
        const min = 1500;
        const next = 2200;
        return {
            name: "Yellow",
            color: "#eab308",
            nextTierName: "Red",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Yellow master tier on TopCoder (1500 - 2199)",
        };
    }
    return {
        name: "Red",
        color: "#ef4444",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Red grandmaster tier on TopCoder (>= 2200)",
    };
}

export function getGeeksforGeeksTier(rating: number): PlatformTierInfo {
    if (rating < 500) {
        const next = 500;
        return {
            name: "Beginner",
            color: "#94a3b8",
            nextTierName: "Bronze",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Beginner coder on GeeksforGeeks (< 500 score)",
        };
    }
    if (rating < 1000) {
        const min = 500;
        const next = 1000;
        return {
            name: "Bronze",
            color: "#a16207",
            nextTierName: "Silver",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Bronze tier on GeeksforGeeks (500 - 999 score)",
        };
    }
    if (rating < 2000) {
        const min = 1000;
        const next = 2000;
        return {
            name: "Silver",
            color: "#06b6d4",
            nextTierName: "Gold",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Silver tier on GeeksforGeeks (1000 - 1999 score)",
        };
    }
    if (rating < 4000) {
        const min = 2000;
        const next = 4000;
        return {
            name: "Gold",
            color: "#eab308",
            nextTierName: "Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Gold competitive tier on GeeksforGeeks (2000 - 3999 score)",
        };
    }
    return {
        name: "Master",
        color: "#8b5cf6",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Master tier on GeeksforGeeks (>= 4000 score)",
    };
}

export function getHackerEarthTier(rating: number): PlatformTierInfo {
    if (rating < 1400) {
        const next = 1400;
        return {
            name: "Novice",
            color: "#94a3b8",
            nextTierName: "Challenger",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Novice rank on HackerEarth (< 1400)",
        };
    }
    if (rating < 1600) {
        const min = 1400;
        const next = 1600;
        return {
            name: "Challenger",
            color: "#22c55e",
            nextTierName: "Expert",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Challenger division on HackerEarth (1400 - 1599)",
        };
    }
    if (rating < 1800) {
        const min = 1600;
        const next = 1800;
        return {
            name: "Expert",
            color: "#2563eb",
            nextTierName: "Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Expert division on HackerEarth (1600 - 1799)",
        };
    }
    return {
        name: "Master",
        color: "#f59e0b",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Master division on HackerEarth (>= 1800)",
    };
}

export function getInterviewBitTier(rating: number): PlatformTierInfo {
    if (rating < 1000) {
        const next = 1000;
        return {
            name: "Novice",
            color: "#94a3b8",
            nextTierName: "Specialist",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Novice ranking tier on InterviewBit",
        };
    }
    if (rating < 3000) {
        const min = 1000;
        const next = 3000;
        return {
            name: "Specialist",
            color: "#06b6d4",
            nextTierName: "Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Specialist ranking tier on InterviewBit",
        };
    }
    return {
        name: "Master",
        color: "#f59e0b",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Master ranking tier on InterviewBit",
    };
}

export function getCode360Tier(rating: number): PlatformTierInfo {
    if (rating < 1000) {
        const next = 1000;
        return {
            name: "Ninja",
            color: "#94a3b8",
            nextTierName: "Ninja Specialist",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Ninja level on Code360 (< 1000)",
        };
    }
    if (rating < 2500) {
        const min = 1000;
        const next = 2500;
        return {
            name: "Ninja Specialist",
            color: "#22c55e",
            nextTierName: "Ninja Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Specialist on Code360 (1000 - 2499)",
        };
    }
    return {
        name: "Ninja Master",
        color: "#f59e0b",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Master on Code360 (>= 2500)",
    };
}

// --- Platform-Specific Fetchers ---

export async function fetchCodeforcesContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const [infoRes, ratingRes] = await Promise.all([
            fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4500),
            }).catch(() => null),
            fetch(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4500),
            }).catch(() => null),
        ]);

        if (!infoRes?.ok) return null;
        const infoData = (await infoRes.json()) as any;
        if (infoData.status !== "OK" || !infoData.result?.[0]) return null;

        const user = infoData.result[0];
        const currentRating = typeof user.rating === "number" ? user.rating : null;
        const peakRating = typeof user.maxRating === "number" ? user.maxRating : currentRating;
        const rankTitle = user.rank ? String(user.rank).charAt(0).toUpperCase() + String(user.rank).slice(1) : null;

        let history: ContestHistoryPoint[] = [];
        if (ratingRes?.ok) {
            const ratingData = (await ratingRes.json()) as any;
            if (ratingData.status === "OK" && Array.isArray(ratingData.result)) {
                history = ratingData.result.map((item: any) => {
                    const ts = (item.ratingUpdateTimeSeconds || 0) * 1000;
                    const date = ts ? new Date(ts).toISOString().split("T")[0] || "" : "";
                    const rating = item.newRating;
                    const ratingBefore = item.oldRating;
                    const ratingChange = typeof rating === "number" && typeof ratingBefore === "number" ? rating - ratingBefore : null;

                    let division: string | null = null;
                    const divMatch = item.contestName?.match(/Div\.\s*(\d+)/i);
                    if (divMatch && divMatch[1]) {
                        division = `Div. ${divMatch[1]}`;
                    }

                    return {
                        contestId: item.contestId,
                        contestName: item.contestName || "Codeforces Round",
                        date,
                        timestamp: ts,
                        rating,
                        ratingBefore: ratingBefore ?? null,
                        ratingChange,
                        rank: item.rank || null,
                        division,
                    };
                });
            }
        }

        // Sort chronologically ascending
        history.sort((a, b) => a.timestamp - b.timestamp);

        return {
            history,
            currentRating,
            peakRating,
            rankTitle,
            officialRank: null,
        };
    } catch {
        return null;
    }
}

export async function fetchLeetCodeContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    badgeName: string | null;
    officialRank: number | null;
    percentile: number | null;
} | null> {
    try {
        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({
                query: `query userContest($username: String!) {
                    userContestRanking(username: $username) {
                        attendedContestsCount
                        rating
                        globalRanking
                        totalParticipants
                        topPercentage
                        badge {
                            name
                        }
                    }
                    userContestRankingHistory(username: $username) {
                        attended
                        trendDirection
                        problemsSolved
                        totalProblems
                        finishTimeInSeconds
                        rating
                        ranking
                        contest {
                            title
                            startTime
                        }
                    }
                }`,
                variables: { username },
            }),
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        const ranking = data?.data?.userContestRanking;
        const rawHistory = data?.data?.userContestRankingHistory;

        const currentRating = ranking?.rating ? Math.round(ranking.rating) : null;
        const badgeName = ranking?.badge?.name || null;
        const officialRank = ranking?.globalRanking || null;
        const percentile = typeof ranking?.topPercentage === "number" ? ranking.topPercentage : null;

        let history: ContestHistoryPoint[] = [];
        let maxRating = currentRating || 0;

        if (Array.isArray(rawHistory)) {
            const attendedList = rawHistory.filter((item: any) => item.attended && item.rating > 0);
            // Strictly sort chronologically ascending before calculating delta and beforeRating
            attendedList.sort((a: any, b: any) => (a.contest?.startTime || 0) - (b.contest?.startTime || 0));

            let prevRating: number | null = null;
            history = attendedList.map((item: any) => {
                const ts = (item.contest?.startTime || 0) * 1000;
                const date = ts ? new Date(ts).toISOString().split("T")[0] || "" : "";
                const roundedRating = Math.round(item.rating);
                if (roundedRating > maxRating) maxRating = roundedRating;

                const ratingChange = prevRating !== null ? roundedRating - prevRating : null;
                const ratingBefore = prevRating;
                prevRating = roundedRating;

                return {
                    contestId: item.contest?.title || `lc-${ts}`,
                    contestName: item.contest?.title || "LeetCode Contest",
                    date,
                    timestamp: ts,
                    rating: roundedRating,
                    ratingBefore: ratingBefore ?? null,
                    ratingChange,
                    rank: item.ranking || null,
                    problemsSolved: item.problemsSolved ?? null,
                    totalProblems: item.totalProblems ?? null,
                };
            });
        }

        // Derive accurate peak rating from all attended contests
        const peakRating = history.length > 0 ? Math.max(...history.map((h) => h.rating)) : currentRating;

        return {
            history,
            currentRating,
            peakRating,
            badgeName,
            officialRank,
            percentile,
        };
    } catch {
        return null;
    }
}

export async function fetchCodeChefContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    stars: string | null;
    officialRank: number | null;
} | null> {
    try {
        const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(username)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok || res.status === 404 || res.redirected) return null;
        const html = await res.text();
        if (html.includes("User does not exist") || html.includes("404 Not Found")) return null;

        const ratingMatch = html.match(/class=[\x27"]rating-number[\x27"]>\s*(\d+)\s*<\/div>/i);
        const currentRating = ratingMatch && ratingMatch[1] ? parseInt(ratingMatch[1], 10) : null;

        const starsMatch = html.match(/class=[\x27"]rating-star[\x27"]>([\s\S]*?)<\/div>/i);
        const starContent = starsMatch && starsMatch[1] ? starsMatch[1] : "";
        const starCount = (starContent.match(/(?:★|&#9733;|&starf;)/gi) || starContent.match(/<span/gi) || []).length;
        const stars = starCount > 0 ? `${starCount}★` : null;

        const globalRankMatch = html.match(/<a\s+href=[\x27"]\/ratings\/all[\x27"]>\s*<strong>\s*(\d+)\s*<\/strong>\s*<\/a>\s*Global Rank/i);
        const officialRank = globalRankMatch && globalRankMatch[1] ? parseInt(globalRankMatch[1], 10) : null;

        let history: ContestHistoryPoint[] = [];
        let peakRating = currentRating;

        const ccRatingsMatch = html.match(/var\s+all_rating\s*=\s*(\[[^;]+\]);/i);
        if (ccRatingsMatch && ccRatingsMatch[1]) {
            try {
                const parsed = JSON.parse(ccRatingsMatch[1]);
                if (Array.isArray(parsed)) {
                    const validItems = parsed.map((item: any) => {
                        let ts = 0;
                        let date = "";
                        if (item.end_date) {
                            ts = new Date(item.end_date).getTime();
                            date = new Date(item.end_date).toISOString().split("T")[0] || "";
                        } else if (item.getyear && item.getmonth && item.getday) {
                            const d = new Date(parseInt(item.getyear, 10), parseInt(item.getmonth, 10) - 1, parseInt(item.getday, 10));
                            ts = d.getTime();
                            date = d.toISOString().split("T")[0] || "";
                        }
                        return { ...item, _ts: ts, _date: date };
                    }).filter((item: any) => item._ts > 0 && !isNaN(parseInt(item.rating, 10)));

                    // Strictly sort chronologically ascending before calculating delta and beforeRating
                    validItems.sort((a: any, b: any) => a._ts - b._ts);

                    let prevRating: number | null = null;
                    history = validItems.map((item: any) => {
                        const r = parseInt(item.rating, 10);
                        if (!isNaN(r) && (peakRating === null || r > peakRating)) {
                            peakRating = r;
                        }

                        const rankNum = item.rank ? parseInt(item.rank, 10) : null;
                        const ratingChange = prevRating !== null ? r - prevRating : null;
                        const ratingBefore = prevRating;
                        prevRating = r;

                        let division: string | null = null;
                        const divMatch = item.name?.match(/Division\s*(\d+)/i) || item.name?.match(/Div\.\s*(\d+)/i);
                        if (divMatch && divMatch[1]) {
                            division = `Div ${divMatch[1]}`;
                        }

                        return {
                            contestId: item.code || `cc-${item._ts}`,
                            contestName: item.name || "CodeChef Contest",
                            date: item._date,
                            timestamp: item._ts,
                            rating: r,
                            ratingBefore: ratingBefore ?? null,
                            ratingChange,
                            rank: rankNum,
                            division,
                        };
                    });
                }
            } catch {
                // Ignore parse error
            }
        }

        return {
            history,
            currentRating,
            peakRating,
            stars,
            officialRank,
        };
    } catch {
        return null;
    }
}

export async function fetchAtCoderContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const res = await fetch(`https://atcoder.jp/users/${encodeURIComponent(username)}/history/json`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        if (!Array.isArray(data)) return null;

        const ratedList = data.filter((item: any) => item.IsRated);
        let peakRating: number | null = null;
        let currentRating: number | null = null;

        const history: ContestHistoryPoint[] = ratedList.map((item: any) => {
            const ts = item.EndTime ? new Date(item.EndTime).getTime() : 0;
            const date = ts ? new Date(ts).toISOString().split("T")[0] || "" : "";
            const rating = item.NewRating;
            const ratingBefore = item.OldRating;
            const ratingChange = typeof rating === "number" && typeof ratingBefore === "number" ? rating - ratingBefore : null;

            if (peakRating === null || rating > peakRating) {
                peakRating = rating;
            }

            return {
                contestId: item.ContestScreenName || `ac-${ts}`,
                contestName: item.ContestName || "AtCoder Contest",
                date,
                timestamp: ts,
                rating,
                ratingBefore: ratingBefore ?? null,
                ratingChange,
                rank: item.Place || null,
                division: null,
            };
        });

        // Sort chronologically ascending
        history.sort((a, b) => a.timestamp - b.timestamp);

        if (history.length > 0) {
            const lastPoint = history[history.length - 1];
            if (lastPoint) {
                currentRating = lastPoint.rating;
            }
        }

        return {
            history,
            currentRating,
            peakRating,
            rankTitle: currentRating !== null ? getAtCoderTier(currentRating).name : null,
            officialRank: null,
        };
    } catch {
        return null;
    }
}

export async function fetchHackerRankContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const res = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/rating_histories_elo`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        const models = Array.isArray(data.models) ? data.models : [];

        let allEvents: any[] = [];
        for (const m of models) {
            if (Array.isArray(m.events)) {
                for (const e of m.events) {
                    allEvents.push({ ...e, category: m.category || "Algorithms" });
                }
            }
        }

        allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let peakRating: number | null = null;
        let currentRating: number | null = null;
        let prevRating: number | null = null;

        const history: ContestHistoryPoint[] = allEvents.map((e, idx) => {
            const ts = e.date ? new Date(e.date).getTime() : 0;
            const date = ts ? new Date(ts).toISOString().split("T")[0] || "" : "";
            const roundedRating = Math.round(e.rating);

            if (peakRating === null || roundedRating > peakRating) {
                peakRating = roundedRating;
            }

            const ratingChange = prevRating !== null ? roundedRating - prevRating : null;
            const ratingBefore = prevRating;
            prevRating = roundedRating;

            return {
                contestId: e.contest_slug || `hr-${idx}`,
                contestName: e.contest_name || "HackerRank Contest",
                date,
                timestamp: ts,
                rating: roundedRating,
                ratingBefore: ratingBefore ?? null,
                ratingChange,
                rank: e.rank || null,
                division: e.category || null,
            };
        });

        if (history.length > 0) {
            const last = history[history.length - 1];
            if (last) {
                currentRating = last.rating;
            }
        }

        return {
            history,
            currentRating,
            peakRating,
            rankTitle: currentRating !== null ? getHackerRankTier(currentRating).name : null,
            officialRank: null,
        };
    } catch {
        return null;
    }
}

export async function fetchTopCoderContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const res = await fetch(`https://api.topcoder.com/v6/members?handle=${encodeURIComponent(username)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        const members = await res.json();
        if (!Array.isArray(members) || members.length === 0) return null;

        const m = members[0];
        if (!m || !m.handle) return null;

        const srm = m.stats?.[0]?.DATA_SCIENCE?.SRM;
        const rating = srm?.rank?.rating || m.stats?.[0]?.maxRating?.rating || null;
        const peak = srm?.rank?.maximumRating || m.stats?.[0]?.maxRating?.rating || rating;
        const challenges = srm?.challenges || m.stats?.[0]?.challenges || 0;

        const currentRating = typeof rating === "number" ? Math.round(rating) : null;
        const peakRating = typeof peak === "number" ? Math.round(peak) : currentRating;

        let history: ContestHistoryPoint[] = [];
        if (currentRating !== null) {
            history.push({
                contestId: "tc-srm-latest",
                contestName: `TopCoder SRM (${challenges} rounds)`,
                date: new Date().toISOString().split("T")[0] || "",
                timestamp: Date.now(),
                rating: currentRating,
                ratingBefore: null,
                ratingChange: null,
                rank: srm?.rank?.rank || null,
                division: "SRM",
            });
        }

        return {
            history,
            currentRating,
            peakRating,
            rankTitle: currentRating !== null ? getTopCoderTier(currentRating).name : null,
            officialRank: srm?.rank?.rank || null,
        };
    } catch {
        return null;
    }
}

export async function fetchGeeksforGeeksContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const clean = username.trim();
        const res = await fetch(`https://www.geeksforgeeks.org/user/${encodeURIComponent(clean)}/`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok || res.status === 404) return null;
        const text = await res.text();
        if (text.includes("NEXT_REDIRECT;replace;/connect/explore;307;")) return null;

        const scoreMatch = text.match(/score[^\d]*(\d+)/i);
        const rankMatch = text.match(/institute_rank\\*":\\*"([^\\"]+)\\"/i);

        const codingScore = scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1], 10) : null;
        const officialRank = rankMatch && rankMatch[1] ? parseInt(rankMatch[1], 10) : null;

        let history: ContestHistoryPoint[] = [];
        if (codingScore !== null && codingScore > 0) {
            history.push({
                contestId: "gfg-score",
                contestName: "GeeksforGeeks Weekly Contests & Practice",
                date: new Date().toISOString().split("T")[0] || "",
                timestamp: Date.now(),
                rating: codingScore,
                ratingBefore: null,
                ratingChange: null,
                rank: officialRank,
                division: null,
            });
        }

        return {
            history,
            currentRating: codingScore,
            peakRating: codingScore,
            rankTitle: codingScore !== null ? getGeeksforGeeksTier(codingScore).name : null,
            officialRank,
        };
    } catch {
        return null;
    }
}

export async function fetchHackerEarthContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const res = await fetch(`https://www.hackerearth.com/@${encodeURIComponent(username)}/`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (html.includes("Profile Not Found") || html.includes("Profile not found")) return null;

        const scoreMatch = html.match(/"current_score"\s*:\s*(\d+)/i) || html.match(/score[^\d]*(\d+)/i);
        const currentRating = scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1], 10) : null;

        let history: ContestHistoryPoint[] = [];
        if (currentRating !== null && currentRating > 0) {
            history.push({
                contestId: "he-circuit",
                contestName: "HackerEarth Circuits & Contests",
                date: new Date().toISOString().split("T")[0] || "",
                timestamp: Date.now(),
                rating: currentRating,
                ratingBefore: null,
                ratingChange: null,
                rank: null,
                division: null,
            });
        }

        return {
            history,
            currentRating,
            peakRating: currentRating,
            rankTitle: currentRating !== null ? getHackerEarthTier(currentRating).name : null,
            officialRank: null,
        };
    } catch {
        return null;
    }
}

export async function fetchInterviewBitContests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        let clean = username.trim().replace(/^@+/, "");
        if (clean.includes("interviewbit.com") || clean.includes("scaler.com")) {
            const match =
                clean.match(/(?:interviewbit\.com|scaler\.com)\/(?:profile|user|users|u|academy\/profile)\/([a-zA-Z0-9_\.\-]+)/i) ||
                clean.match(/(?:interviewbit\.com|scaler\.com)\/([a-zA-Z0-9_\.\-]+)$/i);
            if (match && match[1]) clean = match[1];
        }
        clean = (clean.replace(/\/+$/, "").split("/")[0] || "").split("?")[0]?.trim() || "";
        if (!clean) return null;

        const res = await fetch(`https://www.interviewbit.com/v2/profile/username?id=${encodeURIComponent(clean)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
                "Referer": `https://www.interviewbit.com/profile/${encodeURIComponent(clean)}/`,
            },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        const data = await res.json();
        if (!data || (!data.username && !data.id && !data.name)) return null;

        const globalRank = typeof data.global_rank === "number" ? data.global_rank : null;

        return {
            history: [],
            currentRating: null,
            peakRating: null,
            rankTitle: globalRank ? (globalRank <= 1000 ? "Grandmaster" : globalRank <= 10000 ? "Master" : "Challenger") : null,
            officialRank: globalRank,
        };
    } catch {
        return null;
    }
}

export async function fetchCode360Contests(username: string): Promise<{
    history: ContestHistoryPoint[];
    currentRating: number | null;
    peakRating: number | null;
    rankTitle: string | null;
    officialRank: number | null;
} | null> {
    try {
        const clean = username.trim().replace(/^@+/, "");
        if (!/^[a-zA-Z0-9_\.\-]{3,50}$/.test(clean)) return null;

        const res = await fetch(`https://www.naukri.com/code360/profile/${encodeURIComponent(clean)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return null;
        return {
            history: [],
            currentRating: null,
            peakRating: null,
            rankTitle: "Ninja",
            officialRank: null,
        };
    } catch {
        return null;
    }
}

// --- Supported Contest Platforms Registry ---
// ONLY platforms that arrange contest systems are included here.
// Non-contest platforms (GitHub, Medium, Substack, CSES, SPOJ) are excluded.

export interface EligiblePlatformConfig {
    name: string;
    exploreContestsUrl: string;
    buildProfileUrl: (username: string) => string;
    fetcher: (username: string) => Promise<any>;
    getTier: (rating: number, extra?: any) => PlatformTierInfo;
}

export const ELIGIBLE_CONTEST_PLATFORMS: Record<string, EligiblePlatformConfig> = {
    codeforces: {
        name: "Codeforces",
        exploreContestsUrl: "https://codeforces.com/contests",
        buildProfileUrl: (u) => `https://codeforces.com/profile/${u}`,
        fetcher: fetchCodeforcesContests,
        getTier: (r) => getCodeforcesTier(r),
    },
    leetcode: {
        name: "LeetCode",
        exploreContestsUrl: "https://leetcode.com/contest/",
        buildProfileUrl: (u) => `https://leetcode.com/u/${u}`,
        fetcher: fetchLeetCodeContests,
        getTier: (r, extra) => getLeetCodeTier(r, extra?.badgeName),
    },
    codechef: {
        name: "CodeChef",
        exploreContestsUrl: "https://www.codechef.com/contests",
        buildProfileUrl: (u) => `https://www.codechef.com/users/${u}`,
        fetcher: fetchCodeChefContests,
        getTier: (r) => getCodeChefTier(r),
    },
    atcoder: {
        name: "AtCoder",
        exploreContestsUrl: "https://atcoder.jp/contests/",
        buildProfileUrl: (u) => `https://atcoder.jp/users/${u}`,
        fetcher: fetchAtCoderContests,
        getTier: (r) => getAtCoderTier(r),
    },
    topcoder: {
        name: "TopCoder",
        exploreContestsUrl: "https://www.topcoder.com/community/single-round-match",
        buildProfileUrl: (u) => `https://profiles.topcoder.com/${u}`,
        fetcher: fetchTopCoderContests,
        getTier: (r) => getTopCoderTier(r),
    },
    hackerrank: {
        name: "HackerRank",
        exploreContestsUrl: "https://www.hackerrank.com/contests",
        buildProfileUrl: (u) => `https://www.hackerrank.com/profile/${u}`,
        fetcher: fetchHackerRankContests,
        getTier: (r) => getHackerRankTier(r),
    },
    geeksforgeeks: {
        name: "GeeksforGeeks",
        exploreContestsUrl: "https://practice.geeksforgeeks.org/events",
        buildProfileUrl: (u) => `https://www.geeksforgeeks.org/user/${u}/`,
        fetcher: fetchGeeksforGeeksContests,
        getTier: (r) => getGeeksforGeeksTier(r),
    },
    hackerearth: {
        name: "HackerEarth",
        exploreContestsUrl: "https://www.hackerearth.com/challenges/",
        buildProfileUrl: (u) => `https://www.hackerearth.com/@${u}`,
        fetcher: fetchHackerEarthContests,
        getTier: (r) => getHackerEarthTier(r),
    },
    interviewbit: {
        name: "InterviewBit",
        exploreContestsUrl: "https://www.interviewbit.com/contests/",
        buildProfileUrl: (u) => `https://www.interviewbit.com/profile/${u}`,
        fetcher: fetchInterviewBitContests,
        getTier: (r) => getInterviewBitTier(r),
    },
    code360: {
        name: "Code360",
        exploreContestsUrl: "https://www.naukri.com/code360/contests",
        buildProfileUrl: (u) => `https://www.naukri.com/code360/profile/${u}`,
        fetcher: fetchCode360Contests,
        getTier: (r) => ({
            name: "Contender",
            color: "#f59e0b",
            badgeBg: "#fef3c7",
            nextTierName: null,
            pointsToNextTier: 0,
            progressPercent: 100,
            description: "Code360 competitive coder",
        }),
    },
};

/**
 * Calculates 90-day net rating change from a chronological history list
 */
function calculate90dRatingChange(history: ContestHistoryPoint[]): number | null {
    if (!history || history.length < 2) return null;
    const latest = history[history.length - 1];
    if (!latest) return null;

    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

    // Find the contest point right before or at the 90-day mark
    let baselinePoint: ContestHistoryPoint | null = null;
    for (let i = history.length - 2; i >= 0; i--) {
        const pt = history[i];
        if (pt && pt.timestamp <= cutoff) {
            baselinePoint = pt;
            break;
        }
    }
    // If no point is older than 90 days, use the earliest contest in history
    if (!baselinePoint && history[0]) {
        baselinePoint = history[0];
    }

    if (baselinePoint && typeof latest.rating === "number" && typeof baselinePoint.rating === "number") {
        return latest.rating - baselinePoint.rating;
    }
    return null;
}

/**
 * Consolidates contest analytics across all eligible connected platforms for a user.
 * Supports merging platforms from database (user_links) AND client-supplied portals.
 */
export async function calculateUserContestPerformance(
    username: string,
    clientPortals?: Record<string, string> | undefined
): Promise<UnifiedContestResponse> {
    const cleanUsername = username.trim();

    // Query Postgres for user's connected platforms
    let rows: any[] = [];
    try {
        const result = await query(
            `SELECT portal, portal_username, verified, display_name
             FROM user_links
             WHERE (
                LOWER(username) = LOWER($1)
                OR LOWER(username) = (SELECT LOWER(email) FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1)
                OR user_id = (SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1)
             )
             ORDER BY portal ASC;`,
            [cleanUsername]
        );
        rows = result?.rows || [];
    } catch {
        // Safe fallback
    }

    const connectedMap = new Map<string, string>();
    // First, populate from database rows
    for (const row of rows) {
        const portal = (row.portal || "").toLowerCase().trim();
        const portalUsername = (row.portal_username || "").trim();
        if (portal && portalUsername) {
            connectedMap.set(portal, portalUsername);
        }
    }
    // Then merge with client-supplied portals (clientPortals may have newer links or local sessions)
    if (clientPortals && typeof clientPortals === "object") {
        for (const [k, v] of Object.entries(clientPortals)) {
            const portalKey = k.toLowerCase().trim();
            const portalUsername = (typeof v === "string" ? v : (v as any)?.username || (v as any)?.portalUsername || "").trim();
            if (portalKey && portalUsername && portalKey !== "github" && !portalKey.startsWith("_") && portalKey !== "theme") {
                connectedMap.set(portalKey, portalUsername);
            }
        }
    }

    // Process ONLY eligible contest platforms that the user has connected
    const allEligibleKeys = Object.keys(ELIGIBLE_CONTEST_PLATFORMS);
    const connectedEligibleKeys = allEligibleKeys.filter((k) => connectedMap.has(k));

    const keysToProcess = connectedEligibleKeys;

    const platforms: PlatformContestAnalytics[] = [];
    let totalRatedContests = 0;
    const platformContestCounts: Record<string, number> = {};

    // Process all platforms in parallel with 4.5-second max timeout guard
    const results = await Promise.allSettled(
        keysToProcess.map(async (portalKey): Promise<PlatformContestAnalytics> => {
            const config = ELIGIBLE_CONTEST_PLATFORMS[portalKey];
            if (!config) {
                throw new Error(`Unknown platform config: ${portalKey}`);
            }

            const isConnected = connectedMap.has(portalKey);
            const portalUsername = connectedMap.get(portalKey) || "";

            if (!isConnected) {
                // Case E: Platform not connected
                return {
                    portal: portalKey,
                    portalName: config.name,
                    portalUsername: "",
                    profileUrl: "",
                    connected: false,
                    currentRating: null,
                    peakRating: null,
                    tier: null,
                    tierColor: null,
                    tierInfo: null,
                    officialRank: null,
                    percentile: null,
                    ratedContestsCount: 0,
                    history: [],
                    recentChange90d: null,
                    lastSyncAt: new Date().toISOString(),
                    status: "not_connected",
                    statusMessage: `Connect your ${config.name} account to track your contest rating progression.`,
                    exploreContestsUrl: config.exploreContestsUrl,
                };
            }

            try {
                const fetchResult = await Promise.race([
                    config.fetcher(portalUsername),
                    new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4500)),
                ]);

                if (!fetchResult) {
                    // Case D: Synchronization failed / unreachable
                    return {
                        portal: portalKey,
                        portalName: config.name,
                        portalUsername,
                        profileUrl: config.buildProfileUrl(portalUsername),
                        connected: true,
                        currentRating: null,
                        peakRating: null,
                        tier: null,
                        tierColor: null,
                        tierInfo: null,
                        officialRank: null,
                        percentile: null,
                        ratedContestsCount: 0,
                        history: [],
                        recentChange90d: null,
                        lastSyncAt: new Date().toISOString(),
                        status: "error",
                        statusMessage: `Unable to refresh ${config.name} contest data. Check handle or retry.`,
                        exploreContestsUrl: config.exploreContestsUrl,
                    };
                }

                const rawHistory: ContestHistoryPoint[] = fetchResult.history || [];
                // Deduplicate history by unique contestId or timestamp
                const seenKeys = new Set<string>();
                const history: ContestHistoryPoint[] = [];
                for (const h of rawHistory) {
                    const key = `${portalKey}-${h.contestId || h.timestamp}`;
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        history.push(h);
                    }
                }
                history.sort((a, b) => a.timestamp - b.timestamp);

                const lastHistoryPoint = history.length > 0 ? history[history.length - 1] : undefined;
                const currentRating = fetchResult.currentRating ?? (lastHistoryPoint ? lastHistoryPoint.rating : null);
                const peakRating = fetchResult.peakRating ?? (history.length > 0 ? Math.max(...history.map((h) => h.rating)) : currentRating);
                const count = history.length;

                // Determine tier info
                const tierInfo = currentRating !== null ? config.getTier(currentRating, fetchResult) : null;
                const tier = tierInfo ? tierInfo.name : fetchResult.rankTitle || fetchResult.badgeName || fetchResult.stars || null;
                const tierColor = tierInfo ? tierInfo.color : null;
                const recentChange90d = calculate90dRatingChange(history);

                let status: PlatformContestAnalytics["status"] = "valid";
                let statusMessage: string | undefined = undefined;

                if (count === 0 && currentRating === null) {
                    // Case A: Connected, but 0 recorded contests
                    status = "no_contests";
                    statusMessage = `No contest history yet on ${config.name}. Participate in a rated contest to start tracking your rating progression.`;
                } else if (count === 0 && currentRating !== null) {
                    // Case B: Rating exists, but history timeline unavailable
                    status = "history_unavailable";
                    statusMessage = `Rating history timeline is currently unavailable for this account on ${config.name}.`;
                }

                return {
                    portal: portalKey,
                    portalName: config.name,
                    portalUsername,
                    profileUrl: config.buildProfileUrl(portalUsername),
                    connected: true,
                    currentRating,
                    peakRating,
                    tier,
                    tierColor,
                    tierInfo,
                    officialRank: fetchResult.officialRank || null,
                    percentile: fetchResult.percentile || null,
                    ratedContestsCount: count,
                    history,
                    recentChange90d,
                    lastSyncAt: new Date().toISOString(),
                    status,
                    statusMessage,
                    exploreContestsUrl: config.exploreContestsUrl,
                };
            } catch {
                return {
                    portal: portalKey,
                    portalName: config.name,
                    portalUsername,
                    profileUrl: config.buildProfileUrl(portalUsername),
                    connected: true,
                    currentRating: null,
                    peakRating: null,
                    tier: null,
                    tierColor: null,
                    tierInfo: null,
                    officialRank: null,
                    percentile: null,
                    ratedContestsCount: 0,
                    history: [],
                    recentChange90d: null,
                    lastSyncAt: new Date().toISOString(),
                    status: "error",
                    statusMessage: `Unable to refresh ${config.name} contest data.`,
                    exploreContestsUrl: config.exploreContestsUrl,
                };
            }
        })
    );

    // Collect settled platform analytics where contest data could be extracted
    for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
            // Only include platform if user is connected
            if (res.value.connected && res.value.status !== "not_connected") {
                platforms.push(res.value);
                if (res.value.ratedContestsCount > 0) {
                    totalRatedContests += res.value.ratedContestsCount;
                    platformContestCounts[res.value.portal] = res.value.ratedContestsCount;
                } else {
                    platformContestCounts[res.value.portal] = 0;
                }
            }
        }
    }

    // Sort platforms: connected with contests first, then connected without contests, then unconnected
    platforms.sort((a, b) => {
        if (a.connected && !b.connected) return -1;
        if (!a.connected && b.connected) return 1;
        if (a.ratedContestsCount !== b.ratedContestsCount) {
            return b.ratedContestsCount - a.ratedContestsCount;
        }
        return a.portalName.localeCompare(b.portalName);
    });

    // Unified chronological recent contests feed
    const recentContests: UnifiedRecentContestItem[] = [];
    for (const p of platforms) {
        if (!p.connected || !p.history) continue;
        for (const h of p.history) {
            recentContests.push({
                portal: p.portal,
                portalName: p.portalName,
                contestId: String(h.contestId),
                contestName: h.contestName,
                contestUrl: getContestUrl(p.portal, h.contestId, h.contestName),
                date: h.date,
                timestamp: h.timestamp,
                rank: h.rank ?? null,
                rating: h.rating,
                ratingBefore: h.ratingBefore ?? null,
                ratingChange: h.ratingChange ?? null,
                division: h.division ?? null,
                problemsSolved: h.problemsSolved ?? null,
                totalProblems: h.totalProblems ?? null,
            });
        }
    }
    // Strictly chronological descending (newest first)
    recentContests.sort((a, b) => b.timestamp - a.timestamp);

    return {
        success: true,
        username: cleanUsername,
        timestamp: new Date().toISOString(),
        platforms,
        recentContests,
        summary: {
            totalRatedContests,
            platformContestCounts,
        },
    };
}
