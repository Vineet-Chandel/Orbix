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
        <div className="min-h-screen bg-[#07090e] text-white flex overflow-x-hidden selection:bg-amber-500/20 selection:text-amber-300">
            {/* Ambient Lighting Accents */}
            <div className="fixed top-0 left-1/4 w-[600px] h-[300px] bg-amber-500/5 blur-[140px] pointer-events-none rounded-full" />
            <div className="fixed top-1/2 right-1/4 w-[500px] h-[350px] bg-blue-600/5 blur-[160px] pointer-events-none rounded-full" />

            {/* Sidebar Navigation */}
            <div className="hidden lg:block w-[72px] flex-shrink-0">
                <Sidebar activeTab="dashboard" />
            </div>

            {/* Main Tracker Container */}
            <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1560px] mx-auto w-full space-y-6">
                {/* 1. Header Bar */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                                Event Tracker
                            </h1>
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live Contest Platforms
                            </span>
                        </div>
                        <p className="text-neutral-400 text-xs sm:text-sm mt-1">
                            Every round on Codeforces, LeetCode, CodeChef, AtCoder and GfG, with reminders.
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-neutral-400">
                            <span className="text-neutral-300 font-medium">
                                {stats.totalInNext7Days || 7} contests in the next 7 days across {stats.totalPlatformsInNext7Days || 5} platforms
                            </span>
                            <span className="text-neutral-600">•</span>
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                                live from each platform
                            </span>
                        </div>
                    </div>

                    {/* View & Type Controls */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Segmented Pill: Contests vs Hackathons */}
                        <div className="inline-flex rounded-xl bg-[#111726] p-1 border border-white/10 shadow-inner">
                            <button
                                type="button"
                                onClick={() => dispatch(setSelectedType("contests"))}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedType === "contests"
                                    ? "bg-white text-black shadow-md font-bold"
                                    : "text-neutral-400 hover:text-white"
                                    }`}
                            >
                                Contests
                            </button>
                            <button
                                type="button"
                                onClick={() => dispatch(setSelectedType("hackathons"))}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedType === "hackathons"
                                    ? "bg-white text-black shadow-md font-bold"
                                    : "text-neutral-400 hover:text-white"
                                    }`}
                            >
                                Hackathons
                            </button>
                        </div>

                        {/* Segmented Pill: Calendar vs List */}
                        <div className="inline-flex rounded-xl bg-[#111726] p-1 border border-white/10 shadow-inner">
                            <button
                                type="button"
                                onClick={() => dispatch(setViewMode("calendar"))}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === "calendar"
                                    ? "bg-white text-black shadow-md font-bold"
                                    : "text-neutral-400 hover:text-white"
                                    }`}
                            >
                                <CalendarIcon className="w-3.5 h-3.5" />
                                Calendar
                            </button>
                            <button
                                type="button"
                                onClick={() => dispatch(setViewMode("list"))}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === "list"
                                    ? "bg-white text-black shadow-md font-bold"
                                    : "text-neutral-400 hover:text-white"
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
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
                            {/* "All" reset chip */}
                            <button
                                type="button"
                                onClick={() => dispatch(setSelectedPlatform(null))}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ${selectedPlatform === null
                                    ? "bg-white text-black shadow-md font-bold"
                                    : "bg-[#0e1422] text-neutral-400 border border-white/10 hover:border-white/20 hover:text-white"
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
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 flex-shrink-0 border ${isSelected
                                            ? "bg-white text-black font-bold shadow-lg border-white"
                                            : "bg-[#0b0f17] text-neutral-300 border-white/[0.08] hover:border-white/25 hover:bg-[#111726]"
                                            }`}
                                    >
                                        <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                            {getPortalIcon(plat.id, "w-3.5 h-3.5")}
                                        </div>
                                        <span>{plat.name}</span>
                                        <span
                                            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? "bg-black/15 text-black" : "bg-white/10 text-neutral-400"
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

                {/* 4. Calendar or List View Container */}
                {viewMode === "calendar" ? (
                    <section className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-4 sm:p-6 space-y-4 shadow-xl">
                        {/* Month Navigator Header */}
                        <div className="flex items-center justify-between gap-4">
                            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                                {monthLabel} <span className="text-neutral-500 font-normal">{viewYear}</span>
                            </h3>

                            {/* Controls: Today button + Strict 3-Month Window Arrows (< and >) */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleResetToday}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${selectedMonth === currentMonthStr
                                        ? "bg-white/10 text-white border-white/20"
                                        : "bg-[#111726] text-neutral-400 border-white/10 hover:text-white"
                                        }`}
                                >
                                    Today
                                </button>

                                <div className="flex items-center rounded-lg bg-[#111726] border border-white/10 p-0.5">
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
                        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0a0d14]">
                            {/* Days of week header */}
                            <div className="grid grid-cols-7 border-b border-white/10 bg-[#0e1422]">
                                {DAY_NAMES.map((name) => (
                                    <div
                                        key={name}
                                        className="py-2.5 text-center text-[11px] font-bold tracking-wider text-neutral-400"
                                    >
                                        {name}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Days Matrix */}
                            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-white/[0.06] bg-[#07090e]">
                                {calendarCells.map((cell, idx) => {
                                    const maxVisible = 2;
                                    const visibleEvents = cell.events.slice(0, maxVisible);
                                    const extraCount = cell.events.length - maxVisible;

                                    return (
                                        <div
                                            key={idx}
                                            className={`min-h-[115px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${cell.isCurrentMonth
                                                ? cell.isToday
                                                    ? "bg-[#111726]/40"
                                                    : "bg-[#0a0d14] hover:bg-[#0e1422]/60"
                                                : "bg-[#06080c]/60 opacity-20 pointer-events-none"
                                                }`}
                                        >
                                            {/* Cell Date Header */}
                                            <div className="flex items-center justify-between mb-1.5">
                                                {cell.isToday ? (
                                                    <span className="inline-flex items-center gap-1 bg-white text-black text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm">
                                                        {cell.dayNum} Today
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-semibold text-neutral-400 pl-0.5">
                                                        {cell.dayNum}
                                                    </span>
                                                )}

                                                {cell.events.length > 0 && (
                                                    <span className="text-[10px] text-neutral-500 font-mono">
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
                                                            className="group/pill flex items-center gap-1.5 p-1 sm:p-1.5 rounded-lg bg-[#111726] hover:bg-[#182236] border border-white/[0.06] hover:border-white/20 transition cursor-pointer text-left shadow-sm"
                                                            title={`${ev.title} on ${ev.platformName} (${timeStr} IST)`}
                                                        >
                                                            <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                                {getPortalIcon(ev.platform, "w-3.5 h-3.5")}
                                                            </div>
                                                            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-neutral-300 group-hover/pill:text-white flex-shrink-0">
                                                                {timeStr}
                                                            </span>
                                                            <span className="text-[10px] sm:text-[11px] text-neutral-300 group-hover/pill:text-white truncate font-medium">
                                                                {ev.title}
                                                            </span>
                                                            {isReminded && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-auto flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    );
                                                })}

                                                {/* More indicator */}
                                                {extraCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDayEvents({ date: cell.dateStr, events: cell.events })}
                                                        className="w-full text-left pl-1 text-[10px] font-bold text-neutral-400 hover:text-amber-400 transition"
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
                    </section>
                ) : (
                    /* 4b. List View Mode */
                    <section className="rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-4 sm:p-6 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                            <h3 className="text-xl font-bold tracking-tight text-white">
                                All {selectedType === "contests" ? "Contests" : "Hackathons"} ({filteredEvents.length})
                            </h3>
                            <span className="text-xs text-neutral-400">
                                Sorted by Start Time
                            </span>
                        </div>

                        <div className="space-y-2.5">
                            {filteredEvents.map((ev) => {
                                const isReminded = reminders.includes(ev.id);
                                const isLive = ev.status === "LIVE";
                                const isFinished = ev.status === "FINISHED";

                                return (
                                    <div
                                        key={ev.id}
                                        className="p-3.5 rounded-xl bg-[#0e1422] border border-white/[0.06] hover:border-white/20 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
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
                                                <p className="text-xs text-neutral-400">
                                                    {formatScheduleIST(ev)}
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
                                                    : "bg-white/5 text-neutral-400 hover:text-white border-white/10"
                                                    }`}
                                                title={isReminded ? "Reminder enabled" : "Set reminder"}
                                            >
                                                <Bell className="w-4 h-4" />
                                            </button>

                                            {/* Add to cal */}
                                            <button
                                                type="button"
                                                onClick={() => downloadIcsFile(ev)}
                                                className="p-2 rounded-lg bg-white/5 text-neutral-400 hover:text-white border border-white/10 transition"
                                                title="Download .ics event"
                                            >
                                                <CalendarPlus className="w-4 h-4" />
                                            </button>

                                            {/* External link */}
                                            <a
                                                href={ev.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-lg bg-white/5 text-neutral-400 hover:text-white border border-white/10 transition"
                                                title="Open contest link"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* 5. Bottom Two-Card Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Card: Coming Up (approx 65% width on desktop) */}
                    <div className="lg:col-span-7 xl:col-span-8 rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-5 sm:p-6 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <h3 className="text-base sm:text-lg font-bold text-white">
                                    Coming up
                                </h3>
                            </div>
                            <span className="text-[11px] text-neutral-500 font-medium">
                                Bell = email 30 min before
                            </span>
                        </div>

                        {/* List of next upcoming contests */}
                        <div className="space-y-2.5">
                            {filteredEvents
                                .filter((e) => e.endTimestamp > nowMs)
                                .slice(0, 6)
                                .map((ev) => {
                                    const isReminded = reminders.includes(ev.id);
                                    const countdownStr = formatRelativeCountdown(ev.startTimestamp, nowMs);

                                    return (
                                        <div
                                            key={ev.id}
                                            className="p-3 sm:p-3.5 rounded-xl bg-[#0e1422] border border-white/[0.05] hover:border-white/15 transition flex items-center justify-between gap-3 group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 p-1.5">
                                                    {getPortalIcon(ev.platform, "w-5 h-5")}
                                                </div>
                                                <div className="min-w-0 space-y-0.5">
                                                    <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-sm sm:max-w-md group-hover:text-amber-400 transition-colors">
                                                        {ev.title}
                                                    </h4>
                                                    <p className="text-[11px] text-neutral-400 truncate">
                                                        {ev.platformName} · {formatScheduleIST(ev)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2.5 flex-shrink-0">
                                                <span className="text-[11px] font-mono text-neutral-400">
                                                    {countdownStr}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleToggleReminder(ev.id, e)}
                                                    className={`p-1.5 rounded-lg transition ${isReminded
                                                        ? "text-amber-400 bg-amber-400/10"
                                                        : "text-neutral-500 hover:text-white hover:bg-white/5"
                                                        }`}
                                                    title={isReminded ? "Reminder enabled" : "Set reminder"}
                                                >
                                                    <Bell className="w-4 h-4" />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => downloadIcsFile(ev)}
                                                    className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition"
                                                    title="Add to calendar"
                                                >
                                                    <CalendarPlus className="w-4 h-4" />
                                                </button>

                                                <a
                                                    href={ev.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition"
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

                    {/* Right Card: Your Contest History (approx 35% width on desktop) */}
                    <div className="lg:col-span-5 xl:col-span-4 rounded-2xl bg-[#0a0d14] border border-white/[0.08] p-5 sm:p-6 space-y-5 shadow-xl flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-amber-400" />
                                    <h3 className="text-base sm:text-lg font-bold text-white">
                                        Your contest history
                                    </h3>
                                </div>
                                <Link
                                    to="/dashboard"
                                    className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
                                >
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    Rating graph
                                </Link>
                            </div>

                            {/* 3 Stats Boxes: Contests, Rating, Best Rank */}
                            <div className="grid grid-cols-3 gap-3 pt-4">
                                <div className="p-3.5 rounded-xl bg-[#0e1422] border border-white/[0.06] text-center space-y-1">
                                    <div className="text-xl sm:text-2xl font-black text-white">
                                        {userContestSummary.total}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                        Contests
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-[#0e1422] border border-white/[0.06] text-center space-y-1">
                                    <div className="text-xl sm:text-2xl font-black text-white">
                                        {userContestSummary.rating}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                        Rating
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-xl bg-[#0e1422] border border-white/[0.06] text-center space-y-1">
                                    <div className="text-xl sm:text-2xl font-black text-white">
                                        {userContestSummary.bestRank}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                        Best rank
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Empty/Connected State prompt */}
                        <div className="pt-4 text-center border-t border-white/[0.06] space-y-2">
                            <p className="text-xs text-neutral-400">
                                Rated contests from your platforms show up here.
                            </p>
                            <Link
                                to="/onboarding"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition border border-white/10"
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
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
                    onClick={() => setSelectedDayEvents(null)}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl bg-[#0b0f17] border border-white/15 p-6 shadow-2xl space-y-4 text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    Contests on {selectedDayEvents.date}
                                </h3>
                                <p className="text-xs text-neutral-400">
                                    {selectedDayEvents.events.length} round{selectedDayEvents.events.length > 1 ? "s" : ""} scheduled
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDayEvents(null)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                            {selectedDayEvents.events.map((ev) => {
                                const isReminded = reminders.includes(ev.id);
                                const timeStr = formatTimeIST(ev.startTime);

                                return (
                                    <div
                                        key={ev.id}
                                        className="p-3 rounded-xl bg-[#111726] border border-white/10 flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 p-1.5">
                                                {getPortalIcon(ev.platform, "w-5 h-5")}
                                            </div>
                                            <div className="min-w-0 space-y-0.5">
                                                <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs">
                                                    {ev.title}
                                                </h4>
                                                <p className="text-[11px] text-neutral-400">
                                                    {ev.platformName} · {timeStr} IST · {ev.durationFormatted}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleReminder(ev.id)}
                                                className={`p-1.5 rounded-lg transition border ${isReminded
                                                    ? "bg-amber-400 text-black border-amber-400"
                                                    : "bg-white/5 text-neutral-400 hover:text-white border-white/10"
                                                    }`}
                                                title={isReminded ? "Reminder enabled" : "Set reminder"}
                                            >
                                                <Bell className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={ev.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 rounded-lg bg-white/5 text-neutral-400 hover:text-white border border-white/10 transition"
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
