export interface LeetCodeRankDefinition {
    id: string;
    name: string;
    minRating: number;
    maxRating: number;
    ratingRangeLabel: string;
    bgColor: string; // Exact hex color sampled from official LeetCode ranks and ratings reference
    textColor: string;
    description: string;
}

/**
 * Exact LeetCode Contest Rating Badges & Colors
 * Reference: media_1792674147242_2b041bef.png
 *
 * 1. Unranked: Below 1850 -> #8B877C
 * 2. Knight: 1850 to 2149 -> #308F5B
 * 3. Guardian: 2150 and above -> #7A4AD8
 */
export const LEETCODE_RANKS: readonly LeetCodeRankDefinition[] = [
    {
        id: "unranked",
        name: "Unranked",
        minRating: 0,
        maxRating: 1849,
        ratingRangeLabel: "Below 1850",
        bgColor: "#8B877C",
        textColor: "#FFFFFF",
        description: "Official LeetCode contest rating below 1850.",
    },
    {
        id: "knight",
        name: "Knight",
        minRating: 1850,
        maxRating: 2149,
        ratingRangeLabel: "1850 to 2149",
        bgColor: "#308F5B",
        textColor: "#FFFFFF",
        description: "Awarded to top ~5% of contest participants on LeetCode.",
    },
    {
        id: "guardian",
        name: "Guardian",
        minRating: 2150,
        maxRating: 9999,
        ratingRangeLabel: "2150 and above",
        bgColor: "#7A4AD8",
        textColor: "#FFFFFF",
        description: "Top 1% elite competitive tier on LeetCode.",
    },
];

/**
 * Returns the exact LeetCode rank definition by contest rating number
 */
export function getLeetCodeRankByRating(rating: number | null | undefined): LeetCodeRankDefinition | null {
    if (typeof rating !== "number" || isNaN(rating) || rating <= 0) return null;
    if (rating >= 2150) return LEETCODE_RANKS[2]; // Guardian
    if (rating >= 1850) return LEETCODE_RANKS[1]; // Knight
    return LEETCODE_RANKS[0]; // Unranked
}

/**
 * Returns the exact LeetCode rank definition by tier name / string
 */
export function getLeetCodeRankByName(nameOrTier: string | null | undefined): LeetCodeRankDefinition | null {
    if (!nameOrTier) return null;
    const clean = nameOrTier.toLowerCase().trim();
    if (clean.includes("guardian")) return LEETCODE_RANKS[2];
    if (clean.includes("knight")) return LEETCODE_RANKS[1];
    if (clean.includes("unranked")) return LEETCODE_RANKS[0];
    return null;
}

/**
 * Resolves LeetCode rank from either tier string or rating number
 */
export function resolveLeetCodeRank(
    tier?: string | null,
    rating?: number | null
): LeetCodeRankDefinition | null {
    if (tier) {
        const byName = getLeetCodeRankByName(tier);
        if (byName) return byName;
    }
    if (typeof rating === "number") {
        return getLeetCodeRankByRating(rating);
    }
    return null;
}
