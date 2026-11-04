import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, useLocation, useParams } from "react-router-dom";
import {
    Calendar,
    CalendarDays,
    Plus,
    Edit3,
    Clock,
    MapPin,
    Bell,
    ExternalLink,
    Users,
    UserCheck,
    ShieldCheck,
    ArrowRight,
    Building2,
    Mail,
    Settings,
} from "lucide-react";
import {
    useAppDispatch,
    useAppSelector,
    clearUser,
    fetchClubProfile,
    fetchClubEvents,
    createClubEvent,
    updateClubEvent,
    addEventOptimistic,
    updateEventOptimistic,
    type ClubEvent,
    type CreateClubEventPayload,
    type ClubEventStatus,
    type ClubEventFilter,
} from "../../store";
import { useToast } from "../../context/ToastContext";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { ClubSidebar, type ClubTab } from "./ClubSidebar";
import ClubInboxModal from "./ClubInboxModal";
import { ClubEventModal } from "./ClubEventModal";
import { ClubEventAnalyticsSection } from "./ClubEventAnalyticsSection";
import { ClubTeamWorkspace } from "./Team/ClubTeamWorkspace";
import type { TeamStats } from "./Team/types";
import { ClubProfileManager } from "./Profile/ClubProfileManager";
import { ClubSettingsView } from "./Settings/ClubSettingsView";
import { OtherClubsSection } from "./OtherClubsSection";
import { ClubEventDetailWorkspace } from "./ClubEventDetailPage";
import { OrbixLoader } from "../../components/ui/loader";

interface VerifiedClub {
    id: string;
    auth_user_id: string;
    name: string;
    slug: string;
    clubUsername?: string;
    category: string;
    college_id?: string;
    college_name: string;
    college_city: string;
    college_state: string;
    college_country: string;
    short_description: string | null;
    about: string | null;
    logo_url: string | null;
    logoUrl?: string | null;
    cover_image_url: string | null;
    coverImageUrl?: string | null;
    website_url: string | null;
    public_email: string | null;
    social_links: {
        github?: string;
        linkedin?: string;
        instagram?: string;
        x?: string;
        twitter?: string;
        discord?: string;
        website?: string;
        social?: string;
    } | null;
    is_active: boolean;
    verified_at: string;
    created_at: string;
}

interface ClubStats {
    upcoming_count: string | number;
    past_count: string | number;
    draft_count: string | number;
    total_count: string | number;
}

export default function ClubDashboardPage() {
    const { eventId } = useParams<{ eventId?: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const toast = useToast();

    // Centralized Redux club state
    const clubState = useAppSelector((state) => state.club);
    const { events } = useAppSelector((state) => state.clubEvents);

    // Data States (initialized immediately from Redux if already in memory)
    const [club, setClub] = useState<VerifiedClub | null>(clubState.club as any);
    const [, setStats] = useState<ClubStats>(clubState.stats || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });
    const [loading, setLoading] = useState(!clubState.isInitialized);

    // Synchronize local states with Redux club slice
    useEffect(() => {
        if (clubState.club) {
            setClub(clubState.club as any);
        }
        if (clubState.stats) {
            setStats(clubState.stats);
        }
        if (clubState.isInitialized) {
            setLoading(false);
        }
    }, [clubState.club, clubState.stats, clubState.isInitialized]);

    // Path to Club Tab mapping & clean full route paths
    const getClubTabFromPath = (pathname: string): ClubTab => {
        if (pathname.startsWith("/club/team")) return "team";
        if (pathname.startsWith("/club/events")) return "events";
        if (pathname.startsWith("/club/profile") || pathname.startsWith("/club/manage-profile")) return "profile";
        if (pathname.startsWith("/club/clubs") || pathname.startsWith("/club/campus-clubs") || pathname.startsWith("/club/other-clubs")) return "clubs";
        if (pathname.startsWith("/club/settings")) return "settings";
        return "overview";
    };

    const clubTabToPath: Record<ClubTab, string> = {
        overview: "/club/dashboard",
        team: "/club/team",
        events: "/club/events",
        profile: "/club/profile",
        clubs: "/club/clubs",
        settings: "/club/settings",
    };

    // Navigation & Clean Full Route Sync
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTabState] = useState<ClubTab>(() => {
        const tabQuery = searchParams.get("tab") as ClubTab | null;
        if (tabQuery && clubTabToPath[tabQuery]) {
            return tabQuery;
        }
        return getClubTabFromPath(location.pathname);
    });
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Keep activeTab in sync with route changes (browser back/forward, direct links)
    useEffect(() => {
        setActiveTabState(getClubTabFromPath(location.pathname));
    }, [location.pathname]);

    // Backward compatibility: automatically migrate legacy query parameters (?tab=team) to clean full routes (/club/team)
    useEffect(() => {
        const tabQuery = searchParams.get("tab") as ClubTab | null;
        if (tabQuery && clubTabToPath[tabQuery]) {
            navigate(clubTabToPath[tabQuery], { replace: true });
        }
    }, [searchParams, navigate]);

    // Deep link support for /club/inbox
    useEffect(() => {
        if (location.pathname === "/club/inbox") {
            setIsInboxModalOpen(true);
        }
    }, [location.pathname]);

    // Switch tab by navigating to the full route
    const handleTabChange = (tab: ClubTab) => {
        setActiveTabState(tab);
        const targetPath = clubTabToPath[tab] || "/club/dashboard";
        if (location.pathname !== targetPath) {
            navigate(targetPath);
        }
    };

    // Team Stats and Sidebar Badge States
    const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
    const [teamPendingCount, setTeamPendingCount] = useState<number>(0);

    // Fetch team stats (counts & pending invitations)
    const fetchTeamStats = async (clubId: string) => {
        try {
            const res = await fetch(`/api/club/team/stats?clubId=${clubId}`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                if (data?.success) {
                    setTeamStats(data);
                    if (typeof data.pendingInvitations === "number") {
                        setTeamPendingCount(data.pendingInvitations);
                    }
                }
            }
        } catch {
            // silent fail for team badge sync
        }
    };

    // Club Inbox & Moderation States
    const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
    const [inboxCounts, setInboxCounts] = useState<{ unreadCount: number; mutedCount: number; totalCount: number }>({
        unreadCount: 0,
        mutedCount: 0,
        totalCount: 0,
    });

    // Event Modal State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<ClubEvent | null>(null);
    const [initialModalStatus, setInitialModalStatus] = useState<ClubEventStatus>("published");
    const [eventFilter, setEventFilter] = useState<ClubEventFilter>("all");

    // In-flight request guards to prevent duplicate concurrent network calls (e.g. StrictMode, rapid switches)
    const isFetchingClubRef = useRef(false);
    const isFetchingInboxRef = useRef(false);

    // Fetch club profile and events (leveraging Redux and Redis caching)
    const fetchClubData = async (force = false) => {
        if (isFetchingClubRef.current && !force) return;
        isFetchingClubRef.current = true;
        try {
            if (!clubState.isInitialized || force) {
                setLoading(true);
            }
            const [profileResult] = await Promise.allSettled([
                dispatch(fetchClubProfile({ force })).unwrap(),
                dispatch(fetchClubEvents(club?.id)).unwrap(),
            ]);

            if (profileResult.status === "fulfilled") {
                const profileData = profileResult.value;
                if (profileData?.club) {
                    setClub(profileData.club as any);
                    setStats(profileData.stats || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });
                    fetchTeamStats(profileData.club.id);
                }
            } else {
                const err: any = profileResult.reason;
                if (typeof err === "string" && (err.includes("401") || err.toLowerCase().includes("unauthorized") || err.toLowerCase().includes("authentication required"))) {
                    navigate("/auth/signin", { replace: true });
                    return;
                }
                if (typeof err === "string" && (err.includes("404") || err.includes("403") || err.toLowerCase().includes("no verified club"))) {
                    navigate("/club/status", { replace: true });
                    return;
                }
            }
        } catch (err) {
            console.error("Failed to load club dashboard:", err);
            toast.error("Could not load club dashboard. Please refresh.", { title: "Error" });
        } finally {
            setLoading(false);
            isFetchingClubRef.current = false;
        }
    };

    // Fetch inbox unread count
    const fetchInboxCounts = async () => {
        if (isFetchingInboxRef.current) return;
        isFetchingInboxRef.current = true;
        try {
            const queryParam = club?.id ? `?clubId=${encodeURIComponent(club.id)}` : "";
            const res = await fetch(`/api/club/inbox/unread-count${queryParam}`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                if (data?.success && data.counts) {
                    setInboxCounts({
                        unreadCount: Number(data.counts.unreadCount) || 0,
                        mutedCount: Number(data.counts.mutedCount) || 0,
                        totalCount: Number(data.counts.totalCount) || 0,
                    });
                }
            }
        } catch {
            // silent fail for badge sync
        } finally {
            isFetchingInboxRef.current = false;
        }
    };

    useEffect(() => {
        fetchClubData();
        fetchInboxCounts();

        const notifInterval = setInterval(fetchInboxCounts, 30000);
        window.addEventListener("focus", fetchInboxCounts);

        return () => {
            clearInterval(notifInterval);
            window.removeEventListener("focus", fetchInboxCounts);
        };
    }, []);

    // Open Event Create Modal
    const openCreateEventModal = (initialStatus: ClubEventStatus = "published") => {
        setEditingEvent(null);
        setInitialModalStatus(initialStatus);
        setIsEventModalOpen(true);
    };

    // Open Event Edit Modal
    const handleEditEvent = (ev: ClubEvent) => {
        setEditingEvent(ev);
        setIsEventModalOpen(true);
    };

    // Handle Event Save (Optimistic create or update with background API processing)
    const handleModalSubmit = (payload: CreateClubEventPayload, isEditing: boolean, eventId?: string) => {
        if (isEditing && eventId) {
            const previousEvent = events.find((e) => e.id === eventId);
            // 1. Optimistic Redux update immediately
            dispatch(updateEventOptimistic({ id: eventId, changes: payload }));
            setIsEventModalOpen(false);
            setEditingEvent(null);
            toast.success("Event updated successfully!", { title: "Success" });

            // 2. Background API call
            dispatch(updateClubEvent({ eventId, payload, previousEvent }))
                .unwrap()
                .catch((err: any) => {
                    toast.error(err?.message || "Failed to sync update to server. Changes reverted.", {
                        title: "Sync Error",
                    });
                });
        } else {
            const tempId = `opt-event-${Date.now()}`;
            const optimisticEvent: ClubEvent = {
                id: tempId,
                clubId: club?.id || "",
                title: payload.title,
                slug: payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                summary: payload.summary || null,
                description: payload.description || null,
                startsAt: payload.startsAt,
                endsAt: payload.endsAt || null,
                timezone: payload.timezone || "Asia/Kolkata",
                locationType: payload.locationType,
                venueOrLocation: payload.venueOrLocation || null,
                registrationUrl: payload.registrationUrl || null,
                coverImageUrl: payload.coverImageUrl || null,
                status: payload.status,
                publishedAt: payload.status === "published" ? new Date().toISOString() : null,
                createdAt: new Date().toISOString(),
                isOptimistic: true,
            };

            // 1. Optimistic Redux add immediately: instantly reflects in listing & counts!
            dispatch(addEventOptimistic(optimisticEvent));
            setIsEventModalOpen(false);
            setEditingEvent(null);

            const statusToastText =
                payload.status === "published"
                    ? "Event published! Added to live listing immediately."
                    : payload.status === "draft"
                    ? "Event saved to drafts immediately."
                    : "Event saved as cancelled.";

            toast.success(statusToastText, { title: "Event Added" });

            // 2. Background API call
            dispatch(createClubEvent({ tempId, payload }))
                .unwrap()
                .catch((err: any) => {
                    toast.error(err?.message || "Failed to persist event to server. Removed from listing.", {
                        title: "Sync Error",
                    });
                });
        }
    };

    // Event subsets
    const publishedEvents = useMemo(() => events.filter((e) => e.status === "published"), [events]);
    const completedEvents = useMemo(() => events.filter((e) => e.status === "completed"), [events]);
    const draftEvents = useMemo(() => events.filter((e) => e.status === "draft"), [events]);
    const cancelledEvents = useMemo(() => events.filter((e) => e.status === "cancelled"), [events]);

    // Filtered Events for Events View
    const filteredEvents = useMemo(() => {
        if (eventFilter === "all") return events;
        return events.filter((e) => e.status === eventFilter);
    }, [events, eventFilter]);

    // Handle Logout
    const handleSignOut = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {
            // ignore
        }
        dispatch(clearUser());
        navigate("/auth/signin", { replace: true });
    };

    // Date formatting matching Personal Account ("Today, 29 October 2026")
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center text-black">
                <OrbixLoader size="lg" />
            </div>
        );
    }

    if (!club) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-4 text-black">
                <div className="max-w-md w-full bg-white rounded-2xl border-2 border-black p-6 sm:p-8 shadow-[6px_6px_0px_#000] text-center space-y-4">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_#000]">
                        <Building2 className="w-7 h-7 text-black stroke-[2.5]" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-lg font-black text-black">Club Session Unavailable</h2>
                        <p className="text-xs text-neutral-600 font-medium">
                            We could not synchronize club credentials for this session. Please refresh or sign in to continue.
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => fetchClubData(true)}
                            className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] cursor-pointer"
                        >
                            Retry Sync
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/auth/signin")}
                            className="px-4 py-2 rounded-xl bg-black text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 cursor-pointer"
                        >
                            Sign In
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Club Sidebar — Dashboard, Team, Events, and Manage Profile */}
            <ClubSidebar
                club={club}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
                unreadInboxCount={inboxCounts.unreadCount}
                teamPendingCount={teamPendingCount}
                eventsCount={events.length}
                onOpenInbox={() => setIsInboxModalOpen(true)}
                onSignOut={handleSignOut}
            />

            {/* Main Content Area Container matching Personal Account */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:p-3">
                <section
                    aria-label="Orbix Club Space"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-3 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                        {/* Dynamic Header Bar tailored to each tab */}
                        {(!eventId || activeTab !== "events") && (
                            <div className="pb-5 border-b-2 border-black/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Left: Mobile Toggle & Tab-Specific Title & Badges */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(true)}
                                        className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                        aria-label="Open sidebar"
                                    >
                                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <line x1="3" y1="12" x2="21" y2="12" />
                                            <line x1="3" y1="6" x2="21" y2="6" />
                                            <line x1="3" y1="18" x2="21" y2="18" />
                                        </svg>
                                    </button>

                                    {activeTab === "overview" && (
                                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                            Welcome, {club.name}!
                                        </h1>
                                    )}

                                    {activeTab === "team" && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-black text-[#a2ff86] flex items-center justify-center border border-black shadow-[2px_2px_0px_#000]">
                                                <Users className="w-4 h-4 stroke-[2.5]" />
                                            </div>
                                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                                Club Team & Organisation
                                            </h1>
                                        </div>
                                    )}

                                    {activeTab === "events" && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-black text-[#38BDF8] flex items-center justify-center border border-black shadow-[2px_2px_0px_#000]">
                                                <CalendarDays className="w-4 h-4 stroke-[2.5]" />
                                            </div>
                                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                                Events & Workshops
                                            </h1>
                                        </div>
                                    )}

                                    {activeTab === "profile" && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-black text-[#FFE566] flex items-center justify-center border border-black shadow-[2px_2px_0px_#000]">
                                                <Edit3 className="w-4 h-4 stroke-[2.5]" />
                                            </div>
                                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                                Manage Club Profile
                                            </h1>
                                        </div>
                                    )}


                                    {activeTab === "clubs" && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-black text-[#a2ff86] flex items-center justify-center border border-black shadow-[2px_2px_0px_#000]">
                                                <Building2 className="w-4 h-4 stroke-[2.5]" />
                                            </div>
                                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                                Campus Chapters & Directory
                                            </h1>
                                        </div>
                                    )}

                                    {activeTab === "settings" && (
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-black text-[#a2ff86] flex items-center justify-center border border-black shadow-[2px_2px_0px_#000]">
                                                <Settings className="w-4 h-4 stroke-[2.5]" />
                                            </div>
                                            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                                Club Settings
                                            </h1>
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Contextual Badges & Subtitle */}
                                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                    {activeTab === "overview" && (
                                        <>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                Today, {formattedDate}
                                            </span>
                                            <span className="text-xs font-bold text-neutral-700 hidden sm:inline">
                                                · Verified Collegiate Club Space
                                            </span>
                                            <span className="text-xs font-bold text-neutral-500 hidden md:inline">
                                                · {club.college_name}
                                            </span>
                                        </>
                                    )}

                                    {activeTab === "team" && (
                                        <>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#a2ff86] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                Team Workspace
                                            </span>
                                            <span className="text-xs font-bold text-neutral-700">
                                                · Build your club's organisation, manage people, and assign departments
                                            </span>
                                        </>
                                    )}

                                    {activeTab === "events" && (
                                        <>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#38BDF8] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                Active Schedule
                                            </span>
                                            <span className="text-xs font-bold text-neutral-700">
                                                · Manage published sessions, drafts, and meetups
                                            </span>
                                        </>
                                    )}

                                    {activeTab === "profile" && (
                                        <>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                Public Branding
                                            </span>
                                            <span className="text-xs font-bold text-neutral-700">
                                                · Club narrative, contact details, socials and public showcase
                                            </span>
                                        </>
                                    )}

                                    {activeTab === "clubs" && (
                                        <>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                Campus Directory
                                            </span>
                                            <span className="text-xs font-bold text-neutral-700">
                                                · Discover student chapters, cross-club collaborations & peer initiatives
                                            </span>
                                            {club.college_name && (
                                                <span className="text-xs font-bold text-neutral-500 hidden md:inline">
                                                    · {club.college_name}
                                                </span>
                                            )}
                                        </>
                                    )}

                                    {activeTab === "settings" && (
                                        <>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                Settings & Preferences
                                            </span>
                                            <span className="text-xs font-bold text-neutral-700">
                                                · Organization credentials, collegiate verification & showcase privacy
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right: Tab-Specific Primary Actions & Inbox Bell */}
                            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap">
                                {activeTab === "events" && (
                                    <button
                                        type="button"
                                        onClick={() => openCreateEventModal("published")}
                                        className="px-4 py-2 sm:py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                                    >
                                        <Plus className="w-4 h-4 stroke-[2.5]" />
                                        <span>Create New Event</span>
                                    </button>
                                )}

                                {/* Club Notifications / Inbox Bell Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsInboxModalOpen(true)}
                                    className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white hover:bg-[#FFE566]/20 text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] hover:shadow-[3.5px_3.5px_0px_#000] transition-all cursor-pointer group active:translate-x-[1px] active:translate-y-[1px] select-none"
                                    title={`Club Notifications & Inbox ${inboxCounts.unreadCount > 0 ? `(${inboxCounts.unreadCount} unread)` : ""}`}
                                    aria-label="Club Notifications & Inbox"
                                >
                                    <Bell className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2] transition-transform duration-200 group-hover:rotate-12" />
                                    {inboxCounts.unreadCount > 0 && (
                                        <span className="absolute -top-2 -right-2 z-10 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-black leading-none text-black bg-[#FFE566] rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] pointer-events-none select-none">
                                            {inboxCounts.unreadCount > 99 ? "99+" : inboxCounts.unreadCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                        )}

                        {/* TAB: MANAGE CLUB PROFILE */}
                        {activeTab === "profile" && (
                            <ClubProfileManager
                                clubId={club.id}
                                onProfileUpdated={(updatedClub) => {
                                    if (updatedClub) {
                                        setClub(updatedClub as any);
                                    }
                                }}
                            />
                        )}

                        {/* TAB: DASHBOARD OVERVIEW */}
                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                {/* Club Identity Hero Card */}
                                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden flex items-center justify-center flex-shrink-0 font-black text-xl sm:text-2xl">
                                            {club.logo_url || club.logoUrl ? (
                                                <img src={club.logo_url || club.logoUrl || ""} alt={club.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{club.name.slice(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight truncate">
                                                    {club.name}
                                                </h2>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                                                    Verified Club
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-[10px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                    {club.category || "Student Club"}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm font-bold text-neutral-600 truncate">
                                                {club.college_name} · {club.college_city}, {club.college_state}
                                            </p>
                                            <p className="text-xs text-neutral-700 font-medium line-clamp-2 pt-1 max-w-2xl leading-relaxed">
                                                {club.short_description || "No headline description set yet. Click Manage Profile to add your club's mission, socials, and contact links."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Links Pill Box */}
                                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange("profile")}
                                            className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            <span>Edit Club Profile</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Overview Metrics Grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                    {/* Card 1: Upcoming Sessions */}
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange("events")}
                                        className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] text-left transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                                Upcoming Sessions
                                            </span>
                                            <div className="w-8 h-8 rounded-lg bg-[#38BDF8] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] group-hover:rotate-6 transition-transform">
                                                <CalendarDays className="w-4 h-4 text-black stroke-[2.5]" />
                                            </div>
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-black mt-2">
                                            {publishedEvents.length}
                                        </div>
                                        <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                                            {events.length} total event{events.length === 1 ? "" : "s"} scheduled
                                        </span>
                                    </button>

                                    {/* Card 2: Active Teams */}
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange("team")}
                                        className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] text-left transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                                Active Teams
                                            </span>
                                            <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] group-hover:rotate-6 transition-transform">
                                                <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                                            </div>
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-black mt-2">
                                            {teamStats?.activeTeams ?? 0}
                                        </div>
                                        <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                                            Departments & divisions
                                        </span>
                                    </button>

                                    {/* Card 3: Total Members */}
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange("team")}
                                        className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] text-left transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                                Club Members
                                            </span>
                                            <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] group-hover:rotate-6 transition-transform">
                                                <Users className="w-4 h-4 text-black stroke-[2.5]" />
                                            </div>
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-black mt-2">
                                            {teamStats?.totalMembers ?? 0}
                                        </div>
                                        <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                                            {teamPendingCount} pending invite{teamPendingCount === 1 ? "" : "s"}
                                        </span>
                                    </button>

                                    {/* Card 4: Club Inquiries / Inbox */}
                                    <button
                                        type="button"
                                        onClick={() => setIsInboxModalOpen(true)}
                                        className="p-4 sm:p-5 rounded-2xl bg-white hover:bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] text-left transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                                Inbox & Inquiries
                                            </span>
                                            <div className="w-8 h-8 rounded-lg bg-[#FF80D7] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000] group-hover:rotate-6 transition-transform">
                                                <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                                            </div>
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-black mt-2">
                                            {inboxCounts.unreadCount}
                                        </div>
                                        <span className="text-[11px] text-neutral-600 font-bold mt-1 block">
                                            {inboxCounts.totalCount} total developer message{inboxCounts.totalCount === 1 ? "" : "s"}
                                        </span>
                                    </button>
                                </div>

                                {/* Quick Management Hub Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Hub Card 1: Team Management */}
                                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                    <Users className="w-5 h-5 text-black stroke-[2.5]" />
                                                </div>
                                                <h3 className="text-base sm:text-lg font-black text-black">
                                                    Team & Organisation Workspace
                                                </h3>
                                            </div>
                                            <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                                Build your club's organizational hierarchy, create departments (Technical, Design, PR, Operations), invite registered Orbix users by username, and appoint team leads.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange("team")}
                                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] self-start"
                                        >
                                            <span>Open Team Workspace</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Hub Card 2: Events & Workshops */}
                                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-[#38BDF8] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                                    <CalendarDays className="w-5 h-5 text-black stroke-[2.5]" />
                                                </div>
                                                <h3 className="text-base sm:text-lg font-black text-black">
                                                    Events & Workshops Hub
                                                </h3>
                                            </div>
                                            <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                                Publish upcoming hackathons, tech talks, workshops, and manage draft agendas with location details, RSVP registration links, and live visibility.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => handleTabChange("events")}
                                                className="px-4 py-2.5 rounded-xl bg-black text-[#38BDF8] hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                            >
                                                <span>Manage All Events</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openCreateEventModal("published")}
                                                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>New Event</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Events Preview */}
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-black" />
                                            <h3 className="text-base font-black text-black">Recent & Upcoming Sessions</h3>
                                        </div>
                                        {events.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleTabChange("events")}
                                                className="text-xs font-black text-black hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                                <span>View All ({events.length})</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>

                                    {events.length === 0 ? (
                                        <div className="py-8 text-center space-y-2">
                                            <CalendarDays className="w-8 h-8 text-neutral-400 mx-auto" />
                                            <p className="text-xs font-bold text-neutral-700">No events or workshops published yet.</p>
                                            <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                                                Begin scheduling sessions, coding meetups, or hackathons for your chapter.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => openCreateEventModal("published")}
                                                className="mt-2 px-4 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5"
                                            >
                                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                                <span>Create First Event</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {events.slice(0, 3).map((ev) => (
                                                <div
                                                    key={ev.id}
                                                    className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between space-y-2"
                                                >
                                                    <div>
                                                        {ev.coverImageUrl && (
                                                            <div className="w-full h-24 rounded-lg border border-black overflow-hidden mb-2 bg-neutral-100 shadow-[1px_1px_0px_#000]">
                                                                <img src={ev.coverImageUrl} alt={ev.title} className="w-full h-full object-cover" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-black ${
                                                                    ev.status === "published"
                                                                        ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                                                        : ev.status === "draft"
                                                                        ? "bg-amber-200 text-black shadow-[1px_1px_0px_#000]"
                                                                        : "bg-rose-200 text-black shadow-[1px_1px_0px_#000]"
                                                                }`}
                                                            >
                                                                {ev.status}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                })}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-black text-sm text-black truncate">{ev.title}</h4>
                                                        <p className="text-xs text-neutral-600 line-clamp-2 mt-1">
                                                            {ev.summary || ev.description || "No description."}
                                                        </p>
                                                    </div>
                                                    <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] text-neutral-600">
                                                        <span className="truncate font-bold flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-neutral-500" />
                                                            {ev.venueOrLocation || "Campus"}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                handleTabChange("events");
                                                                handleEditEvent(ev);
                                                            }}
                                                            className="font-black text-black hover:underline cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB: CLUB TEAM & ORGANISATION */}
                        {activeTab === "team" && (
                            <ClubTeamWorkspace
                                club={club}
                                hideHeaderTitle={true}
                                onOpenInbox={() => setIsInboxModalOpen(true)}
                                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                                onStatsLoaded={(stats: TeamStats) => {
                                    setTeamStats(stats);
                                    if (typeof stats.pendingInvitations === "number") {
                                        setTeamPendingCount(stats.pendingInvitations);
                                    }
                                }}
                            />
                        )}

                        {/* TAB: CLUB EVENTS & WORKSHOPS (EXCLUSIVELY FOR EVENTS TAB) */}
                        {activeTab === "events" && (
                            eventId ? (
                                <ClubEventDetailWorkspace
                                    eventId={eventId}
                                    club={club}
                                    onBack={() => navigate("/club/events")}
                                    onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                                />
                            ) : (
                                <div className="space-y-6">
                                    {/* Event Analytics Deck (Turnout, 4-Month Trend Graph, Lifecycle Stages & Event Matrix) */}
                                <ClubEventAnalyticsSection
                                    events={events}
                                    currentFilter={eventFilter}
                                    onSelectFilter={(f) => setEventFilter(f)}
                                    onOpenCreateModal={() => openCreateEventModal("published")}
                                />

                                {/* Filter Pills Bar */}
                                <div className="p-3 sm:p-4 rounded-2xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("all")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "all"
                                                    ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            All ({events.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("published")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "published"
                                                    ? "bg-emerald-300 text-black shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            Published ({publishedEvents.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("completed")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "completed"
                                                    ? "bg-sky-300 text-black shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            Completed ({completedEvents.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("draft")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "draft"
                                                    ? "bg-amber-300 text-black shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            Drafts ({draftEvents.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("cancelled")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "cancelled"
                                                    ? "bg-rose-300 text-black shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            Cancelled ({cancelledEvents.length})
                                        </button>
                                    </div>

                                    <span className="text-xs font-bold text-neutral-500">
                                        Showing {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}
                                    </span>
                                </div>

                                {/* Event Cards Grid */}
                                {filteredEvents.length === 0 ? (
                                    <div className="p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                                        <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
                                        <h3 className="font-black text-base text-neutral-800">
                                            No {eventFilter !== "all" ? eventFilter : ""} events found
                                        </h3>
                                        <p className="text-xs font-medium text-neutral-500 max-w-sm mx-auto">
                                            {eventFilter === "cancelled"
                                                ? "No sessions have been cancelled."
                                                : eventFilter === "draft"
                                                ? "You have no events saved as drafts."
                                                : "Create workshops, hackathons, and guest speaker sessions for your chapter."}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => openCreateEventModal("published")}
                                            className="mt-2 px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4 stroke-[2.5]" />
                                            <span>Create New Event</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {filteredEvents.map((ev) => (
                                            <div
                                                key={ev.id}
                                                onClick={() => navigate(`/club/events/${ev.id}`)}
                                                className="p-5 sm:p-6 rounded-3xl bg-white border-4 border-black shadow-[4px_4px_0px_#000] hover:shadow-[7px_7px_0px_#000] hover:-translate-y-1 hover:-translate-x-1 transition-all cursor-pointer flex flex-col justify-between group"
                                            >
                                                <div>
                                                    {/* Cover Banner if attached */}
                                                    {ev.coverImageUrl && (
                                                        <div className="w-full h-40 sm:h-48 rounded-2xl border-2 border-black overflow-hidden mb-3.5 relative bg-neutral-100 shadow-[2px_2px_0px_#000]">
                                                            <img
                                                                src={ev.coverImageUrl}
                                                                alt={ev.title}
                                                                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                                                            />
                                                            {ev.isOptimistic && (
                                                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white border border-black shadow-[1px_1px_0px_#000] animate-pulse">
                                                                    Syncing...
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black ${
                                                                    ev.status === "published"
                                                                        ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                                                        : ev.status === "completed"
                                                                        ? "bg-sky-200 text-black shadow-[1px_1px_0px_#000]"
                                                                        : ev.status === "draft"
                                                                        ? "bg-amber-200 text-black shadow-[1px_1px_0px_#000]"
                                                                        : "bg-rose-200 text-black shadow-[1px_1px_0px_#000]"
                                                                }`}
                                                            >
                                                                {ev.status === "published"
                                                                    ? "Published (Live)"
                                                                    : ev.status === "completed"
                                                                    ? "Completed"
                                                                    : ev.status === "draft"
                                                                    ? "Draft"
                                                                    : "Cancelled"}
                                                            </span>
                                                            {!ev.coverImageUrl && ev.isOptimistic && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white border border-black shadow-[1px_1px_0px_#000] animate-pulse">
                                                                    Syncing...
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-bold text-neutral-500 flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-base sm:text-lg font-black text-neutral-900 line-clamp-1 group-hover:text-black transition-colors">
                                                        {ev.title}
                                                    </h3>
                                                    <p className="text-xs text-neutral-600 line-clamp-2 mt-1.5 leading-relaxed">
                                                        {ev.summary || ev.description || "No description provided."}
                                                    </p>

                                                    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-600 font-medium">
                                                        <span className="flex items-center gap-1 font-bold">
                                                            <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                                                            {ev.venueOrLocation || (ev.locationType === "virtual" ? "Virtual (Online)" : ev.locationType === "hybrid" ? "Hybrid" : "Campus Hall")}
                                                        </span>
                                                        {ev.registrationUrl && (
                                                            <span className="text-emerald-700 flex items-center gap-1 font-bold">
                                                                <span>RSVP Enabled</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Event-wise Key Analytics Metrics */}
                                                    <div className="mt-3 flex items-center gap-2 text-xs font-bold flex-wrap">
                                                        <span className="inline-flex items-center gap-1 text-sky-950 bg-sky-50 px-2 py-0.5 rounded-md border border-black/20">
                                                            <Users className="w-3 h-3 text-sky-700 stroke-[2.5]" />
                                                            <span>{ev.registrationsCount || 0} RSVPs</span>
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-md border border-black/20">
                                                            <UserCheck className="w-3 h-3 text-emerald-700 stroke-[2.5]" />
                                                            <span>{ev.attendeesCount || 0} Attended</span>
                                                        </span>
                                                        {(ev.rejectedCount ?? 0) > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-rose-950 bg-rose-50 px-2 py-0.5 rounded-md border border-black/20">
                                                                <span>{ev.rejectedCount} Rejected</span>
                                                            </span>
                                                        )}
                                                        {(Number(ev.registrationsCount) || 0) > 0 && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#FAF6EE] text-black text-[10px] font-black border border-black/30">
                                                                {Math.round(((Number(ev.attendeesCount) || 0) / (Number(ev.registrationsCount) || 1)) * 100)}% Turnout
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Clean Action Footer: clicking navigates to dedicated event console */}
                                                <div className="mt-5 pt-3.5 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                                    <span className="text-xs font-bold text-neutral-500 group-hover:text-black transition-colors">
                                                        Manage roster, agenda & analytics
                                                    </span>

                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] group-hover:bg-[#8ee673] group-hover:translate-x-0.5 transition-all shrink-0">
                                                        <span>Open Event</span>
                                                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            )
                        )}


                        {/* TAB: CAMPUS CLUBS & DIRECTORY */}
                        {activeTab === "clubs" && (
                            <OtherClubsSection
                                currentClubId={club.id}
                                currentClubSlug={club.slug}
                                collegeId={(club as any).college_id || (club as any).collegeId}
                                collegeName={club.college_name}
                                currentClubData={club}
                                onNavigateToEditProfile={() => handleTabChange("profile")}
                                onNavigateToTab={handleTabChange}
                            />
                        )}

                        {/* TAB: CLUB SETTINGS & PREFERENCES */}
                        {activeTab === "settings" && (
                            <ClubSettingsView
                                club={club}
                                user={user}
                                onSignOut={handleSignOut}
                            />
                        )}
                    </div>

                    {/* Neo-brutalist Section Bottom Illustration matching Personal Account */}
                    <SectionBottomIllustration alt="Orbix club space illustration" />
                </section>
            </div>

            {/* Club Inbox Modal */}
            <ClubInboxModal
                isOpen={isInboxModalOpen}
                onClose={() => {
                    setIsInboxModalOpen(false);
                    if (location.pathname === "/club/inbox") {
                        navigate("/club/dashboard", { replace: true });
                    }
                    fetchInboxCounts();
                }}
                clubId={club.id}
                clubName={club.name}
                onUnreadCountChange={(newCount) => setInboxCounts((prev) => ({ ...prev, unreadCount: newCount }))}
            />

            {/* Full-Screen Club Event Modal with Banner Import & 50/50 Layout */}
            <ClubEventModal
                isOpen={isEventModalOpen}
                onClose={() => {
                    setIsEventModalOpen(false);
                    setEditingEvent(null);
                }}
                onSubmit={handleModalSubmit}
                editingEvent={editingEvent}
                clubId={club?.id}
                clubName={club?.name}
                clubLogoUrl={club?.logo_url || undefined}
                collegeName={club?.college_name}
                collegeId={club?.college_id}
                initialStatus={initialModalStatus}
            />
        </div>
    );
}
