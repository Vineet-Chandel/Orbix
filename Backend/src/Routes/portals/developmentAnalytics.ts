import { query } from "../../database/client.js";

export interface LanguageItem {
    name: string;
    percentage: number;
    color: string;
    bytes: number;
    formattedSize?: string;
}

export interface DevelopmentRepoItem {
    name: string;
    description: string;
    stars: number;
    forks: number;
    language: string;
    languageColor: string;
    url: string;
}

export interface MostStarredRepo {
    name: string;
    stars: number;
    url: string;
}

export interface LatestWorkRepo {
    name: string;
    pushedAt: string;
    relativeTime: string;
    url: string;
}

export interface DevelopmentAnalyticsData {
    success: boolean;
    username: string;
    githubHandle: string;
    contributions: number;
    repos: number;
    stars: number;
    followers: number;
    languages: LanguageItem[];
    topRepositories: DevelopmentRepoItem[];
    mostStarred?: MostStarredRepo | null;
    latestWork?: LatestWorkRepo | null;
    timestamp: string;
}

export const GITHUB_LANGUAGE_COLORS: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Java: "#b07219",
    "C++": "#f34b7d",
    C: "#555555",
    "C#": "#178600",
    Go: "#00ADD8",
    Rust: "#dea584",
    HTML: "#e34c26",
    CSS: "#563d7c",
    PHP: "#4F5D95",
    Ruby: "#701516",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    Shell: "#89e051",
    PLpgSQL: "#336790",
    EJS: "#8b949e",
    Batchfile: "#C1F12E",
    PowerShell: "#012456",
    Dockerfile: "#384d54",
    Vue: "#41b883",
    Scala: "#c22d40",
    R: "#198CE7",
    Lua: "#000080",
    Haskell: "#5e5086",
    Julia: "#a270ba",
    Solidity: "#AA6746",
    Svelte: "#ff3e00",
};

export const EMPTY_DEV_STATS: DevelopmentAnalyticsData = {
    success: true,
    username: "",
    githubHandle: "",
    contributions: 0,
    repos: 0,
    stars: 0,
    followers: 0,
    languages: [],
    topRepositories: [],
    mostStarred: null,
    latestWork: null,
    timestamp: new Date().toISOString(),
};

export function formatRelativeTime(isoDate: string): string {
    if (!isoDate) return "recently";
    try {
        const then = new Date(isoDate).getTime();
        const now = Date.now();
        if (isNaN(then)) return "recently";
        const diffMs = Math.max(0, now - then);
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSecs < 60) return "just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffWeeks < 5) return `${diffWeeks}w ago`;
        if (diffMonths < 12) return `${diffMonths}mo ago`;
        return `${diffYears}y ago`;
    } catch {
        return "recently";
    }
}

/**
 * Calculates dynamic development metrics & language breakdown for a connected GitHub account.
 */
export async function calculateUserDevelopmentAnalytics(
    username: string,
    clientPortals?: Record<string, any>,
    directHandle?: string
): Promise<DevelopmentAnalyticsData> {
    const cleanUsername = (username || "").trim();
    if (!cleanUsername) {
        return {
            ...EMPTY_DEV_STATS,
            timestamp: new Date().toISOString(),
        };
    }
    let githubHandle = (directHandle || "").trim();

    // 1. Resolve GitHub handle from clientPortals if not provided
    if (!githubHandle && clientPortals) {
        const gh = clientPortals.github || clientPortals.GitHub || clientPortals.Github;
        if (typeof gh === "object" && gh) {
            githubHandle = (gh.username || gh.portal_username || gh.handle || "").trim();
        } else if (typeof gh === "string") {
            githubHandle = gh.trim();
        }
    }

    // 2. Resolve from database if still missing (check user_links)
    if (!githubHandle) {
        try {
            const dbRes = await query(
                `SELECT portal, portal_username 
                 FROM user_links 
                 WHERE LOWER(username) = LOWER($1) AND portal ILIKE '%github%' 
                 LIMIT 1`,
                [cleanUsername]
            );
            if (dbRes.rows && dbRes.rows.length > 0) {
                const row = dbRes.rows[0];
                githubHandle = (row.portal_username || "").trim();
            }
        } catch {
            // DB non-fatal
        }
    }

    // 3. Resolve from users table if still missing (github column)
    if (!githubHandle) {
        try {
            const userRes = await query(
                `SELECT github FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
                [cleanUsername]
            );
            if (userRes.rows && userRes.rows.length > 0 && userRes.rows[0].github) {
                const raw = String(userRes.rows[0].github).trim();
                githubHandle = raw.replace(/https?:\/\/(www\.)?github\.com\//i, "").replace(/\/.*$/, "").trim();
            }
        } catch {
            // DB non-fatal
        }
    }

    // Clean githubHandle if someone provided a full URL
    if (githubHandle.includes("github.com/")) {
        githubHandle = githubHandle.replace(/https?:\/\/(www\.)?github\.com\//i, "").replace(/\/.*$/, "").trim();
    }

    if (!githubHandle) {
        return {
            success: true,
            username: cleanUsername,
            githubHandle: "",
            contributions: 0,
            repos: 0,
            stars: 0,
            followers: 0,
            languages: [],
            topRepositories: [],
            timestamp: new Date().toISOString(),
        };
    }

    try {
        // Fetch User profile info
        let reposCount = 0;
        let followersCount = 0;
        try {
            const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(githubHandle)}`, {
                headers: {
                    "User-Agent": "Orbix-App/1.0 (Developer Dashboard; +https://orbix.dev)",
                    Accept: "application/vnd.github.v3+json",
                },
                signal: AbortSignal.timeout(5000),
            });
            if (userRes.ok) {
                const userObj = (await userRes.json()) as any;
                if (userObj) {
                    reposCount = userObj.public_repos ?? 0;
                    followersCount = userObj.followers ?? 0;
                }
            }
        } catch {
            // non-fatal
        }

        // Fetch user contributions from public contributions calendar
        let contributions = 0;
        try {
            const contribRes = await fetch(`https://github.com/users/${encodeURIComponent(githubHandle)}/contributions`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                signal: AbortSignal.timeout(6000),
            });
            if (contribRes.ok) {
                const html = await contribRes.text();
                const m = html.match(/([\d,]+)\s*(?:contributions\s+in\s+the\s+last\s+year|contributions)/i) ||
                          html.match(/([\d,]+)\s*[\r\n\s]+contributions/i);
                if (m && m[1]) {
                    contributions = parseInt(m[1].replace(/,/g, ""), 10) || 0;
                }
            }
        } catch {
            // non-fatal
        }

        // Fetch repositories
        let totalStars = 0;
        const languageByteMap: Record<string, number> = {};
        const topRepositories: DevelopmentRepoItem[] = [];
        let mostStarred: MostStarredRepo | null = null;
        let latestWork: LatestWorkRepo | null = null;
        let reposFetched = false;

        try {
            const reposRes = await fetch(
                `https://api.github.com/users/${encodeURIComponent(githubHandle)}/repos?per_page=100&type=owner&sort=updated`,
                {
                    headers: {
                        "User-Agent": "Orbix-App/1.0 (Developer Dashboard; +https://orbix.dev)",
                        Accept: "application/vnd.github.v3+json",
                    },
                    signal: AbortSignal.timeout(6000),
                }
            );

            if (reposRes.ok) {
                const reposList = (await reposRes.json()) as any[];
                if (Array.isArray(reposList) && reposList.length > 0) {
                    reposFetched = true;
                    if (reposCount === 0) {
                        reposCount = reposList.length;
                    }

                    // Sum stars
                    for (const r of reposList) {
                        totalStars += r.stargazers_count || 0;
                    }

                    // Concurrently fetch languages for repositories (limit to top 15 updated repos to avoid rate limits)
                    const sampleRepos = reposList.slice(0, 15);
                    const langPromises = sampleRepos.map(async (r) => {
                        if (r.languages_url) {
                            try {
                                const lRes = await fetch(r.languages_url, {
                                    headers: { "User-Agent": "Orbix-App/1.0" },
                                    signal: AbortSignal.timeout(3500),
                                });
                                if (lRes.ok) {
                                    const langs = (await lRes.json()) as Record<string, number>;
                                    for (const [langName, bytes] of Object.entries(langs)) {
                                        languageByteMap[langName] = (languageByteMap[langName] || 0) + bytes;
                                    }
                                    return;
                                }
                            } catch {
                                // fallback to primary language
                            }
                        }
                        if (r.language) {
                            const estBytes = (r.size || 10) * 1024;
                            languageByteMap[r.language] = (languageByteMap[r.language] || 0) + estBytes;
                        }
                    });

                    await Promise.allSettled(langPromises);

                    // If remaining repos exist that weren't in sampleRepos, aggregate their primary languages
                    if (reposList.length > 15) {
                        for (let i = 15; i < reposList.length; i++) {
                            const r = reposList[i];
                            if (r && r.language) {
                                const estBytes = (r.size || 5) * 1024;
                                languageByteMap[r.language] = (languageByteMap[r.language] || 0) + estBytes;
                            }
                        }
                    }

                    // Build top repositories list sorted by stars
                    const sortedRepos = [...reposList].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
                    for (const r of sortedRepos.slice(0, 4)) {
                        const lang = r.language || "TypeScript";
                        topRepositories.push({
                            name: r.name || "Repository",
                            description: r.description || "Public repository",
                            stars: r.stargazers_count || 0,
                            forks: r.forks_count || 0,
                            language: lang,
                            languageColor: GITHUB_LANGUAGE_COLORS[lang] || "#3178c6",
                            url: r.html_url || `https://github.com/${githubHandle}/${r.name}`,
                        });
                    }

                    if (sortedRepos[0]) {
                        mostStarred = {
                            name: sortedRepos[0].name || "Repository",
                            stars: sortedRepos[0].stargazers_count || 0,
                            url: sortedRepos[0].html_url || `https://github.com/${githubHandle}/${sortedRepos[0].name}`,
                        };
                    }

                    const sortedByPushed = [...reposList].sort((a, b) => {
                        const timeA = new Date(a.pushed_at || a.updated_at || 0).getTime();
                        const timeB = new Date(b.pushed_at || b.updated_at || 0).getTime();
                        return timeB - timeA;
                    });
                    if (sortedByPushed[0]) {
                        const pushDate = sortedByPushed[0].pushed_at || sortedByPushed[0].updated_at || "";
                        latestWork = {
                            name: sortedByPushed[0].name || "Repository",
                            pushedAt: pushDate,
                            relativeTime: pushDate ? formatRelativeTime(pushDate) : "recently",
                            url: sortedByPushed[0].html_url || `https://github.com/${githubHandle}/${sortedByPushed[0].name}`,
                        };
                    }
                }
            }
        } catch {
            // non-fatal
        }

        // Resilient Scraper Fallback if GitHub API was rate limited or empty
        if (!reposFetched && githubHandle) {
            try {
                const [starredRes, updatedRes] = await Promise.allSettled([
                    fetch(`https://github.com/${encodeURIComponent(githubHandle)}?tab=repositories&sort=stargazers`, {
                        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
                        signal: AbortSignal.timeout(6000),
                    }),
                    fetch(`https://github.com/${encodeURIComponent(githubHandle)}?tab=repositories`, {
                        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
                        signal: AbortSignal.timeout(6000),
                    }),
                ]);

                if (starredRes.status === "fulfilled" && starredRes.value.ok) {
                    const html = await starredRes.value.text();
                    const blocks = html.split('itemprop="name codeRepository"');
                    for (let i = 1; i < blocks.length; i++) {
                        const chunk = blocks[i];
                        if (!chunk) continue;
                        const nameMatch = chunk.match(/>\s*([^<]+)<\/a>/);
                        if (!nameMatch || !nameMatch[1]) continue;
                        const repoName = nameMatch[1].trim();
                        const starMatch = chunk.match(/href="\/[^\/]+\/[^\/]+\/stargazers"[^>]*>[\s\S]*?<\/svg>\s*([\d,]+)/);
                        const stars = starMatch && starMatch[1] ? parseInt(starMatch[1].replace(/,/g, ""), 10) || 0 : 0;
                        const descMatch = chunk.match(/itemprop="description">([\s\S]*?)<\/p>/);
                        const desc = descMatch && descMatch[1] ? descMatch[1].trim() : "Public repository";
                        const langMatch = chunk.match(/itemprop="programmingLanguage">([^<]+)<\/span>/);
                        const lang = langMatch && langMatch[1] ? langMatch[1].trim() : "TypeScript";
                        totalStars += stars;

                        if (topRepositories.length < 4) {
                            topRepositories.push({
                                name: repoName,
                                description: desc,
                                stars,
                                forks: 0,
                                language: lang,
                                languageColor: GITHUB_LANGUAGE_COLORS[lang] || "#3178c6",
                                url: `https://github.com/${githubHandle}/${repoName}`,
                            });
                        }

                        if (!mostStarred) {
                            mostStarred = {
                                name: repoName,
                                stars,
                                url: `https://github.com/${githubHandle}/${repoName}`,
                            };
                        }

                        if (lang) {
                            const estBytes = Math.max(10000, stars * 5000);
                            languageByteMap[lang] = (languageByteMap[lang] || 0) + estBytes;
                        }
                    }
                    if (reposCount === 0 && blocks.length > 1) {
                        reposCount = blocks.length - 1;
                    }
                }

                if (updatedRes.status === "fulfilled" && updatedRes.value.ok) {
                    const html = await updatedRes.value.text();
                    const blocks = html.split('itemprop="name codeRepository"');
                    const chunk = blocks[1];
                    if (chunk) {
                        const nameMatch = chunk.match(/>\s*([^<]+)<\/a>/);
                        const timeMatch = chunk.match(/<relative-time[^>]*datetime="([^"]+)"/);
                        if (nameMatch && nameMatch[1]) {
                            const repoName = nameMatch[1].trim();
                            const dateStr = timeMatch && timeMatch[1] ? timeMatch[1] : "";
                            latestWork = {
                                name: repoName,
                                pushedAt: dateStr,
                                relativeTime: dateStr ? formatRelativeTime(dateStr) : "recently",
                                url: `https://github.com/${githubHandle}/${repoName}`,
                            };
                        }
                    }
                }
            } catch {
                // non-blocking fallback
            }
        }

        // Calculate language percentage distribution
        const totalBytes = Object.values(languageByteMap).reduce((acc, bytes) => acc + bytes, 0);
        let languages: LanguageItem[] = [];

        if (totalBytes > 0) {
            const rawList = Object.entries(languageByteMap)
                .map(([name, bytes]) => {
                    const pct = Number(((bytes / totalBytes) * 100).toFixed(1));
                    return {
                        name,
                        bytes,
                        percentage: pct,
                        color: GITHUB_LANGUAGE_COLORS[name] || "#8b949e",
                    };
                })
                .filter((l) => l.percentage > 0)
                .sort((a, b) => b.bytes - a.bytes);

            // Limit to top 6 languages
            const topLangs = rawList.slice(0, 6);
            languages = topLangs;
        }

        return {
            success: true,
            username: cleanUsername,
            githubHandle,
            contributions,
            repos: reposCount,
            stars: totalStars,
            followers: followersCount,
            languages,
            topRepositories,
            mostStarred,
            latestWork,
            timestamp: new Date().toISOString(),
        };
    } catch (err) {
        console.error("Error in calculateUserDevelopmentAnalytics:", err);
        return {
            ...EMPTY_DEV_STATS,
            username: cleanUsername,
            githubHandle: githubHandle || "",
            timestamp: new Date().toISOString(),
        };
    }
}
