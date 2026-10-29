import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    Calendar,
    Globe,
    ExternalLink,
    Copy,
    Check,
    Plus,
    Edit3,
    Trash2,
    Clock,
    MapPin,
    Save,
    X,
    Building2,
    ChevronRight,
    Mail,
} from "lucide-react";
import { useAppDispatch, clearUser } from "../../store";
import { useToast } from "../../context/ToastContext";
import { NeoSelect } from "../../components/NeoSelect";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { ClubSidebar } from "./ClubSidebar";
import ClubInboxModal from "./ClubInboxModal";

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
    const toast = useToast();

    // Data States
    const [club, setClub] = useState<VerifiedClub | null>(null);
    const [stats, setStats] = useState<ClubStats>({ upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });
    const [events, setEvents] = useState<ClubEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Navigation & UI States
    const [activeTab, setActiveTab] = useState<"overview" | "profile" | "events">("overview");
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [copiedSlug, setCopiedSlug] = useState(false);

    // Club Inbox & Moderation States
    const [isInboxModalOpen, setIsInboxModalOpen] = useState(false);
    const [inboxCounts, setInboxCounts] = useState<{ unreadCount: number; mutedCount: number; totalCount: number }>({
        unreadCount: 0,
        mutedCount: 0,
        totalCount: 0,
    });

    // Profile Edit State
    const [profileForm, setProfileForm] = useState({
        shortDescription: "",
        about: "",
        logoUrl: "",
        coverImageUrl: "",
        websiteUrl: "",
        publicEmail: "",
        socialGithub: "",
        socialLinkedin: "",
        socialInstagram: "",
        socialX: "",
        socialDiscord: "",
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

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
        status: "published" as "draft" | "published",
    });
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [eventFilter, setEventFilter] = useState<"all" | "published" | "draft" | "cancelled">("all");

    // Fetch club profile and events
    const fetchClubData = async () => {
        try {
            setLoading(true);
            const [profileRes, eventsRes] = await Promise.all([
                fetch("/api/club/profile", { credentials: "include" }),
                fetch("/api/club/events", { credentials: "include" }),
            ]);

            if (profileRes.status === 401) {
                navigate("/auth/signin", { replace: true });
                return;
            }

            if (profileRes.status === 403 || profileRes.status === 404) {
                navigate("/clubs/status", { replace: true });
                return;
            }

            const profileData = await profileRes.json();
            const eventsData = await eventsRes.json().catch(() => ({}));

            if (profileData.success && profileData.club) {
                setClub(profileData.club);
                setStats(profileData.stats || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });

                // Initialize Profile Form
                const c = profileData.club;
                const sl = c.social_links || {};
                setProfileForm({
                    shortDescription: c.short_description || "",
                    about: c.about || "",
                    logoUrl: c.logo_url || "",
                    coverImageUrl: c.cover_image_url || "",
                    websiteUrl: c.website_url || "",
                    publicEmail: c.public_email || "",
                    socialGithub: sl.github || "",
                    socialLinkedin: sl.linkedin || "",
                    socialInstagram: sl.instagram || "",
                    socialX: sl.x || sl.twitter || "",
                    socialDiscord: sl.discord || "",
                });
            }

            if (eventsData.success && Array.isArray(eventsData.events)) {
                setEvents(eventsData.events);
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
        } catch (err) {
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

    // Copy public club URL
    const handleCopyPublicLink = () => {
        if (!club) return;
        const clubHandle = club.clubUsername || club.slug;
        const url = `${window.location.origin}/clubs/${clubHandle}`;
        navigator.clipboard.writeText(url);
        setCopiedSlug(true);
        toast.success("Public club profile link copied to clipboard!", { title: "Link Copied" });
        setTimeout(() => setCopiedSlug(false), 2500);
    };

    // Handle Profile Save
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);

        try {
            const res = await fetch("/api/club/profile", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shortDescription: profileForm.shortDescription,
                    about: profileForm.about,
                    logoUrl: profileForm.logoUrl || null,
                    coverImageUrl: profileForm.coverImageUrl || null,
                    websiteUrl: profileForm.websiteUrl || null,
                    publicEmail: profileForm.publicEmail || null,
                    socialLinks: {
                        github: profileForm.socialGithub || undefined,
                        linkedin: profileForm.socialLinkedin || undefined,
                        instagram: profileForm.socialInstagram || undefined,
                        x: profileForm.socialX || undefined,
                        discord: profileForm.socialDiscord || undefined,
                    },
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to update profile.");
            }

            toast.success("Public club profile updated successfully!", { title: "Saved" });
            setClub(data.club);
        } catch (err: any) {
            console.error("Save profile error:", err);
            toast.error(err.message || "Failed to update club profile.", { title: "Error" });
        } finally {
            setIsSavingProfile(false);
        }
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
            status: ev.status === "draft" ? "draft" : "published",
        });
        setIsEventModalOpen(true);
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

    // Handle Quick Toggle Status
    const handleToggleEventStatus = async (ev: ClubEvent) => {
        const newStatus = ev.status === "published" ? "draft" : "published";
        try {
            const res = await fetch(`/api/club/events/${ev.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to change status.");

            toast.success(`Event is now ${newStatus === "published" ? "published live" : "saved as draft"}.`);
            fetchClubData();
        } catch (err: any) {
            console.error("Toggle status error:", err);
            toast.error(err.message || "Failed to update status.");
        }
    };

    // Calculate Profile Completeness Percentage
    const profileCompleteness = useMemo(() => {
        if (!club) return 0;
        let score = 30; // base verified club creation
        if (club.short_description && club.short_description.length > 20) score += 20;
        if (club.about && club.about.length > 50) score += 20;
        if (club.website_url) score += 10;
        if (club.logo_url) score += 10;
        if (club.social_links && Object.values(club.social_links).some((v) => Boolean(v))) score += 10;
        return Math.min(100, score);
    }, [club]);

    // Handle Logout
    const handleSignOut = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch (e) {
            // ignore
        }
        dispatch(clearUser());
        navigate("/auth/signin", { replace: true });
    };

    // Filtered Events
    const filteredEvents = useMemo(() => {
        if (eventFilter === "all") return events;
        return events.filter((e) => e.status === eventFilter);
    }, [events, eventFilter]);

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
                    <p className="text-xs font-black tracking-wider uppercase">Loading Club Dashboard...</p>
                </div>
            </div>
        );
    }

    if (!club) {
        return null;
    }

    return (
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Club Sidebar — EXACT same layout & design language as Personal Account, containing ONLY Dashboard */}
            <ClubSidebar
                club={club}
                activeTab={activeTab}
                onTabChange={(tab) => setActiveTab(tab)}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
                unreadInboxCount={inboxCounts.unreadCount}
                onOpenInbox={() => setIsInboxModalOpen(true)}
                onSignOut={handleSignOut}
            />

            {/* Main Content Area Container matching Personal Account */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:py-3 lg:pr-3 lg:pl-2">
                <section
                    aria-label="Orbix Club Dashboard"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                        {/* Dashboard Header Bar matching Personal Account */}
                        <div className="pb-5 border-b-2 border-black/55 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Left: Mobile Toggle & Welcome Greeting */}
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
                                    <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                        Welcome, {club.name}!
                                    </h1>
                                </div>
                                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                        Today, {formattedDate}
                                    </span>
                                    <span className="text-xs font-bold text-neutral-700 hidden sm:inline">
                                        · Verified Collegiate Club Space
                                    </span>
                                </div>
                            </div>

                            {/* Right: Tab Switcher + Inbox Icon + View Public Page */}
                            <div className="flex items-center gap-2.5 flex-wrap">
                                {/* Segmented Tab Switcher */}
                                <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("overview")}
                                        className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                            activeTab === "overview"
                                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                        }`}
                                    >
                                        Overview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("profile")}
                                        className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                            activeTab === "profile"
                                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                        }`}
                                    >
                                        Manage Profile
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("events")}
                                        className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                            activeTab === "events"
                                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                        }`}
                                    >
                                        <span>Events</span>
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black border border-black ${
                                            activeTab === "events" ? "bg-[#a2ff86] text-black" : "bg-neutral-100 text-black"
                                        }`}>
                                            {events.length}
                                        </span>
                                    </button>
                                </div>

                                {/* Club Inbox Button with Real-Time Unread Badge */}
                                <button
                                    type="button"
                                    onClick={() => setIsInboxModalOpen(true)}
                                    className="relative p-2 sm:px-3 sm:py-2 bg-white hover:bg-[#FFE566] text-black rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs flex items-center gap-2 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                                    title="Open Club Inbox"
                                >
                                    <Mail className="w-4 h-4 stroke-[2.2]" />
                                    <span className="hidden sm:inline">Inbox</span>
                                    {inboxCounts.unreadCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-[#FF6B6B] text-black border border-black font-black text-[10px] leading-none min-w-[18px] text-center shadow-[1px_1px_0px_#000]">
                                            {inboxCounts.unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Copy Public Link */}
                                <button
                                    type="button"
                                    onClick={handleCopyPublicLink}
                                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-all"
                                    title="Copy public link"
                                >
                                    {copiedSlug ? (
                                        <Check className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                    <span className="hidden md:inline">{copiedSlug ? "Copied" : "Copy Link"}</span>
                                </button>

                                {/* View Public Page */}
                                <a
                                    href={`/clubs/${club.clubUsername || club.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>Public Page</span>
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                </a>
                            </div>
                        </div>

                        {/* TAB 1: OVERVIEW */}
                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                {/* Club Identity Hero Card */}
                                <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-black bg-emerald-200 flex items-center justify-center font-black text-2xl shadow-[3px_3px_0px_#000] overflow-hidden shrink-0">
                                                {club.logo_url ? (
                                                    <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    club.name.slice(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                                                        {club.name}
                                                    </h2>
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-300 border-2 border-black shadow-[2px_2px_0px_#000]">
                                                        <ShieldCheck className="w-3.5 h-3.5" />
                                                        Verified Club
                                                    </span>
                                                </div>
                                                <p className="text-xs sm:text-sm font-bold text-neutral-600 flex items-center gap-1.5 mt-1">
                                                    <Building2 className="w-4 h-4 text-neutral-400" />
                                                    <span>{club.college_name}</span>
                                                    <span className="text-neutral-400">•</span>
                                                    <span>{club.college_city}, {club.college_state}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={() => {
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
                                                        status: "published",
                                                    });
                                                    setIsEventModalOpen(true);
                                                }}
                                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                            >
                                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                                <span>+ Create Event</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Public Link Bar */}
                                    <div className="mt-6 pt-5 border-t-2 border-black/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#FAF6EE] p-4 rounded-xl border-2 border-black">
                                        <div className="flex items-center gap-2 truncate text-xs font-mono font-bold text-neutral-700">
                                            <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span className="truncate">
                                                {window.location.origin}/clubs/{club.clubUsername || club.slug}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleCopyPublicLink}
                                                className="px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-50 flex items-center gap-1.5 cursor-pointer"
                                            >
                                                {copiedSlug ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                <span>{copiedSlug ? "Copied" : "Copy"}</span>
                                            </button>
                                            <a
                                                href={`/clubs/${club.clubUsername || club.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 rounded-lg bg-black text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <span>Open Page</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* 4-Card Quick Metrics Grid: Upcoming, Draft, Total, and Club Inbox */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Card 1: Upcoming Events */}
                                    <div className="p-5 rounded-2xl bg-emerald-100 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                                            Upcoming Events
                                        </span>
                                        <div className="text-3xl font-black text-neutral-900 my-2">
                                            {stats.upcoming_count}
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-800">Live for student registrations</span>
                                    </div>

                                    {/* Card 2: Draft Events */}
                                    <div className="p-5 rounded-2xl bg-amber-100 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                                            Draft Events
                                        </span>
                                        <div className="text-3xl font-black text-neutral-900 my-2">
                                            {stats.draft_count}
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-800">Unpublished drafts</span>
                                    </div>

                                    {/* Card 3: Total Events */}
                                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                            Total Events
                                        </span>
                                        <div className="text-3xl font-black text-neutral-900 my-2">
                                            {stats.total_count}
                                        </div>
                                        <span className="text-[10px] font-bold text-neutral-500">All registered sessions</span>
                                    </div>

                                    {/* Card 4: Club Inbox & Inquiries */}
                                    <div className="p-5 rounded-2xl bg-[#E8F0FE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-blue-900">
                                                Club Inquiries
                                            </span>
                                            {inboxCounts.unreadCount > 0 ? (
                                                <span className="px-2 py-0.5 rounded-full bg-[#FF6B6B] text-black border border-black text-[10px] font-black animate-pulse">
                                                    {inboxCounts.unreadCount} New
                                                </span>
                                            ) : (
                                                <Mail className="w-4 h-4 text-blue-700" />
                                            )}
                                        </div>
                                        <div className="text-3xl font-black text-neutral-900 my-2">
                                            {inboxCounts.unreadCount}
                                            <span className="text-xs font-bold text-neutral-600 ml-1.5 font-sans">
                                                unread
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsInboxModalOpen(true)}
                                            className="w-full py-1.5 rounded-lg bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                        >
                                            <span>Open Club Inbox</span>
                                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </button>
                                    </div>
                                </div>

                                {/* Profile Completeness & Quick Action */}
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                                    <div className="flex-1 max-w-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                                                Public Profile Completeness
                                            </span>
                                            <span className="font-black text-sm text-neutral-900">
                                                {profileCompleteness}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-neutral-100 rounded-full h-3 border-2 border-black overflow-hidden p-0.5">
                                            <div
                                                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${profileCompleteness}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-neutral-600 font-medium mt-2">
                                            {profileCompleteness === 100
                                                ? "Your club presence is fully complete and ready for public engagement."
                                                : "Add club logo, description, and website to maximize credibility."}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("profile")}
                                        className="px-4 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Update Profile Details</span>
                                    </button>
                                </div>

                                {/* Upcoming Events Summary Section */}
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-neutral-800" />
                                            <h3 className="text-base font-black text-neutral-900">Upcoming Published Events</h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("events")}
                                            className="text-xs font-black text-neutral-700 hover:text-black flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>View All ({events.length})</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {events.filter((e) => e.status === "published" && new Date(e.startsAt) >= new Date()).length === 0 ? (
                                        <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-3">
                                            <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                                            <p className="text-xs font-bold text-neutral-600">
                                                No upcoming published events right now.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingEventId(null);
                                                    setIsEventModalOpen(true);
                                                }}
                                                className="px-4 py-2 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 cursor-pointer"
                                            >
                                                Schedule Next Event
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {events
                                                .filter((e) => e.status === "published" && new Date(e.startsAt) >= new Date())
                                                .slice(0, 4)
                                                .map((ev) => (
                                                    <div
                                                        key={ev.id}
                                                        className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between"
                                                    >
                                                        <div>
                                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-200 border border-black">
                                                                    Published
                                                                </span>
                                                                <span className="text-[11px] font-bold text-neutral-500">
                                                                    {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-black text-sm text-neutral-900 line-clamp-1">{ev.title}</h4>
                                                            <p className="text-xs text-neutral-600 line-clamp-2 mt-1">
                                                                {ev.summary || ev.description || "No description provided."}
                                                            </p>
                                                        </div>
                                                        <div className="mt-3 pt-2.5 border-t border-black/10 flex items-center justify-between text-xs">
                                                            <span className="font-bold text-neutral-600 flex items-center gap-1">
                                                                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                                                                {ev.venueOrLocation || (ev.locationType === "virtual" ? "Online" : "Campus Venue")}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditEvent(ev)}
                                                                className="font-black text-neutral-900 hover:underline cursor-pointer"
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

                        {/* TAB 2: MANAGE PUBLIC PROFILE */}
                        {activeTab === "profile" && (
                            <div className="space-y-6">
                                <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                                    <div className="mb-6 pb-4 border-b-2 border-black/10">
                                        <h2 className="text-lg font-black text-neutral-900">Manage Public Profile</h2>
                                        <p className="text-xs font-bold text-neutral-500 mt-1">
                                            Update your club's public narrative, logo, and links. All updates are live immediately on your public URL.
                                        </p>
                                    </div>

                                    <form onSubmit={handleSaveProfile} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                    Short Description (Headline)
                                                </label>
                                                <input
                                                    type="text"
                                                    maxLength={250}
                                                    value={profileForm.shortDescription}
                                                    onChange={(e) => setProfileForm({ ...profileForm, shortDescription: e.target.value })}
                                                    placeholder="e.g. Official coding and competitive programming club of ABC College"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                    Public Website URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={profileForm.websiteUrl}
                                                    onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                                                    placeholder="https://myclub.edu or https://team-axonic.com"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                    Logo Image URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={profileForm.logoUrl}
                                                    onChange={(e) => setProfileForm({ ...profileForm, logoUrl: e.target.value })}
                                                    placeholder="https://.../logo.png"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                    Cover Banner URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={profileForm.coverImageUrl}
                                                    onChange={(e) => setProfileForm({ ...profileForm, coverImageUrl: e.target.value })}
                                                    placeholder="https://.../banner.jpg"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                    Public Contact Email
                                                </label>
                                                <input
                                                    type="email"
                                                    value={profileForm.publicEmail}
                                                    onChange={(e) => setProfileForm({ ...profileForm, publicEmail: e.target.value })}
                                                    placeholder="contact@myclub.org"
                                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                About Club (Narrative, Mission, Annual Activities)
                                            </label>
                                            <textarea
                                                rows={5}
                                                value={profileForm.about}
                                                onChange={(e) => setProfileForm({ ...profileForm, about: e.target.value })}
                                                placeholder="Write about your club history, flagship hackathons, weekly problem solving sessions, executive team, and student perks..."
                                                className="w-full p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
                                            />
                                        </div>

                                        {/* Social Channels */}
                                        <div className="pt-4 border-t-2 border-black/10 space-y-4">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700">
                                                Public Social Links
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">GitHub</label>
                                                    <input
                                                        type="url"
                                                        value={profileForm.socialGithub}
                                                        onChange={(e) => setProfileForm({ ...profileForm, socialGithub: e.target.value })}
                                                        placeholder="https://github.com/myclub"
                                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">LinkedIn</label>
                                                    <input
                                                        type="url"
                                                        value={profileForm.socialLinkedin}
                                                        onChange={(e) => setProfileForm({ ...profileForm, socialLinkedin: e.target.value })}
                                                        placeholder="https://linkedin.com/company/myclub"
                                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">Instagram</label>
                                                    <input
                                                        type="url"
                                                        value={profileForm.socialInstagram}
                                                        onChange={(e) => setProfileForm({ ...profileForm, socialInstagram: e.target.value })}
                                                        placeholder="https://instagram.com/myclub"
                                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">X (Twitter)</label>
                                                    <input
                                                        type="url"
                                                        value={profileForm.socialX}
                                                        onChange={(e) => setProfileForm({ ...profileForm, socialX: e.target.value })}
                                                        placeholder="https://x.com/myclub"
                                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-neutral-600 mb-1">Discord</label>
                                                    <input
                                                        type="url"
                                                        value={profileForm.socialDiscord}
                                                        onChange={(e) => setProfileForm({ ...profileForm, socialDiscord: e.target.value })}
                                                        placeholder="https://discord.gg/..."
                                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex items-center justify-end">
                                            <button
                                                type="submit"
                                                disabled={isSavingProfile}
                                                className="px-6 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                            >
                                                <Save className="w-4 h-4" />
                                                <span>{isSavingProfile ? "Saving Profile..." : "Save Public Profile"}</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: EVENTS MANAGEMENT */}
                        {activeTab === "events" && (
                            <div className="space-y-6">
                                {/* Filter Bar & Create Button */}
                                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                        {(["all", "published", "draft", "cancelled"] as const).map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setEventFilter(status)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                    eventFilter === status
                                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                                }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
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
                                                status: "published",
                                            });
                                            setIsEventModalOpen(true);
                                        }}
                                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        <Plus className="w-4 h-4 stroke-[2.5]" />
                                        <span>Create New Event</span>
                                    </button>
                                </div>

                                {/* Event Cards Grid */}
                                {filteredEvents.length === 0 ? (
                                    <div className="p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                                        <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
                                        <h3 className="font-black text-base text-neutral-800">No events found</h3>
                                        <p className="text-xs font-medium text-neutral-500 max-w-sm mx-auto">
                                            Create workshops, hackathons, and guest speaker sessions to engage students on campus.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingEventId(null);
                                                setIsEventModalOpen(true);
                                            }}
                                            className="mt-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 cursor-pointer"
                                        >
                                            Create Event
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {filteredEvents.map((ev) => (
                                            <div
                                                key={ev.id}
                                                className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black ${
                                                                ev.status === "published"
                                                                    ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                                                    : ev.status === "draft"
                                                                    ? "bg-amber-200 text-black"
                                                                    : "bg-rose-200 text-black"
                                                            }`}
                                                        >
                                                            {ev.status}
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

                                                    <h3 className="text-base font-black text-neutral-900 line-clamp-1">
                                                        {ev.title}
                                                    </h3>
                                                    <p className="text-xs text-neutral-600 line-clamp-2 mt-1.5 leading-relaxed">
                                                        {ev.summary || ev.description || "No description provided."}
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 font-medium">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="w-3.5 h-3.5" />
                                                            {ev.venueOrLocation || (ev.locationType === "virtual" ? "Virtual (Online)" : "Campus")}
                                                        </span>
                                                        {ev.registrationUrl && (
                                                            <a
                                                                href={ev.registrationUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                                                            >
                                                                <span>Registration Link</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div className="mt-5 pt-3 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleEventStatus(ev)}
                                                            className={`px-2.5 py-1 rounded-xl text-xs font-black border-2 border-black shadow-[1px_1px_0px_#000] cursor-pointer ${
                                                                ev.status === "published"
                                                                    ? "bg-amber-100 hover:bg-amber-200 text-amber-900"
                                                                    : "bg-emerald-200 hover:bg-emerald-300 text-emerald-900"
                                                            }`}
                                                        >
                                                            {ev.status === "published" ? "Unpublish" : "Publish Live"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditEvent(ev)}
                                                            className="px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-black border-2 border-black shadow-[1px_1px_0px_#000] cursor-pointer flex items-center gap-1"
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                            <span>Edit</span>
                                                        </button>
                                                    </div>

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
                    </div>

                    {/* Neo-brutalist Section Bottom Illustration matching Personal Account */}
                    <SectionBottomIllustration alt="Orbix club space illustration" />
                </section>
            </div>

            {/* Club Inbox Modal for reading/replying to user inquiries and moderating (Mute / Block) */}
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
                                    Announce workshops, hackathons, or student meetings.
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
                                            { value: "in_person", label: "In-Person (On Campus)" },
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
                                    placeholder="A hands-on session covering smart contracts and decentralization..."
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
                                        { value: "published", label: "Published (Visible on Public Page Immediately)" },
                                        { value: "draft", label: "Draft (Saved only in Dashboard)" },
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
                                    className="px-5 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
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
