export interface CodeChefRankDefinition {
    id: string;
    name: string;
    stars: number;
    minRating: number;
    maxRating: number;
    ratingRangeLabel: string;
    division: string;
    bgColor: string; // Exact hex color sampled from official CodeChef ranks and ratings reference
    textColor: string;
    description: string;
}

/**
 * Exact CodeChef Contest Rating Badges & Colors
 * Reference: media_1792674198510_6b880b5f.png
 *
 * 1. 1★: Below 1400 (Div. 4) -> #666666, Text: #FFFFFF
 * 2. 2★: 1400 to 1599 (Div. 3) -> #1D7D22, Text: #FFFFFF
 * 3. 3★: 1600 to 1799 (Div. 2) -> #3466CC, Text: #FFFFFF
 * 4. 4★: 1800 to 1999 (Div. 2) -> #674273, Text: #FFFFFF
 * 5. 5★: 2000 to 2199 (Div. 1) -> #E0A800, Text: #14161D
 * 6. 6★: 2200 to 2499 (Div. 1) -> #FF7F00, Text: #FFFFFF
 * 7. 7★: 2500 and above (Div. 1) -> #D0021C, Text: #FFFFFF
 */
export const CODECHEF_RANKS: readonly CodeChefRankDefinition[] = [
    {
        id: "1-star",
        name: "1★",
        stars: 1,
        minRating: 0,
        maxRating: 1399,
        ratingRangeLabel: "Below 1400",
        division: "Div. 4",
        bgColor: "#666666",
        textColor: "#FFFFFF",
        description: "Official CodeChef 1-Star division rank (Div. 4).",
    },
    {
        id: "2-star",
        name: "2★",
        stars: 2,
        minRating: 1400,
        maxRating: 1599,
        ratingRangeLabel: "1400 to 1599",
        division: "Div. 3",
        bgColor: "#1D7D22",
        textColor: "#FFFFFF",
        description: "Official CodeChef 2-Star division rank (Div. 3).",
    },
    {
        id: "3-star",
        name: "3★",
        stars: 3,
        minRating: 1600,
        maxRating: 1799,
        ratingRangeLabel: "1600 to 1799",
        division: "Div. 2",
        bgColor: "#3466CC",
        textColor: "#FFFFFF",
        description: "Official CodeChef 3-Star division rank (Div. 2).",
    },
    {
        id: "4-star",
        name: "4★",
        stars: 4,
        minRating: 1800,
        maxRating: 1999,
        ratingRangeLabel: "1800 to 1999",
        division: "Div. 2",
        bgColor: "#674273",
        textColor: "#FFFFFF",
        description: "Official CodeChef 4-Star division rank (Div. 2).",
    },
    {
        id: "5-star",
        name: "5★",
        stars: 5,
        minRating: 2000,
        maxRating: 2199,
        ratingRangeLabel: "2000 to 2199",
        division: "Div. 1",
        bgColor: "#E0A800",
        textColor: "#14161D",
        description: "Official CodeChef 5-Star division rank (Div. 1).",
    },
    {
        id: "6-star",
        name: "6★",
        stars: 6,
        minRating: 2200,
        maxRating: 2499,
        ratingRangeLabel: "2200 to 2499",
        division: "Div. 1",
        bgColor: "#FF7F00",
        textColor: "#FFFFFF",
        description: "Official CodeChef 6-Star division rank (Div. 1).",
    },
    {
        id: "7-star",
        name: "7★",
        stars: 7,
        minRating: 2500,
        maxRating: 9999,
        ratingRangeLabel: "2500 and above",
        division: "Div. 1",
        bgColor: "#D0021C",
        textColor: "#FFFFFF",
        description: "Official CodeChef 7-Star highest pinnacle rank (Div. 1).",
    },
];

export const CODECHEF_DIVISIONS = [
    { division: "Div. 4", range: "below 1400." },
    { division: "Div. 3", range: "1400 to 1599." },
    { division: "Div. 2", range: "1600 to 1999." },
    { division: "Div. 1", range: "2000 and above." },
];

/**
 * Returns the exact CodeChef rank definition by contest rating number
 */
export function getCodeChefRankByRating(rating: number | null | undefined): CodeChefRankDefinition | null {
    if (typeof rating !== "number" || isNaN(rating) || rating <= 0) return null;
    for (let i = CODECHEF_RANKS.length - 1; i >= 0; i--) {
        if (rating >= CODECHEF_RANKS[i].minRating) {
            return CODECHEF_RANKS[i];
        }
    }
    return CODECHEF_RANKS[0];
}

/**
 * Returns the exact CodeChef rank definition by tier name / string (e.g. "6★", "6 Star", "6-star")
 */
export function getCodeChefRankByName(nameOrTier: string | null | undefined): CodeChefRankDefinition | null {
    if (!nameOrTier) return null;
    const clean = nameOrTier.toLowerCase().trim();

    if (clean.includes("7") || clean.includes("7★")) return CODECHEF_RANKS[6];
    if (clean.includes("6") || clean.includes("6★")) return CODECHEF_RANKS[5];
    if (clean.includes("5") || clean.includes("5★")) return CODECHEF_RANKS[4];
    if (clean.includes("4") || clean.includes("4★")) return CODECHEF_RANKS[3];
    if (clean.includes("3") || clean.includes("3★")) return CODECHEF_RANKS[2];
    if (clean.includes("2") || clean.includes("2★")) return CODECHEF_RANKS[1];
    if (clean.includes("1") || clean.includes("1★")) return CODECHEF_RANKS[0];

    return null;
}

/**
 * Resolves CodeChef rank from either tier string or rating number
 */
export function resolveCodeChefRank(
    tier?: string | null,
    rating?: number | null
): CodeChefRankDefinition | null {
    if (tier) {
        const byName = getCodeChefRankByName(tier);
        if (byName) return byName;
    }
    if (typeof rating === "number") {
        return getCodeChefRankByRating(rating);
    }
    return null;
}
