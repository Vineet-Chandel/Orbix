export interface AtCoderRankDefinition {
    id: string;
    name: string;
    minRating: number;
    maxRating: number;
    ratingRangeLabel: string;
    bgColor: string; // Exact hex color sampled from official AtCoder ranks and ratings reference
    textColor: string;
    description: string;
}

/**
 * Exact AtCoder Contest Rating Badges & Colors
 * Reference: media_1792674213424_db0d8841.png
 *
 * 1. Gray: Below 400 -> #808080, Text: #FFFFFF
 * 2. Brown: 400 to 799 -> #804000, Text: #FFFFFF
 * 3. Green: 800 to 1199 -> #008001, Text: #FFFFFF
 * 4. Cyan: 1200 to 1599 -> #01A0A0, Text: #FFFFFF
 * 5. Blue: 1600 to 1999 -> #1500FF, Text: #FFFFFF
 * 6. Yellow: 2000 to 2399 -> #B9A000, Text: #FFFFFF
 * 7. Orange: 2400 to 2799 -> #FF8001, Text: #FFFFFF
 * 8. Red: 2800 and above -> #FF0200, Text: #FFFFFF
 */
export const ATCODER_RANKS: readonly AtCoderRankDefinition[] = [
    {
        id: "gray",
        name: "Gray",
        minRating: 0,
        maxRating: 399,
        ratingRangeLabel: "Below 400",
        bgColor: "#808080",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating below 400.",
    },
    {
        id: "brown",
        name: "Brown",
        minRating: 400,
        maxRating: 799,
        ratingRangeLabel: "400 to 799",
        bgColor: "#804000",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating 400 to 799.",
    },
    {
        id: "green",
        name: "Green",
        minRating: 800,
        maxRating: 1199,
        ratingRangeLabel: "800 to 1199",
        bgColor: "#008001",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating 800 to 1199.",
    },
    {
        id: "cyan",
        name: "Cyan",
        minRating: 1200,
        maxRating: 1599,
        ratingRangeLabel: "1200 to 1599",
        bgColor: "#01A0A0",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating 1200 to 1599.",
    },
    {
        id: "blue",
        name: "Blue",
        minRating: 1600,
        maxRating: 1999,
        ratingRangeLabel: "1600 to 1999",
        bgColor: "#1500FF",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating 1600 to 1999.",
    },
    {
        id: "yellow",
        name: "Yellow",
        minRating: 2000,
        maxRating: 2399,
        ratingRangeLabel: "2000 to 2399",
        bgColor: "#B9A000",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating 2000 to 2399.",
    },
    {
        id: "orange",
        name: "Orange",
        minRating: 2400,
        maxRating: 2799,
        ratingRangeLabel: "2400 to 2799",
        bgColor: "#FF8001",
        textColor: "#FFFFFF",
        description: "Official AtCoder contest rating 2400 to 2799.",
    },
    {
        id: "red",
        name: "Red",
        minRating: 2800,
        maxRating: 9999,
        ratingRangeLabel: "2800 and above",
        bgColor: "#FF0200",
        textColor: "#FFFFFF",
        description: "Official AtCoder highest pinnacle rating 2800 and above.",
    },
];

/**
 * Returns the exact AtCoder rank definition by contest rating number
 */
export function getAtCoderRankByRating(rating: number | null | undefined): AtCoderRankDefinition | null {
    if (typeof rating !== "number" || isNaN(rating) || rating < 0) return null;
    for (let i = ATCODER_RANKS.length - 1; i >= 0; i--) {
        if (rating >= ATCODER_RANKS[i].minRating) {
            return ATCODER_RANKS[i];
        }
    }
    return ATCODER_RANKS[0];
}

/**
 * Returns the exact AtCoder rank definition by tier name / string (e.g. "Cyan", "Blue", "1-Kyu", etc.)
 */
export function getAtCoderRankByName(nameOrTier: string | null | undefined): AtCoderRankDefinition | null {
    if (!nameOrTier) return null;
    const clean = nameOrTier.toLowerCase().trim();

    if (clean.includes("red")) return ATCODER_RANKS[7];
    if (clean.includes("orange")) return ATCODER_RANKS[6];
    if (clean.includes("yellow")) return ATCODER_RANKS[5];
    if (clean.includes("blue") || clean.includes("1-kyu") || clean.includes("1kyu")) return ATCODER_RANKS[4];
    if (clean.includes("cyan") || clean.includes("2-kyu") || clean.includes("2kyu")) return ATCODER_RANKS[3];
    if (clean.includes("green") || clean.includes("3-kyu") || clean.includes("3kyu")) return ATCODER_RANKS[2];
    if (clean.includes("brown") || clean.includes("4-kyu") || clean.includes("4kyu")) return ATCODER_RANKS[1];
    if (clean.includes("gray") || clean.includes("grey") || clean.includes("5-kyu")) return ATCODER_RANKS[0];

    return null;
}

/**
 * Resolves AtCoder rank from either tier string or rating number
 */
export function resolveAtCoderRank(
    tier?: string | null,
    rating?: number | null
): AtCoderRankDefinition | null {
    if (tier) {
        const byName = getAtCoderRankByName(tier);
        if (byName) return byName;
    }
    if (typeof rating === "number") {
        return getAtCoderRankByRating(rating);
    }
    return null;
}
