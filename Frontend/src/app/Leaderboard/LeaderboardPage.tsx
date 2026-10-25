import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSelector } from "../../store";
import { Sidebar } from "../Dashboard/Sidebar";
import { LeaderboardHeader } from "./LeaderboardHeader";
import { CollegeSelector } from "./CollegeSelector";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { LeaderboardTable } from "./LeaderboardTable";
import { LeaderboardPagination } from "./LeaderboardPagination";
import { AlgorithmModal } from "./AlgorithmModal";
import type {
    LeaderboardEntry,
    LeaderboardMetadata,
    LeaderboardResponse,
    CollegeLeaderboardResponse,
    ParticipatingCollege,
} from "./types";
import { Trophy, AlertCircle, Sparkles, ArrowUpRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";

export const LeaderboardPage: React.FC = () => {
    const { user } = useAppSelector((state) => state.user);
    const storedUsername = useMemo(() => {
        try {
            const raw = localStorage.getItem("orbix_user");
            return raw ? JSON.parse(raw)?.username || null : null;
        } catch {
            return null;
        }
    }, []);
    const currentUsername = user?.username || storedUsername || null;

    // Mobile Sidebar
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Active Navigation Tab: "global" | "college"
    const [activeTab, setActiveTab] = useState<"global" | "college">("global");
    const [isAlgorithmModalOpen, setIsAlgorithmModalOpen] = useState<boolean>(false);

    // Participating Colleges State
    const [participatingColleges, setParticipatingColleges] = useState<ParticipatingCollege[]>([]);
    const [collegesRepresentedCount, setCollegesRepresentedCount] = useState<number>(0);
    const [selectedCollege, setSelectedCollege] = useState<ParticipatingCollege | null>(null);

    // Pagination & Filters State
    const [page, setPage] = useState<number>(1);
    const [limit] = useState<number>(20);
    const [period, setPeriod] = useState<string>("all_time");
    const [filter, setFilter] = useState<"all" | "verified">("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");

    // Leaderboard Data State
    const [podium, setPodium] = useState<LeaderboardEntry[]>([]);
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [metadata, setMetadata] = useState<LeaderboardMetadata | null>(null);
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null);
    const [selectedCollegeMeta, setSelectedCollegeMeta] = useState<{
        id: string;
        name: string;
        code?: string | null;
        city?: string | null;
        country?: string | null;
        totalStudents?: number;
    } | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // -------------------------------------------------------------------------
    // 1. Initial Load: Fetch Participating Colleges & Auto-Detect User College
    // -------------------------------------------------------------------------
    useEffect(() => {
        let isMounted = true;
        const fetchParticipating = async () => {
            try {
                const endpoints = [
                    "/api/leaderboard/colleges/participating",
                    "http://localhost:3000/api/leaderboard/colleges/participating",
                ];
                let res: Response | null = null;
                for (const url of endpoints) {
                    try {
                        res = await fetch(url, { credentials: "include" });
                        if (res.ok) break;
                    } catch {
                        // try fallback
                    }
                }

                if (res && res.ok && isMounted) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.colleges)) {
                        setParticipatingColleges(data.colleges);
                        setCollegesRepresentedCount(data.count ?? data.colleges.length);

                        // Auto-detect user's assigned college ONLY if user actually has one
                        const userCollegeId = user?.collegeId || user?.college?.id;
                        let matchedCollege: ParticipatingCollege | null = null;

                        if (userCollegeId) {
                            matchedCollege = data.colleges.find((c: ParticipatingCollege) => c.id === userCollegeId) || null;
                        }
                        // Also try matching by name if ID was mismatched
                        if (!matchedCollege && (user?.college || (user as any)?.collegeName)) {
                            const targetName = typeof user?.college === "string" ? user.college : (user?.college?.officialName || (user as any)?.collegeName);
                            if (targetName) {
                                matchedCollege = data.colleges.find((c: ParticipatingCollege) =>
                                    (c.officialName && c.officialName.toLowerCase() === String(targetName).toLowerCase()) ||
                                    (c.name && c.name.toLowerCase() === String(targetName).toLowerCase())
                                ) || null;
                            }
                        }
                        if (!matchedCollege && userCollegeId && user?.college) {
                            matchedCollege = {
                                id: userCollegeId,
                                name: typeof user.college === "string" ? user.college : (user.college.officialName || "My College"),
                                officialName: typeof user.college === "string" ? user.college : (user.college.officialName || "My College"),
                                city: typeof user.college === "object" ? user.college.city ?? null : null,
                                studentCount: 1,
                            };
                        }

                        // NOTE: If the user does not have a college assigned, DO NOT force
                        // them to default to any college. Keep selectedCollege as null.
                        setSelectedCollege(matchedCollege);
                    }
                }
            } catch (err) {
                console.warn("Could not load participating colleges:", err);
            }
        };

        fetchParticipating();
        return () => {
            isMounted = false;
        };
    }, [user?.collegeId, user?.college]);

    // -------------------------------------------------------------------------
    // 2. Debounce Search Input
    // -------------------------------------------------------------------------
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); // Reset to page 1 on search change
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // -------------------------------------------------------------------------
    // 3. Tab & Filter Handlers
    // -------------------------------------------------------------------------
    const handleTabChange = (tab: "global" | "college") => {
        setActiveTab(tab);
        setPage(1);
        setSearchQuery("");
        setDebouncedSearch("");
    };

    const handleSelectCollege = (college: ParticipatingCollege) => {
        setSelectedCollege(college);
        setPage(1);
        setSearchQuery("");
        setDebouncedSearch("");
    };

    const handleFilterChange = (newFilter: "all" | "verified") => {
        setFilter(newFilter);
        setPage(1);
    };

    // -------------------------------------------------------------------------
    // 4. Fetch Leaderboard (Global or College League)
    // -------------------------------------------------------------------------
    const fetchLeaderboard = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                period,
            });

            if (filter === "verified" && activeTab === "global") {
                queryParams.set("filter", "verified");
            }
            if (debouncedSearch) {
                queryParams.set("search", debouncedSearch);
            }
            if (currentUsername) {
                queryParams.set("user", currentUsername);
            }

            let endpointPath = "";
            if (activeTab === "global") {
                endpointPath = `/api/leaderboard/global?${queryParams.toString()}`;
            } else {
                if (!selectedCollege?.id) {
                    setPodium([]);
                    setEntries([]);
                    setMetadata(null);
                    setCurrentUserRank(null);
                    setSelectedCollegeMeta(null);
                    setIsLoading(false);
                    return;
                }
                endpointPath = `/api/leaderboard/colleges/${encodeURIComponent(selectedCollege.id)}?${queryParams.toString()}`;
            }

            const endpoints = [
                endpointPath,
                `http://localhost:3000${endpointPath}`,
            ];

            let res: Response | null = null;
            for (const url of endpoints) {
                try {
                    res = await fetch(url, { credentials: "include" });
                    if (res.ok) break;
                } catch {
                    // try fallback
                }
            }

            if (!res || !res.ok) {
                throw new Error(`Failed to load ${activeTab === "college" ? "College League" : "Global"} leaderboard (${res?.status || "network error"})`);
            }

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "API returned failure response");
            }

            if (activeTab === "global") {
                const globalData = data as LeaderboardResponse;
                setMetadata(globalData.metadata);
                setPodium(globalData.podium || []);
                setEntries(globalData.entries || []);
                if (globalData.collegesRepresentedCount !== undefined) {
                    setCollegesRepresentedCount(globalData.collegesRepresentedCount);
                }

                if (globalData.currentUser) {
                    setCurrentUserRank(globalData.currentUser);
                } else if (currentUsername && globalData.entries) {
                    const found =
                        globalData.entries.find((e: LeaderboardEntry) => e.username?.toLowerCase() === currentUsername.toLowerCase()) ||
                        globalData.podium?.find((e: LeaderboardEntry) => e.username?.toLowerCase() === currentUsername.toLowerCase());
                    setCurrentUserRank(found || null);
                } else {
                    setCurrentUserRank(null);
                }
                setSelectedCollegeMeta(null);
            } else {
                const collegeData = data as CollegeLeaderboardResponse;
                setMetadata(collegeData.metadata);
                setPodium(collegeData.podium || []);
                setEntries(collegeData.entries || []);
                if (collegeData.collegesRepresentedCount !== undefined) {
                    setCollegesRepresentedCount(collegeData.collegesRepresentedCount);
                }

                setSelectedCollegeMeta({
                    id: collegeData.college.id,
                    name: collegeData.college.name,
                    code: collegeData.college.code,
                    city: collegeData.college.city,
                    country: collegeData.college.country,
                    totalStudents: collegeData.totalStudents,
                });

                if (collegeData.currentUser) {
                    setCurrentUserRank(collegeData.currentUser);
                } else if (currentUsername && collegeData.entries) {
                    const found =
                        collegeData.entries.find((e: LeaderboardEntry) => e.username?.toLowerCase() === currentUsername.toLowerCase()) ||
                        collegeData.podium?.find((e: LeaderboardEntry) => e.username?.toLowerCase() === currentUsername.toLowerCase());
                    setCurrentUserRank(found || null);
                } else {
                    setCurrentUserRank(null);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch leaderboard data");
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, selectedCollege?.id, page, limit, period, filter, debouncedSearch, currentUsername]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    // -------------------------------------------------------------------------
    // 5. Authorized Sync Now Handler
    // -------------------------------------------------------------------------
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

    // User's college info
    const userCollegeId = user?.collegeId || user?.college?.id || null;
    const userCollegeName = user?.college?.officialName || null;
    const isUserEnrolledInSelectedCollege = Boolean(
        selectedCollege?.id &&
        userCollegeId &&
        userCollegeId === selectedCollege.id
    );

    return (
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Desktop & Mobile Collapsible Navigation Sidebar */}
            <Sidebar
                activeTab="leaderboard"
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto min-w-0 p-2 sm:p-3 lg:py-3 lg:pr-3 lg:pl-2">
                <section
                    aria-label="Global Leaderboard & College League"
                    className="flex-1 w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                        {/* ========================================================================= */}
                        {/* HEADER: Tabs, Prominent Colleges Counter, Search, Period & Sync */}
                        {/* ========================================================================= */}
                        <LeaderboardHeader
                            metadata={metadata}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            collegesRepresentedCount={collegesRepresentedCount}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            filter={filter}
                            onFilterChange={handleFilterChange}
                            period={period}
                            onPeriodChange={setPeriod}
                            onSyncNow={handleSyncNow}
                            isSyncing={isSyncing}
                            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                            onCounterClick={() => handleTabChange("college")}
                            onOpenAlgorithm={() => setIsAlgorithmModalOpen(true)}
                        />

                        {/* ========================================================================= */}
                        {/* COLLEGE LEAGUE CONTROLS: Autocomplete Selector */}
                        {/* ========================================================================= */}
                        {activeTab === "college" && (
                            <div className="space-y-4">
                                <CollegeSelector
                                    selectedCollege={selectedCollege}
                                    onSelectCollege={handleSelectCollege}
                                    participatingColleges={participatingColleges}
                                    collegesRepresentedCount={collegesRepresentedCount}
                                    userCollegeId={userCollegeId}
                                    userCollegeName={userCollegeName}
                                    isLoading={isLoading}
                                    onCounterClick={() => {}}
                                />
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* ERROR BANNER */}
                        {/* ========================================================================= */}
                        {error && (
                            <div className="p-4 rounded-xl bg-rose-50 border-2 border-black text-xs text-rose-950 flex items-center justify-between shadow-[3px_3px_0px_#000]">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 stroke-[2.5]" />
                                    <span className="font-extrabold">{error}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fetchLeaderboard()}
                                    className="px-3 py-1 rounded bg-black text-white font-black text-xs border border-black hover:bg-neutral-800 transition-all cursor-pointer shadow-[1px_1px_0px_#000]"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* GLOBAL LEADERBOARD: CURRENT USER RANKING STRIP */}
                        {/* ========================================================================= */}
                        {activeTab === "global" && currentUserRank && (
                            <div className="p-4 sm:p-5 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center font-mono font-black text-black text-lg">
                                        #{currentUserRank.rank}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">
                                                Your Global Rank
                                            </span>
                                            <span className="text-[10px] font-mono font-black text-black bg-[#FFE566] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                                                Active
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2 mt-0.5">
                                            <span className="text-base font-black text-black">{currentUserRank.displayName}</span>
                                            <span className="text-xs font-mono font-bold text-neutral-500">@{currentUserRank.username}</span>
                                        </div>
                                        {currentUserRank.college && (
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-600 mt-0.5">
                                                <Building2 className="w-3 h-3 text-neutral-500" />
                                                <span className="truncate max-w-[240px] sm:max-w-[360px]">{currentUserRank.college}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-5 self-end sm:self-auto">
                                    <div className="text-right">
                                        <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider block">
                                            Orbix Score
                                        </span>
                                        <span className="text-2xl font-mono font-black text-black">
                                            {currentUserRank.score.toLocaleString()}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/profile/u/${encodeURIComponent(currentUserRank.username)}`}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-xs font-black text-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                                    >
                                        <span>View Profile</span>
                                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* COLLEGE LEAGUE: USER ENROLLED IN SELECTED COLLEGE STRIP */}
                        {/* ========================================================================= */}
                        {activeTab === "college" && isUserEnrolledInSelectedCollege && currentUserRank?.collegeRank && (
                            <div className="p-4 sm:p-5 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center font-mono font-black text-black text-lg">
                                        #{currentUserRank.collegeRank}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">
                                                Your College Rank
                                            </span>
                                            <span className="text-[10px] font-mono font-black text-black bg-[#FFE566] px-1.5 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                                                {selectedCollege?.officialName}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2 mt-0.5">
                                            <span className="text-base font-black text-black">{currentUserRank.displayName}</span>
                                            <span className="text-xs font-mono font-bold text-neutral-500">@{currentUserRank.username}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5 self-end sm:self-auto">
                                    <div className="text-right">
                                        <span className="text-[10px] text-neutral-500 font-black uppercase tracking-wider block">
                                            Orbix Score
                                        </span>
                                        <span className="text-2xl font-mono font-black text-black">
                                            {currentUserRank.score.toLocaleString()}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/profile/u/${encodeURIComponent(currentUserRank.username)}`}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-xs font-black text-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                                    >
                                        <span>View Profile</span>
                                        <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* COLLEGE LEAGUE: PROMPT TO LINK COLLEGE IF USER HAS NONE */}
                        {/* ========================================================================= */}
                        {activeTab === "college" && !userCollegeId && (
                            <div className="p-4 sm:p-5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-black shrink-0 shadow-[1px_1px_0px_#000]">
                                        <Building2 className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs sm:text-sm font-black text-black">
                                            You haven't linked a college to your profile yet
                                        </h3>
                                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                            Select any institution above to explore its campus standings, or link your college in your profile to represent your university.
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    to="/profile"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
                                >
                                    <span>Link College in Profile</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                </Link>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* COLLEGE LEAGUE: USER HAS A DIFFERENT COLLEGE, VIEWING ANOTHER */}
                        {/* ========================================================================= */}
                        {activeTab === "college" && userCollegeId && selectedCollege && !isUserEnrolledInSelectedCollege && (
                            <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                <span className="font-bold text-neutral-700">
                                    Viewing <strong className="text-black">{selectedCollege.officialName}</strong> standings. Your enrolled campus is <strong className="text-black">{userCollegeName || "your college"}</strong>.
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const myCol = participatingColleges.find((c) => c.id === userCollegeId);
                                        if (myCol) {
                                            setSelectedCollege(myCol);
                                        } else if (user?.college) {
                                            setSelectedCollege({
                                                id: userCollegeId,
                                                officialName: user.college.officialName,
                                                city: user.college.city ?? null,
                                            });
                                        }
                                    }}
                                    className="px-3.5 py-1.5 rounded-lg bg-black text-white text-xs font-black border-2 border-black hover:bg-neutral-800 transition-all shadow-[1px_1px_0px_#000] whitespace-nowrap cursor-pointer self-start sm:self-auto"
                                >
                                    Switch to My Campus Standings →
                                </button>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* COLLEGE LEAGUE: NO COLLEGE SELECTED EMPTY STATE */}
                        {/* ========================================================================= */}
                        {activeTab === "college" && !selectedCollege ? (
                            <div className="w-full rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-10 sm:p-14 text-center space-y-3">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                    <Building2 className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1.5 max-w-md mx-auto">
                                    <h3 className="text-base sm:text-lg font-black text-black">
                                        Choose an Institution to View Standings
                                    </h3>
                                    <p className="text-xs font-medium text-neutral-600">
                                        Use the searchable institution selector above to browse rankings across 38,400+ colleges or view participating campuses.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* TOP-3 PODIUM: Visible on Page 1 when not actively filtering by search */}
                                {page === 1 && !debouncedSearch && podium.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                                                <h2 className="text-xs font-black uppercase tracking-wider text-black">
                                                    {activeTab === "college"
                                                        ? `${selectedCollegeMeta?.name || selectedCollege?.officialName || "College"} Podium Leaders`
                                                        : "Global Podium Leaders"}
                                                </h2>
                                            </div>
                                            <span className="text-[11px] font-mono font-bold text-neutral-600">
                                                Top 3 Ranked
                                            </span>
                                        </div>
                                        <LeaderboardPodium
                                            podium={podium}
                                            scope={activeTab}
                                        />
                                    </div>
                                )}

                                {/* RANKING TABLE SECTION */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Trophy className="w-4 h-4 text-black stroke-[2.5]" />
                                            <h2 className="text-xs font-black uppercase tracking-wider text-black">
                                                {activeTab === "college"
                                                    ? `${selectedCollegeMeta?.name || selectedCollege?.officialName || "College"} Standings`
                                                    : "Global Standings"}
                                            </h2>
                                        </div>
                                        <span className="text-xs font-bold text-neutral-600">
                                            Deterministic tie-breaking: Score → Solved → Alphabetical
                                        </span>
                                    </div>

                                    {/* Full Table */}
                                    <LeaderboardTable
                                        entries={entries}
                                        currentUsername={currentUsername}
                                        isLoading={isLoading}
                                        scope={activeTab}
                                        selectedCollegeName={selectedCollegeMeta?.name || selectedCollege?.officialName || selectedCollege?.name}
                                        onOpenAlgorithm={() => setIsAlgorithmModalOpen(true)}
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
                            </>
                        )}
                    </div>

                    {/* ========================================================================= */}
                    {/* BOTTOM FULL-WIDTH DESK ILLUSTRATION (Matching Connected Platforms & Resume) */}
                    {/* ========================================================================= */}
                    <div className="w-full mt-auto select-none pointer-events-none overflow-hidden rounded-b-[14px]">
                        <img
                            src="/image.png"
                            alt="Leaderboard workspace illustration"
                            className="w-full h-auto object-cover object-bottom block rounded-b-[14px]"
                            loading="eager"
                        />
                    </div>
                </section>
            </div>

            {/* Authoritative Orbix Score Algorithm & Platform Capability Modal */}
            <AlgorithmModal
                isOpen={isAlgorithmModalOpen}
                onClose={() => setIsAlgorithmModalOpen(false)}
            />
        </div>
    );
};

export default LeaderboardPage;
