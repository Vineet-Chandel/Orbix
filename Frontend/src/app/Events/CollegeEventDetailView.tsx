import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
    Calendar,
    Clock,
    MapPin,
    Users,
    CheckCircle2,
    ExternalLink,
    Building2,
    BookOpen,
    Copy,
    Check,
    Video,
    ShieldCheck,
    ShieldAlert,
    ArrowRight,
    Globe2,
    GraduationCap,
    Lock,
    Sparkles,
    AlertCircle,
    FileText,
    Ticket,
    Ban,
    AlertTriangle,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import {
    fetchPublicEventById,
    type CollegeEventItem,
} from "../../api/collegeEventsApi";
import { ClubMarkdownRenderer } from "../Club/Profile/ClubMarkdownRenderer";
import { EventPublicTimelineView } from "./EventPublicTimelineView";
import { EventActionRow } from "../../components/events/EventActionRow";
import { DynamicEventRegistrationModal } from "./DynamicEventRegistrationModal";
import { EventTeamManagementModal } from "./EventTeamManagementModal";
import { CollegeRestrictionModal } from "../../components/CollegeRestrictionModal";
import { OrbixLoader } from "../../components/ui/loader";

interface CollegeEventDetailViewProps {
    eventId?: string;
    initialEvent?: CollegeEventItem | null;
    onBack?: () => void;
    onOpenMobileSidebar?: () => void;
}

export const CollegeEventDetailView: React.FC<CollegeEventDetailViewProps> = ({
    eventId: propEventId,
    initialEvent,
    onBack,
    onOpenMobileSidebar,
}) => {
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const params = useParams<{ eventId?: string; slug?: string }>();
    const [searchParams] = useSearchParams();

    const targetEventId = propEventId || params.eventId || searchParams.get("eventId") || searchParams.get("event") || "";

    const [event, setEvent] = useState<CollegeEventItem | null>(initialEvent || null);
    const [loading, setLoading] = useState<boolean>(!initialEvent && Boolean(targetEventId));
    const [error, setError] = useState<string | null>(null);

    const [copiedCode, setCopiedCode] = useState(false);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
    const [isWithdrawnModalOpen, setIsWithdrawnModalOpen] = useState(false);
    const [restrictedEvent, setRestrictedEvent] = useState<CollegeEventItem | null>(null);

    // Fetch event if not provided initially or if targetEventId changes
    useEffect(() => {
        if (!targetEventId) {
            setError("No event ID provided.");
            setLoading(false);
            return;
        }

        if (initialEvent && initialEvent.id === targetEventId) {
            setEvent(initialEvent);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        fetchPublicEventById(targetEventId)
            .then((data) => {
                if (!isMounted) return;
                if (data) {
                    setEvent(data);
                } else {
                    setError("Event not found or currently unavailable.");
                }
            })
            .catch((err) => {
                if (!isMounted) return;
                console.error("Failed to load event details:", err);
                setError(err.message || "Failed to load event details.");
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [targetEventId, initialEvent]);

    // Handle deep-link direct action=register
    useEffect(() => {
        if (event && (searchParams.get("action") === "register" || searchParams.get("register") === "true")) {
            handleInitiateApply();
        }
    }, [event, searchParams]);

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate("/college-events");
        }
    };

    const handleCopyTicket = () => {
        if (!event?.ticketCode) return;
        navigator.clipboard.writeText(event.ticketCode);
        setCopiedCode(true);
        toast.success("Pass code copied to clipboard!");
        setTimeout(() => setCopiedCode(false), 2000);
    };


    const handleInitiateApply = () => {
        if (!event) return;

        if (event.registrationStatus === "cancelled") {
            setIsWithdrawnModalOpen(true);
            return;
        }

        if (!user) {
            const redirectUrl = `/college-events/${event.id}${event.slug ? `/${event.slug}` : ""}`;
            navigate(`/auth/signin?redirect=${encodeURIComponent(redirectUrl)}`);
            return;
        }

        const userCollegeId = user?.collegeId || user?.college?.id;
        const userCollegeName = user?.college?.officialName || (typeof user?.college === "string" ? user.college : "");

        const isSameCollege =
            (event.collegeId && userCollegeId && String(event.collegeId).trim().toLowerCase() === String(userCollegeId).trim().toLowerCase()) ||
            (event.collegeName && userCollegeName && event.collegeName.trim().toLowerCase() === userCollegeName.trim().toLowerCase());

        const isEligible = event.scope === "PAN_INDIA" || isSameCollege;

        if (!isEligible) {
            setRestrictedEvent(event);
            return;
        }

        if (checkIsRegistrationClosed()) {
            toast.error("Registration deadline has passed for this event. Applications are no longer accepted.");
            return;
        }

        setIsRegisterModalOpen(true);
    };

    const checkIsRegistrationClosed = (): boolean => {
        if (!event) return true;
        if (event.status === "completed" || event.status === "cancelled") return true;
        if (typeof event.isRegistrationClosed === "boolean") return event.isRegistrationClosed;
        if (event.registrationDeadline) {
            const deadlineMs = new Date(event.registrationDeadline).getTime();
            if (!isNaN(deadlineMs)) return deadlineMs < Date.now();
        }
        if (event.endsAt) {
            const endsMs = new Date(event.endsAt).getTime();
            if (!isNaN(endsMs)) return endsMs < Date.now();
        }
        return false;
    };

    const checkIsRegistrationUpcoming = (): boolean => {
        if (!event) return false;
        if (event.status === "completed" || event.status === "cancelled") return false;
        if (typeof event.isRegistrationUpcoming === "boolean") return event.isRegistrationUpcoming;
        if (event.registrationStartsAt) {
            const startsMs = new Date(event.registrationStartsAt).getTime();
            if (!isNaN(startsMs)) return startsMs > Date.now();
        }
        return false;
    };

    if (loading) {
        return (
            <div className="w-full py-24 flex flex-col items-center justify-center space-y-4">
                {onOpenMobileSidebar && (
                    <button
                        type="button"
                        onClick={onOpenMobileSidebar}
                        className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer shrink-0"
                        aria-label="Open sidebar"
                    >
                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                )}
                <OrbixLoader size="lg" />
                <span className="text-sm font-black text-neutral-600 uppercase tracking-wider">
                    Loading Event Full Page...
                </span>
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="w-full p-8 rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center space-y-4 my-auto">
                {onOpenMobileSidebar && (
                    <button
                        type="button"
                        onClick={onOpenMobileSidebar}
                        className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer shrink-0"
                        aria-label="Open sidebar"
                    >
                        <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                )}
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                    <AlertCircle className="w-7 h-7 text-amber-700 stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-black text-black">Event Not Found</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 max-w-md mx-auto">
                        {error || "We could not find the requested event session. It may have been removed or unpublished by organizers."}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleBack}
                    className="px-5 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] text-black border-2 border-black font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] cursor-pointer inline-flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                    <span>Back to College Events</span>
                </button>
            </div>
        );
    }

    const formattedStartDate = new Date(event.startsAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const formattedStartTime = new Date(event.startsAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    const formattedEndTime = event.endsAt
        ? new Date(event.endsAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
        : null;

    const isCompleted = event.status === "completed" || new Date(event.endsAt || event.startsAt).getTime() < Date.now();
    const isLiveNow =
        !isCompleted &&
        new Date(event.startsAt).getTime() <= Date.now() &&
        (event.endsAt ? new Date(event.endsAt).getTime() >= Date.now() : true);

    const isRegClosed = checkIsRegistrationClosed();
    const isRegUpcoming = checkIsRegistrationUpcoming();

    return (
        <div className="w-full space-y-6 pb-16 animate-in fade-in duration-200">
            {/* Top Navigation Bar: Back link, Breadcrumbs, Scope Pill, College Name */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {onOpenMobileSidebar && (
                        <button
                            type="button"
                            onClick={onOpenMobileSidebar}
                            className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer shrink-0"
                            aria-label="Open sidebar"
                        >
                            <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleBack}
                        className="px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-[#FAF6EE] text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                        <span>All Events</span>
                    </button>

                    <div className="h-5 w-[2px] bg-black/10 hidden sm:block shrink-0" />

                    <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-bold text-neutral-400 hidden md:inline truncate">
                            College Events /
                        </span>
                        <span className="text-xs font-black text-black truncate max-w-[240px] sm:max-w-xs md:max-w-md">
                            {event.title}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1.5px_1.5px_0px_#000] inline-flex items-center gap-1 ${
                            event.scope === "PAN_INDIA" ? "bg-[#FF9933] text-black" : "bg-[#a2ff86] text-black"
                        }`}
                    >
                        {event.scope === "PAN_INDIA" ? (
                            <>
                                <Globe2 className="w-3 h-3 stroke-[2.5]" />
                                <span>Pan-India Arena</span>
                            </>
                        ) : (
                            <>
                                <GraduationCap className="w-3 h-3 stroke-[2.5]" />
                                <span>Campus Exclusive</span>
                            </>
                        )}
                    </span>

                    <span className="text-xs font-black text-neutral-700 bg-[#FAF6EE] px-3 py-1 rounded-xl border border-black hidden sm:inline truncate max-w-[200px]">
                        {event.collegeName || "Verified Campus"}
                    </span>
                </div>
            </div>

            {/* Hero Header Card */}
            <div className="p-5 sm:p-7 rounded-3xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] space-y-5">
                {/* Cover Image Banner (aspect 2.4/1, 100% full view, never cropped) */}
                {event.coverImageUrl && (
                    <div className="relative w-full aspect-[2.4/1] rounded-2xl border-3 border-black overflow-hidden shadow-[3px_3px_0px_#000] bg-neutral-950 flex items-center justify-center">
                        <img
                            src={event.coverImageUrl}
                            alt={event.title}
                            className="w-full h-full object-contain"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] ${
                                    isCompleted
                                        ? "bg-neutral-200 text-neutral-800"
                                        : isRegClosed
                                        ? "bg-neutral-200 text-neutral-800"
                                        : isLiveNow
                                        ? "bg-emerald-300 text-black animate-pulse"
                                        : "bg-[#a2ff86] text-black"
                                }`}
                            >
                                {isCompleted ? (
                                    "Completed"
                                ) : isRegClosed ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Lock className="w-3 h-3" />
                                        Registration Closed
                                    </span>
                                ) : isLiveNow ? (
                                    "Live Now"
                                ) : (
                                    "Upcoming"
                                )}
                            </span>

                            {event.isTeamEvent && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Team ({event.minTeamSize || 1}-{event.maxTeamSize || 4})</span>
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Title & Interactive Action Row */}
                <div className="space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-black tracking-tight leading-tight flex-1">
                                    {event.title}
                                </h1>
                                <div className="flex items-center shrink-0 pt-0.5 lg:hidden">
                                    <EventActionRow
                                        eventId={event.id}
                                        eventTitle={event.title}
                                        eventSummary={event.summary || undefined}
                                        initialLikeCount={event.likesCount}
                                        initialLiked={event.hasLiked}
                                        initialShareCount={(event as any).sharesCount}
                                        size="md"
                                    />
                                </div>
                            </div>

                            {event.summary && (
                                <p className="text-sm sm:text-base font-semibold text-neutral-700 leading-relaxed max-w-4xl">
                                    {event.summary}
                                </p>
                            )}
                        </div>

                        {/* Right: Actions and Team Size Widget */}
                        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
                            <div className="hidden lg:flex items-center">
                                <EventActionRow
                                    eventId={event.id}
                                    eventTitle={event.title}
                                    eventSummary={event.summary || undefined}
                                    initialLikeCount={event.likesCount}
                                    initialLiked={event.hasLiked}
                                    initialShareCount={(event as any).sharesCount}
                                    size="md"
                                />
                            </div>

                            {/* Team Size Widget */}
                            <div className="p-3 sm:p-3.5 rounded-2xl bg-white border-2 sm:border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3 self-start lg:self-auto">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                    <Users className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div className="min-w-0 pr-1 text-left">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Team Size
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-black block truncate">
                                        {event.isTeamEvent
                                            ? `${event.minTeamSize || 2} - ${event.maxTeamSize || 4} Members`
                                            : "Individual Participation"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Two-Column Split: Logistics & Status (5 cols) | Timeline & Full Agenda (7 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT COLUMN: Other Details & Logistics (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* 1. Hosting Club Information Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Organized & Hosted By
                        </div>

                        <div className="flex items-center gap-3">
                            {event.clubLogoUrl ? (
                                <img
                                    src={event.clubLogoUrl}
                                    alt={event.clubName}
                                    className="w-12 h-12 rounded-xl border-2 border-black object-cover shadow-[2px_2px_0px_#000]"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-xl border-2 border-black bg-[#a2ff86] flex items-center justify-center font-black text-base shadow-[2px_2px_0px_#000]">
                                    {event.clubName.slice(0, 2).toUpperCase()}
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="font-black text-base text-black truncate leading-tight">
                                        {event.clubName}
                                    </h3>
                                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                </div>
                                <p className="text-xs font-bold text-neutral-600 flex items-center gap-1 truncate mt-0.5">
                                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{event.collegeName || "Campus Club"}</span>
                                </p>
                            </div>
                        </div>

                        <Link
                            to={`/clubs/${event.clubSlug}`}
                            className="w-full py-2 px-3 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <span>Visit Club Showcase</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* 2. Schedule & Venue Logistics Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Date, Time & Venue
                        </div>

                        <div className="space-y-2.5 text-xs font-bold">
                            {/* Date */}
                            <div className="flex items-center gap-2.5 text-black">
                                <div className="w-7 h-7 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-black">{formattedStartDate}</div>
                                    <div className="text-[11px] text-neutral-500 font-medium">Session Date</div>
                                </div>
                            </div>

                            {/* Time */}
                            <div className="flex items-center gap-2.5 text-black">
                                <div className="w-7 h-7 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-black">
                                        {formattedStartTime} {formattedEndTime ? `– ${formattedEndTime}` : ""}
                                        {event.timezone ? ` (${event.timezone})` : ""}
                                    </div>
                                    <div className="text-[11px] text-neutral-500 font-medium">Session Timing</div>
                                </div>
                            </div>

                            {/* Venue / Location */}
                            <div className="flex items-center gap-2.5 text-black">
                                <div className="w-7 h-7 rounded-lg border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                    {event.locationType === "virtual" ? (
                                        <Video className="w-4 h-4" />
                                    ) : (
                                        <MapPin className="w-4 h-4" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black truncate">
                                        {event.venueOrLocation ||
                                            (event.locationType === "virtual"
                                                ? "Virtual Session (Online Link)"
                                                : event.locationType === "hybrid"
                                                    ? "Hybrid Campus & Online"
                                                    : "Campus Hall")}
                                    </div>
                                    <div className="text-[11px] text-neutral-500 font-medium">
                                        Mode: <span className="capitalize">{event.locationType || "In-Person"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Team Size & Registered Statistics (Unstop / Hackathon Style) */}
                    <div className="p-4 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl border-2 border-black bg-[#FAF6EE] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                <Users className="w-5 h-5 text-black" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                    Team Size
                                </span>
                                <span className="text-sm font-black text-black block truncate">
                                    {event.isTeamEvent
                                        ? `${event.minTeamSize || 2} - ${event.maxTeamSize || 4} Members`
                                        : "Individual Participation"}
                                </span>
                            </div>
                        </div>

                        <div className="text-right shrink-0 pl-3 border-l-2 border-black/10">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Registered
                            </span>
                            <span className="text-sm font-black text-emerald-700">
                                {event.registrationsCount || 0}
                            </span>
                        </div>
                    </div>

                    {/* 4. Registration Status & Pass Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-3.5">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-black/10">
                            <div className="text-[11px] font-black uppercase tracking-wider text-black">
                                Registration Status
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-neutral-800 bg-[#FAF6EE] px-2.5 py-0.5 rounded-full border border-black/20">
                                <Users className="w-3.5 h-3.5 text-neutral-600" />
                                <span>{event.registrationsCount || 0} registered</span>
                            </div>
                        </div>

                        {event.isTeamEvent && (
                            <div className="p-3 rounded-xl bg-[#a2ff86]/25 border-l-4 border-emerald-600 space-y-1.5">
                                <div className="flex items-center gap-1.5 font-black text-black text-xs">
                                    <Users className="w-4 h-4 text-emerald-800 shrink-0" />
                                    <span>Team Registration Event ({event.minTeamSize || 2} to {event.maxTeamSize || 4} Members)</span>
                                </div>
                                <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                    Form or join a team before registration closes. A minimum of {event.minTeamSize || 2} members is required for team acceptance.
                                </p>
                                {event.teamId && (
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsTeamModalOpen(true)}
                                            className="w-full py-2 px-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            <span>
                                                {event.teamRole === "leader" ? "Manage Team Roster & Invites" : "Manage Team Roster / Leave Team"}
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {event.scope === "PAN_INDIA" && (
                            <div className="p-3 rounded-xl bg-amber-500/10 border-l-4 border-amber-500 space-y-1.5">
                                <div className="flex items-center gap-1.5 font-black text-black text-xs">
                                    <Globe2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    <span>Pan-India Live Notification Shield</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] leading-relaxed">
                                    {event.isRegistered || event.registrationStatus === "registered" ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                            <span className="font-semibold text-emerald-950">
                                                Live tracking active: Start countdown, pass synchronization, and critical organizer updates are enabled for this national event.
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-3.5 h-3.5 text-amber-800 shrink-0 mt-0.5" />
                                            <span className="font-medium text-neutral-700">
                                                Non-registered students do not receive start reminders or tracking notifications. Register below to activate live entry tracking, deadline alerts, and verified pass sync.
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {event.registrationStatus === "registered" || event.registrationStatus === "attended" || (event.isRegistered && event.registrationStatus !== "pending") ? (
                            <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-600 space-y-2.5">
                                <div className="flex items-center gap-2 text-emerald-950 font-black text-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                    <span>Application Accepted · Your Pass is Active!</span>
                                </div>
                                {event.ticketCode && (
                                    <div className="flex items-center justify-between bg-white border border-emerald-700 px-3 py-2 rounded-lg text-xs font-mono">
                                        <span className="font-bold text-neutral-600">Ticket Pass:</span>
                                        <div className="flex items-center gap-2 font-black text-black">
                                            <span>{event.ticketCode}</span>
                                            <button
                                                type="button"
                                                onClick={handleCopyTicket}
                                                className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                                                title="Copy Ticket Code"
                                            >
                                                {copiedCode ? <Check className="w-3.5 h-3.5 text-green-700" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-1">
                                    <Link
                                        to="/activity?tab=sessions"
                                        className="w-full py-2 px-3 rounded-xl bg-emerald-200 hover:bg-emerald-300 text-emerald-950 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <Ticket className="w-3.5 h-3.5 text-emerald-950" />
                                        <span>View Session Ticket in Activity</span>
                                    </Link>
                                </div>
                            </div>
                        ) : event.registrationStatus === "pending" || event.isPending ? (
                            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-600 space-y-2.5 text-center">
                                <div className="flex items-center justify-center gap-2 text-amber-950 font-black text-xs">
                                    <Clock className="w-4 h-4 text-amber-700" />
                                    <span>Application Pass · Under Review</span>
                                </div>
                                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                                    Your application has been received and is currently in the review stage with {event.clubName}. This proves you have registered; official entry tickets activate once approved.
                                </p>
                                <div className="pt-1">
                                    <Link
                                        to="/activity?tab=applications"
                                        className="w-full py-2 px-3 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-amber-950" />
                                        <span>View Application Pass in Activity</span>
                                    </Link>
                                </div>
                            </div>
                        ) : event.registrationStatus === "cancelled" ? (
                            <div className="p-3.5 rounded-xl bg-neutral-100 border-2 border-neutral-700 space-y-2.5 text-center">
                                <div className="flex items-center justify-center gap-2 text-neutral-900 font-black text-xs uppercase tracking-wider">
                                    <Ban className="w-4 h-4 text-neutral-700" />
                                    <span>Application Withdrawn</span>
                                </div>
                                <p className="text-[11px] font-bold text-neutral-600 leading-relaxed">
                                    You previously withdrew your application for this event. As per event rules, re-application for this session is restricted.
                                </p>
                                <div className="pt-1 flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsWithdrawnModalOpen(true)}
                                        className="w-full py-2 px-3 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>View Withdrawal Notice</span>
                                    </button>
                                    <Link
                                        to="/activity?tab=applications"
                                        className="w-full py-2 px-3 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>View In Activity</span>
                                    </Link>
                                </div>
                            </div>
                        ) : event.registrationStatus === "rejected" ? (
                            <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-600 space-y-2 text-center">
                                <div className="flex items-center justify-center gap-2 text-rose-950 font-black text-xs">
                                    <ShieldAlert className="w-4 h-4 text-rose-700" />
                                    <span>Application Not Selected</span>
                                </div>
                                <p className="text-[11px] font-bold text-rose-800 leading-relaxed">
                                    Your application was not selected by {event.clubName}. You may update your information and re-apply.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleInitiateApply}
                                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-[2px_2px_0px_#000]"
                                >
                                    Re-Submit Application
                                </button>
                            </div>
                        ) : isCompleted ? (
                            <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-300 text-center text-xs font-bold text-neutral-600">
                                This event session has concluded.
                            </div>
                        ) : isRegClosed ? (
                            <div className="p-3.5 rounded-xl bg-neutral-100 border-2 border-neutral-400 space-y-1.5 text-center">
                                <div className="flex items-center justify-center gap-1.5 text-neutral-900 font-black text-xs uppercase tracking-wider">
                                    <Lock className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Registration Concluded</span>
                                </div>
                                <p className="text-[11px] font-bold text-neutral-600 leading-relaxed">
                                    {event.registrationDeadline 
                                        ? `The registration window for this event closed on ${new Date(event.registrationDeadline).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. Applications are no longer accepted.`
                                        : "The registration window for this event has closed. Applications are no longer accepted."}
                                </p>
                            </div>
                        ) : isRegUpcoming ? (
                            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-1.5 text-center">
                                <div className="flex items-center justify-center gap-2 text-amber-950 font-black text-xs uppercase tracking-wider">
                                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Registration Opens Soon</span>
                                </div>
                                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                                    {event.registrationStartsAt
                                        ? `Registration opens on ${new Date(event.registrationStartsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.`
                                        : "Registration for this event has not started yet."}
                                </p>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleInitiateApply}
                                className="w-full py-3.5 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] text-black border-2 border-black font-black text-sm shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2"
                            >
                                <span>Apply to Event</span>
                                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        )}

                        {event.registrationUrl && (
                            <a
                                href={event.registrationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-3 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>External RSVP Link</span>
                            </a>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Interactive Timeline & Agenda (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Interactive Event Timeline & Deliverables Pipeline */}
                    <EventPublicTimelineView
                        eventId={event.id}
                        isRegistered={Boolean(event.isRegistered || event.registrationStatus === "registered")}
                        registrationStatus={event.registrationStatus || undefined}
                    />

                    {/* Full Description & Agenda */}
                    <div className="p-5 sm:p-7 rounded-3xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] space-y-4">
                        <div className="flex items-center gap-2 border-b-2 border-black/10 pb-3">
                            <BookOpen className="w-5 h-5 text-black" />
                            <h2 className="font-black text-base sm:text-lg text-black tracking-tight">
                                Full Description & Agenda
                            </h2>
                        </div>

                        {/* Markdown Content */}
                        <div className="text-neutral-900 leading-relaxed min-h-[160px]">
                            {event.description && event.description.trim() ? (
                                <ClubMarkdownRenderer content={event.description} />
                            ) : (
                                <div className="p-8 text-center bg-[#FAF6EE] rounded-xl border-2 border-dashed border-black/20 space-y-2">
                                    <p className="text-xs font-bold text-neutral-500">
                                        No extended description or agenda has been posted for this session.
                                    </p>
                                    {event.summary && (
                                        <p className="text-xs font-semibold text-neutral-800 italic">
                                            "{event.summary}"
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Sponsors & Partners Section (Vanishes if 0 sponsors) */}
            {event.sponsors && event.sponsors.length > 0 && (
                <div className="p-5 sm:p-7 rounded-3xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] space-y-4">
                    <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-black" />
                            <h2 className="font-black text-base sm:text-lg text-black tracking-tight">
                                Event Partners & Sponsors
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                {event.sponsors.length}
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-neutral-500 hidden sm:inline">
                            Click any partner card to visit their official website
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                        {event.sponsors.map((sponsor, index) => {
                            const sponsorImage = sponsor.logoUrl || sponsor.imageUrl || "";
                            const rawLink = sponsor.websiteUrl || sponsor.link || "";
                            const hasLink = Boolean(rawLink && rawLink.trim());
                            const redirectUrl = hasLink
                                ? /^https?:\/\//i.test(rawLink.trim())
                                    ? rawLink.trim()
                                    : `https://${rawLink.trim()}`
                                : undefined;

                            const CardContent = (
                                <div
                                    className={`p-3 sm:p-4 rounded-xl border-2 border-black bg-[#FAF6EE] flex flex-col items-center text-center justify-between gap-2.5 h-full transition-all group ${
                                        hasLink
                                            ? "hover:-translate-y-1 hover:shadow-[4px_4px_0px_#000] hover:bg-white cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                            : "shadow-[2px_2px_0px_#000]"
                                    }`}
                                >
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-black bg-white overflow-hidden flex items-center justify-center p-1.5 shadow-[2px_2px_0px_#000] shrink-0 group-hover:scale-105 transition-transform">
                                        {sponsorImage ? (
                                            <img
                                                src={sponsorImage}
                                                alt={sponsor.name}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <Building2 className="w-8 h-8 text-neutral-400" />
                                        )}
                                    </div>

                                    <div className="space-y-1 w-full min-w-0">
                                        <div className="flex items-center justify-center gap-1">
                                            <h4 className="font-black text-xs sm:text-sm text-black truncate leading-tight group-hover:text-indigo-600 transition-colors">
                                                {sponsor.name || "Sponsor Partner"}
                                            </h4>
                                            {hasLink && (
                                                <ExternalLink className="w-3 h-3 text-neutral-500 opacity-60 group-hover:opacity-100 group-hover:text-indigo-600 shrink-0" />
                                            )}
                                        </div>
                                        {sponsor.description && (
                                            <p className="text-[10px] sm:text-[11px] font-medium text-neutral-600 line-clamp-2 leading-snug">
                                                {sponsor.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );

                            return hasLink ? (
                                <a
                                    key={sponsor.id || `sp_pub_${index}`}
                                    href={redirectUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block h-full"
                                    title={`Visit ${sponsor.name || "sponsor"} (${redirectUrl})`}
                                >
                                    {CardContent}
                                </a>
                            ) : (
                                <div key={sponsor.id || `sp_pub_${index}`} className="block h-full">
                                    {CardContent}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Dynamic Event Registration Modal */}
            <DynamicEventRegistrationModal
                isOpen={isRegisterModalOpen}
                onClose={() => setIsRegisterModalOpen(false)}
                event={event}
                onSuccess={(updatedEvent) => {
                    setEvent(updatedEvent);
                    setIsRegisterModalOpen(false);
                    toast.success("Application submitted! Your application pass is ready for review.", { title: "Application Submitted" });
                }}
            />

            {/* Team Roster & Invites Management Modal */}
            {event.isTeamEvent && event.teamId && (
                <EventTeamManagementModal
                    isOpen={isTeamModalOpen}
                    onClose={() => setIsTeamModalOpen(false)}
                    eventId={event.id}
                    teamId={event.teamId}
                    eventTitle={event.title}
                    eventStartsAt={event.startsAt}
                    onTeamUpdated={() => {
                        fetchPublicEventById(targetEventId)
                            .then((res) => {
                                if (res) setEvent(res);
                            })
                            .catch(() => {});
                    }}
                    onTeamLeft={() => {
                        fetchPublicEventById(targetEventId)
                            .then((res) => {
                                if (res) setEvent(res);
                            })
                            .catch(() => {});
                    }}
                />
            )}

            {/* Cross-Campus Eligibility Restriction Modal */}
            <CollegeRestrictionModal
                isOpen={Boolean(restrictedEvent)}
                onClose={() => setRestrictedEvent(null)}
                eventTitle={restrictedEvent?.title || "Event"}
                eventCollegeName={restrictedEvent?.collegeName || "the host institution"}
                userCollegeName={user?.college?.officialName || (typeof user?.college === "string" ? user.college : "Your Institution")}
            />

            {/* Application Withdrawn Policy Modal */}
            {isWithdrawnModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150">
                    <div className="relative w-full max-w-lg bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl p-6 sm:p-7 space-y-5">
                        <button
                            type="button"
                            onClick={() => setIsWithdrawnModalOpen(false)}
                            className="absolute -top-3 -right-3 p-2 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 z-30"
                            title="Close"
                        >
                            <Ban className="w-4 h-4 stroke-[2.5]" />
                        </button>

                        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Ban className="w-5 h-5 text-rose-400 stroke-[2.5]" />
                                </div>
                                <div>
                                    <span className="font-black text-sm uppercase tracking-tight text-black block">Application Withdrawn</span>
                                    <span className="text-[10px] font-bold text-neutral-500 block">Registration Policy Enforcement</span>
                                </div>
                            </div>
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 border border-black shadow-[1px_1px_0px_#000]">
                                Withdrawn
                            </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wide">
                                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 stroke-[2.5]" />
                                <span>Re-Registration Restricted</span>
                            </div>
                            <p className="text-xs font-medium text-neutral-800 leading-relaxed">
                                Our system recorded that your application for{" "}
                                <strong className="text-black font-black">"{event.title}"</strong> was voluntarily withdrawn.
                            </p>
                            <p className="text-[11px] text-neutral-600 leading-relaxed font-semibold">
                                To ensure fairness and seat allocation integrity for all participants, organizers do not permit re-applying or joining new squads after an application has been withdrawn in the same event cycle.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-1.5 text-xs font-bold text-neutral-700">
                            <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                                <span>Event:</span>
                                <span className="text-black font-black">{event.title}</span>
                            </div>
                            <div className="flex justify-between items-center text-neutral-500 text-[10px] uppercase font-mono">
                                <span>Organized By:</span>
                                <span className="text-black font-black">{event.clubName}</span>
                            </div>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
                            <Link
                                to="/activity?tab=applications"
                                onClick={() => setIsWithdrawnModalOpen(false)}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                            >
                                <FileText className="w-3.5 h-3.5" />
                                <span>View In Activity</span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => setIsWithdrawnModalOpen(false)}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                            >
                                Understood
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
