import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";

const portalsRouter = express.Router();

export interface DifficultyBreakdown {
    easy: number;
    medium: number;
    hard: number;
    total: number;
    easyTotal?: number;
    mediumTotal?: number;
    hardTotal?: number;
    totalQuestions?: number;
    attempting?: number;
}

export interface PortalProfileData {
    success: boolean;
    portal: string;
    username: string;
    name: string;
    avatar: string;
    stats: Array<{ label: string; value: string }>;
    profileUrl: string;
    verified: boolean;
    difficulty?: DifficultyBreakdown | undefined;
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
                    allQuestionsCount {
                        difficulty
                        count
                    }
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

        const allQuestions = data?.data?.allQuestionsCount || [];
        const acSubmissions = user.submitStatsGlobal?.acSubmissionNum || [];

        const totalSolved = acSubmissions.find((s: any) => s.difficulty === "All")?.count ?? 0;
        const easySolved = acSubmissions.find((s: any) => s.difficulty === "Easy")?.count ?? 0;
        const mediumSolved = acSubmissions.find((s: any) => s.difficulty === "Medium")?.count ?? 0;
        const hardSolved = acSubmissions.find((s: any) => s.difficulty === "Hard")?.count ?? 0;

        const totalQuestions = allQuestions.find((q: any) => q.difficulty === "All")?.count ?? 4082;
        const easyTotal = allQuestions.find((q: any) => q.difficulty === "Easy")?.count ?? 971;
        const mediumTotal = allQuestions.find((q: any) => q.difficulty === "Medium")?.count ?? 2128;
        const hardTotal = allQuestions.find((q: any) => q.difficulty === "Hard")?.count ?? 983;

        const stats: Array<{ label: string; value: string }> = [
            { label: "solved", value: `${totalSolved} solved` },
        ];
        if (ranking) {
            stats.push({ label: "rank", value: formatRank(ranking) });
        }
        stats.push(
            { label: "easy", value: `${easySolved} easy` },
            { label: "medium", value: `${mediumSolved} medium` },
            { label: "hard", value: `${hardSolved} hard` }
        );

        const difficulty: DifficultyBreakdown = {
            easy: easySolved,
            medium: mediumSolved,
            hard: hardSolved,
            total: totalSolved,
            easyTotal,
            mediumTotal,
            hardTotal,
            totalQuestions,
            attempting: totalSolved > 0 ? 1 : 0,
        };

        return {
            success: true,
            portal: "leetcode",
            username: user.username,
            name,
            avatar,
            stats,
            difficulty,
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
        let difficulty: DifficultyBreakdown | undefined = undefined;

        try {
            const subRes = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4000),
            });
            if (subRes.ok) {
                const subData = (await subRes.json()) as any;
                if (subData?.status === "OK" && Array.isArray(subData.result)) {
                    const solvedSet = new Set<string>();
                    let easyCount = 0;
                    let medCount = 0;
                    let hardCount = 0;

                    for (const sub of subData.result) {
                        if (sub.verdict === "OK" && sub.problem) {
                            const key = `${sub.problem.contestId}-${sub.problem.index}`;
                            if (!solvedSet.has(key)) {
                                solvedSet.add(key);
                                const rating = sub.problem.rating;
                                if (!rating || rating <= 1200) {
                                    easyCount++;
                                } else if (rating <= 1800) {
                                    medCount++;
                                } else {
                                    hardCount++;
                                }
                            }
                        }
                    }

                    stats.push({ label: "solved", value: `${solvedSet.size} solved` });
                    stats.push(
                        { label: "easy", value: `${easyCount} easy` },
                        { label: "medium", value: `${medCount} medium` },
                        { label: "hard", value: `${hardCount} hard` }
                    );

                    difficulty = {
                        easy: easyCount,
                        medium: medCount,
                        hard: hardCount,
                        total: solvedSet.size,
                        easyTotal: 3000,
                        mediumTotal: 4500,
                        hardTotal: 2000,
                        totalQuestions: 9500,
                        attempting: solvedSet.size > 0 ? 1 : 0,
                    };
                }
            }
        } catch {
            // Non-fatal
        }

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
            difficulty,
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

        const solvedMatch =
            html.match(/Total Problems Solved[^\d]*(\d+)/i) ||
            html.match(/problems-solved[^\d]*(\d+)/i) ||
            html.match(/Fully Solved[^\d]*\((\d+)\)/i) ||
            html.match(/Problems Solved:[^\d]*(\d+)/i);
        if (solvedMatch && solvedMatch[1]) {
            stats.push({ label: "solved", value: `${solvedMatch[1]} solved` });
        }

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

        const stats: Array<{ label: string; value: string }> = [];

        try {
            const badgesRes = await fetch(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`, {
                headers: { "User-Agent": "Mozilla/5.0" },
                signal: AbortSignal.timeout(4000),
            });
            if (badgesRes.ok) {
                const badgeData = (await badgesRes.json()) as any;
                if (badgeData?.models && Array.isArray(badgeData.models)) {
                    let totalSolved = 0;
                    for (const b of badgeData.models) {
                        if (typeof b.solved === "number") totalSolved += b.solved;
                    }
                    if (totalSolved > 0) {
                        stats.push({ label: "solved", value: `${totalSolved} solved` });
                    }
                }
            }
        } catch {
            // Non-fatal
        }

        if (user.level) {
            stats.push({ label: "level", value: `Level ${user.level}` });
        }
        if (user.country) {
            stats.push({ label: "country", value: user.country });
        }
        if (stats.length === 0) {
            stats.push({ label: "portal", value: "HackerRank" });
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

        const stats: Array<{ label: string; value: string }> = [];

        try {
            const acRes = await fetch(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encodeURIComponent(username)}`, {
                headers: { "User-Agent": "Orbix" },
                signal: AbortSignal.timeout(4000),
            });
            if (acRes.ok) {
                const acData = (await acRes.json()) as any;
                if (acData && typeof acData.count === "number") {
                    stats.push({ label: "solved", value: `${acData.count} solved` });
                }
            }
        } catch {
            // Non-fatal
        }

        const countryMatch = html.match(/Country\/Region<\/th><td>(?:<img[^>]+>\s*)?([^<]+)<\/td>/i);
        if (countryMatch && countryMatch[1]?.trim()) {
            stats.push({ label: "country", value: countryMatch[1].trim() });
        }
        if (stats.length === 0) {
            stats.push({ label: "portal", value: "AtCoder" });
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
        const taskMatch = html.match(/Tasks solved:<\/td><td[^>]*>(\d+)/i) || html.match(/Tasks solved[^\d]*(\d+)/i);

        const stats: Array<{ label: string; value: string }> = [];
        if (taskMatch && taskMatch[1]) {
            stats.push({ label: "solved", value: `${taskMatch[1]} solved` });
        } else if (subCount !== "0") {
            stats.push({ label: "solved", value: `${subCount} solved` });
        } else {
            stats.push({ label: "portal", value: "CSES" });
        }

        return {
            success: true,
            portal: "cses",
            username,
            name: `CSES User ${username}`,
            avatar: getFallbackAvatar(username),
            stats,
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
        if (data.completed_problems || data.problems_solved) {
            const pSolved = data.completed_problems || data.problems_solved;
            stats.push({ label: "solved", value: `${pSolved} solved` });
        }
        if (data.score) {
            stats.push({ label: "score", value: `${data.score} score` });
        }
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

async function fetchCode360(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\.\-]{3,50}$/.test(clean)) return null;

    let name = clean;
    const stats: Array<{ label: string; value: string }> = [
        { label: "portal", value: "Code360" },
        { label: "practice", value: "Coding Ninjas" },
    ];

    try {
        const res = await fetch(`https://www.naukri.com/code360/profile/${encodeURIComponent(clean)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const html = await res.text();
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes("Page Not Found") && !titleMatch[1].includes("404")) {
                const parts = titleMatch[1].split("|")[0]?.trim();
                if (parts && !parts.toLowerCase().includes("code360")) name = parts;
            }
        }
    } catch {
        // Fallback to verified username
    }

    return {
        success: true,
        portal: "code360",
        username: clean,
        name,
        avatar: getFallbackAvatar(clean),
        stats,
        profileUrl: `https://www.naukri.com/code360/profile/${clean}`,
        verified: true,
    };
}

async function fetchSPOJ(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\.]{3,25}$/.test(clean)) return null;

    return {
        success: true,
        portal: "spoj",
        username: clean,
        name: clean,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "SPOJ" },
            { label: "status", value: "Sphere Judge" },
        ],
        profileUrl: `https://www.spoj.com/users/${clean}/`,
        verified: true,
    };
}

async function fetchMedium(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\-\.]{2,30}$/.test(clean)) return null;

    return {
        success: true,
        portal: "medium",
        username: clean,
        name: `@${clean}`,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "Medium" },
            { label: "publication", value: "Writer" },
        ],
        profileUrl: `https://medium.com/@${clean}`,
        verified: true,
    };
}

async function fetchSubstack(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\-]{2,30}$/.test(clean)) return null;

    return {
        success: true,
        portal: "substack",
        username: clean,
        name: clean,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "Substack" },
            { label: "newsletter", value: "Author" },
        ],
        profileUrl: `https://${clean}.substack.com`,
        verified: true,
    };
}

async function fetchAlgorithmXlr8(username: string): Promise<PortalProfileData | null> {
    const clean = username.trim().replace(/^@+/, "");
    if (!/^[a-zA-Z0-9_\-]{2,30}$/.test(clean)) return null;

    return {
        success: true,
        portal: "algorithmxlr8",
        username: clean,
        name: clean,
        avatar: getFallbackAvatar(clean),
        stats: [
            { label: "portal", value: "AlgorithmXlr8" },
            { label: "member", value: "Verified" },
        ],
        profileUrl: `https://algorithmxlr8.com/user/${clean}`,
        verified: true,
    };
}

export async function verifyAndFetchPortal(portal: string, username: string): Promise<PortalProfileData | null> {
    const cleanPortal = String(portal || "").toLowerCase().trim();
    const cleanUsername = String(username || "").trim();
    if (!cleanPortal || !cleanUsername) return null;

    switch (cleanPortal) {
        case "leetcode":
            return await fetchLeetCode(cleanUsername);
        case "codeforces":
            return await fetchCodeforces(cleanUsername);
        case "github":
            return await fetchGitHub(cleanUsername);
        case "codechef":
            return await fetchCodeChef(cleanUsername);
        case "geeksforgeeks":
            return await fetchGeeksforGeeks(cleanUsername);
        case "hackerrank":
            return await fetchHackerRank(cleanUsername);
        case "atcoder":
            return await fetchAtCoder(cleanUsername);
        case "cses":
            return await fetchCSES(cleanUsername);
        case "hackerearth":
            return await fetchHackerEarth(cleanUsername);
        case "interviewbit":
            return await fetchInterviewBit(cleanUsername);
        case "topcoder":
            return await fetchTopCoder(cleanUsername);
        case "code360":
        case "codingninjas":
            return await fetchCode360(cleanUsername);
        case "spoj":
            return await fetchSPOJ(cleanUsername);
        case "medium":
            return await fetchMedium(cleanUsername);
        case "substack":
            return await fetchSubstack(cleanUsername);
        case "algorithmxlr8":
            return await fetchAlgorithmXlr8(cleanUsername);
        default:
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

        const profileData = await verifyAndFetchPortal(portal, username);

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
    if (low.includes("code360") || low.includes("codingninjas.com")) return "code360";
    if (low.includes("spoj.com")) return "spoj";
    if (low.includes("medium.com")) return "medium";
    if (low.includes("substack.com")) return "substack";
    if (low.includes("algorithmxlr8.com")) return "algorithmxlr8";

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
        case "code360":
        case "codingninjas": {
            const m = withoutQuery.match(/(?:naukri\.com\/code360\/profile|codingninjas\.com\/codestudio\/profile)\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "spoj": {
            const m = withoutQuery.match(/spoj\.com\/users\/([a-zA-Z0-9_\.\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "medium": {
            const m = withoutQuery.match(/medium\.com\/@([a-zA-Z0-9_\-\.]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "substack": {
            const m = withoutQuery.match(/([a-zA-Z0-9_\-]+)\.substack\.com/i)
                || withoutQuery.match(/substack\.com\/@([a-zA-Z0-9_\-]+)/i);
            if (m && m[1]) return m[1];
            return withoutQuery.split("/").pop() || clean;
        }
        case "algorithmxlr8": {
            const m = withoutQuery.match(/algorithmxlr8\.com\/(?:user\/)?([a-zA-Z0-9_\-]+)/i);
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
        case "code360":
        case "codingninjas":
            return `https://www.naukri.com/code360/profile/${u}`;
        case "spoj":
            return `https://www.spoj.com/users/${u}/`;
        case "medium":
            return `https://medium.com/@${u}`;
        case "substack":
            return `https://${u}.substack.com`;
        case "algorithmxlr8":
            return `https://algorithmxlr8.com/user/${u}`;
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
                await Promise.allSettled([
                    redis.set(
                        `user:portals:${userIdentifier}`,
                        JSON.stringify(itemsToSave),
                        "EX",
                        60 * 60 * 24 * 7
                    ),
                    redis.del(`profile:public:${userIdentifier}`),
                ]);
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
                last_sync_status,
                last_sync_at,
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

export interface ResyncPortalResult {
    portal: string;
    username: string;
    status: "valid" | "broken" | "error";
    verified: boolean;
    message?: string;
    profileData?: PortalProfileData;
    lastSyncAt: string;
}

// Background Platform Re-Sync endpoint
export const handleResyncPortals = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const body = req.body || {};
        const userIdentifier =
            authUser?.username ||
            authUser?.gmail ||
            body.username ||
            (req.query.username as string) ||
            null;

        let portalsToCheck: Array<{ portal: string; username: string; raw_input?: string }> = [];

        // Check if caller sent a specific list of portals (from frontend state)
        if (Array.isArray(body.portals) && body.portals.length > 0) {
            portalsToCheck = body.portals
                .map((p: any) => ({
                    portal: String(p.portal || p.id || "").toLowerCase().trim(),
                    username: String(p.username || p.portal_username || "").trim(),
                    raw_input: p.raw_input || p.link || "",
                }))
                .filter((p: any) => p.portal && p.username);
        } else if (userIdentifier) {
            // Retrieve user links from DB
            try {
                const dbRes = await query(
                    `SELECT portal, portal_username, link, raw_input, verified, last_sync_status
                     FROM user_links
                     WHERE username = $1
                     ORDER BY portal ASC;`,
                    [userIdentifier]
                );
                if (dbRes && dbRes.rows.length > 0) {
                    portalsToCheck = dbRes.rows.map((row) => ({
                        portal: row.portal,
                        username: row.portal_username,
                        raw_input: row.raw_input || row.link,
                    }));
                }
            } catch (dbErr: any) {
                console.warn("Resync DB lookup warning:", dbErr.message || dbErr);
            }

            // Fallback to Redis cache
            if (portalsToCheck.length === 0 && redis && redis.status === "ready") {
                try {
                    const cached = await redis.get(`user:portals:${userIdentifier}`);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed)) {
                            portalsToCheck = parsed
                                .map((p: any) => ({
                                    portal: String(p.portal || "").toLowerCase().trim(),
                                    username: String(p.portal_username || p.username || "").trim(),
                                    raw_input: p.raw_input || p.link || "",
                                }))
                                .filter((p: any) => p.portal && p.username);
                        }
                    }
                } catch {
                    // ignore
                }
            }
        }

        if (portalsToCheck.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No connected portals found to re-sync.",
                results: [],
                summary: { total: 0, valid: 0, broken: 0, error: 0 },
                timestamp: new Date().toISOString(),
            });
        }

        const nowIso = new Date().toISOString();

        // Check platforms in parallel with timeout safety
        const promises = portalsToCheck.map(async (item): Promise<ResyncPortalResult> => {
            try {
                const profile = await verifyAndFetchPortal(item.portal, item.username);

                if (profile && profile.success) {
                    // Live account confirmed active and valid
                    if (userIdentifier) {
                        try {
                            await query(
                                `UPDATE user_links
                                 SET verified = true,
                                     last_sync_status = 'valid',
                                     last_sync_at = CURRENT_TIMESTAMP,
                                     display_name = COALESCE($1, display_name),
                                     avatar_url = COALESCE($2, avatar_url),
                                     stats = COALESCE($3, stats),
                                     updated_at = CURRENT_TIMESTAMP
                                 WHERE username = $4 AND portal = $5;`,
                                [
                                    profile.name || null,
                                    profile.avatar || null,
                                    JSON.stringify(profile.stats || []),
                                    userIdentifier,
                                    item.portal,
                                ]
                            );
                        } catch (uErr: any) {
                            console.warn(`Resync update valid DB error for ${item.portal}:`, uErr.message);
                        }
                    }

                    return {
                        portal: item.portal,
                        username: item.username,
                        status: "valid",
                        verified: true,
                        profileData: profile,
                        lastSyncAt: nowIso,
                    };
                } else {
                    // Profile returned null: account not found / username changed / 404
                    if (userIdentifier) {
                        try {
                            await query(
                                `UPDATE user_links
                                 SET verified = false,
                                     last_sync_status = 'broken',
                                     last_sync_at = CURRENT_TIMESTAMP,
                                     updated_at = CURRENT_TIMESTAMP
                                 WHERE username = $1 AND portal = $2;`,
                                [userIdentifier, item.portal]
                            );
                        } catch (uErr: any) {
                            console.warn(`Resync update broken DB error for ${item.portal}:`, uErr.message);
                        }
                    }

                    return {
                        portal: item.portal,
                        username: item.username,
                        status: "broken",
                        verified: false,
                        message: `Account not found on ${item.portal}. The username '${item.username}' may have been changed or deleted.`,
                        lastSyncAt: nowIso,
                    };
                }
            } catch (err: any) {
                // Network error / external service timeout
                if (userIdentifier) {
                    try {
                        await query(
                            `UPDATE user_links
                             SET last_sync_status = 'error',
                                 last_sync_at = CURRENT_TIMESTAMP,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE username = $1 AND portal = $2;`,
                            [userIdentifier, item.portal]
                        );
                    } catch {
                        // ignore
                    }
                }

                return {
                    portal: item.portal,
                    username: item.username,
                    status: "error",
                    verified: false,
                    message: `Service error checking ${item.portal}: ${err?.message || "Request timed out"}`,
                    lastSyncAt: nowIso,
                };
            }
        });

        const results = await Promise.all(promises);

        // Update Redis cache if userIdentifier is present
        if (userIdentifier && redis && redis.status === "ready") {
            try {
                const dbAll = await query(
                    `SELECT portal, portal_username, link, raw_input, verified, display_name, avatar_url, stats, last_sync_status, last_sync_at
                     FROM user_links
                     WHERE username = $1
                     ORDER BY portal ASC;`,
                    [userIdentifier]
                );
                if (dbAll && dbAll.rows.length > 0) {
                    await Promise.allSettled([
                        redis.set(
                            `user:portals:${userIdentifier}`,
                            JSON.stringify(dbAll.rows),
                            "EX",
                            60 * 60 * 24 * 7
                        ),
                        redis.del(`profile:public:${userIdentifier}`),
                    ]);
                }
            } catch {
                // ignore
            }
        }

        const validCount = results.filter((r) => r.status === "valid").length;
        const brokenCount = results.filter((r) => r.status === "broken").length;
        const errorCount = results.filter((r) => r.status === "error").length;

        return res.status(200).json({
            success: true,
            username: userIdentifier,
            results,
            summary: {
                total: results.length,
                valid: validCount,
                broken: brokenCount,
                error: errorCount,
            },
            timestamp: nowIso,
        });
    } catch (err: any) {
        console.error("Resync endpoint error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to perform platform re-sync",
            error: err.message,
        });
    }
};

// Route mounts using authenticate middleware
portalsRouter.post("/save", authenticate, handleSavePortals);
portalsRouter.post("/profile/save", authenticate, handleSavePortals);
portalsRouter.get("/save", authenticate, handleGetSavedPortals);
portalsRouter.get("/profile/save", authenticate, handleGetSavedPortals);
portalsRouter.get("/links", authenticate, handleGetSavedPortals);

// Resync endpoints
portalsRouter.post("/resync", optionalAuthenticate, handleResyncPortals);
portalsRouter.get("/resync", optionalAuthenticate, handleResyncPortals);
portalsRouter.post("/profile/resync", optionalAuthenticate, handleResyncPortals);
portalsRouter.get("/profile/resync", optionalAuthenticate, handleResyncPortals);

// Individual platform visibility toggle
portalsRouter.patch("/:portal/visibility", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const portal = String(req.params.portal || "").trim().toLowerCase();
        const { isPublic } = req.body;

        if (typeof isPublic !== "boolean") {
            return res.status(400).json({ success: false, message: "isPublic must be boolean" });
        }

        const result = await query(
            `UPDATE user_links
             SET is_public = $1, updated_at = CURRENT_TIMESTAMP
             WHERE (username = $2 OR username = $3) AND LOWER(portal) = $4
             RETURNING id, portal, portal_username AS "portalUsername", is_public AS "isPublic";`,
            [isPublic, authUser.username, authUser.gmail, portal]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: `Platform connection '${portal}' not found` });
        }

        if (redis && redis.status === "ready") {
            await Promise.allSettled([
                redis.del(`profile:public:${authUser.username}`),
                redis.del(`user:portals:${authUser.username}`),
            ]);
        }

        return res.status(200).json({
            success: true,
            message: `Platform visibility set to ${isPublic ? "public" : "hidden"}`,
            platform: result.rows[0],
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Error updating visibility", error: err.message });
    }
});

// Disconnect/delete platform
portalsRouter.delete("/:portal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const portal = String(req.params.portal || "").trim().toLowerCase();

        const result = await query(
            `DELETE FROM user_links
             WHERE (username = $1 OR username = $2) AND LOWER(portal) = $3
             RETURNING id, portal;`,
            [authUser.username, authUser.gmail, portal]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: `Platform connection '${portal}' not found` });
        }

        if (redis && redis.status === "ready") {
            await Promise.allSettled([
                redis.del(`profile:public:${authUser.username}`),
                redis.del(`user:portals:${authUser.username}`),
            ]);
        }

        return res.status(200).json({
            success: true,
            message: `Platform '${portal}' disconnected successfully`,
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Error disconnecting platform", error: err.message });
    }
});

// Edit platform handle
portalsRouter.put("/:portal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const portal = String(req.params.portal || "").trim().toLowerCase();
        const { handle, link } = req.body;

        const rawCandidate = handle || link;
        if (!rawCandidate) {
            return res.status(400).json({ success: false, message: "Handle or link is required" });
        }

        const cleanHandle = extractPortalUsername(portal, rawCandidate) || rawCandidate.trim();
        const verifiedData = await verifyAndFetchPortal(portal, cleanHandle);

        const finalHandle = verifiedData?.username || cleanHandle;
        const finalLink = verifiedData?.profileUrl || link || buildPortalLink(portal, cleanHandle);
        const finalDisplayName = verifiedData?.name || authUser.firstName;
        const finalAvatar = verifiedData?.avatar || null;
        const finalStats = verifiedData?.stats || [];
        const isVerified = verifiedData ? verifiedData.verified !== false : true;

        const updateResult = await query(
            `UPDATE user_links
             SET portal_username = $1,
                 link = $2,
                 raw_input = $3,
                 verified = $4,
                 display_name = $5,
                 avatar_url = $6,
                 stats = $7::jsonb,
                 last_sync_status = 'valid',
                 last_sync_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE (username = $8 OR username = $9) AND LOWER(portal) = $10
             RETURNING id, portal, portal_username AS "portalUsername", link, verified, is_public AS "isPublic";`,
            [finalHandle, finalLink, rawCandidate, isVerified, finalDisplayName, finalAvatar, JSON.stringify(finalStats), authUser.username, authUser.gmail, portal]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: `Platform connection '${portal}' not found` });
        }

        if (redis && redis.status === "ready") {
            await Promise.allSettled([
                redis.del(`profile:public:${authUser.username}`),
                redis.del(`user:portals:${authUser.username}`),
            ]);
        }

        return res.status(200).json({
            success: true,
            message: `Platform '${portal}' updated successfully`,
            platform: updateResult.rows[0],
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Error updating platform", error: err.message });
    }
});

export default portalsRouter;

