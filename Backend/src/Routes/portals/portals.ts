import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const portalsRouter = express.Router();

export interface PortalProfileData {
    success: boolean;
    portal: string;
    username: string;
    name: string;
    avatar: string;
    stats: Array<{ label: string; value: string }>;
    profileUrl: string;
    verified: boolean;
}

// Format numbers like Indian numbering (e.g., 35,38,055)
const formatRank = (num: number): string => {
    try {
        return "#" + num.toLocaleString("en-IN") + " rank";
    } catch {
        return "#" + num + " rank";
    }
};

const getFallbackAvatar = (nameOrHandle: string) => {
    const seed = encodeURIComponent(nameOrHandle.trim());
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

// --- Portal Live Fetchers ---

async function fetchLeetCode(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            body: JSON.stringify({
                query: `query userPublicProfile($username: String!) {
                    matchedUser(username: $username) {
                        username
                        profile {
                            realName
                            userAvatar
                            ranking
                        }
                        submitStatsGlobal {
                            acSubmissionNum {
                                difficulty
                                count
                            }
                        }
                    }
                }`,
                variables: { username },
            }),
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        const user = data?.data?.matchedUser;
        if (!user || data.errors) return null;

        const name = user.profile?.realName || user.username;
        const avatar = user.profile?.userAvatar || getFallbackAvatar(username);
        const ranking = user.profile?.ranking;
        const totalSolved = user.submitStatsGlobal?.acSubmissionNum?.[0]?.count ?? 0;

        const stats: Array<{ label: string; value: string }> = [
            { label: "solved", value: `${totalSolved} solved` },
        ];
        if (ranking) {
            stats.push({ label: "rank", value: formatRank(ranking) });
        }

        return {
            success: true,
            portal: "leetcode",
            username: user.username,
            name,
            avatar,
            stats,
            profileUrl: `https://leetcode.com/u/${user.username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchCodeforces(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        if (data.status !== "OK" || !data.result?.[0]) return null;

        const user = data.result[0];
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
        const name = fullName || user.handle;
        const avatar = user.titlePhoto || user.avatar || getFallbackAvatar(username);

        const stats: Array<{ label: string; value: string }> = [];
        if (user.rating !== undefined) {
            stats.push({ label: "rating", value: `${user.rating} rating` });
        }
        if (user.rank) {
            stats.push({ label: "rank", value: user.rank });
        }
        if (user.maxRating) {
            stats.push({ label: "maxRating", value: `max ${user.maxRating}` });
        }

        return {
            success: true,
            portal: "codeforces",
            username: user.handle,
            name,
            avatar,
            stats,
            profileUrl: `https://codeforces.com/profile/${user.handle}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchGitHub(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Orbix-App" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const user = (await res.json()) as any;
        if (!user || user.message === "Not Found" || !user.login) return null;

        const name = user.name || user.login;
        const avatar = user.avatar_url || getFallbackAvatar(username);

        const stats: Array<{ label: string; value: string }> = [
            { label: "repos", value: `${user.public_repos ?? 0} repos` },
            { label: "followers", value: `${user.followers ?? 0} followers` },
        ];
        if (user.public_gists) {
            stats.push({ label: "gists", value: `${user.public_gists} gists` });
        }

        return {
            success: true,
            portal: "github",
            username: user.login,
            name,
            avatar,
            stats,
            profileUrl: user.html_url || `https://github.com/${user.login}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchCodeChef(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(username)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404 || res.redirected) return null;
        const html = await res.text();
        if (
            html.includes("User does not exist") ||
            html.includes("404 Not Found") ||
            !html.toLowerCase().includes(username.toLowerCase())
        ) {
            return null;
        }

        const nameMatch = html.match(/<header class="page-title[^>]*>[\s\S]*?<h1>([^<]+)<\/h1>/i);
        const name = nameMatch ? nameMatch[1]?.trim() : username;

        const avatarMatch =
            html.match(/<img[^>]*class=[\x27"][^\x27"]*profileImage[^\x27"]*[\x27"][^>]*src=[\x27"]([^\x27"]+)[\x27"]/i) ||
            html.match(/<img[^>]*src=[\x27"]([^\x27"]+)[\x27"][^>]*class=[\x27"][^\x27"]*profileImage[^\x27"]*[\x27"]/i) ||
            html.match(/<img[^>]*alt=[\x27"]user profile[\x27"][^>]*src=[\x27"]([^\x27"]+)[\x27"]/i) ||
            html.match(/<img[^>]+class="[^"]*user-details-avatar[^"]*"[^>]+src="([^"]+)"/i);
        const avatar = (avatarMatch && avatarMatch[1]) ? avatarMatch[1] : getFallbackAvatar(username);

        const ratingMatch = html.match(/class="rating-number">(\d+)<\/div>/i);
        const starsMatch = html.match(/class="rating-star">([\s\S]*?)<\/div>/i);
        const starCount = starsMatch ? (starsMatch[1]?.match(/★/g) || []).length : 0;

        const stats: Array<{ label: string; value: string }> = [];
        if (ratingMatch && ratingMatch[1]) {
            stats.push({ label: "rating", value: `${ratingMatch[1]} rating` });
        }
        if (starCount > 0) {
            stats.push({ label: "stars", value: `${starCount}★` });
        }

        return {
            success: true,
            portal: "codechef",
            username,
            name: name || username,
            avatar: avatar || getFallbackAvatar(username),
            stats: stats.length ? stats : [{ label: "status", value: "CodeChef User" }],
            profileUrl: `https://www.codechef.com/users/${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchGeeksforGeeks(username: string): Promise<PortalProfileData | null> {
    try {
        const cleanUsername = username.trim();
        const urls = [
            `https://www.geeksforgeeks.org/profile/${encodeURIComponent(cleanUsername)}`,
            `https://www.geeksforgeeks.org/user/${encodeURIComponent(cleanUsername)}/`,
        ];

        let html: string | null = null;
        for (const url of urls) {
            try {
                const res = await fetch(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    },
                    signal: AbortSignal.timeout(6000),
                });

                if (!res.ok || res.status === 404) continue;
                const text = await res.text();

                // If GFG redirects to explore or page has no user data, user doesn't exist
                if (text.includes("NEXT_REDIRECT;replace;/connect/explore;307;")) {
                    continue;
                }

                const hasUserSignals = text.includes("data retrieved successfully") ||
                    text.includes("total_problems_solved") ||
                    text.toLowerCase().includes(`"handle":"${cleanUsername.toLowerCase()}"`) ||
                    text.toLowerCase().includes(`"username":"${cleanUsername.toLowerCase()}"`);

                if (!hasUserSignals) continue;

                html = text;
                break;
            } catch {
                continue;
            }
        }

        if (!html) return null;

        const problemsMatch = html.match(/total_problems_solved[^\d]*(\d+)/i);
        const scoreMatch = html.match(/score[^\d]*(\d+)/i);
        const rankMatch = html.match(/institute_rank\\*":\\*"([^\\"]+)\\"/i);
        const nameMatch = html.match(/articleCount[^\}]*?name\\*":\\*"([^\\"]+)\\"/i) || html.match(/"name":\s*\\"([^\\"]+)\\"/i);
        const avatarMatch = html.match(/articleCount[^\}]*?profile_image_url\\*":\\*"([^\\"]+)\\"/i) || html.match(/"profile_image_url":\s*\\"([^\\"]+)\\"/i);

        const totalSolved = problemsMatch && problemsMatch[1] ? parseInt(problemsMatch[1], 10) : 0;
        const codingScore = scoreMatch && scoreMatch[1] ? parseInt(scoreMatch[1], 10) : 0;
        const name = (nameMatch && nameMatch[1] && nameMatch[1] !== "null" && nameMatch[1] !== "undefined")
            ? nameMatch[1]
            : cleanUsername;
        const avatar = (avatarMatch && avatarMatch[1] && avatarMatch[1] !== "null")
            ? avatarMatch[1]
            : getFallbackAvatar(cleanUsername);

        const stats: Array<{ label: string; value: string }> = [
            { label: "solved", value: `${totalSolved} solved` },
            { label: "score", value: `${codingScore} score` },
        ];

        if (rankMatch && rankMatch[1]) {
            stats.push({ label: "rank", value: `#${rankMatch[1]} rank` });
        } else {
            stats.push({ label: "portal", value: "GeeksforGeeks" });
        }

        return {
            success: true,
            portal: "geeksforgeeks",
            username: cleanUsername,
            name,
            avatar,
            stats,
            profileUrl: `https://www.geeksforgeeks.org/user/${cleanUsername}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchHackerRank(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) return null;
        const data = (await res.json()) as any;
        if (!data?.status || !data?.model) return null;

        const user = data.model;
        const fullName = [user.personal_first_name, user.personal_last_name].filter(Boolean).join(" ");
        const name = user.name || fullName || user.username;
        const avatar = user.avatar && !user.avatar.includes("gravatar.jpg")
            ? user.avatar
            : getFallbackAvatar(username);

        const stats: Array<{ label: string; value: string }> = [
            { label: "portal", value: "HackerRank" },
        ];
        if (user.level) {
            stats.push({ label: "level", value: `Level ${user.level}` });
        }
        if (user.country) {
            stats.push({ label: "country", value: user.country });
        }

        return {
            success: true,
            portal: "hackerrank",
            username: user.username,
            name: name || user.username,
            avatar,
            stats,
            profileUrl: `https://www.hackerrank.com/profile/${user.username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchAtCoder(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://atcoder.jp/users/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (
            html.includes("404 Page Not Found") ||
            html.includes("User not found") ||
            html.includes("404 Not Found - AtCoder")
        ) {
            return null;
        }

        const avatarMatch = html.match(/<img class=['"]avatar['"][^>]+src=['"]([^'"]+)['"]/i);
        let avatar = (avatarMatch && avatarMatch[1]) ? avatarMatch[1] : getFallbackAvatar(username);
        if (avatar.startsWith("//")) {
            avatar = "https:" + avatar;
        }

        const stats: Array<{ label: string; value: string }> = [
            { label: "portal", value: "AtCoder" },
        ];

        const countryMatch = html.match(/Country\/Region<\/th><td>(?:<img[^>]+>\s*)?([^<]+)<\/td>/i);
        if (countryMatch && countryMatch[1]?.trim()) {
            stats.push({ label: "country", value: countryMatch[1].trim() });
        }

        return {
            success: true,
            portal: "atcoder",
            username,
            name: username,
            avatar,
            stats,
            profileUrl: `https://atcoder.jp/users/${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchCSES(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://cses.fi/user/${encodeURIComponent(username)}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (html.includes("CSES - 404") || html.includes("Not Found")) return null;

        const subMatch = html.match(/Submission count:<\/td><td >(\d+)<\/td>/i);
        const subCount = subMatch ? subMatch[1] : "0";

        return {
            success: true,
            portal: "cses",
            username,
            name: `CSES User ${username}`,
            avatar: getFallbackAvatar(username),
            stats: [
                { label: "submissions", value: `${subCount} submissions` },
                { label: "portal", value: "CSES" },
            ],
            profileUrl: `https://cses.fi/user/${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchHackerEarth(username: string): Promise<PortalProfileData | null> {
    try {
        const res = await fetch(`https://www.hackerearth.com/@${encodeURIComponent(username)}/`, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            redirect: "follow",
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok || res.status === 404) return null;
        const html = await res.text();
        if (html.includes("Profile Not Found") || html.includes("Profile not found")) return null;

        const titleMatch = html.match(/<title>([^<|]+)[|]/i);
        const name = titleMatch ? titleMatch[1]?.trim() : username;

        const avatarMatch =
            html.match(/\\"avatar\\"\s*:\s*\\"([^\\"]+)\\"/) ||
            html.match(/"avatar"\s*:\s*"([^"]+)"/) ||
            html.match(/avatar["']:\s*["']([^"']+)["']/i);
        const avatar = (avatarMatch && avatarMatch[1] && avatarMatch[1] !== "null") ? avatarMatch[1] : getFallbackAvatar(username);

        return {
            success: true,
            portal: "hackerearth",
            username,
            name: name || username,
            avatar,
            stats: [
                { label: "portal", value: "HackerEarth" },
                { label: "profile", value: "Developer" },
            ],
            profileUrl: `https://www.hackerearth.com/@${username}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchInterviewBit(username: string): Promise<PortalProfileData | null> {
    try {
        let clean = username.trim().replace(/^@+/, "");
        if (clean.includes("interviewbit.com") || clean.includes("scaler.com")) {
            const match =
                clean.match(/(?:interviewbit\.com|scaler\.com)\/(?:profile|user|users|u|academy\/profile)\/([a-zA-Z0-9_\.\-]+)/i) ||
                clean.match(/(?:interviewbit\.com|scaler\.com)\/([a-zA-Z0-9_\.\-]+)$/i);
            if (match && match[1]) clean = match[1];
        }
        clean = (clean.replace(/\/+$/, "").split("/")[0] || "").split("?")[0]?.trim() || "";
        if (!clean) return null;

        const profileUrl = `https://www.interviewbit.com/profile/${encodeURIComponent(clean)}/`;

        const apiHeaders = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": profileUrl,
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
        };

        // Query InterviewBit's official profile API
        const apiRes = await fetch(
            `https://www.interviewbit.com/v2/profile/username?id=${encodeURIComponent(clean)}`,
            {
                headers: apiHeaders,
                signal: AbortSignal.timeout(6000),
            }
        );

        // Non-existent profiles return 403 or 404
        if (!apiRes.ok) {
            return null;
        }

        const data = await apiRes.json();
        if (!data || (!data.username && !data.id && !data.name)) {
            return null;
        }

        // Fetch streak / coins data
        let streakData: any = null;
        try {
            const streakRes = await fetch(
                `https://www.interviewbit.com/v2/profile/username/streak/?id=${encodeURIComponent(clean)}`,
                {
                    headers: apiHeaders,
                    signal: AbortSignal.timeout(3000),
                }
            );
            if (streakRes.ok) {
                streakData = await streakRes.json();
            }
        } catch {
            // Streak fetch error non-fatal
        }

        const stats: Array<{ label: string; value: string }> = [];
        if (data.global_rank) {
            stats.push({
                label: "rank",
                value: `#${Number(data.global_rank).toLocaleString("en-IN")} rank`,
            });
        }
        if (data.university_rank) {
            stats.push({
                label: "college",
                value: `#${data.university_rank} college`,
            });
        }
        if (streakData && typeof streakData.coins === "number" && streakData.coins > 0) {
            stats.push({
                label: "coins",
                value: `${streakData.coins} coins`,
            });
        }
        if (streakData && typeof streakData.current_streak === "number" && streakData.current_streak > 0) {
            stats.push({
                label: "streak",
                value: `${streakData.current_streak} days`,
            });
        }
        if (stats.length === 0) {
            stats.push({ label: "portal", value: "InterviewBit" }, { label: "profile", value: "Verified User" });
        }

        // Extract dynamic profile picture
        let avatar = "";
        if (data.image && typeof data.image === "string" && data.image.startsWith("http")) {
            avatar = data.image;
        } else {
            const displayName = data.name || data.username || clean;
            const cleanLetters = displayName.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() || "IB";
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanLetters)}&background=0D8BD9&color=fff&size=200&bold=true`;
        }

        return {
            success: true,
            portal: "interviewbit",
            username: data.username || clean,
            name: data.name || clean,
            avatar,
            stats,
            profileUrl,
            verified: true,
        };
    } catch {
        return null;
    }
}

async function fetchTopCoder(username: string): Promise<PortalProfileData | null> {
    try {
        const clean = username.trim();
        const res = await fetch(`https://api.topcoder.com/v6/members?handle=${encodeURIComponent(clean)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;
        const members = await res.json();
        if (!Array.isArray(members) || members.length === 0) return null;

        const m = members[0];
        if (!m || !m.handle) return null;

        const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ").trim();
        const displayName = fullName || m.handle || clean;

        let avatar = m.photoURL;
        if (!avatar) {
            try {
                const ghCheck = await fetch(`https://github.com/${encodeURIComponent(clean)}.png`, {
                    method: "HEAD",
                    redirect: "follow",
                    signal: AbortSignal.timeout(2000),
                });
                if (ghCheck.ok && !ghCheck.url.includes("identicons")) {
                    avatar = `https://github.com/${encodeURIComponent(clean)}.png`;
                }
            } catch {
                // Ignore
            }
        }

        if (!avatar) {
            avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=29A7DF&color=fff&size=200&bold=true`;
        }

        const stats: Array<{ label: string; value: string }> = [
            { label: "portal", value: "TopCoder" },
        ];
        if (m.status) {
            stats.push({ label: "status", value: m.status });
        }
        if (m.homeCountryCode) {
            stats.push({ label: "country", value: m.homeCountryCode });
        }
        if (m.maxRating && typeof m.maxRating.rating === "number") {
            stats.push({ label: "rating", value: `${m.maxRating.rating} rating` });
        }

        return {
            success: true,
            portal: "topcoder",
            username: m.handle,
            name: displayName,
            avatar,
            stats,
            profileUrl: `https://profiles.topcoder.com/${m.handle}`,
            verified: true,
        };
    } catch {
        return null;
    }
}

portalsRouter.get("/fetch", async (req: Request, res: Response) => {
    try {
        const portal = String(req.query.portal || "").trim().toLowerCase();
        const username = String(req.query.username || "").trim();

        if (!portal || !username) {
            return res.status(400).json({
                success: false,
                message: "Both portal and username parameters are required",
            });
        }

        let profileData: PortalProfileData | null = null;

        switch (portal) {
            case "leetcode":
                profileData = await fetchLeetCode(username);
                break;
            case "codeforces":
                profileData = await fetchCodeforces(username);
                break;
            case "github":
                profileData = await fetchGitHub(username);
                break;
            case "codechef":
                profileData = await fetchCodeChef(username);
                break;
            case "geeksforgeeks":
                profileData = await fetchGeeksforGeeks(username);
                break;
            case "hackerrank":
                profileData = await fetchHackerRank(username);
                break;
            case "atcoder":
                profileData = await fetchAtCoder(username);
                break;
            case "cses":
                profileData = await fetchCSES(username);
                break;
            case "hackerearth":
                profileData = await fetchHackerEarth(username);
                break;
            case "interviewbit":
                profileData = await fetchInterviewBit(username);
                break;
            case "topcoder":
                profileData = await fetchTopCoder(username);
                break;
            default:
                break;
        }

        // If profile was not found on the platform, return 404 Not Found
        if (!profileData) {
            return res.status(404).json({
                success: false,
                message: `Account not found on ${portal}. Please check your username or profile link.`,
            });
        }

        return res.status(200).json(profileData);
    } catch (err: any) {
        console.error("Portal fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch profile details",
        });
    }
});

export interface SavedPortalLink {
    portal: string;
    portal_username: string;
    link: string;
    raw_input?: string;
    display_name?: string;
    avatar_url?: string;
    stats?: any[];
    verified?: boolean;
}

export function detectPortalFromUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    const low = url.toLowerCase();
    if (low.includes("leetcode.com")) return "leetcode";
    if (low.includes("codeforces.com")) return "codeforces";
    if (low.includes("codechef.com")) return "codechef";
    if (low.includes("geeksforgeeks.org")) return "geeksforgeeks";
    if (low.includes("hackerrank.com")) return "hackerrank";
    if (low.includes("atcoder.jp")) return "atcoder";
    if (low.includes("cses.fi")) return "cses";
    if (low.includes("interviewbit.com") || low.includes("scaler.com")) return "interviewbit";
    if (low.includes("topcoder.com")) return "topcoder";
    if (low.includes("hackerearth.com")) return "hackerearth";
    if (low.includes("github.com")) return "github";
    if (low.includes("code360") || low.includes("codingninjas.com")) return "codingninjas";

    return null;
}

export function extractPortalUsername(portal: string, rawInput: string): string | null {
    if (!rawInput || typeof rawInput !== "string") return null;
    const clean = rawInput.trim().replace(/^@+/, "");
    const withoutQuery = (clean.split("?")[0] || "").split("#")[0]?.replace(/\/+$/, "") || "";

    switch (portal.toLowerCase()) {
        case "leetcode": {
            const m = withoutQuery.match(/leetcode\.com\/u\/([a-zA-Z0-9_\-]+)/i)
                || withoutQuery.match(/leetcode\.com\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "codeforces": {
            const m = withoutQuery.match(/codeforces\.com\/profile\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "codechef": {
            const m = withoutQuery.match(/codechef\.com\/users\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "geeksforgeeks": {
            const m = withoutQuery.match(/geeksforgeeks\.org\/(?:user|profile)\/([a-zA-Z0-9_.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "hackerrank": {
            const m = withoutQuery.match(/hackerrank\.com\/profile\/([a-zA-Z0-9_\.\-]+)/i)
                || withoutQuery.match(/hackerrank\.com\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "atcoder": {
            const m = withoutQuery.match(/atcoder\.jp\/users\/([a-zA-Z0-9_]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "cses": {
            const m = withoutQuery.match(/cses\.fi\/user\/([0-9]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "interviewbit": {
            const m = withoutQuery.match(/(?:interviewbit\.com|scaler\.com)\/(?:profile|user|users|u|academy\/profile)\/([a-zA-Z0-9_\.\-]+)/i)
                || withoutQuery.match(/(?:interviewbit\.com|scaler\.com)\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "topcoder": {
            const m = withoutQuery.match(/(?:profiles\.topcoder\.com|topcoder\.com\/members)\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "hackerearth": {
            const m = withoutQuery.match(/hackerearth\.com\/@?([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "github": {
            const m = withoutQuery.match(/github\.com\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "codingninjas": {
            const m = withoutQuery.match(/(?:naukri\.com\/code360\/profile|codingninjas\.com\/codestudio\/profile)\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "kaggle": {
            const m = withoutQuery.match(/kaggle\.com\/([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        default: {
            return withoutQuery.split("/").pop() || clean;
        }
    }
}

export function buildPortalLink(portal: string, extractedUsername: string): string {
    const u = encodeURIComponent(extractedUsername.trim());
    switch (portal.toLowerCase()) {
        case "leetcode":
            return `https://leetcode.com/u/${u}`;
        case "codeforces":
            return `https://codeforces.com/profile/${u}`;
        case "codechef":
            return `https://www.codechef.com/users/${u}`;
        case "geeksforgeeks":
            return `https://www.geeksforgeeks.org/user/${u}`;
        case "hackerrank":
            return `https://www.hackerrank.com/profile/${u}`;
        case "atcoder":
            return `https://atcoder.jp/users/${u}`;
        case "cses":
            return `https://cses.fi/user/${u}`;
        case "interviewbit":
            return `https://www.interviewbit.com/profile/${u}/`;
        case "topcoder":
            return `https://profiles.topcoder.com/${u}`;
        case "hackerearth":
            return `https://www.hackerearth.com/@${u}`;
        case "github":
            return `https://github.com/${u}`;
        case "codingninjas":
            return `https://www.naukri.com/code360/profile/${u}`;
        case "kaggle":
            return `https://www.kaggle.com/${u}`;
        default:
            return `https://${portal}.com/${u}`;
    }
}

// Handle saving portal accounts to DB and cache (protected by authenticate middleware)
export const handleSavePortals = async (req: Request, res: Response) => {
    try {
        const body = req.body || {};
        const itemsToSave: SavedPortalLink[] = [];

        // 1. Process connectedProfiles map if sent
        if (body.connectedProfiles && typeof body.connectedProfiles === "object") {
            for (const [key, val] of Object.entries(body.connectedProfiles)) {
                if (!val || typeof val !== "object") continue;
                const profile = val as any;
                const portal = (profile.portal || key).toLowerCase();
                const raw = profile.username || profile.profileUrl || "";
                const extracted = extractPortalUsername(portal, raw) || profile.username;
                const link = profile.profileUrl || buildPortalLink(portal, extracted);
                itemsToSave.push({
                    portal,
                    portal_username: extracted,
                    link,
                    raw_input: profile.username || profile.profileUrl,
                    display_name: profile.name,
                    avatar_url: profile.avatar,
                    stats: profile.stats || [],
                    verified: profile.verified !== false,
                });
            }
        }

        // 2. Process portals map if sent
        if (body.portals && typeof body.portals === "object") {
            for (const [key, val] of Object.entries(body.portals)) {
                if (!val) continue;
                const portal = key.toLowerCase();
                let raw = "";
                let existingUrl = "";
                if (typeof val === "string") {
                    raw = val;
                } else if (typeof val === "object") {
                    raw = (val as any).raw || (val as any).username || (val as any).url || "";
                    existingUrl = (val as any).url || "";
                }
                if (!raw) continue;
                const extracted = extractPortalUsername(portal, raw);
                if (extracted && !itemsToSave.some((it) => it.portal === portal)) {
                    itemsToSave.push({
                        portal,
                        portal_username: extracted,
                        link: existingUrl || buildPortalLink(portal, extracted),
                        raw_input: raw,
                        verified: true,
                    });
                }
            }
        }

        // 3. Process array of links: ["https://interviewbit.com/profile/_211_938/", "https://leetcode.com/u/vineet-chandel"]
        if (Array.isArray(body.links)) {
            for (const linkStr of body.links) {
                if (typeof linkStr !== "string") continue;
                const detected = detectPortalFromUrl(linkStr);
                if (detected) {
                    const extracted = extractPortalUsername(detected, linkStr);
                    if (extracted && !itemsToSave.some((it) => it.portal === detected)) {
                        itemsToSave.push({
                            portal: detected,
                            portal_username: extracted,
                            link: buildPortalLink(detected, extracted),
                            raw_input: linkStr,
                            verified: true,
                        });
                    }
                }
            }
        }

        // 4. Process single portal object: { portal: "interviewbit", link: "...", username: "..." }
        if (body.portal && (body.link || body.username || body.raw)) {
            const portal = String(body.portal).toLowerCase();
            const raw = String(body.link || body.username || body.raw);
            const extracted = extractPortalUsername(portal, raw);
            if (extracted && !itemsToSave.some((it) => it.portal === portal)) {
                itemsToSave.push({
                    portal,
                    portal_username: extracted,
                    link: body.link || buildPortalLink(portal, extracted),
                    raw_input: raw,
                    display_name: body.displayName || body.name,
                    avatar_url: body.avatar,
                    verified: true,
                });
            }
        }

        // 5. Process top-level portal keys: { interviewbit: "https://www.interviewbit.com/profile/_211_938/" }
        const knownPortals = [
            "leetcode", "codeforces", "codechef", "geeksforgeeks", "hackerrank",
            "atcoder", "cses", "interviewbit", "topcoder", "hackerearth",
            "github", "codingninjas", "kaggle"
        ];
        for (const p of knownPortals) {
            if (body[p] && typeof body[p] === "string" && !itemsToSave.some((it) => it.portal === p)) {
                const raw = body[p];
                const extracted = extractPortalUsername(p, raw);
                if (extracted) {
                    itemsToSave.push({
                        portal: p,
                        portal_username: extracted,
                        link: buildPortalLink(p, extracted),
                        raw_input: raw,
                        verified: true,
                    });
                }
            }
        }

        // User identity from req.user (populated by authenticate middleware) with payload fallbacks
        const authUser = (req as any).user;
        const userId = authUser?.id || body.user_id || body.userId || null;
        const userIdentifier = authUser?.username || body.username || authUser?.gmail || null;

        if (!userIdentifier) {
            return res.status(401).json({
                success: false,
                message: "Authentication required: user identifier not found",
            });
        }

        // Save to Database (PostgreSQL)
        let dbSaved = false;
        try {
            for (const item of itemsToSave) {
                await query(
                    `INSERT INTO user_links (
                        user_id,
                        username,
                        portal,
                        portal_username,
                        link,
                        raw_input,
                        verified,
                        display_name,
                        avatar_url,
                        stats,
                        updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                    ON CONFLICT (username, portal)
                    DO UPDATE SET
                        user_id = COALESCE(EXCLUDED.user_id, user_links.user_id),
                        portal_username = EXCLUDED.portal_username,
                        link = EXCLUDED.link,
                        raw_input = EXCLUDED.raw_input,
                        verified = EXCLUDED.verified,
                        display_name = COALESCE(EXCLUDED.display_name, user_links.display_name),
                        avatar_url = COALESCE(EXCLUDED.avatar_url, user_links.avatar_url),
                        stats = COALESCE(EXCLUDED.stats, user_links.stats),
                        updated_at = CURRENT_TIMESTAMP;`,
                    [
                        userId,
                        userIdentifier,
                        item.portal,
                        item.portal_username,
                        item.link,
                        item.raw_input || item.link,
                        item.verified ?? true,
                        item.display_name || null,
                        item.avatar_url || null,
                        JSON.stringify(item.stats || []),
                    ]
                );
            }
            dbSaved = true;
        } catch (dbErr: any) {
            console.warn("Database storage warning (non-fatal):", dbErr.message || dbErr);
        }

        // Cache in Redis
        try {
            if (redis && redis.status === "ready") {
                await redis.set(
                    `user:portals:${userIdentifier}`,
                    JSON.stringify(itemsToSave),
                    "EX",
                    60 * 60 * 24 * 7
                );
            }
        } catch {
            // Redis cache non-fatal
        }

        return res.status(200).json({
            success: true,
            message: `Successfully saved ${itemsToSave.length} portal account${itemsToSave.length === 1 ? "" : "s"}!`,
            user: {
                id: userId,
                username: userIdentifier,
            },
            saved: itemsToSave,
            count: itemsToSave.length,
            dbPersisted: dbSaved,
        });
    } catch (err: any) {
        console.error("Save portals error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to process and save portal details",
        });
    }
};

// Handle retrieving saved portal accounts
export const handleGetSavedPortals = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const username = authUser?.username || (req.query.username as string) || req.body?.username;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Missing username parameter",
            });
        }

        // Check Redis cache first
        try {
            if (redis && redis.status === "ready") {
                const cached = await redis.get(`user:portals:${username}`);
                if (cached) {
                    const links = JSON.parse(cached);
                    return res.status(200).json({
                        success: true,
                        username,
                        links,
                        count: links.length,
                        source: "cache",
                    });
                }
            }
        } catch {
            // Fall through to DB
        }

        // Query Postgres
        const result = await query(
            `SELECT
                user_id,
                username,
                portal,
                portal_username,
                link,
                raw_input,
                verified,
                display_name,
                avatar_url,
                stats,
                created_at,
                updated_at
            FROM user_links
            WHERE username = $1
            ORDER BY portal ASC;`,
            [username]
        );

        return res.status(200).json({
            success: true,
            username,
            links: result.rows,
            count: result.rows.length,
            source: "database",
        });
    } catch (err: any) {
        console.error("Get portals error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve user portal links",
        });
    }
};

// Route mounts using authenticate middleware
portalsRouter.post("/save", authenticate, handleSavePortals);
portalsRouter.post("/profile/save", authenticate, handleSavePortals);
portalsRouter.get("/save", authenticate, handleGetSavedPortals);
portalsRouter.get("/profile/save", authenticate, handleGetSavedPortals);
portalsRouter.get("/links", authenticate, handleGetSavedPortals);

export default portalsRouter;
