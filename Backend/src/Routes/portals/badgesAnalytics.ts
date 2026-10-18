import { pool } from "../../database/client.js";

export interface UnifiedBadgeRecord {
    id: string;
    platform: string;
    platformName: string;
    name: string;
    displayName: string;
    category?: string;
    icon: string;
    hoverText?: string | null;
    description?: string | null;
    creationDate?: string | null;
    earnedTimestamp?: number | null;
    profileUrl?: string | null;
}

export interface UnifiedBadgesResponse {
    success: boolean;
    username: string;
    totalEarned: number;
    platformCounts: Record<string, number>;
    badges: UnifiedBadgeRecord[];
    timestamp: string;
}

/**
 * Fetch official badges from LeetCode GraphQL
 */
export async function fetchLeetCodeBadges(username: string): Promise<UnifiedBadgeRecord[]> {
    try {
        const query = `query userBadges($username: String!) {
            matchedUser(username: $username) {
                badges {
                    id
                    name
                    shortName
                    displayName
                    icon
                    hoverText
                    creationDate
                    category
                }
            }
        }`;

        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com",
                "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({ query, variables: { username } }),
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return [];
        const data = (await res.json()) as any;
        const rawBadges = data?.data?.matchedUser?.badges;
        if (!Array.isArray(rawBadges)) return [];

        return rawBadges.map((b: any) => {
            let iconUrl = b.icon || "";
            if (iconUrl.startsWith("/")) {
                iconUrl = `https://leetcode.com${iconUrl}`;
            }

            const ts = b.creationDate ? new Date(b.creationDate).getTime() : null;

            return {
                id: `leetcode-${b.id || b.name || Math.random()}`,
                platform: "leetcode",
                platformName: "LeetCode",
                name: b.name || "Badge",
                displayName: b.displayName || b.name || "Badge",
                category: b.category || "GENERAL",
                icon: iconUrl,
                hoverText: b.hoverText || null,
                description: b.hoverText || b.displayName || null,
                creationDate: b.creationDate || null,
                earnedTimestamp: ts,
                profileUrl: `https://leetcode.com/u/${username}`,
            };
        });
    } catch {
        return [];
    }
}

/**
 * Fetch badges from HackerRank REST API
 */
export async function fetchHackerRankBadges(username: string): Promise<UnifiedBadgeRecord[]> {
    try {
        const res = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return [];
        const data = (await res.json()) as any;
        const models = data?.models;
        if (!Array.isArray(models)) return [];

        return models.map((b: any) => {
            const domain = b.badge_name || b.name || "Problem Solving";
            const stars = b.stars || 1;
            return {
                id: `hackerrank-${domain.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                platform: "hackerrank",
                platformName: "HackerRank",
                name: `${domain} Badge`,
                displayName: `${stars}★ ${domain}`,
                category: "SKILL",
                icon: b.icon || "https://hrcdn.net/fcore/assets/work/header/hackerrank_logo.png",
                hoverText: `${stars} Stars in ${domain}`,
                description: `${stars} Star Proficiency Badge in ${domain}`,
                creationDate: null,
                earnedTimestamp: null,
                profileUrl: `https://www.hackerrank.com/${username}`,
            };
        });
    } catch {
        return [];
    }
}

/**
 * Fetch GitHub achievements if connected
 */
export async function fetchGitHubBadges(username: string): Promise<UnifiedBadgeRecord[]> {
    try {
        const res = await fetch(`https://github.com/${encodeURIComponent(username)}?tab=achievements`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(4500),
        });

        if (!res.ok) return [];
        const html = await res.text();
        const badges: UnifiedBadgeRecord[] = [];
        const regex = /<img[^>]+src=[\x27"]([^\x27"]+)[\x27"][^>]+alt=[\x27"]Achievement:\s*([^\x27"]+)[\x27"][^>]*>/gi;

        let match;
        while ((match = regex.exec(html)) !== null) {
            const icon = match[1] || "";
            const name = match[2] || "Achievement";
            const id = `github-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
            if (!badges.some((b) => b.id === id)) {
                badges.push({
                    id,
                    platform: "github",
                    platformName: "GitHub",
                    name,
                    displayName: name,
                    category: "DEVELOPMENT",
                    icon,
                    hoverText: `GitHub Achievement: ${name}`,
                    description: `Earned GitHub ${name} badge for open source and repository contributions.`,
                    creationDate: null,
                    earnedTimestamp: null,
                    profileUrl: `https://github.com/${username}`,
                });
            }
        }

        return badges;
    } catch {
        return [];
    }
}

/**
 * Main aggregator for user badges across all connected platforms
 */
export async function calculateUserBadges(
    username: string,
    clientPortals?: Record<string, string>
): Promise<UnifiedBadgesResponse> {
    const cleanUser = (username || "").trim();
    if (!cleanUser) {
        return {
            success: false,
            username: "",
            totalEarned: 0,
            platformCounts: {},
            badges: [],
            timestamp: new Date().toISOString(),
        };
    }

    // 1. Identify connected platforms
    const connectedPortals: Record<string, string> = {};

    try {
        const dbResult = await pool.query(
            "SELECT portal, portal_username FROM user_links WHERE username = $1 AND verified = true",
            [cleanUser]
        );
        for (const row of dbResult.rows) {
            if (row.portal && row.portal_username) {
                connectedPortals[row.portal.toLowerCase().trim()] = row.portal_username.trim();
            }
        }
    } catch (err) {
        console.error("Error reading user_links for badges:", err);
    }

    // Merge client-provided handles if present
    if (clientPortals && typeof clientPortals === "object") {
        for (const [k, v] of Object.entries(clientPortals)) {
            if (v && typeof v === "string") {
                const lower = k.toLowerCase().trim();
                if (!connectedPortals[lower]) {
                    connectedPortals[lower] = v.trim();
                }
            }
        }
    }

    // Fallback for demo user if empty
    if (Object.keys(connectedPortals).length === 0 && cleanUser.toLowerCase().includes("vineet")) {
        connectedPortals.leetcode = "CodeMars";
        connectedPortals.codechef = "c0demars";
        connectedPortals.codeforces = "Code.Mars";
        connectedPortals.github = "Vineet-Chandel";
    }

    const allBadges: UnifiedBadgeRecord[] = [];
    const platformCounts: Record<string, number> = {};

    // 2. Query platforms in parallel
    const promises: Promise<UnifiedBadgeRecord[]>[] = [];

    if (connectedPortals.leetcode) {
        promises.push(fetchLeetCodeBadges(connectedPortals.leetcode));
    }
    if (connectedPortals.hackerrank) {
        promises.push(fetchHackerRankBadges(connectedPortals.hackerrank));
    }
    if (connectedPortals.github) {
        promises.push(fetchGitHubBadges(connectedPortals.github));
    }

    const settled = await Promise.allSettled(promises);
    for (const res of settled) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
            for (const badge of res.value) {
                // Deduplicate by platform + id
                if (!allBadges.some((b) => b.id === badge.id)) {
                    allBadges.push(badge);
                    platformCounts[badge.platform] = (platformCounts[badge.platform] || 0) + 1;
                }
            }
        }
    }

    return {
        success: true,
        username: cleanUser,
        totalEarned: allBadges.length,
        platformCounts,
        badges: allBadges,
        timestamp: new Date().toISOString(),
    };
}
