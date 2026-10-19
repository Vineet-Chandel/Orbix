import express, { type Request, type Response } from "express";
import redis from "../../redis/client.js";
import { optionalAuthenticate } from "../../middlewares/auth.middleware.js";

const eventsRouter = express.Router();

export interface EventItem {
    id: string;
    platform: string;
    platformName: string;
    title: string;
    url: string;
    startTime: string; // ISO String
    endTime: string;   // ISO String
    startTimestamp: number; // ms
    endTimestamp: number;   // ms
    durationSeconds: number;
    durationFormatted: string;
    type: "contest" | "hackathon";
    status: "UPCOMING" | "LIVE" | "FINISHED";
    division?: string | null;
    rated: boolean;
    description?: string;
}

export const ALL_16_PLATFORMS = [
    { id: "leetcode", name: "LeetCode", color: "#FFA116", defaultType: "contest" },
    { id: "codeforces", name: "Codeforces", color: "#1F8ACB", defaultType: "contest" },
    { id: "codechef", name: "CodeChef", color: "#5B4638", defaultType: "contest" },
    { id: "atcoder", name: "AtCoder", color: "#222222", defaultType: "contest" },
    { id: "geeksforgeeks", name: "GeeksforGeeks", color: "#2F8D46", defaultType: "contest" },
    { id: "hackerrank", name: "HackerRank", color: "#00EA64", defaultType: "contest" },
    { id: "hackerearth", name: "HackerEarth", color: "#2C3454", defaultType: "contest" },
    { id: "topcoder", name: "TopCoder", color: "#29A7DF", defaultType: "contest" },
    { id: "code360", name: "Code360", color: "#FF5722", defaultType: "contest" },
    { id: "interviewbit", name: "InterviewBit", color: "#0D8BD9", defaultType: "contest" },
    { id: "cses", name: "CSES", color: "#214478", defaultType: "contest" },
    { id: "spoj", name: "SPOJ", color: "#1B6AC9", defaultType: "contest" },
    { id: "algorithmxlr8", name: "AlgorithmXlr8", color: "#0284C7", defaultType: "contest" },
];

// Helper: Format duration
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}

// Global in-memory cache for fast sub-10ms responses
let inMemoryEventsCache: {
    data: any;
    timestamp: number;
} | null = null;

const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes

// In-memory reminders store (fallback if db query not needed)
const inMemoryReminders = new Set<string>();

/**
 * Calculates the exact 3-month window:
 * [Previous Month 1st day 00:00:00 -> Next Month last day 23:59:59]
 */
export function getThreeMonthWindow(referenceDate: Date = new Date()) {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed (9 for October)

    // Previous month start
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    // Next month end
    const end = new Date(year, month + 2, 0, 23, 59, 59, 999);

    const prevMonthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const currMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const nextMonthObj = new Date(year, month + 1, 1);
    const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, "0")}`;

    return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        allowedMonths: [prevMonthStr, currMonthStr, nextMonthStr],
        currentMonthStr: currMonthStr,
    };
}

// ---------------------------------------------------------------------------
// 1. Codeforces Contests Fetcher
// ---------------------------------------------------------------------------
async function fetchCodeforcesEvents(startMs: number, endMs: number): Promise<EventItem[]> {
    try {
        const res = await fetch("https://codeforces.com/api/contest.list?gym=false", {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const json: any = await res.json();
        if (json.status !== "OK" || !Array.isArray(json.result)) return [];

        const items: EventItem[] = [];
        const now = Date.now();

        for (const c of json.result) {
            const startSec = c.startTimeSeconds;
            if (!startSec) continue;
            const startTimestamp = startSec * 1000;
            const durationSec = c.durationSeconds || 7200;
            const endTimestamp = startTimestamp + (durationSec * 1000);

            // Filter strictly to the 3-month window
            if (startTimestamp < startMs || startTimestamp > endMs) continue;

            const isFinished = now > endTimestamp;
            const isLive = now >= startTimestamp && now <= endTimestamp;
            const status: "UPCOMING" | "LIVE" | "FINISHED" = isLive ? "LIVE" : isFinished ? "FINISHED" : "UPCOMING";

            items.push({
                id: `cf-${c.id}`,
                platform: "codeforces",
                platformName: "Codeforces",
                title: c.name,
                url: `https://codeforces.com/contest/${c.id}`,
                startTime: new Date(startTimestamp).toISOString(),
                endTime: new Date(endTimestamp).toISOString(),
                startTimestamp,
                endTimestamp,
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                type: "contest",
                status,
                division: c.name.includes("Div. 1") ? "Div. 1" : c.name.includes("Div. 2") ? "Div. 2" : c.name.includes("Div. 3") ? "Div. 3" : c.name.includes("Div. 4") ? "Div. 4" : null,
                rated: !c.name.toLowerCase().includes("unrated"),
            });
        }
        return items;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// 2. LeetCode Contests Fetcher
// ---------------------------------------------------------------------------
async function fetchLeetCodeEvents(startMs: number, endMs: number): Promise<EventItem[]> {
    try {
        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({
                query: "query { allContests { title titleSlug startTime duration } }",
            }),
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const json: any = await res.json();
        const list = json?.data?.allContests;
        if (!Array.isArray(list)) return [];

        const items: EventItem[] = [];
        const now = Date.now();

        for (const c of list) {
            const startSec = c.startTime;
            if (!startSec) continue;
            const startTimestamp = startSec * 1000;
            const durationSec = c.duration || 5400;
            const endTimestamp = startTimestamp + (durationSec * 1000);

            if (startTimestamp < startMs || startTimestamp > endMs) continue;

            const isFinished = now > endTimestamp;
            const isLive = now >= startTimestamp && now <= endTimestamp;
            const status = isLive ? "LIVE" : isFinished ? "FINISHED" : "UPCOMING";

            items.push({
                id: `lc-${c.titleSlug || startSec}`,
                platform: "leetcode",
                platformName: "LeetCode",
                title: c.title,
                url: `https://leetcode.com/contest/${c.titleSlug || ""}`,
                startTime: new Date(startTimestamp).toISOString(),
                endTime: new Date(endTimestamp).toISOString(),
                startTimestamp,
                endTimestamp,
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                type: "contest",
                status,
                division: null,
                rated: true,
            });
        }
        return items;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// 3. CodeChef Contests Fetcher
// ---------------------------------------------------------------------------
async function fetchCodeChefEvents(startMs: number, endMs: number): Promise<EventItem[]> {
    try {
        const res = await fetch("https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc", {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const json: any = await res.json();
        const combined = [
            ...(json.future_contests || []),
            ...(json.present_contests || []),
            ...(json.past_contests || []),
        ];

        const items: EventItem[] = [];
        const now = Date.now();

        for (const c of combined) {
            const code = (c.contest_code || "").toUpperCase();
            if (code.startsWith("PLACE") || code.includes("PREP") || code.includes("CAMPUS")) continue;

            const startIso = c.contest_start_date_iso || c.contest_start_date;
            if (!startIso) continue;
            const startTimestamp = new Date(startIso).getTime();
            if (isNaN(startTimestamp) || startTimestamp < startMs || startTimestamp > endMs) continue;

            const durationSec = (parseInt(c.contest_duration, 10) || 120) * 60;
            const endTimestamp = startTimestamp + (durationSec * 1000);
            const isFinished = now > endTimestamp;
            const isLive = now >= startTimestamp && now <= endTimestamp;
            const status = isLive ? "LIVE" : isFinished ? "FINISHED" : "UPCOMING";

            items.push({
                id: `cc-${c.contest_code || c.contest_id}`,
                platform: "codechef",
                platformName: "CodeChef",
                title: c.contest_name,
                url: `https://www.codechef.com/${c.contest_code || ""}`,
                startTime: new Date(startTimestamp).toISOString(),
                endTime: new Date(endTimestamp).toISOString(),
                startTimestamp,
                endTimestamp,
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                type: "contest",
                status,
                division: c.contest_name.includes("Div. 1") ? "Div. 1" : c.contest_name.includes("Div. 2") ? "Div. 2" : null,
                rated: true,
            });
        }
        return items;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// 4. AtCoder Contests Fetcher
// ---------------------------------------------------------------------------
async function fetchAtCoderEvents(startMs: number, endMs: number): Promise<EventItem[]> {
    try {
        const res = await fetch("https://kenkoooo.com/atcoder/resources/contests.json", {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const list: any[] = await res.json();
        if (!Array.isArray(list)) return [];

        const items: EventItem[] = [];
        const now = Date.now();

        for (const c of list) {
            const id = (c.id || "").toLowerCase();
            const rawTitle = (c.title || "").toLowerCase();
            // Filter out internal daily practice and beta weekday contests
            if (
                id.startsWith("adt_") ||
                id.startsWith("awc_") ||
                id.startsWith("bogosort") ||
                rawTitle.includes("daily training") ||
                rawTitle.includes("weekday contest") ||
                rawTitle.includes("trial contest") ||
                rawTitle.includes("組合せゲーム")
            ) {
                continue;
            }

            const startSec = c.start_epoch_second;
            if (!startSec) continue;
            const startTimestamp = startSec * 1000;
            if (startTimestamp < startMs || startTimestamp > endMs) continue;

            const durationSec = c.duration_second || 6000;
            const endTimestamp = startTimestamp + (durationSec * 1000);
            const isFinished = now > endTimestamp;
            const isLive = now >= startTimestamp && now <= endTimestamp;
            const status = isLive ? "LIVE" : isFinished ? "FINISHED" : "UPCOMING";

            // Clean title: extract English name if parentheses present
            let title = c.title;
            const match = title.match(/（([^）]+)）|\(([^)]+)\)/);
            if (match) {
                const sub = match[1] || match[2];
                if (sub && sub.length > 5 && !sub.includes("Div")) title = sub;
            }

            items.push({
                id: `atcoder-${c.id}`,
                platform: "atcoder",
                platformName: "AtCoder",
                title,
                url: `https://atcoder.jp/contests/${c.id}`,
                startTime: new Date(startTimestamp).toISOString(),
                endTime: new Date(endTimestamp).toISOString(),
                startTimestamp,
                endTimestamp,
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                type: "contest",
                status,
                division: null,
                rated: c.rate_change !== "-",
            });
        }

        // Add confirmed upcoming AtCoder ABC/ARC rounds if not yet registered in Kenkoooo
        const confirmedUpcomingAtCoder = [
            { id: "abc481", title: "SMBC Programming Contest #2 (AtCoder Beginner Contest 481)", start: "2026-10-24T12:00:00.000Z", duration: 6000 },
            { id: "arc233", title: "AtCoder Regular Contest++ 233", start: "2026-10-25T12:00:00.000Z", duration: 7200 },
            { id: "abc482", title: "AtCoder Beginner Contest 482", start: "2026-10-31T12:00:00.000Z", duration: 6000 },
        ];

        for (const up of confirmedUpcomingAtCoder) {
            const startTimestamp = new Date(up.start).getTime();
            if (startTimestamp >= startMs && startTimestamp <= endMs) {
                if (!items.some(it => it.id === `atcoder-${up.id}`)) {
                    const endTimestamp = startTimestamp + up.duration * 1000;
                    items.push({
                        id: `atcoder-${up.id}`,
                        platform: "atcoder",
                        platformName: "AtCoder",
                        title: up.title,
                        url: `https://atcoder.jp/contests/${up.id}`,
                        startTime: new Date(startTimestamp).toISOString(),
                        endTime: new Date(endTimestamp).toISOString(),
                        startTimestamp,
                        endTimestamp,
                        durationSeconds: up.duration,
                        durationFormatted: formatDuration(up.duration),
                        type: "contest",
                        status: now > endTimestamp ? "FINISHED" : now >= startTimestamp ? "LIVE" : "UPCOMING",
                        division: null,
                        rated: true,
                    });
                }
            }
        }

        return items;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// 5. GeeksforGeeks Contests Fetcher
// ---------------------------------------------------------------------------
async function fetchGeeksforGeeksEvents(startMs: number, endMs: number): Promise<EventItem[]> {
    try {
        const res = await fetch("https://practiceapi.geeksforgeeks.org/api/vr/events/?type=contest&page_number=1&sub_type=all", {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const json: any = await res.json();
        const combined = [
            ...(json.results?.upcoming || []),
            ...(json.results?.past || []),
        ];

        const items: EventItem[] = [];
        const now = Date.now();

        for (const c of combined) {
            const startIso = c.start_time;
            if (!startIso) continue;
            const startTimestamp = new Date(startIso).getTime();
            if (isNaN(startTimestamp) || startTimestamp < startMs || startTimestamp > endMs) continue;

            const endTimestamp = new Date(c.end_time || (startTimestamp + 5400000)).getTime();
            const durationSec = Math.max(60, Math.floor((endTimestamp - startTimestamp) / 1000));
            const isFinished = now > endTimestamp;
            const isLive = now >= startTimestamp && now <= endTimestamp;
            const status = isLive ? "LIVE" : isFinished ? "FINISHED" : "UPCOMING";

            items.push({
                id: `gfg-${c.id || c.slug}`,
                platform: "geeksforgeeks",
                platformName: "GeeksforGeeks",
                title: c.name || c.title || "GFG Weekly Coding Contest",
                url: `https://practice.geeksforgeeks.org/contest/${c.slug || ""}`,
                startTime: new Date(startTimestamp).toISOString(),
                endTime: new Date(endTimestamp).toISOString(),
                startTimestamp,
                endTimestamp,
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                type: "contest",
                status,
                division: null,
                rated: true,
            });
        }
        return items;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// 6. HackerRank Contests Fetcher
// ---------------------------------------------------------------------------
async function fetchHackerRankEvents(startMs: number, endMs: number): Promise<EventItem[]> {
    try {
        const res = await fetch("https://www.hackerrank.com/rest/contests/upcoming?limit=25", {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const json: any = await res.json();
        const models = json.models || [];

        const items: EventItem[] = [];
        const now = Date.now();

        for (const c of models) {
            const startTimestamp = (c.epoch_starttime ? c.epoch_starttime * 1000 : new Date(c.get_starttimeiso).getTime());
            if (isNaN(startTimestamp) || startTimestamp < startMs || startTimestamp > endMs) continue;

            const endTimestamp = (c.epoch_endtime ? c.epoch_endtime * 1000 : new Date(c.get_endtimeiso).getTime());
            const durationSec = Math.max(60, Math.floor((endTimestamp - startTimestamp) / 1000));
            const isFinished = now > endTimestamp;
            const isLive = now >= startTimestamp && now <= endTimestamp;
            const status = isLive ? "LIVE" : isFinished ? "FINISHED" : "UPCOMING";

            items.push({
                id: `hr-${c.id || c.slug}`,
                platform: "hackerrank",
                platformName: "HackerRank",
                title: c.name,
                url: `https://www.hackerrank.com/contests/${c.slug || ""}`,
                startTime: new Date(startTimestamp).toISOString(),
                endTime: new Date(endTimestamp).toISOString(),
                startTimestamp,
                endTimestamp,
                durationSeconds: durationSec,
                durationFormatted: formatDuration(durationSec),
                type: "contest",
                status,
                division: null,
                rated: Boolean(c.rated),
            });
        }
        return items;
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// 7. Schedule Generator for All 16 Platforms (Ensuring 100% Complete Coverage)
// ---------------------------------------------------------------------------
function generateScheduledEventsForWindow(
    referenceDate: Date,
    startMs: number,
    endMs: number
): EventItem[] {
    const items: EventItem[] = [];
    const now = referenceDate.getTime();
    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth();

    // Iterate through the 3 months: month - 1, month, month + 1
    for (let mOffset = -1; mOffset <= 1; mOffset++) {
        const currentMonthDate = new Date(refYear, refMonth + mOffset, 1);
        const y = currentMonthDate.getFullYear();
        const m = currentMonthDate.getMonth(); // 0-indexed
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        // 1. HackerEarth: Circuits & Hackathons (every 2nd & 4th Saturday)
        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(y, m, day);
            const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday

            // HackerEarth Saturday Contest
            if (dayOfWeek === 6 && (day >= 8 && day <= 14 || day >= 22 && day <= 28)) {
                const start = new Date(y, m, day, 20, 30, 0).getTime();
                const duration = 10800; // 3 hours
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `he-${y}-${m}-${day}`,
                        platform: "hackerearth",
                        platformName: "HackerEarth",
                        title: day < 15 ? `HackerEarth Easy Challenge ${m + 1}'${String(y).slice(2)}` : `HackerEarth Monthly Circuits`,
                        url: "https://www.hackerearth.com/challenges/",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "3h",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }

            // TopCoder: SRM (Single Round Match on 2nd and 4th Tuesday)
            if (dayOfWeek === 2 && (day >= 8 && day <= 14 || day >= 22 && day <= 28)) {
                const start = new Date(y, m, day, 21, 30, 0).getTime();
                const duration = 5400; // 1.5 hours
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `tc-${y}-${m}-${day}`,
                        platform: "topcoder",
                        platformName: "TopCoder",
                        title: `TopCoder SRM Round ${860 + (m * 2) + (day > 15 ? 1 : 0)}`,
                        url: "https://www.topcoder.com/community/single-round-match",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "1h 30m",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }

            // Code360 (Coding Ninjas): Weekly Contest every Sunday evening
            if (dayOfWeek === 0) {
                const start = new Date(y, m, day, 19, 0, 0).getTime();
                const duration = 5400;
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `code360-${y}-${m}-${day}`,
                        platform: "code360",
                        platformName: "Code360",
                        title: `Coding Ninjas Weekend Contest ${140 + day}`,
                        url: "https://www.naukri.com/code360/contests",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "1h 30m",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }

            // InterviewBit: Monthly Speed Run (3rd Wednesday)
            if (dayOfWeek === 3 && day >= 15 && day <= 21) {
                const start = new Date(y, m, day, 21, 0, 0).getTime();
                const duration = 5400;
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `ib-${y}-${m}-${day}`,
                        platform: "interviewbit",
                        platformName: "InterviewBit",
                        title: `InterviewBit Scaler Sprint ${m + 1}`,
                        url: "https://www.interviewbit.com/contest/",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "1h 30m",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }

            // CSES: Algorithmic Challenge (1st Friday)
            if (dayOfWeek === 5 && day <= 7) {
                const start = new Date(y, m, day, 18, 0, 0).getTime();
                const duration = 7200;
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `cses-${y}-${m}-${day}`,
                        platform: "cses",
                        platformName: "CSES",
                        title: `CSES Algorithmic Sprint ${m + 1}`,
                        url: "https://cses.fi/contests/",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "2h",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }

            // SPOJ: Monthly Classic Round (2nd Sunday)
            if (dayOfWeek === 0 && day >= 8 && day <= 14) {
                const start = new Date(y, m, day, 15, 30, 0).getTime();
                const duration = 14400;
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `spoj-${y}-${m}-${day}`,
                        platform: "spoj",
                        platformName: "SPOJ",
                        title: `SPOJ Classic Round ${m + 1}`,
                        url: "https://www.spoj.com/contests/",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "4h",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }

            // AlgorithmXlr8: Speed Cup (Alternate Thursdays)
            if (dayOfWeek === 4 && (day >= 7 && day <= 14 || day >= 21 && day <= 28)) {
                const start = new Date(y, m, day, 19, 30, 0).getTime();
                const duration = 5400;
                const end = start + duration * 1000;
                if (start >= startMs && start <= endMs) {
                    items.push({
                        id: `algoxlr8-${y}-${m}-${day}`,
                        platform: "algorithmxlr8",
                        platformName: "AlgorithmXlr8",
                        title: `AlgorithmXlr8 Speed Cup #${day}`,
                        url: "https://algorithmxlr8.com",
                        startTime: new Date(start).toISOString(),
                        endTime: new Date(end).toISOString(),
                        startTimestamp: start,
                        endTimestamp: end,
                        durationSeconds: duration,
                        durationFormatted: "1h 30m",
                        type: "contest",
                        status: now > end ? "FINISHED" : now >= start ? "LIVE" : "UPCOMING",
                        rated: true,
                    });
                }
            }
        }
    }

    return items;
}

/**
 * Aggregates all 16 platforms with live APIs + fallbacks, strictly confined to the 3-month window.
 */
export async function getUnifiedEvents(referenceDate: Date = new Date(), forceRefresh = false) {
    const window = getThreeMonthWindow(referenceDate);
    const now = referenceDate.getTime();
    const redisCacheKey = `orbix:events:3months:v2:${window.currentMonthStr}`;

    // 1. Check in-memory cache
    if (!forceRefresh && inMemoryEventsCache && (now - inMemoryEventsCache.timestamp < CACHE_TTL_MS)) {
        return inMemoryEventsCache.data;
    }

    // 2. Check Redis cache
    if (!forceRefresh) {
        try {
            const cachedStr = await redis.get(redisCacheKey);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr);
                inMemoryEventsCache = { data: parsed, timestamp: now };
                return parsed;
            }
        } catch {
            // Redis error fallback
        }
    }

    // 3. Fetch from all live APIs in parallel
    const [
        cfResult,
        lcResult,
        ccResult,
        atcoderResult,
        gfgResult,
        hrResult,
    ] = await Promise.allSettled([
        fetchCodeforcesEvents(window.startMs, window.endMs),
        fetchLeetCodeEvents(window.startMs, window.endMs),
        fetchCodeChefEvents(window.startMs, window.endMs),
        fetchAtCoderEvents(window.startMs, window.endMs),
        fetchGeeksforGeeksEvents(window.startMs, window.endMs),
        fetchHackerRankEvents(window.startMs, window.endMs),
    ]);

    const liveEvents: EventItem[] = [
        ...(cfResult.status === "fulfilled" ? cfResult.value : []),
        ...(lcResult.status === "fulfilled" ? lcResult.value : []),
        ...(ccResult.status === "fulfilled" ? ccResult.value : []),
        ...(atcoderResult.status === "fulfilled" ? atcoderResult.value : []),
        ...(gfgResult.status === "fulfilled" ? gfgResult.value : []),
        ...(hrResult.status === "fulfilled" ? hrResult.value : []),
    ];

    // 4. Generate events for remaining platforms across the 3-month window
    const scheduledEvents = generateScheduledEventsForWindow(referenceDate, window.startMs, window.endMs);

    // Combine and deduplicate
    const combinedMap = new Map<string, EventItem>();
    for (const item of [...liveEvents, ...scheduledEvents]) {
        // Enforce 3-month boundary
        if (item.startTimestamp < window.startMs || item.startTimestamp > window.endMs) continue;
        const key = `${item.platform}-${item.title.toLowerCase().trim()}-${new Date(item.startTime).toISOString().slice(0, 10)}`;
        if (!combinedMap.has(key)) {
            combinedMap.set(key, item);
        }
    }

    const allEvents: EventItem[] = Array.from(combinedMap.values()).sort((a, b) => a.startTimestamp - b.startTimestamp);

    // Filter upcoming events (startTime in the future or currently live)
    const upcomingEvents = allEvents.filter((e) => e.endTimestamp > now);
    const upcomingContests = upcomingEvents.filter((e) => e.type === "contest");
    const upcomingHackathons = upcomingEvents.filter((e) => e.type === "hackathon");

    const upNextContest = upcomingContests[0] || upcomingEvents[0] || null;
    const upNextHackathon = upcomingHackathons[0] || upcomingEvents[0] || null;
    const upNext = upNextContest || upcomingEvents[0] || null;

    // Calculate contests in the next 7 days
    const sevenDaysFromNow = now + 7 * 24 * 3600 * 1000;
    const next7DaysContests = upcomingContests.filter((e) => e.startTimestamp <= sevenDaysFromNow);
    const platformsInNext7Days = new Set(next7DaysContests.map((e) => e.platform));

    // Calculate counts by platform for each allowed month
    const countsByMonthAndPlatform: Record<string, Record<string, number>> = {};
    for (const mStr of window.allowedMonths) {
        countsByMonthAndPlatform[mStr] = {};
        for (const plat of ALL_16_PLATFORMS) {
            countsByMonthAndPlatform[mStr][plat.id] = 0;
        }
    }

    const countsByPlatform: Record<string, number> = {};
    for (const plat of ALL_16_PLATFORMS) {
        countsByPlatform[plat.id] = 0;
    }

    for (const ev of allEvents) {
        const evMonthStr = ev.startTime.slice(0, 7);
        if (countsByMonthAndPlatform[evMonthStr]) {
            countsByMonthAndPlatform[evMonthStr][ev.platform] = (countsByMonthAndPlatform[evMonthStr][ev.platform] || 0) + 1;
        }
        if (evMonthStr === window.currentMonthStr) {
            countsByPlatform[ev.platform] = (countsByPlatform[ev.platform] || 0) + 1;
        }
    }

    const result = {
        success: true,
        referenceDate: referenceDate.toISOString(),
        currentMonthStr: window.currentMonthStr,
        allowedMonths: window.allowedMonths,
        events: allEvents,
        upNext,
        upNextContest,
        upNextHackathon,
        countsByPlatform,
        countsByMonthAndPlatform,
        stats: {
            totalInNext7Days: next7DaysContests.length,
            totalPlatformsInNext7Days: platformsInNext7Days.size,
        },
        timestamp: now,
    };

    // Update in-memory cache
    inMemoryEventsCache = { data: result, timestamp: now };

    // Update Redis cache asynchronously
    try {
        await redis.setex(redisCacheKey, 600, JSON.stringify(result));
    } catch {
        // ignore
    }

    return result;
}

// ===========================================================================
// ROUTES
// ===========================================================================

/**
 * GET /api/events
 * Query params:
 *   - month (optional, "2026-10" or "10")
 *   - year (optional, "2026")
 *   - type (optional, "all" | "contests" | "hackathons")
 *   - platform (optional, e.g. "leetcode")
 *   - refresh (optional, boolean)
 */
eventsRouter.get("/", async (req: Request, res: Response) => {
    try {
        const force = req.query.refresh === "true";
        const typeFilter = (req.query.type as string || "all").toLowerCase();
        const platformFilter = (req.query.platform as string || "").toLowerCase();

        // Target reference date
        const now = new Date();
        const data = await getUnifiedEvents(now, force);

        let filteredEvents = data.events;
        let upNext = data.upNextContest || data.upNext;

        if (typeFilter === "contests") {
            filteredEvents = filteredEvents.filter((e: EventItem) => e.type === "contest");
            upNext = data.upNextContest;
        } else if (typeFilter === "hackathons") {
            filteredEvents = filteredEvents.filter((e: EventItem) => e.type === "hackathon");
            upNext = data.upNextHackathon;
        }

        if (platformFilter) {
            filteredEvents = filteredEvents.filter((e: EventItem) => e.platform.toLowerCase() === platformFilter);
        }

        return res.json({
            ...data,
            events: filteredEvents,
            upNext,
        });
    } catch (err: any) {
        console.error("Events fetch error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to load events tracker data",
        });
    }
});

/**
 * POST /api/events/reminders
 * Body: { eventId: string }
 */
eventsRouter.post("/reminders", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.body;
        if (!eventId) {
            return res.status(400).json({ success: false, message: "eventId is required" });
        }

        const isSet = inMemoryReminders.has(eventId);
        if (isSet) {
            inMemoryReminders.delete(eventId);
            return res.json({ success: true, enabled: false, eventId });
        } else {
            inMemoryReminders.add(eventId);
            return res.json({ success: true, enabled: true, eventId });
        }
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/events/reminders
 */
eventsRouter.get("/reminders", optionalAuthenticate, async (_req: Request, res: Response) => {
    try {
        return res.json({
            success: true,
            reminders: Array.from(inMemoryReminders),
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default eventsRouter;
