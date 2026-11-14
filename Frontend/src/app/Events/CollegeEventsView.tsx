import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
    Clock,
    MapPin,
    Search,
    ExternalLink,
    Building2,
    Users,
    CheckCircle2,
    SlidersHorizontal,
    Menu,
    Globe2,
    GraduationCap,
    Share2,
    Copy,
    Check,
    MessageCircle,
    ArrowUpRight,
    Trophy,
    Flame,
    Zap,
    Bell,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import {
    fetchCollegeEvents,
    fetchPublicEventById,
    toggleEventLike,
    type CollegeEventItem,
} from "../../api/collegeEventsApi";
import { DynamicEventRegistrationModal } from "./DynamicEventRegistrationModal";
import { CollegeEventDetailModal } from "./CollegeEventDetailModal";
import { EventActionRow } from "../../components/events/EventActionRow";
import { primeEventEngagementCache } from "../../hooks/useEventEngagement";
import { CollegeRestrictionModal } from "../../components/CollegeRestrictionModal";
import { NeoSelect } from "../../components/NeoSelect";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { OrbixLoader } from "../../components/ui/loader";
import {
    InviteCampusLeadsModal,
    getInviteUrl,
    getInviteMessageTemplates,
} from "../../components/InviteCampusLeadsModal";
import { IndiaMapBackdrop, CampusPillarsBackdrop } from "../../components/ScopeBackdrops";

interface CollegeEventsViewProps {
    onOpenMobileSidebar?: () => void;
}

export const CollegeEventsView: React.FC<CollegeEventsViewProps> = ({
    onOpenMobileSidebar,
}) => {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [events, setEvents] = useState<CollegeEventItem[]>([]);
    const [collegeName, setCollegeName] = useState<string>(
        user?.college?.officialName || (typeof user?.college === "string" ? user.college : "") || "Your College"
    );
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [timeFilter, setTimeFilter] = useState<"live" | "today" | "completed" | "passes" | "all">("live");
    const [selectedClubId, setSelectedClubId] = useState<string>("all");

    // Modal state for registration & restriction
    const [selectedEventForModal, setSelectedEventForModal] = useState<CollegeEventItem | null>(null);
    const [selectedEventForDetail, setSelectedEventForDetail] = useState<CollegeEventItem | null>(null);
    const [restrictedEvent, setRestrictedEvent] = useState<CollegeEventItem | null>(null);

    // Invite leaders modal state
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteModalTab, setInviteModalTab] = useState<"wakeUpCall" | "official" | "panIndiaChallenge">("wakeUpCall");
    const [copiedWidgetLink, setCopiedWidgetLink] = useState(false);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    const eventIdParam = searchParams.get("eventId") || searchParams.get("event");

    // Automatically check QR/deep-link eventId param and open exact event details
    useEffect(() => {
        if (!eventIdParam || loading) return;

        const checkAndOpenEvent = async () => {
            let targetEvent = events.find((e) => e.id === eventIdParam || e.slug === eventIdParam);
            if (!targetEvent) {
                targetEvent = (await fetchPublicEventById(eventIdParam)) || undefined;
            }
            if (!targetEvent) return;

            const shouldRegister = searchParams.get("action") === "register" || searchParams.get("register") === "true";

            if (shouldRegister) {
                const userCollegeId = user?.collegeId || user?.college?.id;
                const userCollegeName = user?.college?.officialName || (typeof user?.college === "string" ? user.college : "");

                const isSameCollege =
                    (targetEvent.collegeId && userCollegeId && String(targetEvent.collegeId).trim().toLowerCase() === String(userCollegeId).trim().toLowerCase()) ||
                    (targetEvent.collegeName && userCollegeName && targetEvent.collegeName.trim().toLowerCase() === userCollegeName.trim().toLowerCase());

                const isEligible = targetEvent.scope === "PAN_INDIA" || isSameCollege;

                if (!isEligible) {
                    setRestrictedEvent(targetEvent);
                } else {
                    setSelectedEventForModal(targetEvent);
                }
            } else {
                setSelectedEventForDetail(targetEvent);
            }
        };

        checkAndOpenEvent();
    }, [eventIdParam, loading, events, user, searchParams]);

    const handleInitiateRegistration = (ev: CollegeEventItem) => {
        if (!user) {
            const redirectUrl = `/college-events?eventId=${ev.id}`;
            navigate(`/auth/signin?redirect=${encodeURIComponent(redirectUrl)}`);
            return;
        }

        const userCollegeId = user?.collegeId || user?.college?.id;
        const userCollegeName = user?.college?.officialName || (typeof user?.college === "string" ? user.college : "");

        const isSameCollege =
            (ev.collegeId && userCollegeId && String(ev.collegeId).trim().toLowerCase() === String(userCollegeId).trim().toLowerCase()) ||
            (ev.collegeName && userCollegeName && ev.collegeName.trim().toLowerCase() === userCollegeName.trim().toLowerCase());

        const isEligible = ev.scope === "PAN_INDIA" || isSameCollege;

        if (!isEligible) {
            setRestrictedEvent(ev);
            return;
        }

        setSelectedEventForModal(ev);
    };

    const loadEvents = async () => {
        setLoading(true);
        try {
            const data = await fetchCollegeEvents({
                collegeId: user?.collegeId || user?.college?.id || undefined,
                collegeName: user?.college?.officialName || (typeof user?.college === "string" ? user.college : undefined),
            });
            setEvents(data.events || []);
            primeEventEngagementCache(data.events || []);
            if (data.collegeName) setCollegeName(data.collegeName);
        } catch (err: any) {
            console.error("Failed to load college events:", err);
            toast.error(err.message || "Could not load campus events.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, [user?.collegeId, user?.college]);

    // Unique clubs for the filter dropdown
    const availableClubs = useMemo(() => {
        const map = new Map<string, string>();
        events.forEach((ev) => {
            if (ev.clubId && ev.clubName) {
                map.set(ev.clubId, ev.clubName);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [events]);

    // Optimistic Heart / Appreciation Toggle
    const handleToggleHeart = async (event: CollegeEventItem) => {
        if (!user) {
            const redirectUrl = `/college-events?eventId=${event.id}`;
            navigate(`/auth/signin?redirect=${encodeURIComponent(redirectUrl)}`);
            return;
        }

        const previousLiked = event.hasLiked;
        const previousCount = event.likesCount || 0;

        // 1. Optimistic update
        const updatedLiked = !previousLiked;
        const updatedCount = updatedLiked ? previousCount + 1 : Math.max(0, previousCount - 1);

        setEvents((prev) =>
            prev.map((e) =>
                e.id === event.id
                    ? { ...e, hasLiked: updatedLiked, likesCount: updatedCount }
                    : e
            )
        );

        setSelectedEventForDetail((prev) =>
            prev && prev.id === event.id
                ? { ...prev, hasLiked: updatedLiked, likesCount: updatedCount }
                : prev
        );

        if (updatedLiked) {
            toast.success("Added your appreciation!", { title: "Appreciated" });
        }

        // 2. Background API call
        try {
            const res = await toggleEventLike(event.id);
            setEvents((prev) =>
                prev.map((e) =>
                    e.id === event.id
                        ? { ...e, hasLiked: res.liked, likesCount: res.likesCount }
                        : e
                )
            );
            setSelectedEventForDetail((prev) =>
                prev && prev.id === event.id
                    ? { ...prev, hasLiked: res.liked, likesCount: res.likesCount }
                    : prev
            );
        } catch {
            // Rollback
            setEvents((prev) =>
                prev.map((e) =>
                    e.id === event.id
                        ? { ...e, hasLiked: previousLiked, likesCount: previousCount }
                        : e
                )
            );
            setSelectedEventForDetail((prev) =>
                prev && prev.id === event.id
                    ? { ...prev, hasLiked: previousLiked, likesCount: previousCount }
                    : prev
            );
            toast.error("Failed to update appreciation.");
        }
    };

    // Helper: is an event truly completed?
    const checkIsCompleted = (ev: CollegeEventItem): boolean => {
        if (ev.status === "completed" || ev.status === "cancelled") return true;
        const nowMs = new Date().getTime();

        if (ev.endsAt) {
            const endsMs = new Date(ev.endsAt).getTime();
            if (!isNaN(endsMs)) return endsMs < nowMs;
        }

        if (ev.startsAt) {
            const startsDate = new Date(ev.startsAt);
            const startsMs = startsDate.getTime();
            if (!isNaN(startsMs)) {
                if (startsMs > nowMs) return false;
                if (startsDate.toDateString() === new Date().toDateString()) return false;
                const endOfDay = new Date(startsDate);
                endOfDay.setHours(23, 59, 59, 999);
                return endOfDay.getTime() < nowMs;
            }
        }
        return false;
    };

    // Helper: is an event currently live / ongoing right now?
    const checkIsLiveNow = (ev: CollegeEventItem): boolean => {
        if (checkIsCompleted(ev)) return false;
        const nowMs = new Date().getTime();
        const startsMs = new Date(ev.startsAt).getTime();
        if (isNaN(startsMs)) return false;
        return startsMs <= nowMs;
    };

    // Helper: is an event occurring today?
    const checkIsToday = (ev: CollegeEventItem): boolean => {
        if (!ev.startsAt) return false;
        const startsDate = new Date(ev.startsAt);
        return startsDate.toDateString() === new Date().toDateString();
    };

    // Subsets
    const activeEvents = useMemo(() => {
        return events.filter((e) => !checkIsCompleted(e));
    }, [events]);

    const completedEvents = useMemo(() => {
        return events.filter((e) => checkIsCompleted(e));
    }, [events]);

    const todayEvents = useMemo(() => {
        return events.filter((e) => checkIsToday(e) && !checkIsCompleted(e));
    }, [events]);

    const myRegisteredEvents = useMemo(() => {
        return events.filter((e) => e.isRegistered);
    }, [events]);

    const myRegisteredEventsCount = myRegisteredEvents.length;

    // Base scope separation (before filters)
    const allPanIndiaEvents = useMemo(() => events.filter((e) => e.scope === "PAN_INDIA"), [events]);
    const allCampusEvents = useMemo(() => events.filter((e) => e.scope !== "PAN_INDIA"), [events]);

    const hasAnyPanIndia = allPanIndiaEvents.length > 0;
    const hasAnyCampus = allCampusEvents.length > 0;

    // Filtered events
    const filteredEvents = useMemo(() => {
        let list: CollegeEventItem[] = [];

        if (timeFilter === "completed") {
            list = completedEvents;
        } else if (timeFilter === "today") {
            list = todayEvents;
        } else if (timeFilter === "passes") {
            list = myRegisteredEvents;
        } else {
            list = activeEvents.length > 0 ? activeEvents : completedEvents;
        }

        if (selectedClubId !== "all") {
            list = list.filter((e) => e.clubId === selectedClubId);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (e) =>
                    e.title.toLowerCase().includes(q) ||
                    (e.summary && e.summary.toLowerCase().includes(q)) ||
                    (e.venueOrLocation && e.venueOrLocation.toLowerCase().includes(q)) ||
                    e.clubName.toLowerCase().includes(q)
            );
        }

        return list;
    }, [events, timeFilter, activeEvents, completedEvents, todayEvents, myRegisteredEvents, selectedClubId, searchQuery]);

    const filteredPanIndiaEvents = useMemo(() => {
        return filteredEvents.filter((e) => e.scope === "PAN_INDIA");
    }, [filteredEvents]);

    const filteredCampusEvents = useMemo(() => {
        return filteredEvents.filter((e) => e.scope !== "PAN_INDIA");
    }, [filteredEvents]);

    // Smart Adaptive Order Decision:
    // When NO Pan India events exist, campus events swap to the upper primary stage!
    const shouldElevateCampus = !hasAnyPanIndia && hasAnyCampus;

    // Invite Helpers
    const inviteUrl = getInviteUrl(collegeName, user?.collegeId || user?.college?.id);
    const templates = getInviteMessageTemplates(collegeName, inviteUrl);

    const handleCopyWidgetLink = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopiedWidgetLink(true);
            toast.success("College club invite link copied!", { title: "Link Copied" });
            setTimeout(() => setCopiedWidgetLink(false), 2200);
        } catch {
            toast.error("Failed to copy link.");
        }
    };

    const handleOpenInviteModal = (tab: "wakeUpCall" | "official" | "panIndiaChallenge" = "wakeUpCall") => {
        setInviteModalTab(tab);
        setIsInviteModalOpen(true);
    };

    // Shared Neo-Brutalist Event Card Renderer
    const renderEventCard = (ev: CollegeEventItem, isPanIndia: boolean) => {
        const isCompleted = checkIsCompleted(ev);
        const isLiveNow = checkIsLiveNow(ev);
        const isToday = checkIsToday(ev);
        const isRegistered = ev.registrationStatus === "registered" || ev.registrationStatus === "attended" || (ev.isRegistered && ev.registrationStatus !== "pending");
        const isPending = ev.registrationStatus === "pending" || ev.isPending;

        return (
            <div
                key={ev.id}
                onClick={() => setSelectedEventForDetail(ev)}
                className={`relative overflow-hidden p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group ${
                    isPanIndia ? "hover:border-[#FF9933]" : "hover:border-black"
                }`}
            >
                {/* Scope Architectural SVG Backdrop (India Map for Pan-India, Architectural Pillars for Campus) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
                    {isPanIndia ? (
                        <div className="absolute -right-6 -bottom-6 w-48 sm:w-56 h-48 sm:h-56 opacity-[0.05] group-hover:opacity-[0.13] transition-opacity duration-300 text-neutral-950">
                            <IndiaMapBackdrop className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="absolute -right-4 -bottom-6 w-40 sm:w-48 h-40 sm:h-48 opacity-[0.06] group-hover:opacity-[0.14] transition-opacity duration-300 text-neutral-900">
                            <CampusPillarsBackdrop className="w-full h-full object-contain" />
                        </div>
                    )}
                </div>

                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                    {/* Cover Banner (100% full view, never cropped) */}
                    <div className="relative w-full aspect-[2.4/1] rounded-xl border-2 border-black overflow-hidden mb-3.5 bg-neutral-950 shadow-[2px_2px_0px_#000] flex items-center justify-center">
                        {ev.coverImageUrl ? (
                            <img
                                src={ev.coverImageUrl}
                                alt={ev.title}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#FAF6EE] flex items-center justify-center font-black text-neutral-400 text-sm">
                                {ev.clubName}
                            </div>
                        )}

                        {/* Compact Action Row Overlay (Like & Share) */}
                        <div className="absolute top-2.5 right-2.5 px-3 py-1 rounded-full border-2 border-black bg-white/95 shadow-[2px_2px_0px_#000] flex items-center backdrop-blur-sm">
                            <EventActionRow
                                eventId={ev.id}
                                eventTitle={ev.title}
                                eventSummary={ev.summary || undefined}
                                initialLikeCount={ev.likesCount}
                                initialLiked={ev.hasLiked}
                                initialShareCount={(ev as any).sharesCount}
                                size="sm"
                            />
                        </div>

                        {/* Timeline Status Badge & Scope Indicator */}
                        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 ${
                                    isCompleted
                                        ? "bg-neutral-200 text-neutral-800"
                                        : isLiveNow
                                        ? "bg-emerald-300 text-black animate-pulse"
                                        : isToday
                                        ? "bg-amber-300 text-black"
                                        : "bg-[#a2ff86] text-black"
                                }`}
                            >
                                {isCompleted ? (
                                    "Completed"
                                ) : isLiveNow ? (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-ping inline-block" />
                                        Live Now
                                    </>
                                ) : isToday ? (
                                    "Live Today"
                                ) : (
                                    "Upcoming"
                                )}
                            </span>

                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1 ${
                                    isPanIndia
                                        ? "bg-[#FF9933] text-black"
                                        : "bg-sky-200 text-sky-950"
                                }`}
                            >
                                {isPanIndia ? (
                                    <>
                                        <Globe2 className="w-2.5 h-2.5" />
                                        Pan India
                                    </>
                                ) : (
                                    <>
                                        <GraduationCap className="w-2.5 h-2.5" />
                                        Campus
                                    </>
                                )}
                            </span>

                            {ev.isTeamEvent && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border-2 border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                    <Users className="w-2.5 h-2.5" />
                                    Team ({ev.minTeamSize || 1}-{ev.maxTeamSize || 4})
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Club Info Ribbon */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <Link
                            to={`/clubs/${ev.clubSlug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 group min-w-0"
                        >
                            {ev.clubLogoUrl ? (
                                <img
                                    src={ev.clubLogoUrl}
                                    alt={ev.clubName}
                                    className="w-5 h-5 rounded-md border border-black object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-5 h-5 rounded-md border border-black bg-[#a2ff86] flex items-center justify-center font-black text-[9px] shrink-0">
                                    {ev.clubName.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <span className="text-xs font-black text-black group-hover:underline truncate">
                                {ev.clubName}
                            </span>
                        </Link>

                        <span className="text-[11px] font-bold text-neutral-500 shrink-0">
                            {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                            })}
                        </span>
                    </div>

                    {/* Title & Summary */}
                    <h3 className="text-base font-black text-neutral-900 line-clamp-1 group-hover:text-black">
                        {ev.title}
                    </h3>
                    <p className="text-xs text-neutral-600 line-clamp-2 mt-1 leading-relaxed">
                        {ev.summary || ev.description || (isPanIndia ? "Compete against students across India." : "Join this chapter meetup on campus.")}
                    </p>

                    {/* Timing and Location */}
                    <div className="mt-3.5 space-y-1.5 text-xs text-neutral-600 font-medium">
                        <div className="flex items-center gap-1.5 font-bold">
                            <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span>
                                {new Date(ev.startsAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                                {ev.endsAt && (
                                    <span>
                                        {" "}
                                        –{" "}
                                        {new Date(ev.endsAt).toLocaleTimeString(undefined, {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                )}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-bold truncate">
                            <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <span className="truncate">
                                {ev.venueOrLocation ||
                                    (ev.locationType === "virtual"
                                        ? "Virtual National Arena"
                                        : ev.locationType === "hybrid"
                                        ? "Hybrid Session"
                                        : "Campus Hall")}
                            </span>
                        </div>
                    </div>

                    {/* Pan-India Tracking Status Banner */}
                    {isPanIndia && (
                        <div className="mt-3 p-2 rounded-xl bg-[#FAF6EE] border border-black/30 flex items-center justify-between text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-neutral-700 truncate">
                                <Bell className="w-3 h-3 text-[#FF9933] shrink-0" />
                                <span className="truncate">
                                    {isRegistered
                                        ? "Live Tracking Active • Pass Synced"
                                        : "Registration required for start & deadline tracking"}
                                </span>
                            </span>
                            {isRegistered && (
                                <span className="text-emerald-700 font-black shrink-0 inline-flex items-center gap-1">
                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                    <span>Synced</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Action Bar */}
                <div className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-600">
                        <Users className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{ev.registrationsCount || 0} registered</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {isRegistered ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEventForModal(ev);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                <span>View Pass</span>
                            </button>
                        ) : isPending ? (
                            <span
                                className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-950 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 select-none"
                                title="Application submitted to coordinators for review"
                            >
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Under Review</span>
                            </span>
                        ) : ev.registrationStatus === "rejected" ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateRegistration(ev);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-950 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 cursor-pointer transition-transform active:scale-95"
                                title="Application was not selected. Click to re-apply."
                            >
                                <span>Re-Apply</span>
                            </button>
                        ) : isCompleted ? (
                            <span className="px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-500 border border-black/30 text-xs font-bold select-none">
                                Completed
                            </span>
                        ) : isPanIndia ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateRegistration(ev);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#FF9933] hover:bg-[#ff881a] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1"
                            >
                                <span>Register & Track</span>
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleInitiateRegistration(ev);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                Apply
                            </button>
                        )}

                        {ev.registrationUrl && (
                            <a
                                href={ev.registrationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                title="External RSVP / Portal Link"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </div>
                </div>
                </div>
            </div>
        );
    };

    // SECTION 1 COMPONENT: Pan-India National Arenas
    const renderPanIndiaSection = () => {
        return (
            <div className="space-y-4">
                {/* Section Header */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#FF9933] text-black border border-black text-[11px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] inline-flex items-center gap-1">
                                <Globe2 className="w-3 h-3 stroke-[2.5]" />
                                Pan-India National Arenas
                            </span>
                            <span className="text-xs font-bold text-neutral-500">
                                Open to verified college students throughout India
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Inter-College Hackathons & Competitions
                        </h2>
                    </div>

                    <div className="text-xs font-black text-neutral-700 bg-[#FAF6EE] px-3 py-1.5 rounded-xl border border-black shrink-0 self-start sm:self-auto">
                        Showing {filteredPanIndiaEvents.length} national arena{filteredPanIndiaEvents.length === 1 ? "" : "s"}
                    </div>
                </div>

                {/* Privacy & Notification Shield Banner */}
                <div className="p-3.5 rounded-xl bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5 text-xs text-amber-950">
                    <Zap className="w-4 h-4 text-[#FF9933] shrink-0 mt-0.5 stroke-[2.5]" />
                    <div className="space-y-0.5">
                        <span className="font-black text-black block">Pan-India Smart Notification Shield</span>
                        <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                            To eliminate nationwide spam, <strong>start countdowns, schedule tracking, and cancellation alerts</strong> are only delivered once you register for an arena. Tap <strong>"Register & Track"</strong> on any event to sync your pass into Event Tracker.
                        </p>
                    </div>
                </div>

                {/* Cards Grid */}
                {filteredPanIndiaEvents.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center space-y-2">
                        <Globe2 className="w-8 h-8 text-neutral-400 mx-auto" />
                        <h4 className="text-sm font-black text-black">No Pan-India Events Match Current Filters</h4>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                            {searchQuery ? "Try refining your search keywords or clear your query." : "No active national arenas match this timeline view."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredPanIndiaEvents.map((ev) => renderEventCard(ev, true))}
                    </div>
                )}
            </div>
        );
    };

    // SECTION 2 COMPONENT: Campus Events
    const renderCampusSection = () => {
        return (
            <div className="space-y-4">
                {/* Section Header */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-sky-200 text-sky-950 border border-black text-[11px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000] inline-flex items-center gap-1">
                                <GraduationCap className="w-3 h-3 stroke-[2.5]" />
                                Campus Exclusive
                            </span>
                            <span className="text-xs font-bold text-neutral-500">
                                Restricted to students of {collegeName}
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Campus Club Sessions & Workshops
                        </h2>
                    </div>

                    <div className="text-xs font-black text-neutral-700 bg-[#FAF6EE] px-3 py-1.5 rounded-xl border border-black shrink-0 self-start sm:self-auto">
                        Showing {filteredCampusEvents.length} campus session{filteredCampusEvents.length === 1 ? "" : "s"}
                    </div>
                </div>

                {/* Cards Grid */}
                {filteredCampusEvents.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] text-center space-y-2">
                        <GraduationCap className="w-8 h-8 text-neutral-400 mx-auto" />
                        <h4 className="text-sm font-black text-black">No Campus Sessions Match Current Filters</h4>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                            {searchQuery ? "Try searching with different keywords." : "No club sessions scheduled for this timeline filter."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredCampusEvents.map((ev) => renderEventCard(ev, false))}
                    </div>
                )}
            </div>
        );
    };

    // SMART SWAP WIDGET A: Pan-India National Spotlight & Host Callout (Shown when NO Pan-India events exist)
    const renderPanIndiaSpotlightWidget = () => {
        return (
            <div className="p-6 rounded-2xl bg-white border-3 border-black shadow-[5px_5px_0px_#000] relative overflow-hidden space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FF9933] text-black border border-black text-xs font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_#000]">
                            <Trophy className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>National Spotlight • Pan-India Arenas Opening Soon</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Put {collegeName} on the National Tech Map!
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            Want our campus to host India's next premier hackathon, AI sprint, or design conference? You don't have to wait for faculty. Invite your club coordinators to publish a nationwide challenge on Orbix and bring thousands of student developers to our institution.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleOpenInviteModal("panIndiaChallenge")}
                            className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Invite Clubs to Host</span>
                        </button>

                        <Link
                            to={`/auth/signup?tab=club&ref=panindia-spotlight&college=${encodeURIComponent(collegeName)}`}
                            className="px-4 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <span>Host as Club Chapter</span>
                            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </Link>
                    </div>
                </div>
            </div>
        );
    };

    // SMART SWAP WIDGET B: Campus Wake-Up Call & Viral Lead Invite Hub (Shown when NO Campus events exist)
    const renderCampusWakeUpCallWidget = () => {
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(templates.wakeUpCall)}`;

        return (
            <div className="p-6 sm:p-7 rounded-2xl bg-[#FFF5F5] border-3 border-black shadow-[6px_6px_0px_#000] space-y-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-950 border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                            <Flame className="w-4 h-4 text-rose-600 stroke-[2.5] fill-rose-600" />
                            <span>Campus Wake-Up Call • Zero Active Sessions</span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                            Don't Let {collegeName} Stay Inactive on Orbix!
                        </h3>

                        <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed">
                            While student squads at IITs, NITs, and top tech universities are publishing weekly hackathons, attending verified workshops, and earning national leaderboard badges, our campus has <strong>0 active sessions</strong>.
                        </p>
                        <p className="text-xs sm:text-sm text-neutral-800 font-bold leading-relaxed">
                            Call out your club presidents, student council leads, and technical societies to start publishing their sessions on Orbix today!
                        </p>
                    </div>

                    {/* Viral Share Actions */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2.5 shrink-0 min-w-[220px]">
                        {/* 1-Click WhatsApp Blast */}
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:brightness-105 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                            <span>WhatsApp Blast Groups</span>
                        </a>

                        {/* Copy Verified Invite Link */}
                        <button
                            type="button"
                            onClick={handleCopyWidgetLink}
                            className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            {copiedWidgetLink ? (
                                <>
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Invite Link Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 stroke-[2.5]" />
                                    <span>Copy Invite Link</span>
                                </>
                            )}
                        </button>

                        {/* Open Full Toolkit Modal */}
                        <button
                            type="button"
                            onClick={() => handleOpenInviteModal("wakeUpCall")}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Open Full Invite Toolkit</span>
                        </button>
                    </div>
                </div>

                {/* Pre-written message snippet */}
                <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                        Copy-Paste for Class & Society WhatsApp Chats:
                    </span>
                    <pre className="text-xs text-neutral-800 font-sans whitespace-pre-wrap leading-relaxed select-all">
                        {templates.wakeUpCall}
                    </pre>
                </div>
            </div>
        );
    };

    return (
        <section
            aria-label="College Events Hub"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                {/* Header Banner */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        {onOpenMobileSidebar && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="p-1.5 rounded-lg border-2 border-black lg:hidden bg-[#FAF6EE] hover:bg-neutral-100"
                                >
                                    <Menu className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-black tracking-tight">
                            College & National Events Hub
                        </h1>
                        <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-neutral-600">
                            <span className="inline-flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-neutral-500 shrink-0" />
                                <span>Campus: <strong className="font-black text-black">{collegeName}</strong></span>
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF9933]/20 border border-[#FF9933] text-black text-[11px] font-black">
                                <Globe2 className="w-3 h-3 text-[#FF9933]" />
                                {allPanIndiaEvents.length} Pan India Arenas
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 border border-sky-400 text-sky-950 text-[11px] font-black">
                                <GraduationCap className="w-3 h-3 text-sky-700" />
                                {allCampusEvents.length} Campus Sessions
                            </span>
                        </div>
                    </div>

                    {/* Viral Header CTA */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleOpenInviteModal("wakeUpCall")}
                            className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                            title="Invite club presidents and societies to publish on Orbix"
                        >
                            <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Invite Club Leads</span>
                        </button>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by title, topics, hackathons, clubs, or location..."
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-hidden focus:bg-white"
                            />
                        </div>

                        {/* Club Dropdown Filter */}
                        {availableClubs.length > 0 && (
                            <div className="shrink-0 flex items-center gap-2 min-w-[200px]">
                                <SlidersHorizontal className="w-4 h-4 text-neutral-500 shrink-0" />
                                <div className="flex-1">
                                    <NeoSelect
                                        value={selectedClubId}
                                        onChange={(val) => setSelectedClubId(val)}
                                        size="sm"
                                        triggerClassName="!bg-[#FAF6EE] !rounded-xl !py-2 text-xs !shadow-none"
                                    >
                                        <option value="all">All Campus Clubs</option>
                                        {availableClubs.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </NeoSelect>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timeline Filter Pills */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/10">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setTimeFilter("live")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    timeFilter === "live" || timeFilter === "all"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                Live & Upcoming ({activeEvents.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeFilter("today")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    timeFilter === "today"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                Today ({todayEvents.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeFilter("completed")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    timeFilter === "completed"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                Completed ({completedEvents.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimeFilter("passes")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black cursor-pointer transition-all ${
                                    timeFilter === "passes"
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                My Passes ({myRegisteredEventsCount})
                            </button>
                        </div>

                        <span className="text-xs font-bold text-neutral-500">
                            Showing {filteredEvents.length} total event{filteredEvents.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center gap-3">
                        <OrbixLoader size="lg" />
                        <span className="text-xs font-black text-black">Loading college & national events...</span>
                    </div>
                ) : events.length === 0 ? (
                    /* Zero State when neither Pan-India nor Campus events exist at all */
                    <div className="space-y-6">
                        <div className="p-12 rounded-2xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                            <Trophy className="w-12 h-12 text-[#FF9933] mx-auto stroke-[2.2]" />
                            <h3 className="font-black text-xl text-black">
                                Events Ecosystem Getting Started at {collegeName}
                            </h3>
                            <p className="text-xs sm:text-sm font-medium text-neutral-600 max-w-lg mx-auto">
                                No published events found on your campus or nationally right now. Be the catalyst: invite your student club leaders or register your campus society to host an event!
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => handleOpenInviteModal("wakeUpCall")}
                                    className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                                >
                                    <Share2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Invite Campus Leaders</span>
                                </button>
                                <Link
                                    to={`/auth/signup?tab=club&ref=zero-state&college=${encodeURIComponent(collegeName)}`}
                                    className="px-4 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                                >
                                    <span>Register a Club Chapter</span>
                                    <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                                </Link>
                            </div>
                        </div>

                        {renderCampusWakeUpCallWidget()}
                    </div>
                ) : (
                    /* Smart Adaptive Order:
                     * If Pan-India is unavailable: Campus events elevate to top, followed by Pan-India Spotlight.
                     * If Pan-India is available: Pan-India takes top, followed by Campus events (or Campus Wake-up widget).
                     */
                    <div className="space-y-8">
                        {shouldElevateCampus ? (
                            <>
                                {/* 1. Campus Sessions (Elevated to Upper Position) */}
                                {renderCampusSection()}

                                {/* 2. Pan-India National Spotlight (Secondary Position) */}
                                {renderPanIndiaSpotlightWidget()}
                            </>
                        ) : (
                            <>
                                {/* 1. Pan-India Flagship Arenas (Upper Position) */}
                                {renderPanIndiaSection()}

                                {/* 2. Campus Events OR Viral Campus Wake-Up Call (Lower Position) */}
                                {hasAnyCampus ? renderCampusSection() : renderCampusWakeUpCallWidget()}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Full Event Details Preview Modal */}
            <CollegeEventDetailModal
                isOpen={Boolean(selectedEventForDetail)}
                onClose={() => {
                    setSelectedEventForDetail(null);
                    if (searchParams.has("eventId") || searchParams.has("event")) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete("eventId");
                        newParams.delete("event");
                        const searchStr = newParams.toString();
                        navigate(
                            { pathname: location.pathname, search: searchStr ? `?${searchStr}` : "" },
                            { replace: true }
                        );
                    }
                }}
                event={selectedEventForDetail}
                onApply={(ev) => handleInitiateRegistration(ev)}
                onToggleHeart={(ev) => handleToggleHeart(ev)}
            />

            {/* Dynamic Registration Modal */}
            <DynamicEventRegistrationModal
                isOpen={Boolean(selectedEventForModal)}
                onClose={() => {
                    setSelectedEventForModal(null);
                    if (searchParams.has("action") || searchParams.has("register")) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.delete("action");
                        newParams.delete("register");
                        const searchStr = newParams.toString();
                        navigate(
                            { pathname: location.pathname, search: searchStr ? `?${searchStr}` : "" },
                            { replace: true }
                        );
                    }
                }}
                event={selectedEventForModal}
                onSuccess={(updated) => {
                    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                }}
            />

            {/* College Restriction Modal */}
            <CollegeRestrictionModal
                isOpen={Boolean(restrictedEvent)}
                onClose={() => setRestrictedEvent(null)}
                eventTitle={restrictedEvent?.title || "Campus Event"}
                eventCollegeName={restrictedEvent?.collegeName || "Host Campus"}
                userCollegeName={user?.college?.officialName || (typeof user?.college === "string" ? user.college : "") || "Not Linked"}
                hostClubName={restrictedEvent?.clubName}
            />

            {/* Viral Invite Campus Leads Modal */}
            <InviteCampusLeadsModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                collegeName={collegeName}
                collegeId={user?.collegeId || user?.college?.id}
                initialTab={inviteModalTab}
            />

            {/* Neo-brutalist Section Bottom Illustration */}
            <SectionBottomIllustration alt="Orbix college events illustration" />
        </section>
    );
};

export default CollegeEventsView;
