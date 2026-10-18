import React from "react";
import { Trophy, RefreshCw, Search, ShieldCheck, Users, Calendar } from "lucide-react";
import type { LeaderboardMetadata } from "./types";

interface LeaderboardHeaderProps {
    metadata?: LeaderboardMetadata | null;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    filter: "all" | "verified";
    onFilterChange: (f: "all" | "verified") => void;
    period: string;
    onPeriodChange: (p: string) => void;
    onSyncNow: () => void;
    isSyncing: boolean;
}

export const LeaderboardHeader: React.FC<LeaderboardHeaderProps> = ({
    metadata,
    searchQuery,
    onSearchChange,
    filter,
    onFilterChange,
    period,
    onPeriodChange,
    onSyncNow,
    isSyncing,
}) => {
    const totalCoders = metadata?.totalCoders ?? 0;
    const formattedLastUpdated = metadata?.lastUpdated
        ? new Date(metadata.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "Just now";

    return (
        <div className="space-y-6">
            {/* Top Bar: Title & Primary Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            Global Ranking
                        </h1>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Live
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
                        Ranked by <strong className="text-white font-semibold">Orbix Score</strong>, a unified measure of problem-solving performance, rated contest participation, coding consistency, and supported developer contributions.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 self-start md:self-auto">
                    {/* Time Range Selector */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
                        <button
                            type="button"
                            onClick={() => onPeriodChange("all_time")}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                period === "all_time"
                                    ? "bg-white text-black shadow-xs"
                                    : "text-neutral-400 hover:text-white"
                            }`}
                        >
                            All Time
                        </button>
                    </div>

                    {/* Sync Now Button */}
                    <button
                        type="button"
                        onClick={onSyncNow}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-amber-400" : "text-neutral-400"}`} />
                        <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 backdrop-blur-sm">
                {/* Search Box */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search coder, handle, or college..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600 transition-colors"
                    />
                </div>

                {/* Filter and Metadata Pills */}
                <div className="flex items-center gap-3">
                    <div className="inline-flex items-center p-0.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs">
                        <button
                            type="button"
                            onClick={() => onFilterChange("all")}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                filter === "all"
                                    ? "bg-neutral-800 text-white shadow-2xs"
                                    : "text-neutral-400 hover:text-white"
                            }`}
                        >
                            All Coders
                        </button>
                        <button
                            type="button"
                            onClick={() => onFilterChange("verified")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                filter === "verified"
                                    ? "bg-neutral-800 text-white shadow-2xs"
                                    : "text-neutral-400 hover:text-white"
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                            <span>Verified</span>
                        </button>
                    </div>

                    <div className="hidden lg:flex items-center gap-3 text-xs text-neutral-400 border-l border-neutral-800 pl-3">
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{totalCoders.toLocaleString()} Coders</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Updated {formattedLastUpdated}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
