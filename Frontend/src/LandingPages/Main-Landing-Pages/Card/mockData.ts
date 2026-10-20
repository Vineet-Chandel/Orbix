import type { CardThemeConfig } from "../../../app/Profile/CardStudio/types";
import { CARD_THEMES } from "../../../app/Profile/CardStudio/types";
import type {
    AggregatedCodingStats,
    CoderTypeBadge,
    GitHubCardStats,
    RankedPlatform,
    ConnectedPlatformBadge,
    RankedContestPlatform,
} from "../../../utils/cardStatsAggregator";

/**
 * Deterministically generates a rich, highly active, representative submission calendar
 * covering the last 220 days (31+ weeks) with full submissions on every single day.
 */
function generateRepresentativeCalendar(seedOffset: number): Record<string, number> {
    const calendar: Record<string, number> = {};
    const today = new Date();
    const seed = 1337 + seedOffset;

    const rand = (offset: number) => {
        const x = Math.sin(seed + offset * 9301 + 49297) * 233280;
        return x - Math.floor(x);
    };

    // Ensure all 28 weeks (196 days) plus extra buffer (220 days) are completely populated with submissions
    for (let i = 219; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split("T")[0] || "";
        const localDateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        const r = rand(i);
        let count = 0;

        if (seedOffset === 11) {
            // LeetCode: high daily practice (2 to 8 submissions every day)
            count = Math.floor(rand(i + 100) * 7) + 2;
        } else if (seedOffset === 22) {
            // Codeforces: 1 to 4 submissions on 85% of days
            if (r > 0.15) count = Math.floor(rand(i + 200) * 4) + 1;
        } else if (seedOffset === 33) {
            // CodeChef: 1 to 3 submissions on 80% of days
            if (r > 0.20) count = Math.floor(rand(i + 300) * 3) + 1;
        } else if (seedOffset === 44) {
            // GeeksforGeeks: 1 to 4 submissions on 85% of days
            if (r > 0.15) count = Math.floor(rand(i + 400) * 4) + 1;
        } else {
            // HackerRank: 1 to 2 submissions on 70% of days
            if (r > 0.30) count = Math.floor(rand(i + 500) * 2) + 1;
        }

        if (count > 0) {
            calendar[dateStr] = count;
            calendar[localDateKey] = count;
        }
    }

    return calendar;
}

export const mockUser = {
    firstName: "Vineet",
    lastName: "Chandel",
    username: "Vineet-Chandel",
    headline: "Senior Staff Software Engineer & System Architect",
    photoUrl: "/avatar.png",
    avatarUrl: "/avatar.png",
    linkedin: "https://linkedin.com/in/Vineet-Chandel",
    github: "https://github.com/Vineet-Chandel",
    website: "https://orbix.dev/u/Vineet-Chandel",
    links: {
        github: "https://github.com/Vineet-Chandel",
        linkedin: "https://linkedin.com/in/Vineet-Chandel",
        portfolio: "https://orbix.dev/u/Vineet-Chandel",
        leetcode: "https://leetcode.com/u/Vineet-Chandel",
    },
};

export const mockStats: AggregatedCodingStats = {
    totalSolved: 1680,
    easy: 480,
    medium: 890,
    hard: 310,
    activeDays: 520,
    contests: 96,
    dayStreak: 48,
    eligiblePlatformsCount: 12,
    synchronizedCount: 12,
    incompleteSync: false,
    qualificationNote: "Grandmaster Track",
};

export const mockCoderType: CoderTypeBadge = {
    title: "The Explorer",
    tagline: "Codes on 12 platforms",
    level: "Grandmaster",
    badgeColor: "#6366F1",
};

export const mockTopPlatforms: RankedPlatform[] = [
    {
        id: "github",
        name: "GitHub",
        username: "Vineet-Chandel",
        profileUrl: "https://github.com/Vineet-Chandel",
        brandColor: "#24292e",
        isGitHub: true,
        category: "dev",
        contributionsOrCommits: 3180,
        publicRepos: 62,
        bestWorkingDay: "Wednesday",
        isVerified: true,
        solvedCount: 0,
    },
    {
        id: "leetcode",
        name: "LeetCode",
        username: "Vineet-Chandel",
        profileUrl: "https://leetcode.com/u/Vineet-Chandel",
        brandColor: "#FFA116",
        solvedCount: 912,
        rating: 2340,
        peakRating: 2385,
        tier: "Guardian",
        tierColor: "#F59E0B",
        contestsCount: 56,
        hasGoodRating: true,
        isVerified: true,
        category: "practice",
    },
    {
        id: "codeforces",
        name: "Codeforces",
        username: "Vineet-Chandel",
        profileUrl: "https://codeforces.com/profile/Vineet-Chandel",
        brandColor: "#1F8ACB",
        solvedCount: 468,
        rating: 2045,
        peakRating: 2090,
        tier: "Candidate Master",
        tierColor: "#aa00aa",
        contestsCount: 38,
        hasGoodRating: true,
        isVerified: true,
        category: "practice",
    },
    {
        id: "codechef",
        name: "CodeChef",
        username: "Vineet-Chandel",
        profileUrl: "https://www.codechef.com/users/Vineet-Chandel",
        brandColor: "#5B4638",
        solvedCount: 342,
        rating: 2215,
        peakRating: 2250,
        tier: "6 Star",
        tierColor: "#eed000",
        contestsCount: 26,
        hasGoodRating: true,
        isVerified: true,
        category: "practice",
    },
    {
        id: "geeksforgeeks",
        name: "GeeksforGeeks",
        username: "Vineet-Chandel",
        profileUrl: "https://auth.geeksforgeeks.org/user/Vineet-Chandel",
        brandColor: "#2F8D46",
        solvedCount: 410,
        isVerified: true,
        category: "practice",
    },
    {
        id: "hackerrank",
        name: "HackerRank",
        username: "Vineet-Chandel",
        profileUrl: "https://www.hackerrank.com/Vineet-Chandel",
        brandColor: "#00EA64",
        solvedCount: 245,
        isVerified: true,
        category: "practice",
    },
];

export const mockAllConnectedPlatforms: ConnectedPlatformBadge[] = [
    {
        id: "leetcode",
        name: "LeetCode",
        username: "Vineet-Chandel",
        profileUrl: "https://leetcode.com/u/Vineet-Chandel",
        brandColor: "#FFA116",
        solvedCount: 912,
        isVerified: true,
    },
    {
        id: "codeforces",
        name: "Codeforces",
        username: "Vineet-Chandel",
        profileUrl: "https://codeforces.com/profile/Vineet-Chandel",
        brandColor: "#1F8ACB",
        solvedCount: 468,
        isVerified: true,
    },
    {
        id: "codechef",
        name: "CodeChef",
        username: "Vineet-Chandel",
        profileUrl: "https://www.codechef.com/users/Vineet-Chandel",
        brandColor: "#5B4638",
        solvedCount: 342,
        isVerified: true,
    },
    // {
    //     id: "github",
    //     name: "GitHub",
    //     username: "Vineet-Chandel",
    //     profileUrl: "https://github.com/Vineet-Chandel",
    //     brandColor: "#24292e",
    //     solvedCount: 0,
    //     isVerified: true,
    // },
    {
        id: "geeksforgeeks",
        name: "GeeksforGeeks",
        username: "Vineet-Chandel",
        profileUrl: "https://auth.geeksforgeeks.org/user/Vineet-Chandel",
        brandColor: "#2F8D46",
        solvedCount: 410,
        isVerified: true,
    },
    {
        id: "hackerrank",
        name: "HackerRank",
        username: "Vineet-Chandel",
        profileUrl: "https://www.hackerrank.com/Vineet-Chandel",
        brandColor: "#00EA64",
        solvedCount: 245,
        isVerified: true,
    },
    {
        id: "atcoder",
        name: "AtCoder",
        username: "Vineet-Chandel",
        profileUrl: "https://atcoder.jp/users/Vineet-Chandel",
        brandColor: "#222222",
        solvedCount: 140,
        isVerified: true,
    },
    // {
    //     id: "kaggle",
    //     name: "Kaggle",
    //     username: "Vineet-Chandel",
    //     profileUrl: "https://www.kaggle.com/Vineet-Chandel",
    //     brandColor: "#20BEFF",
    //     solvedCount: 82,
    //     isVerified: true,
    // },
    // {
    //     id: "gitlab",
    //     name: "GitLab",
    //     username: "Vineet-Chandel",
    //     profileUrl: "https://gitlab.com/Vineet-Chandel",
    //     brandColor: "#FC6D26",
    //     solvedCount: 0,
    //     isVerified: true,
    // },
    // {
    //     id: "bitbucket",
    //     name: "Bitbucket",
    //     username: "Vineet-Chandel",
    //     profileUrl: "https://bitbucket.org/Vineet-Chandel",
    //     brandColor: "#0052CC",
    //     solvedCount: 0,
    //     isVerified: true,
    // },
    {
        id: "code360",
        name: "Code360",
        username: "Vineet-Chandel",
        profileUrl: "https://naukri.com/code360/profile/Vineet-Chandel",
        brandColor: "#FF5722",
        solvedCount: 165,
        isVerified: true,
    },
    {
        id: "interviewbit",
        name: "InterviewBit",
        username: "Vineet-Chandel",
        profileUrl: "https://www.interviewbit.com/profile/Vineet-Chandel",
        brandColor: "#0D8BD9",
        solvedCount: 130,
        isVerified: true,
    },
];

export const mockGithubStats: GitHubCardStats = {
    connected: true,
    username: "Vineet-Chandel",
    name: "Vineet Chandel",
    avatarUrl: "/avatar.png",
    publicRepos: 62,
    contributionsOrCommits: 3180,
    followers: 840,
    profileUrl: "https://github.com/Vineet-Chandel",
    bestWorkingDay: "Wednesday",
};

export const mockTheme: CardThemeConfig = CARD_THEMES.indigo;

export const mockPublicProfileUrl = "https://orbix.dev/u/Vineet-Chandel";

export const mockConnectedPortals: Record<string, any> = {
    leetcode: {
        username: "Vineet-Chandel",
        name: "LeetCode",
        submissionCalendar: generateRepresentativeCalendar(11),
        stats: [
            { label: "solved", value: "912" },
            { label: "submissions", value: "1,840" },
            { label: "active days", value: "280" },
        ],
    },
    codeforces: {
        username: "Vineet-Chandel",
        name: "Codeforces",
        submissionCalendar: generateRepresentativeCalendar(22),
        stats: [
            { label: "solved", value: "468" },
            { label: "submissions", value: "890" },
            { label: "active days", value: "145" },
        ],
    },
    codechef: {
        username: "Vineet-Chandel",
        name: "CodeChef",
        submissionCalendar: generateRepresentativeCalendar(33),
        stats: [
            { label: "solved", value: "342" },
            { label: "submissions", value: "680" },
            { label: "active days", value: "112" },
        ],
    },
    geeksforgeeks: {
        username: "Vineet-Chandel",
        name: "GeeksforGeeks",
        submissionCalendar: generateRepresentativeCalendar(44),
        stats: [
            { label: "solved", value: "410" },
            { label: "submissions", value: "720" },
            { label: "active days", value: "130" },
        ],
    },
    hackerrank: {
        username: "Vineet-Chandel",
        name: "HackerRank",
        submissionCalendar: generateRepresentativeCalendar(55),
        stats: [
            { label: "solved", value: "245" },
            { label: "submissions", value: "410" },
            { label: "active days", value: "82" },
        ],
    },
    github: {
        username: "Vineet-Chandel",
    },
};

export const mockTopContests: RankedContestPlatform[] = [
    {
        id: "leetcode",
        name: "LeetCode",
        username: "Vineet-Chandel",
        rating: 2340,
        peakRating: 2385,
        tier: "Guardian",
        tierColor: "#F59E0B",
        officialRank: 620,
        ratedContestsCount: 56,
        isVerified: true,
    },
    {
        id: "codeforces",
        name: "Codeforces",
        username: "Vineet-Chandel",
        rating: 2045,
        peakRating: 2090,
        tier: "Candidate Master",
        tierColor: "#aa00aa",
        officialRank: 1980,
        ratedContestsCount: 38,
        isVerified: true,
    },
    {
        id: "codechef",
        name: "CodeChef",
        username: "Vineet-Chandel",
        rating: 2215,
        peakRating: 2250,
        tier: "6 Star",
        tierColor: "#eed000",
        officialRank: 840,
        ratedContestsCount: 26,
        isVerified: true,
    },
];
