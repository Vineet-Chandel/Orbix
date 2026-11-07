import type { EventItem } from "../../../store";
import { buildApiUrl } from "../../../api/apiClient";

// Helper to create consistent contest items
export const createContest = (
    id: string,
    platform: string,
    platformName: string,
    title: string,
    url: string,
    isoStart: string,
    durationHours: number,
    durationFormatted: string,
    type: "contest" | "hackathon" = "contest",
    division: string | null = null,
    rated: boolean = true,
    description?: string,
    refTimeMs: number = Date.now()
): EventItem => {
    const startMs = new Date(isoStart).getTime();
    const endMs = startMs + Math.round(durationHours * 3600 * 1000);
    let status: "UPCOMING" | "LIVE" | "FINISHED" = "UPCOMING";
    if (refTimeMs >= endMs) {
        status = "FINISHED";
    } else if (refTimeMs >= startMs && refTimeMs < endMs) {
        status = "LIVE";
    }

    return {
        id,
        platform,
        platformName,
        title,
        url,
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        startTimestamp: startMs,
        endTimestamp: endMs,
        durationSeconds: Math.round(durationHours * 3600),
        durationFormatted,
        type,
        status,
        division,
        rated,
        description,
    };
};

// Helper: format ISO date in IST (+05:30) timezone
function formatIstIso(year: number, monthIndex: number, day: number, hour: number = 0, minute: number = 0): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(monthIndex + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`;
}

/**
 * Dynamic Self-Updating Dummy Data Algorithm
 *
 * Generates an authentic, high-density multi-month contest and hackathon schedule
 * relative to the current live clock or given referenceDate.
 *
 * It prevents landing page dummy data from getting old or stuck in the "finished" stage,
 * ensuring platforms always have non-zero counts and upcoming contests.
 */
export function generateDynamicMockEvents(refDate: Date = new Date()): EventItem[] {
    const events: EventItem[] = [];
    const nowMs = refDate.getTime();
    const currentYear = refDate.getFullYear();
    const currentMonth = refDate.getMonth(); // 0-indexed

    // Generate across 4-month window: [Previous Month, Current Month, Next Month, Next Month + 1]
    const monthsToGenerate: Array<{ year: number; month: number }> = [
        {
            year: currentMonth === 0 ? currentYear - 1 : currentYear,
            month: currentMonth === 0 ? 11 : currentMonth - 1,
        },
        { year: currentYear, month: currentMonth },
        {
            year: currentMonth === 11 ? currentYear + 1 : currentYear,
            month: currentMonth === 11 ? 0 : currentMonth + 1,
        },
        {
            year: currentMonth >= 10 ? currentYear + 1 : currentYear,
            month: (currentMonth + 2) % 12,
        },
    ];

    for (const { year, month } of monthsToGenerate) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Month index offset relative to year 2026 for consistent incremental round numbers
        const monthOffset = (year - 2026) * 12 + month;

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
            const weekOfMonth = Math.floor((day - 1) / 7) + 1;

            // 1. LeetCode: Weekly Contest (Every Sunday at 08:00 IST)
            if (dayOfWeek === 0) {
                const roundNum = 422 + monthOffset * 4 + weekOfMonth;
                events.push(
                    createContest(
                        `lc-weekly-${roundNum}`,
                        "leetcode",
                        "LeetCode",
                        `Weekly Contest ${roundNum}`,
                        `https://leetcode.com/contest/weekly-contest-${roundNum}`,
                        formatIstIso(year, month, day, 8, 0),
                        1.5,
                        "1h 30m",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // LeetCode: Biweekly Contest (Alternate Saturdays at 20:00 IST)
            if (dayOfWeek === 6 && (weekOfMonth === 2 || weekOfMonth === 4)) {
                const roundNum = 142 + monthOffset * 2 + Math.floor(weekOfMonth / 2);
                events.push(
                    createContest(
                        `lc-biweekly-${roundNum}`,
                        "leetcode",
                        "LeetCode",
                        `Biweekly Contest ${roundNum}`,
                        `https://leetcode.com/contest/biweekly-contest-${roundNum}`,
                        formatIstIso(year, month, day, 20, 0),
                        1.5,
                        "1h 30m",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 2. Codeforces: Tuesday Round (Div. 2 at 20:05 IST)
            if (dayOfWeek === 2) {
                const roundNum = 1002 + monthOffset * 6 + weekOfMonth * 2;
                events.push(
                    createContest(
                        `cf-div2-${year}-${month + 1}-${day}`,
                        "codeforces",
                        "Codeforces",
                        `Codeforces Round ${roundNum} (Div. 2)`,
                        `https://codeforces.com/contest/${roundNum}`,
                        formatIstIso(year, month, day, 20, 5),
                        2,
                        "2h",
                        "contest",
                        "Div. 2",
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // Codeforces: Thursday Educational Round (Div. 2 at 20:05 IST)
            if (dayOfWeek === 4) {
                const eduNum = 176 + monthOffset * 2 + weekOfMonth;
                events.push(
                    createContest(
                        `cf-edu-${year}-${month + 1}-${day}`,
                        "codeforces",
                        "Codeforces",
                        `Educational Codeforces Round ${eduNum} (Rated for Div. 2)`,
                        `https://codeforces.com/contest/${eduNum + 810}`,
                        formatIstIso(year, month, day, 20, 5),
                        2,
                        "2h",
                        "contest",
                        "Div. 2",
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // Codeforces: Saturday Round (Div. 1 + Div. 2 or Div. 3 at 20:05 IST)
            if (dayOfWeek === 6) {
                const roundNum = 1003 + monthOffset * 6 + weekOfMonth * 2;
                const isDiv3 = day % 2 === 0;
                events.push(
                    createContest(
                        `cf-round-${year}-${month + 1}-${day}`,
                        "codeforces",
                        "Codeforces",
                        isDiv3
                            ? `Codeforces Round ${roundNum} (Div. 3)`
                            : `Codeforces Round ${roundNum} (Div. 1 + Div. 2)`,
                        `https://codeforces.com/contest/${roundNum}`,
                        formatIstIso(year, month, day, 20, 5),
                        isDiv3 ? 2.25 : 2.5,
                        isDiv3 ? "2h 15m" : "2h 30m",
                        "contest",
                        isDiv3 ? "Div. 3" : "Div. 1 + 2",
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 3. CodeChef: Starters (Every Wednesday at 20:00 IST)
            if (dayOfWeek === 3) {
                const starterNum = 262 + monthOffset * 4 + weekOfMonth;
                events.push(
                    createContest(
                        `cc-starters-${starterNum}`,
                        "codechef",
                        "CodeChef",
                        `Starters ${starterNum}`,
                        `https://www.codechef.com/START${starterNum}`,
                        formatIstIso(year, month, day, 20, 0),
                        2,
                        "2h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 4. AtCoder: Beginner Contest (Every Saturday at 17:30 IST)
            if (dayOfWeek === 6) {
                const abcNum = 472 + monthOffset * 4 + weekOfMonth;
                events.push(
                    createContest(
                        `atcoder-abc-${abcNum}`,
                        "atcoder",
                        "AtCoder",
                        `AtCoder Beginner Contest ${abcNum}`,
                        `https://atcoder.jp/contests/abc${abcNum}`,
                        formatIstIso(year, month, day, 17, 30),
                        1.67,
                        "1h 40m",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // AtCoder: Regular Contest (Alternate Sundays at 17:30 IST)
            if (dayOfWeek === 0 && (weekOfMonth === 1 || weekOfMonth === 3)) {
                const arcNum = 224 + monthOffset * 2 + Math.floor(weekOfMonth / 2);
                events.push(
                    createContest(
                        `atcoder-arc-${arcNum}`,
                        "atcoder",
                        "AtCoder",
                        `AtCoder Regular Contest ${arcNum}`,
                        `https://atcoder.jp/contests/arc${arcNum}`,
                        formatIstIso(year, month, day, 17, 30),
                        2,
                        "2h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 5. GeeksforGeeks: Weekly Coding Contest (Every Sunday at 19:00 IST)
            if (dayOfWeek === 0) {
                const gfgNum = 179 + monthOffset * 4 + weekOfMonth;
                events.push(
                    createContest(
                        `gfg-weekly-${gfgNum}`,
                        "geeksforgeeks",
                        "GeeksforGeeks",
                        `GfG Weekly Coding Contest ${gfgNum}`,
                        `https://practice.geeksforgeeks.org/contest/gfg-weekly-coding-contest-${gfgNum}`,
                        formatIstIso(year, month, day, 19, 0),
                        1.5,
                        "1h 30m",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 6. HackerRank: Code Sprint (Alternate Fridays at 20:00 IST)
            if (dayOfWeek === 5 && (weekOfMonth === 2 || weekOfMonth === 4)) {
                events.push(
                    createContest(
                        `hr-sprint-${year}-${month + 1}-${day}`,
                        "hackerrank",
                        "HackerRank",
                        `HackerRank Code Sprint ${month + 1}.${weekOfMonth}`,
                        "https://www.hackerrank.com/contests",
                        formatIstIso(year, month, day, 20, 0),
                        3,
                        "3h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 7. HackerEarth: Circuit Challenge (Bi-monthly on days 10 and 24 at 21:00 IST)
            if (day === 10 || day === 24) {
                events.push(
                    createContest(
                        `he-circuit-${year}-${month + 1}-${day}`,
                        "hackerearth",
                        "HackerEarth",
                        `HackerEarth Algorithmic Circuit ${day}`,
                        "https://www.hackerearth.com/challenges/",
                        formatIstIso(year, month, day, 21, 0),
                        3,
                        "3h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 8. TopCoder: Single Round Match (Alternate Thursdays at 21:30 IST)
            if (dayOfWeek === 4 && (weekOfMonth === 1 || weekOfMonth === 3)) {
                const srmNum = 872 + monthOffset * 2 + Math.floor(weekOfMonth / 2);
                events.push(
                    createContest(
                        `tc-srm-${srmNum}`,
                        "topcoder",
                        "TopCoder",
                        `TopCoder SRM ${srmNum}`,
                        "https://www.topcoder.com/community/events",
                        formatIstIso(year, month, day, 21, 30),
                        2,
                        "2h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 9. Code360: Weekly Contest (Every Sunday at 18:00 IST)
            if (dayOfWeek === 0) {
                const c360Num = 142 + monthOffset * 4 + weekOfMonth;
                events.push(
                    createContest(
                        `c360-weekly-${c360Num}`,
                        "code360",
                        "Code360",
                        `Code360 Weekly Contest ${c360Num}`,
                        "https://www.naukri.com/code360/contests",
                        formatIstIso(year, month, day, 18, 0),
                        1.5,
                        "1h 30m",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 10. InterviewBit: ByteRace (Alternate Saturdays at 18:00 IST)
            if (dayOfWeek === 6 && (weekOfMonth === 1 || weekOfMonth === 3)) {
                events.push(
                    createContest(
                        `ib-byterace-${year}-${month + 1}-${day}`,
                        "interviewbit",
                        "InterviewBit",
                        `InterviewBit ByteRace Round ${weekOfMonth}`,
                        "https://www.interviewbit.com/contest/",
                        formatIstIso(year, month, day, 18, 0),
                        1.5,
                        "1h 30m",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 11. CSES: Algorithmic Sprint (Alternate Fridays at 18:00 IST)
            if (dayOfWeek === 5 && (weekOfMonth === 1 || weekOfMonth === 3)) {
                const csesNum = 10 + monthOffset * 2 + Math.floor(weekOfMonth / 2);
                events.push(
                    createContest(
                        `cses-sprint-${csesNum}`,
                        "cses",
                        "CSES",
                        `CSES Algorithmic Sprint ${csesNum}`,
                        "https://cses.fi/contests/",
                        formatIstIso(year, month, day, 18, 0),
                        2,
                        "2h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }

            // 12. SPOJ: Algorithmic Sprint (Alternate Mondays at 19:00 IST)
            if (dayOfWeek === 1 && (weekOfMonth === 2 || weekOfMonth === 4)) {
                events.push(
                    createContest(
                        `spoj-challenge-${year}-${month + 1}-${day}`,
                        "spoj",
                        "SPOJ",
                        `SPOJ Algorithmic Sprint ${month + 1}.${weekOfMonth}`,
                        "https://www.spoj.com/",
                        formatIstIso(year, month, day, 19, 0),
                        2,
                        "2h",
                        "contest",
                        null,
                        true,
                        undefined,
                        nowMs
                    )
                );
            }
        }

        // Add 4 multi-day Hackathons for this month
        events.push(
            createContest(
                `hack-ai-${year}-${month + 1}`,
                "hackerearth",
                "HackerEarth",
                `International Autonomous AI Hackathon ${year}`,
                "https://www.hackerearth.com/challenges/hackathon/",
                formatIstIso(year, month, 5, 9, 0),
                72,
                "3d",
                "hackathon",
                null,
                false,
                "$50,000 in bounties for autonomous AI developer tooling.",
                nowMs
            )
        );

        events.push(
            createContest(
                `hack-quantum-${year}-${month + 1}`,
                "hackerearth",
                "HackerEarth",
                `Quantum Algorithms & Security Challenge ${year}`,
                "https://www.hackerearth.com/challenges/hackathon/",
                formatIstIso(year, month, 14, 9, 0),
                96,
                "4d",
                "hackathon",
                null,
                false,
                "Post-quantum cryptographic implementations and benchmarking.",
                nowMs
            )
        );

        events.push(
            createContest(
                `hack-concurrency-${year}-${month + 1}`,
                "hackerrank",
                "HackerRank",
                `Global High-Concurrency Systems Hackathon ${year}`,
                "https://www.hackerrank.com/contests",
                formatIstIso(year, month, 21, 9, 0),
                72,
                "3d",
                "hackathon",
                null,
                false,
                "Architecting zero-downtime distributed consensus nodes.",
                nowMs
            )
        );

        events.push(
            createContest(
                `hack-genai-${year}-${month + 1}`,
                "code360",
                "Code360",
                `GenAI Coding Assistant Hackathon ${year}`,
                "https://www.naukri.com/code360/contests",
                formatIstIso(year, month, 27, 9, 0),
                48,
                "2d",
                "hackathon",
                null,
                false,
                "Build the future of agentic coding IDE plugins.",
                nowMs
            )
        );
    }

    // Safety guarantee: Ensure there is at least one upcoming contest within the next 24h
    // so the UP NEXT card and countdown timer always display an active countdown.
    const upcomingContests = events.filter((e) => e.type === "contest" && e.startTimestamp > nowMs);
    if (upcomingContests.length === 0 || (upcomingContests[0].startTimestamp - nowMs > 24 * 3600 * 1000)) {
        const nearStart = new Date(nowMs + 4 * 3600 * 1000);
        nearStart.setMinutes(0, 0, 0);
        const nearEnd = new Date(nearStart.getTime() + 2 * 3600 * 1000);
        events.push({
            id: `up-next-quick-${nearStart.getTime()}`,
            platform: "codechef",
            platformName: "CodeChef",
            title: `Starters ${260 + (refDate.getMonth() + 1) * 2}`,
            url: "https://www.codechef.com/contests",
            startTime: nearStart.toISOString(),
            endTime: nearEnd.toISOString(),
            startTimestamp: nearStart.getTime(),
            endTimestamp: nearEnd.getTime(),
            durationSeconds: 7200,
            durationFormatted: "2h",
            type: "contest",
            status: "UPCOMING",
            division: null,
            rated: true,
        });
    }

    events.sort((a, b) => a.startTimestamp - b.startTimestamp);
    return events;
}

// Global cached dummy events instance for fast synchronous loading
export const MOCK_EVENT_LIST: EventItem[] = generateDynamicMockEvents();

// Initial profile loader: reads from localStorage cache or generates fresh dynamic events
export const getInitialLandingEvents = (): EventItem[] => {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            const cached = localStorage.getItem("orbix_landing_events_profile");
            if (cached) {
                const parsed: EventItem[] = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const now = Date.now();
                    const upcomingCount = parsed.filter((e) => e.endTimestamp > now).length;
                    // If cache has at least 5 upcoming events, use it and recalculate statuses
                    if (upcomingCount >= 5) {
                        return parsed.map((e) => ({
                            ...e,
                            status: (now >= e.endTimestamp
                                ? "FINISHED"
                                : now >= e.startTimestamp
                                ? "LIVE"
                                : "UPCOMING") as "UPCOMING" | "LIVE" | "FINISHED",
                        }));
                    }
                }
            }
        }
    } catch (err) {
        console.warn("Failed to read cached landing events profile:", err);
    }

    return generateDynamicMockEvents();
};

// Save events to local dummy data profile
export const saveLandingEventsProfile = (events: EventItem[]): void => {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem("orbix_landing_events_profile", JSON.stringify(events));
        }
    } catch (err) {
        console.warn("Failed to save landing events profile:", err);
    }
};

// Fetch live contest events from search API (/api/events)
export const fetchLandingEventsApi = async (): Promise<EventItem[] | null> => {
    const primaryUrl = buildApiUrl("/api/events");
    const endpoints = import.meta.env.DEV
        ? [primaryUrl, "http://localhost:3000/api/events"]
        : [primaryUrl];

    for (const ep of endpoints) {
        try {
            const res = await fetch(ep, {
                signal: AbortSignal.timeout(5000),
                headers: { Accept: "application/json" },
            });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.events) && data.events.length > 0) {
                    return data.events;
                }
            }
        } catch {
            // Try fallback endpoint
        }
    }
    return null;
};

// Merge live API events with dynamic hackathons and missing platform fallbacks
export const mergeLandingEvents = (apiEvents: EventItem[]): EventItem[] => {
    const now = Date.now();
    const dynamicFallback = generateDynamicMockEvents(new Date(now));
    const combinedMap = new Map<string, EventItem>();

    // 1. Add all API events with dynamically computed status
    for (const ev of apiEvents) {
        const key = `${ev.platform}-${ev.title.toLowerCase().trim()}-${new Date(ev.startTime).toISOString().slice(0, 10)}`;
        const status = (now >= ev.endTimestamp
            ? "FINISHED"
            : now >= ev.startTimestamp
            ? "LIVE"
            : "UPCOMING") as "UPCOMING" | "LIVE" | "FINISHED";
        combinedMap.set(key, { ...ev, status });
    }

    // 2. Add hackathons from dynamic mock if API didn't provide any
    const hasHackathons = apiEvents.some((e) => e.type === "hackathon");
    if (!hasHackathons) {
        for (const hack of dynamicFallback.filter((e) => e.type === "hackathon")) {
            const key = `hack-${hack.id}`;
            if (!combinedMap.has(key)) {
                combinedMap.set(key, hack);
            }
        }
    }

    // 3. Supplement any platform with 0 events
    const apiPlatforms = new Set(apiEvents.map((e) => e.platform.toLowerCase()));
    for (const fallbackItem of dynamicFallback) {
        if (!apiPlatforms.has(fallbackItem.platform.toLowerCase())) {
            const key = `${fallbackItem.platform}-${fallbackItem.title.toLowerCase().trim()}-${new Date(fallbackItem.startTime).toISOString().slice(0, 10)}`;
            if (!combinedMap.has(key)) {
                combinedMap.set(key, fallbackItem);
            }
        }
    }

    const merged = Array.from(combinedMap.values());
    merged.sort((a, b) => a.startTimestamp - b.startTimestamp);
    return merged;
};

// Fallback counts for fast initial rendering
export const MOCK_COUNTS: Record<string, number> = {
    leetcode: 8,
    codeforces: 12,
    codechef: 5,
    atcoder: 11,
    geeksforgeeks: 5,
    hackerrank: 4,
    hackerearth: 5,
    topcoder: 4,
    code360: 5,
    interviewbit: 3,
    cses: 4,
    spoj: 2,
};
