export interface PlatformRatingInfo {
    rating: number;
    tier?: string;
    color?: string;
    badge?: string;
}

export function parseLeaderboardRatings(
    raw: any,
    scoreBreakdown?: any
): Record<string, PlatformRatingInfo> {
    let r = raw;
    if (typeof r === "string") {
        try {
            r = JSON.parse(r);
            if (typeof r === "string") {
                r = JSON.parse(r);
            }
        } catch {
            r = {};
        }
    }

    const extract = (val: any): PlatformRatingInfo | null => {
        if (!val) return null;
        if (typeof val === "number" && val > 0) {
            return { rating: Math.round(val) };
        }
        if (typeof val === "object" && typeof val.rating === "number" && val.rating > 0) {
            return {
                rating: Math.round(val.rating),
                tier: val.tier,
                color: val.color,
                badge: val.badge || val.tier,
            };
        }
        if (typeof val === "string") {
            const clean = val.replace(/,/g, "").trim();
            const parsed = parseInt(clean, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return { rating: parsed };
            }
        }
        return null;
    };

    const res: Record<string, PlatformRatingInfo> = {};

    if (r && typeof r === "object") {
        const cf = extract(r.codeforces || r.cf);
        if (cf) res.codeforces = { ...cf, color: cf.color || "#E02424" };

        const lc = extract(r.leetcode || r.lc);
        if (lc) res.leetcode = { ...lc, color: lc.color || "#D97706" };

        const cc = extract(r.codechef || r.cc);
        if (cc) res.codechef = { ...cc, color: cc.color || "#854D0E" };

        const ac = extract(r.atcoder || r.ac);
        if (ac) res.atcoder = { ...ac, color: ac.color || "#0284C7" };

        const tc = extract(r.topcoder || r.tc);
        if (tc) res.topcoder = { ...tc, color: tc.color || "#0284C7" };
    }

    // Fallback: If no ratings were parsed, check scoreBreakdown.ratings
    if (Object.keys(res).length === 0 && scoreBreakdown) {
        let sb = scoreBreakdown;
        if (typeof sb === "string") {
            try { sb = JSON.parse(sb); } catch { sb = null; }
        }
        if (sb && typeof sb === "object" && sb.ratings) {
            const cf = extract(sb.ratings.codeforces);
            if (cf) res.codeforces = { ...cf, color: cf.color || "#E02424" };

            const lc = extract(sb.ratings.leetcode);
            if (lc) res.leetcode = { ...lc, color: lc.color || "#D97706" };

            const cc = extract(sb.ratings.codechef);
            if (cc) res.codechef = { ...cc, color: cc.color || "#854D0E" };

            const ac = extract(sb.ratings.atcoder);
            if (ac) res.atcoder = { ...ac, color: ac.color || "#0284C7" };

            const tc = extract(sb.ratings.topcoder);
            if (tc) res.topcoder = { ...tc, color: tc.color || "#0284C7" };
        }
    }

    return res;
}

export interface LeaderboardEntry {
    rank: number;
    collegeRank?: number | null;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    college: string | null;
    collegeId?: string | null;
    collegeCity?: string | null;
    collegeState?: string | null;
    isVerified: boolean;
    score: number;
    scoreBreakdown?: any;
    totalSolved: number;
    totalContests: number;
    platformRatings: Record<string, PlatformRatingInfo>;
    streak: number;
    updatedAt: string;
}

export interface LeaderboardMetadata {
    title: string;
    description: string;
    period: string;
    totalCoders: number;
    page: number;
    limit: number;
    totalPages: number;
    collegesRepresentedCount?: number;
    lastUpdated: string;
}

export interface ParticipatingCollege {
    id: string;
    name?: string;
    officialName: string;
    city: string | null;
    state?: string | null;
    district?: string | null;
    institutionType?: string | null;
    aisheCode?: string | null;
    verificationStatus?: string | null;
    totalCoders?: number;
    studentCount?: number;
    topScore?: number;
}

export interface LeaderboardResponse {
    success: boolean;
    scope?: "global" | "college";
    college?: ParticipatingCollege;
    metadata: LeaderboardMetadata;
    podium: LeaderboardEntry[];
    entries: LeaderboardEntry[];
    currentUser?: LeaderboardEntry | null;
    collegesRepresentedCount?: number;
    cached?: boolean;
}

export interface CollegeLeaderboardResponse {
    success: boolean;
    college: {
        id: string;
        name: string;
        code?: string | null;
        city?: string | null;
        country?: string | null;
    };
    totalStudents: number;
    metadata: LeaderboardMetadata;
    podium: LeaderboardEntry[];
    entries: LeaderboardEntry[];
    currentUser?: LeaderboardEntry | null;
    collegesRepresentedCount?: number;
    cached?: boolean;
}

export interface ParticipatingCollegesResponse {
    success: boolean;
    collegesRepresentedCount: number;
    total: number;
    colleges: ParticipatingCollege[];
    lastUpdated: string;
    cached?: boolean;
}
