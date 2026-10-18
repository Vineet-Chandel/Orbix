import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";
import { calculateUserContestPerformance } from "./contestAnalytics.js";
import { calculateUserBadges } from "./badgesAnalytics.js";
import { calculateUserPracticeAnalytics } from "./practiceAnalytics.js";
import {
    getCodeforcesTier,
    getLeetCodeTier,
    getCodeChefTier,
    getCodeChefDivision,
    getAtCoderTier,
    getHackerRankProblemSolvingStars,
    classifyCodeforcesRating,
    normalizeGeeksforGeeksDifficulty,
} from "../../utils/ratingSystems.js";

const portalsRouter = express.Router();

export interface DifficultyBreakdown {
    easy: number;
    medium: number;
    hard: number;
    total: number;
    easyTotal?: number;
    mediumTotal?: number;
    hardTotal?: number;
    totalQuestions?: number;
    attempting?: number;
}

export interface RecentProblemRecord {
    id: string;
    title: string;
    portal: string;
    platformName?: string;
    timestamp: number; // unix epoch seconds
    solvedAt?: string; // ISO string
    url?: string;
    difficulty?: "Easy" | "Medium" | "Hard" | null;
}

export interface PortalProfileData {
    success: boolean;
    portal: string;
    username: string;
    name: string;
    avatar: string;
    stats: Array<{ label: string; value: string }>;
    profileUrl: string;
    verified: boolean;
    difficulty?: DifficultyBreakdown | undefined;
    submissionCalendar?: Record<string, number> | undefined;
    totalSubmissions?: number | undefined;
    streak?: number | undefined;
    activeDays?: number | undefined;
    recentSubmissions?: RecentProblemRecord[] | undefined;
}

// Format numbers like Indian numbering (e.g., 35,38,055)
const formatRank = (num: number): string => {
    try {
        return "#" + num.toLocaleString("en-IN") + " rank";
    } catch {
        return "#" + num + " rank";
    }
};

const getFallbackAvatar = (nameOrHandle: string) => {
    const seed = encodeURIComponent(nameOrHandle.trim());
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

// --- Portal Live Fetchers ---

const LEETCODE_DIFFICULTY_LOOKUP: Record<string, "Easy" | "Medium" | "Hard"> = {
    "two-sum": "Easy",
    "valid-parentheses": "Easy",
    "merge-two-sorted-lists": "Easy",
    "best-time-to-buy-and-sell-stock": "Easy",
    "valid-palindrome": "Easy",
    "invert-binary-tree": "Easy",
    "valid-anagram": "Easy",
    "binary-search": "Easy",
    "flood-fill": "Easy",
    "maximum-subarray": "Medium",
    "lowest-common-ancestor-of-a-binary-search-tree": "Medium",
    "insert-interval": "Medium",
    "01-matrix": "Medium",
    "k-closest-points-to-origin": "Medium",
    "longest-substring-without-repeating-characters": "Medium",
    "3sum": "Medium",
    "binary-tree-level-order-traversal": "Medium",
    "clone-graph": "Medium",
    "evaluate-reverse-polish-notation": "Medium",
    "course-schedule": "Medium",
    "implement-trie-prefix-tree": "Medium",
    "coin-change": "Medium",
    "product-of-array-except-self": "Medium",
    "min-stack": "Medium",
    "validate-binary-search-tree": "Medium",
    "number-of-islands": "Medium",
    "rotting-oranges": "Medium",
    "search-in-rotated-sorted-array": "Medium",
    "combination-sum": "Medium",
    "permutations": "Medium",
    "merge-intervals": "Medium",
    "lowest-common-ancestor-of-a-binary-tree": "Medium",
    "time-based-key-value-store": "Medium",
    "accounts-merge": "Medium",
    "sort-colors": "Medium",
    "word-break": "Medium",
    "partition-equal-subset-sum": "Medium",
    "string-to-integer-atoi": "Medium",
    "spiral-matrix": "Medium",
    "subsets": "Medium",
    "binary-tree-right-side-view": "Medium",
    "longest-palindromic-substring": "Medium",
    "unique-paths": "Medium",
    "construct-binary-tree-from-preorder-and-inorder-traversal": "Medium",
    "container-with-most-water": "Medium",
    "letter-combinations-of-a-phone-number": "Medium",
    "word-search": "Medium",
    "find-all-anagrams-in-a-string": "Medium",
    "minimum-height-trees": "Medium",
    "task-scheduler": "Medium",
    "lru-cache": "Medium",
    "kth-smallest-element-in-a-bst": "Medium",
    "daily-temperatures": "Medium",
    "house-robber": "Medium",
    "gas-station": "Medium",
    "next-permutation": "Medium",
    "majority-element": "Easy",
    "find-the-duplicate-number": "Medium",
    "longest-common-prefix": "Easy",
    "intersection-of-two-arrays-ii": "Easy",
    "intersection-of-two-arrays": "Easy",
    "squares-of-a-sorted-array": "Easy",
    "move-zeroes": "Easy",
    "search-a-2d-matrix": "Medium",
    "climbing-stairs": "Easy",
    "single-number": "Easy",
    "reverse-linked-list": "Easy",
    "diameter-of-binary-tree": "Easy",
    "middle-of-the-linked-list": "Easy",
    "maximum-depth-of-binary-tree": "Easy",
    "contains-duplicate": "Easy",
    "ransom-note": "Easy",
    "first-bad-version": "Easy",
    "linked-list-cycle": "Easy",
    "minimum-window-substring": "Hard",
    "network-delay-time": "Medium",
    "burst-balloons": "Hard",
    "course-schedule-ii": "Medium",
    "sliding-window-maximum": "Hard",
    "longest-increasing-path-in-a-matrix": "Hard",
    "kth-largest-element-in-an-array": "Medium",
    "trapping-rain-water": "Hard",
    "median-of-two-sorted-arrays": "Hard",
    "merge-k-sorted-lists": "Hard",
    "word-ladder": "Hard",
    "basic-calculator": "Hard",
    "maximum-profit-in-job-scheduling": "Hard",
    "serialize-and-deserialize-binary-tree": "Hard",
    "find-median-from-data-stream": "Hard",
    "word-search-ii": "Hard",
    "alien-dictionary": "Hard",
    "n-queens": "Hard",
};

async function fetchLeetCode(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            body: JSON.stringify({
                query: `query userPublicProfile($username: String!) {
                    allQuestionsCount {
                        difficulty
                        count
                    }
                    matchedUser(username: $username) {
                        username
                        profile {
                            realName
                            userAvatar
                            ranking
                        }
                        submitStatsGlobal {
                            acSubmissionNum {
                                difficulty
                                count
                            }
                        }
                        userCalendar {
                            activeYears
                            streak
                            totalActiveDays
                            submissionCalendar
                        }
                    }
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
                    recentAcSubmissionList(username: $username, limit: 30) {
                        id
                        title
                        titleSlug
                        timestamp
                    }
                }`,
                variables: { username },
            }),
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        const user = data?.data?.matchedUser;
        if (!user || data.errors) return null;

        const name = user.profile?.realName || user.username;
        const avatar = user.profile?.userAvatar || getFallbackAvatar(username);
        const ranking = user.profile?.ranking;
        const contestRanking = data?.data?.userContestRanking;

        const allQuestions = data?.data?.allQuestionsCount || [];
        const acSubmissions = user.submitStatsGlobal?.acSubmissionNum || [];

        const totalSolved = acSubmissions.find((s: any) => s.difficulty === "All")?.count ?? 0;
        const easySolved = acSubmissions.find((s: any) => s.difficulty === "Easy")?.count ?? 0;
        const mediumSolved = acSubmissions.find((s: any) => s.difficulty === "Medium")?.count ?? 0;
        const hardSolved = acSubmissions.find((s: any) => s.difficulty === "Hard")?.count ?? 0;

        const totalQuestions = allQuestions.find((q: any) => q.difficulty === "All")?.count ?? 4082;
        const easyTotal = allQuestions.find((q: any) => q.difficulty === "Easy")?.count ?? 971;
        const mediumTotal = allQuestions.find((q: any) => q.difficulty === "Medium")?.count ?? 2128;
        const hardTotal = allQuestions.find((q: any) => q.difficulty === "Hard")?.count ?? 983;

        const userCalendar = user.userCalendar;
        let submissionCalendar: Record<string, number> = {};
        let totalCalendarSubs = 0;
        if (userCalendar?.submissionCalendar) {
            try {
                const parsed = JSON.parse(userCalendar.submissionCalendar);
                if (parsed && typeof parsed === "object") {
                    submissionCalendar = parsed;
                    totalCalendarSubs = Object.values(parsed).reduce((acc: number, c: any) => acc + (typeof c === "number" ? c : 0), 0);
                }
            } catch {
                // ignore
            }
        }

        // Parse recent accepted problem-solving records
        const rawRecent = data?.data?.recentAcSubmissionList || [];
        const recentSubmissions: RecentProblemRecord[] = [];
        const seenSlugs = new Set<string>();

        if (Array.isArray(rawRecent)) {
            for (const item of rawRecent) {
                if (!item || !item.title) continue;
                const slug = (item.titleSlug || "").toLowerCase();
                // Deduplicate repeated accepted submissions for the same problem on the same platform
                if (seenSlugs.has(slug)) continue;
                seenSlugs.add(slug);

                const ts = parseInt(item.timestamp, 10) || Math.floor(Date.now() / 1000);
                recentSubmissions.push({
                    id: `leetcode-${item.id || slug}`,
                    title: item.title,
                    portal: "leetcode",
                    platformName: "LeetCode",
                    timestamp: ts,
                    solvedAt: new Date(ts * 1000).toISOString(),
                    url: `https://leetcode.com/problems/${slug}/`,
                    difficulty: LEETCODE_DIFFICULTY_LOOKUP[slug] ?? null,
                });
            }
        }

        const stats: Array<{ label: string; value: string }> = [
            { label: "solved", value: `${totalSolved} solved` },
        ];
        if (contestRanking?.rating) {
            const contestRating = Math.round(contestRanking.rating);
            stats.push({ label: "rating", value: `${contestRating} rating` });
            if (contestRanking.badge?.name) {
                stats.push({ label: "badge", value: contestRanking.badge.name });
            } else {
                const tier = getLeetCodeTier(contestRating);
                if (tier.isOfficialBadge) {
                    stats.push({ label: "badge", value: tier.name });
                }
            }
        }
        if (contestRanking?.attendedContestsCount) {
            stats.push({ label: "contests", value: `${contestRanking.attendedContestsCount} contests` });
        }
        if (totalCalendarSubs > 0) {
            stats.push({ label: "submissions", value: `${totalCalendarSubs} submissions` });
        }
        if (userCalendar?.totalActiveDays) {
            stats.push({ label: "activeDays", value: `${userCalendar.totalActiveDays} active days` });
        }
        if (userCalendar?.streak) {
            stats.push({ label: "streak", value: `${userCalendar.streak} day streak` });
        }
        if (ranking) {
            stats.push({ label: "rank", value: formatRank(ranking) });
        }
        stats.push(
            { label: "easy", value: `${easySolved} easy` },
            { label: "medium", value: `${mediumSolved} medium` },
            { label: "hard", value: `${hardSolved} hard` }
        );

        const difficulty: DifficultyBreakdown = {
            easy: easySolved,
            medium: mediumSolved,
            hard: hardSolved,
            total: totalSolved,
            easyTotal,
            mediumTotal,
            hardTotal,
            totalQuestions,
            attempting: totalSolved > 0 ? 1 : 0,
        };

        return {
            success: true,
            portal: "leetcode",
            username: user.username,
            name,
            avatar,
            stats,
            difficulty,
            profileUrl: `https://leetcode.com/u/${user.username}`,
            verified: true,
            submissionCalendar,
            totalSubmissions: totalCalendarSubs || totalSolved,
            streak: userCalendar?.streak || 0,
            activeDays: userCalendar?.totalActiveDays || 0,
            recentSubmissions,
        };
    } catch {
        return null;
    }
}

async function fetchCodeforces(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        if (data.status !== "OK" || !data.result?.[0]) return null;

        const user = data.result[0];
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
        const name = fullName || user.handle;
        const avatar = user.titlePhoto || user.avatar || getFallbackAvatar(username);

        const stats: Array<{ label: string; value: string }> = [];
        let difficulty: DifficultyBreakdown | undefined = undefined;
        let cfCalendar: Record<string, number> = {};
        let cfTotalSubs = 0;
        let recentSubmissions: RecentProblemRecord[] = [];

        try {
            const subRes = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4000),
            });
            if (subRes.ok) {
                const subData = (await subRes.json()) as any;
                if (subData?.status === "OK" && Array.isArray(subData.result)) {
                    cfTotalSubs = subData.result.length;
                    const solvedSet = new Set<string>();
                    let easyCount = 0;
                    let medCount = 0;
                    let hardCount = 0;

                    for (const sub of subData.result) {
                        if (sub.verdict === "OK" && sub.problem) {
                            const key = `${sub.problem.contestId}-${sub.problem.index}`;
                            if (!solvedSet.has(key)) {
                                solvedSet.add(key);
                                const rating = sub.problem.rating;
                                const diff = classifyCodeforcesRating(rating);
                                if (diff === "Easy") {
                                    easyCount++;
                                } else if (diff === "Medium") {
                                    medCount++;
                                } else {
                                    hardCount++;
                                }
                            }
                        }
                    }

                    for (const sub of subData.result) {
                        if (sub.creationTimeSeconds) {
                            const d = new Date(sub.creationTimeSeconds * 1000).toISOString().split("T")[0] || "";
                            if (d) {
                                cfCalendar[d] = (cfCalendar[d] || 0) + 1;
                            }
                        }
                    }

                    recentSubmissions = [];
                    const seenCf = new Set<string>();
                    for (const sub of subData.result) {
                        if (sub.verdict === "OK" && sub.problem) {
                            const key = `${sub.problem.contestId}-${sub.problem.index}`;
                            if (!seenCf.has(key)) {
                                seenCf.add(key);
                                const rating = sub.problem.rating;
                                const rawDiff = classifyCodeforcesRating(rating);
                                const diff: "Easy" | "Medium" | "Hard" | null = rawDiff === "Unknown" ? null : rawDiff;
                                const ts = sub.creationTimeSeconds || Math.floor(Date.now() / 1000);
                                recentSubmissions.push({
                                    id: `codeforces-${sub.id || key}`,
                                    title: sub.problem.name || `Problem ${sub.problem.contestId}${sub.problem.index}`,
                                    portal: "codeforces",
                                    platformName: "Codeforces",
                                    timestamp: ts,
                                    solvedAt: new Date(ts * 1000).toISOString(),
                                    url: sub.problem.contestId
                                        ? `https://codeforces.com/contest/${sub.problem.contestId}/problem/${sub.problem.index}`
                                        : `https://codeforces.com/problemset`,
                                    difficulty: diff,
                                });
                                if (recentSubmissions.length >= 25) break;
                            }
                        }
                    }

                    stats.push({ label: "solved", value: `${solvedSet.size} solved` });
                    if (subData.result.length > 0) {
                        stats.push({ label: "submissions", value: `${subData.result.length} submissions` });
                    }
                    stats.push(
                        { label: "easy", value: `${easyCount} easy` },
                        { label: "medium", value: `${medCount} medium` },
                        { label: "hard", value: `${hardCount} hard` }
                    );

                    difficulty = {
                        easy: easyCount,
                        medium: medCount,
                        hard: hardCount,
                        total: solvedSet.size,
                        easyTotal: 3000,
                        mediumTotal: 4500,
                        hardTotal: 2000,
                        totalQuestions: 9500,
                        attempting: solvedSet.size > 0 ? 1 : 0,
                    };
                }
            }
        } catch {
            // Non-fatal
        }

        if (user.rating !== undefined) {
            stats.push({ label: "rating", value: `${user.rating} rating` });
            const cfTier = getCodeforcesTier(user.rating);
            stats.push({ label: "rank", value: cfTier.name });
        } else if (user.rank) {
            stats.push({ label: "rank", value: user.rank });
        }
        if (user.maxRating) {
            stats.push({ label: "maxRating", value: `max ${user.maxRating}` });
        }

        return {
            success: true,
            portal: "codeforces",
            username: user.handle,
            name,
            avatar,
            stats,
            difficulty,
            profileUrl: `https://codeforces.com/profile/${user.handle}`,
            verified: true,
            submissionCalendar: cfCalendar,
            totalSubmissions: cfTotalSubs,
            activeDays: Object.keys(cfCalendar).length,
            recentSubmissions,
        };
    } catch {
        return null;
    }
}

async function fetchGitHub(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Orbix-App" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const user = (await res.json()) as any;
        if (!user || user.message === "Not Found" || !user.login) return null;

        const name = user.name || user.login;
        const avatar = user.avatar_url || getFallbackAvatar(username);

        // Fetch actual contributions/commits count from GitHub public contributions page
        let contributions = 0;
        let githubCalendar: Record<string, number> = {};
        let activeDaysCount = 0;
        try {
            const contribRes = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
                headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
                signal: AbortSignal.timeout(6000),
            });
            if (contribRes.ok) {
                const html = await contribRes.text();
                const m = html.match(/([\d,]+)\s*(?:contributions\s+in\s+the\s+last\s+year|contributions)/i) ||
                          html.match(/([\d,]+)\s*[\r\n\s]+contributions/i);
                if (m && m[1]) {
                    contributions = parseInt(m[1].replace(/,/g, ""), 10) || 0;
                }

                // Parse daily calendar cells
                const tdRegex = /<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g;
                const tipRegex = /<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]+)<\/tool-tip>/g;
                const idToDate: Record<string, string> = {};
                let match: RegExpExecArray | null;
                while ((match = tdRegex.exec(html)) !== null) {
                    if (match[1] && match[2]) {
                        idToDate[match[2]] = match[1];
                    }
                }
                while ((match = tipRegex.exec(html)) !== null) {
                    const cellId = match[1];
                    const tipText = match[2];
                    if (cellId && tipText && idToDate[cellId]) {
                        const dateStr = idToDate[cellId]!;
                        const countMatch = tipText.match(/(\d+)\s+contribution/);
                        const count = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : 0;
                        githubCalendar[dateStr] = count;
                        if (count > 0) activeDaysCount++;
                    }
                }
            }
        } catch {
            // non-blocking
        }

        const repos = user.public_repos ?? 0;

        const stats: Array<{ label: string; value: string }> = [
            { label: "repos", value: `${repos} repos` },
            { label: "followers", value: `${user.followers ?? 0} followers` },
        ];
        if (contributions > 0) {
            stats.push({ label: "commits", value: `${contributions} commits` });
            stats.push({ label: "contributions", value: `${contributions} contributions` });
        }
        if (user.public_gists) {
            stats.push({ label: "gists", value: `${user.public_gists} gists` });
        }

        return {
            success: true,
            portal: "github",
            username: user.login,
            name,
            avatar,
            stats,
            profileUrl: user.html_url || `https://github.com/${user.login}`,
            verified: true,
            submissionCalendar: githubCalendar,
            totalSubmissions: contributions,
            activeDays: activeDaysCount || (contributions > 0 ? 1 : 0),
        };
    } catch {
        return null;
    }
}

async function fetchCodeChef(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(username)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404 || res.redirected) return null;
        const html = await res.text();
        if (
            html.includes("User does not exist") ||
            html.includes("404 Not Found") ||
            !html.toLowerCase().includes(username.toLowerCase())
        ) {
            return null;
        }

        const nameMatch = html.match(/<header class="page-title[^>]*>[\s\S]*?<h1>([^<]+)<\/h1>/i);
        const name = nameMatch ? nameMatch[1]?.trim() : username;

        const avatarMatch =
            html.match(/<img[^>]*class=[\x27"][^\x27"]*profileImage[^\x27"]*[\x27"][^>]*src=[\x27"]([^\x27"]+)[\x27"]/i) ||
            html.match(/<img[^>]*src=[\x27"]([^\x27"]+)[\x27"][^>]*class=[\x27"][^\x27"]*profileImage[^\x27"]*[\x27"]/i) ||
            html.match(/<img[^>]*alt=[\x27"]user profile[\x27"][^>]*src=[\x27"]([^\x27"]+)[\x27"]/i) ||
            html.match(/<img[^>]+class="[^"]*user-details-avatar[^"]*"[^>]+src="([^"]+)"/i);
        const avatar = (avatarMatch && avatarMatch[1]) ? avatarMatch[1] : getFallbackAvatar(username);

        const ratingMatch = html.match(/class=[\x27"]rating-number[\x27"]>\s*(\d+)\s*<\/div>/i);
        const starsMatch = html.match(/class=[\x27"]rating-star[\x27"]>([\s\S]*?)<\/div>/i);
        const starContent = (starsMatch && starsMatch[1]) ? starsMatch[1] : "";
        const starCount = (starContent.match(/(?:★|&#9733;|&starf;)/gi) || starContent.match(/<span/gi) || []).length;

        // Global rank if available
        const globalRankMatch = html.match(/<a\s+href=[\x27"]\/ratings\/all[\x27"]>\s*<strong>\s*(\d+)\s*<\/strong>\s*<\/a>\s*Global Rank/i);

        // --- Problems Solved Calculation ---
        let solvedCount = 0;

        // Isolate problems-solved section to prevent accidental matches from other sections or templates
        const psSectionMatch = html.match(/<section[^>]*class=[\x27"][^\x27"]*problems-solved[^\x27"]*[\x27"][^>]*>([\s\S]*?)<\/section>/i);
        const psSection = (psSectionMatch && psSectionMatch[1]) ? psSectionMatch[1] : html;

        // 1. Authoritative: 'Total Problems Solved: 123' (must match immediate digits, never skipping across tags)
        const directTotalMatch = psSection.match(/Total Problems Solved:\s*([0-9]+)/i) || html.match(/Total Problems Solved:\s*([0-9]+)/i);

        if (directTotalMatch && directTotalMatch[1]) {
            solvedCount = parseInt(directTotalMatch[1], 10);
        } else if (psSection.match(/Total Problems Solved:\s*</i) || html.match(/Total Problems Solved:\s*</i)) {
            // Header is present but empty (e.g. '<h3>Total Problems Solved: </h3>') => exactly 0 solved
            solvedCount = 0;
        } else {
            // 2. Classic / alternate profile formats (Fully Solved (X) and Partially Solved (Y))
            const fullyMatch = psSection.match(/Fully Solved\s*\(([0-9]+)\)/i);
            const partiallyMatch = psSection.match(/Partially Solved\s*\(([0-9]+)\)/i);
            if (fullyMatch || partiallyMatch) {
                const fully = fullyMatch && fullyMatch[1] ? parseInt(fullyMatch[1], 10) : 0;
                const partially = partiallyMatch && partiallyMatch[1] ? parseInt(partiallyMatch[1], 10) : 0;
                solvedCount = fully + partially;
            } else {
                // 3. Fallback: check category headers
                const categoryMatches = [...psSection.matchAll(/<h3>\s*[^<(]+?\s*\(([0-9]+)\)\s*<\/h3>/g)];
                if (categoryMatches.length > 0) {
                    const allZero = categoryMatches.every((m) => (m[1] ? parseInt(m[1], 10) === 0 : true));
                    if (allZero) {
                        solvedCount = 0;
                    } else {
                        let nonContestSum = 0;
                        for (const m of categoryMatches) {
                            const catName = m[0].toLowerCase();
                            if (!catName.includes("contest") && m[1]) {
                                nonContestSum += parseInt(m[1], 10);
                            }
                        }
                        solvedCount = nonContestSum;
                    }
                }
            }
        }

        const stats: Array<{ label: string; value: string }> = [
            { label: "solved", value: `${solvedCount} solved` },
        ];

        const numericRating = ratingMatch && ratingMatch[1] ? parseInt(ratingMatch[1], 10) : null;
        if (numericRating !== null) {
            stats.push({ label: "rating", value: `${numericRating} rating` });
            const ccTier = getCodeChefTier(numericRating);
            const ccDiv = getCodeChefDivision(numericRating);
            stats.push({ label: "division", value: ccDiv.division });
            if (starCount === 0 && ccTier.name) {
                stats.push({ label: "stars", value: ccTier.name });
            }
        }
        if (starCount > 0) {
            stats.push({ label: "stars", value: `${starCount}★` });
        }

        const peakMatch = html.match(/<small>\s*\(Highest Rating\s*(\d+)\)\s*<\/small>/i) ||
                          html.match(/Highest Rating\s*(\d+)/i);
        if (peakMatch && peakMatch[1]) {
            const peakVal = parseInt(peakMatch[1], 10);
            if (!numericRating || peakVal > numericRating) {
                stats.push({ label: "maxRating", value: `max ${peakVal}` });
            }
        }

        if (globalRankMatch && globalRankMatch[1]) {
            stats.push({ label: "rank", value: formatRank(parseInt(globalRankMatch[1], 10)) });
        }

        // CodeChef does not natively provide an Easy/Medium/Hard classification
        const difficulty: DifficultyBreakdown | undefined = undefined;

        let ccCalendar: Record<string, number> = {};
        const ccStatsMatch = html.match(/var\s+userDailySubmissionsStats\s*=\s*(\[[^\]]*\])/i);
        if (ccStatsMatch && ccStatsMatch[1]) {
            try {
                const parsed = JSON.parse(ccStatsMatch[1]);
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        if (item.date && typeof item.value === "number") {
                            ccCalendar[item.date] = item.value;
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        return {
            success: true,
            portal: "codechef",
            username,
            name: name || username,
            avatar: avatar || getFallbackAvatar(username),
            stats: stats.length ? stats : [{ label: "status", value: "CodeChef User" }],
            profileUrl: `https://www.codechef.com/users/${username}`,
            verified: true,
            difficulty,
            submissionCalendar: ccCalendar,
            totalSubmissions: solvedCount,
            activeDays: Object.keys(ccCalendar).length,
        };
    } catch {
        return null;
    }
}

async function fetchGeeksforGeeks(username: string): Promise<PortalProfileData | null> {
    try {
        const cleanUsername = username.trim();
        const urls = [
            `https://www.geeksforgeeks.org/profile/${encodeURIComponent(cleanUsername)}`,
            `https://www.geeksforgeeks.org/user/${encodeURIComponent(cleanUsername)}/`,
        ];

        let html: string | null = null;
        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    },
                    signal: AbortSignal.timeout(6000),
                });

                if (!res.ok || res.status === 404) continue;
                const text = await res.text();

                // If GFG redirects to explore or page has no user data, user doesn't exist
                if (text.includes("NEXT_REDIRECT;replace;/connect/explore;307;")) {
                    continue;
                }

                const hasUserSignals = text.includes("data retrieved successfully") ||
                    text.includes("total_problems_solved") ||
                    text.toLowerCase().includes(`"handle":"${cleanUsername.toLowerCase()}"`) ||
                    text.toLowerCase().includes(`"username":"${cleanUsername.toLowerCase()}"`);

                if (!hasUserSignals) continue;

                html = text;
                break;
            } catch {
                continue;
            }
        }

        if (!html) return null;

        let totalSolved = 0;
        let codingScore = 0;
        let instituteRank: string | null = null;
        let monthlyScore = 0;
        let potdStreak = 0;
        let schoolCount = 0;
        let basicCount = 0;
        let easyCount = 0;
        let medCount = 0;
        let hardCount = 0;

        let name = cleanUsername;
        let avatar = getFallbackAvatar(cleanUsername);

        // 1. Try parsing structured Next.js data
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
        if (nextDataMatch && nextDataMatch[1]) {
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                const pageProps = nextData?.props?.pageProps;
                const userInfo = pageProps?.userInfo || pageProps?.userProfile || pageProps?.initialState?.userProfile;
                if (userInfo) {
                    if (userInfo.name) name = userInfo.name;
                    if (userInfo.profile_image_url && userInfo.profile_image_url !== "null") avatar = userInfo.profile_image_url;
                    if (userInfo.total_problems_solved) totalSolved = parseInt(userInfo.total_problems_solved, 10) || 0;
                    if (userInfo.score || userInfo.coding_score) codingScore = parseInt(userInfo.score || userInfo.coding_score, 10) || 0;
                    if (userInfo.institute_rank) instituteRank = String(userInfo.institute_rank);
                    if (userInfo.monthly_score) monthlyScore = parseInt(userInfo.monthly_score, 10) || 0;
                    if (userInfo.pod_streak || userInfo.potd_streak) potdStreak = parseInt(userInfo.pod_streak || userInfo.potd_streak, 10) || 0;

                    const diffObj = userInfo.difficulty_wise_problems || userInfo.difficultyWiseProblems;
                    if (diffObj && typeof diffObj === "object") {
                        schoolCount = parseInt(diffObj.school || diffObj.School || 0, 10) || 0;
                        basicCount = parseInt(diffObj.basic || diffObj.Basic || 0, 10) || 0;
                        easyCount = parseInt(diffObj.easy || diffObj.Easy || 0, 10) || 0;
                        medCount = parseInt(diffObj.medium || diffObj.Medium || 0, 10) || 0;
                        hardCount = parseInt(diffObj.hard || diffObj.Hard || 0, 10) || 0;
                    }
                }
            } catch {
                // fall through to regex
            }
        }

        // 2. Regex fallbacks for fields not captured in __NEXT_DATA__
        if (totalSolved === 0) {
            const problemsMatch = html.match(/total_problems_solved[^\d]*(\d+)/i);
            if (problemsMatch && problemsMatch[1]) totalSolved = parseInt(problemsMatch[1], 10);
        }
        if (codingScore === 0) {
            const scoreMatch = html.match(/score[^\d]*(\d+)/i);
            if (scoreMatch && scoreMatch[1]) codingScore = parseInt(scoreMatch[1], 10);
        }
        if (!instituteRank) {
            const rankMatch = html.match(/institute_rank\\*":\\*"([^\\"]+)\\"/i) || html.match(/"institute_rank":\s*"([^"]+)"/i);
            if (rankMatch && rankMatch[1]) instituteRank = rankMatch[1];
        }
        if (name === cleanUsername) {
            const nameMatch = html.match(/articleCount[^\}]*?name\\*":\\*"([^\\"]+)\\"/i) || html.match(/"name":\s*\\"([^\\"]+)\\"/i);
            if (nameMatch && nameMatch[1] && nameMatch[1] !== "null" && nameMatch[1] !== "undefined") name = nameMatch[1];
        }
        if (avatar === getFallbackAvatar(cleanUsername)) {
            const avatarMatch = html.match(/articleCount[^\}]*?profile_image_url\\*":\\*"([^\\"]+)\\"/i) || html.match(/"profile_image_url":\s*\\"([^\\"]+)\\"/i);
            if (avatarMatch && avatarMatch[1] && avatarMatch[1] !== "null") avatar = avatarMatch[1];
        }

        const stats: Array<{ label: string; value: string }> = [
            { label: "solved", value: `${totalSolved} solved` },
            { label: "score", value: `${codingScore} score` },
        ];

        if (instituteRank) {
            stats.push({ label: "instituteRank", value: `#${instituteRank} institute rank` });
        }
        if (monthlyScore > 0) {
            stats.push({ label: "monthlyScore", value: `${monthlyScore} monthly score` });
        }
        if (potdStreak > 0) {
            stats.push({ label: "streak", value: `${potdStreak} day POTD streak` });
        }

        let difficulty: DifficultyBreakdown | undefined = undefined;
        if (schoolCount > 0 || basicCount > 0 || easyCount > 0 || medCount > 0 || hardCount > 0) {
            const norm = normalizeGeeksforGeeksDifficulty({
                school: schoolCount,
                basic: basicCount,
                easy: easyCount,
                medium: medCount,
                hard: hardCount,
            });
            difficulty = {
                easy: norm.easy,
                medium: norm.medium,
                hard: norm.hard,
                total: norm.total,
                easyTotal: 1000,
                mediumTotal: 1200,
                hardTotal: 500,
                totalQuestions: 2700,
                attempting: norm.total > 0 ? 1 : 0,
            };
        }

        return {
            success: true,
            portal: "geeksforgeeks",
            username: cleanUsername,
            name,
            avatar,
            stats,
            difficulty,
            profileUrl: `https://www.geeksforgeeks.org/user/${cleanUsername}`,
            verified: true,
            streak: potdStreak || undefined,
        };
    } catch {
        return null;
    }
}

async function fetchHackerRank(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        if (!data?.status || !data?.model) return null;

        const user = data.model;
        const fullName = [user.personal_first_name, user.personal_last_name].filter(Boolean).join(" ");
        const name = user.name || fullName || user.username;
        const avatar = user.avatar && !user.avatar.includes("gravatar.jpg")
            ? user.avatar
            : getFallbackAvatar(username);

        const stats: Array<{ label: string; value: string }> = [];

        try {
            const badgesRes = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4000),
            });
            if (badgesRes.ok) {
                const badgeData = (await badgesRes.json()) as any;
                if (badgeData?.models && Array.isArray(badgeData.models)) {
                    let totalSolved = 0;
                    let totalStars = 0;
                    for (const b of badgeData.models) {
                        const domainName = b.badge_name || b.name || "";
                        const stars = typeof b.stars === "number" ? b.stars : 0;
                        const solved = typeof b.solved === "number" ? b.solved : 0;
                        const points = typeof b.current_points === "number" ? b.current_points : 0;
                        totalSolved += solved;
                        totalStars += stars;

                        if (domainName.toLowerCase().includes("problem solving")) {
                            const calculatedStars = stars > 0 ? stars : getHackerRankProblemSolvingStars(points);
                            if (calculatedStars > 0) {
                                stats.push({ label: "badge", value: `${calculatedStars}★ Problem Solving` });
                            }
                        } else if (stars > 0) {
                            stats.push({ label: `badge_${domainName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`, value: `${stars}★ ${domainName}` });
                        }
                    }
                    if (totalSolved > 0) {
                        stats.push({ label: "solved", value: `${totalSolved} solved` });
                    }
                    if (totalStars > 0) {
                        stats.push({ label: "stars", value: `${totalStars}★ total` });
                    }
                }
            }
        } catch {
            // Non-fatal
        }

        let hrCalendar: Record<string, number> = {};
        let totalHrSubs = 0;
        try {
            const histRes = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/submission_histories`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4000),
            });
            if (histRes.ok) {
                hrCalendar = (await histRes.json()) as any;
                if (hrCalendar && typeof hrCalendar === "object") {
                    totalHrSubs = Object.values(hrCalendar).reduce((acc: number, c: any) => acc + (typeof c === "number" ? c : 0), 0);
                    if (totalHrSubs > 0) {
                        stats.push({ label: "submissions", value: `${totalHrSubs} submissions` });
                    }
                }
            }
        } catch {
            // Non-fatal
        }

        if (user.level) {
            stats.push({ label: "level", value: `Level ${user.level}` });
        }
        if (user.country) {
            stats.push({ label: "country", value: user.country });
        }
        if (stats.length === 0) {
            stats.push({ label: "portal", value: "HackerRank" });
        }

        return {
            success: true,
            portal: "hackerrank",
            username: user.username,
            name: name || user.username,
            avatar,
            stats,
            profileUrl: `https://www.hackerrank.com/profile/${user.username}`,
            verified: true,
            submissionCalendar: hrCalendar,
            totalSubmissions: totalHrSubs,
            activeDays: Object.keys(hrCalendar).length,
        };
    } catch {
        return null;
    }
}

async function fetchAtCoder(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://atcoder.jp/users/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (
            html.includes("404 Page Not Found") ||
            html.includes("User not found") ||
            html.includes("404 Not Found - AtCoder")
        ) {
            return null;
        }

        const avatarMatch = html.match(/<img class=['"]avatar['"][^>]+src=['"]([^'"]+)['"]/i);
        let avatar = (avatarMatch && avatarMatch[1]) ? avatarMatch[1] : getFallbackAvatar(username);
        if (avatar.startsWith("//")) {
            avatar = "https:" + avatar;
        }

        const stats: Array<{ label: string; value: string }> = [];

        // Parse official AtCoder contest rating from user profile table
        const ratingMatch = html.match(/Rating<\/th>\s*<td[^>]*>(?:<span[^>]*class=['"]user-[a-z]+['"][^>]*>)?(\d+)(?:<\/span>)?/i);
        const highestMatch = html.match(/Highest\s*Rating<\/th>\s*<td[^>]*>(?:<span[^>]*class=['"]user-[a-z]+['"][^>]*>)?(\d+)(?:<\/span>)?/i);
        const currentRating = ratingMatch && ratingMatch[1] ? parseInt(ratingMatch[1], 10) : null;
        const highestRating = highestMatch && highestMatch[1] ? parseInt(highestMatch[1], 10) : currentRating;

        if (currentRating !== null) {
            const acTier = getAtCoderTier(currentRating);
            stats.push({ label: "rating", value: `${currentRating} rating` });
            stats.push({ label: "color", value: acTier.name });
        }
        if (highestRating !== null && (currentRating === null || highestRating > currentRating)) {
            stats.push({ label: "maxRating", value: `max ${highestRating}` });
        }

        try {
            const acRes = await fetch(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Orbix" },
                signal: AbortSignal.timeout(4000),
            });
            if (acRes.ok) {
                const acData = (await acRes.json()) as any;
                if (acData && typeof acData.count === "number") {
                    stats.push({ label: "solved", value: `${acData.count} solved` });
                }
                if (acData && typeof acData.rank === "number") {
                    stats.push({ label: "rank", value: formatRank(acData.rank) });
                }
            }
        } catch {
            // Non-fatal
        }

        const countryMatch = html.match(/Country\/Region<\/th><td>(?:<img[^>]+>\s*)?([^<]+)<\/td>/i);
        if (countryMatch && countryMatch[1]?.trim()) {
            stats.push({ label: "country", value: countryMatch[1].trim() });
        }
        if (stats.length === 0) {
            stats.push({ label: "portal", value: "AtCoder" });
        }

        return {
            success: true,
            portal: "atcoder",
            username,
            name: username,
            avatar,
            stats,
            profileUrl: `https://atcoder.jp/users/${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchCSES(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://cses.fi/user/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (html.includes("CSES - 404") || html.includes("Not Found")) return null;

        const subMatch = html.match(/Submission count:<\/td><td >(\d+)<\/td>/i);
        const subCount = subMatch ? subMatch[1] : "0";
        const taskMatch = html.match(/Tasks solved:<\/td><td[^>]*>(\d+)/i) || html.match(/Tasks solved[^\d]*(\d+)/i);

        const stats: Array<{ label: string; value: string }> = [];
        if (taskMatch && taskMatch[1]) {
            stats.push({ label: "solved", value: `${taskMatch[1]} solved` });
        } else if (subCount !== "0") {
            stats.push({ label: "solved", value: `${subCount} solved` });
        } else {
            stats.push({ label: "portal", value: "CSES" });
        }

        return {
            success: true,
            portal: "cses",
            username,
            name: `CSES User ${username}`,
            avatar: getFallbackAvatar(username),
            stats,
            profileUrl: `https://cses.fi/user/${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchHackerEarth(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://www.hackerearth.com/@${encodeURIComponent(username)}/`, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            redirect: "follow",
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (html.includes("Profile Not Found") || html.includes("Profile not found")) return null;

        const titleMatch = html.match(/<title>([^<|]+)[|]/i);
        const name = titleMatch ? titleMatch[1]?.trim() : username;

        const avatarMatch =
            html.match(/\\"avatar\\"\s*:\s*\\"([^\\"]+)\\"/) ||
            html.match(/"avatar"\s*:\s*"([^"]+)"/) ||
            html.match(/avatar["']:\s*["']([^"']+)["']/i);
        const avatar = (avatarMatch && avatarMatch[1] && avatarMatch[1] !== "null") ? avatarMatch[1] : getFallbackAvatar(username);

        return {
            success: true,
            portal: "hackerearth",
            username,
            name: name || username,
            avatar,
            stats: [
                { label: "portal", value: "HackerEarth" },
                { label: "profile", value: "Developer" },
            ],
            profileUrl: `https://www.hackerearth.com/@${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchInterviewBit(username: string): Promise<PortalProfileData | null> {
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

        const profileUrl = `https://www.interviewbit.com/profile/${encodeURIComponent(clean)}/`;

        const apiHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": profileUrl,
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        };

        // Query InterviewBit's official profile API
        const apiRes = await fetch(
            `https://www.interviewbit.com/v2/profile/username?id=${encodeURIComponent(clean)}`,
            {
                headers: apiHeaders,
                signal: AbortSignal.timeout(6000),
            }
        );

        // Non-existent profiles return 403 or 404
        if (!apiRes.ok) {
            return null;
        }

        const data = await apiRes.json();
        if (!data || (!data.username && !data.id && !data.name)) {
            return null;
        }

        // Fetch streak / coins data
        let streakData: any = null;
        try {
            const streakRes = await fetch(
                `https://www.interviewbit.com/v2/profile/username/streak/?id=${encodeURIComponent(clean)}`,
                {
                    headers: apiHeaders,
                    signal: AbortSignal.timeout(3000),
                }
            );
            if (streakRes.ok) {
                streakData = await streakRes.json();
            }
        } catch {
            // Streak fetch error non-fatal
        }

        const stats: Array<{ label: string; value: string }> = [];
        if (data.completed_problems || data.problems_solved) {
            const pSolved = data.completed_problems || data.problems_solved;
            stats.push({ label: "solved", value: `${pSolved} solved` });
        }
        if (data.score) {
            stats.push({ label: "score", value: `${data.score} score` });
        }
        if (data.global_rank) {
            stats.push({
                label: "rank",
                value: `#${Number(data.global_rank).toLocaleString("en-IN")} rank`,
            });
        }
        if (data.university_rank) {
            stats.push({
                label: "college",
                value: `#${data.university_rank} college`,
            });
        }
        if (streakData && typeof streakData.coins === "number" && streakData.coins > 0) {
            stats.push({
                label: "coins",
                value: `${streakData.coins} coins`,
            });
        }
        if (streakData && typeof streakData.current_streak === "number" && streakData.current_streak > 0) {
            stats.push({
                label: "streak",
                value: `${streakData.current_streak} days`,
            });
        }
        if (stats.length === 0) {
            stats.push({ label: "portal", value: "InterviewBit" }, { label: "profile", value: "Verified User" });
        }

        // Extract dynamic profile picture
        let avatar = "";
        if (data.image && typeof data.image === "string" && data.image.startsWith("http")) {
            avatar = data.image;
        } else {
            const displayName = data.name || data.username || clean;
            const cleanLetters = displayName.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "IB";
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanLetters)}&background=0D8BD9&color=fff&size=200&bold=true`;
        }

        return {
            success: true,
            portal: "interviewbit",
            username: data.username || clean,
            name: data.name || clean,
            avatar,
            stats,
            profileUrl,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchTopCoder(username: string): Promise<PortalProfileData | null> {
    try {
        const clean = username.trim();
        const res = await fetch(`https://api.topcoder.com/v6/members?handle=${encodeURIComponent(clean)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;
        const members = await res.json();
        if (!Array.isArray(members) || members.length === 0) return null;

        const m = members[0];
        if (!m || !m.handle) return null;

        const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
        const displayName = fullName || m.handle || clean;

        let avatar = m.photoURL;
        if (!avatar) {
            try {
                const ghCheck = await fetch(`https://github.com/${encodeURIComponent(clean)}.png`, {
                    method: "HEAD",
                    redirect: "follow",
                    signal: AbortSignal.timeout(2000),
                });
                if (ghCheck.ok && !ghCheck.url.includes("identicons")) {
                    avatar = `https://github.com/${encodeURIComponent(clean)}.png`;
                }
            } catch {
                // Ignore
            }
        }

        if (!avatar) {
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=29A7DF&color=fff&size=200&bold=true`;
        }

        const stats: Array<{ label: string; value: string }> = [
            { label: "portal", value: "TopCoder" },
        ];
        if (m.status) {
            stats.push({ label: "status", value: m.status });
        }
        if (m.homeCountryCode) {
            stats.push({ label: "country", value: m.homeCountryCode });
        }
        if (m.maxRating && typeof m.maxRating.rating === "number") {
            stats.push({ label: "rating", value: `${m.maxRating.rating} rating` });
        }

        return {
            success: true,
            portal: "topcoder",
            username: m.handle,
            name: displayName,
            avatar,
            stats,
            profileUrl: `https://profiles.topcoder.com/${m.handle}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchCode360(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\.\-]{3,50}$/.test(clean)) return null;

    let name = clean;
    const stats: Array<{ label: string; value: string }> = [
        { label: "portal", value: "Code360" },
        { label: "practice", value: "Coding Ninjas" },
    ];

    try {
        const res = await fetch(`https://www.naukri.com/code360/profile/${encodeURIComponent(clean)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const html = await res.text();
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes("Page Not Found") && !titleMatch[1].includes("404")) {
                const parts = titleMatch[1].split("|")[0]?.trim();
                if (parts && !parts.toLowerCase().includes("code360")) name = parts;
            }
        }
    } catch {
        // Fallback to verified username
    }

    return {
        success: true,
        portal: "code360",
        username: clean,
        name,
        avatar: getFallbackAvatar(clean),
        stats,
        profileUrl: `https://www.naukri.com/code360/profile/${clean}`,
        verified: true,
    };
}

async function fetchSPOJ(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\.]{3,25}$/.test(clean)) return null;

    return {
        success: true,
        portal: "spoj",
        username: clean,
        name: clean,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "SPOJ" },
            { label: "status", value: "Sphere Judge" },
        ],
        profileUrl: `https://www.spoj.com/users/${clean}/`,
        verified: true,
    };
}

async function fetchMedium(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\-\.]{2,30}$/.test(clean)) return null;

    return {
        success: true,
        portal: "medium",
        username: clean,
        name: `@${clean}`,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "Medium" },
            { label: "publication", value: "Writer" },
        ],
        profileUrl: `https://medium.com/@${clean}`,
        verified: true,
    };
}

async function fetchSubstack(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\-]{2,30}$/.test(clean)) return null;

    return {
        success: true,
        portal: "substack",
        username: clean,
        name: clean,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "Substack" },
            { label: "newsletter", value: "Author" },
        ],
        profileUrl: `https://${clean}.substack.com`,
        verified: true,
    };
}

async function fetchAlgorithmXlr8(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\-]{2,30}$/.test(clean)) return null;

    return {
        success: true,
        portal: "algorithmxlr8",
        username: clean,
        name: clean,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "AlgorithmXlr8" },
            { label: "member", value: "Verified" },
        ],
        profileUrl: `https://algorithmxlr8.com/user/${clean}`,
        verified: true,
    };
}

export async function verifyAndFetchPortal(portal: string, username: string): Promise<PortalProfileData | null> {
    const cleanPortal = String(portal || "").toLowerCase().trim();
    const cleanUsername = String(username || "").trim();
    if (!cleanPortal || !cleanUsername) return null;

    switch (cleanPortal) {
        case "leetcode":
            return await fetchLeetCode(cleanUsername);
        case "codeforces":
            return await fetchCodeforces(cleanUsername);
        case "github":
            return await fetchGitHub(cleanUsername);
        case "codechef":
            return await fetchCodeChef(cleanUsername);
        case "geeksforgeeks":
            return await fetchGeeksforGeeks(cleanUsername);
        case "hackerrank":
            return await fetchHackerRank(cleanUsername);
        case "atcoder":
            return await fetchAtCoder(cleanUsername);
        case "cses":
            return await fetchCSES(cleanUsername);
        case "hackerearth":
            return await fetchHackerEarth(cleanUsername);
        case "interviewbit":
            return await fetchInterviewBit(cleanUsername);
        case "topcoder":
            return await fetchTopCoder(cleanUsername);
        case "code360":
        case "codingninjas":
            return await fetchCode360(cleanUsername);
        case "spoj":
            return await fetchSPOJ(cleanUsername);
        case "medium":
            return await fetchMedium(cleanUsername);
        case "substack":
            return await fetchSubstack(cleanUsername);
        case "algorithmxlr8":
            return await fetchAlgorithmXlr8(cleanUsername);
        default:
            return null;
    }
}

portalsRouter.get("/fetch", async (req: Request, res: Response) => {
    try {
        const portal = String(req.query.portal || "").trim().toLowerCase();
        const username = String(req.query.username || "").trim();

        if (!portal || !username) {
            return res.status(400).json({
                success: false,
                message: "Both portal and username parameters are required",
            });
        }

        const profileData = await verifyAndFetchPortal(portal, username);

        // If profile was not found on the platform, return 404 Not Found
        if (!profileData) {
            return res.status(404).json({
                success: false,
                message: `Account not found on ${portal}. Please check your username or profile link.`,
            });
        }

        return res.status(200).json(profileData);
    } catch (err: any) {
        console.error("Portal fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch profile details",
        });
    }
});

/**
 * Unified Coding Submissions endpoint:
 * Collects and merges submissions from the last 1 year across all connected coding platforms for a user,
 * EXCLUDING GitHub as specified.
 */
const activeSubmissionsRefreshes = new Set<string>();

export async function calculateUnifiedSubmissions(
    username: string,
    clientPortals?: Record<string, string>
) {
    // Query Postgres for user's connected platforms excluding github using case-insensitive matching
    const result = await query(
        `SELECT portal, portal_username, verified, display_name, stats
         FROM user_links
         WHERE (
            LOWER(username) = LOWER($1)
            OR LOWER(username) = (SELECT LOWER(email) FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1)
            OR user_id = (SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1)
         )
           AND LOWER(portal) != 'github'
         ORDER BY portal ASC;`,
        [username]
    );

    const rows = result.rows || [];
    let effectiveRows: any[] = [];

    if (clientPortals && Object.keys(clientPortals).length > 0) {
        // Dynamic client-driven set: ONLY include platforms that client is currently connected to
        const clientEntries = Object.entries(clientPortals)
            .map(([p, u]) => [p.toLowerCase().trim(), String(u || "").trim()] as const)
            .filter(([p, u]) => p !== "github" && !p.startsWith("_") && p !== "theme" && Boolean(u));

        for (const [p, u] of clientEntries) {
            const dbMatch = rows.find((r: any) => (r.portal || "").toLowerCase() === p);
            if (dbMatch) {
                effectiveRows.push({
                    ...dbMatch,
                    portal_username: u || dbMatch.portal_username,
                });
            } else {
                effectiveRows.push({
                    portal: p,
                    portal_username: u,
                    verified: true,
                    display_name: p,
                    stats: [],
                });
            }
        }
    } else {
        effectiveRows = rows;
    }

    const platformBreakdown: Record<string, {
        name: string;
        portal: string;
        username: string;
        solved: number;
        submissions: number;
        activeDays: number;
    }> = {};

    // 365-day merged calendar: dateStr ("YYYY-MM-DD") -> { count: number, platforms: string[], platformCounts: Record<string, number> }
    const dailyMerged: Record<string, { count: number; platforms: string[]; platformCounts: Record<string, number> }> = {};
    const collectedRecentSolves: RecentProblemRecord[] = [];

    // Process all platforms in parallel with 3.5s timeout guard per platform
    await Promise.allSettled(
        effectiveRows.map(async (row: any) => {
            const portal = (row.portal || "").toLowerCase().trim();
            const portalUsername = (row.portal_username || "").trim();
            if (!portal || !portalUsername) return;

            let profileData: any = null;
            try {
                // Quick fetch with 3.5s timeout per platform to prevent stalling
                profileData = await Promise.race([
                    verifyAndFetchPortal(portal, portalUsername),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500)),
                ]);
            } catch {
                profileData = null;
            }

            let subCount = profileData?.totalSubmissions || 0;
            let solvedCount = 0;
            let activeDaysCount = profileData?.activeDays || 0;

            // Extract solved and submissions from live stats or fallback to row.stats stored in database
            const statsToScan = (profileData?.stats && profileData.stats.length > 0) ? profileData.stats : (row.stats || []);
            for (const s of statsToScan) {
                const l = (s.label || "").toLowerCase();
                const v = (s.value || "").toLowerCase();
                if (l === "solved" || v.includes("solved")) {
                    const m = (s.value || "").match(/([\d,]+)/);
                    if (m && m[1]) solvedCount = parseInt(m[1].replace(/,/g, ""), 10) || solvedCount;
                }
                if (l.includes("submission") || v.includes("submission")) {
                    const m = (s.value || "").match(/([\d,]+)/);
                    if (m && m[1]) subCount = parseInt(m[1].replace(/,/g, ""), 10) || subCount;
                }
                if (l.includes("active") || v.includes("active day")) {
                    const m = (s.value || "").match(/([\d,]+)/);
                    if (m && m[1]) activeDaysCount = parseInt(m[1].replace(/,/g, ""), 10) || activeDaysCount;
                }
            }
            if (subCount === 0) {
                subCount = solvedCount;
            }

            // Collect any recent verified solves from this platform
            if (profileData?.recentSubmissions && Array.isArray(profileData.recentSubmissions)) {
                for (const item of profileData.recentSubmissions) {
                    collectedRecentSolves.push({
                        ...item,
                        portal,
                        platformName: row.display_name || portal,
                    });
                }
            }

            // If calendar is available, merge daily
            if (profileData?.submissionCalendar && typeof profileData.submissionCalendar === "object") {
                for (const [key, val] of Object.entries(profileData.submissionCalendar)) {
                    const count = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
                    if (count <= 0) continue;

                    let dateStr = key;
                    // If key is unix epoch timestamp in seconds
                    if (/^\d{9,11}$/.test(key)) {
                        dateStr = new Date(parseInt(key, 10) * 1000).toISOString().split("T")[0] || key;
                    }

                    if (!dailyMerged[dateStr]) {
                        dailyMerged[dateStr] = { count: 0, platforms: [], platformCounts: {} };
                    }
                    const entry = dailyMerged[dateStr];
                    if (entry) {
                        entry.count += count;
                        if (!entry.platforms.includes(portal)) {
                            entry.platforms.push(portal);
                        }
                        entry.platformCounts[portal] = (entry.platformCounts[portal] || 0) + count;
                    }
                }
            }

            const effectiveCount = Math.max(subCount, solvedCount);

            // Only register platform if question/submission count can actually be extracted (count > 0)
            if (effectiveCount > 0) {
                platformBreakdown[portal] = {
                    name: profileData?.name || row.display_name || portal,
                    portal,
                    username: portalUsername,
                    solved: solvedCount,
                    submissions: effectiveCount,
                    activeDays: activeDaysCount || (profileData?.submissionCalendar ? Object.keys(profileData.submissionCalendar).length : 0),
                };
            }
        })
    );

    // Reconcile dailyMerged with dates from verified recent solves
    for (const solve of collectedRecentSolves) {
        if (solve.timestamp) {
            const dateStr = new Date(solve.timestamp * 1000).toISOString().split("T")[0];
            if (dateStr) {
                if (!dailyMerged[dateStr]) {
                    dailyMerged[dateStr] = { count: 0, platforms: [], platformCounts: {} };
                }
                const entry = dailyMerged[dateStr];
                if (entry) {
                    if (!entry.platforms.includes(solve.portal)) {
                        entry.platforms.push(solve.portal);
                    }
                    if (entry.count === 0) {
                        entry.count = 1;
                    }
                    entry.platformCounts[solve.portal] = (entry.platformCounts[solve.portal] || 0) + 1;
                }
            }
        }
    }

    // Deduplicate repeated accepted submissions for the same problem on the same platform
    const seenSolveKeys = new Set<string>();
    const deduplicatedRecentSolves: RecentProblemRecord[] = [];

    // Sort by timestamp descending first so latest solve is preserved
    collectedRecentSolves.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    for (const item of collectedRecentSolves) {
        const canonicalKey = `${item.portal}:${item.title.toLowerCase().trim()}`;
        if (!seenSolveKeys.has(canonicalKey)) {
            seenSolveKeys.add(canonicalKey);
            deduplicatedRecentSolves.push(item);
        }
    }

    // Calculate rolling 30-day and 90-day window metrics
    const now = new Date();
    const nowUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const seconds30d = 30 * 86400;
    const seconds90d = 90 * 86400;

    let activeDays30d = 0;
    let activeDays90d = 0;
    let calendarSolves30d = 0;
    let calendarSolves90d = 0;

    const platform30dSolves: Record<string, number> = {};
    const platform90dSolves: Record<string, number> = {};
    const platform30dDays: Record<string, Set<string>> = {};
    const platform90dDays: Record<string, Set<string>> = {};

    for (const portal of Object.keys(platformBreakdown)) {
        platform30dSolves[portal] = 0;
        platform90dSolves[portal] = 0;
        platform30dDays[portal] = new Set();
        platform90dDays[portal] = new Set();
    }

    for (const [dateStr, entry] of Object.entries(dailyMerged)) {
        if (!entry || entry.count <= 0) continue;
        const [y, m, d] = dateStr.split("-").map(Number);
        if (!y || !m || !d) continue;
        const cellDate = new Date(Date.UTC(y, m - 1, d));
        const diffDays = Math.floor((nowUtcMidnight.getTime() - cellDate.getTime()) / (1000 * 60 * 60 * 24));

        // Distinct calendar dates globally deduplicated (1 date = 1 active day regardless of platforms)
        if (diffDays >= 0 && diffDays < 30) {
            activeDays30d++;
            calendarSolves30d += entry.count;
            for (const p of entry.platforms) {
                if (platform30dDays[p]) platform30dDays[p].add(dateStr);
                const share = entry.platformCounts?.[p] || Math.max(1, Math.round(entry.count / entry.platforms.length));
                platform30dSolves[p] = (platform30dSolves[p] || 0) + share;
            }
        }
        if (diffDays >= 0 && diffDays < 90) {
            activeDays90d++;
            calendarSolves90d += entry.count;
            for (const p of entry.platforms) {
                if (platform90dDays[p]) platform90dDays[p].add(dateStr);
                const share = entry.platformCounts?.[p] || Math.max(1, Math.round(entry.count / entry.platforms.length));
                platform90dSolves[p] = (platform90dSolves[p] || 0) + share;
            }
        }
    }

    // Solved problems in 30d and 90d from deduplicated recent problem records
    const solves30dItems = deduplicatedRecentSolves.filter(
        (s) => nowSeconds - (s.timestamp || 0) >= 0 && nowSeconds - (s.timestamp || 0) <= seconds30d
    );
    const solves90dItems = deduplicatedRecentSolves.filter(
        (s) => nowSeconds - (s.timestamp || 0) >= 0 && nowSeconds - (s.timestamp || 0) <= seconds90d
    );

    const solved30d = Math.max(solves30dItems.length, calendarSolves30d);
    const solved90d = Math.max(solves90dItems.length, calendarSolves90d);

    // Platform contribution breakdowns for 30d and 90d
    const platformContributions30d: Record<string, {
        portal: string;
        name: string;
        solves: number;
        activeDays: number;
        percentage: number;
        status: "active" | "idle" | "unsupported";
    }> = {};

    const platformContributions90d: Record<string, {
        portal: string;
        name: string;
        solves: number;
        activeDays: number;
        percentage: number;
        status: "active" | "idle" | "unsupported";
    }> = {};

    for (const [portal, p] of Object.entries(platformBreakdown)) {
        const solves30 = platform30dSolves[portal] || 0;
        const days30 = platform30dDays[portal]?.size || 0;
        const solves90 = platform90dSolves[portal] || 0;
        const days90 = platform90dDays[portal]?.size || 0;

        const hasHistory = (p.submissions > 0 || p.solved > 0 || p.activeDays > 0);

        platformContributions30d[portal] = {
            portal,
            name: p.name || portal,
            solves: solves30,
            activeDays: days30,
            percentage: solved30d > 0 ? Math.round((solves30 / solved30d) * 100) : 0,
            status: !hasHistory ? "unsupported" : solves30 > 0 ? "active" : "idle",
        };

        platformContributions90d[portal] = {
            portal,
            name: p.name || portal,
            solves: solves90,
            activeDays: days90,
            percentage: solved90d > 0 ? Math.round((solves90 / solved90d) * 100) : 0,
            status: !hasHistory ? "unsupported" : solves90 > 0 ? "active" : "idle",
        };
    }

    // Platform coverage status
    const totalEligible = Object.keys(platformBreakdown).length;
    const reporting = Object.values(platformBreakdown).filter(
        (p) => p.submissions > 0 || p.solved > 0 || p.activeDays > 0
    ).length;
    const unavailable = Object.entries(platformBreakdown)
        .filter(([_, p]) => p.submissions === 0 && p.solved === 0 && p.activeDays === 0)
        .map(([portal]) => portal);

    let syncStatus: "synced" | "partial" | "empty" = "synced";
    if (reporting === 0 && totalEligible > 0) {
        syncStatus = "empty";
    } else if (reporting < totalEligible) {
        syncStatus = "partial";
    }

    // Calculate overall totals
    let totalMergedSubmissions = Object.values(dailyMerged).reduce((acc, d) => acc + d.count, 0);
    const sumPlatformSubs = Object.values(platformBreakdown).reduce((acc, p) => acc + p.submissions, 0);
    totalMergedSubmissions = Math.max(totalMergedSubmissions, sumPlatformSubs);

    const activeDays = Object.keys(dailyMerged).length;

    // Calculate streak up to today
    let dayStreak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split("T")[0] || "";
        const entry = dailyMerged[dateStr];
        if (entry && entry.count > 0) {
            dayStreak++;
        } else if (i > 0) {
            break;
        }
    }

    return {
        success: true,
        username,
        totalSubmissions: totalMergedSubmissions,
        activeDays: activeDays || 1,
        dayStreak: Math.max(dayStreak, 1),
        platformBreakdown,
        dailyMerged,
        recentMetrics: {
            solved30d,
            solved90d,
            activeDays30d,
            activeDays90d,
        },
        platformContributions30d,
        platformContributions90d,
        recentlySolved: deduplicatedRecentSolves,
        coverage: {
            totalEligible,
            reporting,
            unavailable,
            syncStatus,
            lastSyncedAt: new Date().toISOString(),
        },
        connectedPlatformsCount: totalEligible,
        platformsExcluded: ["github"],
        timestamp: new Date().toISOString(),
    };
}

portalsRouter.get("/submissions/unified", async (req: Request, res: Response) => {
    try {
        const username = String(req.query.username || (req as any).user?.username || "").trim();
        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        const cleanUser = username.toLowerCase().trim();
        const cacheKey = `user:submissions:unified:${cleanUser}`;
        const forceRefresh = req.query.refresh === "true" || req.query.force === "true";

        // Parse clientPortals if provided
        const clientPortals: Record<string, string> = {};
        if (req.query.portals && typeof req.query.portals === "string") {
            const rawPortals = req.query.portals.trim();
            if (rawPortals.startsWith("{")) {
                try {
                    const parsed = JSON.parse(rawPortals);
                    for (const [k, v] of Object.entries(parsed)) {
                        const lk = k.toLowerCase().trim();
                        const val = typeof v === "object" ? (v as any)?.username || (v as any)?.portal_username || "" : String(v || "");
                        if (lk && val.trim()) clientPortals[lk] = val.trim();
                    }
                } catch {
                    // ignore JSON parse error
                }
            } else {
                const pairs = rawPortals.split(",");
                for (const p of pairs) {
                    if (p.includes(":")) {
                        const [k, v] = p.split(":");
                        if (k && v) clientPortals[k.trim().toLowerCase()] = v.trim();
                    }
                }
            }
        }

        // Check Redis cache first for lightning-fast sub-millisecond response
        if (!forceRefresh && redis && redis.status === "ready") {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);

                    // Check if clientPortals has mismatched platforms compared to cached response
                    let cacheMismatched = false;
                    const clientPortalKeys = Object.keys(clientPortals).filter((k) => k !== "github");
                    if (clientPortalKeys.length > 0) {
                        const cachedKeys = Object.keys(parsed.platformBreakdown || {}).filter((k) => k !== "github");
                        const hasMissing = clientPortalKeys.some((k) => !cachedKeys.includes(k) || (parsed.platformBreakdown?.[k]?.username?.toLowerCase() !== clientPortals[k]?.toLowerCase()));
                        const hasExtra = cachedKeys.some((k) => !clientPortalKeys.includes(k));
                        if (hasMissing || hasExtra) {
                            cacheMismatched = true;
                        }
                    }

                    if (!cacheMismatched) {
                        res.status(200).json(parsed);

                        // Background revalidation: if cached response is older than 3 minutes, re-verify in background
                        const cacheAge = parsed.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
                        if (cacheAge > 3 * 60 * 1000 && !activeSubmissionsRefreshes.has(cleanUser)) {
                            activeSubmissionsRefreshes.add(cleanUser);
                            calculateUnifiedSubmissions(username, Object.keys(clientPortals).length > 0 ? clientPortals : undefined)
                                .then(async (fresh) => {
                                    if (
                                        fresh.totalSubmissions !== parsed.totalSubmissions ||
                                        fresh.activeDays !== parsed.activeDays ||
                                        fresh.dayStreak !== parsed.dayStreak ||
                                        Object.keys(fresh.dailyMerged).length !== Object.keys(parsed.dailyMerged).length
                                    ) {
                                        if (redis && redis.status === "ready") {
                                            await redis.set(cacheKey, JSON.stringify(fresh), "EX", 1800);
                                        }
                                    }
                                })
                                .catch((err) => {
                                    console.error("Background submissions re-verification error:", err);
                                })
                                .finally(() => {
                                    activeSubmissionsRefreshes.delete(cleanUser);
                                });
                        }
                        return;
                    }
                }
            } catch {
                // Non-fatal, fallback to calculating
            }
        }

        // Cache miss or force refresh or platform set changed
        const responseData = await calculateUnifiedSubmissions(
            username,
            Object.keys(clientPortals).length > 0 ? clientPortals : undefined
        );

        // Cache in Redis for 30 minutes (1800s)
        if (redis && redis.status === "ready") {
            try {
                await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800);
            } catch {
                // Non-fatal
            }
        }

        return res.status(200).json(responseData);
    } catch (err: any) {
        console.error("Unified submissions endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to generate unified submissions",
        });
    }
});

/**
 * Unified Development Contributions endpoint (GitHub & code versioning platforms):
 * - Live parses full 365-day contributions calendar directly from GitHub
 * - Caches in Redis under user:development:unified:<username>
 * - Background revalidates without blocking the UI
 */
const activeDevelopmentRefreshes = new Set<string>();

export async function calculateUnifiedDevelopmentContributions(
    username: string,
    clientPortals?: Record<string, string>
) {
    let ghHandle = "";
    let displayName = "GitHub";

    // If clientPortals was explicitly supplied, prioritize client-linked github handle
    if (clientPortals && typeof clientPortals === "object") {
        ghHandle = (clientPortals.github || "").trim();
    }

    if (!ghHandle && clientPortals === undefined) {
        try {
            const result = await query(
                `SELECT portal, portal_username, verified, display_name, stats
                 FROM user_links
                 WHERE (
                    LOWER(username) = LOWER($1)
                    OR LOWER(username) = (SELECT LOWER(email) FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1)
                    OR user_id = (SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1)
                 )
                   AND LOWER(portal) = 'github'
                 LIMIT 1;`,
                [username]
            );
            if (result && result.rows.length > 0) {
                ghHandle = result.rows[0].portal_username || "";
                displayName = result.rows[0].display_name || "GitHub";
            }
        } catch {
            // non-blocking
        }
    }

    let profileData: any = null;
    if (ghHandle) {
        try {
            profileData = await Promise.race([
                fetchGitHub(ghHandle),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 6000)),
            ]);
        } catch {
            profileData = null;
        }
    }

    const dailyMerged: Record<string, { count: number; platforms: string[] }> = {};
    let totalContributions = profileData?.totalSubmissions || 0;
    let activeDays = profileData?.activeDays || 0;

    if (profileData?.submissionCalendar && typeof profileData.submissionCalendar === "object") {
        for (const [dateStr, val] of Object.entries(profileData.submissionCalendar)) {
            const count = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
            if (count <= 0) continue;
            dailyMerged[dateStr] = {
                count,
                platforms: ["github"],
            };
        }
        if (totalContributions === 0) {
            totalContributions = Object.values(profileData.submissionCalendar).reduce(
                (sum: number, c: any) => sum + (typeof c === "number" ? c : 0),
                0
            );
        }
        activeDays = Object.keys(dailyMerged).length;
    }

    // Streak calculation backwards from today
    let dayStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split("T")[0] || "";
        if (dailyMerged[dateStr] && dailyMerged[dateStr].count > 0) {
            dayStreak++;
        } else if (i > 0) {
            break;
        }
    }

    const platformBreakdown: Record<string, any> = {};
    if (ghHandle && profileData) {
        platformBreakdown.github = {
            name: profileData?.name || displayName || "GitHub",
            portal: "github",
            username: ghHandle,
            solved: totalContributions,
            submissions: totalContributions,
            contributions: totalContributions,
            activeDays: activeDays || (totalContributions > 0 ? 1 : 0),
            avatar: profileData?.avatar || null,
            profileUrl: profileData?.profileUrl || `https://github.com/${ghHandle}`,
        };
    }

    return {
        success: true,
        username,
        totalContributions,
        totalSubmissions: totalContributions,
        activeDays: activeDays || 1,
        dayStreak: Math.max(dayStreak, 1),
        platformBreakdown,
        dailyMerged,
        connectedPlatformsCount: 1,
        platforms: ["github"],
        timestamp: new Date().toISOString(),
    };
}

portalsRouter.get("/development/unified", async (req: Request, res: Response) => {
    try {
        const username = String(req.query.username || (req as any).user?.username || "").trim();
        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        let clientPortals: Record<string, string> | undefined = undefined;
        if (req.query.portals) {
            try {
                clientPortals = JSON.parse(String(req.query.portals));
            } catch {
                clientPortals = {};
                const parts = String(req.query.portals).split(",");
                for (const p of parts) {
                    const [k, v] = p.split(":");
                    if (k && v) clientPortals[k.trim().toLowerCase()] = v.trim();
                }
            }
        }

        const cleanUser = username.toLowerCase().trim();
        const cacheKey = `user:development:unified:${cleanUser}`;
        const forceRefresh = req.query.refresh === "true" || req.query.force === "true";

        // Check Redis cache first for sub-millisecond response
        if (!forceRefresh && redis && redis.status === "ready") {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);

                    // Check if client github changed
                    let isMismatched = false;
                    if (clientPortals && clientPortals.github !== undefined) {
                        const clientGh = (clientPortals.github || "").toLowerCase().trim();
                        const cachedGh = (parsed.platformBreakdown?.github?.username || "").toLowerCase().trim();
                        if (clientGh !== cachedGh) {
                            isMismatched = true;
                        }
                    }

                    if (!isMismatched) {
                        res.status(200).json(parsed);

                        // Background revalidation
                        const cacheAge = parsed.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
                        if (cacheAge > 3 * 60 * 1000 && !activeDevelopmentRefreshes.has(cleanUser)) {
                            activeDevelopmentRefreshes.add(cleanUser);
                            calculateUnifiedDevelopmentContributions(username, clientPortals)
                                .then(async (fresh) => {
                                    if (
                                        fresh.totalContributions !== parsed.totalContributions ||
                                        fresh.activeDays !== parsed.activeDays ||
                                        fresh.dayStreak !== parsed.dayStreak
                                    ) {
                                        if (redis && redis.status === "ready") {
                                            await redis.set(cacheKey, JSON.stringify(fresh), "EX", 1800);
                                        }
                                    }
                                })
                                .catch((err) => {
                                    console.error("Background development contributions re-verification error:", err);
                                })
                                .finally(() => {
                                    activeDevelopmentRefreshes.delete(cleanUser);
                                });
                        }
                        return;
                    }
                }
            } catch {
                // Non-fatal, fallback to calculating
            }
        }

        const responseData = await calculateUnifiedDevelopmentContributions(username, clientPortals);

        if (redis && redis.status === "ready") {
            try {
                await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800);
            } catch {
                // Non-fatal
            }
        }

        return res.status(200).json(responseData);
    } catch (err: any) {
        console.error("Unified development contributions endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to generate unified development contributions",
        });
    }
});

/**
 * Unified Contest Performance endpoint:
 * Consolidates contest ratings, chronological history points, and official rank tiers
 * across all connected eligible contest platforms (Codeforces, LeetCode, CodeChef, AtCoder).
 */
const activeContestsRefreshes = new Set<string>();

portalsRouter.get("/contests", async (req: Request, res: Response) => {
    try {
        const username = String(req.query.username || (req as any).user?.username || "").trim();
        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        let clientPortals: Record<string, string> | undefined = undefined;
        if (req.query.portals) {
            try {
                clientPortals = JSON.parse(String(req.query.portals));
            } catch {
                clientPortals = {};
                const parts = String(req.query.portals).split(",");
                for (const p of parts) {
                    const [k, v] = p.split(":");
                    if (k && v) clientPortals[k.trim().toLowerCase()] = v.trim();
                }
            }
        }

        const cleanUser = username.toLowerCase().trim();
        const cacheKey = `user:contests:unified:${cleanUser}`;
        const forceRefresh = req.query.refresh === "true" || req.query.force === "true";

        // Check Redis cache first for sub-millisecond response
        if (!forceRefresh && redis && redis.status === "ready") {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);

                    // Check if clientPortals has mismatched platforms compared to cached response
                    let cacheMismatched = false;
                    if (clientPortals && Object.keys(clientPortals).length > 0) {
                        const clientPortalKeys = Object.keys(clientPortals).filter((k) => k !== "github" && !k.startsWith("_") && k !== "theme");
                        const cachedPlatforms = (parsed.platforms || []).filter((p: any) => p.connected && p.portalUsername);
                        const cachedKeys = cachedPlatforms.map((p: any) => p.portal.toLowerCase());
                        const hasMissing = clientPortalKeys.some((k) => !cachedKeys.includes(k) || (cachedPlatforms.find((p: any) => p.portal.toLowerCase() === k)?.portalUsername?.toLowerCase() !== clientPortals[k]?.toLowerCase()));
                        const hasExtra = cachedKeys.some((k: string) => !clientPortalKeys.includes(k));
                        if (hasMissing || hasExtra) {
                            cacheMismatched = true;
                        }
                    }

                    if (!cacheMismatched) {
                        res.status(200).json(parsed);

                        // Background revalidation if older than 3 minutes
                        const cacheAge = parsed.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
                        if (cacheAge > 3 * 60 * 1000 && !activeContestsRefreshes.has(cleanUser)) {
                            activeContestsRefreshes.add(cleanUser);
                            calculateUserContestPerformance(username, clientPortals)
                                .then(async (fresh) => {
                                    if (redis && redis.status === "ready") {
                                        await redis.set(cacheKey, JSON.stringify(fresh), "EX", 1800);
                                    }
                                })
                                .catch((err) => {
                                    console.error("Background contest re-verification error:", err);
                                })
                                .finally(() => {
                                    activeContestsRefreshes.delete(cleanUser);
                                });
                        }
                        return;
                    }
                }
            } catch {
                // Non-fatal, fallback to calculating
            }
        }

        const responseData = await calculateUserContestPerformance(username, clientPortals);

        if (redis && redis.status === "ready") {
            try {
                await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800);
            } catch {
                // Non-fatal
            }
        }

        return res.status(200).json(responseData);
    } catch (err: any) {
        console.error("Unified contests endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to generate contest analytics",
        });
    }
});

portalsRouter.get(["/badges", "/badges/unified"], async (req: Request, res: Response) => {
    try {
        const username = String(req.query.username || (req as any).user?.username || "").trim();
        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        const cacheKey = `user:badges:unified:${username}`;
        const forceRefresh = req.query.refresh === "true" || req.query.force === "true";

        let clientPortals: Record<string, string> | undefined = undefined;
        if (req.query.clientPortals) {
            try {
                clientPortals = JSON.parse(String(req.query.clientPortals));
            } catch {
                // Ignore parse error
            }
        }

        if (!forceRefresh && redis && redis.status === "ready") {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    res.status(200).json(parsed);

                    // Background revalidation if older than 5 minutes
                    const cacheAge = parsed.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
                    if (cacheAge > 5 * 60 * 1000) {
                        calculateUserBadges(username, clientPortals)
                            .then(async (fresh) => {
                                if (redis && redis.status === "ready") {
                                    await redis.set(cacheKey, JSON.stringify(fresh), "EX", 1800);
                                }
                            })
                            .catch((err) => {
                                console.error("Background badges re-verification error:", err);
                            });
                    }
                    return;
                }
            } catch {
                // Non-fatal, fallback to calculation
            }
        }

        const responseData = await calculateUserBadges(username, clientPortals);

        if (redis && redis.status === "ready") {
            try {
                await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800);
            } catch {
                // Non-fatal
            }
        }

        return res.status(200).json(responseData);
    } catch (err: any) {
        console.error("Unified badges endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to generate badges data",
        });
    }
});

portalsRouter.get(["/practice/analytics", "/problems/analytics"], async (req: Request, res: Response) => {
    try {
        const username = String(req.query.username || (req as any).user?.username || "").trim();
        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        const cacheKey = `user:practice:analytics:${username}`;
        const forceRefresh = req.query.refresh === "true" || req.query.force === "true";

        let clientPortals: Record<string, string> | undefined = undefined;
        if (req.query.clientPortals) {
            try {
                clientPortals = JSON.parse(String(req.query.clientPortals));
            } catch {
                // Ignore parse error
            }
        }

        if (!forceRefresh && redis && redis.status === "ready") {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    res.status(200).json(parsed);

                    // Background revalidation if older than 5 minutes
                    const cacheAge = parsed.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
                    if (cacheAge > 5 * 60 * 1000) {
                        calculateUserPracticeAnalytics(username, clientPortals)
                            .then(async (fresh) => {
                                if (redis && redis.status === "ready") {
                                    await redis.set(cacheKey, JSON.stringify(fresh), "EX", 1800);
                                }
                            })
                            .catch((err) => {
                                console.error("Background practice analytics re-verification error:", err);
                            });
                    }
                    return;
                }
            } catch {
                // Non-fatal, fallback to calculation
            }
        }

        const responseData = await calculateUserPracticeAnalytics(username, clientPortals);

        if (redis && redis.status === "ready") {
            try {
                await redis.set(cacheKey, JSON.stringify(responseData), "EX", 1800);
            } catch {
                // Non-fatal
            }
        }

        return res.status(200).json(responseData);
    } catch (err: any) {
        console.error("Practice analytics endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to generate practice problem analytics",
        });
    }
});

export interface SavedPortalLink {
    portal: string;
    portal_username: string;
    link: string;
    raw_input?: string;
    display_name?: string;
    avatar_url?: string;
    stats?: any[];
    verified?: boolean;
}

export function detectPortalFromUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    const low = url.toLowerCase();
    if (low.includes("leetcode.com")) return "leetcode";
    if (low.includes("codeforces.com")) return "codeforces";
    if (low.includes("codechef.com")) return "codechef";
    if (low.includes("geeksforgeeks.org")) return "geeksforgeeks";
    if (low.includes("hackerrank.com")) return "hackerrank";
    if (low.includes("atcoder.jp")) return "atcoder";
    if (low.includes("cses.fi")) return "cses";
    if (low.includes("interviewbit.com") || low.includes("scaler.com")) return "interviewbit";
    if (low.includes("topcoder.com")) return "topcoder";
    if (low.includes("hackerearth.com")) return "hackerearth";
    if (low.includes("github.com")) return "github";
    if (low.includes("code360") || low.includes("codingninjas.com")) return "code360";
    if (low.includes("spoj.com")) return "spoj";
    if (low.includes("medium.com")) return "medium";
    if (low.includes("substack.com")) return "substack";
    if (low.includes("algorithmxlr8.com")) return "algorithmxlr8";

    return null;
}

export function extractPortalUsername(portal: string, rawInput: string): string | null {
    if (!rawInput || typeof rawInput !== "string") return null;
    const clean = rawInput.trim().replace(/^@+/, "");
    const withoutQuery = (clean.split("?")[0] || "").split("#")[0]?.replace(/\/+$/, "") || "";

    switch (portal.toLowerCase()) {
        case "leetcode": {
            const m = withoutQuery.match(/leetcode\.com\/u\/([a-zA-Z0-9_\-]+)/i)
                || withoutQuery.match(/leetcode\.com\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "codeforces": {
            const m = withoutQuery.match(/codeforces\.com\/profile\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "codechef": {
            const m = withoutQuery.match(/codechef\.com\/users\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "geeksforgeeks": {
            const m = withoutQuery.match(/geeksforgeeks\.org\/(?:user|profile)\/([a-zA-Z0-9_.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "hackerrank": {
            const m = withoutQuery.match(/hackerrank\.com\/profile\/([a-zA-Z0-9_\.\-]+)/i)
                || withoutQuery.match(/hackerrank\.com\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "atcoder": {
            const m = withoutQuery.match(/atcoder\.jp\/users\/([a-zA-Z0-9_]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "cses": {
            const m = withoutQuery.match(/cses\.fi\/user\/([0-9]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "interviewbit": {
            const m = withoutQuery.match(/(?:interviewbit\.com|scaler\.com)\/(?:profile|user|users|u|academy\/profile)\/([a-zA-Z0-9_\.\-]+)/i)
                || withoutQuery.match(/(?:interviewbit\.com|scaler\.com)\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "topcoder": {
            const m = withoutQuery.match(/(?:profiles\.topcoder\.com|topcoder\.com\/members)\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "hackerearth": {
            const m = withoutQuery.match(/hackerearth\.com\/@?([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "github": {
            const m = withoutQuery.match(/github\.com\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "code360":
        case "codingninjas": {
            const m = withoutQuery.match(/(?:naukri\.com\/code360\/profile|codingninjas\.com\/codestudio\/profile)\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "spoj": {
            const m = withoutQuery.match(/spoj\.com\/users\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "medium": {
            const m = withoutQuery.match(/medium\.com\/@([a-zA-Z0-9_\-\.]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "substack": {
            const m = withoutQuery.match(/([a-zA-Z0-9_\-]+)\.substack\.com/i)
                || withoutQuery.match(/substack\.com\/@([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "algorithmxlr8": {
            const m = withoutQuery.match(/algorithmxlr8\.com\/(?:user\/)?([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "kaggle": {
            const m = withoutQuery.match(/kaggle\.com\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        default: {
            return withoutQuery.split("/").pop() || clean;
        }
    }
}

export function buildPortalLink(portal: string, extractedUsername: string): string {
    const u = encodeURIComponent(extractedUsername.trim());
    switch (portal.toLowerCase()) {
        case "leetcode":
            return `https://leetcode.com/u/${u}`;
        case "codeforces":
            return `https://codeforces.com/profile/${u}`;
        case "codechef":
            return `https://www.codechef.com/users/${u}`;
        case "geeksforgeeks":
            return `https://www.geeksforgeeks.org/user/${u}`;
        case "hackerrank":
            return `https://www.hackerrank.com/profile/${u}`;
        case "atcoder":
            return `https://atcoder.jp/users/${u}`;
        case "cses":
            return `https://cses.fi/user/${u}`;
        case "interviewbit":
            return `https://www.interviewbit.com/profile/${u}/`;
        case "topcoder":
            return `https://profiles.topcoder.com/${u}`;
        case "hackerearth":
            return `https://www.hackerearth.com/@${u}`;
        case "github":
            return `https://github.com/${u}`;
        case "code360":
        case "codingninjas":
            return `https://www.naukri.com/code360/profile/${u}`;
        case "spoj":
            return `https://www.spoj.com/users/${u}/`;
        case "medium":
            return `https://medium.com/@${u}`;
        case "substack":
            return `https://${u}.substack.com`;
        case "algorithmxlr8":
            return `https://algorithmxlr8.com/user/${u}`;
        case "kaggle":
            return `https://www.kaggle.com/${u}`;
        default:
            return `https://${portal}.com/${u}`;
    }
}

// Handle saving portal accounts to DB and cache (protected by authenticate middleware)
export const handleSavePortals = async (req: Request, res: Response) => {
    try {
        const body = req.body || {};
        const itemsToSave: SavedPortalLink[] = [];

        // 1. Process connectedProfiles map if sent
        if (body.connectedProfiles && typeof body.connectedProfiles === "object") {
            for (const [key, val] of Object.entries(body.connectedProfiles)) {
                if (!val || typeof val !== "object") continue;
                const profile = val as any;
                const portal = (profile.portal || key).toLowerCase();
                const raw = profile.username || profile.profileUrl || "";
                const extracted = extractPortalUsername(portal, raw) || profile.username;
                const link = profile.profileUrl || buildPortalLink(portal, extracted);
                itemsToSave.push({
                    portal,
                    portal_username: extracted,
                    link,
                    raw_input: profile.username || profile.profileUrl,
                    display_name: profile.name,
                    avatar_url: profile.avatar,
                    stats: profile.stats || [],
                    verified: profile.verified !== false,
                });
            }
        }

        // 2. Process portals map if sent
        if (body.portals && typeof body.portals === "object") {
            for (const [key, val] of Object.entries(body.portals)) {
                if (!val) continue;
                const portal = key.toLowerCase();
                let raw = "";
                let existingUrl = "";
                if (typeof val === "string") {
                    raw = val;
                } else if (typeof val === "object") {
                    raw = (val as any).raw || (val as any).username || (val as any).url || "";
                    existingUrl = (val as any).url || "";
                }
                if (!raw) continue;
                const extracted = extractPortalUsername(portal, raw);
                if (extracted && !itemsToSave.some((it) => it.portal === portal)) {
                    itemsToSave.push({
                        portal,
                        portal_username: extracted,
                        link: existingUrl || buildPortalLink(portal, extracted),
                        raw_input: raw,
                        verified: true,
                    });
                }
            }
        }

        // 3. Process array of links: ["https://interviewbit.com/profile/_211_938/", "https://leetcode.com/u/vineet-chandel"]
        if (Array.isArray(body.links)) {
            for (const linkStr of body.links) {
                if (typeof linkStr !== "string") continue;
                const detected = detectPortalFromUrl(linkStr);
                if (detected) {
                    const extracted = extractPortalUsername(detected, linkStr);
                    if (extracted && !itemsToSave.some((it) => it.portal === detected)) {
                        itemsToSave.push({
                            portal: detected,
                            portal_username: extracted,
                            link: buildPortalLink(detected, extracted),
                            raw_input: linkStr,
                            verified: true,
                        });
                    }
                }
            }
        }

        // 4. Process single portal object: { portal: "interviewbit", link: "...", username: "..." }
        if (body.portal && (body.link || body.username || body.raw)) {
            const portal = String(body.portal).toLowerCase();
            const raw = String(body.link || body.username || body.raw);
            const extracted = extractPortalUsername(portal, raw);
            if (extracted && !itemsToSave.some((it) => it.portal === portal)) {
                itemsToSave.push({
                    portal,
                    portal_username: extracted,
                    link: body.link || buildPortalLink(portal, extracted),
                    raw_input: raw,
                    display_name: body.displayName || body.name,
                    avatar_url: body.avatar,
                    verified: true,
                });
            }
        }

        // 5. Process top-level portal keys: { interviewbit: "https://www.interviewbit.com/profile/_211_938/" }
        const knownPortals = [
            "leetcode", "codeforces", "codechef", "geeksforgeeks", "hackerrank",
            "atcoder", "cses", "interviewbit", "topcoder", "hackerearth",
            "github", "codingninjas", "kaggle"
        ];
        for (const p of knownPortals) {
            if (body[p] && typeof body[p] === "string" && !itemsToSave.some((it) => it.portal === p)) {
                const raw = body[p];
                const extracted = extractPortalUsername(p, raw);
                if (extracted) {
                    itemsToSave.push({
                        portal: p,
                        portal_username: extracted,
                        link: buildPortalLink(p, extracted),
                        raw_input: raw,
                        verified: true,
                    });
                }
            }
        }

        // User identity from req.user (strictly authenticated)
        const authUser = (req as any).user;
        if (!authUser || (!authUser.username && !authUser.gmail)) {
            return res.status(401).json({
                success: false,
                message: "Authentication required: valid session token needed to link or modify accounts",
            });
        }
        const userId = authUser.id || null;
        const userIdentifier = authUser.username || authUser.gmail;

        // Save to Database (PostgreSQL)
        let dbSaved = false;
        try {
            // 1. Explicitly prune any portals marked for deletion
            if (Array.isArray(body.deletedPortals) && body.deletedPortals.length > 0) {
                for (const dp of body.deletedPortals) {
                    const cleanDp = String(dp || "").trim().toLowerCase();
                    if (cleanDp) {
                        await query(
                            `DELETE FROM user_links
                             WHERE (LOWER(username) = LOWER($1) OR LOWER(username) = LOWER($2) OR user_id = $3)
                               AND LOWER(portal) = LOWER($4);`,
                            [authUser.username, authUser.gmail, userId, cleanDp]
                        ).catch(() => null);
                    }
                }
            }

            // 2. If complete bucket payload was sent, synchronize database to remove any disconnected platforms
            if (body.connectedProfiles && typeof body.connectedProfiles === "object") {
                const incomingPortals = new Set(itemsToSave.map((it) => it.portal.toLowerCase()));
                const existingLinks = await query(
                    `SELECT portal FROM user_links
                     WHERE (LOWER(username) = LOWER($1) OR LOWER(username) = LOWER($2) OR user_id = $3);`,
                    [authUser.username, authUser.gmail, userId]
                );
                for (const row of existingLinks.rows || []) {
                    const ep = (row.portal || "").toLowerCase().trim();
                    if (ep && !incomingPortals.has(ep) && !body.connectedProfiles[ep]) {
                        await query(
                            `DELETE FROM user_links
                             WHERE (LOWER(username) = LOWER($1) OR LOWER(username) = LOWER($2) OR user_id = $3)
                               AND LOWER(portal) = LOWER($4);`,
                            [authUser.username, authUser.gmail, userId, ep]
                        ).catch(() => null);
                    }
                }
            }

            // 3. Upsert current active accounts
            for (const item of itemsToSave) {
                await query(
                    `INSERT INTO user_links (
                        user_id,
                        username,
                        portal,
                        portal_username,
                        link,
                        raw_input,
                        verified,
                        display_name,
                        avatar_url,
                        stats,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                    ON CONFLICT (username, portal)
                    DO UPDATE SET
                        user_id = COALESCE(EXCLUDED.user_id, user_links.user_id),
                        portal_username = EXCLUDED.portal_username,
                        link = EXCLUDED.link,
                        raw_input = EXCLUDED.raw_input,
                        verified = EXCLUDED.verified,
                        display_name = COALESCE(EXCLUDED.display_name, user_links.display_name),
                        avatar_url = COALESCE(EXCLUDED.avatar_url, user_links.avatar_url),
                        stats = COALESCE(EXCLUDED.stats, user_links.stats),
                        updated_at = CURRENT_TIMESTAMP;`,
                    [
                        userId,
                        userIdentifier,
                        item.portal,
                        item.portal_username,
                        item.link,
                        item.raw_input || item.link,
                        item.verified ?? true,
                        item.display_name || null,
                        item.avatar_url || null,
                        JSON.stringify(item.stats || []),
                    ]
                );
            }
            dbSaved = true;
        } catch (dbErr: any) {
            console.warn("Database storage warning (non-fatal):", dbErr.message || dbErr);
        }

        // Completely invalidate all platform and submission caches in Redis
        try {
            await invalidateAllUserCaches({
                id: userId,
                username: authUser.username,
                gmail: authUser.gmail,
            });

            if (redis && redis.status === "ready") {
                const cacheNames = Array.from(new Set([
                    userIdentifier,
                    authUser.username,
                    authUser.gmail,
                ].filter(Boolean))).map((s) => s.toLowerCase().trim());

                for (const u of cacheNames) {
                    await redis.set(
                        `user:portals:${u}`,
                        JSON.stringify(itemsToSave),
                        "EX",
                        60 * 60 * 24 * 7
                    );
                }
            }
        } catch {
            // Redis cache non-fatal
        }

        return res.status(200).json({
            success: true,
            message: `Successfully saved ${itemsToSave.length} portal account${itemsToSave.length === 1 ? "" : "s"}!`,
            user: {
                id: userId,
                username: userIdentifier,
            },
            saved: itemsToSave,
            count: itemsToSave.length,
            dbPersisted: dbSaved,
        });
    } catch (err: any) {
        console.error("Save portals error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to process and save portal details",
        });
    }
};

// Handle retrieving saved portal accounts
export const handleGetSavedPortals = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const username = authUser?.username || (req.query.username as string) || req.body?.username;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        // Check Redis cache first
        try {
            if (redis && redis.status === "ready") {
                const cached = await redis.get(`user:portals:${username}`);
                if (cached) {
                    const links = JSON.parse(cached);
                    return res.status(200).json({
                        success: true,
                        username,
                        links,
                        count: links.length,
                        source: "cache",
                    });
                }
            }
        } catch {
            // Fall through to DB
        }

        // Query Postgres
        const result = await query(
            `SELECT
                user_id,
                username,
                portal,
                portal_username,
                link,
                raw_input,
                verified,
                display_name,
                avatar_url,
                stats,
                last_sync_status,
                last_sync_at,
                created_at,
                updated_at
            FROM user_links
            WHERE username = $1
            ORDER BY portal ASC;`,
            [username]
        );

        return res.status(200).json({
            success: true,
            username,
            links: result.rows,
            count: result.rows.length,
            source: "database",
        });
    } catch (err: any) {
        console.error("Get portals error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve user portal links",
        });
    }
};

export interface ResyncPortalResult {
    portal: string;
    username: string;
    status: "valid" | "broken" | "error";
    verified: boolean;
    message?: string;
    profileData?: PortalProfileData;
    lastSyncAt: string;
}

// Background Platform Re-Sync endpoint
export const handleResyncPortals = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const body = req.body || {};
        const userIdentifier =
            authUser?.username ||
            authUser?.gmail ||
            body.username ||
            (req.query.username as string) ||
            null;

        let portalsToCheck: Array<{ portal: string; username: string; raw_input?: string }> = [];

        // Check if caller sent a specific list of portals (from frontend state)
        if (Array.isArray(body.portals) && body.portals.length > 0) {
            portalsToCheck = body.portals
                .map((p: any) => ({
                    portal: String(p.portal || p.id || "").toLowerCase().trim(),
                    username: String(p.username || p.portal_username || "").trim(),
                    raw_input: p.raw_input || p.link || "",
                }))
                .filter((p: any) => p.portal && p.username);
        } else if (userIdentifier) {
            // Retrieve user links from DB
            try {
                const dbRes = await query(
                    `SELECT portal, portal_username, link, raw_input, verified, last_sync_status
                     FROM user_links
                     WHERE username = $1
                     ORDER BY portal ASC;`,
                    [userIdentifier]
                );
                if (dbRes && dbRes.rows.length > 0) {
                    portalsToCheck = dbRes.rows.map((row) => ({
                        portal: row.portal,
                        username: row.portal_username,
                        raw_input: row.raw_input || row.link,
                    }));
                }
            } catch (dbErr: any) {
                console.warn("Resync DB lookup warning:", dbErr.message || dbErr);
            }

            // Fallback to Redis cache
            if (portalsToCheck.length === 0 && redis && redis.status === "ready") {
                try {
                    const cached = await redis.get(`user:portals:${userIdentifier}`);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed)) {
                            portalsToCheck = parsed
                                .map((p: any) => ({
                                    portal: String(p.portal || "").toLowerCase().trim(),
                                    username: String(p.portal_username || p.username || "").trim(),
                                    raw_input: p.raw_input || p.link || "",
                                }))
                                .filter((p: any) => p.portal && p.username);
                        }
                    }
                } catch {
                    // ignore
                }
            }
        }

        if (portalsToCheck.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No connected portals found to re-sync.",
                results: [],
                summary: { total: 0, valid: 0, broken: 0, error: 0 },
                timestamp: new Date().toISOString(),
            });
        }

        const nowIso = new Date().toISOString();

        // Check platforms in parallel with timeout safety
        const promises = portalsToCheck.map(async (item): Promise<ResyncPortalResult> => {
            try {
                const profile = await verifyAndFetchPortal(item.portal, item.username);

                if (profile && profile.success) {
                    // Live account confirmed active and valid
                    if (userIdentifier) {
                        try {
                            await query(
                                `UPDATE user_links
                                 SET verified = true,
                                     last_sync_status = 'valid',
                                     last_sync_at = CURRENT_TIMESTAMP,
                                     display_name = COALESCE($1, display_name),
                                     avatar_url = COALESCE($2, avatar_url),
                                     stats = COALESCE($3, stats),
                                     updated_at = CURRENT_TIMESTAMP
                                 WHERE username = $4 AND portal = $5;`,
                                [
                                    profile.name || null,
                                    profile.avatar || null,
                                    JSON.stringify(profile.stats || []),
                                    userIdentifier,
                                    item.portal,
                                ]
                            );
                        } catch (uErr: any) {
                            console.warn(`Resync update valid DB error for ${item.portal}:`, uErr.message);
                        }
                    }

                    return {
                        portal: item.portal,
                        username: item.username,
                        status: "valid",
                        verified: true,
                        profileData: profile,
                        lastSyncAt: nowIso,
                    };
                } else {
                    // Profile returned null: account not found / username changed / 404
                    if (userIdentifier) {
                        try {
                            await query(
                                `UPDATE user_links
                                 SET verified = false,
                                     last_sync_status = 'broken',
                                     last_sync_at = CURRENT_TIMESTAMP,
                                     updated_at = CURRENT_TIMESTAMP
                                 WHERE username = $1 AND portal = $2;`,
                                [userIdentifier, item.portal]
                            );
                        } catch (uErr: any) {
                            console.warn(`Resync update broken DB error for ${item.portal}:`, uErr.message);
                        }
                    }

                    return {
                        portal: item.portal,
                        username: item.username,
                        status: "broken",
                        verified: false,
                        message: `Account not found on ${item.portal}. The username '${item.username}' may have been changed or deleted.`,
                        lastSyncAt: nowIso,
                    };
                }
            } catch (err: any) {
                // Network error / external service timeout
                if (userIdentifier) {
                    try {
                        await query(
                            `UPDATE user_links
                             SET last_sync_status = 'error',
                                 last_sync_at = CURRENT_TIMESTAMP,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE username = $1 AND portal = $2;`,
                            [userIdentifier, item.portal]
                        );
                    } catch {
                        // ignore
                    }
                }

                return {
                    portal: item.portal,
                    username: item.username,
                    status: "error",
                    verified: false,
                    message: `Service error checking ${item.portal}: ${err?.message || "Request timed out"}`,
                    lastSyncAt: nowIso,
                };
            }
        });

        const results = await Promise.all(promises);

        // Update Redis cache if userIdentifier is present
        if (userIdentifier && redis && redis.status === "ready") {
            try {
                const dbAll = await query(
                    `SELECT portal, portal_username, link, raw_input, verified, display_name, avatar_url, stats, last_sync_status, last_sync_at
                     FROM user_links
                     WHERE username = $1
                     ORDER BY portal ASC;`,
                    [userIdentifier]
                );
                if (dbAll && dbAll.rows.length > 0) {
                    await Promise.allSettled([
                        redis.set(
                            `user:portals:${userIdentifier}`,
                            JSON.stringify(dbAll.rows),
                            "EX",
                            60 * 60 * 24 * 7
                        ),
                        redis.del(`profile:public:${userIdentifier}`),
                        redis.del(`user:submissions:unified:${userIdentifier}`),
                        redis.del(`user:development:unified:${userIdentifier}`),
                    ]);
                }
            } catch {
                // ignore
            }
        }

        const validCount = results.filter((r) => r.status === "valid").length;
        const brokenCount = results.filter((r) => r.status === "broken").length;
        const errorCount = results.filter((r) => r.status === "error").length;

        return res.status(200).json({
            success: true,
            username: userIdentifier,
            results,
            summary: {
                total: results.length,
                valid: validCount,
                broken: brokenCount,
                error: errorCount,
            },
            timestamp: nowIso,
        });
    } catch (err: any) {
        console.error("Resync endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to perform platform re-sync",
            error: err.message,
        });
    }
};

// Route mounts using authenticate middleware
portalsRouter.post("/save", authenticate, handleSavePortals);
portalsRouter.post("/profile/save", authenticate, handleSavePortals);
portalsRouter.get("/save", authenticate, handleGetSavedPortals);
portalsRouter.get("/profile/save", authenticate, handleGetSavedPortals);
portalsRouter.get("/links", authenticate, handleGetSavedPortals);

// Resync endpoints
portalsRouter.post("/resync", optionalAuthenticate, handleResyncPortals);
portalsRouter.get("/resync", optionalAuthenticate, handleResyncPortals);
portalsRouter.post("/profile/resync", optionalAuthenticate, handleResyncPortals);
portalsRouter.get("/profile/resync", optionalAuthenticate, handleResyncPortals);

// Disconnect/delete platform
portalsRouter.delete("/:portal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const portal = String(req.params.portal || "").trim().toLowerCase();

        const result = await query(
            `DELETE FROM user_links
             WHERE (
                LOWER(username) = LOWER($1)
                OR LOWER(username) = LOWER($2)
                OR user_id = $3
             ) AND LOWER(portal) = $4
             RETURNING id, portal;`,
            [authUser.username, authUser.gmail, authUser.id, portal]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: `Platform connection '${portal}' not found` });
        }

        await invalidateAllUserCaches({
            id: authUser.id,
            username: authUser.username,
            gmail: authUser.gmail,
        });

        return res.status(200).json({
            success: true,
            message: `Platform '${portal}' disconnected successfully`,
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Error disconnecting platform", error: err.message });
    }
});

// Edit platform handle
portalsRouter.put("/:portal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const portal = String(req.params.portal || "").trim().toLowerCase();
        const { handle, link } = req.body;

        const rawCandidate = handle || link;
        if (!rawCandidate) {
            return res.status(400).json({ success: false, message: "Handle or link is required" });
        }

        const cleanHandle = extractPortalUsername(portal, rawCandidate) || rawCandidate.trim();
        const verifiedData = await verifyAndFetchPortal(portal, cleanHandle);

        const finalHandle = verifiedData?.username || cleanHandle;
        const finalLink = verifiedData?.profileUrl || link || buildPortalLink(portal, cleanHandle);
        const finalDisplayName = verifiedData?.name || authUser.firstName;
        const finalAvatar = verifiedData?.avatar || null;
        const finalStats = verifiedData?.stats || [];
        const isVerified = verifiedData ? verifiedData.verified !== false : true;

        const updateResult = await query(
            `UPDATE user_links
             SET portal_username = $1,
                 link = $2,
                 raw_input = $3,
                 verified = $4,
                 display_name = $5,
                 avatar_url = $6,
                 stats = $7::jsonb,
                 last_sync_status = 'valid',
                 last_sync_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE (username = $8 OR username = $9) AND LOWER(portal) = $10
             RETURNING id, portal, portal_username AS "portalUsername", link, verified, is_public AS "isPublic";`,
            [finalHandle, finalLink, rawCandidate, isVerified, finalDisplayName, finalAvatar, JSON.stringify(finalStats), authUser.username, authUser.gmail, portal]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: `Platform connection '${portal}' not found` });
        }

        await invalidateAllUserCaches({
            id: authUser.id,
            username: authUser.username,
            gmail: authUser.gmail,
        });

        return res.status(200).json({
            success: true,
            message: `Platform '${portal}' updated successfully`,
            platform: updateResult.rows[0],
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Error updating platform", error: err.message });
    }
});

export default portalsRouter;

