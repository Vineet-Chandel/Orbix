import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import {
    Compass,
    Search,
    ShieldCheck,
    FileText,
    Trophy,
    GraduationCap,
    MapPin,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    ArrowRight,
    AlertTriangle,
    Users,
} from "lucide-react";
import {
    fetchExploreProfiles,
    type ExploreDeveloper,
} from "../../utils/profileApi";
import PublicProfilePage from "../Profile/PublicProfilePage";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import { getPlatformIcon } from "../../utils/platformLinks";
import { NeoSelect } from "../../components/NeoSelect";
import { RelationshipActionButton } from "../../components/RelationshipActionButton";

interface ExploreViewProps {
    onOpenMobileSidebar?: () => void;
}

const PAGE_SIZE = 24;

export const ExploreView: React.FC<ExploreViewProps> = ({ onOpenMobileSidebar }) => {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    // -------------------------------------------------------------------------
    // Navigation & Selection State
    // -------------------------------------------------------------------------
    const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

    // -------------------------------------------------------------------------
    // Query & Filter State
    // -------------------------------------------------------------------------
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [selectedCollege, setSelectedCollege] = useState("all");
    const [filterOpenToWork, setFilterOpenToWork] = useState(false);
    const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
    const [filterHasResume, setFilterHasResume] = useState(false);
    const [filterHighScore, setFilterHighScore] = useState(false);
    const [sortBy, setSortBy] = useState<"score" | "solved" | "contests" | "streak" | "recent" | "name">("score");

    // -------------------------------------------------------------------------
    // Data Fetching & Infinite Scroll State
    // -------------------------------------------------------------------------
    const [developers, setDevelopers] = useState<ExploreDeveloper[]>([]);
    const [totalDevelopers, setTotalDevelopers] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // References to control scroll container, observer sentinel, and fetch lock
    const containerRef = useRef<HTMLElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef<boolean>(false);
    const pageRef = useRef<number>(1);

    // Debounce search query input (300ms) to avoid over-fetching
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // -------------------------------------------------------------------------
    // Developer List Filtering Helper
    // -------------------------------------------------------------------------
    const filterDevList = useCallback((rawUsers: ExploreDeveloper[]) => {
        let list = rawUsers;

        // Exclude self from explore list
        if (user) {
            const myId = user.id;
            const myUsername = (user.username || "").toLowerCase();
            const myEmailPrefix = ((user as any).email || (user as any).gmail || "").split("@")[0].toLowerCase();

            list = list.filter((u) => {
                if (myId && u.id === myId) return false;
                if (myUsername && u.username.toLowerCase() === myUsername) return false;
                if (myEmailPrefix && u.username.toLowerCase() === myEmailPrefix) return false;
                return true;
            });
        }

        // Client-side additional soft filters
        if (filterHasResume) {
            list = list.filter((u) => u.hasResume);
        }
        if (filterHighScore) {
            list = list.filter((u) => (u.orbixScore || 0) >= 1000);
        }

        return list;
    }, [user, filterHasResume, filterHighScore]);

    // -------------------------------------------------------------------------
    // Primary Data Fetcher (Page-based Pagination)
    // -------------------------------------------------------------------------
    const fetchPage = useCallback(async (pageToFetch: number, isInitial = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        setFetchError(null);

        try {
            const res = await fetchExploreProfiles({
                search: debouncedSearchQuery.trim() || undefined,
                college: selectedCollege !== "all" ? selectedCollege : undefined,
                openToWork: filterOpenToWork ? true : undefined,
                verifiedOnly: filterVerifiedOnly ? true : undefined,
                sortBy,
                page: pageToFetch,
                limit: PAGE_SIZE,
            });

            if (res.success && Array.isArray(res.users)) {
                const filtered = filterDevList(res.users);

                if (isInitial) {
                    setDevelopers(filtered);
                } else {
                    setDevelopers((prev) => {
                        const existingKeys = new Set(prev.map((d) => d.id || d.username));
                        const additions = filtered.filter((d) => !existingKeys.has(d.id || d.username));
                        return [...prev, ...additions];
                    });
                }

                pageRef.current = pageToFetch;
                setPage(pageToFetch);
                setTotalDevelopers((prev) => res.total ?? (isInitial ? filtered.length : prev));
                setHasMore(res.page < res.totalPages && res.users.length > 0);
            } else {
                if (isInitial) {
                    setDevelopers([]);
                    setTotalDevelopers(0);
                }
                setHasMore(false);
            }
        } catch (err: any) {
            console.error("Explore fetch error:", err);
            setFetchError(err.message || "Failed to load developer profiles");

            // Resilient fallback only on initial cold boot
            if (isInitial) {
                const fallbackList: ExploreDeveloper[] = [
                    {
                        id: "demo-vineet",
                        username: "Vineet-Chandel",
                        displayName: "Vineet Singh",
                        firstName: "Vineet",
                        lastName: "Singh",
                        headline: "Distributed Systems & Full-Stack Architect",
                        bio: "Software Architect and competitive programmer. Designing scalable platforms, real-time engines, and developer-first infrastructure.",
                        location: "Kanpur, India",
                        college: "PSIT Kanpur",
                        skills: ["TypeScript", "Go", "React", "PostgreSQL", "Redis", "Docker", "AWS"],
                        isOpenToWork: true,
                        isHireable: true,
                        isPublic: true,
                        isVerifiedCoder: true,
                        hasResume: true,
                        orbixScore: 15836,
                        totalSolved: 1570,
                        totalContests: 64,
                        streak: 42,
                        connectedPortals: [
                            { portal: "leetcode", portalUsername: "CodeMars", verified: true },
                            { portal: "codeforces", portalUsername: "Code.Mars", verified: true },
                            { portal: "github", portalUsername: "Vineet-Chandel", verified: true },
                            { portal: "codechef", portalUsername: "c0demars", verified: true },
                        ],
                    },
                ];

                const filteredFallback = filterDevList(fallbackList);
                setDevelopers(filteredFallback);
                setTotalDevelopers(filteredFallback.length);
            }
            setHasMore(false);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
            setIsRefreshing(false);
            isFetchingRef.current = false;
        }
    }, [
        debouncedSearchQuery,
        selectedCollege,
        filterOpenToWork,
        filterVerifiedOnly,
        sortBy,
        filterDevList,
    ]);

    // Trigger initial fetch or re-fetch whenever filters or query change
    useEffect(() => {
        pageRef.current = 1;
        setPage(1);
        setHasMore(true);
        fetchPage(1, true);

        // Scroll back to top on filter change
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [
        debouncedSearchQuery,
        selectedCollege,
        filterOpenToWork,
        filterVerifiedOnly,
        filterHasResume,
        filterHighScore,
        sortBy,
        fetchPage,
    ]);

    // -------------------------------------------------------------------------
    // Load More Action for Scroll Pagination
    // -------------------------------------------------------------------------
    const handleLoadMore = useCallback(() => {
        if (isFetchingRef.current || !hasMore || isLoading || isLoadingMore) {
            return;
        }
        fetchPage(pageRef.current + 1, false);
    }, [hasMore, isLoading, isLoadingMore, fetchPage]);

    // IntersectionObserver to automatically trigger loadMore when sentinel enters viewport
    useEffect(() => {
        if (selectedUsername) return;
        const sentinel = sentinelRef.current;
        const container = containerRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [first] = entries;
                if (first && first.isIntersecting) {
                    handleLoadMore();
                }
            },
            {
                root: container,
                rootMargin: "300px",
                threshold: 0,
            }
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [selectedUsername, handleLoadMore]);

    // Container onScroll fallback handler for instant responsiveness
    const handleContainerScroll = useCallback(
        (e: React.UIEvent<HTMLElement>) => {
            if (selectedUsername) return;
            const target = e.currentTarget;
            const remainingScroll = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (remainingScroll < 350) {
                handleLoadMore();
            }
        },
        [selectedUsername, handleLoadMore]
    );

    const handleRefresh = async () => {
        setIsRefreshing(true);
        pageRef.current = 1;
        setPage(1);
        setHasMore(true);
        await fetchPage(1, true);
        toast.success("Public developer profiles updated", { title: "Refreshed" });
    };

    // -------------------------------------------------------------------------
    // Colleges Extraction for Quick Filter
    // -------------------------------------------------------------------------
    const uniqueColleges = useMemo(() => {
        const set = new Set<string>();
        developers.forEach((d) => {
            if (d.college && d.college.trim()) {
                set.add(d.college.trim());
            }
        });
        return Array.from(set).slice(0, 12);
    }, [developers]);

    // -------------------------------------------------------------------------
    // Candidate Switching Helpers (Previous / Next)
    // -------------------------------------------------------------------------
    const currentCandidateIndex = useMemo(() => {
        if (!selectedUsername) return -1;
        return developers.findIndex((d) => d.username.toLowerCase() === selectedUsername.toLowerCase());
    }, [developers, selectedUsername]);

    const handlePreviousCandidate = () => {
        if (currentCandidateIndex > 0) {
            setSelectedUsername(developers[currentCandidateIndex - 1].username);
        }
    };

    const handleNextCandidate = () => {
        if (currentCandidateIndex >= 0 && currentCandidateIndex < developers.length - 1) {
            setSelectedUsername(developers[currentCandidateIndex + 1].username);
        }
    };

    return (
        <section
            ref={containerRef}
            onScroll={handleContainerScroll}
            aria-label="Orbix Explore Developers"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                {/* ========================================================================= */}
                {/* EXPLORE TOP HEADER BAR                                                    */}
                {/* ========================================================================= */}
                <header className="pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            {onOpenMobileSidebar && (
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                    aria-label="Open sidebar"
                                >
                                    <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <line x1="3" y1="12" x2="21" y2="12" />
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="18" x2="21" y2="18" />
                                    </svg>
                                </button>
                            )}
                            <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                <Compass className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                Explore Developers
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-neutral-700">
                            Discover public developer profiles, review verified multi-platform analytics, and inspect candidate showcases.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2.5 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                            title="Refresh developer list"
                        >
                            <RefreshCw className={`w-4 h-4 stroke-[2.5] ${isRefreshing ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                {/* ========================================================================= */}
                {/* CASE 1: EMBEDDED PROFILE INSPECTOR MODE (NO REDIRECTION)                 */}
                {/* ========================================================================= */}
                {selectedUsername ? (
                    <div className="space-y-5 animate-in fade-in duration-200">
                        {/* Top Sticky Inspection Navigation Bar */}
                        <div className="sticky top-0 z-30 p-3 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setSelectedUsername(null)}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform hover:-translate-x-0.5"
                                >
                                    <ChevronLeft className="w-4 h-4 stroke-[3]" />
                                    <span>Back to Developers Catalog</span>
                                </button>

                                <div className="h-5 w-px bg-black/20 hidden sm:block" />

                                <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                                    <span className="text-neutral-500 font-mono">Viewing:</span>
                                    <span className="font-black text-black">@{selectedUsername}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#a2ff86] border border-black text-black">
                                        Public Profile
                                    </span>
                                </div>
                            </div>

                            {/* Candidate Navigation & Relationship Action */}
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <RelationshipActionButton
                                    targetUserId={currentCandidateIndex >= 0 ? (developers[currentCandidateIndex]?.id || selectedUsername) : selectedUsername}
                                    targetUsername={selectedUsername}
                                    initialState={currentCandidateIndex >= 0 ? developers[currentCandidateIndex]?.relationshipState : undefined}
                                    initialPayload={currentCandidateIndex >= 0 ? developers[currentCandidateIndex]?.relationship : undefined}
                                    size="sm"
                                />

                                <div className="inline-flex items-center rounded-xl bg-[#FAF6EE] border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]">
                                    <button
                                        type="button"
                                        onClick={handlePreviousCandidate}
                                        disabled={currentCandidateIndex <= 0}
                                        className="p-1.5 hover:bg-white text-black disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                        title="Previous Candidate"
                                    >
                                        <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 border-x border-black/20">
                                        {currentCandidateIndex >= 0 ? `${currentCandidateIndex + 1} / ${developers.length}` : ""}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleNextCandidate}
                                        disabled={currentCandidateIndex >= developers.length - 1}
                                        className="p-1.5 hover:bg-white text-black disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                        title="Next Candidate"
                                    >
                                        <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* REAL PUBLIC PROFILE EMBEDDED DIRECTLY IN THIS SECTION */}
                        <div className="rounded-3xl border-2 sm:border-[3px] border-black bg-white shadow-[6px_6px_0px_#000] overflow-hidden">
                            <PublicProfilePage
                                overrideUsername={selectedUsername}
                                isEmbedded={true}
                            />
                        </div>
                    </div>
                ) : (
                    /* ========================================================================= */
                    /* CASE 2: PUBLIC DEVELOPER CATALOG BROWSING MODE                            */
                    /* ========================================================================= */
                    <div className="space-y-6">
                        {/* Search & Filter Toolbar */}
                        <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[4px_4px_0px_#000] space-y-4">
                            {/* Live Search and Sort Controls */}
                            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 stroke-[2.5]" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by engineer name, @handle, college, or technologies (e.g. Go, React, IIT)..."
                                        className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black font-bold text-sm text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000] transition-all"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black px-2 py-0.5 rounded bg-neutral-200 border border-black hover:bg-neutral-300"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {/* College Filter Dropdown */}
                                {uniqueColleges.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-neutral-600 shrink-0">College:</span>
                                        <div className="w-44">
                                            <NeoSelect
                                                value={selectedCollege}
                                                onChange={(val) => setSelectedCollege(val)}
                                                size="sm"
                                                options={[
                                                    { value: "all", label: "All Colleges" },
                                                    ...uniqueColleges.map((col) => ({
                                                        value: col,
                                                        label: col,
                                                    })),
                                                ]}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Sort Dropdown */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-neutral-600 shrink-0">Sort By:</span>
                                    <div className="w-44">
                                        <NeoSelect
                                            value={sortBy}
                                            onChange={(val) => setSortBy(val as any)}
                                            size="sm"
                                            options={[
                                                { value: "score", label: "Top Orbix Score" },
                                                { value: "solved", label: "Most Solved Problems" },
                                                { value: "contests", label: "Most Contests" },
                                                { value: "streak", label: "Highest Streak" },
                                                { value: "recent", label: "Recently Joined" },
                                                { value: "name", label: "Alphabetical" },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Filter Chips */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-black">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterOpenToWork(false);
                                        setFilterVerifiedOnly(false);
                                        setFilterHasResume(false);
                                        setFilterHighScore(false);
                                        setSelectedCollege("all");
                                    }}
                                    className={`px-3 py-1.5 rounded-xl border-2 border-black transition-all cursor-pointer shrink-0 ${
                                        !filterOpenToWork && !filterVerifiedOnly && !filterHasResume && !filterHighScore && selectedCollege === "all"
                                            ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                    }`}
                                >
                                    All ({totalDevelopers})
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterOpenToWork((prev) => !prev)}
                                    className={`px-3 py-1.5 rounded-xl border-2 border-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                        filterOpenToWork
                                            ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span>Open to Work</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterVerifiedOnly((prev) => !prev)}
                                    className={`px-3 py-1.5 rounded-xl border-2 border-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                        filterVerifiedOnly
                                            ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                    }`}
                                >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Verified Only</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterHasResume((prev) => !prev)}
                                    className={`px-3 py-1.5 rounded-xl border-2 border-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                        filterHasResume
                                            ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                    }`}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Has Resume</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFilterHighScore((prev) => !prev)}
                                    className={`px-3 py-1.5 rounded-xl border-2 border-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                        filterHighScore
                                            ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                    }`}
                                >
                                    <Trophy className="w-3.5 h-3.5" />
                                    <span>1,000+ Score</span>
                                </button>
                            </div>
                        </div>

                        {/* Error Banner if any */}
                        {fetchError && (
                            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-600 text-amber-950 font-bold text-xs flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>{fetchError}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fetchPage(1, true)}
                                    className="px-3 py-1 rounded-lg bg-amber-600 text-white font-black text-[11px] hover:bg-amber-700"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Developers Grid of Small Blocks */}
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {[1, 2, 3, 4, 5, 6].map((idx) => (
                                    <div
                                        key={idx}
                                        className="rounded-2xl bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000] space-y-4 animate-pulse"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-neutral-200" />
                                            <div className="space-y-1.5 flex-1">
                                                <div className="h-4 w-3/4 bg-neutral-200 rounded" />
                                                <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                                            </div>
                                        </div>
                                        <div className="h-3 w-full bg-neutral-100 rounded" />
                                        <div className="h-3 w-2/3 bg-neutral-100 rounded" />
                                        <div className="h-9 w-full bg-neutral-200 rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        ) : developers.length === 0 ? (
                            <div className="p-12 text-center rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <Users className="w-12 h-12 mx-auto text-neutral-400 stroke-[1.5]" />
                                <h3 className="text-xl font-black text-black">No Public Developers Match Filters</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-bold max-w-md mx-auto">
                                    Try adjusting your search query, clearing filters, or switching sort order.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setFilterOpenToWork(false);
                                        setFilterVerifiedOnly(false);
                                        setFilterHasResume(false);
                                        setFilterHighScore(false);
                                        setSelectedCollege("all");
                                    }}
                                    className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {developers.map((candidate) => {
                                    // Default avatar: use DEFAULT_AVATAR_URL if candidate does not have a photo
                                    const avatar =
                                        candidate.photoUrl ||
                                        candidate.avatarUrl ||
                                        DEFAULT_AVATAR_URL;

                                    const verifiedPortals = candidate.connectedPortals.filter((p) => p.verified);

                                    return (
                                        <article
                                            key={candidate.id || candidate.username}
                                            className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between overflow-hidden group"
                                        >
                                            <div className="p-5 space-y-4">
                                                {/* Top Row: Avatar + Name + Verification + Score */}
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="relative shrink-0">
                                                            <img
                                                                src={avatar}
                                                                alt={candidate.displayName}
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                                }}
                                                                className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                                            />
                                                            {candidate.isOpenToWork && (
                                                                <span
                                                                    className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-black"
                                                                    title="Open to Work"
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <h3 className="font-black text-base text-black tracking-tight truncate group-hover:text-emerald-700 transition-colors">
                                                                    {candidate.displayName}
                                                                </h3>
                                                                {(candidate.isVerifiedCoder || verifiedPortals.length > 0) && (
                                                                    <span title="Verified Developer Credentials">
                                                                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-mono font-bold text-neutral-500 truncate">
                                                                @{candidate.username}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Score Pill */}
                                                    <div className="text-right shrink-0">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFE566] text-black font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]">
                                                            <Trophy className="w-3 h-3" />
                                                            <span>{candidate.orbixScore.toLocaleString()}</span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Headline */}
                                                {candidate.headline ? (
                                                    <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-relaxed">
                                                        {candidate.headline}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs font-medium text-neutral-500 italic">
                                                        Verified Orbix Engineer
                                                    </p>
                                                )}

                                                {/* Meta: College & Location */}
                                                <div className="space-y-1 text-[11px] font-bold text-neutral-600">
                                                    {candidate.college && (
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <GraduationCap className="w-3.5 h-3.5 text-black shrink-0" />
                                                            <span className="truncate">{candidate.college}</span>
                                                        </div>
                                                    )}
                                                    {candidate.location && (
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <MapPin className="w-3.5 h-3.5 text-black shrink-0" />
                                                            <span className="truncate">{candidate.location}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Skills Badges */}
                                                {candidate.skills && candidate.skills.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {candidate.skills.slice(0, 4).map((skill, sIdx) => (
                                                            <span
                                                                key={sIdx}
                                                                className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[10px] font-mono font-bold text-black"
                                                            >
                                                                {skill}
                                                            </span>
                                                        ))}
                                                        {candidate.skills.length > 4 && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-black/30 text-[10px] font-mono font-bold text-neutral-600">
                                                                +{candidate.skills.length - 4}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Connected Portals Icons */}
                                                {candidate.connectedPortals.length > 0 && (
                                                    <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-mono font-bold text-neutral-600">
                                                        <div className="flex items-center gap-1.5">
                                                            {candidate.connectedPortals.map((p, pIdx) => {
                                                                const icon = getPlatformIcon(p.portal, "w-4 h-4");
                                                                return (
                                                                    <span
                                                                        key={pIdx}
                                                                        title={`${p.portal}: @${p.portalUsername} (${p.verified ? "Verified" : "Unverified"})`}
                                                                        className="p-1 rounded bg-[#FAF6EE] border border-black"
                                                                    >
                                                                        {icon}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>

                                                        {candidate.totalSolved > 0 && (
                                                            <span className="text-black font-black">
                                                                {candidate.totalSolved} Solved
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Footer: Connect & In-Place Inspection */}
                                            <div className="p-3 bg-[#FAF6EE] border-t-2 border-black flex items-center gap-2">
                                                <div className="shrink-0">
                                                    <RelationshipActionButton
                                                        targetUserId={candidate.id || candidate.username}
                                                        targetUsername={candidate.username}
                                                        targetDisplayName={candidate.displayName}
                                                        initialState={candidate.relationshipState || "none"}
                                                        initialPayload={candidate.relationship}
                                                        size="sm"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedUsername(candidate.username)}
                                                    className="flex-1 py-2 px-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 transition-transform hover:translate-x-[1px]"
                                                >
                                                    <span>View Profile</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>

                            {/* Infinite Scroll: Loading More Indicator */}
                            {isLoadingMore && (
                                <div className="py-8 flex flex-col items-center justify-center gap-2.5 animate-in fade-in">
                                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                        <RefreshCw className="w-4 h-4 text-black animate-spin stroke-[2.5]" />
                                        <span className="text-xs font-black text-black">Loading more developers...</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-neutral-500">
                                        Fetching page {page + 1} of public developers
                                    </p>
                                </div>
                            )}

                            {/* Infinite Scroll: End of Results Indicator */}
                            {!hasMore && !isLoading && developers.length > 0 && (
                                <div className="py-8 text-center animate-in fade-in">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border-2 border-black text-neutral-800 font-mono text-xs font-bold shadow-[2px_2px_0px_#000]">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span>All {developers.length} public developers loaded</span>
                                    </div>
                                </div>
                            )}

                            {/* IntersectionObserver Sentinel for smooth scroll pagination */}
                            <div ref={sentinelRef} className="h-8 w-full pointer-events-none" />
                        </>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default ExploreView;
