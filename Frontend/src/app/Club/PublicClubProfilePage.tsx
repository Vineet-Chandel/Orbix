import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { OrbixLogo } from "../../components/OrbixLogo";
import {
    ShieldCheck,
    ShieldAlert,
    Building2,
    Globe,
    Mail,
    Phone,
    Calendar,
    MapPin,
    ExternalLink,
    Clock,
    AlertCircle,
    ArrowLeft,
    MessageSquare,
    Loader2,
    Trophy,
    UserCheck,
    Sparkles,
    Users,
    FileText,
    Radio,
} from "lucide-react";
import { getPlatformIcon } from "../../utils/platformLinks";
import MessageClubModal from "./MessageClubModal";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";

interface PublicCoordinator {
    id: string;
    name: string;
    department?: string | null;
    role: string;
    imageUrl?: string | null;
    isPrimary?: boolean;
    contactEmail?: string | null;
    linkedinUrl?: string | null;
    linkedUsername?: string | null;
    linkedDisplayName?: string | null;
    linkedAvatarUrl?: string | null;
}

interface PublicAchievement {
    id: string;
    title: string;
    description?: string | null;
    achievementDate?: string | null;
    issuer?: string | null;
    imageUrl?: string | null;
    externalLink?: string | null;
}

interface PublicTeam {
    id: string;
    name: string;
    slug?: string | null;
    description?: string | null;
    responsibilities?: string | null;
    memberCount?: number;
}

interface PublicClub {
    id: string;
    name: string;
    slug: string;
    category: string;
    collegeName: string;
    collegeCity: string;
    collegeState: string;
    collegeCountry: string;
    shortDescription: string | null;
    about: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    websiteUrl: string | null;
    publicEmail: string | null;
    contactPhone: string | null;
    socialLinks: {
        github?: string;
        linkedin?: string;
        instagram?: string;
        x?: string;
        twitter?: string;
        discord?: string;
        youtube?: string;
    } | null;
    foundedYear: number | null;
    operatingStatus: "active" | "recruiting" | "hiatus" | "inactive";
    mission: string | null;
    vision: string | null;
    focusAreas: string[];
    publicationStatus?: "draft" | "published" | "hidden";
    profileVisibility?: "public" | "unlisted" | "private";
    recruitmentStatus: "open" | "closed" | "upcoming";
    recruitmentAnnouncement: string | null;
    recruitmentUrl: string | null;
    verifiedAt: string;
    createdAt: string;
}

interface PublicEvent {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    description: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    locationType: "in_person" | "online" | "hybrid";
    venueOrLocation: string | null;
    registrationUrl: string | null;
    coverImageUrl: string | null;
    publishedAt: string | null;
}

export default function PublicClubProfilePage() {
    const { slug } = useParams<{ slug: string }>();

    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [club, setClub] = useState<PublicClub | null>(null);
    const [coordinators, setCoordinators] = useState<PublicCoordinator[]>([]);
    const [achievements, setAchievements] = useState<PublicAchievement[]>([]);
    const [teams, setTeams] = useState<PublicTeam[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
    const [pastEvents, setPastEvents] = useState<PublicEvent[]>([]);
    const [isManagerOrMember, setIsManagerOrMember] = useState(false);

    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isBlockedByClub, setIsBlockedByClub] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<"about" | "coordinators" | "achievements" | "teams" | "events">("about");

    useEffect(() => {
        if (!slug) return;

        const fetchClub = async () => {
            try {
                setLoading(true);
                setNotFound(false);
                setIsBlockedByClub(false);
                const res = await fetch(`/api/clubs/${slug}`, { credentials: "include" });
                if (res.status === 404) {
                    setNotFound(true);
                    return;
                }
                const data = await res.json();
                if (data.isBlockedByClub) {
                    setIsBlockedByClub(true);
                    return;
                }
                if (data.success && data.club) {
                    setClub(data.club);
                    setCoordinators(data.coordinators || []);
                    setAchievements(data.achievements || []);
                    setTeams(data.teams || []);
                    setUpcomingEvents(data.upcomingEvents || []);
                    setPastEvents(data.pastEvents || []);
                    setIsManagerOrMember(Boolean(data.isManagerOrMember));

                    // Dynamic Document Title & SEO meta
                    document.title = `${data.club.name} | Verified Collegiate Club on Orbix`;
                } else {
                    setNotFound(true);
                }
            } catch (err) {
                console.error("Public club fetch error:", err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        fetchClub();
    }, [slug]);

    const handleRegisterEvent = async (eventId: string) => {
        if (!user) {
            toast.info("Please sign in to register for club events.");
            return;
        }

        setRegisteringEventId(eventId);
        try {
            const res = await fetch(`/api/club/events/${eventId}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                if (res.status === 403) {
                    toast.error("Access Restricted: You don't have permission to register for events by this club.", {
                        title: "Registration Denied",
                    });
                    return;
                }
                throw new Error(data?.message || "Failed to register for event.");
            }

            toast.success(data?.message || "Successfully registered for this event!", { title: "RSVP Confirmed" });
        } catch (err: any) {
            toast.error(err.message || "Failed to complete event RSVP.", { title: "Error" });
        } finally {
            setRegisteringEventId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-black" />
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
                        Loading chapter profile...
                    </p>
                </div>
            </div>
        );
    }

    if (isBlockedByClub) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-6">
                <div className="max-w-md w-full p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                        <ShieldAlert className="w-7 h-7 text-black stroke-[2.3]" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-xl font-black text-black">Access Restricted</h2>
                        <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                            You do not have permission to view full details or register for events with this club chapter.
                        </p>
                    </div>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-[#a2ff86] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Return to Orbix</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (notFound || !club) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-6">
                <div className="max-w-md w-full p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                        <AlertCircle className="w-7 h-7 text-neutral-600 stroke-[2.3]" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-xl font-black text-black">Club Chapter Not Found</h2>
                        <p className="text-xs font-bold text-neutral-600 leading-relaxed">
                            The requested club handle <span className="font-mono text-black font-black">@{slug}</span> does not exist or has not been published yet.
                        </p>
                    </div>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Home</span>
                    </Link>
                </div>
            </div>
        );
    }

    const social = club.socialLinks || {};

    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-[#FAF6EE]/95 backdrop-blur-md border-b-2 border-black">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity">
                        <OrbixLogo className="w-7 h-7" />
                        <span className="font-black text-lg tracking-tight text-black">Orbix</span>
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-[#FFE566] border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                            Clubs Directory
                        </span>
                    </Link>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsMessageModalOpen(true)}
                            className="px-3.5 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message Chapter</span>
                        </button>

                        {isManagerOrMember && (
                            <Link
                                to="/club/dashboard?tab=profile"
                                className="px-3 py-1.5 rounded-xl bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#ebd04e] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                Edit Profile
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Profile Canvas */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                {/* Header Banner & Hero Card */}
                <div className="rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] overflow-hidden">
                    {/* Header Banner Image */}
                    <div className="w-full h-44 sm:h-64 bg-neutral-900 border-b-2 border-black relative overflow-hidden">
                        {club.coverImageUrl ? (
                            <img
                                src={club.coverImageUrl}
                                alt={club.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#FFE566] bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:16px_16px] flex items-center justify-center">
                                <span className="font-mono text-xs font-black uppercase tracking-widest text-black/50">
                                    Official Collegiate Chapter
                                </span>
                            </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-xs border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                <span>Verified on Orbix</span>
                            </span>
                        </div>
                    </div>

                    {/* Profile Information Row */}
                    <div className="p-6 sm:p-8 relative">
                        {/* Overlapping Logo */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 -mt-16 sm:-mt-20 mb-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-3 border-black overflow-hidden shadow-[4px_4px_0px_#000] shrink-0 flex items-center justify-center font-black text-2xl text-black">
                                    {club.logoUrl ? (
                                        <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{club.name.slice(0, 2).toUpperCase()}</span>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                            {club.name}
                                        </h1>
                                        <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                            {club.category}
                                        </span>
                                        {club.foundedYear && (
                                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black text-[10px] font-black text-neutral-700 shadow-[1px_1px_0px_#000]">
                                                Est. {club.foundedYear}
                                            </span>
                                        )}
                                        {club.operatingStatus === "recruiting" && (
                                            <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                <Radio className="w-3 h-3 animate-pulse" />
                                                <span>Recruiting Members</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Building2 className="w-3.5 h-3.5 text-black" />
                                            {club.collegeName}
                                        </span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1 text-neutral-600">
                                            <MapPin className="w-3.5 h-3.5 text-black" />
                                            {club.collegeCity}, {club.collegeState}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Prominent Action Button: Audition / Recruitment CTA */}
                            {club.recruitmentStatus === "open" && club.recruitmentUrl && (
                                <a
                                    href={club.recruitmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-6 py-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 shrink-0 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Sparkles className="w-4 h-4 text-[#a2ff86]" />
                                    <span>Apply for Chapter Team</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}
                        </div>

                        {/* Tagline */}
                        {club.shortDescription && (
                            <p className="text-sm sm:text-base font-bold text-neutral-800 leading-relaxed max-w-3xl">
                                "{club.shortDescription}"
                            </p>
                        )}

                        {/* Focus Area Tags */}
                        {Array.isArray(club.focusAreas) && club.focusAreas.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-4">
                                {club.focusAreas.map((tag) => (
                                    <span
                                        key={tag}
                                        className="px-2.5 py-1 rounded-full bg-[#FAF6EE] border border-black text-[11px] font-black text-black shadow-[1px_1px_0px_#000]"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Social Links Bar */}
                        <div className="pt-5 mt-5 border-t border-black/10 flex items-center gap-3 flex-wrap">
                            {club.websiteUrl && (
                                <a
                                    href={club.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>Website</span>
                                </a>
                            )}
                            {social.github && (
                                <a
                                    href={social.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    {getPlatformIcon("github", "w-3.5 h-3.5")}
                                    <span>GitHub</span>
                                </a>
                            )}
                            {social.linkedin && (
                                <a
                                    href={social.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    {getPlatformIcon("linkedin", "w-3.5 h-3.5")}
                                    <span>LinkedIn</span>
                                </a>
                            )}
                            {social.instagram && (
                                <a
                                    href={social.instagram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    {getPlatformIcon("instagram", "w-3.5 h-3.5")}
                                    <span>Instagram</span>
                                </a>
                            )}
                            {(social.x || social.twitter) && (
                                <a
                                    href={social.x || social.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    {getPlatformIcon("x", "w-3.5 h-3.5")}
                                    <span>Twitter</span>
                                </a>
                            )}
                            {club.publicEmail && (
                                <a
                                    href={`mailto:${club.publicEmail}`}
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    <span>{club.publicEmail}</span>
                                </a>
                            )}
                            {club.contactPhone && (
                                <a
                                    href={`tel:${club.contactPhone}`}
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>{club.contactPhone}</span>
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recruitment Announcement Banner (if open) */}
                {club.recruitmentStatus === "open" && club.recruitmentAnnouncement && (
                    <div className="p-5 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-6 h-6 text-black shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-black">Member Recruitment Announcement</h3>
                                <p className="text-xs font-bold text-neutral-800 leading-relaxed">
                                    {club.recruitmentAnnouncement}
                                </p>
                            </div>
                        </div>
                        {club.recruitmentUrl && (
                            <a
                                href={club.recruitmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] shrink-0 hover:bg-neutral-800 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                Fill Application Form
                            </a>
                        )}
                    </div>
                )}

                {/* Internal Navigation Tabs */}
                <div className="flex items-center gap-2 border-b-2 border-black pb-2 overflow-x-auto scrollbar-none">
                    {[
                        { id: "about", label: "About & Story", icon: FileText },
                        { id: "coordinators", label: "Coordinators & Leads", icon: UserCheck, count: coordinators.length },
                        { id: "achievements", label: "Achievements", icon: Trophy, count: achievements.length },
                        { id: "teams", label: "Departments", icon: Users, count: teams.length },
                        { id: "events", label: "Events & Workshops", icon: Calendar, count: upcomingEvents.length + pastEvents.length },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isTabActive = activeSection === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveSection(tab.id as any)}
                                className={`px-4 py-2 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] shrink-0 flex items-center gap-2 cursor-pointer transition-all ${
                                    isTabActive
                                        ? "bg-black text-[#a2ff86]"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span
                                        className={`px-1.5 py-0.2 rounded-md text-[10px] font-black border ${
                                            isTabActive ? "bg-white text-black border-black" : "bg-[#a2ff86] text-black border-black"
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* TAB 1: ABOUT & STORY */}
                {activeSection === "about" && (
                    <div className="space-y-6">
                        {/* Mission & Vision Cards (if set) */}
                        {(club.mission || club.vision) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {club.mission && (
                                    <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            Our Mission
                                        </h3>
                                        <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                                            {club.mission}
                                        </p>
                                    </div>
                                )}
                                {club.vision && (
                                    <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                                        <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                            Our Vision
                                        </h3>
                                        <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                                            {club.vision}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Rich Markdown Narrative */}
                        <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                            <h3 className="text-base font-black text-black pb-3 border-b-2 border-black/10 mb-4">
                                About {club.name}
                            </h3>
                            {club.about ? (
                                <div className="prose prose-sm max-w-none text-xs text-neutral-800 leading-relaxed">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h1: ({ children }) => <h1 className="text-lg font-black text-black pb-1 border-b border-black/20 my-3">{children}</h1>,
                                            h2: ({ children }) => <h2 className="text-base font-black text-black pb-1 border-b border-black/10 mt-4 mb-2">{children}</h2>,
                                            h3: ({ children }) => <h3 className="text-sm font-bold text-black mt-3 mb-1.5">{children}</h3>,
                                            p: ({ children }) => <p className="text-xs text-neutral-700 leading-relaxed mb-3">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-xs text-neutral-700">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-xs text-neutral-700">{children}</ol>,
                                            li: ({ children }) => <li className="text-xs text-neutral-700">{children}</li>,
                                            blockquote: ({ children }) => (
                                                <blockquote className="border-l-4 border-black pl-3 py-1 my-2 bg-[#FAF6EE] text-xs italic font-medium text-neutral-700">
                                                    {children}
                                                </blockquote>
                                            ),
                                            a: ({ href, children }) => (
                                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800">
                                                    {children}
                                                </a>
                                            ),
                                            code: ({ children }) => (
                                                <code className="px-1.5 py-0.5 rounded-md bg-[#FAF6EE] border border-black/20 text-[11px] font-mono text-black">
                                                    {children}
                                                </code>
                                            ),
                                        }}
                                    >
                                        {club.about}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-xs font-medium text-neutral-500 italic">
                                    No detailed description has been published for this chapter yet.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: COORDINATORS & STUDENT LEADS */}
                {activeSection === "coordinators" && (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="pb-4 border-b border-black/10">
                            <h3 className="text-base font-black text-black">Coordinators & Chapter Leads</h3>
                            <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                Meet the student organizers, technical heads, and mentors driving this club.
                            </p>
                        </div>

                        {coordinators.length === 0 ? (
                            <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-1.5">
                                <UserCheck className="w-8 h-8 text-neutral-400 mx-auto" />
                                <h4 className="text-xs font-black text-black">No Coordinators Listed</h4>
                                <p className="text-xs text-neutral-500">The chapter has not publicly listed coordinators yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {coordinators.map((coord) => (
                                    <div
                                        key={coord.id}
                                        className={`p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-4 ${
                                            coord.isPrimary ? "ring-2 ring-black" : ""
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-black overflow-hidden shrink-0 flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#000]">
                                                {coord.imageUrl ? (
                                                    <img src={coord.imageUrl} alt={coord.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{coord.name.slice(0, 2).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="text-xs font-black text-black truncate">{coord.name}</h4>
                                                    {coord.isPrimary && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-[#a2ff86] border border-black text-[9px] font-black text-black shadow-[1px_1px_0px_#000]">
                                                            Lead
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-neutral-800 mt-0.5">{coord.role}</p>
                                                {coord.department && (
                                                    <p className="text-[10px] font-medium text-neutral-600">{coord.department}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Contact & Linked Profile */}
                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10">
                                            {coord.linkedUsername ? (
                                                <Link
                                                    to={`/@${coord.linkedUsername}`}
                                                    className="inline-flex items-center gap-1 text-[11px] font-black text-black hover:underline"
                                                >
                                                    <span>@{coord.linkedUsername}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            ) : (
                                                <span className="text-[10px] text-neutral-400 font-bold">Chapter Representative</span>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {coord.contactEmail && (
                                                    <a
                                                        href={`mailto:${coord.contactEmail}`}
                                                        className="p-1 rounded-md bg-white border border-black text-black hover:bg-neutral-100"
                                                        title={coord.contactEmail}
                                                    >
                                                        <Mail className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {coord.linkedinUrl && (
                                                    <a
                                                        href={coord.linkedinUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1 rounded-md bg-white border border-black text-black hover:text-blue-600 hover:bg-neutral-100"
                                                        title="LinkedIn Profile"
                                                    >
                                                        {getPlatformIcon("linkedin", "w-3.5 h-3.5")}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: ACHIEVEMENTS & HIGHLIGHTS */}
                {activeSection === "achievements" && (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="pb-4 border-b border-black/10">
                            <h3 className="text-base font-black text-black">Achievements & Distinctions</h3>
                            <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                Awards, hackathon rankings, and milestones earned by chapter members.
                            </p>
                        </div>

                        {achievements.length === 0 ? (
                            <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-1.5">
                                <Trophy className="w-8 h-8 text-neutral-400 mx-auto" />
                                <h4 className="text-xs font-black text-black">No Achievements Listed</h4>
                                <p className="text-xs text-neutral-500">The chapter has not published awards or milestones yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {achievements.map((ach) => (
                                    <div
                                        key={ach.id}
                                        className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex items-start gap-4"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black overflow-hidden shrink-0 flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                            {ach.imageUrl ? (
                                                <img src={ach.imageUrl} alt={ach.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <Trophy className="w-6 h-6 text-black" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-xs font-black text-black">{ach.title}</h4>
                                                {ach.issuer && (
                                                    <span className="px-2 py-0.5 rounded-md bg-white border border-black text-[10px] font-bold text-neutral-800">
                                                        {ach.issuer}
                                                    </span>
                                                )}
                                            </div>
                                            {ach.achievementDate && (
                                                <p className="text-[10px] font-bold text-neutral-500 mt-0.5">
                                                    {ach.achievementDate}
                                                </p>
                                            )}
                                            {ach.description && (
                                                <p className="text-xs font-medium text-neutral-700 mt-1 leading-relaxed">
                                                    {ach.description}
                                                </p>
                                            )}
                                            {ach.externalLink && (
                                                <a
                                                    href={ach.externalLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:underline mt-2"
                                                >
                                                    <span>View verification</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 4: TEAMS & DEPARTMENTS */}
                {activeSection === "teams" && (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="pb-4 border-b border-black/10">
                            <h3 className="text-base font-black text-black">Active Departments & Teams</h3>
                            <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                Organisational teams and specialized wings active within this chapter.
                            </p>
                        </div>

                        {teams.length === 0 ? (
                            <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-1.5">
                                <Users className="w-8 h-8 text-neutral-400 mx-auto" />
                                <h4 className="text-xs font-black text-black">No Departments Listed</h4>
                                <p className="text-xs text-neutral-500">The chapter structure has not been made public yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {teams.map((t) => (
                                    <div
                                        key={t.id}
                                        className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-black">{t.name}</h4>
                                            {t.memberCount !== undefined && (
                                                <span className="px-2 py-0.5 rounded-full bg-white border border-black text-[10px] font-black text-neutral-800 shadow-[1px_1px_0px_#000]">
                                                    {t.memberCount} Members
                                                </span>
                                            )}
                                        </div>
                                        {t.description && (
                                            <p className="text-xs font-medium text-neutral-700 leading-relaxed">
                                                {t.description}
                                            </p>
                                        )}
                                        {t.responsibilities && (
                                            <p className="text-[11px] font-bold text-neutral-500">
                                                Focus: {t.responsibilities}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 5: EVENTS & SESSIONS */}
                {activeSection === "events" && (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="pb-4 border-b border-black/10">
                            <h3 className="text-base font-black text-black">Events, Hackathons & Workshops</h3>
                            <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                Chapter schedule of upcoming meetups, coding sessions, and archive of past events.
                            </p>
                        </div>

                        {/* Upcoming Events */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black" />
                                Upcoming Sessions ({upcomingEvents.length})
                            </h4>

                            {upcomingEvents.length === 0 ? (
                                <div className="p-6 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center text-xs font-bold text-neutral-500">
                                    No upcoming sessions scheduled at this moment. Stay tuned!
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {upcomingEvents.map((evt) => (
                                        <div
                                            key={evt.id}
                                            className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between"
                                        >
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                                        {evt.locationType}
                                                    </span>
                                                    <span className="text-[11px] font-black text-neutral-600 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(evt.startsAt).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                </div>
                                                <h5 className="text-sm font-black text-black">{evt.title}</h5>
                                                {evt.summary && (
                                                    <p className="text-xs font-medium text-neutral-700 leading-relaxed">
                                                        {evt.summary}
                                                    </p>
                                                )}
                                                {evt.venueOrLocation && (
                                                    <p className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {evt.venueOrLocation}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-black/10 flex items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    disabled={registeringEventId === evt.id}
                                                    onClick={() => handleRegisterEvent(evt.id)}
                                                    className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                                >
                                                    {registeringEventId === evt.id ? "Registering..." : "RSVP / Register"}
                                                </button>
                                                {evt.registrationUrl && (
                                                    <a
                                                        href={evt.registrationUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        <span>Event Details</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Past Events Archive */}
                        {pastEvents.length > 0 && (
                            <div className="space-y-3 pt-6 border-t border-black/10">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 border border-black" />
                                    Past Sessions ({pastEvents.length})
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {pastEvents.map((evt) => (
                                        <div
                                            key={evt.id}
                                            className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-neutral-700 space-y-1"
                                        >
                                            <span className="text-[10px] font-bold text-neutral-500">
                                                {new Date(evt.startsAt).toLocaleDateString()}
                                            </span>
                                            <h5 className="text-xs font-black text-black">{evt.title}</h5>
                                            {evt.summary && (
                                                <p className="text-[11px] font-medium text-neutral-600 line-clamp-2">
                                                    {evt.summary}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Messaging Dialog */}
            <MessageClubModal
                isOpen={isMessageModalOpen}
                onClose={() => setIsMessageModalOpen(false)}
                clubId={club.id}
                clubName={club.name}
            />
        </div>
    );
}
