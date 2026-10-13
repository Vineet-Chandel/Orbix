export interface PortalConfig {
    id: string;
    name: string;
    placeholder: string;
    domainKeywords: string[];
    category: "cp" | "practice" | "dev";
    buildUrl: (username: string) => string;
    extractFromUrl: (url: string) => string | null;
    validateUsername: (username: string) => boolean;
    brandColor: string;
}

export interface JudgmentResult {
    raw: string;
    type: "empty" | "username" | "link";
    isValid: boolean;
    username: string;
    normalizedUrl: string;
    badgeLabel: string;
    badgeVariant: "neutral" | "username" | "link" | "error";
    message?: string;
}

const cleanInput = (val: string): string => val.trim();

const sanitizeUrl = (url: string): string => {
    return url.split("?")[0].split("#")[0].replace(/\/+$/, "");
};

export const PORTALS: Record<string, PortalConfig> = {
    leetcode: {
        id: "leetcode",
        name: "LeetCode",
        placeholder: "LeetCode username or leetcode.com/u/yourname",
        domainKeywords: ["leetcode.com"],
        category: "practice",
        brandColor: "#FFA116",
        buildUrl: (u) => `https://leetcode.com/u/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const reserved = [
                "problems",
                "problemset",
                "contest",
                "explore",
                "discuss",
                "studyplan",
                "company",
                "playground",
                "tag",
                "subscribe",
                "assessment",
                "support",
                "community",
            ];
            const matchU = clean.match(/leetcode\.com\/u\/([a-zA-Z0-9_\-]+)$/i);
            if (matchU) return matchU[1] ?? null;

            const matchDirect = clean.match(/leetcode\.com\/([a-zA-Z0-9_\-]+)$/i);
            if (matchDirect) {
                const candidate = matchDirect[1];
                if (reserved.includes(candidate.toLowerCase())) return null;
                return candidate;
            }
            return null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{3,30}$/.test(u),
    },
    codeforces: {
        id: "codeforces",
        name: "Codeforces",
        placeholder: "Codeforces username or codeforces.com/profile/yourname",
        domainKeywords: ["codeforces.com"],
        category: "cp",
        brandColor: "#1F8ACB",
        buildUrl: (u) => `https://codeforces.com/profile/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/codeforces\.com\/profile\/([a-zA-Z0-9_\.\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\.\-]{2,24}$/.test(u),
    },
    codechef: {
        id: "codechef",
        name: "CodeChef",
        placeholder: "CodeChef username or codechef.com/users/yourname",
        domainKeywords: ["codechef.com"],
        category: "cp",
        brandColor: "#5B4638",
        buildUrl: (u) => `https://www.codechef.com/users/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/codechef\.com\/users\/([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{3,25}$/.test(u),
    },
    geeksforgeeks: {
        id: "geeksforgeeks",
        name: "GeeksforGeeks",
        placeholder: "GeeksforGeeks username or geeksforgeeks.org/user/yourname",
        domainKeywords: ["geeksforgeeks.org"],
        category: "practice",
        brandColor: "#2F8D46",
        buildUrl: (u) => `https://www.geeksforgeeks.org/user/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/geeksforgeeks\.org\/(?:user|profile)\/([a-zA-Z0-9_.\-]+)(?:\/.*)?$/i);
            const reserved = [
                "home",
                "explore",
                "courses",
                "problems",
                "contests",
                "jobs",
                "practice",
                "articles",
                "about",
                "connect",
            ];
            if (match && reserved.includes(match[1].toLowerCase())) {
                return null;
            }
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_.\-]{1,50}$/.test(u),
    },
    hackerrank: {
        id: "hackerrank",
        name: "HackerRank",
        placeholder: "HackerRank username or hackerrank.com/profile/yourname",
        domainKeywords: ["hackerrank.com"],
        category: "practice",
        brandColor: "#00EA64",
        buildUrl: (u) => `https://www.hackerrank.com/profile/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const reserved = [
                "challenges",
                "domains",
                "dashboard",
                "leaderboard",
                "contests",
                "jobs",
                "administration",
                "auth",
                "login",
                "certificates",
                "scoring",
            ];
            const matchProfile = clean.match(/hackerrank\.com\/profile\/([a-zA-Z0-9_\-]+)$/i);
            if (matchProfile) return matchProfile[1] ?? null;

            const matchDirect = clean.match(/hackerrank\.com\/([a-zA-Z0-9_\-]+)$/i);
            if (matchDirect) {
                const candidate = matchDirect[1];
                if (reserved.includes(candidate.toLowerCase())) return null;
                return candidate;
            }
            return null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{2,30}$/.test(u),
    },
    atcoder: {
        id: "atcoder",
        name: "AtCoder",
        placeholder: "AtCoder username or atcoder.jp/users/yourname",
        domainKeywords: ["atcoder.jp"],
        category: "cp",
        brandColor: "#222222",
        buildUrl: (u) => `https://atcoder.jp/users/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/atcoder\.jp\/users\/([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{2,20}$/.test(u),
    },
    code360: {
        id: "code360",
        name: "Code360",
        placeholder: "Code360 username or naukri.com/code360/profile/yourname",
        domainKeywords: ["naukri.com", "codingninjas.com", "code360"],
        category: "practice",
        brandColor: "#FF5722",
        buildUrl: (u) => `https://www.naukri.com/code360/profile/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/(?:(?:naukri\.com\/code360\/profile|codingninjas\.com\/codestudio\/profile)\/)([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{3,35}$/.test(u),
    },
    interviewbit: {
        id: "interviewbit",
        name: "InterviewBit",
        placeholder: "InterviewBit username or interviewbit.com/profile/yourname",
        domainKeywords: ["interviewbit.com", "scaler.com"],
        category: "practice",
        brandColor: "#0D8BD9",
        buildUrl: (u) => `https://www.interviewbit.com/profile/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const reserved = [
                "practice",
                "problems",
                "courses",
                "topics",
                "settings",
                "connections",
                "dashboard",
                "overview",
                "certificates",
                "contest",
                "contests",
                "leaderboard",
                "pages",
                "mock-interview",
                "about",
                "jobs",
            ];
            const match =
                clean.match(/(?:interviewbit\.com|scaler\.com)\/(?:profile|user|users|u|academy\/profile)\/([a-zA-Z0-9_\.\-]+)/i) ||
                clean.match(/(?:interviewbit\.com|scaler\.com)\/([a-zA-Z0-9_\.\-]+)$/i);
            if (match && match[1]) {
                const candidate = match[1];
                if (reserved.includes(candidate.toLowerCase())) return null;
                return candidate;
            }
            return null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\.\-]{2,50}$/.test(u),
    },
    topcoder: {
        id: "topcoder",
        name: "TopCoder",
        placeholder: "TopCoder username or profiles.topcoder.com/yourname",
        domainKeywords: ["topcoder.com"],
        category: "cp",
        brandColor: "#29A7DF",
        buildUrl: (u) => `https://profiles.topcoder.com/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/(?:(?:profiles\.topcoder\.com\/|topcoder\.com\/members\/))([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{2,20}$/.test(u),
    },
    hackerearth: {
        id: "hackerearth",
        name: "HackerEarth",
        placeholder: "HackerEarth username or hackerearth.com/@yourname",
        domainKeywords: ["hackerearth.com"],
        category: "cp",
        brandColor: "#2C3454",
        buildUrl: (u) => `https://www.hackerearth.com/@${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/hackerearth\.com\/(?:@|community\/profile\/)([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{2,30}$/.test(u),
    },
    cses: {
        id: "cses",
        name: "CSES",
        placeholder: "CSES username or cses.fi/user/12345",
        domainKeywords: ["cses.fi"],
        category: "cp",
        brandColor: "#214478",
        buildUrl: (u) => `https://cses.fi/user/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/cses\.fi\/user\/([0-9a-zA-Z_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[0-9a-zA-Z_\-]{1,20}$/.test(u),
    },
    github: {
        id: "github",
        name: "GitHub",
        placeholder: "GitHub username or github.com/yourname",
        domainKeywords: ["github.com"],
        category: "dev",
        brandColor: "#24292E",
        buildUrl: (u) => `https://github.com/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const reserved = [
                "features",
                "marketplace",
                "explore",
                "topics",
                "trending",
                "pulls",
                "issues",
                "settings",
                "about",
                "pricing",
                "contact",
                "organizations",
                "login",
                "signup",
                "search",
                "notifications",
                "security",
            ];
            const match = clean.match(/github\.com\/([a-zA-Z0-9_\-]+)$/i);
            if (!match) return null;
            const candidate = match[1];
            if (reserved.includes(candidate.toLowerCase())) return null;
            return candidate;
        },
        validateUsername: (u) => /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(u),
    },
    spoj: {
        id: "spoj",
        name: "SPOJ",
        placeholder: "SPOJ username or spoj.com/users/yourname",
        domainKeywords: ["spoj.com"],
        category: "cp",
        brandColor: "#1B6AC9",
        buildUrl: (u) => `https://www.spoj.com/users/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/spoj\.com\/users\/([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{3,30}$/.test(u),
    },
    algorithmxlr8: {
        id: "algorithmxlr8",
        name: "AlgorithmXlr8",
        placeholder: "AlgorithmXlr8 username or algorithmxlr8.com/user/yourname",
        domainKeywords: ["algorithmxlr8.com", "algorithmxlr8"],
        category: "practice",
        brandColor: "#0284C7",
        buildUrl: (u) => `https://algorithmxlr8.com/user/${u}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/algorithmxlr8\.com\/(?:user|profile|u)\/([a-zA-Z0-9_\-]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{2,30}$/.test(u),
    },
    medium: {
        id: "medium",
        name: "Medium",
        placeholder: "Medium username or medium.com/@yourname",
        domainKeywords: ["medium.com"],
        category: "dev",
        brandColor: "#12100E",
        buildUrl: (u) => `https://medium.com/@${u.replace(/^@/, "")}`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const match = clean.match(/medium\.com\/@([a-zA-Z0-9_\-\.]+)$/i);
            return match ? match[1] ?? null : null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-\.]{2,30}$/.test(u.replace(/^@/, "")),
    },
    substack: {
        id: "substack",
        name: "Substack",
        placeholder: "Substack username or yourname.substack.com",
        domainKeywords: ["substack.com"],
        category: "dev",
        brandColor: "#FF6719",
        buildUrl: (u) => `https://${u}.substack.com`,
        extractFromUrl: (url) => {
            const clean = sanitizeUrl(url);
            const subMatch = clean.match(/([a-zA-Z0-9_\-]+)\.substack\.com$/i);
            if (subMatch && subMatch[1].toLowerCase() !== "www") return subMatch[1];
            const profileMatch = clean.match(/substack\.com\/@([a-zA-Z0-9_\-]+)$/i);
            if (profileMatch) return profileMatch[1];
            return null;
        },
        validateUsername: (u) => /^[a-zA-Z0-9_\-]{2,30}$/.test(u),
    },
};

export const DASHBOARD_PLATFORMS_ORDER = [
    "leetcode",
    "codeforces",
    "codechef",
    "geeksforgeeks",
    "hackerrank",
    "atcoder",
    "code360",
    "interviewbit",
    "topcoder",
    "hackerearth",
    "cses",
    "spoj",
    "github",
    "algorithmxlr8",
    "medium",
    "substack",
];

export const judgePortalInput = (portalId: string, rawValue: string): JudgmentResult => {
    const config = PORTALS[portalId];
    const cleaned = cleanInput(rawValue);

    if (!config || cleaned === "") {
        return {
            raw: rawValue,
            type: "empty",
            isValid: true,
            username: "",
            normalizedUrl: "",
            badgeLabel: "",
            badgeVariant: "neutral",
        };
    }

    // Check if input represents a Link (contains URL schemes, slashes, or domain dots)
    const isLinkCandidate =
        cleaned.startsWith("http://") ||
        cleaned.startsWith("https://") ||
        cleaned.startsWith("www.") ||
        cleaned.includes("/") ||
        cleaned.includes(".com") ||
        cleaned.includes(".org") ||
        cleaned.includes(".jp") ||
        cleaned.includes(".fi");

    if (isLinkCandidate) {
        // Link Judgment
        const hasMatchingDomain = config.domainKeywords.some((keyword) =>
            cleaned.toLowerCase().includes(keyword.toLowerCase())
        );

        if (!hasMatchingDomain) {
            return {
                raw: rawValue,
                type: "link",
                isValid: false,
                username: "",
                normalizedUrl: "",
                badgeLabel: "Domain Mismatch",
                badgeVariant: "error",
                message: `Pasted link does not match ${config.name} (${config.domainKeywords[0]})`,
            };
        }

        const extractedUsername = config.extractFromUrl(cleaned);
        if (!extractedUsername) {
            // Check if it's a known non-profile path like GitHub repo
            if (portalId === "github" && cleaned.includes("github.com/") && cleaned.split("github.com/")[1]?.includes("/")) {
                return {
                    raw: rawValue,
                    type: "link",
                    isValid: false,
                    username: "",
                    normalizedUrl: "",
                    badgeLabel: "Repo Link",
                    badgeVariant: "error",
                    message: "Repository link detected. Please enter your user profile link (github.com/yourname)",
                };
            }
            if (portalId === "leetcode" && cleaned.toLowerCase().includes("/problems/")) {
                return {
                    raw: rawValue,
                    type: "link",
                    isValid: false,
                    username: "",
                    normalizedUrl: "",
                    badgeLabel: "Problem Link",
                    badgeVariant: "error",
                    message: "Problem link detected. Please enter your profile link (leetcode.com/u/yourname)",
                };
            }
            if (portalId === "geeksforgeeks" && (cleaned.toLowerCase().includes("/problems/") || cleaned.toLowerCase().includes("/courses/") || cleaned.toLowerCase().includes("/articles/"))) {
                return {
                    raw: rawValue,
                    type: "link",
                    isValid: false,
                    username: "",
                    normalizedUrl: "",
                    badgeLabel: "Problem/Course Link",
                    badgeVariant: "error",
                    message: "Problem or course link detected. Please enter your profile link (geeksforgeeks.org/user/yourname)",
                };
            }

            return {
                raw: rawValue,
                type: "link",
                isValid: false,
                username: "",
                normalizedUrl: "",
                badgeLabel: "Invalid Link",
                badgeVariant: "error",
                message: `Could not parse handle from ${config.name} URL. Expected: ${config.placeholder}`,
            };
        }

        if (!config.validateUsername(extractedUsername)) {
            return {
                raw: rawValue,
                type: "link",
                isValid: false,
                username: extractedUsername,
                normalizedUrl: "",
                badgeLabel: "Invalid Handle",
                badgeVariant: "error",
                message: `Handle "@${extractedUsername}" contains invalid characters for ${config.name}`,
            };
        }

        const normalizedUrl = config.buildUrl(extractedUsername);
        return {
            raw: rawValue,
            type: "link",
            isValid: true,
            username: extractedUsername,
            normalizedUrl,
            badgeLabel: "Full Link",
            badgeVariant: "link",
            message: `Extracted username: @${extractedUsername}`,
        };
    }

    // Username Judgment
    let candidateUsername = cleaned;
    if (candidateUsername.startsWith("@")) {
        candidateUsername = candidateUsername.slice(1);
    }

    if (!config.validateUsername(candidateUsername)) {
        return {
            raw: rawValue,
            type: "username",
            isValid: false,
            username: candidateUsername,
            normalizedUrl: "",
            badgeLabel: "Invalid Handle",
            badgeVariant: "error",
            message: `Handle contains invalid characters for ${config.name}`,
        };
    }

    const normalizedUrl = config.buildUrl(candidateUsername);
    return {
        raw: rawValue,
        type: "username",
        isValid: true,
        username: candidateUsername,
        normalizedUrl,
        badgeLabel: "Username",
        badgeVariant: "username",
        message: `Public link: ${normalizedUrl.replace(/^https?:\/\//, "")}`,
    };
};
