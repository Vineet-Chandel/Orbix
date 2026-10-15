import { PORTALS } from "./portalParser";

export type PlatformCategory =
    | "Competitive programming"
    | "Developer and coding practice"
    | "Interview preparation"
    | "Algorithm practice"
    | "Developer portfolio"
    | "Developer and coding community"
    | "Publishing";

export interface PlatformDefinition {
    id: string;
    name: string;
    category: PlatformCategory;
    categoryGroup: "Competitive Programming" | "Coding Practice" | "Portfolio & Publishing";
    placeholder: string;
    brandColor: string;
    domainKeywords: string[];
    buildUrl: (username: string) => string;
    extractFromUrl: (url: string) => string | null;
    validateUsername: (username: string) => boolean;
}

/**
 * Exactly 16 supported platforms in the official catalogue.
 * Ordered matching the specification table.
 */
export const PLATFORM_REGISTRY: PlatformDefinition[] = [
    {
        id: "leetcode",
        name: "LeetCode",
        category: "Competitive programming",
        categoryGroup: "Competitive Programming",
        placeholder: "username or leetcode.com/u/yourname",
        brandColor: "#FFA116",
        domainKeywords: ["leetcode.com"],
        buildUrl: (u) => PORTALS.leetcode.buildUrl(u),
        extractFromUrl: (url) => PORTALS.leetcode.extractFromUrl(url),
        validateUsername: (u) => PORTALS.leetcode.validateUsername(u),
    },
    {
        id: "codeforces",
        name: "Codeforces",
        category: "Competitive programming",
        categoryGroup: "Competitive Programming",
        placeholder: "username or codeforces.com/profile/yourname",
        brandColor: "#1F8ACB",
        domainKeywords: ["codeforces.com"],
        buildUrl: (u) => PORTALS.codeforces.buildUrl(u),
        extractFromUrl: (url) => PORTALS.codeforces.extractFromUrl(url),
        validateUsername: (u) => PORTALS.codeforces.validateUsername(u),
    },
    {
        id: "codechef",
        name: "CodeChef",
        category: "Competitive programming",
        categoryGroup: "Competitive Programming",
        placeholder: "username or codechef.com/users/yourname",
        brandColor: "#5B4638",
        domainKeywords: ["codechef.com"],
        buildUrl: (u) => PORTALS.codechef.buildUrl(u),
        extractFromUrl: (url) => PORTALS.codechef.extractFromUrl(url),
        validateUsername: (u) => PORTALS.codechef.validateUsername(u),
    },
    {
        id: "geeksforgeeks",
        name: "GeeksforGeeks",
        category: "Developer and coding practice",
        categoryGroup: "Coding Practice",
        placeholder: "username or geeksforgeeks.org/user/yourname",
        brandColor: "#2F8D46",
        domainKeywords: ["geeksforgeeks.org"],
        buildUrl: (u) => PORTALS.geeksforgeeks.buildUrl(u),
        extractFromUrl: (url) => PORTALS.geeksforgeeks.extractFromUrl(url),
        validateUsername: (u) => PORTALS.geeksforgeeks.validateUsername(u),
    },
    {
        id: "hackerrank",
        name: "HackerRank",
        category: "Developer and coding practice",
        categoryGroup: "Coding Practice",
        placeholder: "username or hackerrank.com/profile/yourname",
        brandColor: "#00EA64",
        domainKeywords: ["hackerrank.com"],
        buildUrl: (u) => PORTALS.hackerrank.buildUrl(u),
        extractFromUrl: (url) => PORTALS.hackerrank.extractFromUrl(url),
        validateUsername: (u) => PORTALS.hackerrank.validateUsername(u),
    },
    {
        id: "atcoder",
        name: "AtCoder",
        category: "Competitive programming",
        categoryGroup: "Competitive Programming",
        placeholder: "username or atcoder.jp/users/yourname",
        brandColor: "#222222",
        domainKeywords: ["atcoder.jp"],
        buildUrl: (u) => PORTALS.atcoder.buildUrl(u),
        extractFromUrl: (url) => PORTALS.atcoder.extractFromUrl(url),
        validateUsername: (u) => PORTALS.atcoder.validateUsername(u),
    },
    {
        id: "code360",
        name: "Code360",
        category: "Developer and coding practice",
        categoryGroup: "Coding Practice",
        placeholder: "username or naukri.com/code360/profile/yourname",
        brandColor: "#FF5722",
        domainKeywords: ["naukri.com", "codingninjas.com", "code360"],
        buildUrl: (u) => PORTALS.code360.buildUrl(u),
        extractFromUrl: (url) => PORTALS.code360.extractFromUrl(url),
        validateUsername: (u) => PORTALS.code360.validateUsername(u),
    },
    {
        id: "interviewbit",
        name: "InterviewBit",
        category: "Interview preparation",
        categoryGroup: "Coding Practice",
        placeholder: "username or interviewbit.com/profile/yourname",
        brandColor: "#0D8BD9",
        domainKeywords: ["interviewbit.com", "scaler.com"],
        buildUrl: (u) => PORTALS.interviewbit.buildUrl(u),
        extractFromUrl: (url) => PORTALS.interviewbit.extractFromUrl(url),
        validateUsername: (u) => PORTALS.interviewbit.validateUsername(u),
    },
    {
        id: "topcoder",
        name: "TopCoder",
        category: "Competitive programming",
        categoryGroup: "Competitive Programming",
        placeholder: "username or profiles.topcoder.com/yourname",
        brandColor: "#29A7DF",
        domainKeywords: ["topcoder.com"],
        buildUrl: (u) => PORTALS.topcoder.buildUrl(u),
        extractFromUrl: (url) => PORTALS.topcoder.extractFromUrl(url),
        validateUsername: (u) => PORTALS.topcoder.validateUsername(u),
    },
    {
        id: "hackerearth",
        name: "HackerEarth",
        category: "Developer and coding practice",
        categoryGroup: "Coding Practice",
        placeholder: "username or hackerearth.com/@yourname",
        brandColor: "#2C3454",
        domainKeywords: ["hackerearth.com"],
        buildUrl: (u) => PORTALS.hackerearth.buildUrl(u),
        extractFromUrl: (url) => PORTALS.hackerearth.extractFromUrl(url),
        validateUsername: (u) => PORTALS.hackerearth.validateUsername(u),
    },
    {
        id: "cses",
        name: "CSES",
        category: "Algorithm practice",
        categoryGroup: "Competitive Programming",
        placeholder: "user ID (e.g. 12345) or cses.fi/user/12345",
        brandColor: "#214478",
        domainKeywords: ["cses.fi"],
        buildUrl: (u) => PORTALS.cses.buildUrl(u),
        extractFromUrl: (url) => PORTALS.cses.extractFromUrl(url),
        validateUsername: (u) => PORTALS.cses.validateUsername(u),
    },
    {
        id: "spoj",
        name: "SPOJ",
        category: "Competitive programming",
        categoryGroup: "Competitive Programming",
        placeholder: "username or spoj.com/users/yourname",
        brandColor: "#1B6AC9",
        domainKeywords: ["spoj.com"],
        buildUrl: (u) => PORTALS.spoj.buildUrl(u),
        extractFromUrl: (url) => PORTALS.spoj.extractFromUrl(url),
        validateUsername: (u) => PORTALS.spoj.validateUsername(u),
    },
    {
        id: "github",
        name: "GitHub",
        category: "Developer portfolio",
        categoryGroup: "Portfolio & Publishing",
        placeholder: "username or github.com/yourname",
        brandColor: "#24292E",
        domainKeywords: ["github.com"],
        buildUrl: (u) => PORTALS.github.buildUrl(u),
        extractFromUrl: (url) => PORTALS.github.extractFromUrl(url),
        validateUsername: (u) => PORTALS.github.validateUsername(u),
    },
    {
        id: "algorithmxlr8",
        name: "AlgorithmXlr8",
        category: "Developer and coding community",
        categoryGroup: "Coding Practice",
        placeholder: "username or algorithmxlr8.com/user/yourname",
        brandColor: "#0284C7",
        domainKeywords: ["algorithmxlr8.com"],
        buildUrl: (u) => PORTALS.algorithmxlr8.buildUrl(u),
        extractFromUrl: (url) => PORTALS.algorithmxlr8.extractFromUrl(url),
        validateUsername: (u) => PORTALS.algorithmxlr8.validateUsername(u),
    },
    {
        id: "medium",
        name: "Medium",
        category: "Publishing",
        categoryGroup: "Portfolio & Publishing",
        placeholder: "username or medium.com/@yourname",
        brandColor: "#12100E",
        domainKeywords: ["medium.com"],
        buildUrl: (u) => PORTALS.medium.buildUrl(u),
        extractFromUrl: (url) => PORTALS.medium.extractFromUrl(url),
        validateUsername: (u) => PORTALS.medium.validateUsername(u),
    },
    {
        id: "substack",
        name: "Substack",
        category: "Publishing",
        categoryGroup: "Portfolio & Publishing",
        placeholder: "username or yourname.substack.com",
        brandColor: "#FF6719",
        domainKeywords: ["substack.com"],
        buildUrl: (u) => PORTALS.substack.buildUrl(u),
        extractFromUrl: (url) => PORTALS.substack.extractFromUrl(url),
        validateUsername: (u) => PORTALS.substack.validateUsername(u),
    },
];

export const TOTAL_SUPPORTED_PLATFORMS = PLATFORM_REGISTRY.length; // Exactly 16

export const getPlatformDefinition = (id: string): PlatformDefinition | undefined => {
    return PLATFORM_REGISTRY.find((p) => p.id === id.toLowerCase().trim());
};

export const detectPlatform = (input: string): PlatformDefinition | undefined => {
    if (!input || typeof input !== "string") return undefined;
    const clean = input.trim().toLowerCase();

    for (const def of PLATFORM_REGISTRY) {
        if (def.domainKeywords.some((kw) => clean.includes(kw))) {
            return def;
        }
    }
    return undefined;
};
