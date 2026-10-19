import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Calendar as CalendarIcon,
    List as ListIcon,
    Bell,
    Check,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    CalendarPlus,
    Clock,
    Trophy,
    TrendingUp,
    Sparkles,
    X,
} from "lucide-react";
import {
    useAppDispatch,
    useAppSelector,
    fetchEvents,
    setSelectedMonth,
    setSelectedType,
    setSelectedPlatform,
    setViewMode,
    toggleReminder,
    toggleLocalReminder,
    type EventItem,
} from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import { Sidebar } from "../Dashboard/Sidebar";

export const ALL_16_PLATFORMS = [
    { id: "leetcode", name: "LeetCode", color: "#FFA116" },
    { id: "codeforces", name: "Codeforces", color: "#1F8ACB" },
    { id: "codechef", name: "CodeChef", color: "#5B4638" },
    { id: "atcoder", name: "AtCoder", color: "#4B5563" },
    { id: "geeksforgeeks", name: "GeeksforGeeks", color: "#2F8D46" },
    { id: "hackerrank", name: "HackerRank", color: "#00EA64" },
    { id: "hackerearth", name: "HackerEarth", color: "#2C3454" },
    { id: "topcoder", name: "TopCoder", color: "#29A7DF" },
    { id: "code360", name: "Code360", color: "#FF5722" },
    { id: "interviewbit", name: "InterviewBit", color: "#0D8BD9" },
    { id: "cses", name: "CSES", color: "#214478" },
    { id: "spoj", name: "SPOJ", color: "#1B6AC9" },
    { id: "algorithmxlr8", name: "AlgorithmXlr8", color: "#0284C7" },
];

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Helper: Format start to IST time string "HH:MM"
const formatTimeIST = (dateString: string): string => {
    try {
        const d = new Date(dateString);
        return d.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    } catch {
        return "00:00";
    }
};

// Helper: Format full IST schedule string "Mon, Oct 19 · 19:00–22:00 IST · 3h"
const formatScheduleIST = (event: EventItem): string => {
    try {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);

        const dayName = start.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" });
        const monthShort = start.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" });
        const dayNum = start.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" });

        const startTimeStr = start.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        const endTimeStr = end.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        return `${dayName}, ${monthShort} ${dayNum} · ${startTimeStr}–${endTimeStr} IST · ${event.durationFormatted}`;
    } catch {
        return `${event.startTime} · ${event.durationFormatted}`;
    }
};

// Helper: Format start and end times in IST "19:00–22:00 IST · 3h"
const formatTimeRangeIST = (event: EventItem): string => {
    try {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);

        const startTimeStr = start.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        const endTimeStr = end.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });

        return `${startTimeStr}–${endTimeStr} IST · ${event.durationFormatted}`;
    } catch {
        return event.durationFormatted;
    }
};

// Curly Bracket SVG component to group multi-contest dates
const CurlyBracket = ({ isToday, isLive }: { isToday?: boolean; isLive?: boolean }) => {
    return (
        <div className="relative w-5 sm:w-6 md:w-7 flex-shrink-0 self-stretch flex items-stretch select-none pointer-events-none py-2">
            <svg
                className={`w-full h-full transition-colors ${
                    isLive
                        ? "text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                        : isToday
                        ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                        : "text-neutral-700"
                }`}
                viewBox="0 0 20 100"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M 18,2 C 10,2 8,8 8,16 L 8,43 C 8,48 4,49 2,50 C 4,51 8,52 8,57 L 8,84 C 8,92 10,98 18,98"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
        </div>
    );
};


// Helper: Human friendly relative countdown (e.g. "in 10h 20m", "in 2d 11h")
const formatRelativeCountdown = (startTimestamp: number, nowMs: number): string => {
    const diffMs = startTimestamp - nowMs;
    if (diffMs <= 0) return "Live Now";

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
        return `in ${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
};

// Generate Google Calendar Link
const createGoogleCalendarUrl = (event: EventItem): string => {
    const startIso = new Date(event.startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endIso = new Date(event.endTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`Contest on ${event.platformName}: ${event.url}`);
    const location = encodeURIComponent(event.url);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
};

// Generate .ics file download
const downloadIcsFile = (event: EventItem) => {
    const startIso = new Date(event.startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endIso = new Date(event.endTime).toISOString().replace(/-|:|\.\d\d\d/g, "");

    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Orbix//Event Tracker//EN",
        "BEGIN:VEVENT",
        `UID:${event.id}@orbix.dev`,
        `DTSTAMP:${startIso}`,
        `DTSTART:${startIso}`,
        `DTEND:${endIso}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:Participate in ${event.title} on ${event.platformName} - ${event.url}`,
        `URL:${event.url}`,
        "STATUS:CONFIRMED",
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const EventTrackerPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const {
        allEvents,
        upNext,
        countsByMonthAndPlatform,
        countsByPlatform,
        stats,
        allowedMonths,
        currentMonthStr,
        selectedMonth,
        selectedType,
        selectedPlatform,
        viewMode,
        reminders,
    } = useAppSelector((state) => state.events);

    const contestsState = useAppSelector((state) => state.contests);
    const currentUser = useAppSelector((state) => state.user.user);

    // Live ticking clock for hero timer (updates every second)
    const [nowMs, setNowMs] = useState<number>(Date.now());
    useEffect(() => {
        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Initial background fetch & revalidation
    useEffect(() => {
        dispatch(fetchEvents({ refresh: true }));
    }, [dispatch]);

    // Close calendar dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = () => {
            setOpenCalDropdownId(null);
        };
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    // Helper: format day date string into human friendly format
    const formatDayTitle = (dateStr: string) => {
        try {
            const [y, m, d] = dateStr.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            return dt.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    // Active month breakdown [Year, Month (1-indexed)]
    const [viewYear, viewMonthIndex] = useMemo(() => {
        if (!selectedMonth) {
            const d = new Date();
            return [d.getFullYear(), d.getMonth()];
        }
        const [yStr, mStr] = selectedMonth.split("-");
        return [parseInt(yStr, 10), parseInt(mStr, 10) - 1];
    }, [selectedMonth]);

    const monthLabel = MONTH_NAMES[viewMonthIndex];

    const currentAllowedIdx = allowedMonths.indexOf(selectedMonth);
    const canGoPrev = currentAllowedIdx > 0;
    const canGoNext = currentAllowedIdx !== -1 && currentAllowedIdx < allowedMonths.length - 1;

    const handlePrevMonth = () => {
        if (canGoPrev) {
            dispatch(setSelectedMonth(allowedMonths[currentAllowedIdx - 1]));
        }
    };

    const handleNextMonth = () => {
        if (canGoNext) {
            dispatch(setSelectedMonth(allowedMonths[currentAllowedIdx + 1]));
        }
    };

    const handleResetToday = () => {
        if (allowedMonths.includes(currentMonthStr)) {
            dispatch(setSelectedMonth(currentMonthStr));
        }
    };

    // Filter events by selectedType (contests vs hackathons) and selectedPlatform
    const filteredEvents = useMemo(() => {
        const targetType = selectedType === "contests" ? "contest" : "hackathon";
        return allEvents.filter((e) => {
            if (e.type !== targetType) return false;
            if (selectedPlatform && e.platform.toLowerCase() !== selectedPlatform.toLowerCase()) return false;
            return true;
        });
    }, [allEvents, selectedType, selectedPlatform]);

    // Group filtered events by Date in IST for List View
    const groupedDateEvents = useMemo(() => {
        const groupsMap = new Map<string, { dateObj: Date; events: EventItem[] }>();

        filteredEvents.forEach((ev) => {
            let dateKey = "";
            let dateObj = new Date();
            try {
                dateObj = new Date(ev.startTime);
                dateKey = dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
            } catch {
                dateKey = "unknown";
            }

            if (!groupsMap.has(dateKey)) {
                groupsMap.set(dateKey, { dateObj, events: [] });
            }
            groupsMap.get(dateKey)!.events.push(ev);
        });

        // Today in IST
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

        const groups: Array<{
            dateKey: string;
            dateObj: Date;
            weekdayShort: string;
            dayNum: string;
            monthShort: string;
            yearStr: string;
            fullDateFormatted: string;
            isToday: boolean;
            hasLive: boolean;
            allFinished: boolean;
            events: EventItem[];
        }> = [];

        groupsMap.forEach((val, dateKey) => {
            const isToday = dateKey === todayStr;
            const weekdayShort = val.dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" }).toUpperCase();
            const dayNum = val.dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit" });
            const monthShort = val.dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short" }).toUpperCase();
            const yearStr = val.dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" });
            const fullDateFormatted = val.dateObj.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                weekday: "short",
                month: "short",
                day: "numeric",
            });

            const hasLive = val.events.some((e) => e.status === "LIVE");
            const allFinished = val.events.every((e) => e.status === "FINISHED");

            groups.push({
                dateKey,
                dateObj: val.dateObj,
                weekdayShort,
                dayNum,
                monthShort,
                yearStr,
                fullDateFormatted,
                isToday,
                hasLive,
                allFinished,
                events: val.events,
            });
        });

        return groups;
    }, [filteredEvents]);


    // Compute UP NEXT hero contest: next upcoming contest from nowMs
    const activeUpNext = useMemo(() => {
        const upcoming = filteredEvents.filter((e) => e.endTimestamp > nowMs);
        if (upcoming.length > 0) return upcoming[0];
        return upNext;
    }, [filteredEvents, nowMs, upNext]);

    // UP NEXT countdown digits
    const countdown = useMemo(() => {
        if (!activeUpNext) {
            return { days: "00", hours: "00", minutes: "00", seconds: "00" };
        }
        const diffMs = Math.max(0, activeUpNext.startTimestamp - nowMs);
        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;

        return {
            days: String(days).padStart(2, "0"),
            hours: String(hours).padStart(2, "0"),
            minutes: String(minutes).padStart(2, "0"),
            seconds: String(seconds).padStart(2, "0"),
        };
    }, [activeUpNext, nowMs]);

    // Active counts for chips row (uses selected month counts)
    const activeCounts = useMemo(() => {
        if (countsByMonthAndPlatform && countsByMonthAndPlatform[selectedMonth]) {
            return countsByMonthAndPlatform[selectedMonth];
        }
        return countsByPlatform || {};
    }, [countsByMonthAndPlatform, selectedMonth, countsByPlatform]);

    // Calendar grid generation
    const calendarCells = useMemo(() => {
        const firstDayOfMonth = new Date(viewYear, viewMonthIndex, 1).getDay(); // 0 is Sun
        const daysInMonth = new Date(viewYear, viewMonthIndex + 1, 0).getDate();
        const prevMonthLastDay = new Date(viewYear, viewMonthIndex, 0).getDate();

        const cells: Array<{
            dayNum: number;
            dateStr: string;
            isCurrentMonth: boolean;
            isToday: boolean;
            events: EventItem[];
        }> = [];

        // Today check in IST
        const todayDate = new Date();
        const todayYear = todayDate.getFullYear();
        const todayMonth = todayDate.getMonth();
        const todayDay = todayDate.getDate();

        // 1. Fill previous month's trailing days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const dNum = prevMonthLastDay - i;
            cells.push({
                dayNum: dNum,
                dateStr: "",
                isCurrentMonth: false,
                isToday: false,
                events: [],
            });
        }

        // 2. Fill current month's days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const isToday = viewYear === todayYear && viewMonthIndex === todayMonth && d === todayDay;

            // Find all events starting on this day in IST
            const dayEvents = filteredEvents.filter((ev) => {
                const evDate = new Date(ev.startTime);
                const evDayStr = evDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
                return evDayStr === dateStr;
            });

            cells.push({
                dayNum: d,
                dateStr,
                isCurrentMonth: true,
                isToday,
                events: dayEvents,
            });
        }

        // 3. Fill next month's leading days to complete the 7-column grid
        const remaining = (7 - (cells.length % 7)) % 7;
        for (let n = 1; n <= remaining; n++) {
            cells.push({
                dayNum: n,
                dateStr: "",
                isCurrentMonth: false,
                isToday: false,
                events: [],
            });
        }

        return cells;
    }, [viewYear, viewMonthIndex, filteredEvents]);

    // Modal state for "+N more" contests on a day
    const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: EventItem[] } | null>(null);

    // Calendar dropdown menu toggle for specific event
    const [openCalDropdownId, setOpenCalDropdownId] = useState<string | null>(null);

    // Reminders toggle handler
    const handleToggleReminder = (eventId: string, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        dispatch(toggleLocalReminder(eventId));
        dispatch(toggleReminder(eventId));
    };

    // Extract user contest stats from Redux contests state
    const userContestSummary = useMemo(() => {
        const username = currentUser?.username || "";
        const contestData = contestsState?.dataByUser?.[username];
        if (contestData) {
            const total = contestData.summary?.totalRatedContests || 0;
            // Get best rating
            let bestRating: number | null = null;
            let bestRank: number | null = null;
            for (const p of contestData.platforms || []) {
                if (p.currentRating && (!bestRating || p.currentRating > bestRating)) {
                    bestRating = p.currentRating;
                }
                if (p.officialRank && (!bestRank || p.officialRank < bestRank)) {
                    bestRank = p.officialRank;
                }
            }
            return {
                total,
                rating: bestRating ? String(bestRating) : "—",
                bestRank: bestRank ? `#${bestRank.toLocaleString()}` : "—",
            };
        }
        return {
            total: 0,
            rating: "—",
            bestRank: "—",
        };
    }, [currentUser, contestsState]);

    return (
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 flex overflow-x-hidden selection:bg-amber-500/20 selection:text-amber-900 antialiased font-sans ">
            {/* Soft Ambient Lighting Accents */}
            <div className="fixed top-0 left-1/4 w-[600px] h-[300px] bg-amber-500/[0.04] blur-[140px] pointer-events-none rounded-full" />
            <div className="fixed top-1/2 right-1/4 w-[500px] h-[350px] bg-blue-500/[0.02] blur-[160px] pointer-events-none rounded-full" />

            {/* Sidebar Navigation */}
            <div className="hidden lg:block w-[72px] flex-shrink-0">
                <Sidebar activeTab="events" />
            </div>

            {/* Main Tracker Container */}
            <main className="flex-1  px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1630px] mx-auto w-full space-y-6">
                {/* 1. Header Bar */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black pb-5">
                    <div >
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 flex items-center gap-2.5">
                                Event Tracker
                            </h1>
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 border border-emerald-300/80 text-emerald-700 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live Contest Platforms
                            </span>
                        </div>
                        <p className="text-neutral-500 text-xs sm:text-sm mt-1 font-medium">
                            Every round on Codeforces, LeetCode, CodeChef, AtCoder and GfG, with reminders.
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                            <span className="text-neutral-700 font-semibold">
                                {stats.totalInNext7Days || 7} contests in the next 7 days across {stats.totalPlatformsInNext7Days || 5} platforms
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                                live from each platform
                            </span>
                        </div>
                    </div>

                    {/* View & Type Controls */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Segmented Pill: Contests vs Hackathons */}
                        <div className="inline-flex rounded-xl bg-white p-1 border border-neutral-200/90 shadow-xs">
                            <button
                                type="button"
                                onClick={() => dispatch(setSelectedType("contests"))}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedType === "contests"
                                    ? "bg-neutral-900 text-white shadow-sm font-bold"
                                    : "text-neutral-600 hover:text-neutral-950 font-medium"
                                    }`}
                            >
                                Contests
                            </button>
                            <button
                                type="button"
                                onClick={() => dispatch(setSelectedType("hackathons"))}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedType === "hackathons"
                                    ? "bg-neutral-900 text-white shadow-sm font-bold"
                                    : "text-neutral-600 hover:text-neutral-950 font-medium"
                                    }`}
                            >
                                Hackathons
                            </button>
                        </div>

                        {/* Segmented Pill: Calendar vs List */}
                        <div className="inline-flex rounded-xl bg-white p-1 border border-neutral-200/90 shadow-xs">
                            <button
                                type="button"
                                onClick={() => dispatch(setViewMode("calendar"))}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === "calendar"
                                    ? "bg-neutral-900 text-white shadow-sm font-bold"
                                    : "text-neutral-600 hover:text-neutral-950 font-medium"
                                    }`}
                            >
                                <CalendarIcon className="w-3.5 h-3.5" />
                                Calendar
                            </button>
                            <button
                                type="button"
                                onClick={() => dispatch(setViewMode("list"))}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === "list"
                                    ? "bg-neutral-900 text-white shadow-sm font-bold"
                                    : "text-neutral-600 hover:text-neutral-950 font-medium"
                                    }`}
                            >
                                <ListIcon className="w-3.5 h-3.5" />
                                List
                            </button>
                        </div>
                    </div>
                </header>

                {/* 2. Hero Banner: UP NEXT Contest with Live Amber Countdown */}
                {activeUpNext && (
                    <section className="relative rounded-2xl bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#f59e0b] p-5 sm:p-7 shadow-2xl shadow-amber-500/10 text-black overflow-hidden border border-amber-300/30">
                        {/* Background watermark icon */}
                        <div className="absolute -right-6 -bottom-8 opacity-10 pointer-events-none scale-150 transform rotate-12">
                            {getPortalIcon(activeUpNext.platform, "w-48 h-48")}
                        </div>

                        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                            {/* Left details */}
                            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-lg shadow-black/10 flex items-center justify-center flex-shrink-0 p-2.5">
                                    {getPortalIcon(activeUpNext.platform, "w-9 h-9")}
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-black/75 bg-black/10 px-2 py-0.5 rounded-md">
                                            UP NEXT · {activeUpNext.platformName}
                                        </span>
                                        {activeUpNext.rated && (
                                            <span className="text-[10px] font-bold text-amber-950 bg-white/70 px-1.5 py-0.5 rounded">
                                                Rated
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight truncate max-w-2xl">
                                        {activeUpNext.title}
                                    </h2>
                                    <p className="text-xs sm:text-sm font-semibold text-black/85 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-black/70 flex-shrink-0" />
                                        {formatScheduleIST(activeUpNext)}
                                    </p>
                                </div>
                            </div>

                            {/* Middle & Right: Countdown Blocks + Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 flex-shrink-0">
                                {/* Digital Countdown blocks */}
                                <div className="flex items-center gap-2 sm:gap-2.5">
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.days}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black/70 uppercase mt-1">
                                            DAYS
                                        </span>
                                    </div>
                                    <span className="text-black/60 font-bold text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.hours}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black/70 uppercase mt-1">
                                            HRS
                                        </span>
                                    </div>
                                    <span className="text-black/60 font-bold text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.minutes}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black/70 uppercase mt-1">
                                            MIN
                                        </span>
                                    </div>
                                    <span className="text-black/60 font-bold text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.seconds}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black/70 uppercase mt-1">
                                            SEC
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                    {/* Remind Me button */}
                                    <button
                                        type="button"
                                        onClick={(e) => handleToggleReminder(activeUpNext.id, e)}
                                        className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm ${reminders.includes(activeUpNext.id)
                                            ? "bg-black text-amber-400 hover:bg-neutral-900 ring-2 ring-black"
                                            : "bg-white text-black hover:bg-neutral-100 ring-1 ring-black/10"
                                            }`}
                                    >
                                        {reminders.includes(activeUpNext.id) ? (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                                                <span>Reminded</span>
                                            </>
                                        ) : (
                                            <>
                                                <Bell className="w-4 h-4 text-black" />
                                                <span>Remind me</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Add to Calendar button with popup */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setOpenCalDropdownId(openCalDropdownId === activeUpNext.id ? null : activeUpNext.id)}
                                            className="bg-white hover:bg-neutral-100 text-black px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-sm ring-1 ring-black/10"
                                            title="Add to Google or Apple Calendar"
                                        >
                                            <CalendarPlus className="w-4 h-4" />
                                            <span>Add to calendar</span>
                                        </button>

                                        {openCalDropdownId === activeUpNext.id && (
                                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0e1422] border border-white/10 shadow-2xl z-30 p-1.5 text-white animate-in fade-in zoom-in-95">
                                                <a
                                                    href={createGoogleCalendarUrl(activeUpNext)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => setOpenCalDropdownId(null)}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/10 flex items-center gap-2 transition"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                                                    Google Calendar
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        downloadIcsFile(activeUpNext);
                                                        setOpenCalDropdownId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/10 flex items-center gap-2 transition"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                    Apple / Outlook (.ics)
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* External Link button */}
                                    <a
                                        href={activeUpNext.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-xl bg-white hover:bg-neutral-100 text-black flex items-center justify-center transition shadow-sm ring-1 ring-black/10"
                                        title="Open Contest Page"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 3. Platform Filter Chips Row (All 16 Platforms) */}
                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 overflow-x-auto p-2 scrollbar-none max-w-full border-y border-black">
                            {/* "All" reset chip */}
                            <button
                                type="button"
                                onClick={() => dispatch(setSelectedPlatform(null))}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 border ${selectedPlatform === null
                                    ? "bg-neutral-900 text-white shadow-sm border-neutral-900"
                                    : "bg-white text-neutral-700 border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50 shadow-xs"
                                    }`}
                            >
                                All Platforms
                            </button>

                            {/* Individual 16 Platform Chips */}
                            {ALL_16_PLATFORMS.map((plat) => {
                                const count = activeCounts[plat.id] || 0;
                                const isSelected = selectedPlatform === plat.id;

                                return (
                                    <button
                                        key={plat.id}
                                        type="button"
                                        onClick={() => dispatch(setSelectedPlatform(plat.id))}
                                        className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-2 flex-shrink-0 border ${isSelected
                                            ? "bg-neutral-900 text-white font-bold shadow-sm border-neutral-900"
                                            : "bg-white text-neutral-800 border-neutral-200/90 hover:border-neutral-300 hover:bg-neutral-50 shadow-xs font-medium"
                                            }`}
                                    >
                                        <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                            {getPortalIcon(plat.id, "w-3.5 h-3.5")}
                                        </div>
                                        <span>{plat.name}</span>
                                        <span
                                            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${isSelected
                                                ? "bg-white/20 text-white"
                                                : "bg-neutral-100 text-neutral-600"
                                                }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <span className="text-[11px] font-medium text-neutral-500 flex-shrink-0 ml-auto">
                            Counts are for {monthLabel}. All times IST.
                        </span>
                    </div>
                </section>

                {/* 4 & 5. Unified Black Scheduler & Contest History Section */}
                <section className="rounded-2xl sm:rounded-3xl bg-black border border-neutral-800 shadow-2xl text-white ring-1 ring-white/10 overflow-hidden">
                    {/* Upper: The Scheduler (Calendar or List View) */}
                    <div className="p-4 sm:p-6 space-y-4">
                        {viewMode === "calendar" ? (
                            <>
                                {/* Month Navigator Header */}
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                                        {monthLabel} <span className="text-neutral-400 font-normal">{viewYear}</span>
                                    </h3>

                                    {/* Controls: Today button + Strict 3-Month Window Arrows (< and >) */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleResetToday}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${selectedMonth === currentMonthStr
                                                ? "bg-white/10 text-white border-white/20"
                                                : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:text-white hover:bg-neutral-800"
                                                }`}
                                        >
                                            Today
                                        </button>

                                        <div className="flex items-center rounded-lg bg-neutral-900 border border-neutral-700 p-0.5">
                                            {/* Previous Month Arrow (disabled if outside 3-month window) */}
                                            <button
                                                type="button"
                                                onClick={handlePrevMonth}
                                                disabled={!canGoPrev}
                                                className={`w-7 h-7 rounded-md flex items-center justify-center transition ${canGoPrev
                                                    ? "text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer"
                                                    : "text-neutral-600 opacity-25 cursor-not-allowed"
                                                    }`}
                                                title={canGoPrev ? "Previous month" : "Only 1 month before current month is permitted"}
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>

                                            {/* Next Month Arrow (disabled if outside 3-month window) */}
                                            <button
                                                type="button"
                                                onClick={handleNextMonth}
                                                disabled={!canGoNext}
                                                className={`w-7 h-7 rounded-md flex items-center justify-center transition ${canGoNext
                                                    ? "text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer"
                                                    : "text-neutral-600 opacity-25 cursor-not-allowed"
                                                    }`}
                                                title={canGoNext ? "Next month" : "Only 1 month after current month is permitted"}
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Calendar 7-Column Days Grid */}
                                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black shadow-inner">
                                    {/* Days of week header */}
                                    <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-950">
                                        {DAY_NAMES.map((name) => (
                                            <div
                                                key={name}
                                                className="py-2.5 text-center text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Days Matrix */}
                                    <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-neutral-800/80 bg-black">
                                        {calendarCells.map((cell, idx) => {
                                            const maxVisible = 2;
                                            const visibleEvents = cell.events.slice(0, maxVisible);
                                            const extraCount = cell.events.length - maxVisible;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`min-h-[115px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${cell.isCurrentMonth
                                                        ? cell.isToday
                                                            ? "bg-white text-black shadow-lg ring-1 ring-white/90"
                                                            : "bg-black hover:bg-neutral-900/50"
                                                        : "bg-black opacity-20 pointer-events-none"
                                                        }`}
                                                >
                                                    {/* Cell Date Header */}
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        {cell.isToday ? (
                                                            <span className="inline-flex items-center gap-1 bg-black text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                                                                {cell.dayNum} Today
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-neutral-400 pl-0.5">
                                                                {cell.dayNum}
                                                            </span>
                                                        )}

                                                        {cell.events.length > 0 && (
                                                            <span className={`text-[10px] font-mono ${cell.isToday ? "text-neutral-600 font-bold" : "text-neutral-500"}`}>
                                                                {cell.events.length}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Contest Pills List */}
                                                    <div className="flex-1 space-y-1 overflow-hidden">
                                                        {visibleEvents.map((ev) => {
                                                            const timeStr = formatTimeIST(ev.startTime);
                                                            const isReminded = reminders.includes(ev.id);

                                                            return (
                                                                <div
                                                                    key={ev.id}
                                                                    onClick={() => setSelectedDayEvents({ date: cell.dateStr, events: cell.events })}
                                                                    className={`group/pill flex items-center gap-1.5 p-1 sm:p-1.5 rounded-lg border transition cursor-pointer text-left shadow-sm ${cell.isToday
                                                                        ? "bg-neutral-100 hover:bg-neutral-200/90 border-neutral-300/80 text-black"
                                                                        : "bg-neutral-900 hover:bg-neutral-800 border-neutral-800 hover:border-neutral-700 text-white"
                                                                        }`}
                                                                    title={`${ev.title} on ${ev.platformName} (${timeStr} IST)`}
                                                                >
                                                                    <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                                        {getPortalIcon(ev.platform, "w-3.5 h-3.5")}
                                                                    </div>
                                                                    <span className={`text-[10px] sm:text-[11px] font-mono font-bold flex-shrink-0 ${cell.isToday ? "text-neutral-800 group-hover/pill:text-black" : "text-neutral-300 group-hover/pill:text-white"
                                                                        }`}>
                                                                        {timeStr}
                                                                    </span>
                                                                    <span className={`text-[10px] sm:text-[11px] truncate font-semibold ${cell.isToday ? "text-neutral-900 group-hover/pill:text-black" : "text-neutral-300 group-hover/pill:text-white"
                                                                        }`}>
                                                                        {ev.title}
                                                                    </span>
                                                                    {isReminded && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-auto flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {/* More indicator */}
                                                        {extraCount > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedDayEvents({ date: cell.dateStr, events: cell.events })}
                                                                className={`w-full text-left pl-1 text-[10px] font-bold transition ${cell.isToday ? "text-neutral-700 hover:text-black" : "text-neutral-400 hover:text-amber-400"
                                                                    }`}
                                                            >
                                                                +{extraCount} more
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* 4b. List View Mode (Grouped by Date with Brackets) */
                            <>
                                <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold tracking-tight text-white">
                                            All {selectedType === "contests" ? "Contests" : "Hackathons"} ({filteredEvents.length})
                                        </h3>
                                        {groupedDateEvents.length > 0 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 font-mono">
                                                {groupedDateEvents.length} Days
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-neutral-400">
                                        Sorted by Start Time
                                    </span>
                                </div>

                                {groupedDateEvents.length === 0 ? (
                                    <div className="py-16 text-center rounded-2xl bg-neutral-950 border border-neutral-800 p-8">
                                        <CalendarIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
                                        <h4 className="text-base font-bold text-white mb-1">No contests found</h4>
                                        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                                            There are no scheduled contests matching your current platform or month filters.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 sm:space-y-5">
                                        {groupedDateEvents.map((group) => {
                                            const hasMultiple = group.events.length > 1;

                                            return (
                                                <div
                                                    key={group.dateKey}
                                                    className="flex items-stretch gap-2 sm:gap-3 md:gap-3.5"
                                                >
                                                    {/* Left Date Column */}
                                                    <div className="flex flex-col items-center justify-center flex-shrink-0 w-20 sm:w-28 md:w-36 self-stretch">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedDayEvents({ date: group.dateKey, events: group.events })}
                                                            className={`w-full h-full min-h-[90px] rounded-2xl p-2 sm:p-3 text-center border transition-all duration-200 flex flex-col items-center justify-center cursor-pointer shadow-sm ${
                                                                group.isToday
                                                                    ? "bg-white text-black border-white shadow-[0_0_24px_rgba(255,255,255,0.18)] hover:bg-neutral-100"
                                                                    : group.hasLive
                                                                    ? "bg-neutral-900/90 text-white border-rose-500/40 shadow-[0_0_16px_rgba(244,63,94,0.12)] hover:border-rose-400"
                                                                    : group.allFinished
                                                                    ? "bg-neutral-950/70 text-neutral-400 border-neutral-800/60 hover:border-neutral-700"
                                                                    : "bg-neutral-900/70 text-white border-neutral-800/80 hover:border-neutral-600 hover:bg-neutral-900"
                                                            }`}
                                                            title={`View all ${group.events.length} contest${group.events.length > 1 ? "s" : ""} on ${group.fullDateFormatted}`}
                                                        >
                                                            {/* Day of Week */}
                                                            <span
                                                                className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest ${
                                                                    group.isToday ? "text-neutral-700" : group.hasLive ? "text-rose-400" : "text-neutral-400"
                                                                }`}
                                                            >
                                                                {group.weekdayShort}
                                                            </span>

                                                            {/* Day Number */}
                                                            <span
                                                                className={`text-2xl sm:text-3xl md:text-4xl font-black font-mono leading-none tracking-tight my-1 ${
                                                                    group.isToday ? "text-black" : "text-white"
                                                                }`}
                                                            >
                                                                {group.dayNum}
                                                            </span>

                                                            {/* Month & Year */}
                                                            <span
                                                                className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${
                                                                    group.isToday ? "text-neutral-800" : "text-neutral-400"
                                                                }`}
                                                            >
                                                                {group.monthShort}
                                                            </span>

                                                            {/* Context Badges */}
                                                            <div className="mt-1.5 flex flex-col items-center gap-1 w-full">
                                                                {group.isToday && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-black text-white shadow-sm">
                                                                        Today
                                                                    </span>
                                                                )}
                                                                {group.hasLive && !group.isToday && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                                                        Live
                                                                    </span>
                                                                )}
                                                                {hasMultiple && (
                                                                    <span
                                                                        className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap ${
                                                                            group.isToday
                                                                                ? "bg-neutral-200 text-neutral-900"
                                                                                : "bg-white/5 text-neutral-400 border border-white/5"
                                                                        }`}
                                                                    >
                                                                        {group.events.length} Contests
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    </div>

                                                    {/* Middle: Bracket (if > 1 contest) or empty spacer (if 1 contest) */}
                                                    {hasMultiple ? (
                                                        <CurlyBracket isToday={group.isToday} isLive={group.hasLive} />
                                                    ) : (
                                                        <div className="w-5 sm:w-6 md:w-7 flex-shrink-0" />
                                                    )}

                                                    {/* Right: Contest Cards for this date */}
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        {group.events.map((ev) => {
                                                            const isReminded = reminders.includes(ev.id);
                                                            const isLive = ev.status === "LIVE";
                                                            const isFinished = ev.status === "FINISHED";

                                                            return (
                                                                <div
                                                                    key={ev.id}
                                                                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm group/card"
                                                                >
                                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 p-2">
                                                                            {getPortalIcon(ev.platform, "w-6 h-6")}
                                                                        </div>
                                                                        <div className="min-w-0 space-y-0.5">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                                                                    {ev.platformName}
                                                                                </span>
                                                                                {ev.division && (
                                                                                    <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded">
                                                                                        {ev.division}
                                                                                    </span>
                                                                                )}
                                                                                {ev.rated && (
                                                                                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                                                                        Rated
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h4 className="text-sm font-bold text-white truncate max-w-xl">
                                                                                {ev.title}
                                                                            </h4>
                                                                            <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                                                                                <Clock className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                                                                                <span className="font-mono text-neutral-300 font-medium">
                                                                                    {formatTimeRangeIST(ev)}
                                                                                </span>
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Status & Actions */}
                                                                    <div className="flex items-center gap-3 ml-auto md:ml-0 flex-shrink-0">
                                                                        {isLive ? (
                                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1.5">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                                                                LIVE NOW
                                                                            </span>
                                                                        ) : isFinished ? (
                                                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium text-neutral-500 bg-white/5">
                                                                                Finished
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs font-mono text-neutral-400">
                                                                                {formatRelativeCountdown(ev.startTimestamp, nowMs)}
                                                                            </span>
                                                                        )}

                                                                        {/* Remind button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleToggleReminder(ev.id, e)}
                                                                            className={`p-2 rounded-lg transition border ${isReminded
                                                                                ? "bg-amber-400 text-black border-amber-400"
                                                                                : "bg-neutral-900 text-neutral-400 hover:text-white border-neutral-700"
                                                                                }`}
                                                                            title={isReminded ? "Reminder enabled" : "Set reminder"}
                                                                        >
                                                                            <Bell className="w-4 h-4" />
                                                                        </button>

                                                                        {/* Smart Inline Add to Calendar */}
                                                                        {openCalDropdownId === `list-${ev.id}` ? (
                                                                            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 p-1 rounded-xl shadow-lg animate-in fade-in zoom-in-95">
                                                                                <a
                                                                                    href={createGoogleCalendarUrl(ev)}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    onClick={() => setOpenCalDropdownId(null)}
                                                                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 transition"
                                                                                    title="Add to Google Calendar"
                                                                                >
                                                                                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                                                                                    Google
                                                                                </a>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        downloadIcsFile(ev);
                                                                                        setOpenCalDropdownId(null);
                                                                                    }}
                                                                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 transition"
                                                                                    title="Download .ics for Apple/Outlook"
                                                                                >
                                                                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                                                    .ics
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setOpenCalDropdownId(null)}
                                                                                    className="p-1 rounded-lg text-neutral-400 hover:text-white transition"
                                                                                    title="Close"
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setOpenCalDropdownId(`list-${ev.id}`);
                                                                                }}
                                                                                className="p-2 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-700 transition"
                                                                                title="Add to calendar"
                                                                            >
                                                                                <CalendarPlus className="w-4 h-4" />
                                                                            </button>
                                                                        )}

                                                                        {/* External link */}
                                                                        <a
                                                                            href={ev.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="p-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-700 transition"
                                                                            title="Open contest link"
                                                                        >
                                                                            <ExternalLink className="w-4 h-4" />
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Seamless In-Section Divider */}
                    <div className="border-t border-neutral-800/80 mx-4 sm:mx-6" />

                    {/* Below Section: Your Contest History */}
                    <div className="p-5 sm:p-6 space-y-5 bg-black">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-400" />
                                <h3 className="text-base sm:text-lg font-bold text-white">
                                    Your contest history
                                </h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-xs text-neutral-400 hidden sm:block">
                                    Rated contests from your platforms show up here.
                                </p>
                                <Link
                                    to="/dashboard"
                                    className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
                                >
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    Rating graph
                                </Link>
                            </div>
                        </div>

                        {/* 3 Pure Black Stat Boxes: Contests, Rating, Best Rank */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center space-y-1 hover:border-neutral-700 transition">
                                <div className="text-2xl sm:text-3xl font-black text-white">
                                    {userContestSummary.total}
                                </div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                                    Contests
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center space-y-1 hover:border-neutral-700 transition">
                                <div className="text-2xl sm:text-3xl font-black text-white">
                                    {userContestSummary.rating}
                                </div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                                    Rating
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center space-y-1 hover:border-neutral-700 transition">
                                <div className="text-2xl sm:text-3xl font-black text-white">
                                    {userContestSummary.bestRank}
                                </div>
                                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                                    Best rank
                                </div>
                            </div>
                        </div>

                        {/* Connect Platforms Prompt */}
                        <div className="pt-2 text-center flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-800">
                            <p className="text-xs text-neutral-400">
                                Sync your competitive programming handles to automatically track past ratings and progress.
                            </p>
                            <Link
                                to="/onboarding"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white transition border border-white/15"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                Connect More Platforms
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Modal: Full Day Contest Breakdown (triggered by "+N more" or day click) */}
            {selectedDayEvents && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
                    onClick={() => setSelectedDayEvents(null)}
                >
                    <div
                        className="relative z-[101] w-full max-w-xl rounded-3xl bg-black border border-neutral-800 p-6 shadow-2xl space-y-4 text-white ring-1 ring-white/10 animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                                    Contests on {formatDayTitle(selectedDayEvents.date)}
                                </h3>
                                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                                    {selectedDayEvents.events.length} round{selectedDayEvents.events.length > 1 ? "s" : ""} scheduled
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDayEvents(null)}
                                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition"
                                title="Close dialog"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Dynamic Contest Cards List */}
                        <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                            {selectedDayEvents.events.map((ev) => {
                                const isReminded = reminders.includes(ev.id);
                                const timeStr = formatTimeIST(ev.startTime);

                                return (
                                    <div
                                        key={ev.id}
                                        className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0 p-2">
                                                {getPortalIcon(ev.platform, "w-6 h-6")}
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                                        {ev.platformName}
                                                    </span>
                                                    {ev.division && (
                                                        <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded">
                                                            {ev.division}
                                                        </span>
                                                    )}
                                                    {ev.rated && (
                                                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                                            Rated
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-sm">
                                                    {ev.title}
                                                </h4>
                                                <p className="text-xs text-neutral-400 font-medium">
                                                    {timeStr} IST · {ev.durationFormatted}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Smart Actions: Remind, Inline Calendar, Open Link */}
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                                            {/* Remind button */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleReminder(ev.id)}
                                                className={`p-2 rounded-xl transition border text-xs font-semibold ${isReminded
                                                    ? "bg-amber-400 text-black border-amber-400 shadow-sm"
                                                    : "bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800 hover:bg-neutral-800"
                                                    }`}
                                                title={isReminded ? "Reminder enabled" : "Set reminder"}
                                            >
                                                <Bell className="w-4 h-4" />
                                            </button>

                                            {/* Smart Inline Add to Calendar */}
                                            {openCalDropdownId === `modal-${ev.id}` ? (
                                                <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 p-1 rounded-xl shadow-xl animate-in fade-in zoom-in-95">
                                                    <a
                                                        href={createGoogleCalendarUrl(ev)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={() => setOpenCalDropdownId(null)}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 transition"
                                                        title="Add to Google Calendar"
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                                                        Google
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            downloadIcsFile(ev);
                                                            setOpenCalDropdownId(null);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 transition"
                                                        title="Download .ics for Apple/Outlook"
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                        .ics
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenCalDropdownId(null)}
                                                        className="p-1 rounded-lg text-neutral-400 hover:text-white transition"
                                                        title="Close"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenCalDropdownId(`modal-${ev.id}`)}
                                                    className="p-2 rounded-xl bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition flex items-center gap-1.5 text-xs font-semibold"
                                                    title="Add to calendar"
                                                >
                                                    <CalendarPlus className="w-4 h-4" />
                                                    <span className="hidden sm:inline">Add to cal</span>
                                                </button>
                                            )}

                                            {/* Open contest link */}
                                            <a
                                                href={ev.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition"
                                                title="Open contest link"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventTrackerPage;
