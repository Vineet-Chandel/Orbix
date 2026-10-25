import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Layers,
    ShieldCheck,
    CheckCircle2,
    ArrowRight,
    Search,
    ExternalLink,
    Terminal,
    Database,
    Zap,
    RefreshCw,
    Code2,
    GitPullRequest,
    Award,
    BookOpen,
} from "lucide-react";
import { getPortalIcon } from "../../../utils/portalIcons";

export interface PlatformDetail {
    id: string;
    name: string;
    category: "Competitive Programming" | "Coding Practice" | "Open Source" | "Data Science" | "Technical Writing";
    brandColor: string;
    badgeColor: string;
    ingestionType: "GraphQL API" | "REST API v4" | "DOM Scraper" | "Kenkoooo API" | "RSS / Atom Feed";
    syncSLA: string;
    rateLimit: string;
    targetBaseline: string;
    pillars: string[];
    pillarAllocation: string;
    whatItProvides: string[];
    schemaSample: Record<string, any>;
    antiGamingRule: string;
    officialUrl: string;
}

export const PLATFORMS_DETAILED_DATA: PlatformDetail[] = [
    {
        id: "leetcode",
        name: "LeetCode",
        category: "Competitive Programming",
        brandColor: "#FFA116",
        badgeColor: "bg-[#FFE566]",
        ingestionType: "GraphQL API",
        syncSLA: "Every 4 Hours",
        rateLimit: "100 req/min (Burst 150)",
        targetBaseline: "Rating Normalized [1,500 - 2,600 Elo]",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)", "P5: Consistency (10%)"],
        pillarAllocation: "P1 (35%), P2 (20%), P5 (10%)",
        whatItProvides: [
            "Exact count of accepted problem submissions segregated by Easy, Medium, and Hard tiers.",
            "Live Contest Elo rating, peak contest rating, global percentile, and attended rated contest count.",
            "Submission Calendar UNIX timestamp series used to calculate active days, streaks, and frequency.",
            "Official monthly and skill challenge badges with SVG asset links and award timestamps.",
            "Topic breakdown index (Dynamic Programming, Graph, Tree, Array, String, Math).",
            "Recent 20 accepted solutions with title slug, runtime percentiles, and memory consumption."
        ],
        schemaSample: {
            submitStatsGlobal: { easy: 85, medium: 140, hard: 32, total: 257 },
            contestRating: 1864.5,
            globalRanking: 14210,
            attendedContests: 28,
            currentStreak: 28,
            badgesCount: 14
        },
        antiGamingRule: "Easy problem multiplier capped at 1x; diminishing returns concave curve prevents inflated score from brute-forcing simple 2-line problems.",
        officialUrl: "https://leetcode.com"
    },
    {
        id: "codeforces",
        name: "Codeforces",
        category: "Competitive Programming",
        brandColor: "#1F8ACB",
        badgeColor: "bg-[#b6e3f4]",
        ingestionType: "REST API v4",
        syncSLA: "Every 4 Hours",
        rateLimit: "5 req/sec (Official API Key)",
        targetBaseline: "Rating Normalized [1,000 - 2,400 Elo]",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)", "P5: Consistency (10%)"],
        pillarAllocation: "P1 (35%), P2 (20%), P5 (10%)",
        whatItProvides: [
            "Real-time Elo rating, max historical rating, and authoritative rank title (Candidate Master, Master, Grandmaster).",
            "Chronological contest log: Contest ID, rank achieved, rating delta (+/-), and performance percentile.",
            "Complete submission stream filtered for verdict == 'OK', mapping problem tags to difficulty (800 to 3500 Elo).",
            "Organization, university affiliation, and community contribution score.",
            "Virtual vs Official contest participation discriminator."
        ],
        schemaSample: {
            rating: 1942,
            maxRating: 2011,
            rank: "candidate master",
            contestsAttended: 34,
            solvedProblemCount: 420,
            contribution: 18
        },
        antiGamingRule: "Only rated rounds (Div 1, Div 2, Div 3, Educational) contribute to P2 contest rating; unrated mashups are excluded.",
        officialUrl: "https://codeforces.com"
    },
    {
        id: "codechef",
        name: "CodeChef",
        category: "Competitive Programming",
        brandColor: "#5B4638",
        badgeColor: "bg-[#fef08a]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 6 Hours",
        rateLimit: "30 req/min (Headless Pool)",
        targetBaseline: "Rating Normalized [1,400 - 2,300 Elo]",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)"],
        pillarAllocation: "P1 (35%), P2 (20%)",
        whatItProvides: [
            "Official Star rating tier (1★ through 7★ Grandmaster).",
            "Current global contest rating, peak historical rating, and active Division classification (Div 1 to Div 4).",
            "Global rank and Country-specific leaderboard placement.",
            "Count of fully solved practice challenges versus live contest solves.",
            "Rated contest attendance history (Starters, Cook-Off, Lunchtime)."
        ],
        schemaSample: {
            stars: "4★",
            rating: 1845,
            peakRating: 1910,
            globalRank: 3412,
            countryRank: 2180,
            fullySolved: 289
        },
        antiGamingRule: "Short unrated practice solves carry lower difficulty weighting; official Starters and Long Challenges weighted higher.",
        officialUrl: "https://www.codechef.com"
    },
    {
        id: "atcoder",
        name: "AtCoder",
        category: "Competitive Programming",
        brandColor: "#222222",
        badgeColor: "bg-[#e5e7eb]",
        ingestionType: "Kenkoooo API",
        syncSLA: "Every 4 Hours",
        rateLimit: "60 req/min",
        targetBaseline: "Rating Normalized [400 - 2,000 Elo]",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)", "P5: Consistency (10%)"],
        pillarAllocation: "P1 (35%), P2 (20%), P5 (10%)",
        whatItProvides: [
            "Official Kyu/Dan color rank tier (Gray, Brown, Green, Cyan, Blue, Yellow, Orange, Red).",
            "Authoritative contest rating and highest historical contest score.",
            "Total rated contest attendance across ABC (Beginner), ARC (Regular), and AGC (Grand) contests.",
            "Unique Accepted (AC) problem solve count verified through Kenkoooo open database.",
            "Longest streak of consecutive days with at least one verified AC."
        ],
        schemaSample: {
            rating: 1480,
            highestRating: 1520,
            rankColor: "cyan",
            competitionsCount: 22,
            acceptedCount: 310,
            longestStreak: 41
        },
        antiGamingRule: "Kenkoooo unique problem ID deduplication prevents double-counting re-submissions of identical tasks.",
        officialUrl: "https://atcoder.jp"
    },
    {
        id: "topcoder",
        name: "TopCoder",
        category: "Competitive Programming",
        brandColor: "#29A7DF",
        badgeColor: "bg-[#b6e3f4]",
        ingestionType: "REST API v4",
        syncSLA: "Every 12 Hours",
        rateLimit: "30 req/min",
        targetBaseline: "Rating Normalized [1,200 - 2,200 Elo]",
        pillars: ["P2: Contest Rating (20%)"],
        pillarAllocation: "P2 (20%)",
        whatItProvides: [
            "Algorithm Single Round Match (SRM) rating, maximum rating, and division tier (Div 1 / Div 2).",
            "Total number of SRM events attended and volatility factor.",
            "Challenge Phase point extractions and automated system test survival rate.",
            "Global competitive programming percentile amongst veteran competitive programmers."
        ],
        schemaSample: {
            rating: 1620,
            peakRating: 1740,
            division: 1,
            srmCount: 19,
            volatility: 285
        },
        antiGamingRule: "SRM rating normalization requires minimum 3 attended rated matches to activate P2 weight.",
        officialUrl: "https://www.topcoder.com"
    },
    {
        id: "spoj",
        name: "SPOJ",
        category: "Competitive Programming",
        brandColor: "#1B6AC9",
        badgeColor: "bg-[#dbeafe]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 12 Hours",
        rateLimit: "20 req/min",
        targetBaseline: "Problem Count Aggregator [Pillar 1]",
        pillars: ["P1: Problem Solving (35%)"],
        pillarAllocation: "P1 (35%)",
        whatItProvides: [
            "Total Classical algorithmic problems solved.",
            "World rank standing and calculated total platform points.",
            "Challenge problem solves and partial credit task completions."
        ],
        schemaSample: {
            classicalSolved: 142,
            worldRank: 8410,
            points: 124.5
        },
        antiGamingRule: "SPOJ classical problems mapped with 2x intermediate multiplier; duplicate handles cross-checked against email domain.",
        officialUrl: "https://www.spoj.com"
    },
    {
        id: "geeksforgeeks",
        name: "GeeksforGeeks",
        category: "Coding Practice",
        brandColor: "#2F8D46",
        badgeColor: "bg-[#a2ff86]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 6 Hours",
        rateLimit: "30 req/min",
        targetBaseline: "Practice Difficulty Breakdown [Pillar 1]",
        pillars: ["P1: Problem Solving (35%)", "P5: Consistency (10%)", "P6: Technical Writing (5%)"],
        pillarAllocation: "P1 (35%), P5 (10%), P6 (5%)",
        whatItProvides: [
            "Total verified solved problems categorized into School, Basic, Easy, Medium, and Hard buckets.",
            "Cumulative GeeksforGeeks Coding Score and verified College / Institution rank.",
            "Monthly practice streak count and Problem of the Day (POTD) milestone medals.",
            "Community authored technical articles and tutorial contributions on the GFG portal."
        ],
        schemaSample: {
            codingScore: 1240,
            institutionRank: 12,
            solvedStats: { school: 15, basic: 40, easy: 80, medium: 95, hard: 18 },
            potdStreak: 21,
            articlesPublished: 2
        },
        antiGamingRule: "School and Basic difficulties weighted at 0.5x to preserve scoring integrity for advanced college leaderboards.",
        officialUrl: "https://www.geeksforgeeks.org"
    },
    {
        id: "hackerrank",
        name: "HackerRank",
        category: "Coding Practice",
        brandColor: "#00EA64",
        badgeColor: "bg-[#86efac]",
        ingestionType: "REST API v4",
        syncSLA: "Every 6 Hours",
        rateLimit: "40 req/min",
        targetBaseline: "Badges & Skills Matrix",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)"],
        pillarAllocation: "P1 (35%), P2 (20%)",
        whatItProvides: [
            "Domain Skill Badges with Star ratings (1★ to 6★ in Problem Solving, Algorithms, Data Structures, Python, C++, SQL).",
            "Total verified solved challenge tasks across practice tracks.",
            "Official HackerRank Skill Certifications with credential verification URLs.",
            "HackerRank Contest participations and global competitive percentile."
        ],
        schemaSample: {
            problemSolvingStars: 5,
            badges: ["Problem Solving (Gold 5★)", "Python (5★)", "SQL (4★)"],
            certificationsCount: 3,
            totalSolved: 185
        },
        antiGamingRule: "Tutorial tracks and intro 1-star challenges carry reduced weight; only 4-star+ domain badges yield high P1 bonus.",
        officialUrl: "https://www.hackerrank.com"
    },
    {
        id: "code360",
        name: "Code360 by Coding Ninjas",
        category: "Coding Practice",
        brandColor: "#FF5722",
        badgeColor: "bg-[#fed7aa]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 6 Hours",
        rateLimit: "30 req/min",
        targetBaseline: "Practice Difficulty Breakdown",
        pillars: ["P1: Problem Solving (35%)", "P5: Consistency (10%)"],
        pillarAllocation: "P1 (35%), P5 (10%)",
        whatItProvides: [
            "Total solved challenges across Easy, Moderate, and Ninja Hard difficulties.",
            "Total Ninja Experience Points (EXP) and platform percentile rank.",
            "Daily streak counter and curated guided career path completions."
        ],
        schemaSample: {
            totalSolved: 165,
            ninjaPoints: 8450,
            easy: 50,
            moderate: 85,
            hard: 30,
            currentStreak: 19
        },
        antiGamingRule: "Normalized to standard P1 difficulty curve matching LeetCode and GFG.",
        officialUrl: "https://www.naukri.com/code360"
    },
    {
        id: "interviewbit",
        name: "InterviewBit / Scaler",
        category: "Coding Practice",
        brandColor: "#0D8BD9",
        badgeColor: "bg-[#bae6fd]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 6 Hours",
        rateLimit: "30 req/min",
        targetBaseline: "Interview Track Problems",
        pillars: ["P1: Problem Solving (35%)", "P5: Consistency (10%)"],
        pillarAllocation: "P1 (35%), P5 (10%)",
        whatItProvides: [
            "Total platform Score and global rank standing.",
            "Solved challenge count distributed across core software engineering interview topics.",
            "Daily streak counter and accuracy percentage."
        ],
        schemaSample: {
            score: 18450,
            globalRank: 4120,
            streakDays: 14,
            completedTopics: ["Arrays", "Binary Search", "Trees", "Dynamic Programming"]
        },
        antiGamingRule: "Strict URL normalization prevents duplicate profile creation across Scaler and InterviewBit domains.",
        officialUrl: "https://www.interviewbit.com"
    },
    {
        id: "cses",
        name: "CSES Problem Set",
        category: "Coding Practice",
        brandColor: "#214478",
        badgeColor: "bg-[#c7d2fe]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 12 Hours",
        rateLimit: "20 req/min",
        targetBaseline: "300 Standard Algorithmic Tasks",
        pillars: ["P1: Problem Solving (35%)"],
        pillarAllocation: "P1 (35%)",
        whatItProvides: [
            "Task completion verification against the 300 authoritative CSES algorithmic benchmark problems.",
            "Section completion counts: Dynamic Programming, Graph Algorithms, Range Queries, Tree Algorithms, Mathematics, String Algorithms, Geometry.",
            "Fastest execution and minimal code size verification."
        ],
        schemaSample: {
            tasksCompleted: 148,
            totalAvailable: 300,
            categoriesMastered: ["Introductory", "Sorting and Searching", "Dynamic Programming", "Graph Algorithms"]
        },
        antiGamingRule: "All CSES tasks carry High/Medium problem solving multiplier due to absence of trivial test cases.",
        officialUrl: "https://cses.fi"
    },
    {
        id: "hackerearth",
        name: "HackerEarth",
        category: "Coding Practice",
        brandColor: "#2C3454",
        badgeColor: "bg-[#e2e8f0]",
        ingestionType: "DOM Scraper",
        syncSLA: "Every 12 Hours",
        rateLimit: "20 req/min",
        targetBaseline: "Hackathons & Contest Ratings",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)"],
        pillarAllocation: "P1 (35%), P2 (20%)",
        whatItProvides: [
            "Solved practice coding challenges and domain skills.",
            "Contest rating and hackathon project submission history.",
            "Global competitive percentile."
        ],
        schemaSample: {
            problemsSolved: 110,
            contestRating: 1610,
            hackathonsAttended: 3
        },
        antiGamingRule: "Contest ratings evaluated alongside live rated participation count.",
        officialUrl: "https://www.hackerearth.com"
    },
    {
        id: "github",
        name: "GitHub",
        category: "Open Source",
        brandColor: "#24292E",
        badgeColor: "bg-[#d1d5db]",
        ingestionType: "GraphQL API",
        syncSLA: "Every 2 Hours",
        rateLimit: "5,000 req/hr (OAuth App Token)",
        targetBaseline: "External Merged PRs & Peer Quality",
        pillars: ["P3: Open Source (20%)", "P4: Repository Quality (10%)", "P5: Consistency (10%)"],
        pillarAllocation: "P3 (20%), P4 (10%), P5 (10%)",
        whatItProvides: [
            "Merged Pull Requests into third-party / external repositories (Pillar 3 core metric).",
            "Public peer code reviews submitted (Approved, Changes Requested, Commented).",
            "Issues opened and successfully resolved in external organizations.",
            "Original public repositories created (excluding forks), stargazer totals, and fork counts.",
            "365-day Contribution Calendar: Total commits, active coding days, and current streak.",
            "Byte-level programming language breakdown across all public repositories."
        ],
        schemaSample: {
            mergedExternalPRs: 14,
            externalReposContributed: 5,
            publicCodeReviews: 8,
            publicRepos: 12,
            stargazersCount: 68,
            annualCommits: 840,
            activeDays: 195,
            primaryLanguages: ["TypeScript", "Rust", "Go", "Python"]
        },
        antiGamingRule: "Self-merged PRs into empty personal repos are strictly discarded by the AST filter; only contributions to repositories with established activity qualify.",
        officialUrl: "https://github.com"
    },
    {
        id: "kaggle",
        name: "Kaggle",
        category: "Data Science",
        brandColor: "#20BEFF",
        badgeColor: "bg-[#bae6fd]",
        ingestionType: "REST API v4",
        syncSLA: "Every 6 Hours",
        rateLimit: "30 req/min",
        targetBaseline: "Competition Tiers & Medals",
        pillars: ["P1: Problem Solving (35%)", "P2: Contest Rating (20%)", "P4: Repository Quality (10%)"],
        pillarAllocation: "P1 (35%), P2 (20%), P4 (10%)",
        whatItProvides: [
            "Official Competition tier (Grandmaster, Master, Expert, Contributor).",
            "Medal tallies: Gold, Silver, and Bronze medals in Competitions, Datasets, and Notebooks.",
            "Global Competition rating points and leaderboard percentile.",
            "Public Jupyter / Python notebooks with community upvotes and citations."
        ],
        schemaSample: {
            tier: "Master",
            competitionsRank: 240,
            goldMedals: 2,
            silverMedals: 5,
            bronzeMedals: 8,
            notebooksUpvotes: 340
        },
        antiGamingRule: "Dataset upvote rings are filtered; only competition medals and verified notebooks contribute to Orbix Score.",
        officialUrl: "https://www.kaggle.com"
    },
    {
        id: "medium",
        name: "Medium",
        category: "Technical Writing",
        brandColor: "#12100E",
        badgeColor: "bg-[#e5e7eb]",
        ingestionType: "RSS / Atom Feed",
        syncSLA: "Every 6 Hours",
        rateLimit: "60 req/min",
        targetBaseline: "Published Articles & Reader Engagement",
        pillars: ["P6: Technical Writing (5%)"],
        pillarAllocation: "P6 (5%)",
        whatItProvides: [
            "Total published software engineering articles and architectural explainers.",
            "Article metadata: Title, publication date, primary topics (Algorithms, Web3, Distributed Systems).",
            "Total reader claps, community likes, and follower indicators."
        ],
        schemaSample: {
            articlesCount: 5,
            latestArticle: "Architecting a Diminishing Returns Scoring Engine with Redis",
            estimatedReads: 1400,
            claps: 320
        },
        antiGamingRule: "Each verified article awards up to 12.5 subscore points; readership scaled logarithmically to prevent bot view manipulation.",
        officialUrl: "https://medium.com"
    },
    {
        id: "substack",
        name: "Substack",
        category: "Technical Writing",
        brandColor: "#FF6719",
        badgeColor: "bg-[#fed7aa]",
        ingestionType: "RSS / Atom Feed",
        syncSLA: "Every 6 Hours",
        rateLimit: "60 req/min",
        targetBaseline: "Newsletter Posts & Publications",
        pillars: ["P6: Technical Writing (5%)"],
        pillarAllocation: "P6 (5%)",
        whatItProvides: [
            "Published engineering newsletter dispatches and long-form essays.",
            "Active publication lifespan and cadence consistency (weekly/monthly).",
            "Subscriber tier signal and reader engagement."
        ],
        schemaSample: {
            postsCount: 6,
            publicationName: "Distributed Systems Digest",
            cadence: "Bi-weekly",
            activeMonths: 8
        },
        antiGamingRule: "Only engineering, programming, and technical newsletters receive P6 technical writing credit.",
        officialUrl: "https://substack.com"
    }
];

export const PlatformRegistryDocumentary: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [selectedPlatformId, setSelectedPlatformId] = useState<string>("leetcode");

    const categories = [
        "All",
        "Competitive Programming",
        "Coding Practice",
        "Open Source",
        "Data Science",
        "Technical Writing",
    ];

    const filteredPlatforms = useMemo(() => {
        return PLATFORMS_DETAILED_DATA.filter((p) => {
            const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
            const matchesSearch =
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.whatItProvides.some((item) => item.toLowerCase().includes(searchQuery.toLowerCase())) ||
                p.pillars.some((item) => item.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [searchQuery, selectedCategory]);

    const activePlatform = useMemo(() => {
        return PLATFORMS_DETAILED_DATA.find((p) => p.id === selectedPlatformId) || PLATFORMS_DETAILED_DATA[0];
    }, [selectedPlatformId]);

    return (
        <article className="space-y-12">
            {/* ========================================================================= */}
            {/* HERO CARD MATCHING SCREENSHOT EXACTLY                                     */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black/15 pb-4">
                    <div className="flex items-center gap-2.5">
                        <span className="px-3.5 py-1 rounded-full text-xs font-black bg-[#a2ff86] border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                            Verified Ecosystem
                        </span>
                        <span className="text-xs font-mono font-bold text-neutral-500">
                            9 min read
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-[#FAF6EE] text-black border-2 border-black">
                            16 Portals Indexed
                        </span>
                        <Link
                            to="/leaderboard"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black border-2 border-black hover:bg-black hover:text-[#a2ff86] transition-colors shadow-[1.5px_1.5px_0px_#000]"
                        >
                            <span>Live Rankings</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-black leading-tight">
                        Supported Platform Registry (16 Genuine Platforms)
                    </h1>
                    <p className="text-base sm:text-lg font-bold text-neutral-700">
                        Capability matrix across Competitive Programming, Open Source & Writing
                    </p>
                </div>

                {/* Specified Image Banner */}
                <div className="rounded-2xl border-2 border-black overflow-hidden bg-black shadow-[4px_4px_0px_#000] w-full">
                    <img
                        src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792945186/f729d8bb-9852-499f-94b6-4df0c75ffac2.png"
                        alt="Supported Platform Registry - Algorithm and Integration Specification"
                        className="w-full h-auto block"
                    />
                </div>

                <p className="text-sm sm:text-base text-neutral-800 leading-relaxed font-medium">
                    Exhaustive documentation of the 16 genuine developer portals natively indexed by Orbix, including metric extractors, contest rating trackers, and contribution synchronizers.
                </p>

                {/* Key Topics Covered Box matching the exact UI */}
                <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-3 shadow-[3px_3px_0px_#000]">
                    <h3 className="font-black text-black text-base uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
                        <span>Key Topics Covered:</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs sm:text-sm font-bold text-neutral-800">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>Platforms Integration and Architectural Guarantees</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>LeetCode Integration and Architectural Guarantees</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>Codeforces Integration and Architectural Guarantees</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>GitHub Integration and Architectural Guarantees</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>AtCoder, CodeChef & TopCoder Rating Synchronizers</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>Kaggle Machine Learning Competitions & Medals Extraction</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>Medium & Substack Technical Writing Syndicators</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                            <span>Anti-Spoofing, Normalization & 4-Hour Redis L2 Caching</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* ARCHITECTURAL INGESTION PIPELINE FLOW                                     */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b-2 border-black/15">
                    <div className="p-2.5 rounded-xl bg-black text-[#a2ff86] border-2 border-black">
                        <Terminal className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-black">
                            Deterministic Ingestion Pipeline Architecture
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            Zero-trust multi-platform data harvesting, normalization, and scoring
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 flex flex-col justify-between">
                        <div>
                            <span className="px-2 py-0.5 rounded bg-black text-white font-mono font-black text-[10px]">STAGE 1</span>
                            <h4 className="font-black text-black text-sm mt-1">Handle Verification</h4>
                            <p className="text-neutral-700 font-medium mt-1">
                                Strict domain parsing removes invalid paths (e.g. <code>/explore</code>, <code>/jobs</code>). Normalizes usernames across canonical URL patterns.
                            </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700">Status: Validated</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 flex flex-col justify-between">
                        <div>
                            <span className="px-2 py-0.5 rounded bg-black text-white font-mono font-black text-[10px]">STAGE 2</span>
                            <h4 className="font-black text-black text-sm mt-1">Async Multi-Worker</h4>
                            <p className="text-neutral-700 font-medium mt-1">
                                Parallel rate-limited workers dispatch to GraphQL (LeetCode, GitHub), REST (Codeforces, HackerRank), and Headless Scrapers (CodeChef, GFG).
                            </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-700">Workers: 16 Adapters</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 flex flex-col justify-between">
                        <div>
                            <span className="px-2 py-0.5 rounded bg-black text-white font-mono font-black text-[10px]">STAGE 3</span>
                            <h4 className="font-black text-black text-sm mt-1">Anti-Spoofing Filter</h4>
                            <p className="text-neutral-700 font-medium mt-1">
                                Discards self-merged PRs in empty repos. Clamps spam problem counts and validates contest attendance authenticity against official rounds.
                            </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-purple-700">Integrity: Zero-Trust</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 flex flex-col justify-between">
                        <div>
                            <span className="px-2 py-0.5 rounded bg-black text-white font-mono font-black text-[10px]">STAGE 4</span>
                            <h4 className="font-black text-black text-sm mt-1">Diminishing Engine</h4>
                            <p className="text-neutral-700 font-medium mt-1">
                                Maps raw metrics into 6 canonical pillars (P1–P6) using smooth concave saturation curves to prevent single-metric dominance.
                            </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-blue-700">Max: 10,000 Pts</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#a2ff86]/30 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 flex flex-col justify-between">
                        <div>
                            <span className="px-2 py-0.5 rounded bg-black text-[#a2ff86] font-mono font-black text-[10px]">STAGE 5</span>
                            <h4 className="font-black text-black text-sm mt-1">Redis L2 Cache</h4>
                            <p className="text-neutral-800 font-medium mt-1">
                                Persisted to Redis with 4-Hour TTL. Sub-50ms query latency on Global & College Leaderboards with 30s debounced manual resync.
                            </p>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-black font-black">TTL: 14,400s</span>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* INTERACTIVE 16-PLATFORM DIRECTORY & INSPECTOR                             */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2.5">
                            <Layers className="w-7 h-7 stroke-[2.5]" />
                            <span>16 Genuine Platforms Registry</span>
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            Select any platform to inspect its services provided, extracted metrics, and scoring integration
                        </p>
                    </div>

                    {/* Search bar */}
                    <div className="relative w-full md:w-72">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter by name, pillar, or metric..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black shadow-[2px_2px_0px_#000]"
                        />
                    </div>
                </div>

                {/* Category Pills Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all cursor-pointer whitespace-nowrap shadow-[2px_2px_0px_#000] ${
                                selectedCategory === cat
                                    ? "bg-black text-[#a2ff86] translate-x-[1px] translate-y-[1px] shadow-none"
                                    : "bg-white text-black hover:bg-neutral-100"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* 16-Platform Grid Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {filteredPlatforms.map((p) => {
                        const isSelected = p.id === activePlatform.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => setSelectedPlatformId(p.id)}
                                className={`p-3 rounded-2xl border-2 border-black text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                                    isSelected
                                        ? "bg-[#FFE566] shadow-[4px_4px_0px_#000] -translate-y-1"
                                        : "bg-white hover:bg-[#FAF6EE] shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <div className="p-2 rounded-xl bg-white border border-black shadow-[1px_1px_0px_#000]">
                                    {getPortalIcon(p.id, "w-6 h-6")}
                                </div>
                                <span className="font-black text-xs text-black truncate w-full">
                                    {p.name}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Selected Platform Detailed Deep-Dive Card */}
                <div className="rounded-3xl border-2 sm:border-3 border-black bg-[#FAF6EE] p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                {getPortalIcon(activePlatform.id, "w-8 h-8")}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-2xl font-black text-black">{activePlatform.name}</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border-2 border-black ${activePlatform.badgeColor}`}>
                                        {activePlatform.category}
                                    </span>
                                </div>
                                <p className="text-xs font-mono font-bold text-neutral-600 mt-0.5">
                                    {activePlatform.ingestionType} • Sync: {activePlatform.syncSLA} • {activePlatform.rateLimit}
                                </p>
                            </div>
                        </div>

                        <a
                            href={activePlatform.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]"
                        >
                            <span>Visit Portal</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* What services / data it is providing to Orbix */}
                        <div className="lg:col-span-7 space-y-4">
                            <div>
                                <h4 className="font-black text-sm uppercase tracking-wider text-black flex items-center gap-2 mb-2">
                                    <Database className="w-4 h-4 text-black" />
                                    <span>Services & Extracted Data Provided to Orbix:</span>
                                </h4>
                                <ul className="space-y-2">
                                    {activePlatform.whatItProvides.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-neutral-800">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-4 rounded-2xl bg-white border-2 border-black space-y-1.5">
                                <h5 className="font-black text-xs uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                                    <span>Anti-Spoofing & Fair Play Policy:</span>
                                </h5>
                                <p className="text-xs text-neutral-700 font-medium">
                                    {activePlatform.antiGamingRule}
                                </p>
                            </div>
                        </div>

                        {/* Pillar contribution & JSON Schema snapshot */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <h5 className="font-black text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-black" />
                                    <span>Scoring Pillar Allocations:</span>
                                </h5>
                                <div className="space-y-1.5">
                                    {activePlatform.pillars.map((pill, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-xs font-mono font-bold p-1.5 rounded bg-neutral-100 border border-neutral-300">
                                            <span>{pill}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-2 border-t border-neutral-200 text-[11px] font-bold text-neutral-600">
                                    Normalizer: <span className="font-mono text-black">{activePlatform.targetBaseline}</span>
                                </div>
                            </div>

                            {/* Schema Sample */}
                            <div className="p-4 rounded-2xl bg-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono font-black uppercase text-neutral-400">
                                        Normalized Data Payload
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-[#FFE566]">JSON Schema</span>
                                </div>
                                <pre className="font-mono text-[11px] leading-snug overflow-x-auto p-2 bg-neutral-900 rounded-lg text-emerald-400">
                                    {JSON.stringify(activePlatform.schemaSample, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* FULL 16-PLATFORM MASTER SPECIFICATION TABLE                               */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black/15">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-black">
                            Exhaustive Capability & Ingestion Matrix
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            Comparative technical breakdown of all 16 genuine platforms natively indexed by Orbix
                        </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-[#a2ff86] border-2 border-black self-start sm:self-auto">
                        100% Deterministic
                    </span>
                </div>

                <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-black text-[#a2ff86] uppercase font-black tracking-wider text-[11px] border-b-2 border-black">
                                    <th className="p-3.5 pl-4">Platform</th>
                                    <th className="p-3.5">Category</th>
                                    <th className="p-3.5">Protocol</th>
                                    <th className="p-3.5">Primary Metrics Extracted</th>
                                    <th className="p-3.5">Pillar Integration</th>
                                    <th className="p-3.5 pr-4">Sync SLA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10 font-medium text-neutral-800">
                                {PLATFORMS_DETAILED_DATA.map((p, idx) => (
                                    <tr
                                        key={p.id}
                                        onClick={() => setSelectedPlatformId(p.id)}
                                        className={`transition-colors cursor-pointer ${
                                            p.id === activePlatform.id ? "bg-[#FFE566]/30 font-bold" : idx % 2 === 0 ? "bg-white hover:bg-[#FAF6EE]" : "bg-[#FAF6EE]/50 hover:bg-[#FAF6EE]"
                                        }`}
                                    >
                                        <td className="p-3 pl-4 font-black text-black flex items-center gap-2">
                                            {getPortalIcon(p.id, "w-4 h-4 shrink-0")}
                                            <span>{p.name}</span>
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-md bg-white border border-black/20 font-bold text-[10px]">
                                                {p.category}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-[11px] text-neutral-600">
                                            {p.ingestionType}
                                        </td>
                                        <td className="p-3 text-neutral-700 max-w-xs truncate" title={p.whatItProvides.join(" • ")}>
                                            {p.whatItProvides[0]}
                                        </td>
                                        <td className="p-3 font-mono font-bold text-black text-[11px]">
                                            {p.pillarAllocation}
                                        </td>
                                        <td className="p-3 pr-4 font-mono font-bold text-neutral-600 text-[11px]">
                                            {p.syncSLA}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* THE 6 SCORING PILLARS MAPPING OVERVIEW                                    */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="pb-3 border-b-2 border-black/15">
                    <h2 className="text-xl sm:text-2xl font-black text-black">
                        How the 16 Platforms Feed the 6 Canonical Pillars
                    </h2>
                    <p className="text-xs sm:text-sm font-bold text-neutral-600">
                        Orbix Score (0 to 10,000 Points) maps each platform to its authoritative domain
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-[#a2ff86]/30 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Code2 className="w-5 h-5 text-black" />
                                <h4 className="font-black text-black text-base">P1: Problem Solving</h4>
                            </div>
                            <span className="font-mono font-black text-xs">35% / 3,500 pts</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-700">
                            Concave diminishing returns curve values multi-platform solves across Easy (1x), Medium (3x), Hard (6x).
                        </p>
                        <div className="text-[11px] font-bold text-black pt-1 border-t border-black/20">
                            Key Feeds: LeetCode, Codeforces, CodeChef, GFG, HackerRank, AtCoder, CSES, Code360, InterviewBit, SPOJ
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#ffd5dc] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-black" />
                                <h4 className="font-black text-black text-base">P2: Contest Rating</h4>
                            </div>
                            <span className="font-mono font-black text-xs">20% / 2,000 pts</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-700">
                            Normalized Elo ratings against official tier benchmarks: 75% primary peak rating + 25% secondary + attendance bonus.
                        </p>
                        <div className="text-[11px] font-bold text-black pt-1 border-t border-black/20">
                            Key Feeds: Codeforces, LeetCode, CodeChef, AtCoder, TopCoder, HackerRank, Kaggle
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#b6e3f4] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <GitPullRequest className="w-5 h-5 text-black" />
                                <h4 className="font-black text-black text-base">P3: Open Source</h4>
                            </div>
                            <span className="font-mono font-black text-xs">20% / 2,000 pts</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-700">
                            Values substantive merged external PRs (10 pts), external repos (12 pts), and public code reviews (6 pts).
                        </p>
                        <div className="text-[11px] font-bold text-black pt-1 border-t border-black/20">
                            Key Feeds: GitHub (GraphQL v4 AST filtered)
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#fed7aa] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-black" />
                                <h4 className="font-black text-black text-base">P4: Project Quality</h4>
                            </div>
                            <span className="font-mono font-black text-xs">10% / 1,000 pts</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-700">
                            Logarithmic star multiplier + original public repository diversity capped at 15 to eliminate spam.
                        </p>
                        <div className="text-[11px] font-bold text-black pt-1 border-t border-black/20">
                            Key Feeds: GitHub, Kaggle (Notebooks & Datasets)
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#fef08a] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <RefreshCw className="w-5 h-5 text-black" />
                                <h4 className="font-black text-black text-base">P5: Consistency</h4>
                            </div>
                            <span className="font-mono font-black text-xs">10% / 1,000 pts</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-700">
                            Daily habit streaks and multi-platform 365-day active day counts deduplicated across coding platforms.
                        </p>
                        <div className="text-[11px] font-bold text-black pt-1 border-t border-black/20">
                            Key Feeds: GitHub, LeetCode, Codeforces, Code360, GFG, InterviewBit
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#e9d5ff] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-black" />
                                <h4 className="font-black text-black text-base">P6: Technical Writing</h4>
                            </div>
                            <span className="font-mono font-black text-xs">5% / 500 pts</span>
                        </div>
                        <p className="text-xs font-medium text-neutral-700">
                            Verified technical articles (12.5 pts each) and logarithmic readership / follower scale.
                        </p>
                        <div className="text-[11px] font-bold text-black pt-1 border-t border-black/20">
                            Key Feeds: Medium, Substack, GeeksforGeeks Articles
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* CALL TO ACTION                                                            */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-black text-white p-8 sm:p-12 border-3 border-black shadow-[8px_8px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-[#FFE566] text-black">
                        Universal Developer Identity
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Connect Your Profiles to Compute Your Orbix Score
                    </h3>
                    <p className="text-neutral-400 text-xs sm:text-sm max-w-xl">
                        Add your LeetCode, Codeforces, GitHub, and writing profiles to unlock your multi-platform rank on College and Global leaderboards.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Link
                        to="/leaderboard"
                        className="px-5 py-3 rounded-2xl bg-[#a2ff86] hover:bg-[#86ef6c] text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0px_#fff] transition-all cursor-pointer"
                    >
                        View Leaderboards
                    </Link>
                    <Link
                        to="/docs/orbix-score-algorithm"
                        className="px-5 py-3 rounded-2xl bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0px_#fff] transition-all cursor-pointer"
                    >
                        Algorithm Spec
                    </Link>
                </div>
            </section>
        </article>
    );
};

export default PlatformRegistryDocumentary;
