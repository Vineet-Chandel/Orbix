import { query } from "../../database/client.js";

export interface DifficultyBreakdown {
    easy: number;
    medium: number;
    hard: number;
    total: number;
}

export interface PlatformProblemCount {
    portal: string;
    platformName: string;
    count: number;
    percentage: number;
}

export interface RecentSolveItem {
    id: string;
    title: string;
    portal: string;
    platformName: string;
    timestamp: number;
    solvedAt: string;
    url: string;
    relativeTime: string;
}

export interface DsaTopicItem {
    topic: string;
    count: number;
    percentage: number;
}

export interface TopicStrengthItem {
    topic: string;
    axisLabel: string;
    score: number; // 0 - 100
    count: number;
}

export interface PracticeAnalyticsData {
    success: boolean;
    username: string;
    totalSolved: number;
    donutTotal: number;
    difficulty: DifficultyBreakdown;
    platformBreakdown: PlatformProblemCount[];
    recentlySolved: RecentSolveItem[];
    dsaTopics: DsaTopicItem[];
    topicStrength: TopicStrengthItem[];
    timestamp: string;
}

function formatRelativeTime(timestampSeconds: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - timestampSeconds);

    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / 86400);

    if (days >= 30) {
        const months = Math.floor(days / 30);
        return `${months}mo ago`;
    }
    if (days >= 1) {
        return `${days}d ago`;
    }
    if (hours >= 1) {
        return `${hours}h ago`;
    }
    if (minutes >= 1) {
        return `${minutes}m ago`;
    }
    return "just now";
}

const PLATFORM_NAMES: Record<string, string> = {
    leetcode: "LeetCode",
    codechef: "CodeChef",
    codeforces: "Codeforces",
    hackerrank: "HackerRank",
    geeksforgeeks: "GeeksforGeeks",
    atcoder: "AtCoder",
    spoj: "SPOJ",
};

/**
 * Calculates verified problem solving metrics, difficulty distribution,
 * recent problem history, DSA topic breakdown, and topic radar strength across connected accounts.
 */
export async function calculateUserPracticeAnalytics(
    username: string,
    clientPortals?: Record<string, any>
): Promise<PracticeAnalyticsData> {
    const cleanUser = (username || "").trim();
    if (!cleanUser) {
        return {
            success: false,
            username: "",
            totalSolved: 0,
            donutTotal: 0,
            difficulty: { easy: 0, medium: 0, hard: 0, total: 0 },
            platformBreakdown: [],
            recentlySolved: [],
            dsaTopics: [],
            topicStrength: [],
            timestamp: new Date().toISOString(),
        };
    }

    // 1. Resolve connected portals from Database with clientPortals fallback
    let portalRows: Array<{ portal: string; portal_username: string }> = [];
    try {
        const res = await query(
            `SELECT portal, portal_username
             FROM user_links
             WHERE LOWER(username) = LOWER($1)
             ORDER BY id ASC;`,
            [cleanUser]
        );
        portalRows = res.rows || [];
    } catch {
        // Safe fallback
    }

    const portalsMap: Record<string, string> = {};
    for (const r of portalRows) {
        const p = (r.portal || "").toLowerCase().trim();
        const u = (r.portal_username || "").trim();
        if (p && u) portalsMap[p] = u;
    }

    // Merge client portals if provided
    if (clientPortals && typeof clientPortals === "object") {
        for (const [k, v] of Object.entries(clientPortals)) {
            const p = k.toLowerCase().trim();
            if (p.startsWith("_") || p === "theme" || p === "github") continue;
            const u = (typeof v === "object" ? v?.username || v?.portal_username || "" : String(v || "")).trim();
            if (p && u) portalsMap[p] = u;
        }
    }

    let leetCodeEasy = 0;
    let leetCodeMedium = 0;
    let leetCodeHard = 0;
    let leetCodeTotal = 0;
    const leetCodeTopicCounts: Record<string, number> = {};
    const recentSubmissionsList: RecentSolveItem[] = [];

    // 2. Fetch LeetCode Data
    const lcUsername = portalsMap["leetcode"];
    if (lcUsername) {
        try {
            const lcRes = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                },
                body: JSON.stringify({
                    query: `query userPracticeDetails($username: String!) {
                        matchedUser(username: $username) {
                            submitStatsGlobal {
                                acSubmissionNum {
                                    difficulty
                                    count
                                }
                            }
                            tagProblemCounts {
                                advanced { tagName tagSlug problemsSolved }
                                intermediate { tagName tagSlug problemsSolved }
                                fundamental { tagName tagSlug problemsSolved }
                            }
                        }
                        recentAcSubmissionList(username: $username, limit: 15) {
                            id
                            title
                            titleSlug
                            timestamp
                        }
                    }`,
                    variables: { username: lcUsername },
                }),
                signal: AbortSignal.timeout(6000),
            });

            if (lcRes.ok) {
                const lcData = (await lcRes.json()) as any;
                const user = lcData?.data?.matchedUser;
                const acList = user?.submitStatsGlobal?.acSubmissionNum || [];

                for (const ac of acList) {
                    if (ac.difficulty === "Easy") leetCodeEasy = ac.count || 0;
                    if (ac.difficulty === "Medium") leetCodeMedium = ac.count || 0;
                    if (ac.difficulty === "Hard") leetCodeHard = ac.count || 0;
                    if (ac.difficulty === "All") leetCodeTotal = ac.count || 0;
                }
                if (leetCodeTotal === 0) {
                    leetCodeTotal = leetCodeEasy + leetCodeMedium + leetCodeHard;
                }

                // Tag counts
                const tags = user?.tagProblemCounts;
                if (tags) {
                    const allTags = [
                        ...(tags.fundamental || []),
                        ...(tags.intermediate || []),
                        ...(tags.advanced || []),
                    ];
                    for (const t of allTags) {
                        if (t && t.tagName && typeof t.problemsSolved === "number") {
                            leetCodeTopicCounts[t.tagName] = (leetCodeTopicCounts[t.tagName] || 0) + t.problemsSolved;
                        }
                    }
                }

                // Recent AC solves
                const rawRecent = lcData?.data?.recentAcSubmissionList || [];
                const seenSlugs = new Set<string>();
                for (const item of rawRecent) {
                    if (!item || !item.title) continue;
                    const slug = (item.titleSlug || "").toLowerCase();
                    if (seenSlugs.has(slug)) continue;
                    seenSlugs.add(slug);

                    const ts = parseInt(item.timestamp, 10) || Math.floor(Date.now() / 1000);
                    recentSubmissionsList.push({
                        id: `leetcode-${item.id || slug}`,
                        title: item.title,
                        portal: "leetcode",
                        platformName: "LeetCode",
                        timestamp: ts,
                        solvedAt: new Date(ts * 1000).toISOString(),
                        url: `https://leetcode.com/problems/${slug}/`,
                        relativeTime: formatRelativeTime(ts),
                    });
                }
            }
        } catch (lcErr) {
            console.warn("LeetCode practice analytics fetch warning:", lcErr);
        }
    }

    // 3. Fetch Codeforces Data
    const cfUsername = portalsMap["codeforces"];
    let codeforcesEasy = 0;
    let codeforcesMedium = 0;
    let codeforcesHard = 0;
    let codeforcesTotal = 0;
    const cfTagCounts: Record<string, number> = {};

    if (cfUsername) {
        try {
            const cfRes = await fetch(
                `https://codeforces.com/api/user.status?handle=${encodeURIComponent(cfUsername)}&from=1&count=1000`,
                { signal: AbortSignal.timeout(6000) }
            );
            if (cfRes.ok) {
                const cfData = (await cfRes.json()) as any;
                if (cfData.status === "OK" && Array.isArray(cfData.result)) {
                    const seenProblems = new Set<string>();
                    for (const sub of cfData.result) {
                        if (sub.verdict !== "OK" || !sub.problem) continue;
                        const pId = `${sub.problem.contestId || ""}-${sub.problem.index || ""}`;
                        if (seenProblems.has(pId)) continue;
                        seenProblems.add(pId);

                        const r = sub.problem.rating || 800;
                        if (r < 1200) codeforcesEasy++;
                        else if (r <= 1800) codeforcesMedium++;
                        else codeforcesHard++;

                        // Map Codeforces tags
                        for (const tag of sub.problem.tags || []) {
                            cfTagCounts[tag] = (cfTagCounts[tag] || 0) + 1;
                        }

                        // Add to recent solves if within latest 10
                        if (recentSubmissionsList.length < 15 && sub.creationTimeSeconds) {
                            recentSubmissionsList.push({
                                id: `codeforces-${pId}`,
                                title: sub.problem.name || pId,
                                portal: "codeforces",
                                platformName: "Codeforces",
                                timestamp: sub.creationTimeSeconds,
                                solvedAt: new Date(sub.creationTimeSeconds * 1000).toISOString(),
                                url: sub.problem.contestId
                                    ? `https://codeforces.com/contest/${sub.problem.contestId}/problem/${sub.problem.index}`
                                    : "https://codeforces.com",
                                relativeTime: formatRelativeTime(sub.creationTimeSeconds),
                            });
                        }
                    }
                    codeforcesTotal = seenProblems.size;
                }
            }
        } catch (cfErr) {
            console.warn("Codeforces practice analytics fetch warning:", cfErr);
        }
    }

    // 4. Fetch CodeChef Data
    const ccUsername = portalsMap["codechef"];
    let codechefTotal = 0;
    if (ccUsername) {
        try {
            const ccRes = await fetch(`https://codechef-api.vercel.app/handle/${encodeURIComponent(ccUsername)}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (ccRes.ok) {
                const ccData = (await ccRes.json()) as any;
                const solvedCount = ccData?.totalSolved || ccData?.fullySolved?.count || 0;
                if (typeof solvedCount === "number" && solvedCount > 0) {
                    codechefTotal = solvedCount;
                }
            }
        } catch {
            // Non-fatal
        }
    }

    // Difficulty Aggregation
    const easyCount = leetCodeEasy + codeforcesEasy;
    const mediumCount = leetCodeMedium + codeforcesMedium;
    const hardCount = leetCodeHard + codeforcesHard;
    const donutTotal = easyCount + mediumCount + hardCount;

    // Overall total solved across all connected platforms
    const totalSolved = leetCodeTotal + codechefTotal + codeforcesTotal;

    // Platform breakdown array
    const platformBreakdown: PlatformProblemCount[] = [];
    if (portalsMap["leetcode"] || leetCodeTotal > 0) {
        platformBreakdown.push({
            portal: "leetcode",
            platformName: "LeetCode",
            count: leetCodeTotal,
            percentage: totalSolved > 0 ? Math.round((leetCodeTotal / totalSolved) * 100) : 0,
        });
    }
    if (portalsMap["codechef"] || codechefTotal > 0) {
        platformBreakdown.push({
            portal: "codechef",
            platformName: "CodeChef",
            count: codechefTotal,
            percentage: totalSolved > 0 ? Math.round((codechefTotal / totalSolved) * 100) : 0,
        });
    }
    if (portalsMap["codeforces"] || codeforcesTotal > 0) {
        platformBreakdown.push({
            portal: "codeforces",
            platformName: "Codeforces",
            count: codeforcesTotal,
            percentage: totalSolved > 0 ? Math.round((codeforcesTotal / totalSolved) * 100) : 0,
        });
    }

    // Ensure sorted descending
    platformBreakdown.sort((a, b) => b.count - a.count);

    // Sort recent submissions strictly chronological (newest first)
    recentSubmissionsList.sort((a, b) => b.timestamp - a.timestamp);
    const deduplicatedRecentSolves: RecentSolveItem[] = [];
    const seenRecentTitles = new Set<string>();
    for (const item of recentSubmissionsList) {
        const k = item.title.toLowerCase().trim();
        if (!seenRecentTitles.has(k)) {
            seenRecentTitles.add(k);
            deduplicatedRecentSolves.push(item);
        }
    }

    // Dynamic DSA Topics (LeetCode + Codeforces)
    const cfTagMapping: Record<string, string> = {
        "strings": "String",
        "math": "Math",
        "dp": "Dynamic Programming",
        "sortings": "Sorting",
        "greedy": "Greedy",
        "dfs and similar": "Depth-First Search",
        "binary search": "Binary Search",
        "graphs": "Graph",
        "trees": "Tree",
        "data structures": "Data Structures",
        "two pointers": "Two Pointers",
        "implementation": "Implementation",
        "brute force": "Brute Force",
        "number theory": "Math",
        "combinatorics": "Math",
        "geometry": "Geometry",
        "bitmasks": "Bit Manipulation",
    };

    const mergedTopics: Record<string, number> = {};
    for (const [tag, count] of Object.entries(leetCodeTopicCounts)) {
        if (count > 0) {
            mergedTopics[tag] = (mergedTopics[tag] || 0) + count;
        }
    }
    for (const [cfTag, count] of Object.entries(cfTagCounts)) {
        if (count > 0) {
            const mapped = cfTagMapping[cfTag.toLowerCase()] || cfTag;
            mergedTopics[mapped] = (mergedTopics[mapped] || 0) + count;
        }
    }

    const maxTopicCount = Math.max(...Object.values(mergedTopics), 1);
    const topDsaTopicsList: DsaTopicItem[] = Object.entries(mergedTopics)
        .map(([topic, count]) => ({
            topic,
            count,
            percentage: Math.min(100, Math.round((count / maxTopicCount) * 100)),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Topic Strength for Radar / Spider Chart (6 Key Pillars)
    const RADAR_PILLARS = [
        { topic: "Array", axisLabel: "Array" },
        { topic: "String", axisLabel: "String" },
        { topic: "Hash Table", axisLabel: "Hash Table" },
        { topic: "Math", axisLabel: "Math" },
        { topic: "Dynamic Programming", axisLabel: "DP" },
        { topic: "Sorting", axisLabel: "Sorting" },
    ];
    const topicStrength: TopicStrengthItem[] = RADAR_PILLARS.map(({ topic, axisLabel }) => {
        const count = mergedTopics[topic] || 0;
        const score = count > 0 ? Math.min(100, Math.max(15, Math.round((count / maxTopicCount) * 100))) : 0;
        return {
            topic,
            axisLabel,
            score,
            count,
        };
    });

    return {
        success: true,
        username: cleanUser,
        totalSolved,
        donutTotal,
        difficulty: {
            easy: easyCount,
            medium: mediumCount,
            hard: hardCount,
            total: donutTotal,
        },
        platformBreakdown,
        recentlySolved: deduplicatedRecentSolves.slice(0, 10),
        dsaTopics: topDsaTopicsList,
        topicStrength,
        timestamp: new Date().toISOString(),
    };
}
