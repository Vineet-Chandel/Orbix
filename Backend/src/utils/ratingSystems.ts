/**
 * Comprehensive Competitive Programming & Coding Platform Rating Systems
 * Official rating bands, rank titles, division rules, star thresholds, and difficulty classifications.
 * Verified against official platform documentation.
 */

export interface PlatformTierDefinition {
    name: string;
    minRating: number;
    maxRating: number | null; // null represents unbounded top tier
    color: string;
    badgeBg?: string;
    description: string;
    nextTierName: string | null;
    pointsToNextTier: number;
    progressPercent: number;
    isOfficialBadge?: boolean;
}

// ============================================================================
// 1. CODEFORCES
// ============================================================================
// Rating bands:
// Newbie: < 1200 (Gray)
// Pupil: 1200–1399 (Green)
// Specialist: 1400–1599 (Cyan)
// Expert: 1600–1899 (Blue)
// Candidate Master: 1900–2099 (Purple)
// Master: 2100–2299 (Orange)
// International Master: 2300–2399 (Orange)
// Grandmaster: 2400–2599 (Red)
// International Grandmaster: 2600–2999 (Red)
// Legendary Grandmaster: 3000+ (Red)
// ============================================================================

export const CODEFORCES_TIERS = [
    { name: "Newbie", min: 0, max: 1199, nextMin: 1200, color: "#808080", next: "Pupil", desc: "Entry division (< 1200)" },
    { name: "Pupil", min: 1200, max: 1399, nextMin: 1400, color: "#008000", next: "Specialist", desc: "Green division (1200–1399)" },
    { name: "Specialist", min: 1400, max: 1599, nextMin: 1600, color: "#03a89e", next: "Expert", desc: "Cyan division (1400–1599)" },
    { name: "Expert", min: 1600, max: 1899, nextMin: 1900, color: "#0000ff", next: "Candidate Master", desc: "Blue division (1600–1899)" },
    { name: "Candidate Master", min: 1900, max: 2099, nextMin: 2100, color: "#aa00aa", next: "Master", desc: "Purple division (1900–2099)" },
    { name: "Master", min: 2100, max: 2299, nextMin: 2300, color: "#ff8c00", next: "International Master", desc: "Orange division (2100–2299)" },
    { name: "International Master", min: 2300, max: 2399, nextMin: 2400, color: "#ff8c00", next: "Grandmaster", desc: "Orange elite division (2300–2399)" },
    { name: "Grandmaster", min: 2400, max: 2599, nextMin: 2600, color: "#ff0000", next: "International Grandmaster", desc: "Red grandmaster tier (2400–2599)" },
    { name: "International Grandmaster", min: 2600, max: 2999, nextMin: 3000, color: "#ff0000", next: "Legendary Grandmaster", desc: "Red elite grandmaster (2600–2999)" },
    { name: "Legendary Grandmaster", min: 3000, max: null, nextMin: null, color: "#ff0000", next: null, desc: "Peak international tier (3000+)" },
] as const;

export function getCodeforcesTier(rating: number): PlatformTierDefinition {
    const r = Math.max(0, Math.round(rating));

    for (const t of CODEFORCES_TIERS) {
        if (t.max === null || r <= t.max) {
            const nextMin = t.nextMin;
            const pointsToNext = nextMin !== null ? Math.max(0, nextMin - r) : 0;
            const progress = nextMin !== null
                ? Math.min(100, Math.max(0, Math.round(((r - t.min) / (nextMin - t.min)) * 100)))
                : 100;

            return {
                name: t.name,
                minRating: t.min,
                maxRating: t.max,
                color: t.color,
                description: t.desc,
                nextTierName: t.next,
                pointsToNextTier: pointsToNext,
                progressPercent: progress,
            };
        }
    }

    const last = CODEFORCES_TIERS[CODEFORCES_TIERS.length - 1]!;
    return {
        name: last.name,
        minRating: last.min,
        maxRating: null,
        color: last.color,
        description: last.desc,
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
    };
}

// ============================================================================
// 2. LEETCODE
// ============================================================================
// Knight: 1850–2149
// Guardian: 2150+
// Unranked / Contestant: Below 1850
// NOTE: Distinguishes between verified badge awarded by LeetCode and estimated rating tier.
// ============================================================================

export function getLeetCodeTier(rating: number, officialBadgeName?: string | null): PlatformTierDefinition {
    const r = Math.max(0, Math.round(rating));
    const badge = (officialBadgeName || "").toLowerCase().trim();
    const hasOfficialGuardian = badge === "guardian";
    const hasOfficialKnight = badge === "knight";

    if (hasOfficialGuardian || r >= 2150) {
        return {
            name: "Guardian",
            minRating: 2150,
            maxRating: null,
            color: "#8b5cf6",
            badgeBg: "#7c3aed",
            description: hasOfficialGuardian
                ? "Official LeetCode Guardian Badge (Top ~5% global contest ranking)"
                : "Estimated Guardian rating tier (>= 2150 contest rating)",
            nextTierName: null,
            pointsToNextTier: 0,
            progressPercent: 100,
            isOfficialBadge: hasOfficialGuardian,
        };
    }

    if (hasOfficialKnight || r >= 1850) {
        const next = 2150;
        const min = 1850;
        return {
            name: "Knight",
            minRating: min,
            maxRating: 2149,
            color: "#06b6d4",
            badgeBg: "#0891b2",
            description: hasOfficialKnight
                ? "Official LeetCode Knight Badge (Top ~25% global contest ranking)"
                : "Estimated Knight rating tier (1850–2149 contest rating)",
            nextTierName: "Guardian",
            pointsToNextTier: Math.max(0, next - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - min) / (next - min)) * 100))),
            isOfficialBadge: hasOfficialKnight,
        };
    }

    const next = 1850;
    return {
        name: "Unranked",
        minRating: 0,
        maxRating: 1849,
        color: "#94a3b8",
        badgeBg: "#64748b",
        description: "Contest participant below Knight threshold (< 1850 contest rating)",
        nextTierName: "Knight",
        pointsToNextTier: Math.max(0, next - r),
        progressPercent: Math.min(100, Math.max(0, Math.round((r / next) * 100))),
        isOfficialBadge: false,
    };
}

// ============================================================================
// 3. CODECHEF
// ============================================================================
// Stars:
// 1★: < 1400
// 2★: 1400–1599
// 3★: 1600–1799
// 4★: 1800–1999
// 5★: 2000–2199
// 6★: 2200–2499
// 7★: 2500+
//
// Divisions:
// Division 4: < 1400
// Division 3: 1400–1599
// Division 2: 1600–1999
// Division 1: 2000+
// ============================================================================

export function getCodeChefDivision(rating: number): { division: string; name: string } {
    const r = Math.max(0, Math.round(rating));
    if (r < 1400) return { division: "Div 4", name: "Division 4" };
    if (r < 1600) return { division: "Div 3", name: "Division 3" };
    if (r < 2000) return { division: "Div 2", name: "Division 2" };
    return { division: "Div 1", name: "Division 1" };
}

export function getCodeChefTier(rating: number): PlatformTierDefinition {
    const r = Math.max(0, Math.round(rating));
    const div = getCodeChefDivision(r);

    if (r < 1400) {
        return {
            name: "1★",
            minRating: 0,
            maxRating: 1399,
            color: "#94a3b8",
            description: `1-Star division tier on CodeChef (< 1400, ${div.name})`,
            nextTierName: "2★",
            pointsToNextTier: Math.max(0, 1400 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round((r / 1400) * 100))),
        };
    }
    if (r < 1600) {
        return {
            name: "2★",
            minRating: 1400,
            maxRating: 1599,
            color: "#22c55e",
            description: `2-Star division tier on CodeChef (1400–1599, ${div.name})`,
            nextTierName: "3★",
            pointsToNextTier: Math.max(0, 1600 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 1400) / 200) * 100))),
        };
    }
    if (r < 1800) {
        return {
            name: "3★",
            minRating: 1600,
            maxRating: 1799,
            color: "#3b82f6",
            description: `3-Star division tier on CodeChef (1600–1799, ${div.name})`,
            nextTierName: "4★",
            pointsToNextTier: Math.max(0, 1800 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 1600) / 200) * 100))),
        };
    }
    if (r < 2000) {
        return {
            name: "4★",
            minRating: 1800,
            maxRating: 1999,
            color: "#a855f7",
            description: `4-Star division tier on CodeChef (1800–1999, ${div.name})`,
            nextTierName: "5★",
            pointsToNextTier: Math.max(0, 2000 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 1800) / 200) * 100))),
        };
    }
    if (r < 2200) {
        return {
            name: "5★",
            minRating: 2000,
            maxRating: 2199,
            color: "#eab308",
            description: `5-Star division tier on CodeChef (2000–2199, ${div.name})`,
            nextTierName: "6★",
            pointsToNextTier: Math.max(0, 2200 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 2000) / 200) * 100))),
        };
    }
    if (r < 2500) {
        return {
            name: "6★",
            minRating: 2200,
            maxRating: 2499,
            color: "#f97316",
            description: `6-Star master tier on CodeChef (2200–2499, ${div.name})`,
            nextTierName: "7★",
            pointsToNextTier: Math.max(0, 2500 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 2200) / 300) * 100))),
        };
    }
    return {
        name: "7★",
        minRating: 2500,
        maxRating: null,
        color: "#ef4444",
        description: `7-Star grandmaster tier on CodeChef (2500+, ${div.name})`,
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
    };
}

// ============================================================================
// 4. ATCODER
// ============================================================================
// Gray: Below 400 (#808080)
// Brown: 400–799 (#804000)
// Green: 800–1199 (#008000)
// Cyan: 1200–1599 (#00c0c0)
// Blue: 1600–1999 (#0000ff)
// Yellow: 2000–2399 (#c0c000)
// Orange: 2400–2799 (#ff8000)
// Red: 2800+ (#ff0000)
// ============================================================================

export function getAtCoderTier(rating: number): PlatformTierDefinition {
    const r = Math.max(0, Math.round(rating));

    if (r < 400) {
        return {
            name: "Gray",
            minRating: 0,
            maxRating: 399,
            color: "#808080",
            description: "Gray rating tier on AtCoder (< 400)",
            nextTierName: "Brown",
            pointsToNextTier: Math.max(0, 400 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round((r / 400) * 100))),
        };
    }
    if (r < 800) {
        return {
            name: "Brown",
            minRating: 400,
            maxRating: 799,
            color: "#804000",
            description: "Brown rating tier on AtCoder (400–799)",
            nextTierName: "Green",
            pointsToNextTier: Math.max(0, 800 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 400) / 400) * 100))),
        };
    }
    if (r < 1200) {
        return {
            name: "Green",
            minRating: 800,
            maxRating: 1199,
            color: "#008000",
            description: "Green rating tier on AtCoder (800–1199)",
            nextTierName: "Cyan",
            pointsToNextTier: Math.max(0, 1200 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 800) / 400) * 100))),
        };
    }
    if (r < 1600) {
        return {
            name: "Cyan",
            minRating: 1200,
            maxRating: 1599,
            color: "#00c0c0",
            description: "Cyan rating tier on AtCoder (1200–1599)",
            nextTierName: "Blue",
            pointsToNextTier: Math.max(0, 1600 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 1200) / 400) * 100))),
        };
    }
    if (r < 2000) {
        return {
            name: "Blue",
            minRating: 1600,
            maxRating: 1999,
            color: "#0000ff",
            description: "Blue rating tier on AtCoder (1600–1999)",
            nextTierName: "Yellow",
            pointsToNextTier: Math.max(0, 2000 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 1600) / 400) * 100))),
        };
    }
    if (r < 2400) {
        return {
            name: "Yellow",
            minRating: 2000,
            maxRating: 2399,
            color: "#c0c000",
            description: "Yellow master tier on AtCoder (2000–2399)",
            nextTierName: "Orange",
            pointsToNextTier: Math.max(0, 2400 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 2000) / 400) * 100))),
        };
    }
    if (r < 2800) {
        return {
            name: "Orange",
            minRating: 2400,
            maxRating: 2799,
            color: "#ff8000",
            description: "Orange grandmaster tier on AtCoder (2400–2799)",
            nextTierName: "Red",
            pointsToNextTier: Math.max(0, 2800 - r),
            progressPercent: Math.min(100, Math.max(0, Math.round(((r - 2400) / 400) * 100))),
        };
    }
    return {
        name: "Red",
        minRating: 2800,
        maxRating: null,
        color: "#ff0000",
        description: "Red legendary tier on AtCoder (2800+)",
        nextTierName: null,
        pointsToNextTier: 0,
        progressPercent: 100,
    };
}

// ============================================================================
// 5. HACKERRANK PROBLEM SOLVING & DOMAIN STARS
// ============================================================================
// 1 star: 30 points
// 2 stars: 100 points
// 3 stars: 200 points
// 4 stars: 475 points
// 5 stars: 850 points
// 6 stars: 2200 points
// ============================================================================

export const HACKERRANK_PROBLEM_SOLVING_THRESHOLDS = [
    { stars: 1, points: 30 },
    { stars: 2, points: 100 },
    { stars: 3, points: 200 },
    { stars: 4, points: 475 },
    { stars: 5, points: 850 },
    { stars: 6, points: 2200 },
] as const;

export function getHackerRankProblemSolvingStars(points: number): {
    stars: number;
    nextStarPoints: number | null;
    pointsToNext: number;
    progressPercent: number;
} {
    const pts = Math.max(0, Math.round(points));
    if (pts < 30) {
        return {
            stars: 0,
            nextStarPoints: 30,
            pointsToNext: 30 - pts,
            progressPercent: Math.round((pts / 30) * 100),
        };
    }
    if (pts < 100) {
        return {
            stars: 1,
            nextStarPoints: 100,
            pointsToNext: 100 - pts,
            progressPercent: Math.round(((pts - 30) / 70) * 100),
        };
    }
    if (pts < 200) {
        return {
            stars: 2,
            nextStarPoints: 200,
            pointsToNext: 200 - pts,
            progressPercent: Math.round(((pts - 100) / 100) * 100),
        };
    }
    if (pts < 475) {
        return {
            stars: 3,
            nextStarPoints: 475,
            pointsToNext: 475 - pts,
            progressPercent: Math.round(((pts - 200) / 275) * 100),
        };
    }
    if (pts < 850) {
        return {
            stars: 4,
            nextStarPoints: 850,
            pointsToNext: 850 - pts,
            progressPercent: Math.round(((pts - 475) / 375) * 100),
        };
    }
    if (pts < 2200) {
        return {
            stars: 5,
            nextStarPoints: 2200,
            pointsToNext: 2200 - pts,
            progressPercent: Math.round(((pts - 850) / 1350) * 100),
        };
    }
    return {
        stars: 6,
        nextStarPoints: null,
        pointsToNext: 0,
        progressPercent: 100,
    };
}

// ============================================================================
// 6. NORMALIZED DIFFICULTY CLASSIFICATION
// ============================================================================

export type NormalizedDifficulty = "Easy" | "Medium" | "Hard" | "Unknown";

export function classifyCodeforcesDifficulty(problemRating: number | null | undefined): NormalizedDifficulty {
    if (problemRating === null || problemRating === undefined || isNaN(problemRating)) {
        return "Unknown";
    }
    if (problemRating <= 1200) return "Easy";
    if (problemRating <= 1800) return "Medium";
    return "Hard";
}

export function classifyAtCoderDifficulty(difficultyValue: number | null | undefined): NormalizedDifficulty {
    if (difficultyValue === null || difficultyValue === undefined || isNaN(difficultyValue)) {
        return "Unknown";
    }
    if (difficultyValue < 800) return "Easy"; // Gray & Brown
    if (difficultyValue < 1600) return "Medium"; // Green & Cyan
    return "Hard"; // Blue and above
}

export function classifyGeeksforGeeksDifficulty(level: string): NormalizedDifficulty {
    const l = (level || "").trim().toLowerCase();
    if (l === "school" || l === "basic" || l === "easy") return "Easy";
    if (l === "medium") return "Medium";
    if (l === "hard") return "Hard";
    return "Unknown";
}

export const classifyCodeforcesRating = classifyCodeforcesDifficulty;

export function normalizeGeeksforGeeksDifficulty(counts: {
    school?: number;
    basic?: number;
    easy?: number;
    medium?: number;
    hard?: number;
}): { easy: number; medium: number; hard: number; total: number } {
    const easy = (counts.school || 0) + (counts.basic || 0) + (counts.easy || 0);
    const medium = counts.medium || 0;
    const hard = counts.hard || 0;
    return {
        easy,
        medium,
        hard,
        total: easy + medium + hard,
    };
}

export function isContestRatingPlatform(portalId: string): boolean {
    const p = (portalId || "").toLowerCase().trim();
    return p === "codeforces" || p === "leetcode" || p === "codechef" || p === "atcoder" || p === "topcoder";
}
