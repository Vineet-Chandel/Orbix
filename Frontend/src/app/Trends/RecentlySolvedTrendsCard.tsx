import React, { useState, useMemo } from "react";
import { ListOrdered, Calendar, ExternalLink, Filter, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useAppSelector } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import type { RecentSolveItem } from "../../store/practiceAnalyticsSlice";

interface RecentlySolvedTrendsCardProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

export const RecentlySolvedTrendsCard: React.FC<RecentlySolvedTrendsCardProps> = ({
    connectedPortals: _connectedPortals,
    username = "",
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();

    const analyticsData = useAppSelector((state) =>
        effectiveUser ? state.practiceAnalytics.dataByUser[effectiveUser] : undefined
    );
    const isLoading = useAppSelector((state) =>
        effectiveUser ? (state.practiceAnalytics.loadingByUser[effectiveUser] && !state.practiceAnalytics.dataByUser[effectiveUser]) || false : false
    );

    const [difficultyFilter, setDifficultyFilter] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
    const [selectedPortal, setSelectedPortal] = useState<string>("All");
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    // Strictly exclude any GitHub entries and sanitize data
    const rawList: RecentSolveItem[] = useMemo(() => {
        const items = analyticsData?.recentlySolved || [];
        return items.filter((item) => {
            const portalKey = (item.portal || "").toLowerCase().trim();
            return portalKey !== "github";
        });
    }, [analyticsData?.recentlySolved]);

    // Unique platforms present in the recent solves list
    const availablePlatforms = useMemo(() => {
        const set = new Set<string>();
        for (const item of rawList) {
            if (item.portal && item.portal.toLowerCase() !== "github") {
                set.add(item.portal.toLowerCase());
            }
        }
        return Array.from(set);
    }, [rawList]);

    // Filtered list based on active category & platform filters
    const filteredList = useMemo(() => {
        return rawList.filter((item) => {
            if (difficultyFilter !== "All" && item.difficulty !== difficultyFilter) {
                return false;
            }
            if (selectedPortal !== "All" && item.portal.toLowerCase() !== selectedPortal.toLowerCase()) {
                return false;
            }
            return true;
        });
    }, [rawList, difficultyFilter, selectedPortal]);

    const displayedList = isExpanded ? filteredList : filteredList.slice(0, 8);

    const handleOpenProblem = (url?: string) => {
        if (url && typeof window !== "undefined") {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const formatDisplayDate = (item: RecentSolveItem): string => {
        if (item.exactDate && item.exactDate.trim()) {
            return item.exactDate;
        }
        if (item.solvedAt) {
            const d = new Date(item.solvedAt);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                });
            }
        }
        if (item.timestamp) {
            const ms = item.timestamp > 1e11 ? item.timestamp : item.timestamp * 1000;
            const d = new Date(ms);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                });
            }
        }
        return "Recent";
    };

    const getDifficultyBadge = (difficulty?: "Easy" | "Medium" | "Hard" | null) => {
        switch (difficulty) {
            case "Easy":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] text-[11px] font-black uppercase tracking-wider">
                        Easy
                    </span>
                );
            case "Medium":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] text-[11px] font-black uppercase tracking-wider">
                        Medium
                    </span>
                );
            case "Hard":
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FF6B6B] text-black border border-black shadow-[1px_1px_0px_#000] text-[11px] font-black uppercase tracking-wider">
                        Hard
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-black/30 text-[11px] font-bold">
                        Problem
                    </span>
                );
        }
    };

    return (
        <section
            aria-labelledby="recently-solved-trends-heading"
            className="w-full max-w-full min-w-0 rounded-2xl bg-white border-2 border-black text-neutral-900 p-4 sm:p-6 lg:p-8 shadow-[4px_4px_0px_#000] relative overflow-hidden select-none font-sans space-y-6"
        >
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b-2 border-black/15 w-full min-w-0">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                        <ListOrdered className="w-5 h-5 text-black stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2
                                id="recently-solved-trends-heading"
                                className="text-xl sm:text-2xl font-black text-black tracking-tight"
                            >
                                Recently solved
                            </h2>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000] text-xs font-mono font-black text-black">
                                <Sparkles className="w-3 h-3 text-black" />
                                <span>{rawList.length} verified solves</span>
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-0.5">
                            Real-time problem logs with category difficulty, topic intelligence, and completion dates
                        </p>
                    </div>
                </div>

                {/* Filter Controls (Difficulty & Platform) */}
                {rawList.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto max-w-full min-w-0">
                        {/* Difficulty Filter Pills */}
                        <div className="inline-flex items-center p-1 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] max-w-full overflow-x-auto scrollbar-none">
                            {(["All", "Easy", "Medium", "Hard"] as const).map((diff) => (
                                <button
                                    key={diff}
                                    type="button"
                                    onClick={() => setDifficultyFilter(diff)}
                                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                                        difficultyFilter === diff
                                            ? "bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]"
                                            : "text-neutral-700 hover:text-black hover:bg-white/80"
                                    }`}
                                >
                                    {diff}
                                </button>
                            ))}
                        </div>

                        {/* Optional Platform Filter Pills (if > 1 platform connected) */}
                        {availablePlatforms.length > 1 && (
                            <div className="inline-flex items-center p-1 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] max-w-full overflow-x-auto scrollbar-none">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPortal("All")}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
                                        selectedPortal === "All"
                                            ? "bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]"
                                            : "text-neutral-700 hover:text-black"
                                    }`}
                                >
                                    All Portals
                                </button>
                                {availablePlatforms.map((portal) => (
                                    <button
                                        key={portal}
                                        type="button"
                                        onClick={() => setSelectedPortal(portal)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer capitalize shrink-0 ${
                                            selectedPortal === portal
                                                ? "bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        {portal}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Problem List Content */}
            <div className="min-h-[280px]">
                {isLoading && rawList.length === 0 ? (
                    /* Loading Skeleton */
                    <div className="space-y-3 pt-2">
                        {Array.from({ length: 8 }).map((_, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border-2 border-black/10 bg-[#FAF6EE]/50 animate-pulse"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-neutral-200 border border-black/20" />
                                    <div className="space-y-1.5">
                                        <div className="w-48 sm:w-72 h-4 bg-neutral-200 rounded" />
                                        <div className="w-24 h-3 bg-neutral-100 rounded" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-5 bg-neutral-200 rounded" />
                                    <div className="w-20 h-5 bg-neutral-200 rounded" />
                                    <div className="w-14 h-5 bg-neutral-100 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredList.length === 0 ? (
                    /* Empty State */
                    <div className="py-14 text-center max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black mx-auto">
                            <Filter className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <h4 className="text-base font-black text-black">
                            {rawList.length === 0 ? "No recently solved problems found" : "No problems match your filters"}
                        </h4>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                            {rawList.length === 0
                                ? "Solve coding problems on your connected competitive platforms (LeetCode, Codeforces, CodeChef, GeeksforGeeks, etc.) to see live activity appear here."
                                : "Try switching your difficulty or platform filter to view verified problem records."}
                        </p>
                    </div>
                ) : (
                    /* Solved Questions List */
                    <div className="space-y-2.5">
                        {displayedList.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleOpenProblem(item.url)}
                                className="group p-3 sm:p-3.5 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black/15 hover:border-black transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-[1px_1px_0px_#000] hover:shadow-[3px_3px_0px_#000] w-full min-w-0"
                                title={`Open ${item.title} on ${item.platformName}`}
                            >
                                {/* Left Section: Platform Icon + Problem Title */}
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 max-w-full">
                                    <div
                                        className="w-8 h-8 rounded-lg bg-white border-2 border-black shadow-[1px_1px_0px_#000] p-1.5 flex items-center justify-center shrink-0"
                                        title={item.platformName}
                                    >
                                        {getPortalIcon(item.portal, "w-full h-full object-contain")}
                                    </div>
                                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                        <span className="text-sm sm:text-base font-black text-black group-hover:underline transition-colors truncate">
                                            {item.title}
                                        </span>
                                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </div>
                                </div>

                                {/* Right Section: Dynamic Tags (Difficulty, Topic, Exact Date, Relative Time) */}
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap self-start md:self-auto pl-10 sm:pl-11 md:pl-0 max-w-full min-w-0">
                                    {/* 1. Category / Difficulty Badge */}
                                    {getDifficultyBadge(item.difficulty)}

                                    {/* 2. Topic of the Question */}
                                    {item.topic && (
                                        <span
                                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF6EE] text-black border border-black shadow-[1px_1px_0px_#000] text-[11px] font-bold truncate max-w-[140px]"
                                            title={`Topic: ${item.topic}`}
                                        >
                                            {item.topic}
                                        </span>
                                    )}

                                    {/* 3. Exact Date Badge */}
                                    <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-black border border-black shadow-[1px_1px_0px_#000] text-[11px] font-mono font-bold"
                                        title={`Exact solved date: ${formatDisplayDate(item)}`}
                                    >
                                        <Calendar className="w-3 h-3 text-neutral-600" />
                                        <span>{formatDisplayDate(item)}</span>
                                    </span>

                                    {/* 4. Relative Time Badge */}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000] text-[11px] font-mono font-black text-black whitespace-nowrap">
                                        {item.relativeTime}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Controls: Show More / Show Less Toggle */}
            {filteredList.length > 8 && (
                <div className="pt-2 flex justify-center border-t-2 border-black/10">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <span>
                            {isExpanded
                                ? "Show Less"
                                : `Show All Solves (${filteredList.length - 8} more)`}
                        </span>
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                        )}
                    </button>
                </div>
            )}
        </section>
    );
};

export default RecentlySolvedTrendsCard;
