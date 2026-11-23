import { maskPublicPhone, maskPublicEmail } from "../../../../shared/privacy/publicContact";
import { useEffect, useState, useMemo, Suspense, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { lazyWithRetry } from "../../utils/lazyWithRetry";

const ClubMarkdownRenderer = lazyWithRetry(() => import("./Profile/ClubMarkdownRenderer").then(m => ({ default: m.ClubMarkdownRenderer })));
import { OrbixLogo } from "../../components/OrbixLogo";
import {
    ShieldAlert,
    Building2,
    Globe,
    Mail,
    Phone,
    Calendar,
    MapPin,
    ExternalLink,
    AlertCircle,
    ArrowLeft,
    MessageSquare,
    Trophy,
    UserCheck,
    Sparkles,
    Users,
    FileText,
    Radio,
    Search,
    X,
} from "lucide-react";
import { OrbixLoader } from "../../components/ui/loader";
import { getPlatformIcon } from "../../utils/platformLinks";
import MessageClubModal from "./MessageClubModal";
import { useAppSelector } from "../../store";
import { Sidebar } from "../Dashboard/Sidebar";
import { VerifiedBadge } from "../../components/VerifiedBadge";
import { EnlargeableAvatar } from "../../components/media/EnlargeableAvatar";
import { isDemoClubSlug, getDemoClubProfileBundle } from "../../data/demoClubProfileData";
import { ClubEventCard } from "./ClubEventCard";

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
    type?: string | null;
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

interface PublicClubLink {
    platform: string;
    url: string;
    label?: string;
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
    links?: PublicClubLink[];
    socialLinks: {
        github?: string;
        linkedin?: string;
        instagram?: string;
        whatsapp?: string;
        x?: string;
        twitter?: string;
        discord?: string;
        youtube?: string;
    } | null;
    foundedYear: number | null;
    operatingStatus: "active" | "recruiting" | "on_hiatus" | "hiatus" | "inactive";
    mission: string | null;
    vision: string | null;
    focusAreas: string[];
    publicationStatus?: "draft" | "published" | "hidden";
    profileVisibility?: "public" | "unlisted" | "private";
    visibility?: "draft" | "public" | "unlisted" | "private" | "archived";
    recruitmentStatus: "open" | "closed" | "upcoming";
    recruitmentAnnouncement: string | null;
    recruitmentUrl: string | null;
    authUserId?: string | null;
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

export interface PublicClubProfilePageProps {
    overrideSlug?: string;
    isEmbedded?: boolean;
    onClose?: () => void;
    initialClubData?: any;
    onNavigateToEdit?: () => void;
}

export default function PublicClubProfilePage({
    overrideSlug,
    isEmbedded = false,
    onClose,
    initialClubData,
    onNavigateToEdit,
}: PublicClubProfilePageProps = {}) {
    const params = useParams<{ slug: string }>();
    const slug = overrideSlug || params.slug;

    const { user } = useAppSelector((state) => state.user);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const showSidebarShell = !onClose && !isEmbedded && Boolean(user);

    const wrapWithSidebar = (content: ReactNode) => {
        if (!showSidebarShell) return content;
        return (
            <div className="flex min-h-screen w-full min-w-0 bg-[#FAF6EE]">
                <Sidebar
                    activeTab="clubs"
                    isOpen={isMobileSidebarOpen}
                    onClose={() => setIsMobileSidebarOpen(false)}
                />
                <div className="flex-1 min-w-0">{content}</div>
            </div>
        );
    };

    const mobileSidebarToggleButton = null;

    const [club, setClub] = useState<PublicClub | null>(() => {
        if (initialClubData) {
            return {
                ...initialClubData,
                collegeCity: initialClubData.collegeCity || "",
                collegeState: initialClubData.collegeState || "",
                collegeCountry: initialClubData.collegeCountry || "India",
                focusAreas: Array.isArray(initialClubData.focusAreas) ? initialClubData.focusAreas : [],
                operatingStatus: initialClubData.operatingStatus || "active",
                recruitmentStatus: initialClubData.recruitmentStatus || "closed",
            };
        }
        return null;
    });
    const [coordinators, setCoordinators] = useState<PublicCoordinator[]>(initialClubData?.coordinators || []);
    const [achievements, setAchievements] = useState<PublicAchievement[]>(initialClubData?.achievements || []);
    const [teams, setTeams] = useState<PublicTeam[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
    const [pastEvents, setPastEvents] = useState<PublicEvent[]>([]);
    const [isManagerOrMember, setIsManagerOrMember] = useState(false);

    const [loading, setLoading] = useState(!initialClubData);
    const [notFound, setNotFound] = useState(false);
    const [isBlockedByClub, setIsBlockedByClub] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<"about" | "coordinators" | "achievements" | "teams" | "events">("about");
    const navigate = useNavigate();
    const [eventFilter, setEventFilter] = useState<"all" | "upcoming" | "past">("all");
    const [eventSearch, setEventSearch] = useState<string>("");

    useEffect(() => {
        if (!slug) return;

        if (isDemoClubSlug(slug)) {
            const bundle = getDemoClubProfileBundle(slug);
            setClub(bundle.club);
            setCoordinators(bundle.coordinators);
            setAchievements(bundle.achievements);
            setTeams(bundle.teams);
            setUpcomingEvents(bundle.upcomingEvents);
            setPastEvents(bundle.pastEvents);
            setIsManagerOrMember(false);
            setLoading(false);
            setNotFound(false);
            setIsBlockedByClub(false);
            return;
        }

        const fetchClub = async () => {
            try {
                if (!initialClubData && !club) {
                    setLoading(true);
                }
                setNotFound(false);
                setIsBlockedByClub(false);
                const res = await fetch(`/api/clubs/${slug}`, { credentials: "include" });
                if (res.status === 404) {
                    if (!club) setNotFound(true);
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
                } else if (!club) {
                    setNotFound(true);
                }
            } catch (err) {
                console.error("Public club fetch error:", err);
                if (!club) {
                    setNotFound(true);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchClub();
    }, [slug, isEmbedded, onClose]);

    const handleSelectEvent = (eventId: string, eventSlug?: string) => {
        if (user?.accountType === "club") {
            if (isManagerOrMember || club?.authUserId === user?.id || (user?.verifiedClub && user.verifiedClub.id === club?.id)) {
                navigate(`/club/events/${eventId}`);
                return;
            }
            navigate(`/college-events/${eventId}${eventSlug ? `/${eventSlug}` : ""}`);
            return;
        }

        navigate(`/college-events/${eventId}${eventSlug ? `/${eventSlug}` : ""}`);
    };

    const filteredEvents = useMemo(() => {
        const mapEvent = (e: any, isPast: boolean) => ({
            id: e.id,
            clubId: e.clubId || club?.id || "",
            title: e.title || "Untitled Session",
            slug: e.slug || "",
            summary: e.summary || null,
            description: e.description || null,
            startsAt: e.startsAt,
            endsAt: e.endsAt || null,
            timezone: e.timezone || "Asia/Kolkata",
            locationType: (e.locationType === "online" ? "virtual" : e.locationType) || "in_person",
            venueOrLocation: e.venueOrLocation || null,
            registrationUrl: e.registrationUrl || null,
            coverImageUrl: e.coverImageUrl || null,
            status: e.status || (isPast ? "completed" : "published"),
            scope: e.scope || "CAMPUS",
            isTeamEvent: Boolean(e.isTeamEvent),
            minTeamSize: e.minTeamSize || 1,
            maxTeamSize: e.maxTeamSize || 4,
            registrationsCount: Number(e.registrationsCount) || 0,
            attendeesCount: Number(e.attendeesCount) || 0,
            rejectedCount: Number(e.rejectedCount) || 0,
            likesCount: Number(e.likesCount) || 0,
            sharesCount: Number(e.sharesCount) || 0,
            isOptimistic: false,
        });

        const upcoming = (upcomingEvents || []).map((e) => mapEvent(e, false));
        const past = (pastEvents || []).map((e) => mapEvent(e, true));

        let list: any[] = [];
        if (eventFilter === "upcoming") {
            list = upcoming;
        } else if (eventFilter === "past") {
            list = past;
        } else {
            list = [...upcoming, ...past];
        }

        if (eventSearch.trim()) {
            const q = eventSearch.toLowerCase().trim();
            list = list.filter(
                (e) =>
                    e.title.toLowerCase().includes(q) ||
                    (e.summary && e.summary.toLowerCase().includes(q)) ||
                    (e.venueOrLocation && e.venueOrLocation.toLowerCase().includes(q))
            );
        }

        return list;
    }, [upcomingEvents, pastEvents, eventFilter, eventSearch, club]);

    if (loading) {
        return wrapWithSidebar(
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-6 text-black relative">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                        aria-label="Close"
                        title="Close profile"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                )}
                {mobileSidebarToggleButton}
                <OrbixLoader size="lg" />
            </div>
        );
    }

    if (isBlockedByClub) {
        return wrapWithSidebar(
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-6 relative">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                        aria-label="Close"
                        title="Close profile"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                )}
                {mobileSidebarToggleButton}
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
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Return to Clubs</span>
                        </button>
                    ) : (
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Return to Orbix</span>
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    if (notFound || !club) {
        return wrapWithSidebar(
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-6 relative">
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                        aria-label="Close"
                        title="Close profile"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                )}
                {mobileSidebarToggleButton}
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
                    {onClose ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Return to Clubs</span>
                        </button>
                    ) : (
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to Home</span>
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    const social = club.socialLinks || {};

    return wrapWithSidebar(
        <div className={`${isEmbedded ? "pb-4 public-club-profile-page embedded-showcase-container bg-[#FAF6EE]" : "public-club-profile-page min-h-screen bg-[#FAF6EE]"} bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black`}>
            {/* Top Navigation Bar */}
            {!isEmbedded && (
                <header
                    className={`sticky top-0 ${showSidebarShell ? "z-30" : "z-40"} bg-[#FAF6EE]/95 backdrop-blur-md border-b-2 border-black`}
                >
                    <div
                        className={`max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4 ${
                            showSidebarShell
                                ? "h-[88px] sm:h-[112px] lg:h-16 pl-6 pr-4 sm:pl-9 sm:pr-6 lg:px-6"
                                : "h-16 px-4 sm:px-6"
                        }`}
                    >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            {mobileSidebarToggleButton}
                            {onClose ? (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                                    aria-label="Back to clubs"
                                >
                                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                                    <span>Back</span>
                                </button>
                            ) : (
                                <Link to="/" className="flex items-center gap-2.5 hover:opacity-85 transition-opacity shrink-0">
                                    <OrbixLogo className="w-9 h-9 sm:w-10 sm:h-10 text-black group-hover:scale-105 transition-transform flex-shrink-0" />
                                    <span className="font-black text-2xl sm:text-3xl tracking-tight text-black leading-none">Orbix</span>
                                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-[#FFE566] border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                        Clubs Directory
                                    </span>
                                </Link>
                            )}

                            {onClose && club && (
                                <div className="hidden sm:flex items-center gap-2 min-w-0 pl-2 border-l-2 border-black/20 ml-1">
                                    <span className="text-sm font-black text-black truncate max-w-[200px] md:max-w-sm">
                                        {club.name}
                                    </span>
                                    <VerifiedBadge size="sm" />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsMessageModalOpen(true)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="hidden xs:inline">Message Chapter</span>
                                <span className="xs:hidden">Message</span>
                            </button>

                            {club?.slug && (
                                <a
                                    href={`/clubs/${encodeURIComponent(club.slug)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    title="Open Public Showcase in new tab"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">Open in Tab</span>
                                </a>
                            )}

                            {isManagerOrMember && (
                                onNavigateToEdit ? (
                                    <button
                                        type="button"
                                        onClick={onNavigateToEdit}
                                        className="px-3 py-1.5 rounded-xl bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#ebd04e] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                                    >
                                        Edit Profile
                                    </button>
                                ) : (
                                    <Link
                                        to="/club/profile"
                                        className="px-3 py-1.5 rounded-xl bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#ebd04e] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        Edit Profile
                                    </Link>
                                )
                            )}

                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px] ml-1"
                                    aria-label="Close profile"
                                    title="Close profile"
                                >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                </button>
                            )}
                        </div>
                    </div>
                </header>
            )}

            {/* Main Profile Canvas */}
            <main className={`${isEmbedded ? "w-full max-w-none px-2.5 xs:px-3 sm:px-5 lg:px-6 py-3.5 sm:py-5" : "max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"} space-y-6`}>
                {/* Header Banner & Hero Card */}
                <div className="rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] overflow-hidden">
                    {/* Header Banner Image (Full-width showcase) */}
                    <div className="w-full aspect-[2.4/1] sm:aspect-[3.2/1] lg:aspect-[3.8/1] max-h-80 bg-neutral-950 border-b-2 border-black relative overflow-hidden flex items-center justify-center">
                        {club.coverImageUrl ? (
                            <img
                                src={club.coverImageUrl}
                                alt={club.name}
                                className="w-full h-full object-cover object-center"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#FFE566] bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:16px_16px] flex items-center justify-center">
                                <span className="font-mono text-xs font-black uppercase tracking-widest text-black/50">
                                    Official Collegiate Chapter
                                </span>
                            </div>
                        )}

                        {/* Top Badges */}
                        {(club.visibility === "unlisted" || club.visibility === "draft") && (
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                {club.visibility === "unlisted" && (
                                    <span className="px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                                        Unlisted Profile
                                    </span>
                                )}
                                {club.visibility === "draft" && (
                                    <span className="px-3 py-1 rounded-full bg-neutral-100 border-2 border-black text-xs font-black text-neutral-800 shadow-[2px_2px_0px_#000]">
                                        Draft Preview
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Profile Information Row */}
                    <div className="p-4 sm:p-8 relative">
                        {/* Overlapping Logo & Identity Row */}
                        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4 sm:gap-6 mb-6">
                            <div className="flex min-w-0 flex-1 flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-5">
                                {club.logoUrl ? (
                                    <EnlargeableAvatar
                                        src={club.logoUrl}
                                        alt={club.name}
                                        displayName={club.name}
                                        username={club.slug}
                                        className="w-24 h-24 sm:w-28 sm:h-28 -mt-16 sm:-mt-20 rounded-2xl bg-white border-3 border-black overflow-hidden shadow-[4px_4px_0px_#000] shrink-0 flex items-center justify-center cursor-zoom-in"
                                    />
                                ) : (
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 -mt-16 sm:-mt-20 rounded-2xl bg-white border-3 border-black overflow-hidden shadow-[4px_4px_0px_#000] shrink-0 flex items-center justify-center font-black text-2xl text-black">
                                        <span>{club.name.slice(0, 2).toUpperCase()}</span>
                                    </div>
                                )}

                                <div className="min-w-0 space-y-1.5 pt-2 sm:pt-4">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight flex items-start gap-2 min-w-0">
                                            <span className="min-w-0 [overflow-wrap:anywhere]">{club.name}</span>
                                            <VerifiedBadge size="md" title="Verified on Orbix" />
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
                                        {(club.operatingStatus === "on_hiatus" || club.operatingStatus === "hiatus") && (
                                            <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-black text-[10px] font-black text-amber-900 shadow-[1px_1px_0px_#000]">
                                                On Hiatus
                                            </span>
                                        )}
                                        {club.operatingStatus === "inactive" && (
                                            <span className="px-2 py-0.5 rounded-full bg-neutral-200 border border-black text-[10px] font-black text-neutral-700 shadow-[1px_1px_0px_#000]">
                                                Inactive
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
                                    className="px-6 py-3 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 shrink-0 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Sparkles className="w-4 h-4 text-black" />
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

                        {/* Links & Contacts Bar */}
                        <div className="pt-5 mt-5 border-t border-black/10 flex items-center gap-3 flex-wrap">
                            {Array.isArray(club.links) && club.links.length > 0 ? (
                                club.links.map((linkItem, idx) => (
                                    <a
                                        key={idx}
                                        href={linkItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000] transition-colors"
                                    >
                                        {getPlatformIcon(linkItem.platform || linkItem.url, "w-3.5 h-3.5")}
                                        <span>{linkItem.label || (linkItem.platform === "x" ? "X / Twitter" : linkItem.platform === "whatsapp" ? "WhatsApp Community" : linkItem.platform.charAt(0).toUpperCase() + linkItem.platform.slice(1))}</span>
                                    </a>
                                ))
                            ) : (
                                <>
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
                                    {social.whatsapp && (
                                        <a
                                            href={social.whatsapp}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                        >
                                            {getPlatformIcon("whatsapp", "w-3.5 h-3.5")}
                                            <span>WhatsApp</span>
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
                                    {social.discord && (
                                        <a
                                            href={social.discord}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                        >
                                            {getPlatformIcon("discord", "w-3.5 h-3.5")}
                                            <span>Discord</span>
                                        </a>
                                    )}
                                    {social.youtube && (
                                        <a
                                            href={social.youtube}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                        >
                                            {getPlatformIcon("youtube", "w-3.5 h-3.5")}
                                            <span>YouTube</span>
                                        </a>
                                    )}
                                </>
                            )}
                            {club.publicEmail && (
                                <span
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    <span className="break-all">{maskPublicEmail(club.publicEmail)}</span>
                                </span>
                            )}
                            {club.contactPhone && (
                                <span
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border border-black text-xs font-black text-black flex items-center gap-1.5 shadow-[1px_1px_0px_#000]"
                                >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>{maskPublicPhone(club.contactPhone)}</span>
                                </span>
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
                                className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] shrink-0 hover:bg-[#8ee673] transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                Fill Application Form
                            </a>
                        )}
                    </div>
                )}

                {/* Internal Navigation Tabs */}
                <div className="flex items-center gap-2 border-b-2 border-black pb-2 overflow-x-auto scrollbar-none [&>button]:shrink-0">
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
                                        ? "bg-[#a2ff86] text-black"
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
                                <Suspense fallback={<p className="text-sm text-neutral-600">Loading club story…</p>}>
                                    <ClubMarkdownRenderer content={club.about} />
                                </Suspense>
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
                                            {coord.imageUrl ? (
                                                <EnlargeableAvatar
                                                    src={coord.imageUrl}
                                                    alt={coord.name}
                                                    displayName={coord.name}
                                                    username={coord.linkedUsername || undefined}
                                                    className="w-14 h-14 rounded-2xl bg-white border-2 border-black overflow-hidden shrink-0 flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#000] cursor-zoom-in"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-black overflow-hidden shrink-0 flex items-center justify-center font-black text-sm shadow-[2px_2px_0px_#000]">
                                                    <span>{coord.name.slice(0, 2).toUpperCase()}</span>
                                                </div>
                                            )}
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
                                                    <span
                                                        className="p-1 rounded-md bg-white border border-black text-black hover:bg-neutral-100"
                                                        title={maskPublicEmail(coord.contactEmail) || undefined}
                                                    >
                                                        <Mail className="w-3.5 h-3.5" />
                                                    </span>
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
                                                {ach.type && (
                                                    <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                                        {ach.type}
                                                    </span>
                                                )}
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
                        {/* Header & Search */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/10">
                            <div>
                                <h3 className="text-lg font-black text-black">Events, Hackathons & Workshops</h3>
                                <p className="text-xs font-medium text-neutral-600 mt-0.5">
                                    Official chapter schedule of upcoming meetups, hackathons, and archive of verified campus sessions.
                                </p>
                            </div>

                            {/* Search bar */}
                            <div className="relative min-w-[240px] sm:w-72">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    value={eventSearch}
                                    onChange={(e) => setEventSearch(e.target.value)}
                                    placeholder="Search sessions by title, venue..."
                                    className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black text-xs font-bold bg-[#FAF6EE] focus:outline-none focus:ring-2 focus:ring-[#a2ff86]"
                                />
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setEventFilter("all")}
                                className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer ${
                                    eventFilter === "all"
                                        ? "bg-black text-white"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                All ({upcomingEvents.length + pastEvents.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setEventFilter("upcoming")}
                                className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex items-center gap-1.5 ${
                                    eventFilter === "upcoming"
                                        ? "bg-[#a2ff86] text-black"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                                <span>Upcoming ({upcomingEvents.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEventFilter("past")}
                                className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex items-center gap-1.5 ${
                                    eventFilter === "past"
                                        ? "bg-[#FFDE59] text-black"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-600" />
                                <span>Past Sessions ({pastEvents.length})</span>
                            </button>
                        </div>

                        {/* Events Grid */}
                        {filteredEvents.length === 0 ? (
                            <div className="p-12 text-center rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black/30 space-y-3">
                                <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
                                <h4 className="text-base font-black text-black">No sessions found</h4>
                                <p className="text-xs font-bold text-neutral-500 max-w-sm mx-auto">
                                    {eventSearch.trim()
                                        ? `No events matching "${eventSearch}". Try a different search term.`
                                        : "No sessions scheduled in this category at this moment. Stay tuned!"}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                                {filteredEvents.map((evt) => (
                                    <ClubEventCard
                                        key={evt.id}
                                        event={evt}
                                        onSelect={(id, eventSlug) => handleSelectEvent(id, eventSlug)}
                                        actionLabel="Open Event"
                                        footerSubtitle={
                                            user?.accountType === "club" && (isManagerOrMember || club?.authUserId === user?.id)
                                                ? "Manage roster, agenda & analytics"
                                                : "View schedule, roster & registration"
                                        }
                                    />
                                ))}
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
