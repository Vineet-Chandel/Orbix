import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
    Calendar,
    Clock,
    MapPin,
    Heart,
    Search,
    ExternalLink,
    Building2,
    Users,
    CheckCircle2,
    Sparkles,
    SlidersHorizontal,
    Menu,
    Globe2,
    GraduationCap,
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
import { CollegeRestrictionModal } from "../../components/CollegeRestrictionModal";
import { NeoSelect } from "../../components/NeoSelect";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { OrbixLoader } from "../../components/ui/loader";

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

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();

    // Modal state for registration & restriction
    const [selectedEventForModal, setSelectedEventForModal] = useState<CollegeEventItem | null>(null);
    const [selectedEventForDetail, setSelectedEventForDetail] = useState<CollegeEventItem | null>(null);
    const [restrictedEvent, setRestrictedEvent] = useState<CollegeEventItem | null>(null);

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

                if (!isSameCollege) {
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

        if (!isSameCollege) {
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
            toast.success("Added your appreciation! ❤️", { title: "Appreciated" });
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

        // If endsAt is defined, event is only completed after endsAt passes
        if (ev.endsAt) {
            const endsMs = new Date(ev.endsAt).getTime();
            if (!isNaN(endsMs)) return endsMs < nowMs;
        }

        // If no endsAt, check startsAt
        if (ev.startsAt) {
            const startsDate = new Date(ev.startsAt);
            const startsMs = startsDate.getTime();
            if (!isNaN(startsMs)) {
                // Future event is not completed
                if (startsMs > nowMs) return false;
                // Today's event is still active today
                if (startsDate.toDateString() === new Date().toDateString()) return false;
                // Older day event with no endsAt is considered completed once that day ended
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

    // Automatic fallback: if in default "live" or "all" view and NO live events exist, completed events automatically show up
    const isAutoCompletedFallback =
        (timeFilter === "live" || timeFilter === "all") && activeEvents.length === 0 && completedEvents.length > 0;

    const filteredEvents = useMemo(() => {
        let list: CollegeEventItem[] = [];

        if (timeFilter === "completed") {
            // User explicitly tapped the Completed tag/filter
            list = completedEvents;
        } else if (timeFilter === "today") {
            list = todayEvents;
        } else if (timeFilter === "passes") {
            list = myRegisteredEvents;
        } else {
            // Default "live" or "all":
            // Show active events if any exist; if NO live event exists on campus, automatically show completed events!
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

    return (
        <section
            aria-label="College Events Hub"
            className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                {/* Header Banner */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                            Campus Events & Workshops
                        </h1>
                        <p className="text-xs sm:text-sm font-medium text-neutral-600 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-neutral-500 shrink-0" />
                            <span>Showing verified club sessions at <strong className="font-black text-black">{collegeName}</strong></span>
                        </p>
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
                                placeholder="Search by event title, tech stack, topic, venue, or club..."
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
                            Showing {filteredEvents.length} session{filteredEvents.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {/* Automatic Fallback Notice if no live events are present */}
                {isAutoCompletedFallback && (
                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-bold text-amber-950">
                        <div className="flex items-center gap-2.5">
                            <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>No live or upcoming events active on campus right now. Automatically showing completed campus sessions.</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTimeFilter("completed")}
                            className="px-3 py-1 rounded-xl bg-white border-2 border-black text-xs font-black uppercase tracking-wider text-black hover:bg-neutral-100 shadow-[1px_1px_0px_#000] shrink-0"
                        >
                            Completed Tab
                        </button>
                    </div>
                )}

                {/* Event Cards Grid */}
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center gap-3">
                        <OrbixLoader size="lg" />
                        <span className="text-xs font-black text-black">Loading campus events...</span>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div className="p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                        <Calendar className="w-10 h-10 text-neutral-400 mx-auto" />
                        <h3 className="font-black text-base text-neutral-900">
                            {timeFilter === "live"
                                ? "No active campus events"
                                : timeFilter === "today"
                                ? "No sessions scheduled today"
                                : timeFilter === "completed"
                                ? "No completed events found"
                                : timeFilter === "passes"
                                ? "You have not registered for any events yet"
                                : "No events found"}
                        </h3>
                        <p className="text-xs font-medium text-neutral-500 max-w-sm mx-auto">
                            {searchQuery
                                ? "No campus sessions match your search keywords."
                                : "Verified clubs have not published events in this category yet. Check back soon!"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredEvents.map((ev) => {
                            const isCompleted = checkIsCompleted(ev);
                            const isLiveNow = checkIsLiveNow(ev);
                            const isToday = checkIsToday(ev);

                            return (
                                <div
                                    key={ev.id}
                                    onClick={() => setSelectedEventForDetail(ev)}
                                    className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
                                >
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

                                            {/* Heart Button Overlay */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleHeart(ev);
                                                }}
                                                className={`absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1.5 text-xs font-black cursor-pointer transition-transform active:scale-95 ${
                                                    ev.hasLiked
                                                        ? "bg-rose-100 text-rose-700"
                                                        : "bg-white/95 text-neutral-800 hover:bg-white"
                                                }`}
                                                title={ev.hasLiked ? "Remove heart" : "Appreciate event"}
                                            >
                                                <Heart
                                                    className={`w-3.5 h-3.5 ${
                                                        ev.hasLiked ? "fill-rose-600 text-rose-600" : "text-black"
                                                    }`}
                                                />
                                                <span>{ev.likesCount || 0}</span>
                                            </button>

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
                                                        ev.scope === "PAN_INDIA"
                                                            ? "bg-[#FF9933] text-black"
                                                            : "bg-sky-200 text-sky-950"
                                                    }`}
                                                >
                                                    {ev.scope === "PAN_INDIA" ? (
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
                                            {ev.summary || ev.description || "Join this chapter meetup on campus."}
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
                                                            ? "Virtual Session"
                                                            : ev.locationType === "hybrid"
                                                            ? "Hybrid Session"
                                                            : "Campus Hall")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Action Bar */}
                                    <div className="mt-5 pt-3.5 border-t-2 border-black/10 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-600">
                                            <Users className="w-3.5 h-3.5 text-neutral-500" />
                                            <span>{ev.registrationsCount || 0} registered</span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {ev.registrationStatus === "registered" || ev.registrationStatus === "attended" || (ev.isRegistered && ev.registrationStatus !== "pending") ? (
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
                                            ) : ev.registrationStatus === "pending" || ev.isPending ? (
                                                <span
                                                    className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-950 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 select-none"
                                                    title="Application submitted to club coordinators for review"
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
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Full Event Details Preview Modal (Right: Description/Agenda, Left: Details) */}
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

            {/* Neo-brutalist Section Bottom Illustration */}
            <SectionBottomIllustration alt="Orbix college events illustration" />
        </section>
    );
};

export default CollegeEventsView;
