import React from "react";
import { RefreshCw, Search, ShieldCheck, Users, Building2, Globe, Cpu } from "lucide-react";
import type { LeaderboardMetadata } from "./types";

interface LeaderboardHeaderProps {
    metadata?: LeaderboardMetadata | null;
    activeTab: "global" | "college";
    onTabChange: (tab: "global" | "college") => void;
    collegesRepresentedCount: number;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    filter: "all" | "verified";
    onFilterChange: (f: "all" | "verified") => void;
    period: string;
    onPeriodChange: (p: string) => void;
    onSyncNow: () => void;
    isSyncing: boolean;
    onOpenMobileSidebar?: () => void;
    onCounterClick?: () => void;
    onOpenAlgorithm?: () => void;
}

export const LeaderboardHeader: React.FC<LeaderboardHeaderProps> = ({
    metadata,
    activeTab,
    onTabChange,
    collegesRepresentedCount,
    searchQuery,
    onSearchChange,
    filter,
    onFilterChange,
    period: _period,
    onPeriodChange: _onPeriodChange,
    onSyncNow,
    isSyncing,
    onOpenMobileSidebar,
    onCounterClick,
    onOpenAlgorithm,
}) => {
    const totalCoders = metadata?.totalCoders ?? 0;
    const formattedLastUpdated = metadata?.lastUpdated
        ? new Date(metadata.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Just now";

    return (
        <div className="space-y-6">
            {/* Top Bar: Title, Badges & Actions */}
            <div className="pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    {onOpenMobileSidebar && (
                        <button
                            type="button"
                            onClick={onOpenMobileSidebar}
                            className="lg:hidden mt-0.5 p-2 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex-shrink-0"
                            aria-label="Open sidebar"
                        >
                            <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                    )}
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-black">
                                {activeTab === "global" ? "Global Ranking" : "College League"}
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 max-w-2xl leading-relaxed">
                            Ranked by <strong className="text-black font-black">Orbix Score</strong>, a unified measure of problem-solving performance, rated contest participation, coding consistency, and supported developer contributions.
                        </p>
                    </div>
                </div>

                {/* Top Action Buttons: Algorithm & Sync Now */}
                <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
                    {onOpenAlgorithm && (
                        <button
                            type="button"
                            onClick={onOpenAlgorithm}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black uppercase text-black transition-all shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                            title="Inspect Orbix Score Engine specification, pillars, and platform capability matrix"
                        >
                            <Cpu className="w-3.5 h-3.5 stroke-[2.5] text-black" />
                            <span>Algorithm</span>
                        </button>
                    )}

                    {/* Sync Now Button */}
                    <button
                        type="button"
                        onClick={onSyncNow}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#86ef6c] border-2 border-black text-xs font-black uppercase text-black transition-all shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 cursor-pointer"
                        title="Recalculate your Orbix Score from connected platforms"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isSyncing ? "animate-spin text-black" : "text-black"}`} />
                        <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                    </button>
                </div>
            </div>

            {/* Primary Navigation Tabs: Global Leaderboard vs College League */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="inline-flex items-center p-1.5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] self-start">
                    <button
                        type="button"
                        onClick={() => onTabChange("global")}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                            activeTab === "global"
                                ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE]"
                        }`}
                    >
                        <Globe className="w-4 h-4 stroke-[2.5]" />
                        <span>Global Leaderboard</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onTabChange("college")}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                            activeTab === "college"
                                ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE]"
                        }`}
                    >
                        <Building2 className="w-4 h-4 stroke-[2.5]" />
                        <span>College League</span>
                    </button>
                </div>

                {/* Participating Colleges Counter Badge */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCounterClick || (() => onTabChange("college"))}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                        title="Click to explore participating colleges"
                    >
                        <Building2 className="w-4 h-4 stroke-[2.5] text-black" />
                        <span className="uppercase tracking-tight">Colleges Represented</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#a2ff86] border border-black font-mono font-black text-black text-xs shadow-[1px_1px_0px_#000]">
                            {String(collegesRepresentedCount).padStart(2, "0")}
                        </span>
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                {/* Search Box */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 stroke-[2.5] pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={activeTab === "global" ? "Search coder, handle, or college..." : "Search coder in this college..."}
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white transition-colors"
                    />
                </div>

                {/* Filter and Metadata Pills */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-black shadow-[1px_1px_0px_#000]">
                        <button
                            type="button"
                            onClick={() => onFilterChange("all")}
                            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                filter === "all"
                                    ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            All Coders
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterChange("verified")}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                filter === "verified"
                                    ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Verified</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-600">
                        <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{totalCoders} {totalCoders === 1 ? "Coder" : "Coders"}</span>
                        <span>•</span>
                        <span>Updated {formattedLastUpdated}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
