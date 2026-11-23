import React, { useState, useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    setActiveTab,
    setSelectedCollege,
    setPage,
    setSearchQuery,
    setDebouncedSearch,
    setFilter,
    fetchGlobalLeaderboard,
    fetchCollegeLeaderboard,
    fetchParticipatingColleges,
    syncLeaderboardNow,
    getGlobalCacheKey,
    getCollegeCacheKey,
} from "../../store/leaderboardSlice";
import { useToast } from "../../context/ToastContext";
import { Sidebar } from "../Dashboard/Sidebar";
import { LeaderboardVerificationPrompt } from "./LeaderboardVerificationPrompt";
import { LeaderboardHeader } from "./LeaderboardHeader";
import { CollegeSelector } from "./CollegeSelector";
import { LeaderboardPodium } from "./LeaderboardPodium";
import { LeaderboardTable } from "./LeaderboardTable";
import { LeaderboardPagination } from "./LeaderboardPagination";
import { AlgorithmModal } from "./AlgorithmModal";
import type { ParticipatingCollege } from "./types";
import { Trophy, Sparkles, ArrowUpRight, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";

export const LeaderboardPage: React.FC = () => {
    const toast = useToast();
    const dispatch = useAppDispatch();

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

    // Mobile Sidebar & Algorithm Modal (Local UI state)
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isAlgorithmModalOpen, setIsAlgorithmModalOpen] = useState<boolean>(false);

    // Redux Leaderboard State & Caching
    const {
        activeTab,
        selectedCollege,
        page,
        limit,
        period,
        filter,
        searchQuery,
        debouncedSearch,
        globalCache,
        collegeCache,
        participatingColleges,
        collegesRepresentedCount,
        isGlobalLoading,
        isCollegeLoading,
        isSyncing,
    } = useAppSelector((state) => state.leaderboard);

    // -------------------------------------------------------------------------
    // 1. Instant Cache Resolution for Active Tab & View
    // -------------------------------------------------------------------------
    const globalKey = useMemo(
        () => getGlobalCacheKey(page, limit, period, filter, debouncedSearch, currentUsername),
        [page, limit, period, filter, debouncedSearch, currentUsername]
    );

    const collegeKey = useMemo(
        () =>
            selectedCollege?.id
                ? getCollegeCacheKey(selectedCollege.id, page, limit, period, filter, debouncedSearch, currentUsername)
                : "",
        [selectedCollege?.id, page, limit, period, filter, debouncedSearch, currentUsername]
    );

    // When toggling tabs, activeData is read synchronously from Redux cache with 0ms latency
    const activeData = activeTab === "global" ? globalCache[globalKey] : (collegeKey ? collegeCache[collegeKey] : null);

    const podium = activeData?.podium || [];
    const entries = activeData?.entries || [];
    const metadata = activeData?.metadata || null;
    const currentUserRank = activeData?.currentUser || null;
    const selectedCollegeMeta = activeData?.collegeMeta || null;

    // Non-blocking loading: Only show skeleton if we have NO cached data to display
    const isLoading = activeTab === "global"
        ? isGlobalLoading && !activeData
        : isCollegeLoading && !activeData;

    // -------------------------------------------------------------------------
    // 2. Initial Load: Fetch Participating Colleges & Auto-Detect User College
    // -------------------------------------------------------------------------
    useEffect(() => {
        dispatch(fetchParticipatingColleges());
    }, [dispatch]);

    useEffect(() => {
        if (selectedCollege) return;
        const userCollegeId = user?.collegeId || user?.college?.id;
        if (!userCollegeId && !user?.college) return;

        let matchedCollege: ParticipatingCollege | null = null;
        if (userCollegeId && participatingColleges.length > 0) {
            matchedCollege = participatingColleges.find((c) => c.id === userCollegeId) || null;
        }
        if (!matchedCollege && (user?.college || (user as any)?.collegeName) && participatingColleges.length > 0) {
            const targetName = typeof user?.college === "string" ? user.college : (user?.college?.officialName || (user as any)?.collegeName);
            if (targetName) {
                matchedCollege = participatingColleges.find((c) =>
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
        if (matchedCollege) {
            dispatch(setSelectedCollege(matchedCollege));
        }
    }, [user?.collegeId, user?.college, participatingColleges, selectedCollege, dispatch]);

    // -------------------------------------------------------------------------
    // 3. Debounce Search Input
    // -------------------------------------------------------------------------
    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch(setDebouncedSearch(searchQuery));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, dispatch]);

    // -------------------------------------------------------------------------
    // 4. Fetch Leaderboard via Redux (Cached & Stale-While-Revalidate)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (activeTab === "global") {
            dispatch(
                fetchGlobalLeaderboard({
                    page,
                    limit,
                    period,
                    filter,
                    search: debouncedSearch,
                    user: currentUsername,
                })
            );
        } else if (activeTab === "college" && selectedCollege?.id) {
            dispatch(
                fetchCollegeLeaderboard({
                    collegeId: selectedCollege.id,
                    page,
                    limit,
                    period,
                    filter,
                    search: debouncedSearch,
                    user: currentUsername,
                })
            );
        }
    }, [activeTab, selectedCollege?.id, page, limit, period, filter, debouncedSearch, currentUsername, dispatch]);

    // -------------------------------------------------------------------------
    // 5. Navigation & Filter Handlers
    // -------------------------------------------------------------------------
    const handleTabChange = (tab: "global" | "college") => {
        dispatch(setActiveTab(tab));
    };

    const handleSelectCollege = (college: ParticipatingCollege) => {
        dispatch(setSelectedCollege(college));
    };

    const handleFilterChange = (newFilter: "all" | "verified") => {
        dispatch(setFilter(newFilter));
    };

    const handlePageChange = (newPage: number) => {
        dispatch(setPage(newPage));
    };

    // -------------------------------------------------------------------------
    // 6. Authorized Sync Now Handler (Server Recompute + Cache Invalidation)
    // -------------------------------------------------------------------------
    const handleSyncNow = async () => {
        try {
            await dispatch(syncLeaderboardNow()).unwrap();
            toast.success("Leaderboard synced successfully.", { title: "Synced" });
            if (activeTab === "global") {
                dispatch(
                    fetchGlobalLeaderboard({
                        page,
                        limit,
                        period,
                        filter,
                        search: debouncedSearch,
                        user: currentUsername,
                        forceRefresh: true,
                    })
                );
            } else if (selectedCollege?.id) {
                dispatch(
                    fetchCollegeLeaderboard({
                        collegeId: selectedCollege.id,
                        page,
                        limit,
                        period,
                        filter,
                        search: debouncedSearch,
                        user: currentUsername,
                        forceRefresh: true,
                    })
                );
            }
        } catch (err: any) {
            toast.error(err || "Failed to sync leaderboard.", { title: "Sync Failed" });
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
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:p-3">
                <section
                    aria-label="Global Leaderboard & College League"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                        {/* ========================================================================= */}
                        {/* HEADER: Search Bar on Left, Tabs on Right, Sync & Algorithm */}
                        {/* ========================================================================= */}
                        <LeaderboardHeader
                            metadata={metadata}
                            activeTab={activeTab}
                            onTabChange={handleTabChange}
                            collegesRepresentedCount={collegesRepresentedCount}
                            searchQuery={searchQuery}
                            onSearchChange={(q) => dispatch(setSearchQuery(q))}
                            filter={filter}
                            onFilterChange={handleFilterChange}
                            period={period}
                            onPeriodChange={() => {}}
                            onSyncNow={handleSyncNow}
                            isSyncing={isSyncing}
                            onCounterClick={() => handleTabChange("college")}
                            onOpenAlgorithm={() => setIsAlgorithmModalOpen(true)}
                        />

                        {user && <LeaderboardVerificationPrompt key={user.id || currentUsername} onVerified={handleSyncNow} />}

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
                                            dispatch(setSelectedCollege(myCol));
                                        } else if (user?.college) {
                                            dispatch(
                                                setSelectedCollege({
                                                    id: userCollegeId,
                                                    officialName: user.college.officialName,
                                                    city: user.college.city ?? null,
                                                })
                                            );
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
                                    <div className="space-y-4 pt-2 pb-6">
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
                                <div className="space-y-4 pt-6 sm:pt-8 border-t-2 border-black/15">
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
                                        onPageChange={handlePageChange}
                                        isLoading={isLoading}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bottom Full-Width Illustration */}
                    <SectionBottomIllustration alt="Leaderboard workspace illustration" />
                </section>
            </div>

            {/* Authoritative Orbix Score Algorithm Modal */}
            <AlgorithmModal
                isOpen={isAlgorithmModalOpen}
                onClose={() => setIsAlgorithmModalOpen(false)}
            />
        </div>
    );
};

export default LeaderboardPage;
