import { query } from "../../database/client.js";

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

export interface UnifiedContestResponse {
    success: boolean;
    username: string;
    timestamp: string;
    platforms: PlatformContestAnalytics[];
    summary: {
        totalRatedContests: number;
        platformContestCounts: Record<string, number>;
    };
}

// --- Official Platform Tier Definitions ---

export function getCodeforcesTier(rating: number): PlatformTierInfo {
    if (rating < 1200) {
        const next = 1200;
        return {
            name: "Newbie",
            color: "#808080",
            nextTierName: "Pupil",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Entry rating tier on Codeforces (< 1200)",
        };
    }
    if (rating < 1400) {
        const min = 1200;
        const next = 1400;
        return {
            name: "Pupil",
            color: "#008000",
            nextTierName: "Specialist",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Green division tier on Codeforces (1200 - 1399)",
        };
    }
    if (rating < 1600) {
        const min = 1400;
        const next = 1600;
        return {
            name: "Specialist",
            color: "#03a89e",
            nextTierName: "Expert",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Cyan division tier on Codeforces (1400 - 1599)",
        };
    }
    if (rating < 1900) {
        const min = 1600;
        const next = 1900;
        return {
            name: "Expert",
            color: "#3b82f6",
            nextTierName: "Candidate Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Blue division tier on Codeforces (1600 - 1899)",
        };
    }
    if (rating < 2200) {
        const min = 1900;
        const next = 2200;
        return {
            name: "Candidate Master",
            color: "#ea3943",
            nextTierName: "Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Purple / Red division tier on Codeforces (1900 - 2199)",
        };
    }
    if (rating < 2300) {
        const min = 2200;
        const next = 2300;
        return {
            name: "Master",
            color: "#f59e0b",
            nextTierName: "International Master",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Yellow / Orange division tier on Codeforces (2200 - 2299)",
        };
    }
    if (rating < 2400) {
        const min = 2300;
        const next = 2400;
        return {
            name: "International Master",
            color: "#f59e0b",
            nextTierName: "Grandmaster",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Orange tier on Codeforces (2300 - 2399)",
        };
    }
    if (rating < 2600) {
        const min = 2400;
        const next = 2600;
        return {
            name: "Grandmaster",
            color: "#ef4444",
            nextTierName: "International Grandmaster",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Red grandmaster tier on Codeforces (2400 - 2599)",
        };
    }
    if (rating < 3000) {
        const min = 2600;
        const next = 3000;
        return {
            name: "International Grandmaster",
            color: "#ef4444",
            nextTierName: "Legendary Grandmaster",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Red elite tier on Codeforces (2600 - 2999)",
        };
    }
    return {
        name: "Legendary Grandmaster",
        color: "#ef4444",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Peak international tier on Codeforces (>= 3000)",
    };
}

export function getLeetCodeTier(rating: number, badgeName?: string | null | undefined): PlatformTierInfo {
    const isGuardian = badgeName?.toLowerCase() === "guardian" || rating >= 2200;
    const isKnight = badgeName?.toLowerCase() === "knight" || (rating >= 1850 && rating < 2200);

    if (isGuardian) {
        return {
            name: "Guardian",
            color: "#8b5cf6",
            badgeBg: "#7c3aed",
            nextTierName: null,
            pointsToNextTier: 0,
            progressPercent: 100,
            description: "Top 5% of all contest participants globally (>= 2200 rating)",
        };
    }
    if (isKnight) {
        const min = 1850;
        const next = 2200;
        return {
            name: "Knight",
            color: "#06b6d4",
            badgeBg: "#0891b2",
            nextTierName: "Guardian",
            pointsToNextTier: Math.max(0, next - Math.round(rating)),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Top 25% of all contest participants globally (1850 - 2199 rating)",
        };
    }
    const next = 1850;
    return {
        name: "Contestant",
        color: "#94a3b8",
        badgeBg: "#64748b",
        nextTierName: "Knight",
        pointsToNextTier: Math.max(0, next - Math.round(rating || 1500)),
        progressPercent: Math.min(100, Math.max(0, Math.round((Math.max(0, rating || 1500) / next) * 100))),
        description: "Active LeetCode weekly & bi-weekly contest participant (< 1850 rating)",
    };
}

export function getCodeChefTier(rating: number): PlatformTierInfo {
    if (rating < 1400) {
        const next = 1400;
        return {
            name: "1★",
            color: "#94a3b8",
            nextTierName: "2★",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "1-Star division tier on CodeChef (< 1400)",
        };
    }
    if (rating < 1600) {
        const min = 1400;
        const next = 1600;
        return {
            name: "2★",
            color: "#22c55e",
            nextTierName: "3★",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "2-Star division tier on CodeChef (1400 - 1599)",
        };
    }
    if (rating < 1800) {
        const min = 1600;
        const next = 1800;
        return {
            name: "3★",
            color: "#3b82f6",
            nextTierName: "4★",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "3-Star division tier on CodeChef (1600 - 1799)",
        };
    }
    if (rating < 2000) {
        const min = 1800;
        const next = 2000;
        return {
            name: "4★",
            color: "#a855f7",
            nextTierName: "5★",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "4-Star division tier on CodeChef (1800 - 1999)",
        };
    }
    if (rating < 2200) {
        const min = 2000;
        const next = 2200;
        return {
            name: "5★",
            color: "#eab308",
            nextTierName: "6★",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "5-Star division tier on CodeChef (2000 - 2199)",
        };
    }
    if (rating < 2500) {
        const min = 2200;
        const next = 2500;
        return {
            name: "6★",
            color: "#f97316",
            nextTierName: "7★",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "6-Star master tier on CodeChef (2200 - 2499)",
        };
    }
    return {
        name: "7★",
        color: "#ef4444",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "7-Star grandmaster tier on CodeChef (>= 2500)",
    };
}

export function getAtCoderTier(rating: number): PlatformTierInfo {
    if (rating < 400) {
        const next = 400;
        return {
            name: "Gray",
            color: "#94a3b8",
            nextTierName: "Brown",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round((rating / next) * 100))),
            description: "Gray rating tier on AtCoder (< 400)",
        };
    }
    if (rating < 800) {
        const min = 400;
        const next = 800;
        return {
            name: "Brown",
            color: "#a16207",
            nextTierName: "Green",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Brown rating tier on AtCoder (400 - 799)",
        };
    }
    if (rating < 1200) {
        const min = 800;
        const next = 1200;
        return {
            name: "Green",
            color: "#22c55e",
            nextTierName: "Cyan",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Green rating tier on AtCoder (800 - 1199)",
        };
    }
    if (rating < 1600) {
        const min = 1200;
        const next = 1600;
        return {
            name: "Cyan",
            color: "#06b6d4",
            nextTierName: "Blue",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Cyan rating tier on AtCoder (1200 - 1599)",
        };
    }
    if (rating < 2000) {
        const min = 1600;
        const next = 2000;
        return {
            name: "Blue",
            color: "#2563eb",
            nextTierName: "Yellow",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Blue rating tier on AtCoder (1600 - 1999)",
        };
    }
    if (rating < 2400) {
        const min = 2000;
        const next = 2400;
        return {
            name: "Yellow",
            color: "#eab308",
            nextTierName: "Orange",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Yellow master tier on AtCoder (2000 - 2399)",
        };
    }
    if (rating < 2800) {
        const min = 2400;
        const next = 2800;
        return {
            name: "Orange",
            color: "#f97316",
            nextTierName: "Red",
            pointsToNextTier: Math.max(0, next - rating),
            progressPercent: Math.min(100, Math.max(0, Math.round(((rating - min) / (next - min)) * 100))),
            description: "Orange grandmaster tier on AtCoder (2400 - 2799)",
        };
    }
    return {
        name: "Red",
        color: "#ef4444",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
        description: "Red legendary tier on AtCoder (>= 2800)",
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

        // Sort chronologically ascending
        history.sort((a, b) => a.timestamp - b.timestamp);

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
                    let prevRating: number | null = null;
                    history = parsed.map((item: any) => {
                        const r = parseInt(item.rating, 10);
                        if (!isNaN(r) && (peakRating === null || r > peakRating)) {
                            peakRating = r;
                        }

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
                            contestId: item.code || `cc-${ts}`,
                            contestName: item.name || "CodeChef Contest",
                            date,
                            timestamp: ts,
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

        // Sort chronologically ascending
        history.sort((a, b) => a.timestamp - b.timestamp);

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

// --- Supported Contest Platforms Registry ---

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
 */
export async function calculateUserContestPerformance(username: string): Promise<UnifiedContestResponse> {
    const cleanUsername = username.trim();

    // Query Postgres for user's connected platforms
    const result = await query(
        `SELECT portal, portal_username, verified, display_name
         FROM user_links
         WHERE (username = $1 OR username = (SELECT email FROM users WHERE username = $1 LIMIT 1))
         ORDER BY portal ASC;`,
        [cleanUsername]
    );

    const rows = result.rows || [];
    const connectedMap = new Map<string, string>();
    for (const row of rows) {
        const portal = (row.portal || "").toLowerCase().trim();
        const portalUsername = (row.portal_username || "").trim();
        if (portal && portalUsername) {
            connectedMap.set(portal, portalUsername);
        }
    }

    const eligibleKeys = Object.keys(ELIGIBLE_CONTEST_PLATFORMS);
    const platforms: PlatformContestAnalytics[] = [];
    let totalRatedContests = 0;
    const platformContestCounts: Record<string, number> = {};

    // Process all platforms in parallel with 5-second max timeout guard
    const results = await Promise.allSettled(
        eligibleKeys.map(async (portalKey): Promise<PlatformContestAnalytics> => {
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

                const history: ContestHistoryPoint[] = fetchResult.history || [];
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

    // Collect settled platform analytics
    for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
            platforms.push(res.value);
            if (res.value.connected && res.value.ratedContestsCount > 0) {
                totalRatedContests += res.value.ratedContestsCount;
                platformContestCounts[res.value.portal] = res.value.ratedContestsCount;
            } else if (res.value.connected) {
                platformContestCounts[res.value.portal] = 0;
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

    return {
        success: true,
        username: cleanUsername,
        timestamp: new Date().toISOString(),
        platforms,
        summary: {
            totalRatedContests,
            platformContestCounts,
        },
    };
}
