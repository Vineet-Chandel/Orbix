import React, { useState, useEffect, useMemo, useRef } from "react";
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
    Sparkles,
    X,
} from "lucide-react";
import { getPortalIcon } from "../../../utils/portalIcons";
import { MOCK_EVENT_LIST } from "./mockEvents";
import type { EventItem } from "../../../store";

export const ALL_FILTER_PLATFORMS = [
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
                className={`w-full h-full transition-colors ${isLive
                    ? "text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                    : isToday
                        ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                        : "text-indigo-900/60"
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

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
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

export interface EventsProps {
    className?: string;
}

export const Events: React.FC<EventsProps> = ({ className = "" }) => {
    // Live ticking clock for hero timer (updates every second)
    const [nowMs, setNowMs] = useState<number>(Date.now());
    useEffect(() => {
        const interval = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Filter states
    const [selectedType, setSelectedType] = useState<"contests" | "hackathons">("contests");
    const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [reminders, setReminders] = useState<string[]>(["starters-261"]);
    const [openCalDropdownId, setOpenCalDropdownId] = useState<string | null>(null);
    const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: EventItem[] } | null>(null);

    // Month Navigation State for Calendar View
    const today = new Date();
    const [viewYear, setViewYear] = useState<number>(today.getFullYear());
    const [viewMonthIndex, setViewMonthIndex] = useState<number>(today.getMonth());

    const monthLabel = MONTH_NAMES[viewMonthIndex];

    const handlePrevMonth = () => {
        if (viewMonthIndex === 0) {
            setViewMonthIndex(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonthIndex((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonthIndex === 11) {
            setViewMonthIndex(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonthIndex((m) => m + 1);
        }
    };

    const handleResetToday = () => {
        setViewYear(today.getFullYear());
        setViewMonthIndex(today.getMonth());
    };

    // Close calendar dropdown on outside click
    const calDropdownRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (calDropdownRef.current && !calDropdownRef.current.contains(e.target as Node)) {
                setOpenCalDropdownId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Toggle Reminder
    const handleToggleReminder = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setReminders((prev) =>
            prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
        );
    };

    // Filter events by Type and Platform
    const filteredEvents = useMemo(() => {
        return MOCK_EVENT_LIST.filter((ev) => {
            const matchesType = selectedType === "contests" ? ev.type === "contest" : ev.type === "hackathon";
            const matchesPlatform = selectedPlatform === null || ev.platform === selectedPlatform;
            return matchesType && matchesPlatform;
        });
    }, [selectedType, selectedPlatform]);

    // Group events by Date for the List View
    const groupedDateEvents = useMemo(() => {
        const groupsMap = new Map<string, { dateObj: Date; events: EventItem[] }>();

        filteredEvents.forEach((ev) => {
            const dateObj = new Date(ev.startTime);
            const dateKey = dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"

            if (!groupsMap.has(dateKey)) {
                groupsMap.set(dateKey, { dateObj, events: [] });
            }
            groupsMap.get(dateKey)!.events.push(ev);
        });

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

            val.events.sort((a, b) => a.startTimestamp - b.startTimestamp);

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

        groups.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
        return groups;
    }, [filteredEvents]);

    // Dynamic platform contest counts for the currently viewed month
    const activeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        ALL_FILTER_PLATFORMS.forEach((p) => {
            counts[p.id] = 0;
        });
        MOCK_EVENT_LIST.forEach((ev) => {
            const d = new Date(ev.startTime);
            if (d.getFullYear() === viewYear && d.getMonth() === viewMonthIndex) {
                if (selectedType === "contests" ? ev.type === "contest" : ev.type === "hackathon") {
                    counts[ev.platform] = (counts[ev.platform] || 0) + 1;
                }
            }
        });
        return counts;
    }, [viewYear, viewMonthIndex, selectedType]);

    // Active Up Next Contest
    const activeUpNext = useMemo(() => {
        const upcoming = filteredEvents.filter((e) => e.endTimestamp > nowMs);
        if (upcoming.length > 0) return upcoming[0];
        return MOCK_EVENT_LIST.find((e) => e.id === "starters-261") || MOCK_EVENT_LIST[0];
    }, [filteredEvents, nowMs]);

    // Live Countdown
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

    // Calendar Grid Cells
    const calendarCells = useMemo(() => {
        const firstDayOfMonth = new Date(viewYear, viewMonthIndex, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonthIndex + 1, 0).getDate();
        const prevMonthLastDay = new Date(viewYear, viewMonthIndex, 0).getDate();

        const cells: Array<{
            dayNum: number;
            dateStr: string;
            isCurrentMonth: boolean;
            isToday: boolean;
            events: EventItem[];
        }> = [];

        const todayDate = new Date();
        const todayYear = todayDate.getFullYear();
        const todayMonth = todayDate.getMonth();
        const todayDay = todayDate.getDate();

        // 1. Previous month trailing days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            cells.push({
                dayNum: prevMonthLastDay - i,
                dateStr: "",
                isCurrentMonth: false,
                isToday: false,
                events: [],
            });
        }

        // 2. Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const isToday = viewYear === todayYear && viewMonthIndex === todayMonth && d === todayDay;

            const dayEvents = filteredEvents.filter((ev) => {
                const evDate = new Date(ev.startTime);
                const evDayStr = evDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
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

        // 3. Next month leading days
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

    return (
        <section
            className={`relative w-full py-20 px-4 sm:px-6 lg:px-8 bg-[#07090e] text-white overflow-hidden select-none flex flex-col items-center justify-center ${className}`}
        >
            {/* Deep Ambient Midnight Indigo Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[950px] h-[600px] bg-indigo-600/12 rounded-full blur-[180px] pointer-events-none -z-10" />
            <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[500px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />
            <div className="absolute top-1/3 left-1/5 w-[500px] h-[400px] bg-blue-600/8 rounded-full blur-[150px] pointer-events-none -z-10" />

            {/* =========================================================================
                SECTION HEADINGS (From media_1792510270865_660a7b2f.png in Midnight Indigo)
            ========================================================================= */}
            <div className="text-center max-w-4xl mx-auto mb-14 sm:mb-16 relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-indigo-300 tracking-wide uppercase mb-5 shadow-sm backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Real-Time Contest & Hackathon Radar</span>
                </div>

                <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.12]">
                    Every contest,
                    <br />
                    <span className="inline-block mt-3 bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white px-5 sm:px-8 py-1.5 sm:py-2.5 rounded-2xl font-black -rotate-1 shadow-[0_10px_35px_rgba(79,70,229,0.38)] border border-indigo-400/40">
                        one calendar
                    </span>
                </h2>

                <p className="text-slate-400 text-sm sm:text-base md:text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
                    Codeforces, LeetCode, CodeChef, AtCoder and GfG rounds, read live from each site, plus open hackathons. Tap the bell and we'll remind you.
                </p>
            </div>

            {/* =========================================================================
                THE EVENT TRACKER SHOWCASE CONTAINER (Re-rendered in Midnight Indigo)
            ========================================================================= */}
            <div className="w-full rounded-3xl   p-4 sm:p-7 relative z-10 space-y-6">
                {/* 1. Header Row */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-900/30">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                Event Tracker
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 font-medium">
                            Every round on Codeforces, LeetCode, CodeChef, AtCoder and GfG, with reminders.
                        </p>
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-xs">
                            <span className="text-emerald-400 font-black">12 contests</span>
                            <span className="text-slate-300 font-semibold">in the next 7 days across 9 platforms</span>
                        </div>
                    </div>

                    {/* Segmented Controls: Contests vs Hackathons & Calendar vs List */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Contests / Hackathons Toggle */}
                        <div className="inline-flex rounded-xl bg-black/60 p-1 border border-indigo-500/20">
                            <button
                                type="button"
                                onClick={() => setSelectedType("contests")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedType === "contests"
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Contests
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedType("hackathons")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedType === "hackathons"
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                Hackathons
                            </button>
                        </div>

                        {/* Calendar / List Toggle */}
                        <div className="inline-flex rounded-xl bg-black/60 p-1 border border-indigo-500/20">
                            <button
                                type="button"
                                onClick={() => setViewMode("calendar")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === "calendar"
                                    ? "bg-white text-slate-950 shadow-md font-black"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                <CalendarIcon className="w-3.5 h-3.5" />
                                <span>Calendar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${viewMode === "list"
                                    ? "bg-white text-slate-950 shadow-md font-black"
                                    : "text-slate-400 hover:text-white"
                                    }`}
                            >
                                <ListIcon className="w-3.5 h-3.5" />
                                <span>List</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* 2. Hero Banner: UP NEXT Contest with Midnight Indigo Theme */}
                {activeUpNext && (
                    <section className="relative rounded-2xl bg-gradient-to-r from-[#0d1226] via-[#161a45] to-[#251756] p-5 sm:p-7 shadow-2xl shadow-indigo-950/60 text-white overflow-hidden border border-indigo-500/35">
                        {/* Background watermark icon */}
                        <div className="absolute -right-6 -bottom-8 opacity-10 pointer-events-none scale-150 transform rotate-12">
                            {getPortalIcon(activeUpNext.platform, "w-52 h-52 text-indigo-400")}
                        </div>

                        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                            {/* Left details */}
                            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center flex-shrink-0 p-2.5">
                                    {getPortalIcon(activeUpNext.platform, "w-9 h-9")}
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 rounded-md">
                                            UP NEXT · {activeUpNext.platformName}
                                        </span>
                                        {activeUpNext.rated && (
                                            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded">
                                                Rated
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate max-w-2xl">
                                        {activeUpNext.title}
                                    </h3>
                                    <p className="text-xs sm:text-sm font-semibold text-indigo-200/80 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                        <span>{formatScheduleIST(activeUpNext)}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Middle & Right: Countdown Blocks + Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 flex-shrink-0">
                                {/* Digital Countdown blocks */}
                                <div className="flex items-center gap-2 sm:gap-2.5">
                                    <div className="flex flex-col items-center">
                                        <div className="bg-[#070a14] border border-indigo-500/30 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner shadow-black/80 min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.days}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-indigo-300/80 uppercase mt-1">
                                            DAYS
                                        </span>
                                    </div>
                                    <span className="text-indigo-400/60 font-bold text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-[#070a14] border border-indigo-500/30 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner shadow-black/80 min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.hours}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-indigo-300/80 uppercase mt-1">
                                            HRS
                                        </span>
                                    </div>
                                    <span className="text-indigo-400/60 font-bold text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-[#070a14] border border-indigo-500/30 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner shadow-black/80 min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.minutes}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-indigo-300/80 uppercase mt-1">
                                            MIN
                                        </span>
                                    </div>
                                    <span className="text-indigo-400/60 font-bold text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-[#070a14] border border-indigo-500/30 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl shadow-inner shadow-black/80 min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.seconds}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-indigo-300/80 uppercase mt-1">
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
                                        className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${reminders.includes(activeUpNext.id)
                                            ? "bg-indigo-600 text-white ring-2 ring-indigo-400/50 shadow-indigo-600/30"
                                            : "bg-white text-slate-950 hover:bg-slate-100"
                                            }`}
                                    >
                                        {reminders.includes(activeUpNext.id) ? (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
                                                <span>Reminded</span>
                                            </>
                                        ) : (
                                            <>
                                                <Bell className="w-4 h-4 text-slate-900" />
                                                <span>Remind me</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Add to Calendar button with popup */}
                                    <div className="relative" ref={calDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenCalDropdownId(openCalDropdownId === activeUpNext.id ? null : activeUpNext.id)}
                                            className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-sm backdrop-blur-md cursor-pointer"
                                            title="Add to Google or Apple Calendar"
                                        >
                                            <CalendarPlus className="w-4 h-4 text-indigo-300" />
                                            <span>Add to calendar</span>
                                        </button>

                                        {openCalDropdownId === activeUpNext.id && (
                                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[#0e1424] border border-indigo-500/30 shadow-2xl z-40 p-1.5 text-white animate-in fade-in zoom-in-95">
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
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/10 flex items-center gap-2 transition cursor-pointer"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
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
                                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 flex items-center justify-center transition shadow-sm cursor-pointer"
                                        title="Open Contest Page"
                                    >
                                        <ExternalLink className="w-4 h-4 text-slate-200" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 3. Platform Filter Chips Bar */}
                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 overflow-x-auto p-1.5 scrollbar-none max-w-full">
                            {/* "All" reset chip */}
                            <button
                                type="button"
                                onClick={() => setSelectedPlatform(null)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 border cursor-pointer ${selectedPlatform === null
                                    ? "bg-white text-slate-950 border-white shadow-md font-black"
                                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20"
                                    }`}
                            >
                                All Platforms
                            </button>

                            {/* Individual Platform Chips */}
                            {ALL_FILTER_PLATFORMS.map((plat) => {
                                const count = activeCounts[plat.id] || 0;
                                const isSelected = selectedPlatform === plat.id;

                                return (
                                    <button
                                        key={plat.id}
                                        type="button"
                                        onClick={() => setSelectedPlatform(plat.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-2 flex-shrink-0 border cursor-pointer ${isSelected
                                            ? "bg-indigo-600 text-white font-black border-indigo-500 shadow-md shadow-indigo-600/30"
                                            : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20 font-medium"
                                            }`}
                                    >
                                        <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                            {getPortalIcon(plat.id, "w-3.5 h-3.5")}
                                        </div>
                                        <span>{plat.name}</span>
                                        <span
                                            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${isSelected
                                                ? "bg-white/20 text-white"
                                                : "bg-white/10 text-slate-400"
                                                }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <span className="text-[11px] font-medium text-slate-500 flex-shrink-0 ml-auto">
                            Counts are for October. All times IST.
                        </span>
                    </div>
                </section>

                {/* 4. Unified Black & Midnight Indigo Contest Scheduler (Calendar or List View) */}
                <section className="rounded-2xl sm:rounded-3xl bg-[#060811] border border-indigo-950/60 shadow-2xl text-white ring-1 ring-white/10 overflow-hidden">
                    <div className="p-4 sm:p-6 space-y-4">
                        {viewMode === "calendar" ? (
                            <>
                                {/* Month Navigator Header */}
                                <div className="flex items-center justify-between gap-4 pb-2 border-b border-indigo-900/30">
                                    <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                                        {monthLabel} <span className="text-slate-400 font-normal">{viewYear}</span>
                                    </h4>

                                    {/* Month Navigation Controls */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleResetToday}
                                            className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/15 transition cursor-pointer"
                                        >
                                            Today
                                        </button>

                                        <div className="flex items-center rounded-lg bg-black/60 border border-indigo-500/25 p-0.5">
                                            <button
                                                type="button"
                                                onClick={handlePrevMonth}
                                                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                                title="Previous month"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleNextMonth}
                                                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                                title="Next month"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Calendar 7-Column Days Grid */}
                                <div className="border border-indigo-950/80 rounded-xl overflow-hidden bg-black shadow-inner">
                                    {/* Days of week header */}
                                    <div className="grid grid-cols-7 border-b border-indigo-950/80 bg-[#090d18]">
                                        {DAY_NAMES.map((name) => (
                                            <div
                                                key={name}
                                                className="py-2.5 text-center text-[11px] font-bold tracking-wider text-slate-400 uppercase"
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Days Matrix */}
                                    <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-indigo-950/60 bg-black">
                                        {calendarCells.map((cell, idx) => {
                                            const maxVisible = 2;
                                            const visibleEvents = cell.events.slice(0, maxVisible);
                                            const extraCount = cell.events.length - maxVisible;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`min-h-[115px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${cell.isCurrentMonth
                                                        ? cell.isToday
                                                            ? "bg-indigo-950/40 text-white shadow-lg ring-1 ring-indigo-500/50"
                                                            : "bg-black hover:bg-indigo-950/20"
                                                        : "bg-black/60 opacity-20 pointer-events-none"
                                                        }`}
                                                >
                                                    {/* Cell Date Header */}
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        {cell.isToday ? (
                                                            <span className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                                                                {cell.dayNum} Today
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-slate-400 pl-0.5">
                                                                {cell.dayNum}
                                                            </span>
                                                        )}

                                                        {cell.events.length > 0 && (
                                                            <span className={`text-[10px] font-mono ${cell.isToday ? "text-indigo-300 font-bold" : "text-slate-500"}`}>
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
                                                                    className="group/pill flex items-center gap-1.5 p-1 sm:p-1.5 rounded-lg border border-indigo-900/50 bg-[#0d1222] hover:bg-indigo-950/60 transition cursor-pointer text-left shadow-sm"
                                                                    title={`${ev.title} on ${ev.platformName} (${timeStr} IST)`}
                                                                >
                                                                    <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                                        {getPortalIcon(ev.platform, "w-3.5 h-3.5")}
                                                                    </div>
                                                                    <span className="text-[10px] sm:text-[11px] font-mono font-bold flex-shrink-0 text-indigo-300">
                                                                        {timeStr}
                                                                    </span>
                                                                    <span className="text-[10px] sm:text-[11px] truncate font-semibold text-slate-200">
                                                                        {ev.title}
                                                                    </span>
                                                                    {isReminded && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-auto flex-shrink-0" />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                        {/* More indicator */}
                                                        {extraCount > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedDayEvents({ date: cell.dateStr, events: cell.events })}
                                                                className="w-full text-left pl-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
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
                                <div className="flex items-center justify-between gap-3 border-b border-indigo-900/30 pb-3">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xl font-bold tracking-tight text-white">
                                            All {selectedType === "contests" ? "Contests" : "Hackathons"} ({filteredEvents.length})
                                        </h4>
                                        {groupedDateEvents.length > 0 && (
                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-mono">
                                                {groupedDateEvents.length} Days
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        Sorted by Start Time
                                    </span>
                                </div>

                                {groupedDateEvents.length === 0 ? (
                                    <div className="py-16 text-center rounded-2xl bg-neutral-950 border border-neutral-800 p-8">
                                        <CalendarIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                        <h5 className="text-base font-bold text-white mb-1">No contests found</h5>
                                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                            There are no scheduled contests matching your current platform filter.
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
                                                        <div
                                                            className={`w-full h-full min-h-[90px] rounded-2xl p-2 sm:p-3 text-center border transition-all duration-200 flex flex-col items-center justify-center shadow-sm ${group.isToday
                                                                ? "bg-indigo-950/60 text-white border-indigo-400/50 shadow-[0_0_24px_rgba(99,102,241,0.2)]"
                                                                : group.hasLive
                                                                    ? "bg-[#0f1424] text-white border-rose-500/40 shadow-[0_0_16px_rgba(244,63,94,0.12)]"
                                                                    : group.allFinished
                                                                        ? "bg-[#090d18]/70 text-slate-400 border-indigo-950/40"
                                                                        : "bg-[#0b1020]/90 text-white border-indigo-900/40"
                                                                }`}
                                                        >
                                                            {/* Day of Week */}
                                                            <span
                                                                className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest ${group.isToday ? "text-indigo-300" : group.hasLive ? "text-rose-400" : "text-slate-400"
                                                                    }`}
                                                            >
                                                                {group.weekdayShort}
                                                            </span>

                                                            {/* Day Number */}
                                                            <span
                                                                className={`text-2xl sm:text-3xl md:text-4xl font-black font-mono leading-none tracking-tight my-1 ${group.isToday ? "text-white" : "text-white"
                                                                    }`}
                                                            >
                                                                {group.dayNum}
                                                            </span>

                                                            {/* Month & Year */}
                                                            <span
                                                                className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider ${group.isToday ? "text-indigo-200" : "text-slate-400"
                                                                    }`}
                                                            >
                                                                {group.monthShort}
                                                            </span>

                                                            {/* Context Badges */}
                                                            <div className="mt-1.5 flex flex-col items-center gap-1 w-full">
                                                                {group.isToday && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-sm">
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
                                                                        className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold tracking-tight whitespace-nowrap ${group.isToday
                                                                            ? "bg-indigo-900/60 text-indigo-200"
                                                                            : "bg-white/5 text-slate-400 border border-white/5"
                                                                            }`}
                                                                    >
                                                                        {group.events.length} Contests
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
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
                                                                    className="p-3.5 rounded-xl bg-[#0c101e] border border-indigo-900/40 hover:border-indigo-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm group/card"
                                                                >
                                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 p-2">
                                                                            {getPortalIcon(ev.platform, "w-6 h-6")}
                                                                        </div>
                                                                        <div className="min-w-0 space-y-0.5">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                                    {ev.platformName}
                                                                                </span>
                                                                                {ev.division && (
                                                                                    <span className="text-[10px] font-medium text-blue-300 bg-blue-500/15 border border-blue-500/25 px-1.5 py-0.2 rounded">
                                                                                        {ev.division}
                                                                                    </span>
                                                                                )}
                                                                                {ev.rated && (
                                                                                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                                                                        Rated
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h5 className="text-sm font-bold text-white truncate max-w-xl">
                                                                                {ev.title}
                                                                            </h5>
                                                                            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                                                                <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                                                <span className="font-mono text-slate-300 font-medium">
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
                                                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-400 bg-white/5 border border-white/5">
                                                                                Finished
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs font-mono text-indigo-300">
                                                                                {formatRelativeCountdown(ev.startTimestamp, nowMs)}
                                                                            </span>
                                                                        )}

                                                                        {/* Remind button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleToggleReminder(ev.id, e)}
                                                                            className={`p-2 rounded-lg transition border cursor-pointer ${isReminded
                                                                                ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                                                                                : "bg-white/5 text-slate-400 hover:text-white border-white/10 hover:border-white/20"
                                                                                }`}
                                                                            title={isReminded ? "Reminder enabled" : "Set reminder"}
                                                                        >
                                                                            <Bell className="w-4 h-4" />
                                                                        </button>

                                                                        {/* Add to Calendar button */}
                                                                        <div className="relative">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setOpenCalDropdownId(openCalDropdownId === `list-${ev.id}` ? null : `list-${ev.id}`)}
                                                                                className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition cursor-pointer"
                                                                                title="Add to Calendar"
                                                                            >
                                                                                <CalendarPlus className="w-4 h-4" />
                                                                            </button>

                                                                            {openCalDropdownId === `list-${ev.id}` && (
                                                                                <div className="absolute right-0 top-full mt-2 w-44 rounded-xl bg-[#0e1424] border border-indigo-500/30 shadow-2xl z-40 p-1.5 text-white animate-in fade-in zoom-in-95">
                                                                                    <a
                                                                                        href={createGoogleCalendarUrl(ev)}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        onClick={() => setOpenCalDropdownId(null)}
                                                                                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 flex items-center gap-2 transition"
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
                                                                                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 flex items-center gap-2 transition cursor-pointer"
                                                                                    >
                                                                                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                                                                                        .ics
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* External Link button */}
                                                                        <a
                                                                            href={ev.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition cursor-pointer"
                                                                            title="Open Contest Page"
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
                </section>
            </div>

            {/* Modal for Day Contests */}
            {selectedDayEvents && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
                    onClick={() => setSelectedDayEvents(null)}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl bg-[#0e1424] border border-indigo-500/30 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
                            <div>
                                <h4 className="text-lg font-bold text-white">
                                    Contests on {selectedDayEvents.date}
                                </h4>
                                <span className="text-xs text-indigo-300">
                                    {selectedDayEvents.events.length} contest{selectedDayEvents.events.length > 1 ? "s" : ""} scheduled
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDayEvents(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {selectedDayEvents.events.map((ev) => (
                                <div
                                    key={ev.id}
                                    className="p-3 rounded-xl bg-black/40 border border-indigo-900/40 flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1.5 flex-shrink-0">
                                            {getPortalIcon(ev.platform, "w-5 h-5")}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                {ev.platformName}
                                            </span>
                                            <h5 className="text-xs font-bold text-white truncate max-w-xs">
                                                {ev.title}
                                            </h5>
                                            <span className="text-[11px] font-mono text-indigo-300">
                                                {formatTimeRangeIST(ev)}
                                            </span>
                                        </div>
                                    </div>
                                    <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition flex-shrink-0"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default Events;
