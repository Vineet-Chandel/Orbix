import React, { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "../../store";
import { Sidebar } from "../Dashboard/Sidebar";
import { LeaderboardHeader } from "./LeaderboardHeader";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { LeaderboardTable } from "./LeaderboardTable";
import { LeaderboardPagination } from "./LeaderboardPagination";
import type { LeaderboardEntry, LeaderboardMetadata, LeaderboardResponse } from "./types";
import { Trophy, AlertCircle, Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export const LeaderboardPage: React.FC = () => {
    const { user } = useAppSelector((state) => state.user);
    const storedUsername = React.useMemo(() => {
        try {
            const raw = localStorage.getItem("orbix_user");
            return raw ? JSON.parse(raw)?.username || null : null;
        } catch {
            return null;
        }
    }, []);
    const currentUsername = user?.username || storedUsername || null;

    // State
    const [page, setPage] = useState<number>(1);
    const [limit] = useState<number>(20);
    const [period, setPeriod] = useState<string>("all_time");
    const [filter, setFilter] = useState<"all" | "verified">("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");

    const [podium, setPodium] = useState<LeaderboardEntry[]>([]);
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [metadata, setMetadata] = useState<LeaderboardMetadata | null>(null);
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Search input debouncer
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); // Reset to page 1 on search change
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset page to 1 when filter changes
    const handleFilterChange = (newFilter: "all" | "verified") => {
        setFilter(newFilter);
        setPage(1);
    };

    // Fetch Leaderboard data
    const fetchLeaderboard = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                period,
                filter,
            });
            if (debouncedSearch) {
                queryParams.set("search", debouncedSearch);
            }
            if (currentUsername) {
                queryParams.set("user", currentUsername);
            }

            const endpoints = [
                `/api/leaderboard?${queryParams.toString()}`,
                `http://localhost:3000/api/leaderboard?${queryParams.toString()}`,
            ];

            let res: Response | null = null;
            for (const url of endpoints) {
                try {
                    res = await fetch(url, { credentials: "include" });
                    if (res.ok) break;
                } catch {
                    // Try next fallback URL
                }
            }

            if (!res || !res.ok) {
                throw new Error(`Failed to load leaderboard (${res?.status || "network error"})`);
            }

            const data: LeaderboardResponse = await res.json();
            if (!data.success) {
                throw new Error("API returned failure response");
            }

            setMetadata(data.metadata);
            setPodium(data.podium || []);
            setEntries(data.entries || []);
            if (data.currentUser) {
                setCurrentUserRank(data.currentUser);
            } else if (currentUsername && data.entries) {
                const found = data.entries.find((e: LeaderboardEntry) => e.username?.toLowerCase() === currentUsername.toLowerCase())
                    || data.podium?.find((e: LeaderboardEntry) => e.username?.toLowerCase() === currentUsername.toLowerCase());
                if (found) {
                    setCurrentUserRank(found);
                } else {
                    setCurrentUserRank(null);
                }
            } else {
                setCurrentUserRank(null);
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch leaderboard data");
        } finally {
            setIsLoading(false);
        }
    }, [page, limit, period, filter, debouncedSearch, currentUsername]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    // Authorized Sync Now handler
    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            const endpoints = [
                "/api/leaderboard/sync",
                "http://localhost:3000/api/leaderboard/sync",
            ];
            let res: Response | null = null;
            for (const url of endpoints) {
                try {
                    res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    });
                    if (res.ok) break;
                } catch {
                    // Try fallback
                }
            }

            if (res && res.ok) {
                // Refresh leaderboard view after successful sync
                await fetchLeaderboard();
            } else {
                throw new Error("Sync failed or requires authentication");
            }
        } catch (err: any) {
            console.warn("Sync error:", err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#080B10] text-neutral-100 overflow-hidden font-sans selection:bg-amber-500/30 selection:text-white">
            {/* Desktop & Mobile Collapsible Navigation Sidebar */}
            <Sidebar activeTab="leaderboard" />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto min-w-0">
                <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 flex-1">
                    {/* Header Controls */}
                    <LeaderboardHeader
                        metadata={metadata}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        filter={filter}
                        onFilterChange={handleFilterChange}
                        period={period}
                        onPeriodChange={setPeriod}
                        onSyncNow={handleSyncNow}
                        isSyncing={isSyncing}
                    />

                    {/* Error Banner */}
                    {error && (
                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                <span>{error}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchLeaderboard()}
                                className="font-bold underline text-rose-200 hover:text-white"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Current User Rank Strip (if authenticated) */}
                    {currentUserRank && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900/80 to-neutral-900 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-mono font-black text-amber-400 text-sm">
                                    #{currentUserRank.rank}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Your Ranking</span>
                                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                            Active
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-base font-black text-white">{currentUserRank.displayName}</span>
                                        <span className="text-xs font-mono text-neutral-400">@{currentUserRank.username}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 self-end sm:self-auto">
                                <div className="text-right">
                                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Your Orbix Score</span>
                                    <span className="text-xl font-mono font-black text-amber-400">{currentUserRank.score.toLocaleString()}</span>
                                </div>
                                <Link
                                    to={`/u/${currentUserRank.username}`}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition-colors"
                                >
                                    <span>View Profile</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Top-Three Podium (Visible on Page 1 when not actively searching) */}
                    {page === 1 && !debouncedSearch && podium.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                                    Podium Leaders
                                </h2>
                            </div>
                            <LeaderboardPodium podium={podium} />
                        </div>
                    )}

                    {/* Full Ranking Table */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-neutral-400" />
                                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                                    Global Standings
                                </h2>
                            </div>
                        </div>

                        <LeaderboardTable
                            entries={entries}
                            currentUsername={currentUsername}
                            isLoading={isLoading}
                        />

                        {/* Pagination Bar */}
                        <LeaderboardPagination
                            currentPage={page}
                            totalPages={metadata?.totalPages ?? 1}
                            totalCoders={metadata?.totalCoders ?? 0}
                            pageSize={limit}
                            onPageChange={(p) => setPage(p)}
                            isLoading={isLoading}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default LeaderboardPage;
