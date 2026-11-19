// Backend/src/Routes/platform/platformRoutes.ts
import express, { type Request, type Response } from "express";

export const platformRouter = express.Router();

export interface ReleaseHistoryItem {
    version: string;
    releaseName: string;
    releaseDate: string;
    channel: "production" | "beta" | "lts";
    highlights: string[];
    breakingChanges: string[];
}

const OFFICIAL_RELEASE_HISTORY: ReleaseHistoryItem[] = [
    {
        version: "2.4.0",
        releaseName: "Titan Edition",
        releaseDate: "2026-10-31",
        channel: "production",
        highlights: [
            "Production-Grade Settings Architecture: Help Center, Privacy Center, and Account Status Governance.",
            "Database-governed account standing and non-repudiable audit history.",
            "Multi-platform synchronization across 16 natively indexed developer portals.",
            "Collegiate student organization governance and verified chapter verification protocol.",
            "Deterministic 7-dimension resume intelligence and ATS fact provenance.",
        ],
        breakingChanges: [],
    },
    {
        version: "2.3.0",
        releaseName: "Orbit Edition",
        releaseDate: "2026-10-15",
        channel: "production",
        highlights: [
            "Card Studio: Real-time 3D interactive developer cards with SVG export.",
            "College Leaderboards: Inter-university rankings with 72-hour integrity cooldown.",
            "Two-Factor Authentication (2FA) with cryptographically hashed step-up challenges.",
        ],
        breakingChanges: [],
    },
    {
        version: "2.0.0",
        releaseName: "Genesis Edition",
        releaseDate: "2026-09-01",
        channel: "lts",
        highlights: [
            "Calibrated 0 to 10,000 Orbix Score mathematical engine.",
            "Unified developer identity aggregating competitive coding and open-source contributions.",
        ],
        breakingChanges: [],
    },
];

/**
 * GET /api/platform/about
 * Returns dynamic, authentic platform and open-source project metadata
 */
platformRouter.get("/about", (_req: Request, res: Response) => {
    const gitCommitSha = process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "main-2026.10";
    const environment = process.env.NODE_ENV || "production";

    return res.status(200).json({
        success: true,
        metadata: {
            name: "Orbix Platform",
            tagline: "The Unified Competitive Developer Portfolio & Engineering Ecosystem",
            version: "2.4.0",
            releaseChannel: "production",
            releaseName: "Titan Edition",
            buildDate: "2026-10-31T00:00:00.000Z",
            gitCommitSha,
            environment: environment === "production" ? "Production (Cloud)" : "Development",
            repositoryUrl: "https://github.com/Vineet-Chandel/Orbix",
            license: "Apache-2.0",
            platformStatus: "Operational",
            supportedPortalsCount: 16,
            features: [
                {
                    key: "scoring_engine",
                    title: "Deterministic Scoring Engine",
                    description: "A calibrated 0 to 10,000 score across algorithm counts, contest ratings, streaks, and open source.",
                    status: "active",
                },
                {
                    key: "connected_portals",
                    title: "16 Connected Developer Portals",
                    description: "Native synchronization across LeetCode, Codeforces, GitHub, CodeChef, AtCoder, HackerRank, etc.",
                    status: "active",
                },
                {
                    key: "collegiate_network",
                    title: "Collegiate Leaderboard Network",
                    description: "Inter-university rankings and verified governance for campus chapters and student hackathons.",
                    status: "active",
                },
                {
                    key: "resume_intelligence",
                    title: "Resume Intelligence & Fact Provenance",
                    description: "Multi-stage AST parsing, deterministic 7-dimension ATS scoring, and explicit skill verification.",
                    status: "active",
                },
            ],
            releaseHistory: OFFICIAL_RELEASE_HISTORY,
            officialLinks: {
                documentation: "/docs",
                scoringAlgorithm: "/docs/orbix-score-algorithm",
                platformRegistry: "/docs/supported-platform-registry",
                privacyControls: "/docs/public-vs-private-profile",
                clubProtocol: "/docs/club-verification-protocol",
                eventsCalendar: "/events",
                leaderboard: "/leaderboard",
                engineeringBlog: "/blogs",
                github: "https://github.com/Vineet-Chandel/Orbix",
            },
        },
    });
});
