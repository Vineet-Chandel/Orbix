export interface PlatformRatingInfo {
    rating: number;
    tier?: string;
    color?: string;
    badge?: string;
}

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    college: string | null;
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
    lastUpdated: string;
}

export interface LeaderboardResponse {
    success: boolean;
    metadata: LeaderboardMetadata;
    podium: LeaderboardEntry[];
    entries: LeaderboardEntry[];
    currentUser?: LeaderboardEntry | null;
    cached?: boolean;
}
