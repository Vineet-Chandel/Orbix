import { PORTALS } from "./portalParser";
import { PLATFORM_REGISTRY } from "./platformRegistry";

export interface AggregatedCodingStats {
    totalSolved: number;
    easy: number;
    medium: number;
    hard: number;
    activeDays: number;
    contests: number;
    dayStreak: number;
    eligiblePlatformsCount: number;
    synchronizedCount: number;
    incompleteSync: boolean;
    qualificationNote: string;
}

export interface RankedPlatform {
    id: string;
    name: string;
    username: string;
    profileUrl: string;
    brandColor: string;
    solvedCount: number;
    easy?: number;
    medium?: number;
    hard?: number;
    rating?: number;
    isVerified: boolean;
    syncStatus?: string;
    isGitHub?: boolean;
    publicRepos?: number;
    contributionsOrCommits?: number;
}

export interface GitHubCardStats {
    connected: boolean;
    username: string;
    name: string;
    avatarUrl: string;
    publicRepos: number;
    contributionsOrCommits: number;
    followers: number;
    profileUrl: string;
}

export interface CoderTypeBadge {
    title: string;
    tagline: string;
    level: string;
    badgeColor: string;
}

// Platforms explicitly excluded from problem-solving aggregates
const NON_PROBLEM_PORTALS = new Set([
    "github",
    "gitlab",
    "kaggle",
    "medium",
    "substack",
    "devto",
    "hashnode",
]);

export interface ConnectedPlatformBadge {
    id: string;
    name: string;
    username: string;
    profileUrl: string;
    brandColor: string;
    solvedCount?: number;
    isVerified: boolean;
}

/**
 * Extracts solved problem count from a platform profile.
 * Checks difficulty totals, direct numeric fields, stats array, and fallback heuristics.
 */
export function extractPlatformSolved(profile: any, portalId: string): number {
    if (!profile) return 0;
    const lowerId = portalId.toLowerCase();
    if (NON_PROBLEM_PORTALS.has(lowerId)) return 0;

    // 1. If difficulty object exists with total (allow explicit 0)
    if (profile.difficulty && typeof profile.difficulty.total === "number") {
        return Math.max(0, profile.difficulty.total);
    }

    // 2. Direct numeric properties (allow explicit 0)
    if (typeof profile.totalSolved === "number") return Math.max(0, profile.totalSolved);
    if (typeof profile.solvedCount === "number") return Math.max(0, profile.solvedCount);
    if (typeof profile.problemsSolved === "number") return Math.max(0, profile.problemsSolved);
    if (typeof profile.solved === "number") return Math.max(0, profile.solved);

    // 3. Guard against legacy CodeChef bug where 0-problem accounts matched template 'padding:3px' as '3 solved'
    const stats: Array<{ label?: string; value?: string }> = Array.isArray(profile.stats) ? profile.stats : [];
    if (lowerId === "codechef") {
        const hasRatingOrStars = stats.some((s) => {
            const l = (s.label || "").toLowerCase();
            const v = (s.value || "").toLowerCase();
            return l === "rating" || v.includes("rating") || l === "stars" || v.includes("★");
        });
        if (!hasRatingOrStars && stats.length === 1 && (stats[0].value || "").trim() === "3 solved") {
            return 0;
        }
    }

    // 4. Parse stats array
    for (const s of stats) {
        const lbl = (s.label || "").toLowerCase();
        const val = (s.value || "").toLowerCase();
        if (lbl === "solved" || val.includes("solved") || lbl.includes("problem") || val.includes("problem")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) {
                const parsed = parseInt(m[1].replace(/,/g, ""), 10);
                if (!isNaN(parsed)) return Math.max(0, parsed);
            }
        }
    }

    // 5. Submissions fallback (e.g. CSES)
    if (lowerId === "cses") {
        for (const s of stats) {
            if ((s.label || "").toLowerCase().includes("submi") || (s.value || "").toLowerCase().includes("submi")) {
                const m = (s.value || "").match(/([\d,]+)/);
                if (m) {
                    const parsed = parseInt(m[1].replace(/,/g, ""), 10);
                    if (!isNaN(parsed) && parsed > 0) return parsed;
                }
            }
        }
    }

    return 0;
}

/**
 * Extracts difficulty breakdown (easy, medium, hard) from a platform profile.
 * If explicit breakdown is present, uses it.
 * If only total problem count is present, classifies them into easy, medium, and hard
 * using realistic competitive programming proportions so all platforms contribute to the sum.
 */
export function extractPlatformDifficulty(
    profile: any,
    portalId: string,
    _knownSolved?: number
): { easy: number; medium: number; hard: number; hasBreakdown: boolean } {
    if (!profile) {
        return { easy: 0, medium: 0, hard: 0, hasBreakdown: false };
    }
    const lowerId = portalId.toLowerCase();
    if (NON_PROBLEM_PORTALS.has(lowerId)) {
        return { easy: 0, medium: 0, hard: 0, hasBreakdown: false };
    }

    // 1. Check explicit difficulty object
    if (profile.difficulty && (
        typeof profile.difficulty.easy === "number" ||
        typeof profile.difficulty.medium === "number" ||
        typeof profile.difficulty.hard === "number"
    )) {
        const easy = Math.max(0, profile.difficulty.easy || 0);
        const medium = Math.max(0, profile.difficulty.medium || 0);
        const hard = Math.max(0, profile.difficulty.hard || 0);
        if (easy > 0 || medium > 0 || hard > 0) {
            return { easy, medium, hard, hasBreakdown: true };
        }
    }

    // 2. Direct properties on profile
    if (typeof profile.easy === "number" || typeof profile.medium === "number" || typeof profile.hard === "number") {
        const easy = Math.max(0, profile.easy || 0);
        const medium = Math.max(0, profile.medium || 0);
        const hard = Math.max(0, profile.hard || 0);
        if (easy > 0 || medium > 0 || hard > 0) {
            return { easy, medium, hard, hasBreakdown: true };
        }
    }

    // 3. Check stats array for easy, medium, hard
    const stats: Array<{ label?: string; value?: string }> = Array.isArray(profile.stats) ? profile.stats : [];
    let easyFound: number | null = null;
    let mediumFound: number | null = null;
    let hardFound: number | null = null;

    for (const s of stats) {
        const lbl = (s.label || "").toLowerCase();
        const val = (s.value || "").toLowerCase();
        if (lbl === "easy" || val.includes("easy")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) easyFound = parseInt(m[1].replace(/,/g, ""), 10);
        }
        if (lbl === "medium" || lbl === "med" || val.includes("medium")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) mediumFound = parseInt(m[1].replace(/,/g, ""), 10);
        }
        if (lbl === "hard" || val.includes("hard")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) hardFound = parseInt(m[1].replace(/,/g, ""), 10);
        }
    }

    if (easyFound !== null || mediumFound !== null || hardFound !== null) {
        const easy = Math.max(0, easyFound || 0);
        const medium = Math.max(0, mediumFound || 0);
        const hard = Math.max(0, hardFound || 0);
        if (easy > 0 || medium > 0 || hard > 0) {
            return { easy, medium, hard, hasBreakdown: true };
        }
    }

    // When no platform-verified difficulty breakdown is supplied, report breakdown as unavailable
    return { easy: 0, medium: 0, hard: 0, hasBreakdown: false };
}

/**
 * Aggregates coding statistics strictly across eligible connected coding platforms.
 * Sums up all Easy, Medium, and Hard problems across every connected platform.
 * GitHub and non-problem platforms NEVER contribute to problem totals.
 */
export function aggregateCodingStats(connectedPortals: Record<string, any>): AggregatedCodingStats {
    let totalSolved = 0;
    let easy = 0;
    let medium = 0;
    let hard = 0;
    let eligibleCount = 0;
    let syncCount = 0;
    let hasIncomplete = false;

    let maxActiveDays = 0;
    let totalContests = 0;
    let maxDayStreak = 0;

    for (const [portalId, profile] of Object.entries(connectedPortals || {})) {
        if (!profile) continue;
        const lowerId = portalId.toLowerCase();

        // Skip non-coding platforms from problem totals
        if (NON_PROBLEM_PORTALS.has(lowerId)) continue;

        eligibleCount++;
        const isSynced = profile.verified !== false && profile.syncStatus !== "broken";
        if (isSynced) {
            syncCount++;
        } else {
            hasIncomplete = true;
        }

        const solved = extractPlatformSolved(profile, lowerId);
        totalSolved += solved;

        const diff = extractPlatformDifficulty(profile, lowerId, solved);
        easy += diff.easy;
        medium += diff.medium;
        hard += diff.hard;

        // Extract active days, contests, streak from stats if available
        const stats = Array.isArray(profile.stats) ? profile.stats : [];
        for (const s of stats) {
            const lbl = (s.label || "").toLowerCase();
            const val = (s.value || "").toLowerCase();

            // Active days (use highest individual verified calendar active days, do not blindly sum)
            if (lbl.includes("active") || val.includes("active day")) {
                const m = (s.value || "").match(/([\d,]+)/);
                if (m) {
                    const days = parseInt(m[1].replace(/,/g, ""), 10);
                    if (!isNaN(days) && days > maxActiveDays) maxActiveDays = days;
                }
            }

            // Contests attended or contest rating
            if (lbl.includes("contest") || val.includes("contest")) {
                const m = (s.value || "").match(/([\d,]+)/);
                if (m) {
                    const c = parseInt(m[1].replace(/,/g, ""), 10);
                    if (!isNaN(c)) totalContests += c;
                }
            }

            // Streaks (use highest verified streak across platforms)
            if (lbl.includes("streak") || val.includes("streak")) {
                const m = (s.value || "").match(/([\d,]+)/);
                if (m) {
                    const st = parseInt(m[1].replace(/,/g, ""), 10);
                    if (!isNaN(st) && st > maxDayStreak) maxDayStreak = st;
                }
            }
        }
    }

    const qualificationNote =
        eligibleCount === 0
            ? "No coding platforms connected yet."
            : hasIncomplete
            ? `Based on ${syncCount} of ${eligibleCount} synchronized platforms.`
            : `Verified across ${syncCount} connected coding platforms.`;

    return {
        totalSolved,
        easy,
        medium,
        hard,
        activeDays: maxActiveDays,
        contests: totalContests,
        dayStreak: maxDayStreak,
        eligiblePlatformsCount: eligibleCount,
        synchronizedCount: syncCount,
        incompleteSync: hasIncomplete,
        qualificationNote,
    };
}

/**
 * Deterministic Coder Type & Tagline based on verified problem solve counts.
 */
export function getCoderType(totalSolved: number, contests = 0): CoderTypeBadge {
    if (totalSolved >= 1500 || contests >= 50) {
        return {
            title: "Grandmaster Coder",
            tagline: "Master of complex algorithms",
            level: "Legendary",
            badgeColor: "#F59E0B",
        };
    }
    if (totalSolved >= 800 || contests >= 25) {
        return {
            title: "Elite Competitor",
            tagline: "Algorithms & systems virtuoso",
            level: "Diamond",
            badgeColor: "#8B5CF6",
        };
    }
    if (totalSolved >= 400 || contests >= 10) {
        return {
            title: "Algorithm Specialist",
            tagline: "Architect of efficient solutions",
            level: "Platinum",
            badgeColor: "#3B82F6",
        };
    }
    if (totalSolved >= 100) {
        return {
            title: "Problem Solver",
            tagline: "Consistent everyday builder",
            level: "Gold",
            badgeColor: "#10B981",
        };
    }
    if (totalSolved >= 1) {
        return {
            title: "Rising Coder",
            tagline: "One problem at a time",
            level: "Silver",
            badgeColor: "#F59E0B",
        };
    }
    return {
        title: "Aspiring Developer",
        tagline: "Building foundational mastery",
        level: "Bronze",
        badgeColor: "#9CA3AF",
    };
}

/**
 * Rank connected platforms dynamically in descending order of solved count,
 * with deterministic tie-breaking (verified status first, then alphabetical).
 * Excludes GitHub and non-problem platforms from the coding ranking.
 */
export function rankTopCodingPlatforms(
    connectedPortals: Record<string, any>,
    limit = 3,
    customOrder?: string[]
): RankedPlatform[] {
    const list: RankedPlatform[] = [];

    for (const [pId, profile] of Object.entries(connectedPortals)) {
        if (!profile) continue;
        const lowerId = pId.toLowerCase();
        if (NON_PROBLEM_PORTALS.has(lowerId)) continue;

        const regDef = PLATFORM_REGISTRY.find((p) => p.id === lowerId);
        const name = regDef?.name || PORTALS[lowerId]?.name || profile.name || lowerId;
        const brandColor = regDef?.brandColor || "#10B981";
        const username = profile.username || profile.portal_username || "";
        const profileUrl = profile.profileUrl || profile.url || profile.link || regDef?.buildUrl(username) || "";
        const solvedCount = extractPlatformSolved(profile, lowerId);
        const diff = extractPlatformDifficulty(profile, lowerId);

        list.push({
            id: lowerId,
            name,
            username,
            profileUrl,
            brandColor,
            solvedCount,
            easy: diff.easy,
            medium: diff.medium,
            hard: diff.hard,
            isVerified: profile.verified !== false && profile.syncStatus !== "broken",
            syncStatus: profile.syncStatus,
        });
    }

    // If custom order is explicitly specified by user:
    if (Array.isArray(customOrder) && customOrder.length > 0) {
        list.sort((a, b) => {
            const idxA = customOrder.indexOf(a.id);
            const idxB = customOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return b.solvedCount - a.solvedCount;
        });
    } else {
        // Default deterministic ranking: highest solved count first, then verified, then alphabetical
        list.sort((a, b) => {
            if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
            if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }

    return list.slice(0, limit);
}

/**
 * Extracts verified GitHub metrics if GitHub is connected.
 */
export function extractGitHubStats(
    connectedPortals: Record<string, any>,
    fallbackUsername?: string
): GitHubCardStats {
    const gh = connectedPortals?.github;

    if (!gh) {
        return {
            connected: false,
            username: "",
            name: "",
            avatarUrl: "",
            publicRepos: 0,
            contributionsOrCommits: 0,
            followers: 0,
            profileUrl: "",
        };
    }

    const rawUser = typeof gh === "string" ? gh : (gh.portal_username || gh.username || fallbackUsername || "");
    const username = (rawUser || "").trim();
    if (!username) {
        return {
            connected: false,
            username: "",
            name: "",
            avatarUrl: "",
            publicRepos: 0,
            contributionsOrCommits: 0,
            followers: 0,
            profileUrl: "",
        };
    }

    const name = (typeof gh === "object" ? gh.name || gh.display_name : "") || username || "GitHub";
    const avatarUrl = (typeof gh === "object" ? gh.avatar || gh.avatar_url : "") || (username ? `https://github.com/${username}.png` : "");
    const profileUrl = (typeof gh === "object" ? gh.profileUrl || gh.url || gh.link : "") || (username ? `https://github.com/${username}` : "");

    let publicRepos = typeof gh === "object" && typeof gh.public_repos === "number" ? gh.public_repos : (typeof gh === "object" && typeof gh.publicRepos === "number" ? gh.publicRepos : 0);
    let followers = typeof gh === "object" && typeof gh.followers === "number" ? gh.followers : 0;
    let commitsOrContributions = typeof gh === "object" && typeof gh.contributions === "number" ? gh.contributions : (typeof gh === "object" && typeof gh.commits === "number" ? gh.commits : 0);

    const stats = typeof gh === "object" && Array.isArray(gh.stats) ? gh.stats : [];
    for (const s of stats) {
        const lbl = (s.label || "").toLowerCase();
        const val = (s.value || "").toLowerCase();
        if (lbl.includes("repo") || val.includes("repo")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) publicRepos = parseInt(m[1].replace(/,/g, ""), 10) || publicRepos;
        }
        if (lbl.includes("follower") || val.includes("follower")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) followers = parseInt(m[1].replace(/,/g, ""), 10) || followers;
        }
        if (lbl.includes("commit") || val.includes("commit") || lbl.includes("contrib") || val.includes("contrib")) {
            const m = (s.value || "").match(/([\d,]+)/);
            if (m) commitsOrContributions = parseInt(m[1].replace(/,/g, ""), 10) || commitsOrContributions;
        }
    }

    return {
        connected: true,
        username,
        name,
        avatarUrl,
        publicRepos,
        contributionsOrCommits: commitsOrContributions,
        followers,
        profileUrl,
    };
}

/**
 * Extracts and returns all connected platforms (coding + social/dev) for showcase.
 * Used for the bottom connected platform logos row on the Orbix card.
 */
export function getAllConnectedPlatforms(
    connectedPortals: Record<string, any>
): ConnectedPlatformBadge[] {
    const list: ConnectedPlatformBadge[] = [];
    if (!connectedPortals || typeof connectedPortals !== "object") return list;

    for (const [pId, profile] of Object.entries(connectedPortals)) {
        if (!profile) continue;
        const lowerId = pId.toLowerCase();
        if (lowerId.startsWith("_") || lowerId === "theme") continue;

        const regDef = PLATFORM_REGISTRY.find((p) => p.id === lowerId);
        const name = regDef?.name || PORTALS[lowerId]?.name || profile.name || (lowerId.charAt(0).toUpperCase() + lowerId.slice(1));
        const username = (typeof profile === "string" ? profile : profile.username || profile.portal_username || "").trim();
        const profileUrl = (typeof profile === "object" ? profile.profileUrl || profile.url || profile.link : "") || regDef?.buildUrl(username) || "";
        const brandColor = regDef?.brandColor || "#10B981";
        const solvedCount = extractPlatformSolved(profile, lowerId);

        // A platform is connected if it has a username, isVerified, or profileUrl
        if (username || (typeof profile === "object" && (profile.verified || profile.connected)) || profileUrl) {
            list.push({
                id: lowerId,
                name,
                username,
                profileUrl,
                brandColor,
                solvedCount,
                isVerified: typeof profile === "object" ? profile.verified !== false && profile.syncStatus !== "broken" : true,
            });
        }
    }

    // Sort platforms series from largest number of submissions/solved to lowest
    list.sort((a, b) => {
        const countA = a.solvedCount || 0;
        const countB = b.solvedCount || 0;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
    });

    return list;
}

/**
 * Extracts and returns all platforms available for card slots (coding platforms + GitHub + other connected platforms).
 * Coding platforms are ranked by solved count, GitHub includes its repos/commits metrics.
 */
export function getAvailableCardPlatforms(
    connectedPortals: Record<string, any>,
    fallbackUsername?: string
): RankedPlatform[] {
    const list: RankedPlatform[] = [];
    if (!connectedPortals || typeof connectedPortals !== "object") return list;

    const seen = new Set<string>();

    // 1. Coding platforms
    for (const [pId, profile] of Object.entries(connectedPortals)) {
        if (!profile) continue;
        const lowerId = pId.toLowerCase();
        if (lowerId.startsWith("_") || lowerId === "theme" || lowerId === "github") continue;
        if (NON_PROBLEM_PORTALS.has(lowerId)) continue;

        const username = (typeof profile === "string" ? profile : profile.username || profile.portal_username || "").trim();
        const profileUrl = typeof profile === "object" ? profile.profileUrl || profile.url || profile.link || "" : "";
        if (!username && !(typeof profile === "object" && (profile.verified || profile.connected)) && !profileUrl) continue;

        const regDef = PLATFORM_REGISTRY.find((p) => p.id === lowerId);
        const name = regDef?.name || PORTALS[lowerId]?.name || profile.name || (lowerId.charAt(0).toUpperCase() + lowerId.slice(1));
        const brandColor = regDef?.brandColor || "#10B981";
        const finalUrl = profileUrl || regDef?.buildUrl(username) || "";
        const solvedCount = extractPlatformSolved(profile, lowerId);
        const diff = extractPlatformDifficulty(profile, lowerId, solvedCount);

        list.push({
            id: lowerId,
            name,
            username,
            profileUrl: finalUrl,
            brandColor,
            solvedCount,
            easy: diff.easy,
            medium: diff.medium,
            hard: diff.hard,
            isVerified: profile.verified !== false && profile.syncStatus !== "broken",
            syncStatus: profile.syncStatus,
            isGitHub: false,
        });
        seen.add(lowerId);
    }

    // Sort coding platforms: solvedCount descending, then verified, then alphabetical
    list.sort((a, b) => {
        if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
        if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    // 2. GitHub (if connected or active user)
    const ghStats = extractGitHubStats(connectedPortals, fallbackUsername);
    if (ghStats.connected || ghStats.username) {
        list.push({
            id: "github",
            name: "GitHub",
            username: ghStats.username || fallbackUsername || "developer",
            profileUrl: ghStats.profileUrl || `https://github.com/${ghStats.username || fallbackUsername || "developer"}`,
            brandColor: "#ffffff",
            solvedCount: 0,
            isVerified: true,
            isGitHub: true,
            publicRepos: ghStats.publicRepos,
            contributionsOrCommits: ghStats.contributionsOrCommits,
        });
        seen.add("github");
    }

    // 3. Any other connected publishing / portfolio platforms (e.g. hashnode, devto, kaggle)
    for (const [pId, profile] of Object.entries(connectedPortals)) {
        if (!profile) continue;
        const lowerId = pId.toLowerCase();
        if (seen.has(lowerId) || lowerId.startsWith("_") || lowerId === "theme") continue;

        const username = profile.username || profile.portal_username || "";
        const profileUrl = profile.profileUrl || profile.url || profile.link || "";
        if (!username && !profile.verified && !profileUrl && !profile.connected) continue;

        const regDef = PLATFORM_REGISTRY.find((p) => p.id === lowerId);
        const name = regDef?.name || PORTALS[lowerId]?.name || profile.name || (lowerId.charAt(0).toUpperCase() + lowerId.slice(1));
        const brandColor = regDef?.brandColor || "#6366F1";
        const finalUrl = profileUrl || regDef?.buildUrl(username) || "";

        list.push({
            id: lowerId,
            name,
            username,
            profileUrl: finalUrl,
            brandColor,
            solvedCount: 0,
            isVerified: profile.verified !== false && profile.syncStatus !== "broken",
            syncStatus: profile.syncStatus,
            isGitHub: false,
        });
        seen.add(lowerId);
    }

    return list;
}

/**
 * Resolves the displayed platform slots on LinkedIn (max 3) or Instagram Story (max 5) cards.
 * If user customized slots (selectedPlatformIds has items), respects user's exact slot ordering.
 * If default/empty, auto-ranks top coding platforms and dynamically includes GitHub if toggled.
 */
export function resolveShowcasedPlatforms(
    connectedPortals: Record<string, any>,
    selectedPlatformIds?: string[],
    maxSlots = 3,
    includeGitHub = false,
    fallbackUsername?: string
): RankedPlatform[] {
    const available = getAvailableCardPlatforms(connectedPortals, fallbackUsername);
    const availableMap = new Map<string, RankedPlatform>();
    for (const p of available) {
        availableMap.set(p.id.toLowerCase(), p);
    }

    // Custom user slots
    if (Array.isArray(selectedPlatformIds) && selectedPlatformIds.length > 0) {
        const result: RankedPlatform[] = [];
        for (const rawId of selectedPlatformIds) {
            if (!rawId) continue;
            const item = availableMap.get(rawId.toLowerCase());
            if (item && !result.some((r) => r.id === item.id)) {
                result.push(item);
                if (result.length >= maxSlots) break;
            }
        }
        if (result.length > 0) {
            return result;
        }
    }

    // Default smart auto-ranking:
    // Coding platforms first
    const codingPlatforms = available.filter((p) => !p.isGitHub && !NON_PROBLEM_PORTALS.has(p.id.toLowerCase()));
    const ghItem = availableMap.get("github");

    if (includeGitHub && ghItem) {
        // Dedicate the last slot to GitHub so card stays perfectly balanced
        const selectedCoding = codingPlatforms.slice(0, Math.max(0, maxSlots - 1));
        return [...selectedCoding, ghItem];
    }

    return codingPlatforms.slice(0, maxSlots);
}

