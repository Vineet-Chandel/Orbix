export interface CodeforcesRankDefinition {
    id: string;
    name: string;
    minRating: number;
    maxRating: number;
    ratingRangeLabel: string;
    bgColor: string; // Exact hex color sampled from official Codeforces rating tags reference
    textColor: string;
    description: string;
}

/**
 * Exact Codeforces Contest Rating Badges & Colors
 * Reference: media_1792674047957_11c419ab.png
 *
 * 1. Newbie: Below 1200 -> #808080
 * 2. Pupil: 1200 to 1399 -> #008001
 * 3. Specialist: 1400 to 1599 -> #04A89F
 * 4. Expert: 1600 to 1899 -> #1500FF
 * 5. Candidate Master: 1900 to 2099 -> #DC2625
 * 6. Master: 2100 to 2299 -> #FF8C00
 * 7. International Master: 2300 to 2399 -> #FF8C00
 * 8. Grandmaster: 2400 to 2599 -> #FF0200
 * 9. International Grandmaster: 2600 to 2999 -> #FF0200
 * 10. Legendary Grandmaster: 3000 and above -> #AA0000
 */
export const CODEFORCES_RANKS: readonly CodeforcesRankDefinition[] = [
    {
        id: "newbie",
        name: "Newbie",
        minRating: 0,
        maxRating: 1199,
        ratingRangeLabel: "Below 1200",
        bgColor: "#808080",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings below 1200.",
    },
    {
        id: "pupil",
        name: "Pupil",
        minRating: 1200,
        maxRating: 1399,
        ratingRangeLabel: "1200 to 1399",
        bgColor: "#008001",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 1200 to 1399.",
    },
    {
        id: "specialist",
        name: "Specialist",
        minRating: 1400,
        maxRating: 1599,
        ratingRangeLabel: "1400 to 1599",
        bgColor: "#04A89F",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 1400 to 1599.",
    },
    {
        id: "expert",
        name: "Expert",
        minRating: 1600,
        maxRating: 1899,
        ratingRangeLabel: "1600 to 1899",
        bgColor: "#1500FF",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 1600 to 1899.",
    },
    {
        id: "candidate-master",
        name: "Candidate Master",
        minRating: 1900,
        maxRating: 2099,
        ratingRangeLabel: "1900 to 2099",
        bgColor: "#DC2625",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 1900 to 2099.",
    },
    {
        id: "master",
        name: "Master",
        minRating: 2100,
        maxRating: 2299,
        ratingRangeLabel: "2100 to 2299",
        bgColor: "#FF8C00",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 2100 to 2299.",
    },
    {
        id: "international-master",
        name: "International Master",
        minRating: 2300,
        maxRating: 2399,
        ratingRangeLabel: "2300 to 2399",
        bgColor: "#FF8C00",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 2300 to 2399.",
    },
    {
        id: "grandmaster",
        name: "Grandmaster",
        minRating: 2400,
        maxRating: 2599,
        ratingRangeLabel: "2400 to 2599",
        bgColor: "#FF0200",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 2400 to 2599.",
    },
    {
        id: "international-grandmaster",
        name: "International Grandmaster",
        minRating: 2600,
        maxRating: 2999,
        ratingRangeLabel: "2600 to 2999",
        bgColor: "#FF0200",
        textColor: "#FFFFFF",
        description: "Official Codeforces division rank for ratings 2600 to 2999.",
    },
    {
        id: "legendary-grandmaster",
        name: "Legendary Grandmaster",
        minRating: 3000,
        maxRating: 9999,
        ratingRangeLabel: "3000 and above",
        bgColor: "#AA0000",
        textColor: "#FFFFFF",
        description: "Top pinnacle Codeforces division rank for ratings 3000 and above.",
    },
];

/**
 * Returns the exact Codeforces rank definition by contest rating number
 */
export function getCodeforcesRankByRating(rating: number | null | undefined): CodeforcesRankDefinition | null {
    if (typeof rating !== "number" || isNaN(rating) || rating < 0) return null;
    for (let i = CODEFORCES_RANKS.length - 1; i >= 0; i--) {
        if (rating >= CODEFORCES_RANKS[i].minRating) {
            return CODEFORCES_RANKS[i];
        }
    }
    return CODEFORCES_RANKS[0];
}

/**
 * Returns the exact Codeforces rank definition by tier name / string
 */
export function getCodeforcesRankByName(nameOrTier: string | null | undefined): CodeforcesRankDefinition | null {
    if (!nameOrTier) return null;
    const clean = nameOrTier.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Check specific/compound names first to prevent partial overlaps
    if (clean.includes("legendary")) return CODEFORCES_RANKS[9];
    if (clean.includes("internationalgrandmaster")) return CODEFORCES_RANKS[8];
    if (clean.includes("grandmaster")) return CODEFORCES_RANKS[7];
    if (clean.includes("internationalmaster")) return CODEFORCES_RANKS[6];
    if (clean.includes("candidatemaster") || clean.includes("candidate")) return CODEFORCES_RANKS[4];
    if (clean.includes("master")) return CODEFORCES_RANKS[5];
    if (clean.includes("expert")) return CODEFORCES_RANKS[3];
    if (clean.includes("specialist")) return CODEFORCES_RANKS[2];
    if (clean.includes("pupil")) return CODEFORCES_RANKS[1];
    if (clean.includes("newbie")) return CODEFORCES_RANKS[0];

    return null;
}

/**
 * Resolves Codeforces rank from either tier string or rating number
 */
export function resolveCodeforcesRank(
    tier?: string | null,
    rating?: number | null
): CodeforcesRankDefinition | null {
    if (tier) {
        const byName = getCodeforcesRankByName(tier);
        if (byName) return byName;
    }
    if (typeof rating === "number") {
        return getCodeforcesRankByRating(rating);
    }
    return null;
}
