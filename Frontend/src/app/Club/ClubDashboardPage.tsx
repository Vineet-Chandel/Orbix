import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    LayoutDashboard,
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
    LogOut,
    Save,
    X,
    Building2,
    ChevronRight,
    Menu,
} from "lucide-react";
import { useAppDispatch, useAppSelector, clearUser } from "../../store";
import { useToast } from "../../context/ToastContext";
import { OrbixLogo } from "../../components/OrbixLogo";

interface VerifiedClub {
    id: string;
    auth_user_id: string;
    name: string;
    slug: string;
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
    const { user } = useAppSelector((state) => state.user);

    // Data States
    const [club, setClub] = useState<VerifiedClub | null>(null);
    const [stats, setStats] = useState<ClubStats>({ upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });
    const [events, setEvents] = useState<ClubEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Navigation & UI States
    const [activeTab, setActiveTab] = useState<"overview" | "profile" | "events">("overview");
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [copiedSlug, setCopiedSlug] = useState(false);

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

            if (profileRes.status === 404) {
                // If not verified club yet, check if pending verification
                navigate("/club/status", { replace: true });
                return;
            }

            const profileData = await profileRes.json();
            const eventsData = await eventsRes.json().catch(() => ({ events: [] }));

            if (profileData.success && profileData.club) {
                const c = profileData.club;
                setClub(c);
                setStats(profileData.stats || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 });

                // Sync profile form
                setProfileForm({
                    shortDescription: c.short_description || "",
                    about: c.about || "",
                    logoUrl: c.logo_url || "",
                    coverImageUrl: c.cover_image_url || "",
                    websiteUrl: c.website_url || "",
                    publicEmail: c.public_email || "",
                    socialGithub: c.social_links?.github || "",
                    socialLinkedin: c.social_links?.linkedin || "",
                    socialInstagram: c.social_links?.instagram || "",
                    socialX: c.social_links?.x || c.social_links?.twitter || "",
                    socialDiscord: c.social_links?.discord || "",
                });
            }

            if (eventsData.success && Array.isArray(eventsData.events)) {
                setEvents(eventsData.events);
            }
        } catch (err: any) {
            console.error("Club dashboard fetch error:", err);
            toast.error("Failed to load club dashboard details.", { title: "Error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClubData();
    }, []);

    // Handle Copy Public Link
    const handleCopyPublicLink = () => {
        if (!club) return;
        const clubHandle = (club as any)?.clubUsername || club.slug;
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center text-neutral-900 font-sans">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-black border-t-emerald-400 rounded-full animate-spin" />
                    <p className="text-sm font-black tracking-wide uppercase">Opening Verified Club Dashboard...</p>
                </div>
            </div>
        );
    }

    if (!club) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-neutral-900 font-sans selection:bg-black selection:text-white flex flex-col md:flex-row relative">
            <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b-2 border-black sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center p-1.5 border-2 border-black">
                        <OrbixLogo className="w-full h-full text-white" />
                    </div>
                    <span className="font-black text-sm tracking-tight">{club.name}</span>
                </div>
                <button
                    onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                    className="p-2 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-neutral-100"
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            {/* Club-Only Minimal Sidebar (Phase 4 Specification: Only Dashboard nav item + bottom club account control) */}
            <aside
                className={`w-64 bg-white border-r-2 border-black flex flex-col justify-between z-30 shrink-0 md:sticky md:top-0 md:h-screen fixed inset-y-0 left-0 transition-transform duration-200 ${
                    isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                }`}
            >
                <div>
                    {/* Brand Header */}
                    <div className="p-5 border-b-2 border-black flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center p-1.5 border-2 border-black shadow-[2px_2px_0px_#000] group-hover:bg-neutral-800 transition-colors flex-shrink-0">
                                <OrbixLogo className="w-full h-full text-white" />
                            </div>
                            <div>
                                <span className="font-black text-base tracking-tight block">Orbix Club</span>
                                <span className="text-[10px] uppercase font-black text-emerald-600 tracking-wider flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Verified Space
                                </span>
                            </div>
                        </Link>
                        <button
                            onClick={() => setIsMobileSidebarOpen(false)}
                            className="md:hidden p-1.5 rounded-lg border-2 border-black hover:bg-neutral-100"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Navigation - EXACTLY ONE Main Item: Dashboard */}
                    <div className="p-4 space-y-2">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                            Workspace
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("overview");
                                setIsMobileSidebarOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 border-black font-black text-xs transition-all text-left ${
                                activeTab === "overview"
                                    ? "bg-black text-white shadow-[3px_3px_0px_#000]"
                                    : "bg-white hover:bg-neutral-50 text-neutral-800"
                            }`}
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Dashboard</span>
                        </button>
                    </div>
                </div>

                {/* Bottom Club Profile Trigger */}
                <div className="p-4 border-t-2 border-black bg-neutral-50">
                    <button
                        type="button"
                        onClick={() => setIsProfileModalOpen(true)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all text-left cursor-pointer group"
                    >
                        <div className="w-10 h-10 rounded-xl border-2 border-black overflow-hidden bg-emerald-200 flex items-center justify-center font-black text-sm shrink-0">
                            {club.logo_url ? (
                                <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                            ) : (
                                club.name.slice(0, 2).toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                                <span className="font-black text-xs truncate block text-neutral-900 group-hover:text-black">
                                    {club.name}
                                </span>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-500 block truncate">
                                {club.college_name}
                            </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col">
                {/* Top Action Header */}
                <header className="bg-white border-b-2 border-black px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        {/* Tab Switchers */}
                        <div className="flex items-center gap-2 p-1 bg-[#FAF6EE] rounded-2xl border-2 border-black">
                            <button
                                type="button"
                                onClick={() => setActiveTab("overview")}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    activeTab === "overview"
                                        ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                Overview
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("profile")}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    activeTab === "profile"
                                        ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                Manage Public Profile
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("events")}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                    activeTab === "events"
                                        ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                <span>Events</span>
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200 text-black border border-black font-black">
                                    {events.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleCopyPublicLink}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                        >
                            {copiedSlug ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedSlug ? "Copied" : "Copy Link"}</span>
                        </button>

                        <a
                            href={`/clubs/${(club as any)?.clubUsername || club.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-300 hover:bg-emerald-400 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <span>View Public Page</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </header>

                {/* Main Body per Tab */}
                <div className="p-6 sm:p-8 max-w-6xl w-full mx-auto space-y-8">
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === "overview" && (
                        <>
                            {/* Club Identity Hero Banner */}
                            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] relative overflow-hidden">
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
                                                <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                                                    {club.name}
                                                </h1>
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
                                            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Create Event</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Public Link Widget */}
                                <div className="mt-6 pt-5 border-t-2 border-black/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#FAF6EE] p-4 rounded-2xl border-2 border-black">
                                    <div className="flex items-center gap-2 truncate text-xs font-mono font-bold text-neutral-700">
                                        <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="truncate">
                                            {window.location.origin}/clubs/{(club as any)?.clubUsername || club.slug}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleCopyPublicLink}
                                            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-50 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            {copiedSlug ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                            <span>{copiedSlug ? "Copied" : "Copy"}</span>
                                        </button>
                                        <a
                                            href={`/clubs/${(club as any)?.clubUsername || club.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-xl bg-black text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>Open Page</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Completeness & Metrics Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Profile Completeness Card */}
                                <div className="md:col-span-1 p-6 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                                                Profile Completeness
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

                                        <p className="text-xs text-neutral-600 font-medium mt-3 leading-relaxed">
                                            {profileCompleteness === 100
                                                ? "Your club presence is fully complete and ready for public engagement."
                                                : "Add club logo, description, and website to maximize credibility."}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("profile")}
                                        className="mt-4 w-full py-2 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Update Profile Details</span>
                                    </button>
                                </div>

                                {/* Events Overview Metric Cards */}
                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <div className="p-5 rounded-3xl bg-emerald-100 border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                                            Upcoming Events
                                        </span>
                                        <div className="text-3xl font-black text-neutral-900 mt-2">
                                            {stats.upcoming_count}
                                        </div>
                                        <span className="text-[10px] font-bold text-emerald-800 mt-1">Live for students</span>
                                    </div>

                                    <div className="p-5 rounded-3xl bg-amber-100 border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                                            Draft Events
                                        </span>
                                        <div className="text-3xl font-black text-neutral-900 mt-2">
                                            {stats.draft_count}
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-800">Unpublished</span>
                                    </div>

                                    <div className="p-5 rounded-3xl bg-neutral-100 border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                            Total Events
                                        </span>
                                        <div className="text-3xl font-black text-neutral-900 mt-2">
                                            {stats.total_count}
                                        </div>
                                        <span className="text-[10px] font-bold text-neutral-500">All registered</span>
                                    </div>
                                </div>
                            </div>

                            {/* Upcoming Events Summary Section */}
                            <div className="p-6 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-5 h-5 text-neutral-800" />
                                        <h2 className="text-base font-black text-neutral-900">Upcoming Published Events</h2>
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
                                    <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-3">
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
                                                    className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between"
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
                                                        <h3 className="font-black text-sm text-neutral-900 line-clamp-1">{ev.title}</h3>
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
                        </>
                    )}

                    {/* TAB 2: MANAGE PUBLIC PROFILE */}
                    {activeTab === "profile" && (
                        <div className="space-y-6">
                            <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000]">
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
                                                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
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
                                                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
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
                                                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
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
                                                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
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
                                                className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
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
                                            className="w-full p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black"
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
                                            className="px-6 py-2.5 rounded-2xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
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
                            <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    {(["all", "published", "draft", "cancelled"] as const).map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setEventFilter(status)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                                eventFilter === status
                                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
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
                                    className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-emerald-400 hover:bg-emerald-500 border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Create New Event</span>
                                </button>
                            </div>

                            {/* Event Cards Grid */}
                            {filteredEvents.length === 0 ? (
                                <div className="p-12 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
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
                                        className="mt-2 px-4 py-2 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 cursor-pointer"
                                    >
                                        Create Event
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {filteredEvents.map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between"
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
            </main>

            {/* Club-Specific Profile Modal (Phase 4 Specification: Logo, Name, Verified Badge, Private Email, Public Link, Sign Out) */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[8px_8px_0px_#000] p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                                Club Account Center
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsProfileModalOpen(false)}
                                className="p-1 rounded-lg border-2 border-black hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Club Details */}
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl border-2 border-black bg-emerald-200 flex items-center justify-center font-black text-xl shadow-[3px_3px_0px_#000] overflow-hidden shrink-0">
                                {club.logo_url ? (
                                    <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
                                ) : (
                                    club.name.slice(0, 2).toUpperCase()
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="font-black text-base text-neutral-900 truncate">{club.name}</h3>
                                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                </div>
                                <p className="text-xs font-bold text-neutral-500 truncate">{club.college_name}</p>
                                <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[10px] font-black uppercase bg-neutral-100 border border-black/30">
                                    {club.category}
                                </span>
                            </div>
                        </div>

                        {/* Account Private Credentials Callout */}
                        <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Account Email (Private)
                            </span>
                            <p className="text-xs font-mono font-bold text-neutral-800 truncate">
                                {user?.gmail || "Authenticated Club Representative"}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2 pt-2">
                            <a
                                href={`/clubs/${(club as any)?.clubUsername || club.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-4 rounded-xl bg-emerald-300 hover:bg-emerald-400 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span>View Public Club Page</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsProfileModalOpen(false);
                                    setActiveTab("profile");
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit Club Profile</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="w-full py-2.5 px-4 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-900 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Sign Out of Club Account</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF6EE] border-2 border-black text-xs font-bold"
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
                                    <select
                                        value={eventForm.locationType}
                                        onChange={(e) => setEventForm({ ...eventForm, locationType: e.target.value as any })}
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold"
                                    >
                                        <option value="in_person">In-Person (On Campus)</option>
                                        <option value="virtual">Virtual (Online Link)</option>
                                        <option value="hybrid">Hybrid</option>
                                    </select>
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
                                <select
                                    value={eventForm.status}
                                    onChange={(e) => setEventForm({ ...eventForm, status: e.target.value as any })}
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold"
                                >
                                    <option value="published">Published (Visible on Public Page Immediately)</option>
                                    <option value="draft">Draft (Saved only in Dashboard)</option>
                                </select>
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
                                    className="px-5 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
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
