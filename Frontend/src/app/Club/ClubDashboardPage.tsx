import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Calendar,
    CalendarDays,
    Plus,
    Edit3,
    Trash2,
    Clock,
    MapPin,
    X,
    Bell,
    ExternalLink,
    CheckCircle2,
    Ban,
    FileText,
    Users,
    ShieldCheck,
    ArrowRight,
    Building2,
    Mail,
    Settings,
} from "lucide-react";
import { useAppDispatch, useAppSelector, clearUser, fetchClubProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import { NeoSelect } from "../../components/NeoSelect";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { ClubSidebar, type ClubTab } from "./ClubSidebar";
import ClubInboxModal from "./ClubInboxModal";
import { ClubTeamWorkspace } from "./Team/ClubTeamWorkspace";
import type { TeamStats } from "./Team/types";
import { ClubProfileManager } from "./Profile/ClubProfileManager";
import { ClubSettingsView } from "./Settings/ClubSettingsView";

interface VerifiedClub {
    id: string;
    auth_user_id: string;
    name: string;
    slug: string;
    clubUsername?: string;
    category: string;
    college_name: string;
    college_city: string;
    college_state: string;
    college_country: string;
    short_description: string | null;
    about: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
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

interface ClubEvent {
    id: string;
    clubId: string;
    title: string;
    slug: string;
    summary: string | null;
    description: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation: string | null;
    registrationUrl: string | null;
    coverImageUrl: string | null;
    status: "draft" | "published" | "cancelled";
    publishedAt: string | null;
    createdAt: string;
}

export default function ClubDashboardPage() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);
    const toast = useToast();

    // Centralized Redux club state
    const clubState = useAppSelector((state) => state.club);

    // Data States (initialized immediately from Redux if already in memory)
    const [club, setClub] = useState<VerifiedClub | null>(clubState.club as any);
    const [, setStats] = useState<ClubStats>(clubState.stats || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });
    const [events, setEvents] = useState<ClubEvent[]>([]);
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

    // Navigation & URL Tab Sync
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get("tab") as ClubTab | null;
    const initialTab: ClubTab = (tabFromUrl === "team" || tabFromUrl === "events" || tabFromUrl === "profile" || tabFromUrl === "settings") ? tabFromUrl : "overview";
    const [activeTab, setActiveTabState] = useState<ClubTab>(initialTab);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // Switch tab and sync with URL query param
    const handleTabChange = (tab: ClubTab) => {
        setActiveTabState(tab);
        if (tab === "overview") {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("tab");
                return next;
            }, { replace: true });
        } else {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("tab", tab);
                return next;
            }, { replace: true });
        }
    };

    // Update activeTab when browser back/forward or deep-link changes
    useEffect(() => {
        const currentTab = searchParams.get("tab") as ClubTab | null;
        if (currentTab === "team" || currentTab === "events" || currentTab === "profile" || currentTab === "settings") {
            setActiveTabState(currentTab);
        } else {
            setActiveTabState("overview");
        }
    }, [searchParams]);

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
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventForm, setEventForm] = useState({
        title: "",
        summary: "",
        description: "",
        startsAt: "",
        endsAt: "",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as "in_person" | "virtual" | "hybrid",
        venueOrLocation: "",
        registrationUrl: "",
        coverImageUrl: "",
        status: "published" as "draft" | "published" | "cancelled",
    });
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [eventFilter, setEventFilter] = useState<"all" | "published" | "draft" | "cancelled">("all");

    // Fetch club profile and events (leveraging Redux and Redis caching)
    const fetchClubData = async (force = false) => {
        try {
            if (!clubState.isInitialized || force) {
                setLoading(true);
            }
            const [profileResult, eventsRes] = await Promise.allSettled([
                dispatch(fetchClubProfile({ force })).unwrap(),
                fetch("/api/club/events", { credentials: "include" }).then((r) => r.json()),
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
                    navigate("/clubs/status", { replace: true });
                    return;
                }
            }

            if (eventsRes.status === "fulfilled" && eventsRes.value?.success && Array.isArray(eventsRes.value.events)) {
                setEvents(eventsRes.value.events);
            }
        } catch (err) {
            console.error("Failed to load club dashboard:", err);
            toast.error("Could not load club dashboard. Please refresh.", { title: "Error" });
        } finally {
            setLoading(false);
        }
    };

    // Fetch inbox unread count
    const fetchInboxCounts = async () => {
        try {
            const res = await fetch("/api/club/inbox/unread-count", { credentials: "include" });
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
    const openCreateEventModal = (initialStatus: "draft" | "published" = "published") => {
        setEditingEventId(null);
        setEventForm({
            title: "",
            summary: "",
            description: "",
            startsAt: "",
            endsAt: "",
            timezone: "Asia/Kolkata",
            locationType: "in_person",
            venueOrLocation: "",
            registrationUrl: "",
            coverImageUrl: "",
            status: initialStatus,
        });
        setIsEventModalOpen(true);
    };

    // Open Event Edit Modal
    const handleEditEvent = (ev: ClubEvent) => {
        setEditingEventId(ev.id);
        const formatForInput = (isoStr: string | null) => {
            if (!isoStr) return "";
            const d = new Date(isoStr);
            const pad = (n: number) => (n < 10 ? `0${n}` : n);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        setEventForm({
            title: ev.title,
            summary: ev.summary || "",
            description: ev.description || "",
            startsAt: formatForInput(ev.startsAt),
            endsAt: formatForInput(ev.endsAt),
            timezone: ev.timezone || "Asia/Kolkata",
            locationType: ev.locationType || "in_person",
            venueOrLocation: ev.venueOrLocation || "",
            registrationUrl: ev.registrationUrl || "",
            coverImageUrl: ev.coverImageUrl || "",
            status: ev.status,
        });
        setIsEventModalOpen(true);
    };

    // Handle Event Save (Create or Edit)
    const handleSaveEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventForm.title.trim()) {
            toast.error("Event title is required.", { title: "Validation Error" });
            return;
        }
        if (!eventForm.startsAt) {
            toast.error("Event start date and time is required.", { title: "Validation Error" });
            return;
        }

        setIsSavingEvent(true);
        try {
            const url = editingEventId ? `/api/club/events/${editingEventId}` : "/api/club/events";
            const method = editingEventId ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: eventForm.title,
                    summary: eventForm.summary || null,
                    description: eventForm.description || null,
                    startsAt: new Date(eventForm.startsAt).toISOString(),
                    endsAt: eventForm.endsAt ? new Date(eventForm.endsAt).toISOString() : null,
                    timezone: eventForm.timezone,
                    locationType: eventForm.locationType,
                    venueOrLocation: eventForm.venueOrLocation || null,
                    registrationUrl: eventForm.registrationUrl || null,
                    coverImageUrl: eventForm.coverImageUrl || null,
                    status: eventForm.status,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to save event.");
            }

            toast.success(
                editingEventId ? "Event updated successfully!" : "New event created successfully!",
                { title: "Success" }
            );

            setIsEventModalOpen(false);
            setEditingEventId(null);
            fetchClubData();
        } catch (err: any) {
            console.error("Save event error:", err);
            toast.error(err.message || "Failed to save event.", { title: "Error" });
        } finally {
            setIsSavingEvent(false);
        }
    };

    // Handle Delete Event
    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm("Are you sure you want to permanently delete this event?")) return;

        try {
            const res = await fetch(`/api/club/events/${eventId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to delete event.");

            toast.success("Event deleted successfully.", { title: "Deleted" });
            fetchClubData();
        } catch (err: any) {
            console.error("Delete event error:", err);
            toast.error(err.message || "Failed to delete event.", { title: "Error" });
        }
    };

    // Handle Quick Status Changes (Publish, Draft, Cancel)
    const handleSetEventStatus = async (ev: ClubEvent, nextStatus: "draft" | "published" | "cancelled") => {
        try {
            const res = await fetch(`/api/club/events/${ev.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to change status.");

            const statusLabel =
                nextStatus === "published"
                    ? "published live"
                    : nextStatus === "cancelled"
                    ? "marked as cancelled"
                    : "moved to draft";
            toast.success(`Event is now ${statusLabel}.`, { title: "Status Updated" });
            fetchClubData();
        } catch (err: any) {
            console.error("Update status error:", err);
            toast.error(err.message || "Failed to update event status.", { title: "Error" });
        }
    };

    // Event subsets
    const publishedEvents = useMemo(() => events.filter((e) => e.status === "published"), [events]);
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
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center text-neutral-900 font-sans">
                <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl border-2 border-black shadow-[4px_4px_0px_#000]">
                    <div className="w-10 h-10 border-4 border-black border-t-[#a2ff86] rounded-full animate-spin" />
                    <p className="text-xs font-black tracking-wider uppercase">Loading Club Space...</p>
                </div>
            </div>
        );
    }

    if (!club) {
        return null;
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
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                        {/* Dynamic Header Bar tailored to each tab */}
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
                                                · {events.length} Total Sessions · Manage published sessions, drafts, and meetups
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
                                        <span>+ Create New Event</span>
                                    </button>
                                )}

                                {/* Club Notifications / Inbox Bell Button */}
                                <button
                                    type="button"
                                    onClick={() => setIsInboxModalOpen(true)}
                                    className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer group active:translate-x-[1px] active:translate-y-[1px]"
                                    title={`Club Notifications & Inbox ${inboxCounts.unreadCount > 0 ? `(${inboxCounts.unreadCount} unread)` : ""}`}
                                    aria-label="Club Notifications & Inbox"
                                >
                                    <Bell className="w-5.5 h-5.5 sm:w-6 sm:h-6 stroke-[2.3] transition-transform group-hover:rotate-6" />
                                    {inboxCounts.unreadCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-black leading-none text-black bg-[#FF6B6B] rounded-full border-2 border-black shadow-[1px_1px_0px_#000] animate-pulse">
                                            {inboxCounts.unreadCount > 99 ? "99+" : inboxCounts.unreadCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* TAB: MANAGE CLUB PROFILE */}
                        {activeTab === "profile" && (
                            <ClubProfileManager
                                clubId={club.id}
                                onProfileUpdated={fetchClubData}
                            />
                        )}

                        {/* TAB: DASHBOARD OVERVIEW */}
                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                {/* Club Identity Hero Card */}
                                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex items-start sm:items-center gap-4 min-w-0">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden flex items-center justify-center flex-shrink-0 font-black text-xl sm:text-2xl">
                                            {club.logo_url ? (
                                                <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
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
                            <div className="space-y-6">
                                {/* Header Card with Title and Prominent + Create New Event Button */}
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-6 h-6 text-black" />
                                            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                                                Club Events & Workshops
                                            </h2>
                                        </div>
                                        <p className="text-xs sm:text-sm font-bold text-neutral-600">
                                            Manage your chapter's published sessions, drafts, cancelled meetups, and create new events.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openCreateEventModal("published")}
                                        className="px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                                    >
                                        <Plus className="w-4 h-4 stroke-[2.5]" />
                                        <span>+ Create New Event</span>
                                    </button>
                                </div>

                                {/* Quick Metric Summary Cards Row */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                    {/* Metric 1: Total */}
                                    <button
                                        type="button"
                                        onClick={() => setEventFilter("all")}
                                        className={`p-4 rounded-xl border-2 border-black transition-all text-left cursor-pointer ${
                                            eventFilter === "all"
                                                ? "bg-black text-[#a2ff86] shadow-[3px_3px_0px_#000]"
                                                : "bg-white hover:bg-[#FAF6EE] text-neutral-900 shadow-[2px_2px_0px_#000]"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${
                                                eventFilter === "all" ? "text-neutral-300" : "text-neutral-500"
                                            }`}>
                                                Total Sessions
                                            </span>
                                            <Calendar className="w-4 h-4 opacity-70" />
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black mt-2">
                                            {events.length}
                                        </div>
                                    </button>

                                    {/* Metric 2: Published */}
                                    <button
                                        type="button"
                                        onClick={() => setEventFilter("published")}
                                        className={`p-4 rounded-xl border-2 border-black transition-all text-left cursor-pointer ${
                                            eventFilter === "published"
                                                ? "bg-emerald-300 text-black shadow-[3px_3px_0px_#000] font-black"
                                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-950 shadow-[2px_2px_0px_#000]"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-900">
                                                Published
                                            </span>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-neutral-900 mt-2">
                                            {publishedEvents.length}
                                        </div>
                                    </button>

                                    {/* Metric 3: Draft */}
                                    <button
                                        type="button"
                                        onClick={() => setEventFilter("draft")}
                                        className={`p-4 rounded-xl border-2 border-black transition-all text-left cursor-pointer ${
                                            eventFilter === "draft"
                                                ? "bg-amber-300 text-black shadow-[3px_3px_0px_#000] font-black"
                                                : "bg-amber-50 hover:bg-amber-100 text-amber-950 shadow-[2px_2px_0px_#000]"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-900">
                                                Drafts
                                            </span>
                                            <FileText className="w-4 h-4 text-amber-700" />
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-neutral-900 mt-2">
                                            {draftEvents.length}
                                        </div>
                                    </button>

                                    {/* Metric 4: Cancelled */}
                                    <button
                                        type="button"
                                        onClick={() => setEventFilter("cancelled")}
                                        className={`p-4 rounded-xl border-2 border-black transition-all text-left cursor-pointer ${
                                            eventFilter === "cancelled"
                                                ? "bg-rose-300 text-black shadow-[3px_3px_0px_#000] font-black"
                                                : "bg-rose-50 hover:bg-rose-100 text-rose-950 shadow-[2px_2px_0px_#000]"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-900">
                                                Cancelled
                                            </span>
                                            <Ban className="w-4 h-4 text-rose-700" />
                                        </div>
                                        <div className="text-2xl sm:text-3xl font-black text-neutral-900 mt-2">
                                            {cancelledEvents.length}
                                        </div>
                                    </button>
                                </div>

                                {/* Filter Pills Bar */}
                                <div className="p-3 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("all")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "all"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
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
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            Published ({publishedEvents.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEventFilter("draft")}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === "draft"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
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
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
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
                                            className="mt-2 px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            + Create New Event
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {filteredEvents.map((ev) => (
                                            <div
                                                key={ev.id}
                                                className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black ${
                                                                ev.status === "published"
                                                                    ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                                                    : ev.status === "draft"
                                                                    ? "bg-amber-200 text-black shadow-[1px_1px_0px_#000]"
                                                                    : "bg-rose-200 text-black shadow-[1px_1px_0px_#000]"
                                                            }`}
                                                        >
                                                            {ev.status === "published"
                                                                ? "Published"
                                                                : ev.status === "draft"
                                                                ? "Draft"
                                                                : "Cancelled"}
                                                        </span>
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

                                                    <h3 className="text-base sm:text-lg font-black text-neutral-900 line-clamp-1">
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
                                                            <a
                                                                href={ev.registrationUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                                                            >
                                                                <span>RSVP / Registration Link</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div className="mt-5 pt-3.5 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {/* Status Toggles */}
                                                        {ev.status === "published" && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetEventStatus(ev, "draft")}
                                                                    className="px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black bg-amber-100 hover:bg-amber-200 text-amber-950 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                                >
                                                                    To Draft
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetEventStatus(ev, "cancelled")}
                                                                    className="px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-950 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                                >
                                                                    Cancel Event
                                                                </button>
                                                            </>
                                                        )}

                                                        {ev.status === "draft" && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetEventStatus(ev, "published")}
                                                                    className="px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black bg-emerald-200 hover:bg-emerald-300 text-emerald-950 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                                >
                                                                    Publish Live
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetEventStatus(ev, "cancelled")}
                                                                    className="px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-950 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                                >
                                                                    Cancel Event
                                                                </button>
                                                            </>
                                                        )}

                                                        {ev.status === "cancelled" && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetEventStatus(ev, "draft")}
                                                                    className="px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black bg-amber-100 hover:bg-amber-200 text-amber-950 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                                >
                                                                    Restore to Draft
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSetEventStatus(ev, "published")}
                                                                    className="px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black bg-emerald-200 hover:bg-emerald-300 text-emerald-950 shadow-[1px_1px_0px_#000] cursor-pointer"
                                                                >
                                                                    Publish Live
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* Edit Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditEvent(ev)}
                                                            className="px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-black border-2 border-black shadow-[1px_1px_0px_#000] cursor-pointer flex items-center gap-1"
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                            <span>Edit</span>
                                                        </button>
                                                    </div>

                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteEvent(ev.id)}
                                                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border-2 border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                                                        title="Delete Event"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                    fetchInboxCounts();
                }}
                clubId={club.id}
                clubName={club.name}
                onUnreadCountChange={(newCount) => setInboxCounts((prev) => ({ ...prev, unreadCount: newCount }))}
            />

            {/* Event Create / Edit Modal */}
            {isEventModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="w-full max-w-xl bg-white rounded-3xl border-2 border-black shadow-[8px_8px_0px_#000] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                            <div>
                                <h3 className="font-black text-base text-neutral-900">
                                    {editingEventId ? "Edit Event" : "Create New Club Event"}
                                </h3>
                                <p className="text-xs text-neutral-500 font-medium">
                                    Publish or draft workshops, hackathons, and chapter meetups.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEventModalOpen(false)}
                                className="p-1 rounded-lg border-2 border-black hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEvent} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Event Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={eventForm.title}
                                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                                    placeholder="e.g. Intro to Web3 & Smart Contracts Workshop"
                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Starts At *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={eventForm.startsAt}
                                        onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Ends At (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={eventForm.endsAt}
                                        onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Location Type
                                    </label>
                                    <NeoSelect
                                        value={eventForm.locationType}
                                        onChange={(val) => setEventForm({ ...eventForm, locationType: val as any })}
                                        options={[
                                            { value: "in_person", label: "In-Person (Campus)" },
                                            { value: "virtual", label: "Virtual (Online Link)" },
                                            { value: "hybrid", label: "Hybrid" },
                                        ]}
                                        size="sm"
                                        className="w-full"
                                        triggerClassName="h-9 font-bold bg-[#FAF6EE] text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Venue or Location Details
                                    </label>
                                    <input
                                        type="text"
                                        value={eventForm.venueOrLocation}
                                        onChange={(e) => setEventForm({ ...eventForm, venueOrLocation: e.target.value })}
                                        placeholder="e.g. Auditorium Hall B / Zoom link"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Registration / RSVP URL
                                </label>
                                <input
                                    type="url"
                                    value={eventForm.registrationUrl}
                                    onChange={(e) => setEventForm({ ...eventForm, registrationUrl: e.target.value })}
                                    placeholder="https://forms.gle/... or https://unstop.com/..."
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Cover Image URL
                                </label>
                                <input
                                    type="url"
                                    value={eventForm.coverImageUrl}
                                    onChange={(e) => setEventForm({ ...eventForm, coverImageUrl: e.target.value })}
                                    placeholder="https://.../poster.jpg"
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Brief Summary (1-2 sentences)
                                </label>
                                <input
                                    type="text"
                                    value={eventForm.summary}
                                    onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })}
                                    placeholder="A hands-on session covering problem solving techniques..."
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Full Description & Agenda
                                </label>
                                <textarea
                                    rows={3}
                                    value={eventForm.description}
                                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                                    placeholder="Prerequisites, schedule, speaker details, and certificate info..."
                                    className="w-full p-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Publish Status
                                </label>
                                <NeoSelect
                                    value={eventForm.status}
                                    onChange={(val) => setEventForm({ ...eventForm, status: val as any })}
                                    options={[
                                        { value: "published", label: "Published (Live for Registrations)" },
                                        { value: "draft", label: "Draft (Saved internally)" },
                                        { value: "cancelled", label: "Cancelled (Session Cancelled)" },
                                    ]}
                                    size="sm"
                                    className="w-full"
                                    triggerClassName="h-9 font-bold bg-[#FAF6EE] text-xs"
                                />
                            </div>

                            <div className="pt-3 border-t-2 border-black/10 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEventModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border-2 border-black text-xs font-bold hover:bg-neutral-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEvent}
                                    className="px-5 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    {isSavingEvent ? "Saving..." : editingEventId ? "Update Event" : "Create Event"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
