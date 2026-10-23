export interface PlatformRatingInfo {
    rating: number;
    tier?: string;
    color?: string;
    badge?: string;
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
