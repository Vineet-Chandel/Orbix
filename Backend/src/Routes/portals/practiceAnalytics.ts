import { query } from "../../database/client.js";
import { calculateUserContestPerformance } from "./contestAnalytics.js";

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

export interface PracticeChartBucket {
    key: string;
    label: string;
    easy: number;
    medium: number;
    hard: number;
    noLevel: number;
    total: number;
}

export interface PracticeTrendsData {
    last7Days: number;
    last30Days: number;
    last12Months: number;
    monthSoFar: {
        monthName: string;
        problemsSolved: number;
        problemsSolvedDelta: string;
        activeDays: number;
        activeDaysDelta: string;
        hardProblems: number;
        hardProblemsDelta: string;
        contests: number;
        contestsDelta: string;
        bestDay: {
            dayLabel: string;
            problemsCount: number;
            text: string;
        };
        ratingChanges: string;
        whereYouSolved: string;
        topicsPracticedMost: Array<{ topic: string; count: number }>;
    };
    weeklyChart: PracticeChartBucket[];
    monthlyChart: PracticeChartBucket[];
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
    trends?: PracticeTrendsData;
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
    let portalRows: Array<{ portal: string; portal_username: string; stats?: any }> = [];
    try {
        const res = await query(
            `SELECT portal, portal_username, stats
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
    const leetCodeCalendarMap: Record<string, number> = {};
    const dailyDifficultyMap: Record<string, { easy: number; medium: number; hard: number; noLevel: number; total: number; platforms: Record<string, number> }> = {};

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
                            userCalendar {
                                submissionCalendar
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
                const rawCalendar = user?.userCalendar?.submissionCalendar;
                if (rawCalendar) {
                    try {
                        const parsedCal = typeof rawCalendar === "string" ? JSON.parse(rawCalendar) : rawCalendar;
                        for (const [tsKey, countVal] of Object.entries(parsedCal)) {
                            const tsNum = parseInt(tsKey, 10);
                            if (!isNaN(tsNum)) {
                                const dStr = new Date(tsNum * 1000).toISOString().split("T")[0];
                                if (dStr) {
                                    leetCodeCalendarMap[dStr] = (leetCodeCalendarMap[dStr] || 0) + (typeof countVal === "number" ? countVal : parseInt(String(countVal), 10) || 0);
                                }
                            }
                        }
                    } catch {}
                }

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

                        if (sub.creationTimeSeconds) {
                            const dStr = new Date(sub.creationTimeSeconds * 1000).toISOString().split("T")[0];
                            if (dStr) {
                                if (!dailyDifficultyMap[dStr]) {
                                    dailyDifficultyMap[dStr] = { easy: 0, medium: 0, hard: 0, noLevel: 0, total: 0, platforms: {} };
                                }
                                const entry = dailyDifficultyMap[dStr]!;
                                entry.total += 1;
                                entry.platforms["codeforces"] = (entry.platforms["codeforces"] || 0) + 1;
                                if (r < 1200) entry.easy += 1;
                                else if (r <= 1800) entry.medium += 1;
                                else entry.hard += 1;
                            }
                        }

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

    // Platform breakdown array
    const platformBreakdown: PlatformProblemCount[] = [];
    if (portalsMap["leetcode"] || leetCodeTotal > 0) {
        platformBreakdown.push({
            portal: "leetcode",
            platformName: "LeetCode",
            count: leetCodeTotal,
            percentage: 0,
        });
    }
    if (portalsMap["codechef"] || codechefTotal > 0) {
        platformBreakdown.push({
            portal: "codechef",
            platformName: "CodeChef",
            count: codechefTotal,
            percentage: 0,
        });
    }
    if (portalsMap["codeforces"] || codeforcesTotal > 0) {
        platformBreakdown.push({
            portal: "codeforces",
            platformName: "Codeforces",
            count: codeforcesTotal,
            percentage: 0,
        });
    }

    // Extra connected platforms from database stats
    let extraSolvedTotal = 0;
    for (const r of portalRows) {
        const p = (r.portal || "").toLowerCase().trim();
        if (p === "leetcode" || p === "codechef" || p === "codeforces" || p === "github") continue;
        let count = 0;
        if (Array.isArray(r.stats)) {
            for (const s of r.stats) {
                if (s.label === "solved" || (typeof s.value === "string" && s.value.includes("solved"))) {
                    const m = String(s.value).match(/(\d+)/);
                    if (m && m[1]) count = parseInt(m[1], 10);
                }
            }
        }
        if (count > 0) {
            extraSolvedTotal += count;
            platformBreakdown.push({
                portal: p,
                platformName: PLATFORM_NAMES[p] || (p.charAt(0).toUpperCase() + p.slice(1)),
                count,
                percentage: 0,
            });
        }
    }

    // Difficulty Aggregation
    const easyCount = leetCodeEasy + codeforcesEasy;
    const mediumCount = leetCodeMedium + codeforcesMedium;
    const hardCount = leetCodeHard + codeforcesHard;
    const donutTotal = easyCount + mediumCount + hardCount;

    // Overall total solved across all connected platforms
    const totalSolved = leetCodeTotal + codechefTotal + codeforcesTotal + extraSolvedTotal;

    for (const pb of platformBreakdown) {
        pb.percentage = totalSolved > 0 ? Math.round((pb.count / totalSolved) * 100) : 0;
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

    // Merge LeetCode calendar into dailyDifficultyMap
    const sumLcDiff = (leetCodeEasy + leetCodeMedium + leetCodeHard) || 1;
    for (const [dStr, count] of Object.entries(leetCodeCalendarMap)) {
        if (count > 0) {
            if (!dailyDifficultyMap[dStr]) {
                dailyDifficultyMap[dStr] = { easy: 0, medium: 0, hard: 0, noLevel: 0, total: 0, platforms: {} };
            }
            const entry = dailyDifficultyMap[dStr]!;
            entry.total += count;
            entry.platforms["leetcode"] = (entry.platforms["leetcode"] || 0) + count;
            const eCount = Math.round(count * (leetCodeEasy / sumLcDiff));
            const mCount = Math.round(count * (leetCodeMedium / sumLcDiff));
            const hCount = Math.max(0, count - eCount - mCount);
            entry.easy += eCount;
            entry.medium += mCount;
            entry.hard += hCount;
        }
    }

    // --- Compute Practice Trends Block (Matching Screenshot) ---
    const now = new Date();
    const nowTs = now.getTime();
    const ms7d = 7 * 86400000;
    const ms30d = 30 * 86400000;
    const ms365d = 365 * 86400000;

    let last7Days = 0;
    let last30Days = 0;
    let last12Months = 0;

    for (const [dateStr, entry] of Object.entries(dailyDifficultyMap)) {
        const dTime = new Date(dateStr).getTime();
        if (dTime >= nowTs - ms7d) last7Days += entry.total;
        if (dTime >= nowTs - ms30d) last30Days += entry.total;
        if (dTime >= nowTs - ms365d) last12Months += entry.total;
    }

    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const curMonthPrefix = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;

    const prevYear = curMonth === 0 ? curYear - 1 : curYear;
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevMonthPrefix = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

    let curMonthSolved = 0;
    let curMonthActiveDays = 0;
    let curMonthHard = 0;
    const curMonthPlatforms: Record<string, number> = {};
    let bestDayDate = "";
    let bestDayCount = 0;

    let prevMonthSolved = 0;
    let prevMonthActiveDays = 0;
    let prevMonthHard = 0;

    for (const [dateStr, entry] of Object.entries(dailyDifficultyMap)) {
        if (dateStr.startsWith(curMonthPrefix)) {
            curMonthSolved += entry.total;
            if (entry.total > 0) curMonthActiveDays++;
            curMonthHard += entry.hard;
            for (const [p, c] of Object.entries(entry.platforms)) {
                curMonthPlatforms[p] = (curMonthPlatforms[p] || 0) + c;
            }
            if (entry.total > bestDayCount) {
                bestDayCount = entry.total;
                bestDayDate = dateStr;
            }
        } else if (dateStr.startsWith(prevMonthPrefix)) {
            prevMonthSolved += entry.total;
            if (entry.total > 0) prevMonthActiveDays++;
            prevMonthHard += entry.hard;
        }
    }

    // Query contests in this month and last month
    let contestsThisMonth = 0;
    let contestsLastMonth = 0;
    let ratingChangeThisMonth = 0;
    try {
        const contestResult = await calculateUserContestPerformance(cleanUser, clientPortals);
        if (contestResult?.recentContests) {
            for (const c of contestResult.recentContests) {
                const ts = c.timestamp > 1e11 ? c.timestamp : c.timestamp * 1000;
                const cDate = new Date(ts);
                if (cDate.getFullYear() === curYear && cDate.getMonth() === curMonth) {
                    contestsThisMonth++;
                    if (typeof c.ratingChange === "number") {
                        ratingChangeThisMonth += c.ratingChange;
                    }
                } else if (cDate.getFullYear() === prevYear && cDate.getMonth() === prevMonth) {
                    contestsLastMonth++;
                }
            }
        }
    } catch {
        // Non-fatal
    }

    const formatDeltaText = (cur: number, prev: number) => {
        const diff = cur - prev;
        if (diff > 0) return `↗ ${diff} more than last month`;
        if (diff < 0) return `↘ ${Math.abs(diff)} less than last month`;
        return "same as last month";
    };

    let bestDayText = "No problems solved yet";
    let bestDayLabel = "—";
    if (bestDayDate && bestDayCount > 0) {
        const bd = new Date(bestDayDate);
        bestDayLabel = `${bd.getDate()} ${bd.toLocaleDateString("en-US", { month: "short" })}`;
        bestDayText = `${bestDayLabel} with ${bestDayCount} ${bestDayCount === 1 ? "problem" : "problems"}`;
    }

    let ratingChangesText = "No rated contests";
    if (contestsThisMonth > 0) {
        ratingChangesText = ratingChangeThisMonth >= 0
            ? `+${ratingChangeThisMonth} in ${contestsThisMonth} ${contestsThisMonth === 1 ? "contest" : "contests"}`
            : `${ratingChangeThisMonth} in ${contestsThisMonth} ${contestsThisMonth === 1 ? "contest" : "contests"}`;
    }

    const whereSolvedEntries = Object.entries(curMonthPlatforms)
        .filter(([_, c]) => c > 0)
        .map(([p, c]) => `${PLATFORM_NAMES[p] || p.charAt(0).toUpperCase() + p.slice(1)} ${c}`);
    const whereYouSolvedText = whereSolvedEntries.length > 0 ? whereSolvedEntries.join(", ") : (curMonthSolved > 0 ? `LeetCode ${curMonthSolved}` : "None");

    const topicsPracticedMost = topDsaTopicsList.slice(0, 6).map((t) => ({
        topic: t.topic,
        count: Math.max(1, Math.min(curMonthSolved || 15, Math.round(t.count / 20) || t.count)),
    }));

    // Generate Weekly Chart (last 26 weeks ending on current week)
    const weeklyChart: PracticeChartBucket[] = [];
    const currentMonday = new Date(now);
    const dayOfWeek = currentMonday.getDay();
    const distToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentMonday.setDate(currentMonday.getDate() - distToMonday);
    currentMonday.setHours(0, 0, 0, 0);

    for (let w = 25; w >= 0; w--) {
        const weekStart = new Date(currentMonday);
        weekStart.setDate(weekStart.getDate() - w * 7);

        let wEasy = 0, wMed = 0, wHard = 0, wNoLevel = 0, wTotal = 0;
        for (let d = 0; d < 7; d++) {
            const checkD = new Date(weekStart);
            checkD.setDate(checkD.getDate() + d);
            const dStr = checkD.toISOString().split("T")[0] || "";
            const entry = dailyDifficultyMap[dStr];
            if (entry) {
                wEasy += entry.easy;
                wMed += entry.medium;
                wHard += entry.hard;
                wNoLevel += entry.noLevel;
                wTotal += entry.total;
            }
        }

        const dateNum = weekStart.getDate();
        const monShort = weekStart.toLocaleDateString("en-US", { month: "short" });
        weeklyChart.push({
            key: weekStart.toISOString().split("T")[0] || "",
            label: `${dateNum} ${monShort}`,
            easy: wEasy,
            medium: wMed,
            hard: wHard,
            noLevel: wNoLevel,
            total: wTotal,
        });
    }

    // Generate Monthly Chart (last 12 months)
    const monthlyChart: PracticeChartBucket[] = [];
    for (let m = 11; m >= 0; m--) {
        const mDate = new Date(curYear, curMonth - m, 1);
        const y = mDate.getFullYear();
        const mo = mDate.getMonth();
        const mPrefix = `${y}-${String(mo + 1).padStart(2, "0")}`;

        let mEasy = 0, mMed = 0, mHard = 0, mNoLevel = 0, mTotal = 0;
        for (const [dStr, entry] of Object.entries(dailyDifficultyMap)) {
            if (dStr.startsWith(mPrefix)) {
                mEasy += entry.easy;
                mMed += entry.medium;
                mHard += entry.hard;
                mNoLevel += entry.noLevel;
                mTotal += entry.total;
            }
        }

        monthlyChart.push({
            key: mPrefix,
            label: mDate.toLocaleDateString("en-US", { month: "short" }),
            easy: mEasy,
            medium: mMed,
            hard: mHard,
            noLevel: mNoLevel,
            total: mTotal,
        });
    }

    const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);

    const trends: PracticeTrendsData = {
        last7Days,
        last30Days,
        last12Months,
        monthSoFar: {
            monthName: `${monthName} so far`,
            problemsSolved: curMonthSolved,
            problemsSolvedDelta: formatDeltaText(curMonthSolved, prevMonthSolved),
            activeDays: curMonthActiveDays,
            activeDaysDelta: formatDeltaText(curMonthActiveDays, prevMonthActiveDays),
            hardProblems: curMonthHard,
            hardProblemsDelta: formatDeltaText(curMonthHard, prevMonthHard),
            contests: contestsThisMonth,
            contestsDelta: formatDeltaText(contestsThisMonth, contestsLastMonth),
            bestDay: {
                dayLabel: bestDayLabel,
                problemsCount: bestDayCount,
                text: bestDayText,
            },
            ratingChanges: ratingChangesText,
            whereYouSolved: whereYouSolvedText,
            topicsPracticedMost,
        },
        weeklyChart,
        monthlyChart,
    };

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
        trends,
        timestamp: new Date().toISOString(),
    };
}
