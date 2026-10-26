import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Trophy,
    GraduationCap,
    Medal,
    ArrowRight,
    Flame,
    CheckCircle2,
    Building2,
    BookOpen,
    Users,
} from "lucide-react";
import { getPortalIcon } from "../../../utils/portalIcons";

export interface MockLeaderboardItem {
    rank: number;
    username: string;
    displayName: string;
    college: string;
    collegeId: string;
    city: string;
    state: string;
    avatarUrl: string;
    score: number;
    totalSolved: number;
    totalContests: number;
    streak: number;
    isVerified: boolean;
    topPlatforms: {
        platform: string;
        rating: number;
        tier: string;
        color: string;
    }[];
}

const INDIAN_LEADERBOARD_DATA: MockLeaderboardItem[] = [
    {
        rank: 1,
        username: "aditya_verma",
        displayName: "Aditya Verma",
        college: "Indian Institute of Technology Delhi (IIT Delhi)",
        collegeId: "iitd",
        city: "New Delhi",
        state: "Delhi",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        score: 2985,
        totalSolved: 2410,
        totalContests: 114,
        streak: 420,
        isVerified: true,
        topPlatforms: [
            { platform: "leetcode", rating: 2680, tier: "Guardian", color: "#FFA116" },
            { platform: "codeforces", rating: 2410, tier: "Grandmaster", color: "#FF383C" },
            { platform: "codechef", rating: 2540, tier: "7★", color: "#5B4638" },
        ],
    },
    {
        rank: 2,
        username: "priyanshu_dev",
        displayName: "Priyanshu Sharma",
        college: "BITS Pilani, Pilani Campus",
        collegeId: "bits",
        city: "Pilani",
        state: "Rajasthan",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        score: 2870,
        totalSolved: 2180,
        totalContests: 98,
        streak: 365,
        isVerified: true,
        topPlatforms: [
            { platform: "leetcode", rating: 2510, tier: "Guardian", color: "#FFA116" },
            { platform: "codeforces", rating: 2240, tier: "Master", color: "#FF8C00" },
        ],
    },
    {
        rank: 3,
        username: "sneha_codes",
        displayName: "Sneha Kulkarni",
        college: "IIIT Hyderabad",
        collegeId: "iiith",
        city: "Hyderabad",
        state: "Telangana",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        score: 2795,
        totalSolved: 1940,
        totalContests: 86,
        streak: 290,
        isVerified: true,
        topPlatforms: [
            { platform: "leetcode", rating: 2460, tier: "Guardian", color: "#FFA116" },
            { platform: "codeforces", rating: 2080, tier: "Candidate Master", color: "#AA00AA" },
        ],
    },
    {
        rank: 4,
        username: "Vineet-Chandel",
        displayName: "Vineet Chandel",
        college: "Netaji Subhas University of Technology (NSUT)",
        collegeId: "nsut",
        city: "New Delhi",
        state: "Delhi",
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
        score: 2740,
        totalSolved: 1820,
        totalContests: 79,
        streak: 310,
        isVerified: true,
        topPlatforms: [
            { platform: "leetcode", rating: 2340, tier: "Guardian", color: "#FFA116" },
            { platform: "codeforces", rating: 2045, tier: "Candidate Master", color: "#AA00AA" },
        ],
    },
    {
        rank: 5,
        username: "ananya_iyer",
        displayName: "Ananya Iyer",
        college: "NIT Tiruchirappalli (NIT Trichy)",
        collegeId: "nitt",
        city: "Tiruchirappalli",
        state: "Tamil Nadu",
        avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        score: 2680,
        totalSolved: 1730,
        totalContests: 72,
        streak: 245,
        isVerified: true,
        topPlatforms: [
            { platform: "leetcode", rating: 2280, tier: "Knight", color: "#4F46E5" },
            { platform: "codeforces", rating: 1890, tier: "Expert", color: "#0000FF" },
        ],
    },
    {
        rank: 6,
        username: "rohan_d",
        displayName: "Rohan Deshmukh",
        college: "Delhi Technological University (DTU)",
        collegeId: "dtu",
        city: "Delhi",
        state: "Delhi",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
        score: 2610,
        totalSolved: 1620,
        totalContests: 64,
        streak: 198,
        isVerified: true,
        topPlatforms: [
            { platform: "leetcode", rating: 2210, tier: "Knight", color: "#4F46E5" },
            { platform: "codeforces", rating: 1840, tier: "Expert", color: "#0000FF" },
        ],
    },
];

const COLLEGE_LEAGUES = [
    { id: "all", name: "All India (Global)", count: "50,000+ Coders" },
    { id: "iitd", name: "IIT Delhi", count: "820 Coders" },
    { id: "bits", name: "BITS Pilani", count: "1,140 Coders" },
    { id: "iiith", name: "IIIT Hyderabad", count: "650 Coders" },
    { id: "nsut", name: "NSUT Delhi", count: "740 Coders" },
    { id: "nitt", name: "NIT Trichy", count: "890 Coders" },
    { id: "dtu", name: "DTU Delhi", count: "980 Coders" },
];

export const LeaderboardShowcase: React.FC = () => {
    const [selectedCollege, setSelectedCollege] = useState("all");
    const [viewMode, setViewMode] = useState<"podium" | "table">("podium");

    // Filter coders based on selected college league
    const displayEntries = useMemo(() => {
        if (selectedCollege === "all") {
            return INDIAN_LEADERBOARD_DATA;
        }
        const filtered = INDIAN_LEADERBOARD_DATA.filter((item) => item.collegeId === selectedCollege);
        // If college only has 1, re-index ranks
        return filtered.length > 0
            ? filtered.map((item, idx) => ({ ...item, rank: idx + 1 }))
            : INDIAN_LEADERBOARD_DATA.slice(0, 3);
    }, [selectedCollege]);

    const topThree = useMemo(() => displayEntries.slice(0, 3), [displayEntries]);

    return (
        <section className="relative w-full bg-[#FAF6EE] text-neutral-900 py-16 sm:py-24 px-0 overflow-hidden font-sans select-none">
            {/* Warm, eye-friendly dot grid matching Orbix platform canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* =========================================================================
                SECTION HEADER: Exact styling from User Request Image & Neo-Brutalist Theme
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto mb-12 sm:mb-16 px-4 sm:px-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    {/* Left Column: Bold Headline & Redirections */}
                    <div className="lg:col-span-6 space-y-6">
                        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-black tracking-tight leading-[1.08]">
                            See where you
                            <br />
                            <span className="inline-block mt-3 bg-[#FFE566] text-black px-5 sm:px-8 py-1.5 sm:py-2.5 rounded-2xl font-black -rotate-1 border-2 border-black shadow-[4px_4px_0px_#000]">
                                really stand
                            </span>
                        </h2>

                        <p className="text-neutral-700 font-medium text-base sm:text-lg md:text-xl max-w-xl leading-relaxed">
                            A live leaderboard across every platform. Every sync moves you up.
                        </p>

                        {/* Dual Redirections: 1. Leaderboard & 2. Orbix Score Algorithm Docs */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            <Link
                                to="/leaderboard"
                                className="inline-flex items-center gap-2 text-base sm:text-lg font-black text-black hover:text-neutral-800 transition-colors group cursor-pointer"
                                title="Open Orbix Leaderboard"
                            >
                                <span className="underline decoration-4 underline-offset-4 decoration-[#FFE566] group-hover:decoration-black">
                                    Open the leaderboard
                                </span>
                                <ArrowRight className="w-5 h-5 text-black group-hover:translate-x-1.5 transition-transform stroke-[2.5]" />
                            </Link>

                            <span className="text-black/30 hidden sm:inline">•</span>

                            <Link
                                to="/docs/orbix-score-algorithm"
                                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-neutral-600 hover:text-black transition-colors"
                                title="Read Orbix Score Algorithm Documentation"
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Orbix Score Algorithm Docs →</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: 3 Feature Cards from Provided Image */}
                    <div className="lg:col-span-6 space-y-4">
                        {/* 1. Orbix Score Engine */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <Trophy className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Orbix Score
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        One number for your whole profile. Hard problems and contests count the most.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. College Boards */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <GraduationCap className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        College boards
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        See where you stand in your batch, not just the whole country. AISHE verified directories with 45,000+ campuses.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Ten Ways to Rank */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <Medal className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Ten ways to rank
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Problems, contests, streaks, GitHub, or your rating on any platform. True cross-platform verification.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                THE LEADERBOARD SHOWCASE CONTAINER (Matches Hero Covering Width Exactly)
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto rounded-[18px] sm:rounded-[24px] lg:rounded-[30px] bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black shadow-[8px_8px_0px_#000] p-4 sm:p-7 md:p-8 relative z-10 space-y-6 text-neutral-900">
                {/* 1. Header Toolbar */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black text-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Trophy className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-black">
                                Live National Standings
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                Real-time cross-platform leaderboard evaluated by the Orbix Algorithm
                            </p>
                        </div>
                    </div>

                    {/* View Controls: Podium vs Table */}
                    <div className="flex items-center gap-3">
                        <div className="inline-flex rounded-xl bg-white p-1 border-2 border-black shadow-[3px_3px_0px_#000]">
                            <button
                                type="button"
                                onClick={() => setViewMode("podium")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    viewMode === "podium"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black font-bold"
                                }`}
                            >
                                Podium View
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("table")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    viewMode === "table"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black font-bold"
                                }`}
                            >
                                Table View
                            </button>
                        </div>
                    </div>
                </header>

                {/* 2. College League Selector Ribbon */}
                <div className="relative z-30 mb-8 sm:mb-10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            Select Campus / League
                        </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-3 px-1 scrollbar-none">
                        {COLLEGE_LEAGUES.map((c) => {
                            const isSelected = selectedCollege === c.id;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedCollege(c.id)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border-2 border-black flex items-center gap-2 cursor-pointer ${
                                        isSelected
                                            ? "bg-[#FFE566] text-black shadow-[3px_3px_0px_#000] -translate-y-0.5"
                                            : "bg-white text-neutral-700 hover:text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-50"
                                    }`}
                                >
                                    <span>{c.name}</span>
                                    <span
                                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                                            isSelected ? "bg-black text-[#FFE566]" : "bg-neutral-100 text-neutral-600"
                                        }`}
                                    >
                                        {c.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Podium Display (Top 3 Pedestal Cards) */}
                {viewMode === "podium" && (
                    <div className="w-full relative z-10 pt-8 sm:pt-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-end max-w-5xl mx-auto">
                            {/* 2nd Place (Left) */}
                            {topThree[1] && (
                                <div className="rounded-2xl border-2 border-black bg-white p-6 shadow-[5px_5px_0px_#000] flex flex-col justify-between md:min-h-[420px] transition-all hover:-translate-y-1">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="w-10 h-10 rounded-xl bg-slate-200 border-2 border-black font-black text-sm flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                2nd
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs font-black text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-full border border-black/15">
                                                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                {topThree[1].streak}d Streak
                                            </span>
                                        </div>

                                        <div className="text-center space-y-2 pt-2">
                                            <div className="w-20 h-20 rounded-full border-2 border-black mx-auto overflow-hidden shadow-[3px_3px_0px_#000]">
                                                <img
                                                    src={topThree[1].avatarUrl}
                                                    alt={topThree[1].displayName}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <h4 className="text-lg font-black text-black flex items-center justify-center gap-1.5">
                                                <span>{topThree[1].displayName}</span>
                                                <CheckCircle2 className="w-4 h-4 text-sky-500 fill-sky-500" />
                                            </h4>
                                            <p className="text-xs font-mono font-bold text-neutral-500">
                                                @{topThree[1].username}
                                            </p>
                                            <p className="text-xs font-bold text-neutral-700 bg-[#FAF6EE] p-2 rounded-xl border border-black/15">
                                                {topThree[1].college}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t-2 border-black/10 mt-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-neutral-600">Orbix Score</span>
                                            <span className="text-xl font-black text-black">
                                                {topThree[1].score.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-neutral-600 font-bold">
                                            <span>{topThree[1].totalSolved} Solved</span>
                                            <span>{topThree[1].totalContests} Contests</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 1st Place (Center - Elevated Champion) */}
                            {topThree[0] && (
                                <div className="rounded-2xl border-2 border-black bg-[#FFE566] p-6 shadow-[7px_7px_0px_#000] flex flex-col justify-between md:min-h-[470px] relative transition-all hover:-translate-y-1">
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black text-[#FFE566] border-2 border-black rounded-full px-4 py-1 text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-1.5 uppercase tracking-wider">
                                        <Trophy className="w-3.5 h-3.5 fill-[#FFE566]" />
                                        National #1 Rank
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between">
                                            <span className="w-12 h-12 rounded-xl bg-black text-[#FFE566] border-2 border-black font-black text-base flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                1st
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs font-black text-black bg-white px-2.5 py-1 rounded-full border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                                                {topThree[0].streak}d Streak
                                            </span>
                                        </div>

                                        <div className="text-center space-y-2 pt-2">
                                            <div className="w-24 h-24 rounded-full border-3 border-black mx-auto overflow-hidden shadow-[4px_4px_0px_#000]">
                                                <img
                                                    src={topThree[0].avatarUrl}
                                                    alt={topThree[0].displayName}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <h4 className="text-xl font-black text-black flex items-center justify-center gap-1.5">
                                                <span>{topThree[0].displayName}</span>
                                                <CheckCircle2 className="w-4 h-4 text-black fill-emerald-400" />
                                            </h4>
                                            <p className="text-xs font-mono font-black text-black/75">
                                                @{topThree[0].username}
                                            </p>
                                            <p className="text-xs font-black text-black bg-white p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                                {topThree[0].college}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t-2 border-black mt-4 space-y-3 bg-white/70 p-3 rounded-xl border border-black">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-black">Orbix Score</span>
                                            <span className="text-2xl font-black text-black">
                                                {topThree[0].score.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-black font-black">
                                            <span>{topThree[0].totalSolved} Problems Solved</span>
                                            <span>{topThree[0].totalContests} Contests</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place (Right) */}
                            {topThree[2] && (
                                <div className="rounded-2xl border-2 border-black bg-white p-6 shadow-[5px_5px_0px_#000] flex flex-col justify-between md:min-h-[420px] transition-all hover:-translate-y-1">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-black font-black text-sm flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                3rd
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-xs font-black text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-full border border-black/15">
                                                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                                {topThree[2].streak}d Streak
                                            </span>
                                        </div>

                                        <div className="text-center space-y-2 pt-2">
                                            <div className="w-20 h-20 rounded-full border-2 border-black mx-auto overflow-hidden shadow-[3px_3px_0px_#000]">
                                                <img
                                                    src={topThree[2].avatarUrl}
                                                    alt={topThree[2].displayName}
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <h4 className="text-lg font-black text-black flex items-center justify-center gap-1.5">
                                                <span>{topThree[2].displayName}</span>
                                                <CheckCircle2 className="w-4 h-4 text-sky-500 fill-sky-500" />
                                            </h4>
                                            <p className="text-xs font-mono font-bold text-neutral-500">
                                                @{topThree[2].username}
                                            </p>
                                            <p className="text-xs font-bold text-neutral-700 bg-[#FAF6EE] p-2 rounded-xl border border-black/15">
                                                {topThree[2].college}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t-2 border-black/10 mt-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-neutral-600">Orbix Score</span>
                                            <span className="text-xl font-black text-black">
                                                {topThree[2].score.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-neutral-600 font-bold">
                                            <span>{topThree[2].totalSolved} Solved</span>
                                            <span>{topThree[2].totalContests} Contests</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. Leaderboard Table View */}
                {viewMode === "table" && (
                    <div className="w-full overflow-hidden rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-black bg-[#FAF6EE] text-[11px] font-black text-black uppercase tracking-wider">
                                        <th className="py-3 px-4 sm:px-6 w-16 text-center">Rank</th>
                                        <th className="py-3 px-4 min-w-[200px]">Coder</th>
                                        <th className="py-3 px-4 min-w-[220px] hidden md:table-cell">Campus / College</th>
                                        <th className="py-3 px-4 text-right">Orbix Score</th>
                                        <th className="py-3 px-4 text-center hidden sm:table-cell">Solved</th>
                                        <th className="py-3 px-4 text-center hidden sm:table-cell">Contests</th>
                                        <th className="py-3 px-4 min-w-[140px] hidden lg:table-cell">Top Ratings</th>
                                        <th className="py-3 px-4 text-center hidden xl:table-cell">Streak</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y-2 divide-black/10 text-xs">
                                    {displayEntries.map((entry) => (
                                        <tr
                                            key={entry.username}
                                            className="hover:bg-[#FAF6EE]/80 transition-colors group"
                                        >
                                            <td className="py-3.5 px-4 sm:px-6 text-center">
                                                <span
                                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs border-2 border-black shadow-[1px_1px_0px_#000] ${
                                                        entry.rank === 1
                                                            ? "bg-[#FFE566] text-black"
                                                            : entry.rank === 2
                                                            ? "bg-slate-200 text-black"
                                                            : entry.rank === 3
                                                            ? "bg-amber-100 text-black"
                                                            : "bg-white text-neutral-800"
                                                    }`}
                                                >
                                                    {entry.rank}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full border-2 border-black overflow-hidden shrink-0 shadow-[1px_1px_0px_#000]">
                                                        <img
                                                            src={entry.avatarUrl}
                                                            alt={entry.displayName}
                                                            loading="lazy"
                                                            decoding="async"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-black text-black group-hover:underline">
                                                                {entry.displayName}
                                                            </span>
                                                            {entry.isVerified && (
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 fill-sky-500 shrink-0" />
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-mono font-bold text-neutral-500">
                                                            @{entry.username}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 hidden md:table-cell">
                                                <div className="flex items-center gap-1.5 text-neutral-700 font-bold max-w-[280px] truncate">
                                                    <Building2 className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                                                    <span className="truncate">{entry.college}</span>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 text-right">
                                                <span className="font-mono font-black text-sm text-black bg-[#FFE566]/40 px-2 py-0.5 rounded border border-black/20">
                                                    {entry.score.toLocaleString()}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-4 text-center hidden sm:table-cell font-mono font-bold text-neutral-800">
                                                {entry.totalSolved}
                                            </td>

                                            <td className="py-3.5 px-4 text-center hidden sm:table-cell font-mono font-bold text-neutral-800">
                                                {entry.totalContests}
                                            </td>

                                            <td className="py-3.5 px-4 hidden lg:table-cell">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {entry.topPlatforms.slice(0, 2).map((tp) => (
                                                        <span
                                                            key={tp.platform}
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 border border-black/10 text-[10px] font-bold text-neutral-800"
                                                        >
                                                            {getPortalIcon(tp.platform, "w-3 h-3")}
                                                            <span>{tp.rating}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 text-center hidden xl:table-cell">
                                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                                    <Flame className="w-3 h-3 fill-rose-500" />
                                                    {entry.streak}d
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 5. Bottom Action Redirection Banner */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-black/15">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                        <Users className="w-4 h-4 text-black" />
                        <span>Showing verified standings across 45,000+ Indian engineering colleges</span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Redirection 1: Open the Leaderboard */}
                        <Link
                            to="/leaderboard"
                            className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs sm:text-sm shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:bg-neutral-900 transition-all inline-flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <span>Open the leaderboard</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>

                        {/* Redirection 2: Docs of Orbix Score Algorithm */}
                        <Link
                            to="/docs/orbix-score-algorithm"
                            className="px-4 py-2.5 rounded-xl bg-white text-black border-2 border-black font-black text-xs sm:text-sm shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:bg-neutral-50 transition-all inline-flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Orbix Score Algorithm Docs</span>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LeaderboardShowcase;
