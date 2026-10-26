import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Cpu,
    ShieldCheck,
    Award,
    Zap,
    Code2,
    BookOpen,
    GitPullRequest,
    Flame,
    CheckCircle2,
    ArrowRight,
    Sliders,
    GraduationCap,
    Globe2,
    AlertCircle,
    Sparkles,
    TrendingUp
} from "lucide-react";

export const AlgorithmDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Interactive Simulator State
    // -------------------------------------------------------------------------
    const [easyProblems, setEasyProblems] = useState<number>(85);
    const [medProblems, setMedProblems] = useState<number>(140);
    const [hardProblems, setHardProblems] = useState<number>(32);
    const [contestRating, setContestRating] = useState<number>(1860); // LeetCode/Codeforces composite
    const [contestsCount, setContestsCount] = useState<number>(24);
    const [mergedPRs, setMergedPRs] = useState<number>(12);
    const [externalRepos, setExternalRepos] = useState<number>(4);
    const [publicRepos, setPublicRepos] = useState<number>(14);
    const [repoStars, setRepoStars] = useState<number>(48);
    const [activeDays, setActiveDays] = useState<number>(180);
    const [currentStreak, setCurrentStreak] = useState<number>(28);
    const [publishedArticles, setPublishedArticles] = useState<number>(4);
    const [readersCount, setReadersCount] = useState<number>(1200);

    // -------------------------------------------------------------------------
    // Live Deterministic Mathematical Model (Mirrors Orbix Authoritative Score Specification v2.0.0)
    // -------------------------------------------------------------------------
    const simResults = useMemo(() => {
        // P1: Problem Solving (35% / 3,500 pts)
        // Multipliers: Easy (1x), Med (3x), Hard (6x)
        // Diminishing returns curve: 100 * (1 - e^(-raw / 1400))
        const rawP1 = easyProblems * 1 + medProblems * 3 + hardProblems * 6;
        const subP1 = Math.min(100, Math.round(100 * (1 - Math.exp(-rawP1 / 1400))));
        const ptsP1 = Math.round((subP1 / 100) * 3500);

        // P2: Contest Performance (20% / 2,000 pts)
        // Rating normalized baseline [1000 - 2400] + experience bonus
        const normalizedRating = Math.max(0, Math.min(100, ((contestRating - 1000) / (2400 - 1000)) * 100));
        const expBonus = Math.min(15, contestsCount * 0.75);
        const subP2 = Math.min(100, Math.round(normalizedRating * 0.85 + expBonus));
        const ptsP2 = Math.round((subP2 / 100) * 2000);

        // P3: Open Source (20% / 2,000 pts)
        // Merged PRs (10 pts), External Repos (12 pts), first milestone bonus (+5)
        const rawP3 = mergedPRs * 10 + externalRepos * 12 + (mergedPRs > 0 ? 5 : 0);
        const subP3 = Math.min(100, Math.round(100 * (1 - Math.exp(-rawP3 / 220))));
        const ptsP3 = Math.round((subP3 / 100) * 2000);

        // P4: Repository Quality (10% / 1,000 pts)
        // Repos capped at 15 to prevent spam, log star multiplier
        const boundedRepos = Math.min(15, publicRepos);
        const starLog = repoStars > 0 ? Math.log10(repoStars + 1) * 25 : 0;
        const subP4 = Math.min(100, Math.round(Math.min(50, boundedRepos * 3.5) + Math.min(50, starLog)));
        const ptsP4 = Math.round((subP4 / 100) * 1000);

        // P5: Consistency & Streaks (10% / 1,000 pts)
        // Active days (up to 50) + habit streak (up to 50)
        const daysSub = Math.min(50, Math.round((activeDays / 365) * 50));
        const streakSub = Math.min(50, Math.round(100 * (1 - Math.exp(-currentStreak / 35)) * 0.5));
        const subP5 = Math.min(100, daysSub + streakSub);
        const ptsP5 = Math.round((subP5 / 100) * 1000);

        // P6: Technical Writing (5% / 500 pts)
        // Articles (up to 50) + readership log
        const articleSub = Math.min(50, publishedArticles * 12.5);
        const readerSub = readersCount > 0 ? Math.min(50, Math.log10(readersCount + 1) * 15) : 0;
        const subP6 = Math.min(100, Math.round(articleSub + readerSub));
        const ptsP6 = Math.round((subP6 / 100) * 500);

        const totalScore = ptsP1 + ptsP2 + ptsP3 + ptsP4 + ptsP5 + ptsP6;

        return {
            p1: { raw: rawP1, sub: subP1, pts: ptsP1 },
            p2: { rating: contestRating, sub: subP2, pts: ptsP2 },
            p3: { raw: rawP3, sub: subP3, pts: ptsP3 },
            p4: { sub: subP4, pts: ptsP4 },
            p5: { sub: subP5, pts: ptsP5 },
            p6: { sub: subP6, pts: ptsP6 },
            total: totalScore,
        };
    }, [
        easyProblems,
        medProblems,
        hardProblems,
        contestRating,
        contestsCount,
        mergedPRs,
        externalRepos,
        publicRepos,
        repoStars,
        activeDays,
        currentStreak,
        publishedArticles,
        readersCount,
    ]);

    const pillars = [
        {
            title: "Problem Solving",
            weight: "35%",
            maxPts: "3,500 pts",
            icon: <Code2 className="w-5 h-5 text-black" />,
            color: "bg-[#a2ff86]",
            description: "Multi-platform problem solving across Easy, Medium, Hard, and Unknown difficulties with logarithmic diminishing returns.",
            formula: "Subscore = 100 × (1 - e^(-rawPts / 1400))",
            details: [
                "Difficulty Multipliers: Easy (1x), Medium (3x), Hard (6x), General/Unknown (2x)",
                "Smooth concave saturation curve (scale = 1,400 raw pts) prevents runaway score inflation from simple problem spam",
                "Supported across all 12 CP & coding practice platforms",
            ],
            metrics: ["Total Solved", "Easy/Medium/Hard Breakdown", "Acceptance Rate"],
        },
        {
            title: "Contest Performance",
            weight: "20%",
            maxPts: "2,000 pts",
            icon: <Award className="w-5 h-5 text-black" />,
            color: "bg-[#ffd5dc]",
            description: "Competitive contest rating percentiles against official platform tiers and rated contest participation experience.",
            formula: "Weighted Composite = 75% Primary Rating + 25% Secondary Rating + Exp Bonus",
            details: [
                "Rating Baselines: Codeforces (1,000-2,400), LeetCode (1,500-2,600), CodeChef (1,400-2,300), AtCoder (400-2,000), TopCoder (1,200-2,200)",
                "Multi-platform composite: Best normalized rating carries 75%, secondary rating carries 25%",
                "Experience bonus: Rated contest attendance grants cumulative participation points",
            ],
            metrics: ["Current & Peak Contest Rating", "Rated Contests Count", "Global Percentile"],
        },
        {
            title: "Open-Source Contributions",
            weight: "20%",
            maxPts: "2,000 pts",
            icon: <GitPullRequest className="w-5 h-5 text-black" />,
            color: "bg-[#b6e3f4]",
            description: "Merged pull requests, public code reviews, external repository contributions, and substantive issues resolved.",
            formula: "Subscore = 100 × (1 - e^(-rawOS / 220)) + First PR Bonus",
            details: [
                "Quality Weights: Merged PRs (10 pts), External Repos (12 pts), Code Reviews (6 pts), Opened PRs (3 pts)",
                "First Verified Milestone Bonus: +5 subscore points awarded for initial verified external contribution",
                "Diminishing returns curve values substance, peer review, and cross-organization impact",
            ],
            metrics: ["Merged Pull Requests", "External Repositories", "Code Reviews"],
        },
        {
            title: "Repository & Project Quality",
            weight: "10%",
            maxPts: "1,000 pts",
            icon: <Zap className="w-5 h-5 text-black" />,
            color: "bg-[#ffdfbf]",
            description: "Public non-fork repositories, verified community stars, forks, and polyglot language diversity.",
            formula: "Repo Quality = Bounded Repos (Cap 15) + Log10(Stars + 1)",
            details: [
                "Anti-Spam Bounding: Repositories strictly capped at 15 to prevent empty repository creation",
                "Logarithmic Star Multiplier: Rewards genuine community traction without letting viral repos distort rankings",
                "Polyglot Bonus: Verified projects across 3+ programming languages",
            ],
            metrics: ["Public Non-Fork Repos", "Organic Stars", "Polyglot Language Mix"],
        },
        {
            title: "Consistency & Streaks",
            weight: "10%",
            maxPts: "1,000 pts",
            icon: <Flame className="w-5 h-5 text-black" />,
            color: "bg-[#c0aede]",
            description: "All-time active coding days, trailing 30-day practice density, and daily streak consistency.",
            formula: "Consistency = Active Days (50 pts max) + Habit Streak (50 pts max)",
            details: [
                "All-Time Active Days: Bounded curve up to 50 subscore points for long-term dedication",
                "Trailing 30-Day Density: Up to 25 subscore points for active daily practice in the last month",
                "Habit Streak: Up to 25 subscore points for unbroken daily consistency",
            ],
            metrics: ["Active Days Count", "Trailing 30-Day Density", "Current Unbroken Streak"],
        },
        {
            title: "Technical Writing & Community",
            weight: "5%",
            maxPts: "500 pts",
            icon: <BookOpen className="w-5 h-5 text-black" />,
            color: "bg-[#fef08a]",
            description: "Published technical articles, developer guides, and newsletter publications on Medium and Substack.",
            formula: "Writing Score = Published Articles (50 pts) + Log10(Readership)",
            details: [
                "Article Publications: Up to 50 subscore points for quality developer tutorials and solutions",
                "Verified Readership & Followers: Logarithmic scaling for readers and newsletter subscribers",
                "Cross-Platform Publishing: Bonus points for publishing across multiple platforms",
            ],
            metrics: ["Published Technical Articles", "Verified Subscribers", "Claps/Likes"],
        },
    ];

    const platforms = [
        { name: "LeetCode", category: "Competitive Programming", metrics: "Total solved, E/M/H breakdown, Contest rating, Streak", pillars: "P1 (35%), P2 (20%), P5 (10%)" },
        { name: "Codeforces", category: "Competitive Programming", metrics: "Solves, Rating, Max rating, Tier, Contests", pillars: "P1 (35%), P2 (20%)" },
        { name: "CodeChef", category: "Competitive Programming", metrics: "Solves, Star rating (1★-7★), Global rating, Division", pillars: "P1 (35%), P2 (20%)" },
        { name: "GeeksforGeeks", category: "Coding Practice", metrics: "Score, Solved count, School/Basic/Easy/Medium/Hard", pillars: "P1 (35%)" },
        { name: "HackerRank", category: "Coding Practice", metrics: "Badges, Problem solving stars, Challenges solved", pillars: "P1 (35%)" },
        { name: "AtCoder", category: "Competitive Programming", metrics: "Rating, Max rating, Tier color, Contests", pillars: "P1 (35%), P2 (20%)" },
        { name: "Code360", category: "Coding Practice", metrics: "Problems solved, Experience points, Streaks", pillars: "P1 (35%), P5 (10%)" },
        { name: "InterviewBit", category: "Interview Prep", metrics: "Score, Problems solved, Streak", pillars: "P1 (35%), P5 (10%)" },
        { name: "TopCoder", category: "Competitive Programming", metrics: "SRM rating, Rated contests count", pillars: "P2 (20%)" },
        { name: "HackerEarth", category: "Coding Practice", metrics: "Problems solved, Contest participations", pillars: "P1 (35%), P2 (20%)" },
        { name: "CSES", category: "Algorithm Practice", metrics: "Problem set tasks solved", pillars: "P1 (35%)" },
        { name: "SPOJ", category: "Competitive Programming", metrics: "Classical problems solved, World rank", pillars: "P1 (35%)" },
        { name: "GitHub", category: "Code Hosting & OS", metrics: "Repos, Stars, Commits, PRs merged, Issues, Reviews", pillars: "P3 (20%), P4 (10%)" },
        { name: "Kaggle", category: "Data Science & ML", metrics: "Tiers, Medals (Gold/Silver/Bronze), Notebooks upvotes", pillars: "P1 (35%), P2 (20%), P4 (10%)" },
        { name: "Medium", category: "Technical Writing", metrics: "Published technical stories, Followers, Claps", pillars: "P6 (5%)" },
        { name: "Substack", category: "Technical Writing", metrics: "Newsletter posts, Subscribers, Publications", pillars: "P6 (5%)" },
    ];

    return (
        <article className="space-y-12">
            {/* ========================================================================= */}
            {/* HERO HEADER: ORBIX SCORE ENGINE                                          */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-black text-[#a2ff86] rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Cpu className="w-8 h-8 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-black">
                                    Orbix Score Engine
                                </h1>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-1">
                                Standard 0 to 10,000 Points • 6 Canonical Pillars • Diminishing Returns Architecture
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/leaderboard"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-black hover:text-[#a2ff86] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                    >
                        <span>View Live Leaderboards</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Cloudinary Header Graphic Banner */}
                <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000] mb-8 bg-black w-full">
                    <img
                        src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792948389/Neon_Algorithm_Grid_Wallpaper_smd5di.png"
                        alt="Orbix Score Engine Architecture Specification"
                        className="w-full h-auto block"
                    />
                </div>

                {/* Mission Summary / Preamble */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800">
                        <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                        <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-black">
                            Universal Developer Identity
                        </h2>
                    </div>
                    <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                        The <strong>Orbix Score</strong> solves the fragmentation of developer achievements. Instead of relying purely on one platform,
                        it combines competitive programming problem solving, live contest ratings, genuine open-source pull requests,
                        repository quality, daily consistency, and technical writing into one authoritative rank.
                    </p>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION: COLLEGE LEADERBOARD VS GLOBAL LEADERBOARD                        */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-black text-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <Globe2 className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-black">
                            College vs. Global Leaderboards
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            Dual-tier ranking architecture designed for global merit and campus-level placement recognition
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Global Leaderboard Card */}
                    <div className="p-6 rounded-3xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                                    <Globe2 className="w-3.5 h-3.5" />
                                    Global Leaderboard
                                </span>
                                <span className="text-xs font-mono font-bold text-neutral-500">Tier: Worldwide</span>
                            </div>
                            <h3 className="text-xl font-black text-black">Unified International Talent Index</h3>
                            <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                                Unites competitive coders, open-source maintainers, and engineers across 120+ countries on a single authoritative scale from 0 to 10,000 points.
                            </p>
                            <ul className="space-y-2 text-xs font-bold text-neutral-800 pt-2">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Global Percentile Tiers:</strong> Grandmaster (Top 0.1%), Master (Top 1%), Specialist (Top 5%), Candidate (Top 15%).</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Cross-Platform Parity:</strong> Solves on LeetCode are cross-calibrated against Codeforces and AtCoder to eliminate single-portal gaming.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Public Cryptographic Verification:</strong> Every user score has an immutable SHA-256 state stamp verifiable by tech recruiters.</span>
                                </li>
                            </ul>
                        </div>
                        <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-black">
                            <span className="text-neutral-500">Scope:</span>
                            <span className="text-black">All Registered Developers</span>
                        </div>
                    </div>

                    {/* College Leaderboard Card */}
                    <div className="p-6 rounded-3xl bg-[#FAF6EE] border-2 border-black shadow-[5px_5px_0px_#000] space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                                    <GraduationCap className="w-3.5 h-3.5" />
                                    College / Campus Leaderboard
                                </span>
                                <span className="text-xs font-mono font-bold text-neutral-500">Tier: Campus Cohort</span>
                            </div>
                            <h3 className="text-xl font-black text-black">Departmental & Batch-Wise Ranking</h3>
                            <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                                Tailored for university placement cells, coding clubs, and engineering batches to run intra-college seasons and transparent placement benchmarks.
                            </p>
                            <ul className="space-y-2 text-xs font-bold text-neutral-800 pt-2">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Verified Campus Credentials:</strong> Students authenticate via university domain emails or verified student ID numbers.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Batch & Branch Filters:</strong> Filter specifically by Graduation Year (e.g. 2026, 2027) and Branch (CSE, IT, ECE) for fair peer comparisons.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Anti-Smurf Safeguards:</strong> Detects shared accounts, fake bot repos, and sudden unnatural rating surges during campus placement tests.</span>
                                </li>
                            </ul>
                        </div>
                        <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between text-xs font-black">
                            <span className="text-neutral-500">Scope:</span>
                            <span className="text-black">Institutional Batches & Universities</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION: THE 6 CANONICAL SCORING PILLARS                                  */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b-2 border-black/15">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-black">
                            The 6 Canonical Scoring Pillars
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            Bounded Subscores [0 to 100] • Standard Scale: 0 to 10,000 Points
                        </p>
                    </div>
                    <span className="px-3.5 py-1.5 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-mono font-black text-xs shadow-[2px_2px_0px_#000] self-start sm:self-auto">
                        Total Weight: 100% (10,000 Pts)
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pillars.map((pillar, idx) => (
                        <div
                            key={idx}
                            className="p-6 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] ${pillar.color}`}>
                                            {pillar.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-base sm:text-lg text-black">{pillar.title}</h3>
                                            <span className="text-xs font-mono font-bold text-neutral-500">Max: {pillar.maxPts}</span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[1.5px_1.5px_0px_#000]">
                                        {pillar.weight}
                                    </span>
                                </div>

                                <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                    {pillar.description}
                                </p>

                                {/* Formula Snippet */}
                                <div className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black/20 font-mono text-[11px] font-bold text-neutral-900 overflow-x-auto">
                                    <code>{pillar.formula}</code>
                                </div>

                                {/* Rule Bullet Points */}
                                <ul className="space-y-1.5 text-xs text-neutral-800 font-medium pt-1">
                                    {pillar.details.map((item, dIdx) => (
                                        <li key={dIdx} className="flex items-start gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="pt-3 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <span className="font-bold text-neutral-500">Indexed Metrics:</span>
                                <div className="flex flex-wrap gap-1">
                                    {pillar.metrics.map((m, mIdx) => (
                                        <span key={mIdx} className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-300 text-[10px] font-bold text-neutral-700">
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION: INTERACTIVE LIVE SCORING SIMULATOR                               */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-black text-[#a2ff86] rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-black">Interactive Algorithm Simulator</h2>
                            <p className="text-xs font-bold text-neutral-600">
                                Adjust developer metrics below to see real-time diminishing returns and total score calculations out of 10,000 points.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000] self-start sm:self-auto">
                        <span className="text-xs text-neutral-400 font-bold uppercase">Estimated Score:</span>
                        <span className="text-2xl font-black text-[#a2ff86] font-mono">{simResults.total.toLocaleString()}</span>
                        <span className="text-xs text-neutral-400 font-bold">/ 10,000</span>
                    </div>
                </div>

                {/* Simulator Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Pillar 1 Controls */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-wider text-black">P1: Problems Solved</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#a2ff86] border border-black font-mono font-bold text-xs">
                                {simResults.p1.pts} pts
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Easy Solves (1x):</span>
                                    <span className="font-mono">{easyProblems}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="500"
                                    value={easyProblems}
                                    onChange={(e) => setEasyProblems(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Medium Solves (3x):</span>
                                    <span className="font-mono">{medProblems}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="400"
                                    value={medProblems}
                                    onChange={(e) => setMedProblems(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Hard Solves (6x):</span>
                                    <span className="font-mono">{hardProblems}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="150"
                                    value={hardProblems}
                                    onChange={(e) => setHardProblems(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pillar 2 Controls */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-wider text-black">P2: Contest Rating</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#ffd5dc] border border-black font-mono font-bold text-xs">
                                {simResults.p2.pts} pts
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Rating Baseline:</span>
                                    <span className="font-mono">{contestRating}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1000"
                                    max="2600"
                                    step="10"
                                    value={contestRating}
                                    onChange={(e) => setContestRating(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Rated Contests Attended:</span>
                                    <span className="font-mono">{contestsCount}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="60"
                                    value={contestsCount}
                                    onChange={(e) => setContestsCount(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pillar 3 Controls */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-wider text-black">P3: Open Source PRs</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#b6e3f4] border border-black font-mono font-bold text-xs">
                                {simResults.p3.pts} pts
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Merged Pull Requests:</span>
                                    <span className="font-mono">{mergedPRs}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    value={mergedPRs}
                                    onChange={(e) => setMergedPRs(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>External Repositories:</span>
                                    <span className="font-mono">{externalRepos}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="15"
                                    value={externalRepos}
                                    onChange={(e) => setExternalRepos(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pillar 4 Controls */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-wider text-black">P4: Repos & Stars</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#ffdfbf] border border-black font-mono font-bold text-xs">
                                {simResults.p4.pts} pts
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Public Non-Fork Repos:</span>
                                    <span className="font-mono">{publicRepos} (Cap 15)</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="30"
                                    value={publicRepos}
                                    onChange={(e) => setPublicRepos(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Organic Stars:</span>
                                    <span className="font-mono">{repoStars}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="500"
                                    value={repoStars}
                                    onChange={(e) => setRepoStars(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pillar 5 Controls */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-wider text-black">P5: Active Days & Streaks</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#c0aede] border border-black font-mono font-bold text-xs">
                                {simResults.p5.pts} pts
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>All-time Active Days:</span>
                                    <span className="font-mono">{activeDays}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="365"
                                    value={activeDays}
                                    onChange={(e) => setActiveDays(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Current Streak Days:</span>
                                    <span className="font-mono">{currentStreak}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="120"
                                    value={currentStreak}
                                    onChange={(e) => setCurrentStreak(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pillar 6 Controls */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-wider text-black">P6: Technical Articles</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#fef08a] border border-black font-mono font-bold text-xs">
                                {simResults.p6.pts} pts
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Published Guides:</span>
                                    <span className="font-mono">{publishedArticles}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={publishedArticles}
                                    onChange={(e) => setPublishedArticles(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Verified Readership:</span>
                                    <span className="font-mono">{readersCount.toLocaleString()}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10000"
                                    step="100"
                                    value={readersCount}
                                    onChange={(e) => setReadersCount(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Score Breakdown Bar */}
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex justify-between items-center text-xs font-black">
                        <span>Pillar Contribution Breakdown</span>
                        <span className="font-mono text-neutral-500">Live Weights Sum: 100%</span>
                    </div>

                    <div className="w-full h-4 rounded-full border-2 border-black overflow-hidden flex bg-neutral-100">
                        <div style={{ width: `${(simResults.p1.pts / 10000) * 100}%` }} className="bg-[#a2ff86] h-full" title={`Problem Solving: ${simResults.p1.pts} pts`} />
                        <div style={{ width: `${(simResults.p2.pts / 10000) * 100}%` }} className="bg-[#ffd5dc] h-full" title={`Contests: ${simResults.p2.pts} pts`} />
                        <div style={{ width: `${(simResults.p3.pts / 10000) * 100}%` }} className="bg-[#b6e3f4] h-full" title={`Open Source: ${simResults.p3.pts} pts`} />
                        <div style={{ width: `${(simResults.p4.pts / 10000) * 100}%` }} className="bg-[#ffdfbf] h-full" title={`Repo Quality: ${simResults.p4.pts} pts`} />
                        <div style={{ width: `${(simResults.p5.pts / 10000) * 100}%` }} className="bg-[#c0aede] h-full" title={`Consistency: ${simResults.p5.pts} pts`} />
                        <div style={{ width: `${(simResults.p6.pts / 10000) * 100}%` }} className="bg-[#fef08a] h-full" title={`Writing: ${simResults.p6.pts} pts`} />
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] font-bold text-neutral-700 pt-1">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black inline-block" /> P1: {simResults.p1.pts} pts</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ffd5dc] border border-black inline-block" /> P2: {simResults.p2.pts} pts</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#b6e3f4] border border-black inline-block" /> P3: {simResults.p3.pts} pts</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ffdfbf] border border-black inline-block" /> P4: {simResults.p4.pts} pts</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#c0aede] border border-black inline-block" /> P5: {simResults.p5.pts} pts</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#fef08a] border border-black inline-block" /> P6: {simResults.p6.pts} pts</span>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* REAL SECTION SNAPSHOT: LIVE LEADERBOARD CANDIDATE CARD                   */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-4 border-t-2 border-black/15">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-black" />
                            <h3 className="text-base sm:text-lg font-black text-black">
                                Live Component Snapshot: Candidate Leaderboard Card
                            </h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-black text-[#a2ff86] border border-black">
                            Real-Time Simulator Render
                        </span>
                    </div>

                    <div className="p-6 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-black border-2 border-black flex items-center justify-center font-black text-2xl text-[#a2ff86] shadow-[3px_3px_0px_#000] shrink-0">
                                    #14
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-lg sm:text-xl font-black text-black">Aarav Sharma</h4>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border border-black shadow-[1px_1px_0px_#000] ${
                                            simResults.total >= 7500 ? "bg-[#a2ff86] text-black" : simResults.total >= 5000 ? "bg-[#FFE566] text-black" : "bg-white text-black"
                                        }`}>
                                            {simResults.total >= 7500 ? "Grandmaster Tier" : simResults.total >= 5000 ? "Master Tier" : "Diamond Tier"}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-neutral-600 flex items-center gap-1.5 flex-wrap">
                                        <GraduationCap className="w-3.5 h-3.5 text-neutral-800" />
                                        <span>Indian Institute of Information Technology • CSE &apos;26</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 self-start md:self-center">
                                <div className="p-3 rounded-2xl bg-white border-2 border-black text-right shadow-[3px_3px_0px_#000]">
                                    <div className="text-[10px] font-bold uppercase text-neutral-500">Orbix Score</div>
                                    <div className="text-2xl font-black text-black font-mono">
                                        {simResults.total.toLocaleString()}
                                        <span className="text-xs text-neutral-500 font-normal"> / 10k</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-emerald-700">Top 1.4% Globally</div>
                                </div>
                            </div>
                        </div>

                        {/* Verified Platform Chips on Card */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mr-1">Verified:</span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#FFA116]" /> LeetCode ({contestRating})
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#1F8ACB]" /> Codeforces ({Math.max(1200, contestRating - 80)})
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-black" /> GitHub ({publicRepos} Repos • {repoStars}★)
                            </span>
                        </div>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* INTERACTIVE DIMINISHING RETURNS MATH GRAPH (SVG)                          */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-4 border-t-2 border-black/15">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-black" />
                        <h3 className="text-base sm:text-lg font-black text-black">
                            Mathematical Saturation Curve Visualizer (P1 Concave Decay)
                        </h3>
                    </div>

                    <div className="p-6 rounded-3xl bg-neutral-950 text-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <span className="font-mono text-[#a2ff86]">Formula: S(x) = 100 × (1 - e^(-raw / 1400))</span>
                            <span className="font-mono text-neutral-400">Current Raw Problem Points: {simResults.p1.raw}</span>
                        </div>

                        {/* Interactive SVG Curve */}
                        <div className="w-full bg-black/60 rounded-2xl p-4 border border-neutral-800 overflow-x-auto">
                            <svg viewBox="0 0 500 160" className="w-full h-40 max-w-full block">
                                {/* Grid lines */}
                                <line x1="50" y1="130" x2="480" y2="130" stroke="#333" strokeWidth="1" />
                                <line x1="50" y1="80" x2="480" y2="80" stroke="#222" strokeDasharray="3 3" />
                                <line x1="50" y1="30" x2="480" y2="30" stroke="#222" strokeDasharray="3 3" />
                                <line x1="50" y1="20" x2="50" y2="130" stroke="#333" strokeWidth="1" />

                                {/* Axis Labels */}
                                <text x="20" y="35" fill="#666" fontSize="9" fontFamily="monospace">100%</text>
                                <text x="25" y="85" fill="#666" fontSize="9" fontFamily="monospace">50%</text>
                                <text x="35" y="133" fill="#666" fontSize="9" fontFamily="monospace">0</text>
                                <text x="50" y="145" fill="#666" fontSize="9" fontFamily="monospace">0</text>
                                <text x="250" y="145" fill="#666" fontSize="9" fontFamily="monospace">1,500 Raw</text>
                                <text x="440" y="145" fill="#666" fontSize="9" fontFamily="monospace">3,500 Raw</text>

                                {/* Saturation curve path */}
                                <path
                                    d="M 50 130 Q 150 50, 480 32"
                                    fill="none"
                                    stroke="#a2ff86"
                                    strokeWidth="3"
                                />

                                {/* Current Simulated Point Marker */}
                                {(() => {
                                    const progressX = Math.min(480, 50 + (simResults.p1.raw / 3500) * 430);
                                    const progressY = 130 - (simResults.p1.sub / 100) * 100;
                                    return (
                                        <g>
                                            <circle cx={progressX} cy={progressY} r="6" fill="#FFE566" stroke="#000" strokeWidth="2" />
                                            <circle cx={progressX} cy={progressY} r="10" fill="none" stroke="#FFE566" strokeWidth="1" opacity="0.6" className="animate-ping" />
                                            <text x={Math.min(420, progressX + 10)} y={progressY - 8} fill="#FFE566" fontSize="10" fontWeight="bold" fontFamily="monospace">
                                                {simResults.p1.sub}% Subscore ({simResults.p1.pts} pts)
                                            </text>
                                        </g>
                                    );
                                })()}
                            </svg>
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                            Anti-Gaming Guarantee: As a student’s raw count increases, the curve asymptotically flattens. Solving 500 trivial easy problems grants diminishing returns, encouraging candidates to tackle Hard contest problems, contribute to genuine open-source repositories, and maintain real consistency.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION: SUPPORTED PLATFORM REGISTRY MATRIX (16 PLATFORMS)                */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b-2 border-black/15">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-black">
                            Supported Platform Registry
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            16 Genuine Platforms natively indexed, verified, and mapped to scoring pillars
                        </p>
                    </div>
                </div>

                <div className="rounded-3xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                            <thead>
                                <tr className="bg-black text-[#a2ff86] font-black uppercase tracking-wider text-xs border-b-2 border-black">
                                    <th className="py-3 px-4 sm:px-6">Platform</th>
                                    <th className="py-3 px-4 sm:px-6">Category</th>
                                    <th className="py-3 px-4 sm:px-6">Available Metrics</th>
                                    <th className="py-3 px-4 sm:px-6">Scoring Integration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10 font-medium text-neutral-800">
                                {platforms.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-[#FAF6EE] transition-colors">
                                        <td className="py-3.5 px-4 sm:px-6 font-black text-black">
                                            {p.name}
                                        </td>
                                        <td className="py-3.5 px-4 sm:px-6">
                                            <span className="px-2.5 py-0.5 rounded-md bg-neutral-100 border border-neutral-300 font-bold text-xs">
                                                {p.category}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 sm:px-6 text-neutral-700">
                                            {p.metrics}
                                        </td>
                                        <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-black">
                                            {p.pillars}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION: ANTI-SMURFING, BOUNDS & MATHEMATICAL SATURATION                   */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex items-center gap-2.5 text-black">
                    <AlertCircle className="w-6 h-6 stroke-[2.5]" />
                    <h2 className="text-xl sm:text-2xl font-black">
                        Why Concave Saturation Beats Linear Sums
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm">
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <h4 className="font-black text-black text-base">The Problem with Simple Counts</h4>
                        <p className="text-neutral-700 font-medium leading-relaxed">
                            Linear scoring rewards brute-force spam: solving 1,000 trivial Two Sum duplicates should never outweigh someone who solves 200 Hard DP & Graph challenges or performs well in live Div 1 Codeforces contests.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <h4 className="font-black text-black text-base">Logarithmic Diminishing Returns</h4>
                        <p className="text-neutral-700 font-medium leading-relaxed">
                            Orbix applies the concave exponential formula <code>100 × (1 - e^(-x/k))</code>. Each additional easy problem yields proportionally less marginal gain, strictly incentivizing engineers to tackle higher difficulties.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <h4 className="font-black text-black text-base">Anti-Smurf & Repository Caps</h4>
                        <p className="text-neutral-700 font-medium leading-relaxed">
                            Repositories are bounded at 15 to prevent mass auto-generated forks. GitHub stars scale on a base-10 logarithm, rewarding authentic community adoption without letting one viral meme repo distort rankings.
                        </p>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-black text-white border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h4 className="font-black text-base text-[#a2ff86]">Ready to verify your score?</h4>
                        <p className="text-xs text-neutral-300 font-medium">
                            Connect your LeetCode, Codeforces, GitHub, and college credentials to generate your official Orbix Universal Identity.
                        </p>
                    </div>
                    <Link
                        to="/onboarding"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black font-black text-xs hover:bg-[#FFE566] transition-colors border-2 border-black shadow-[2px_2px_0px_#fff] shrink-0"
                    >
                        <span>Connect Platforms</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>
        </article>
    );
};

export default AlgorithmDocumentary;
