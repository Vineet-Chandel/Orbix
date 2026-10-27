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
    Users,
    Clock,
    Check,
    X,
    UserMinus,
    UserPlus,
    UserX,
    Loader2,
    Send,
    Inbox,
    MoreVertical,
    Copy,
    WifiOff,
} from "lucide-react";
import { type ExploreDeveloper } from "../../utils/profileApi";
import PublicProfilePage from "../Profile/PublicProfilePage";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    setActiveNetworkTab,
    setRequestsSubTab,
    fetchExploreDevelopersThunk,
    fetchConnectionsThunk,
    fetchPendingRequestsThunk,
    sendExploreConnectionRequestThunk,
    cancelPendingRequestThunk,
    acceptPendingRequestThunk,
    declinePendingRequestThunk,
    removeConnectionThunk,
    blockUserThunk,
    clearExploreError,
} from "../../store/networkSlice";
import { getPlatformIcon } from "../../utils/platformLinks";
import { NeoSelect } from "../../components/NeoSelect";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import type { ConnectedUserItem, PendingRequestItem } from "../../api/relationshipApi";

interface ExploreViewProps {
    onOpenMobileSidebar?: () => void;
}

const PAGE_SIZE = 24;
const ERROR_COOLDOWN_MS = 4000; // 4-second minimum backoff cooldown after fetch failure

export const ExploreView: React.FC<ExploreViewProps> = ({ onOpenMobileSidebar }) => {
    const toast = useToast();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const { explore, connections, requests, activeTab } = useAppSelector((state) => state.network);

    // -------------------------------------------------------------------------
    // Offline status & Connectivity awareness
    // -------------------------------------------------------------------------
    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator !== "undefined" ? navigator.onLine : true
    );

    // -------------------------------------------------------------------------
    // Navigation & Selection State
    // -------------------------------------------------------------------------
    const [selectedUsername, setSelectedUsername] = useState<string | null>(null);

    // Connections search filter
    const [connectionSearch, setConnectionSearch] = useState("");

    // Modal state for removing connections
    const [disconnectTarget, setDisconnectTarget] = useState<ConnectedUserItem | null>(null);

    // Modal state for withdrawing pending requests
    const [withdrawTarget, setWithdrawTarget] = useState<PendingRequestItem | null>(null);

    // 3-Dot Menu & Block User State
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [blockTarget, setBlockTarget] = useState<{
        userId: string;
        username: string;
        displayName: string;
        avatarUrl?: string | null;
        headline?: string | null;
    } | null>(null);
    const [isBlocking, setIsBlocking] = useState(false);

    // Pending action in-flight flags
    const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

    // -------------------------------------------------------------------------
    // Query & Filter State (Explore Tab)
    // -------------------------------------------------------------------------
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [selectedCollege, setSelectedCollege] = useState("all");
    const [filterOpenToWork, setFilterOpenToWork] = useState(false);
    const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
    const [filterHasResume, setFilterHasResume] = useState(false);
    const [filterHighScore, setFilterHighScore] = useState(false);
    const [sortBy, setSortBy] = useState<"score" | "solved" | "contests" | "streak" | "recent" | "name">("score");

    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // References to control scroll container, observer sentinel, and fetch lock
    const containerRef = useRef<HTMLElement | null>(null);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef<boolean>(false);
    const lastErrorTimeRef = useRef<number>(0);
    const scrollThrottleRef = useRef<number | null>(null);

    // Debounce search query input (300ms) to avoid over-fetching
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // -------------------------------------------------------------------------
    // Initial Load & Tab Counts Hydration
    // -------------------------------------------------------------------------
    useEffect(() => {
        // Hydrate badge counts across all sections on boot if online
        if (typeof navigator === "undefined" || navigator.onLine) {
            dispatch(fetchPendingRequestsThunk({ filter: "all" }));
            dispatch(fetchConnectionsThunk({ limit: 50, isInitial: true }));
        }
    }, [dispatch]);

    // -------------------------------------------------------------------------
    // Online / Offline Status Event Listeners
    // -------------------------------------------------------------------------
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            lastErrorTimeRef.current = 0;
            dispatch(clearExploreError());
        };

        const handleOffline = () => {
            setIsOnline(false);
            isFetchingRef.current = false;
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [dispatch]);

    // -------------------------------------------------------------------------
    // Developer List Filtering Helper (Excludes self & applies soft filters)
    // -------------------------------------------------------------------------
    const filteredDevelopers = useMemo(() => {
        let list = explore.items;

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

        if (filterHasResume) {
            list = list.filter((u) => u.hasResume);
        }
        if (filterHighScore) {
            list = list.filter((u) => (u.orbixScore || 0) >= 1000);
        }

        return list;
    }, [explore.items, user, filterHasResume, filterHighScore]);

    // -------------------------------------------------------------------------
    // Fetch Explore Page
    // -------------------------------------------------------------------------
    const fetchPage = useCallback(
        async (pageToFetch: number, isInitial = false) => {
            // Strict offline guard: do NOT fire network calls when offline
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                setIsRefreshing(false);
                return;
            }

            // Cooldown guard: prevent continuous loop if an error occurred recently
            if (!isInitial && Date.now() - lastErrorTimeRef.current < ERROR_COOLDOWN_MS) {
                return;
            }

            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            try {
                await dispatch(
                    fetchExploreDevelopersThunk({
                        search: debouncedSearchQuery.trim() || undefined,
                        college: selectedCollege !== "all" ? selectedCollege : undefined,
                        openToWork: filterOpenToWork ? true : undefined,
                        verifiedOnly: filterVerifiedOnly ? true : undefined,
                        sortBy,
                        page: pageToFetch,
                        limit: PAGE_SIZE,
                        isInitial,
                    })
                ).unwrap();
                lastErrorTimeRef.current = 0;
            } catch (err: any) {
                console.error("Explore fetch error:", err);
                lastErrorTimeRef.current = Date.now();
            } finally {
                setIsRefreshing(false);
                isFetchingRef.current = false;
            }
        },
        [
            dispatch,
            debouncedSearchQuery,
            selectedCollege,
            filterOpenToWork,
            filterVerifiedOnly,
            sortBy,
        ]
    );

    // Trigger initial fetch or re-fetch whenever filters or query change
    useEffect(() => {
        if (activeTab === "explore") {
            lastErrorTimeRef.current = 0;
            fetchPage(1, true);

            if (containerRef.current) {
                containerRef.current.scrollTop = 0;
            }
        }
    }, [
        activeTab,
        debouncedSearchQuery,
        selectedCollege,
        filterOpenToWork,
        filterVerifiedOnly,
        filterHasResume,
        filterHighScore,
        sortBy,
        fetchPage,
    ]);

    // Automatically recover when coming back online
    useEffect(() => {
        if (isOnline && activeTab === "explore" && (explore.error || explore.items.length === 0)) {
            lastErrorTimeRef.current = 0;
            fetchPage(1, true);
        }
    }, [isOnline, activeTab, explore.error, explore.items.length, fetchPage]);

    // -------------------------------------------------------------------------
    // Load More Action for Scroll Pagination in Explore
    // -------------------------------------------------------------------------
    const handleLoadMore = useCallback(() => {
        if (
            activeTab !== "explore" ||
            isFetchingRef.current ||
            !isOnline ||
            (typeof navigator !== "undefined" && !navigator.onLine) ||
            explore.error ||
            Date.now() - lastErrorTimeRef.current < ERROR_COOLDOWN_MS ||
            explore.items.length === 0 ||
            !explore.hasMore ||
            explore.isLoading ||
            explore.isLoadingMore
        ) {
            return;
        }
        fetchPage(explore.page + 1, false);
    }, [
        activeTab,
        isOnline,
        explore.error,
        explore.hasMore,
        explore.isLoading,
        explore.isLoadingMore,
        explore.items.length,
        explore.page,
        fetchPage,
    ]);

    // IntersectionObserver to automatically trigger loadMore when sentinel enters viewport
    useEffect(() => {
        if (
            selectedUsername ||
            activeTab !== "explore" ||
            !isOnline ||
            explore.error ||
            !explore.hasMore ||
            explore.items.length === 0
        ) {
            return;
        }
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
                rootMargin: "250px",
                threshold: 0,
            }
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [
        selectedUsername,
        activeTab,
        isOnline,
        explore.error,
        explore.hasMore,
        explore.items.length,
        handleLoadMore,
    ]);

    // Container onScroll fallback handler with strict throttling and empty-list protection
    const handleContainerScroll = useCallback(
        (e: React.UIEvent<HTMLElement>) => {
            if (selectedUsername || activeTab !== "explore") return;

            // Immediately abort if offline, in error state, list is empty, or no more items
            if (!isOnline || (typeof navigator !== "undefined" && !navigator.onLine)) return;
            if (explore.items.length === 0 || !explore.hasMore || explore.error) return;
            if (isFetchingRef.current || explore.isLoading || explore.isLoadingMore) return;

            // Throttle scroll checks to 150ms window to prevent firing on every scroll tick
            if (scrollThrottleRef.current) return;
            scrollThrottleRef.current = window.setTimeout(() => {
                scrollThrottleRef.current = null;
            }, 150);

            const target = e.currentTarget;
            const remainingScroll = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (remainingScroll < 350) {
                handleLoadMore();
            }
        },
        [
            selectedUsername,
            activeTab,
            isOnline,
            explore.items.length,
            explore.hasMore,
            explore.error,
            explore.isLoading,
            explore.isLoadingMore,
            handleLoadMore,
        ]
    );

    const handleRefresh = async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            toast.error("You appear to be offline. Please verify your internet connection.", { title: "Offline" });
            return;
        }
        setIsRefreshing(true);
        lastErrorTimeRef.current = 0;
        dispatch(clearExploreError());
        if (activeTab === "explore") {
            await fetchPage(1, true);
            toast.success("Public developer profiles updated", { title: "Refreshed" });
        } else if (activeTab === "connections") {
            await dispatch(fetchConnectionsThunk({ limit: 50, isInitial: true }));
            toast.success("Connections list updated", { title: "Refreshed" });
            setIsRefreshing(false);
        } else if (activeTab === "requests") {
            await dispatch(fetchPendingRequestsThunk({ filter: "all" }));
            toast.success("Requests list updated", { title: "Refreshed" });
            setIsRefreshing(false);
        }
    };

    // -------------------------------------------------------------------------
    // Action: Connect With Developer (Immediately removes from Explore & updates Redux)
    // -------------------------------------------------------------------------
    const handleConnect = async (candidate: ExploreDeveloper) => {
        setActionInProgressId(candidate.id || candidate.username);
        try {
            const action = await dispatch(sendExploreConnectionRequestThunk(candidate));
            if (sendExploreConnectionRequestThunk.fulfilled.match(action)) {
                toast.success(`Connection request sent to @${candidate.username}!`, {
                    title: "Request Sent",
                });
            } else {
                const errMsg = (action.payload as string) || "Could not send connection request.";
                toast.error(errMsg, { title: "Limit Reached" });
            }
        } catch (err: any) {
            toast.error(err.message || "Network error sending request.");
        } finally {
            setActionInProgressId(null);
        }
    };

    // -------------------------------------------------------------------------
    // Action: Accept Incoming Request (Moves to Connections in Redux)
    // -------------------------------------------------------------------------
    const handleAcceptRequest = async (item: PendingRequestItem) => {
        setActionInProgressId(item.relationshipId);
        try {
            const action = await dispatch(
                acceptPendingRequestThunk({
                    relationshipId: item.relationshipId,
                    targetUserId: item.userId,
                    peerUser: {
                        username: item.username,
                        displayName: item.displayName,
                        avatarUrl: item.avatarUrl,
                        headline: item.headline,
                        college: item.college,
                    },
                })
            );
            if (acceptPendingRequestThunk.fulfilled.match(action)) {
                toast.success(`You are now connected with @${item.username}!`, {
                    title: "Connected",
                });
            } else {
                toast.error((action.payload as string) || "Could not accept request.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to accept connection.");
        } finally {
            setActionInProgressId(null);
        }
    };

    // -------------------------------------------------------------------------
    // Action: Decline Incoming Request (Removes from Redux)
    // -------------------------------------------------------------------------
    const handleDeclineRequest = async (item: PendingRequestItem) => {
        setActionInProgressId(item.relationshipId);
        try {
            const action = await dispatch(
                declinePendingRequestThunk({
                    relationshipId: item.relationshipId,
                    targetUserId: item.userId,
                })
            );
            if (declinePendingRequestThunk.fulfilled.match(action)) {
                toast.info(`Connection request from @${item.username} declined.`);
            } else {
                toast.error((action.payload as string) || "Could not decline request.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to decline request.");
        } finally {
            setActionInProgressId(null);
        }
    };

    // -------------------------------------------------------------------------
    // Action: Withdraw / Cancel Outgoing Request (Removes from Redux)
    // -------------------------------------------------------------------------
    const handleConfirmWithdraw = async () => {
        if (!withdrawTarget) return;
        const target = withdrawTarget;
        setWithdrawTarget(null);
        setActionInProgressId(target.relationshipId);

        try {
            const action = await dispatch(
                cancelPendingRequestThunk({
                    relationshipId: target.relationshipId,
                    targetUserId: target.userId,
                })
            );
            if (cancelPendingRequestThunk.fulfilled.match(action)) {
                toast.info(`Connection request to @${target.username} withdrawn.`);
            } else {
                toast.error((action.payload as string) || "Could not withdraw request.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to withdraw request.");
        } finally {
            setActionInProgressId(null);
        }
    };

    // -------------------------------------------------------------------------
    // Action: Remove Active Connection (Removes from Redux)
    // -------------------------------------------------------------------------
    const handleConfirmDisconnect = async () => {
        if (!disconnectTarget) return;
        const target = disconnectTarget;
        setDisconnectTarget(null);
        setActionInProgressId(target.relationshipId);

        try {
            const action = await dispatch(
                removeConnectionThunk({
                    relationshipId: target.relationshipId,
                    targetUserId: target.connectedUserId,
                })
            );
            if (removeConnectionThunk.fulfilled.match(action)) {
                toast.info(`Connection with @${target.username} removed.`);
            } else {
                toast.error((action.payload as string) || "Could not remove connection.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to remove connection.");
        } finally {
            setActionInProgressId(null);
        }
    };

    // -------------------------------------------------------------------------
    // Action: Block User from Card 3-Dot Menu (Removes from Redux across all views)
    // -------------------------------------------------------------------------
    const handleConfirmBlock = async () => {
        if (!blockTarget) return;
        const target = blockTarget;
        setIsBlocking(true);

        try {
            const action = await dispatch(
                blockUserThunk({
                    targetUserId: target.userId,
                    reason: "Blocked from card menu",
                    userPreview: {
                        username: target.username,
                        displayName: target.displayName,
                        avatarUrl: target.avatarUrl || null,
                        headline: target.headline || null,
                    },
                })
            );

            if (blockUserThunk.fulfilled.match(action)) {
                toast.success(`User @${target.username} blocked.`);
                setBlockTarget(null);
            } else {
                toast.error((action.payload as string) || "Failed to block user.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to block user.");
        } finally {
            setIsBlocking(false);
        }
    };

    const handleCopyProfileLink = (username: string) => {
        const url = `${window.location.origin}/u/${encodeURIComponent(username)}`;
        navigator.clipboard.writeText(url).then(
            () => toast.success(`Profile link copied: @${username}`),
            () => toast.error("Could not copy link to clipboard")
        );
    };

    /**
     * Renders a Neo-Brutalist 3-dot dropdown menu on any card.
     */
    const renderCardActionMenu = (
        menuKey: string,
        target: {
            userId: string;
            username: string;
            displayName: string;
            avatarUrl?: string | null;
            headline?: string | null;
        }
    ) => (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === menuKey ? null : menuKey);
                }}
                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[1.5px_1.5px_0px_#000] hover:shadow-[2px_2px_0px_#000] cursor-pointer transition-all active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center justify-center"
                title="More actions"
                aria-label="More actions"
            >
                <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {openMenuId === menuKey && (
                <>
                    <div
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                        }}
                    />
                    <div
                        className="absolute right-0 top-full mt-1.5 w-48 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] p-1.5 z-40 animate-in fade-in zoom-in-95 text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setOpenMenuId(null);
                                handleCopyProfileLink(target.username);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors text-left cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5 stroke-[2]" />
                            <span>Copy Profile Link</span>
                        </button>
                        <div className="my-1 border-t border-black/10" />
                        <button
                            type="button"
                            onClick={() => {
                                setOpenMenuId(null);
                                setBlockTarget(target);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left cursor-pointer"
                        >
                            <UserX className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Block Account</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    // -------------------------------------------------------------------------
    // Colleges Extraction for Quick Filter
    // -------------------------------------------------------------------------
    const uniqueColleges = useMemo(() => {
        const set = new Set<string>();
        explore.items.forEach((d) => {
            if (d.college && d.college.trim()) {
                set.add(d.college.trim());
            }
        });
        return Array.from(set).slice(0, 12);
    }, [explore.items]);

    // -------------------------------------------------------------------------
    // Filtered Connections in Connections Tab
    // -------------------------------------------------------------------------
    const filteredConnections = useMemo(() => {
        if (!connectionSearch.trim()) return connections.items;
        const q = connectionSearch.trim().toLowerCase();
        return connections.items.filter(
            (c) =>
                c.username.toLowerCase().includes(q) ||
                c.displayName.toLowerCase().includes(q) ||
                (c.college && c.college.toLowerCase().includes(q)) ||
                (c.headline && c.headline.toLowerCase().includes(q))
        );
    }, [connections.items, connectionSearch]);

    // -------------------------------------------------------------------------
    // Candidate Switching Helpers (Previous / Next in Embedded Profile Mode)
    // -------------------------------------------------------------------------
    const currentCandidateIndex = useMemo(() => {
        if (!selectedUsername) return -1;
        return filteredDevelopers.findIndex((d) => d.username.toLowerCase() === selectedUsername.toLowerCase());
    }, [filteredDevelopers, selectedUsername]);

    const handlePreviousCandidate = () => {
        if (currentCandidateIndex > 0) {
            setSelectedUsername(filteredDevelopers[currentCandidateIndex - 1].username);
        }
    };

    const handleNextCandidate = () => {
        if (currentCandidateIndex >= 0 && currentCandidateIndex < filteredDevelopers.length - 1) {
            setSelectedUsername(filteredDevelopers[currentCandidateIndex + 1].username);
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
                            {!isOnline && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black border-2 border-black text-xs font-mono font-black shadow-[2px_2px_0px_#000]">
                                    <WifiOff className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>OFFLINE</span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-neutral-700">
                            Discover public developer profiles, review verified multi-platform analytics, and manage peer connections.
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

                            {/* Candidate Navigation */}
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handlePreviousCandidate}
                                        disabled={currentCandidateIndex <= 0}
                                        className="p-2 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                        title="Previous Candidate"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                    <span className="text-xs font-mono font-bold px-2">
                                        {currentCandidateIndex >= 0 ? `${currentCandidateIndex + 1} / ${filteredDevelopers.length}` : ""}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleNextCandidate}
                                        disabled={currentCandidateIndex >= filteredDevelopers.length - 1}
                                        className="p-2 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                        title="Next Candidate"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Public Profile View Component */}
                        <div className="rounded-2xl border-2 border-black shadow-[4px_4px_0px_#000] bg-white overflow-hidden">
                            <PublicProfilePage
                                overrideUsername={selectedUsername}
                                isEmbedded={true}
                            />
                        </div>
                    </div>
                ) : (
                    /* ========================================================================= */
                    /* CASE 2: NETWORK DIRECTORY (EXPLORE | CONNECTIONS | REQUESTS)              */
                    /* ========================================================================= */
                    <div className="space-y-6">
                        {/* Top Neo-Brutalist Navigation Tabs */}
                        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                            <button
                                type="button"
                                onClick={() => dispatch(setActiveNetworkTab("explore"))}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                                    activeTab === "explore"
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <Compass className="w-4 h-4 stroke-[2.5]" />
                                <span>Explore Developers</span>
                                <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                                        activeTab === "explore"
                                            ? "bg-[#a2ff86] text-black"
                                            : "bg-[#FFE566] text-black border border-black"
                                    }`}
                                >
                                    {explore.total}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    dispatch(setActiveNetworkTab("connections"));
                                    dispatch(fetchConnectionsThunk({ limit: 50, isInitial: true }));
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                                    activeTab === "connections"
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <Users className="w-4 h-4 stroke-[2.5]" />
                                <span>Connections</span>
                                <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                                        activeTab === "connections"
                                            ? "bg-[#a2ff86] text-black"
                                            : "bg-[#FAF6EE] text-black border border-black"
                                    }`}
                                >
                                    {connections.totalCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    dispatch(setActiveNetworkTab("requests"));
                                    dispatch(fetchPendingRequestsThunk({ filter: "all" }));
                                }}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer inline-flex items-center gap-2 shrink-0 ${
                                    activeTab === "requests"
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                                }`}
                            >
                                <Clock className="w-4 h-4 stroke-[2.5]" />
                                <span>Requests</span>
                                <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                                        activeTab === "requests"
                                            ? "bg-[#a2ff86] text-black"
                                            : "bg-[#FFE566] text-black border border-black"
                                    }`}
                                >
                                    {requests.totalIncoming + requests.totalOutgoing}
                                </span>
                            </button>
                        </div>

                        {/* ================================================================= */}
                        {/* TAB 1: EXPLORE DEVELOPERS (DISCOVER NEW PEERS)                    */}
                        {/* ================================================================= */}
                        {activeTab === "explore" && (
                            <>
                                {/* Search, College Filter & Sort Bar */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                    <div className="flex flex-col lg:flex-row gap-3">
                                        {/* Search Input */}
                                        <div className="relative flex-1">
                                            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[2.5]" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search by engineer name, @handle, college, or technologies (e.g. Go, React, IIT)..."
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000] transition-colors"
                                            />
                                        </div>

                                        {/* Quick College Select */}
                                        {uniqueColleges.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-neutral-600 shrink-0">College:</span>
                                                <div className="w-56">
                                                    <NeoSelect
                                                        value={selectedCollege}
                                                        onChange={(val) => setSelectedCollege(val)}
                                                        size="sm"
                                                        options={[
                                                            { value: "all", label: "All Colleges" },
                                                            ...uniqueColleges.map((c) => ({
                                                                value: c,
                                                                label: c,
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
                                                !filterOpenToWork &&
                                                !filterVerifiedOnly &&
                                                !filterHasResume &&
                                                !filterHighScore &&
                                                selectedCollege === "all"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                            }`}
                                        >
                                            All ({explore.total})
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

                                {/* Developers Cards Grid */}
                                {explore.isLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                                            <Loader2 className="w-8 h-8 text-black animate-spin" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-wider text-black">
                                            Scanning verified developers...
                                        </p>
                                    </div>
                                ) : (!isOnline || explore.error) && filteredDevelopers.length === 0 ? (
                                    <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 animate-in fade-in">
                                        <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                            <WifiOff className="w-7 h-7 text-black stroke-[2.5]" />
                                        </div>
                                        <div className="space-y-1.5 max-w-md mx-auto">
                                            <h3 className="text-lg font-black text-black">
                                                {!isOnline ? "No Internet Connection" : "Unable to Connect to Server"}
                                            </h3>
                                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                                {!isOnline
                                                    ? "Your device appears to be offline. Reconnect to the internet to explore developer profiles."
                                                    : explore.error || "A network error occurred while retrieving public developer profiles."}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                lastErrorTimeRef.current = 0;
                                                dispatch(clearExploreError());
                                                fetchPage(1, true);
                                            }}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all"
                                        >
                                            <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                                            <span>Retry Connection</span>
                                        </button>
                                    </div>
                                ) : filteredDevelopers.length === 0 ? (
                                    <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                        <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                            <Users className="w-6 h-6 text-neutral-400 stroke-[2.5]" />
                                        </div>
                                        <h3 className="text-base font-black text-black">No Developers Available</h3>
                                        <p className="text-xs font-bold text-neutral-600 max-w-sm mx-auto">
                                            {searchQuery || selectedCollege !== "all" || filterOpenToWork || filterVerifiedOnly
                                                ? "Try clearing some filters or searching for another university or handle."
                                                : "All public developers are either already in your connections or pending requests!"}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {filteredDevelopers.map((candidate) => {
                                            const avatar =
                                                (candidate.photoUrl && candidate.photoUrl !== DEFAULT_AVATAR_URL)
                                                    ? candidate.photoUrl
                                                    : (candidate.avatarUrl || candidate.photoUrl || DEFAULT_AVATAR_URL);

                                            const verifiedPortals = candidate.connectedPortals.filter((p) => p.verified);
                                            const isConnecting = actionInProgressId === (candidate.id || candidate.username);

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

                                                            {/* Score Pill & 3-Dot Menu */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFE566] text-black font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]">
                                                                    <Trophy className="w-3 h-3" />
                                                                    <span>{candidate.orbixScore.toLocaleString()}</span>
                                                                </span>
                                                                {renderCardActionMenu(`explore-${candidate.id || candidate.username}`, {
                                                                    userId: candidate.id || candidate.username,
                                                                    username: candidate.username,
                                                                    displayName: candidate.displayName,
                                                                    avatarUrl: candidate.avatarUrl || candidate.photoUrl || null,
                                                                    headline: candidate.headline || null,
                                                                })}
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
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConnect(candidate)}
                                                            disabled={isConnecting}
                                                            className="shrink-0 px-4 py-2 text-xs font-black rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 bg-[#FFE566] hover:bg-[#ffe043] text-black cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] inline-flex items-center justify-center gap-1.5 select-none"
                                                            title={`Send connection request to ${candidate.displayName}`}
                                                        >
                                                            {isConnecting ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                            )}
                                                            <span>Connect</span>
                                                        </button>

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
                                )}

                                {/* Infinite Scroll Loading More Indicator */}
                                {explore.isLoadingMore && (
                                    <div className="py-8 flex flex-col items-center justify-center gap-2.5 animate-in fade-in">
                                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                            <RefreshCw className="w-4 h-4 text-black animate-spin stroke-[2.5]" />
                                            <span className="text-xs font-black text-black">Loading more developers...</span>
                                        </div>
                                    </div>
                                )}

                                {/* Error on Loading More Banner */}
                                {explore.items.length > 0 && (explore.error || !isOnline) && (
                                    <div className="py-6 flex flex-col items-center justify-center gap-2 animate-in fade-in">
                                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                                            <WifiOff className="w-4 h-4 text-black stroke-[2.5]" />
                                            <span className="text-xs font-bold text-black">
                                                {!isOnline
                                                    ? "You are offline. Unable to load more developers."
                                                    : explore.error || "Failed to load more developers."}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    lastErrorTimeRef.current = 0;
                                                    dispatch(clearExploreError());
                                                    fetchPage(explore.page + 1, false);
                                                }}
                                                className="ml-2 px-3 py-1 rounded-lg bg-black text-[#a2ff86] text-xs font-black hover:bg-neutral-800 transition-colors cursor-pointer"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* IntersectionObserver Sentinel (Only rendered when there are items, more to load, online, and not in error) */}
                                {explore.items.length > 0 && explore.hasMore && !explore.error && isOnline && (
                                    <div ref={sentinelRef} className="h-8 w-full pointer-events-none" />
                                )}
                            </>
                        )}

                        {/* ================================================================= */}
                        {/* TAB 2: CONNECTIONS (ACTIVE PEER CONNECTIONS)                      */}
                        {/* ================================================================= */}
                        {activeTab === "connections" && (
                            <div className="space-y-5">
                                {/* Search Bar for Connections */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-3">
                                    <div className="relative flex-1 w-full">
                                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[2.5]" />
                                        <input
                                            type="text"
                                            value={connectionSearch}
                                            onChange={(e) => setConnectionSearch(e.target.value)}
                                            placeholder="Search by name, @handle, college, or role..."
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000] transition-colors"
                                        />
                                    </div>
                                    <div className="text-xs font-mono font-bold text-neutral-600 shrink-0">
                                        {connections.totalCount} Total Connections
                                    </div>
                                </div>

                                {/* Connections List */}
                                {connections.isLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                                            <Loader2 className="w-8 h-8 text-black animate-spin" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-wider text-black">
                                            Loading your connections...
                                        </p>
                                    </div>
                                ) : filteredConnections.length === 0 ? (
                                    <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                            <Users className="w-7 h-7 text-black stroke-[2.5]" />
                                        </div>
                                        <div className="space-y-1.5 max-w-md mx-auto">
                                            <h3 className="text-lg font-black text-black">
                                                {connectionSearch ? "No Matching Connections" : "No Connections Yet"}
                                            </h3>
                                            <p className="text-xs text-neutral-600 font-medium">
                                                {connectionSearch
                                                    ? "Try searching for a different handle or name."
                                                    : "Browse Explore Developers to connect with peers and mentors across institutions."}
                                            </p>
                                        </div>
                                        {!connectionSearch && (
                                            <button
                                                type="button"
                                                onClick={() => dispatch(setActiveNetworkTab("explore"))}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFE566] text-black font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 cursor-pointer transition-all"
                                            >
                                                <Compass className="w-4 h-4 stroke-[2.5]" />
                                                <span>Discover Developers</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {filteredConnections.map((item) => {
                                            const avatar =
                                                (item.photoUrl && item.photoUrl !== DEFAULT_AVATAR_URL)
                                                    ? item.photoUrl
                                                    : (item.avatarUrl || DEFAULT_AVATAR_URL);
                                            const isRemoving = actionInProgressId === item.relationshipId;

                                            return (
                                                <article
                                                    key={item.relationshipId}
                                                    className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all flex flex-col justify-between overflow-hidden"
                                                >
                                                    <div className="p-5 space-y-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <img
                                                                    src={avatar}
                                                                    alt={item.displayName}
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                                    }}
                                                                    className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                                                />
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <h3 className="font-black text-base text-black tracking-tight truncate">
                                                                            {item.displayName}
                                                                        </h3>
                                                                        {item.isVerifiedCoder && (
                                                                            <span title="Verified Developer">
                                                                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs font-mono font-bold text-neutral-500 truncate">
                                                                        @{item.username}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {typeof item.orbixScore === "number" && item.orbixScore > 0 && (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFE566] text-black font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000]">
                                                                        <Trophy className="w-3 h-3" />
                                                                        <span>{item.orbixScore.toLocaleString()}</span>
                                                                    </span>
                                                                )}
                                                                {renderCardActionMenu(`conn-${item.relationshipId}`, {
                                                                    userId: item.connectedUserId || item.username,
                                                                    username: item.username,
                                                                    displayName: item.displayName,
                                                                    avatarUrl: item.avatarUrl || null,
                                                                    headline: item.headline || null,
                                                                })}
                                                            </div>
                                                        </div>

                                                        {item.headline ? (
                                                            <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-relaxed">
                                                                {item.headline}
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs font-medium text-neutral-500 italic">
                                                                Connected Developer
                                                            </p>
                                                        )}

                                                        {/* Meta: College & Location */}
                                                        <div className="space-y-1 text-[11px] font-bold text-neutral-600">
                                                            {item.college && (
                                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 truncate">
                                                                    <GraduationCap className="w-3.5 h-3.5 text-black shrink-0" />
                                                                    <span className="truncate">{item.college}</span>
                                                                </div>
                                                            )}
                                                            {item.location && (
                                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 truncate">
                                                                    <MapPin className="w-3.5 h-3.5 text-black shrink-0" />
                                                                    <span className="truncate">{item.location}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Skills Badges */}
                                                        {item.skills && item.skills.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                                {item.skills.slice(0, 4).map((skill, sIdx) => (
                                                                    <span
                                                                        key={sIdx}
                                                                        className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[10px] font-mono font-bold text-black"
                                                                    >
                                                                        {skill}
                                                                    </span>
                                                                ))}
                                                                {item.skills.length > 4 && (
                                                                    <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-black/30 text-[10px] font-mono font-bold text-neutral-600">
                                                                        +{item.skills.length - 4}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-3 bg-[#FAF6EE] border-t-2 border-black flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedUsername(item.username)}
                                                            className="flex-1 py-2 px-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 transition-transform hover:translate-x-[1px]"
                                                        >
                                                            <span>View Profile</span>
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setDisconnectTarget(item)}
                                                            disabled={isRemoving}
                                                            className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] cursor-pointer transition-all"
                                                            title="Disconnect"
                                                        >
                                                            {isRemoving ? (
                                                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                                            ) : (
                                                                <UserMinus className="w-4 h-4 stroke-[2]" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ================================================================= */}
                        {/* TAB 3: REQUESTS (RECEIVED & SENT IN REDUX)                         */}
                        {/* ================================================================= */}
                        {activeTab === "requests" && (
                            <div className="space-y-5">
                                {/* Sub-Tab Selection: Received vs Sent */}
                                <div className="p-3 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => dispatch(setRequestsSubTab("incoming"))}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer inline-flex items-center gap-2 ${
                                                requests.activeSubTab === "incoming"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] hover:bg-neutral-200 text-black"
                                            }`}
                                        >
                                            <Inbox className="w-4 h-4 stroke-[2.5]" />
                                            <span>Received</span>
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                                                    requests.activeSubTab === "incoming"
                                                        ? "bg-[#a2ff86] text-black"
                                                        : "bg-white text-black border border-black"
                                                }`}
                                            >
                                                {requests.totalIncoming}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => dispatch(setRequestsSubTab("outgoing"))}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer inline-flex items-center gap-2 ${
                                                requests.activeSubTab === "outgoing"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] hover:bg-neutral-200 text-black"
                                            }`}
                                        >
                                            <Send className="w-4 h-4 stroke-[2.5]" />
                                            <span>Sent</span>
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                                                    requests.activeSubTab === "outgoing"
                                                        ? "bg-[#a2ff86] text-black"
                                                        : "bg-white text-black border border-black"
                                                }`}
                                            >
                                                {requests.totalOutgoing}
                                            </span>
                                        </button>
                                    </div>

                                    <p className="text-xs font-mono font-bold text-neutral-500 hidden sm:block">
                                        {requests.activeSubTab === "incoming"
                                            ? "Developers waiting to connect with you"
                                            : "Requests you have sent to peers"}
                                    </p>
                                </div>

                                {/* Content: Received Requests */}
                                {requests.activeSubTab === "incoming" && (
                                    <>
                                        {requests.incoming.length === 0 ? (
                                            <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                                <div className="w-12 h-12 rounded-xl bg-emerald-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                                    <Inbox className="w-6 h-6 text-black stroke-[2.5]" />
                                                </div>
                                                <h3 className="text-base font-black text-black">No Received Requests</h3>
                                                <p className="text-xs font-bold text-neutral-600 max-w-sm mx-auto">
                                                    When developers send you connection requests, you can accept or decline them here.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                {requests.incoming.map((item) => {
                                                    const avatar =
                                                        (item.photoUrl && item.photoUrl !== DEFAULT_AVATAR_URL)
                                                            ? item.photoUrl
                                                            : (item.avatarUrl || DEFAULT_AVATAR_URL);
                                                    const isBusy = actionInProgressId === item.relationshipId;

                                                    return (
                                                        <article
                                                            key={item.relationshipId}
                                                            className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between overflow-hidden"
                                                        >
                                                            <div className="p-5 space-y-3">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <img
                                                                            src={avatar}
                                                                            alt={item.displayName}
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                                            }}
                                                                            className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                                                        />
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <h3 className="font-black text-base text-black tracking-tight truncate">
                                                                                    {item.displayName}
                                                                                </h3>
                                                                                {item.isVerifiedCoder && (
                                                                                    <span title="Verified Developer">
                                                                                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs font-mono font-bold text-neutral-500 truncate">
                                                                                @{item.username}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFE566] text-black font-black text-xs border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                                                            <Trophy className="w-3 h-3" />
                                                                            <span>{item.orbixScore.toLocaleString()}</span>
                                                                        </span>
                                                                        {renderCardActionMenu(`req-inc-${item.relationshipId}`, {
                                                                            userId: item.userId || item.username,
                                                                            username: item.username,
                                                                            displayName: item.displayName,
                                                                            avatarUrl: item.avatarUrl || null,
                                                                            headline: item.headline || null,
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                {item.headline ? (
                                                                    <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-relaxed">
                                                                        {item.headline}
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-xs font-medium text-neutral-500 italic">
                                                                        Verified Developer
                                                                    </p>
                                                                )}

                                                                {/* Meta: College & Location */}
                                                                <div className="space-y-1 text-[11px] font-bold text-neutral-600">
                                                                    {item.college && (
                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 truncate">
                                                                            <GraduationCap className="w-3.5 h-3.5 text-black shrink-0" />
                                                                            <span className="truncate">{item.college}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.location && (
                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 truncate">
                                                                            <MapPin className="w-3.5 h-3.5 text-black shrink-0" />
                                                                            <span className="truncate">{item.location}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Skills Badges */}
                                                                {item.skills && item.skills.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                                        {item.skills.slice(0, 4).map((skill, sIdx) => (
                                                                            <span
                                                                                key={sIdx}
                                                                                className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[10px] font-mono font-bold text-black"
                                                                            >
                                                                                {skill}
                                                                            </span>
                                                                        ))}
                                                                        {item.skills.length > 4 && (
                                                                            <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-black/30 text-[10px] font-mono font-bold text-neutral-600">
                                                                                +{item.skills.length - 4}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="p-3 bg-[#FAF6EE] border-t-2 border-black flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAcceptRequest(item)}
                                                                    disabled={isBusy}
                                                                    className="flex-1 py-2 px-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5"
                                                                >
                                                                    {isBusy ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                                    )}
                                                                    <span>Accept</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeclineRequest(item)}
                                                                    disabled={isBusy}
                                                                    className="py-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-neutral-800 hover:text-rose-600 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5"
                                                                >
                                                                    <X className="w-3.5 h-3.5 stroke-[3]" />
                                                                    <span>Decline</span>
                                                                </button>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Content: Sent Requests */}
                                {requests.activeSubTab === "outgoing" && (
                                    <>
                                        {requests.outgoing.length === 0 ? (
                                            <div className="p-12 text-center rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                                <div className="w-12 h-12 rounded-xl bg-amber-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                                    <Send className="w-6 h-6 text-black stroke-[2.5]" />
                                                </div>
                                                <h3 className="text-base font-black text-black">No Sent Requests</h3>
                                                <p className="text-xs font-bold text-neutral-600 max-w-sm mx-auto">
                                                    You don't have any pending outgoing requests. Connect with developers from Explore to build your network!
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                {requests.outgoing.map((item) => {
                                                    const avatar =
                                                        (item.photoUrl && item.photoUrl !== DEFAULT_AVATAR_URL)
                                                            ? item.photoUrl
                                                            : (item.avatarUrl || DEFAULT_AVATAR_URL);
                                                    const isBusy = actionInProgressId === item.relationshipId;

                                                    return (
                                                        <article
                                                            key={item.relationshipId}
                                                            className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between overflow-hidden"
                                                        >
                                                            <div className="p-5 space-y-3">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <img
                                                                            src={avatar}
                                                                            alt={item.displayName}
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                                            }}
                                                                            className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                                                        />
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <h3 className="font-black text-base text-black tracking-tight truncate">
                                                                                    {item.displayName}
                                                                                </h3>
                                                                                {item.isVerifiedCoder && (
                                                                                    <span title="Verified Developer">
                                                                                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs font-mono font-bold text-neutral-500 truncate">
                                                                                @{item.username}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-mono font-bold text-[10px] border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>Pending</span>
                                                                        </span>
                                                                        {renderCardActionMenu(`req-out-${item.relationshipId}`, {
                                                                            userId: item.userId || item.username,
                                                                            username: item.username,
                                                                            displayName: item.displayName,
                                                                            avatarUrl: item.avatarUrl || null,
                                                                            headline: item.headline || null,
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                {item.headline ? (
                                                                    <p className="text-xs font-bold text-neutral-800 line-clamp-2 leading-relaxed">
                                                                        {item.headline}
                                                                    </p>
                                                                ) : (
                                                                    <p className="text-xs font-medium text-neutral-500 italic">
                                                                        Software Engineer
                                                                    </p>
                                                                )}

                                                                {/* Meta: College & Location */}
                                                                <div className="space-y-1 text-[11px] font-bold text-neutral-600">
                                                                    {item.college && (
                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 truncate">
                                                                            <GraduationCap className="w-3.5 h-3.5 text-black shrink-0" />
                                                                            <span className="truncate">{item.college}</span>
                                                                        </div>
                                                                    )}
                                                                    {item.location && (
                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 truncate">
                                                                            <MapPin className="w-3.5 h-3.5 text-black shrink-0" />
                                                                            <span className="truncate">{item.location}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Skills Badges */}
                                                                {item.skills && item.skills.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                                        {item.skills.slice(0, 4).map((skill, sIdx) => (
                                                                            <span
                                                                                key={sIdx}
                                                                                className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[10px] font-mono font-bold text-black"
                                                                            >
                                                                                {skill}
                                                                            </span>
                                                                        ))}
                                                                        {item.skills.length > 4 && (
                                                                            <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 border border-black/30 text-[10px] font-mono font-bold text-neutral-600">
                                                                                +{item.skills.length - 4}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="p-3 bg-[#FAF6EE] border-t-2 border-black flex items-center justify-between gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedUsername(item.username)}
                                                                    className="py-1.5 px-3 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                                                                >
                                                                    Profile
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setWithdrawTarget(item)}
                                                                    disabled={isBusy}
                                                                    className="py-1.5 px-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                                                                >
                                                                    {isBusy ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                    )}
                                                                    <span>Withdraw Request</span>
                                                                </button>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Full-Width Desk Illustration (Matching all app sections) */}
            <SectionBottomIllustration alt="Explore workspace illustration" />

            {/* Modal: Confirm Disconnect */}
            <ConfirmationModal
                isOpen={!!disconnectTarget}
                title="Disconnect with Developer"
                message={`Are you sure you want to remove @${disconnectTarget?.username || "this developer"} from your connections?`}
                confirmLabel="Disconnect"
                variant="danger"
                onConfirm={handleConfirmDisconnect}
                onCancel={() => setDisconnectTarget(null)}
            />

            {/* Modal: Confirm Withdraw Request */}
            <ConfirmationModal
                isOpen={!!withdrawTarget}
                title="Withdraw Connection Request"
                message={`Are you sure you want to withdraw your connection request to @${withdrawTarget?.username || "this developer"}?`}
                confirmLabel="Withdraw Request"
                variant="danger"
                onConfirm={handleConfirmWithdraw}
                onCancel={() => setWithdrawTarget(null)}
            />

            {/* Modal: Confirm Block User */}
            <ConfirmationModal
                isOpen={!!blockTarget}
                title={`Block @${blockTarget?.username || "Developer"}`}
                message={`Are you sure you want to block ${blockTarget?.displayName || "this user"} (@${blockTarget?.username})? They will be removed from your explore, connections, and requests, and will no longer be able to interact with your profile.`}
                confirmLabel="Block Account"
                variant="danger"
                isLoading={isBlocking}
                onConfirm={handleConfirmBlock}
                onCancel={() => !isBlocking && setBlockTarget(null)}
            />
        </section>
    );
};

export default ExploreView;
