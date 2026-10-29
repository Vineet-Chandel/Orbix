import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { OrbixLogo } from "../../components/OrbixLogo";
import {
    ShieldCheck,
    ShieldAlert,
    Building2,
    Globe,
    Mail,
    Calendar,
    MapPin,
    ExternalLink,
    Clock,
    Share2,
    Check,
    AlertCircle,
    ArrowLeft,
    MessageSquare,
    Loader2,
} from "lucide-react";
import MessageClubModal from "./MessageClubModal";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";

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
    socialLinks: {
        github?: string;
        linkedin?: string;
        instagram?: string;
        x?: string;
        twitter?: string;
        discord?: string;
    } | null;
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
    locationType: "in_person" | "virtual" | "hybrid";
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
    const [upcomingEvents, setUpcomingEvents] = useState<PublicEvent[]>([]);
    const [pastEvents, setPastEvents] = useState<PublicEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isBlockedByClub, setIsBlockedByClub] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
    const [registeringEventId, setRegisteringEventId] = useState<string | null>(null);

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
                    setUpcomingEvents(data.upcomingEvents || []);
                    setPastEvents(data.pastEvents || []);
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

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
    };

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
            <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-black border-t-emerald-400 rounded-full animate-spin" />
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
                        Loading Club Profile...
                    </p>
                </div>
            </div>
        );
    }

    if (isBlockedByClub) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] flex flex-col items-center justify-center font-sans p-6 text-center select-none">
                <div className="w-16 h-16 rounded-3xl bg-rose-100 border-2 border-black flex items-center justify-center text-rose-700 mb-4 shadow-[4px_4px_0px_#000]">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black text-neutral-900 mb-2">Access Restricted</h1>
                <p className="text-xs font-bold text-neutral-600 max-w-sm mb-6 leading-relaxed">
                    You don't have permission to access this club.
                </p>
                <Link
                    to="/"
                    className="px-5 py-2.5 rounded-2xl bg-black text-white font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800"
                >
                    Back to Orbix
                </Link>
            </div>
        );
    }

    if (notFound || !club) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] flex flex-col items-center justify-center font-sans p-6 text-center">
                <div className="w-16 h-16 rounded-3xl bg-neutral-100 border-2 border-black flex items-center justify-center text-neutral-400 mb-4 shadow-[4px_4px_0px_#000]">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black text-neutral-900 mb-2">Club Not Found</h1>
                <p className="text-xs font-medium text-neutral-600 max-w-sm mb-6">
                    The requested club profile does not exist, is under verification, or may have been unlisted.
                </p>
                <Link
                    to="/"
                    className="px-5 py-2.5 rounded-2xl bg-black text-white font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800"
                >
                    Back to Orbix
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-neutral-900 font-sans selection:bg-black selection:text-white flex flex-col relative">
            <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Public Top Navbar */}
            <header className="w-full bg-white border-b-2 border-black px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 select-none">
                <div className="flex items-center gap-3">
                    <Link
                        to="/"
                        className="flex items-center gap-2 group text-xs font-black uppercase tracking-wider text-neutral-600 hover:text-black"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                        <OrbixLogo className="w-4 h-4 text-black flex-shrink-0" />
                        <span>Orbix</span>
                    </Link>
                    <span className="text-neutral-300">/</span>
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-900 truncate max-w-[200px]">
                        {club.name}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                    >
                        {copiedShare ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>{copiedShare ? "Link Copied" : "Share"}</span>
                    </button>

                    <Link
                        to="/auth/signin"
                        className="px-3.5 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000]"
                    >
                        Sign In
                    </Link>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8 flex-1">
                {/* Hero / Identity Card */}
                <div className="rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] overflow-hidden">
                    {/* Cover Banner */}
                    <div className="h-40 sm:h-52 w-full bg-linear-to-r from-emerald-200 via-sky-200 to-amber-200 border-b-2 border-black relative overflow-hidden">
                        {club.coverImageUrl && (
                            <img
                                src={club.coverImageUrl}
                                alt={`${club.name} banner`}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    {/* Profile Header Details */}
                    <div className="p-6 sm:p-8 relative">
                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
                            {/* Avatar */}
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-2 border-black bg-white p-1 shadow-[4px_4px_0px_#000] shrink-0">
                                <div className="w-full h-full rounded-2xl bg-emerald-200 border border-black/20 flex items-center justify-center font-black text-3xl overflow-hidden">
                                    {club.logoUrl ? (
                                        <img src={club.logoUrl} alt={club.name} className="w-full h-full object-cover" />
                                    ) : (
                                        club.name.slice(0, 2).toUpperCase()
                                    )}
                                </div>
                            </div>

                            {/* Verification Pill */}
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-300 text-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <ShieldCheck className="w-4 h-4 text-emerald-800" />
                                    <span>Verified College Club</span>
                                </span>
                            </div>
                        </div>

                        {/* Title & Affiliation */}
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
                                    {club.name}
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-100 border border-black text-neutral-700">
                                    {club.category}
                                </span>
                            </div>

                            <p className="text-sm font-bold text-neutral-600 flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-neutral-400" />
                                <span>{club.collegeName}</span>
                                <span className="text-neutral-400">•</span>
                                <span>
                                    {club.collegeCity}, {club.collegeState}, {club.collegeCountry}
                                </span>
                            </p>

                            {club.shortDescription && (
                                <p className="text-sm text-neutral-700 font-medium pt-1 max-w-3xl leading-relaxed">
                                    {club.shortDescription}
                                </p>
                            )}
                        </div>

                        {/* Quick Action Links & Social Pills */}
                        <div className="mt-6 pt-5 border-t-2 border-black/10 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsMessageModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-2 cursor-pointer"
                            >
                                <MessageSquare className="w-3.5 h-3.5 text-[#FFE566]" />
                                <span>Message Club</span>
                            </button>

                            {club.websiteUrl && (
                                <a
                                    href={club.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Globe className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Official Website</span>
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                </a>
                            )}

                            {club.publicEmail && (
                                <a
                                    href={`mailto:${club.publicEmail}`}
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Mail className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Contact Club</span>
                                </a>
                            )}

                            {/* Social Icons */}
                            {club.socialLinks?.github && (
                                <a
                                    href={club.socialLinks.github}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span>GitHub</span>
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                </a>
                            )}
                            {club.socialLinks?.linkedin && (
                                <a
                                    href={club.socialLinks.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 text-blue-700"
                                >
                                    <span>LinkedIn</span>
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                </a>
                            )}
                            {club.socialLinks?.instagram && (
                                <a
                                    href={club.socialLinks.instagram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 text-pink-700"
                                >
                                    <span>Instagram</span>
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                </a>
                            )}
                            {(club.socialLinks?.x || club.socialLinks?.twitter) && (
                                <a
                                    href={club.socialLinks.x || club.socialLinks.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span>X (Twitter)</span>
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                </a>
                            )}
                            {club.socialLinks?.discord && (
                                <a
                                    href={club.socialLinks.discord}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 text-indigo-700"
                                >
                                    <span>Discord</span>
                                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* About Narrative Section */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                    <h2 className="text-lg font-black text-neutral-900 pb-2 border-b-2 border-black/10">
                        About {club.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed font-medium whitespace-pre-line">
                        {club.about ||
                            `${club.name} is the official verified student chapter at ${club.collegeName}, dedicated to fostering learning, collaboration, and competitive excellence among collegiate developers.`}
                    </p>
                </div>

                {/* Upcoming Events Section */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-5">
                    <div className="flex items-center justify-between pb-2 border-b-2 border-black/10">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-600" />
                            <h2 className="text-lg font-black text-neutral-900">Upcoming Events</h2>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-200 border border-black">
                            {upcomingEvents.length}
                        </span>
                    </div>

                    {upcomingEvents.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-2">
                            <Calendar className="w-8 h-8 text-neutral-400 mx-auto" />
                            <p className="text-xs font-bold text-neutral-600">
                                No upcoming events scheduled right now.
                            </p>
                            <p className="text-[11px] text-neutral-500">
                                Check back soon or follow the club's official channels for announcements.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {upcomingEvents.map((ev) => (
                                <div
                                    key={ev.id}
                                    className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-300 border border-black">
                                                {ev.locationType === "virtual" ? "Virtual" : ev.locationType === "hybrid" ? "Hybrid" : "In-Person"}
                                            </span>
                                            <span className="text-xs font-bold text-neutral-500 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                                    weekday: "short",
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>

                                        <h3 className="font-black text-base text-neutral-900 line-clamp-1">{ev.title}</h3>
                                        <p className="text-xs text-neutral-600 line-clamp-2 mt-1.5 leading-relaxed font-medium">
                                            {ev.summary || ev.description || "Join fellow students for this upcoming club session."}
                                        </p>

                                        <div className="mt-3 flex items-center gap-1 text-xs text-neutral-500 font-bold">
                                            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>
                                                {ev.venueOrLocation || (ev.locationType === "virtual" ? "Online Link" : "Campus Hall")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-black/10 flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleRegisterEvent(ev.id)}
                                            disabled={registeringEventId === ev.id}
                                            className="flex-1 py-2 rounded-xl bg-emerald-300 hover:bg-emerald-400 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                                        >
                                            {registeringEventId === ev.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Calendar className="w-3.5 h-3.5" />
                                            )}
                                            <span>RSVP / Register</span>
                                        </button>
                                        {ev.registrationUrl && (
                                            <a
                                                href={ev.registrationUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[2px_2px_0px_#000]"
                                                title="External event link"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Past Events Archive (if any) */}
                {pastEvents.length > 0 && (
                    <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-black/10">
                            <h2 className="text-base font-black text-neutral-900">Past Events & Sessions</h2>
                            <span className="text-xs font-bold text-neutral-500">{pastEvents.length} completed</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pastEvents.slice(0, 4).map((ev) => (
                                <div
                                    key={ev.id}
                                    className="p-4 rounded-2xl bg-neutral-50 border-2 border-neutral-300 flex flex-col justify-between"
                                >
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-neutral-400">
                                            {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                        <h3 className="font-bold text-sm text-neutral-800 mt-0.5 line-clamp-1">{ev.title}</h3>
                                        <p className="text-xs text-neutral-500 line-clamp-1 mt-1 font-medium">
                                            {ev.summary || ev.description || "Completed session."}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="w-full py-6 text-center text-xs font-bold text-neutral-500 border-t-2 border-black/10 bg-white select-none">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span>Powered by</span>
                    <Link to="/" className="inline-flex items-center gap-1.5 font-black text-neutral-900 hover:underline">
                        <OrbixLogo className="w-3.5 h-3.5 text-black flex-shrink-0" />
                        <span>Orbix Club Platform</span>
                    </Link>
                    <span>• Verified Student Developer Ecosystem</span>
                </div>
            </footer>

            {/* Message Club Modal */}
            <MessageClubModal
                isOpen={isMessageModalOpen}
                onClose={() => setIsMessageModalOpen(false)}
                clubId={club.id}
                clubName={club.name}
                clubLogoUrl={club.logoUrl}
            />
        </div>
    );
}
