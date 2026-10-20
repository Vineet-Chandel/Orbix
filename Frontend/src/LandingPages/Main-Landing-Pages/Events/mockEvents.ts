import type { EventItem } from "../../../store";

// Helper to create consistent contest items
const createContest = (
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
    description?: string
): EventItem => {
    const startMs = new Date(isoStart).getTime();
    const endMs = startMs + durationHours * 3600 * 1000;
    const now = Date.now();
    let status: "UPCOMING" | "LIVE" | "FINISHED" = "UPCOMING";
    if (now >= endMs) {
        status = "FINISHED";
    } else if (now >= startMs && now < endMs) {
        status = "LIVE";
    }

    return {
        id,
        platform,
        platformName,
        title,
        url,
        startTime: isoStart,
        endTime: new Date(endMs).toISOString(),
        startTimestamp: startMs,
        endTimestamp: endMs,
        durationSeconds: durationHours * 3600,
        durationFormatted,
        type,
        status,
        division,
        rated,
        description,
    };
};

export const MOCK_EVENT_LIST: EventItem[] = [
    // -------------------------------------------------------------------------
    // OCTOBER 2026 - COMPLETE HIGH-DENSITY SCHEDULE (60+ CONTESTS)
    // -------------------------------------------------------------------------

    // Oct 1 (Thu)
    createContest(
        "cf-1114",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1114 (Div. 2)",
        "https://codeforces.com/contest/1114",
        "2026-10-01T20:05:00+05:30",
        2,
        "2h",
        "contest",
        "Div. 2",
        true
    ),
    createContest(
        "cses-sprint-8",
        "cses",
        "CSES",
        "CSES Algorithmic Sprint 8",
        "https://cses.fi/problemset/",
        "2026-10-01T18:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 2 (Fri)
    createContest(
        "atcoder-abc-471",
        "atcoder",
        "AtCoder",
        "AtCoder Beginner Contest 471",
        "https://atcoder.jp/contests/abc471",
        "2026-10-02T17:30:00+05:30",
        1.67,
        "1h 40m",
        "contest",
        null,
        true
    ),
    createContest(
        "hr-oct-challenge",
        "hackerrank",
        "HackerRank",
        "HackerRank October Code Challenge",
        "https://www.hackerrank.com/contests",
        "2026-10-02T20:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),

    // Oct 3 (Sat)
    createContest(
        "atcoder-arc-227",
        "atcoder",
        "AtCoder",
        "AtCoder Regular Contest-- 227",
        "https://atcoder.jp/contests/arc227",
        "2026-10-03T17:30:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "lc-biweekly-166",
        "leetcode",
        "LeetCode",
        "Biweekly Contest 166",
        "https://leetcode.com/contest/biweekly-contest-166",
        "2026-10-03T20:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "cf-1115",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1115 (Div. 1 + Div. 2)",
        "https://codeforces.com/contest/1115",
        "2026-10-03T20:05:00+05:30",
        2.5,
        "2h 30m",
        "contest",
        "Div. 1 + 2",
        true
    ),

    // Oct 4 (Sun)
    createContest(
        "lc-weekly-515",
        "leetcode",
        "LeetCode",
        "Weekly Contest 515",
        "https://leetcode.com/contest/weekly-contest-515",
        "2026-10-04T08:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "code360-143",
        "code360",
        "Code360",
        "Coding Ninjas Weekend Contest 143",
        "https://www.naukri.com/code360/contests",
        "2026-10-04T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "gfg-weekly-169",
        "geeksforgeeks",
        "GeeksforGeeks",
        "GfG Weekly Coding Contest 169",
        "https://practice.geeksforgeeks.org/events/rec/gfg-weekly-coding-contest",
        "2026-10-04T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 5 (Mon)
    createContest(
        "topcoder-srm-857",
        "topcoder",
        "TopCoder",
        "Single Round Match 857",
        "https://www.topcoder.com/community/events",
        "2026-10-05T18:30:00+05:30",
        2,
        "2h",
        "contest",
        "Div 1 & 2",
        true
    ),
    createContest(
        "ib-drift-a",
        "interviewbit",
        "InterviewBit",
        "Code Drift October Sprint",
        "https://www.interviewbit.com/contests",
        "2026-10-05T21:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 6 (Tue)
    createContest(
        "cf-edu-172",
        "codeforces",
        "Codeforces",
        "Educational Codeforces Round 172",
        "https://codeforces.com/contest/edu172",
        "2026-10-06T20:05:00+05:30",
        2,
        "2h",
        "contest",
        "Rated for Div. 2",
        true
    ),

    // Oct 7 (Wed)
    createContest(
        "cc-starters-258",
        "codechef",
        "CodeChef",
        "Starters 258 (Div. 1, 2, 3, 4)",
        "https://www.codechef.com/START258",
        "2026-10-07T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "he-circuits-sprint",
        "hackerearth",
        "HackerEarth",
        "HackerEarth Circuits '26 Kickoff",
        "https://www.hackerearth.com/challenges/",
        "2026-10-07T18:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),

    // Oct 8 (Thu)
    createContest(
        "cses-graph-sprint",
        "cses",
        "CSES",
        "CSES Graph Theory Challenge",
        "https://cses.fi/problemset/",
        "2026-10-08T19:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "spoj-classical-42",
        "spoj",
        "SPOJ",
        "SPOJ Classical Contest 42",
        "https://www.spoj.com/contests/",
        "2026-10-08T17:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 9 (Fri)
    createContest(
        "atcoder-abc-472",
        "atcoder",
        "AtCoder",
        "AtCoder Beginner Contest 472",
        "https://atcoder.jp/contests/abc472",
        "2026-10-09T17:30:00+05:30",
        1.67,
        "1h 40m",
        "contest",
        null,
        true
    ),
    createContest(
        "algo-xlr8-sprint",
        "algorithmxlr8",
        "AlgorithmXlr8",
        "AlgorithmXLR8 High-Throughput Sprint",
        "https://orbix.dev/algorithms",
        "2026-10-09T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 10 (Sat)
    createContest(
        "atcoder-arc-228",
        "atcoder",
        "AtCoder",
        "AtCoder Regular Contest-- 228",
        "https://atcoder.jp/contests/arc228",
        "2026-10-10T17:30:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "cf-1116",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1116 (Div. 3)",
        "https://codeforces.com/contest/1116",
        "2026-10-10T14:35:00+05:30",
        2.25,
        "2h 15m",
        "contest",
        "Div. 3",
        true
    ),
    createContest(
        "lc-biweekly-167",
        "leetcode",
        "LeetCode",
        "Biweekly Contest 167",
        "https://leetcode.com/contest/biweekly-contest-167",
        "2026-10-10T20:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 11 (Sun)
    createContest(
        "lc-weekly-516",
        "leetcode",
        "LeetCode",
        "Weekly Contest 516",
        "https://leetcode.com/contest/weekly-contest-516",
        "2026-10-11T08:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "code360-144",
        "code360",
        "Code360",
        "Coding Ninjas Weekend Contest 144",
        "https://www.naukri.com/code360/contests",
        "2026-10-11T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "gfg-weekly-170",
        "geeksforgeeks",
        "GeeksforGeeks",
        "GfG Weekly Coding Contest 170",
        "https://practice.geeksforgeeks.org/events/rec/gfg-weekly-coding-contest",
        "2026-10-11T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 12 (Mon)
    createContest(
        "hr-10days-algo",
        "hackerrank",
        "HackerRank",
        "10 Days of Algorithms Sprint",
        "https://www.hackerrank.com/contests",
        "2026-10-12T16:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),
    createContest(
        "topcoder-srm-858",
        "topcoder",
        "TopCoder",
        "Single Round Match 858",
        "https://www.topcoder.com/community/events",
        "2026-10-12T18:30:00+05:30",
        2,
        "2h",
        "contest",
        "Div 1 & 2",
        true
    ),

    // Oct 13 (Tue)
    createContest(
        "cf-1117",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1117 (Div. 2)",
        "https://codeforces.com/contest/1117",
        "2026-10-13T20:05:00+05:30",
        2,
        "2h",
        "contest",
        "Div. 2",
        true
    ),

    // Oct 14 (Wed)
    createContest(
        "cc-starters-259",
        "codechef",
        "CodeChef",
        "Starters 259 (Div. 1, 2, 3, 4)",
        "https://www.codechef.com/START259",
        "2026-10-14T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "ib-dp-marathon",
        "interviewbit",
        "InterviewBit",
        "InterviewBit Dynamic Programming Marathon",
        "https://www.interviewbit.com/contests",
        "2026-10-14T19:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 15 (Thu)
    createContest(
        "cf-edu-173",
        "codeforces",
        "Codeforces",
        "Educational Codeforces Round 173",
        "https://codeforces.com/contest/edu173",
        "2026-10-15T20:05:00+05:30",
        2,
        "2h",
        "contest",
        "Rated for Div. 2",
        true
    ),
    createContest(
        "cses-dp-sprint",
        "cses",
        "CSES",
        "CSES Dynamic Programming Sprint",
        "https://cses.fi/problemset/",
        "2026-10-15T18:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 16 (Fri)
    createContest(
        "atcoder-abc-473",
        "atcoder",
        "AtCoder",
        "AtCoder Beginner Contest 473",
        "https://atcoder.jp/contests/abc473",
        "2026-10-16T17:30:00+05:30",
        1.67,
        "1h 40m",
        "contest",
        null,
        true
    ),
    createContest(
        "he-oct-circuits",
        "hackerearth",
        "HackerEarth",
        "HackerEarth October Circuits '26",
        "https://www.hackerearth.com/challenges/",
        "2026-10-16T20:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),

    // Oct 17 (Sat)
    createContest(
        "atcoder-agc-072",
        "atcoder",
        "AtCoder",
        "AtCoder Grand Contest 072",
        "https://atcoder.jp/contests/agc072",
        "2026-10-17T17:30:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),
    createContest(
        "cf-1118",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1118 (Div. 1 + Div. 2)",
        "https://codeforces.com/contest/1118",
        "2026-10-17T20:05:00+05:30",
        2.5,
        "2h 30m",
        "contest",
        "Div. 1 + 2",
        true
    ),
    createContest(
        "lc-weekly-517",
        "leetcode",
        "LeetCode",
        "Weekly Contest 517",
        "https://leetcode.com/contest/weekly-contest-517",
        "2026-10-17T20:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 18 (Sun)
    createContest(
        "lc-weekly-518",
        "leetcode",
        "LeetCode",
        "Weekly Contest 518",
        "https://leetcode.com/contest/weekly-contest-518",
        "2026-10-18T08:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "atcoder-arc-229",
        "atcoder",
        "AtCoder",
        "AtCoder Regular Contest-- 229",
        "https://atcoder.jp/contests/arc229",
        "2026-10-18T17:30:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "code360-145",
        "code360",
        "Code360",
        "Coding Ninjas Weekend Contest 145",
        "https://www.naukri.com/code360/contests",
        "2026-10-18T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "gfg-weekly-171",
        "geeksforgeeks",
        "GeeksforGeeks",
        "GfG Weekly Coding Contest 171",
        "https://practice.geeksforgeeks.org/events/rec/gfg-weekly-coding-contest",
        "2026-10-18T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 19 (Mon)
    createContest(
        "topcoder-srm-859",
        "topcoder",
        "TopCoder",
        "Single Round Match 859",
        "https://www.topcoder.com/community/events",
        "2026-10-19T18:30:00+05:30",
        2,
        "2h",
        "contest",
        "Div 1 & 2",
        true
    ),
    createContest(
        "cf-1119",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1119 (Div. 3)",
        "https://codeforces.com/contest/1119",
        "2026-10-19T20:15:00+05:30",
        2.25,
        "2h 15m",
        "contest",
        "Div. 3",
        true
    ),

    // Oct 20 (Tue - TODAY)
    createContest(
        "cses-sprint-9",
        "cses",
        "CSES",
        "CSES Algorithmic Sprint 9",
        "https://cses.fi/problemset/",
        "2026-10-20T18:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "cf-edu-174",
        "codeforces",
        "Codeforces",
        "Educational Codeforces Round 174",
        "https://codeforces.com/contest/edu174",
        "2026-10-20T20:05:00+05:30",
        2,
        "2h",
        "contest",
        "Rated for Div. 2",
        true
    ),

    // Oct 21 (Wed - FEATURED UP NEXT)
    createContest(
        "starters-261",
        "codechef",
        "CodeChef",
        "Starters 261",
        "https://www.codechef.com/START261",
        "2026-10-21T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true,
        "Weekly rated contest for Division 1, 2, 3 and 4."
    ),
    createContest(
        "hr-codesprint-6",
        "hackerrank",
        "HackerRank",
        "University CodeSprint 6",
        "https://www.hackerrank.com/contests",
        "2026-10-21T18:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),

    // Oct 22 (Thu)
    createContest(
        "cf-1120",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1120 (Div. 2)",
        "https://codeforces.com/contest/1120",
        "2026-10-22T20:05:00+05:30",
        2,
        "2h",
        "contest",
        "Div. 2",
        true
    ),
    createContest(
        "cses-tree-algo",
        "cses",
        "CSES",
        "CSES Tree Algorithms Sprint",
        "https://cses.fi/problemset/",
        "2026-10-22T18:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 23 (Fri)
    createContest(
        "lc-biweekly-168",
        "leetcode",
        "LeetCode",
        "Biweekly Contest 168",
        "https://leetcode.com/contest/biweekly-contest-168",
        "2026-10-23T20:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "atcoder-abc-474",
        "atcoder",
        "AtCoder",
        "AtCoder Beginner Contest 474",
        "https://atcoder.jp/contests/abc474",
        "2026-10-23T17:30:00+05:30",
        1.67,
        "1h 40m",
        "contest",
        null,
        true
    ),
    createContest(
        "hr-world-codesprint",
        "hackerrank",
        "HackerRank",
        "World CodeSprint 2026",
        "https://www.hackerrank.com/contests",
        "2026-10-23T22:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),

    // Oct 24 (Sat)
    createContest(
        "atcoder-arc-230",
        "atcoder",
        "AtCoder",
        "AtCoder Regular Contest-- 230",
        "https://atcoder.jp/contests/arc230",
        "2026-10-24T17:30:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "cf-1121",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1121 (Div. 1 + Div. 2)",
        "https://codeforces.com/contest/1121",
        "2026-10-24T20:05:00+05:30",
        2.5,
        "2h 30m",
        "contest",
        "Div. 1 + 2",
        true
    ),

    // Oct 25 (Sun)
    createContest(
        "lc-weekly-519",
        "leetcode",
        "LeetCode",
        "Weekly Contest 519",
        "https://leetcode.com/contest/weekly-contest-519",
        "2026-10-25T08:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "topcoder-srm-860",
        "topcoder",
        "TopCoder",
        "Single Round Match 860",
        "https://www.topcoder.com/community/events",
        "2026-10-25T18:30:00+05:30",
        2,
        "2h",
        "contest",
        "Div 1 & 2",
        true
    ),
    createContest(
        "gfg-weekly-172",
        "geeksforgeeks",
        "GeeksforGeeks",
        "GfG Weekly Coding Contest 172",
        "https://practice.geeksforgeeks.org/events/rec/gfg-weekly-coding-contest",
        "2026-10-25T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),
    createContest(
        "code360-146",
        "code360",
        "Code360",
        "Coding Ninjas Weekend Contest 146",
        "https://www.naukri.com/code360/contests",
        "2026-10-25T19:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // Oct 26 (Mon)
    createContest(
        "ib-sys-design",
        "interviewbit",
        "InterviewBit",
        "System Design Challenge Round 1",
        "https://www.interviewbit.com/contests",
        "2026-10-26T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "spoj-monthly-oct",
        "spoj",
        "SPOJ",
        "SPOJ Monthly Sprint",
        "https://www.spoj.com/contests/",
        "2026-10-26T18:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 27 (Tue)
    createContest(
        "cf-1122",
        "codeforces",
        "Codeforces",
        "Codeforces Round 1122 (Div. 3)",
        "https://codeforces.com/contest/1122",
        "2026-10-27T20:05:00+05:30",
        2.25,
        "2h 15m",
        "contest",
        "Div. 3",
        true
    ),

    // Oct 28 (Wed)
    createContest(
        "cc-starters-262",
        "codechef",
        "CodeChef",
        "Starters 262 (Div. 1, 2, 3, 4)",
        "https://www.codechef.com/START262",
        "2026-10-28T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "he-dev-sprint",
        "hackerearth",
        "HackerEarth",
        "HackerEarth Developers Sprint",
        "https://www.hackerearth.com/challenges/",
        "2026-10-28T18:00:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),

    // Oct 29 (Thu)
    createContest(
        "cses-marathon",
        "cses",
        "CSES",
        "CSES Advanced Problemset Marathon",
        "https://cses.fi/problemset/",
        "2026-10-29T18:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),
    createContest(
        "algo-gpu-sprint",
        "algorithmxlr8",
        "AlgorithmXlr8",
        "AlgorithmXLR8 GPU Computing Challenge",
        "https://orbix.dev/algorithms",
        "2026-10-29T20:00:00+05:30",
        2,
        "2h",
        "contest",
        null,
        true
    ),

    // Oct 30 (Fri)
    createContest(
        "atcoder-abc-475",
        "atcoder",
        "AtCoder",
        "AtCoder Beginner Contest 475",
        "https://atcoder.jp/contests/abc475",
        "2026-10-30T17:30:00+05:30",
        1.67,
        "1h 40m",
        "contest",
        null,
        true
    ),
    createContest(
        "gfg-jobathon",
        "geeksforgeeks",
        "GeeksforGeeks",
        "GeeksforGeeks Mega Job-a-thon",
        "https://practice.geeksforgeeks.org/events/rec/job-a-thon",
        "2026-10-30T20:00:00+05:30",
        2.5,
        "2h 30m",
        "contest",
        null,
        true
    ),

    // Oct 31 (Sat)
    createContest(
        "atcoder-agc-073",
        "atcoder",
        "AtCoder",
        "AtCoder Grand Contest 073",
        "https://atcoder.jp/contests/agc073",
        "2026-10-31T17:30:00+05:30",
        3,
        "3h",
        "contest",
        null,
        true
    ),
    createContest(
        "cf-halloween-special",
        "codeforces",
        "Codeforces",
        "Codeforces Halloween Special Round",
        "https://codeforces.com/contest/halloween2026",
        "2026-10-31T20:05:00+05:30",
        3,
        "3h",
        "contest",
        "Div. 1 + 2",
        true
    ),
    createContest(
        "lc-biweekly-169",
        "leetcode",
        "LeetCode",
        "Biweekly Contest 169",
        "https://leetcode.com/contest/biweekly-contest-169",
        "2026-10-31T20:00:00+05:30",
        1.5,
        "1h 30m",
        "contest",
        null,
        true
    ),

    // -------------------------------------------------------------------------
    // HACKATHONS (October 2026)
    // -------------------------------------------------------------------------
    createContest(
        "hack-ai-autonomous",
        "hackerearth",
        "HackerEarth",
        "International Autonomous AI Hackathon 2026",
        "https://www.hackerearth.com/challenges/hackathon/",
        "2026-10-05T09:00:00+05:30",
        72,
        "3d",
        "hackathon",
        null,
        false,
        "$50,000 in bounties for autonomous AI developer tooling."
    ),
    createContest(
        "hack-quantum-security",
        "hackerearth",
        "HackerEarth",
        "Quantum Algorithms & Security Challenge",
        "https://www.hackerearth.com/challenges/hackathon/",
        "2026-10-14T09:00:00+05:30",
        96,
        "4d",
        "hackathon",
        null,
        false,
        "Post-quantum cryptographic implementations and benchmarking."
    ),
    createContest(
        "hack-web3-systems",
        "hackerrank",
        "HackerRank",
        "Global High-Concurrency Systems Hackathon",
        "https://www.hackerrank.com/contests",
        "2026-10-21T09:00:00+05:30",
        72,
        "3d",
        "hackathon",
        null,
        false,
        "Architecting zero-downtime distributed consensus nodes."
    ),
    createContest(
        "hack-genai-championship",
        "code360",
        "Code360",
        "GenAI Coding Assistant Hackathon 2026",
        "https://www.naukri.com/code360/contests",
        "2026-10-27T09:00:00+05:30",
        48,
        "2d",
        "hackathon",
        null,
        false,
        "Build the future of agentic coding IDE plugins."
    ),
];

// Fallback counts for fast rendering
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
    algorithmxlr8: 2,
};
