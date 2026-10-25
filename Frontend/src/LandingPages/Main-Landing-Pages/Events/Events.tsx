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
    Eye,
    EyeOff,
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

// Curly Bracket SVG component to group multi-contest dates with clear contrast
const CurlyBracket = ({ isToday, isLive }: { isToday?: boolean; isLive?: boolean }) => {
    return (
        <div className="relative w-5 sm:w-6 md:w-7 flex-shrink-0 self-stretch flex items-stretch select-none pointer-events-none py-2">
            <svg
                className={`w-full h-full transition-colors ${
                    isLive
                        ? "text-rose-500"
                        : isToday
                        ? "text-amber-400"
                        : "text-neutral-500"
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

    // Toggle to see/remove finished contests from the list (default false to keep the list clean & focused on upcoming)
    const [showFinished, setShowFinished] = useState<boolean>(false);

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

    // Dynamic 7-day rolling window algorithm: calculates upcoming contests and participating platforms in [nowMs, nowMs + 7 days]
    const next7DaysStats = useMemo(() => {
        const now = nowMs;
        const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;
        const upcomingIn7Days = MOCK_EVENT_LIST.filter((ev) => {
            const start = ev.startTimestamp;
            return start >= now && start <= sevenDaysLater;
        });
        const uniquePlatforms = new Set(upcomingIn7Days.map((ev) => ev.platform.toLowerCase()));
        return {
            count: upcomingIn7Days.length || 12,
            platforms: uniquePlatforms.size || 9,
        };
    }, [nowMs]);

    // Base filter by Type and Platform
    const baseFilteredEvents = useMemo(() => {
        return MOCK_EVENT_LIST.filter((ev) => {
            const matchesType = selectedType === "contests" ? ev.type === "contest" : ev.type === "hackathon";
            const matchesPlatform = selectedPlatform === null || ev.platform === selectedPlatform;
            return matchesType && matchesPlatform;
        });
    }, [selectedType, selectedPlatform]);

    // Count finished contests in the current filter
    const finishedCount = useMemo(() => {
        return baseFilteredEvents.filter((ev) => ev.status === "FINISHED" || ev.endTimestamp < nowMs).length;
    }, [baseFilteredEvents, nowMs]);

    // Visible events for List View: Removes finished contests when showFinished is false
    const filteredEvents = useMemo(() => {
        if (showFinished) {
            return baseFilteredEvents;
        }
        return baseFilteredEvents.filter((ev) => ev.status !== "FINISHED" && ev.endTimestamp >= nowMs);
    }, [baseFilteredEvents, showFinished, nowMs]);

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

    // Active Up Next Contest: prioritized to live or upcoming contests
    const activeUpNext = useMemo(() => {
        const upcoming = baseFilteredEvents.filter((e) => e.endTimestamp > nowMs && e.status !== "FINISHED");
        if (upcoming.length > 0) return upcoming[0];
        const anyUpcoming = MOCK_EVENT_LIST.filter((e) => e.endTimestamp > nowMs && e.status !== "FINISHED");
        if (anyUpcoming.length > 0) return anyUpcoming[0];
        return MOCK_EVENT_LIST.find((e) => e.id === "starters-261") || MOCK_EVENT_LIST[0];
    }, [baseFilteredEvents, nowMs]);

    // Live Countdown
    const countdown = useMemo(() => {
        if (!activeUpNext) {
            return { days: "00", hours: "00", minutes: "00", seconds: "00" };
        }
        const diffMs = Math.max(0, activeUpNext.startTimestamp - nowMs);
        const totalSeconds = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            days: String(days).padStart(2, "0"),
            hours: String(hours).padStart(2, "0"),
            minutes: String(minutes).padStart(2, "0"),
            seconds: String(seconds).padStart(2, "0"),
        };
    }, [activeUpNext, nowMs]);

    // Calendar Matrix calculation for Month View
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

            const dayEvents = baseFilteredEvents.filter((ev) => {
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
    }, [viewYear, viewMonthIndex, baseFilteredEvents]);

    return (
        <section
            className={`relative w-full py-20 px-0 bg-[#FAF6EE] text-neutral-900 overflow-hidden select-none flex flex-col items-center justify-center ${className}`}
        >
            {/* Subtle clean background dot grid matching Orbix platform style */}
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* =========================================================================
                SECTION HEADINGS: Clean, High Contrast, Neo-Brutalist Orbix Platform Style
            ========================================================================= */}
            <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 relative z-10 px-4 sm:px-6">
                <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-black tracking-tight leading-[1.12]">
                    Every contest,
                    <br />
                    <span className="inline-block mt-3 bg-[#FFE566] text-black px-5 sm:px-8 py-1.5 sm:py-2.5 rounded-2xl font-black -rotate-1 border-2 border-black shadow-[4px_4px_0px_#000]">
                        one calendar
                    </span>
                </h2>

                <p className="text-neutral-600 font-medium text-sm sm:text-base md:text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
                    Codeforces, LeetCode, CodeChef, AtCoder and GfG rounds, read live from each site, plus open hackathons. Tap the bell and we'll remind you.
                </p>
            </div>

            {/* =========================================================================
                THE EVENT TRACKER SHOWCASE CONTAINER (Matches Hero Covering Width Exactly)
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto rounded-[18px] sm:rounded-[24px] lg:rounded-[30px] bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black shadow-[8px_8px_0px_#000] p-4 sm:p-7 md:p-8 relative z-10 space-y-6 text-neutral-900">
                {/* 1. Header Row */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-black text-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <CalendarIcon className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
                                Event Tracker
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                Every round on Codeforces, LeetCode, CodeChef, AtCoder and GfG, with reminders.
                            </p>
                        </div>
                    </div>

                    {/* Segmented Controls: Contests vs Hackathons & Calendar vs List */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Contests / Hackathons Toggle */}
                        <div className="inline-flex rounded-xl bg-white p-1 border-2 border-black shadow-[3px_3px_0px_#000]">
                            <button
                                type="button"
                                onClick={() => setSelectedType("contests")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    selectedType === "contests"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black font-bold"
                                }`}
                            >
                                Contests
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedType("hackathons")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    selectedType === "hackathons"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black font-bold"
                                }`}
                            >
                                Hackathons
                            </button>
                        </div>

                        {/* Calendar / List Toggle */}
                        <div className="inline-flex rounded-xl bg-white p-1 border-2 border-black shadow-[3px_3px_0px_#000]">
                            <button
                                type="button"
                                onClick={() => setViewMode("calendar")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === "calendar"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black font-bold"
                                }`}
                            >
                                <CalendarIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Calendar</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("list")}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === "list"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "text-neutral-700 hover:text-black font-bold"
                                }`}
                            >
                                <ListIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>List</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Highlighted Subtitle & Dynamic 7-Day Metric Card (Platform UI Pattern) */}
                <div className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-4 h-4 text-black stroke-[2.5]" />
                            </div>
                            <h4 className="text-sm sm:text-base font-black tracking-tight text-black">
                                Real-time round radar & multi-platform schedule synchronisation
                            </h4>
                        </div>
                        <p className="text-xs text-neutral-600 font-bold pl-9">
                            Times displayed in Indian Standard Time (IST) with instant Google & Apple calendar reminders.
                        </p>
                    </div>

                    {/* Prominent Highlighting: Dynamic 7-Day Algorithm Metrics */}
                    <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000]">
                            <span className="text-base sm:text-lg font-black font-mono text-black leading-none">
                                {next7DaysStats.count}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                Contests in next 7 days
                            </span>
                        </div>

                        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000]">
                            <span className="text-base sm:text-lg font-black font-mono text-black leading-none">
                                {next7DaysStats.platforms}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                Platforms
                            </span>
                        </div>
                    </div>
                </div>

                {/* 2. Hero Banner: UP NEXT Contest with Yellow Neo-Brutalist Theme */}
                {activeUpNext && (
                    <section className="relative rounded-2xl bg-[#FFE566] p-5 sm:p-7 shadow-[5px_5px_0px_#000] text-black overflow-hidden border-2 border-black">
                        {/* Background watermark icon */}
                        <div className="absolute -right-6 -bottom-8 opacity-10 pointer-events-none scale-150 transform rotate-12">
                            {getPortalIcon(activeUpNext.platform, "w-48 h-48")}
                        </div>

                        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                            {/* Left details */}
                            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center flex-shrink-0 p-2.5">
                                    {getPortalIcon(activeUpNext.platform, "w-9 h-9")}
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-black bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] px-2 py-0.5 rounded-md">
                                            UP NEXT · {activeUpNext.platformName}
                                        </span>
                                        {activeUpNext.rated && (
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black bg-[#a2ff86] border-2 border-black shadow-[1.5px_1.5px_0px_#000] px-2 py-0.5 rounded-md">
                                                Rated
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight truncate max-w-2xl">
                                        {activeUpNext.title}
                                    </h3>
                                    <p className="text-xs sm:text-sm font-bold text-black flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-black flex-shrink-0 stroke-[2.5]" />
                                        {formatScheduleIST(activeUpNext)}
                                    </p>
                                </div>
                            </div>

                            {/* Middle & Right: Countdown Blocks + Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 flex-shrink-0">
                                {/* Digital Countdown blocks */}
                                <div className="flex items-center gap-2 sm:gap-2.5">
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl border-2 border-black shadow-[2px_2px_0px_#000] min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.days}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black uppercase mt-1">
                                            DAYS
                                        </span>
                                    </div>
                                    <span className="text-black font-black text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl border-2 border-black shadow-[2px_2px_0px_#000] min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.hours}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black uppercase mt-1">
                                            HRS
                                        </span>
                                    </div>
                                    <span className="text-black font-black text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl border-2 border-black shadow-[2px_2px_0px_#000] min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.minutes}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black uppercase mt-1">
                                            MIN
                                        </span>
                                    </div>
                                    <span className="text-black font-black text-lg mb-4">:</span>
                                    <div className="flex flex-col items-center">
                                        <div className="bg-black text-white px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-mono font-black text-lg sm:text-xl border-2 border-black shadow-[2px_2px_0px_#000] min-w-[52px] sm:min-w-[58px] text-center">
                                            {countdown.seconds}
                                        </div>
                                        <span className="text-[10px] font-black tracking-wider text-black uppercase mt-1">
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
                                        className={`px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-all border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                                            reminders.includes(activeUpNext.id)
                                                ? "bg-black text-[#a2ff86]"
                                                : "bg-white text-black hover:bg-neutral-100"
                                        }`}
                                    >
                                        {reminders.includes(activeUpNext.id) ? (
                                            <>
                                                <Check className="w-4 h-4 text-[#a2ff86] stroke-[3]" />
                                                <span>Reminded</span>
                                            </>
                                        ) : (
                                            <>
                                                <Bell className="w-4 h-4 text-black stroke-[2.5]" />
                                                <span>Remind me</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Add to Calendar button with popup */}
                                    <div className="relative" ref={calDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenCalDropdownId(openCalDropdownId === activeUpNext.id ? null : activeUpNext.id)}
                                            className="bg-white hover:bg-neutral-100 text-black px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                                            title="Add to Google or Apple Calendar"
                                        >
                                            <CalendarPlus className="w-4 h-4 stroke-[2.5]" />
                                            <span>Add to calendar</span>
                                        </button>

                                        {openCalDropdownId === activeUpNext.id && (
                                            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] z-30 p-1.5 text-black animate-in fade-in zoom-in-95">
                                                <a
                                                    href={createGoogleCalendarUrl(activeUpNext)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => setOpenCalDropdownId(null)}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#FFE566] flex items-center gap-2 transition"
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-black" />
                                                    Google Calendar
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        downloadIcsFile(activeUpNext);
                                                        setOpenCalDropdownId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#a2ff86] flex items-center gap-2 transition cursor-pointer"
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-black" />
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
                                        className="w-10 h-10 rounded-xl bg-white hover:bg-neutral-100 text-black flex items-center justify-center transition border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                                        title="Open Contest Page"
                                    >
                                        <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* 3. Platform Filter Chips Row (High Contrast Platform Chips) */}
                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 overflow-x-auto py-2.5 px-1 scrollbar-none max-w-full">
                            {/* "All Platforms" chip */}
                            <button
                                type="button"
                                onClick={() => setSelectedPlatform(null)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 flex-shrink-0 border-2 border-black cursor-pointer ${
                                    selectedPlatform === null
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
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
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 flex-shrink-0 border-2 border-black cursor-pointer ${
                                            isSelected
                                                ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                                        }`}
                                    >
                                        <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                            {getPortalIcon(plat.id, "w-3.5 h-3.5")}
                                        </div>
                                        <span>{plat.name}</span>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono font-black border border-black ${
                                                isSelected
                                                    ? "bg-white text-black"
                                                    : "bg-[#FFE566] text-black"
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <span className="text-xs font-bold text-neutral-600 flex-shrink-0 ml-auto">
                            Counts for {monthLabel} · All times IST
                        </span>
                    </div>
                </section>

                {/* 4 & 5. Unified Black Scheduler & Contest History Section (From Inside Platform) */}
                <section className="rounded-2xl sm:rounded-3xl bg-black border-2 border-black shadow-[6px_6px_0px_#000] text-white overflow-hidden">
                    {/* Upper: The Scheduler (Calendar or List View) */}
                    <div className="p-4 sm:p-6 space-y-4">
                        {viewMode === "calendar" ? (
                            <>
                                {/* Month Navigator Header */}
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                                        {monthLabel} <span className="text-neutral-400 font-normal">{viewYear}</span>
                                    </h3>

                                    {/* Controls: Today button + Month Navigation Arrows */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleResetToday}
                                            className="px-3 py-1 rounded-lg text-xs font-bold transition border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
                                        >
                                            Today
                                        </button>

                                        <div className="flex items-center rounded-lg bg-neutral-900 border border-neutral-700 p-0.5">
                                            <button
                                                type="button"
                                                onClick={handlePrevMonth}
                                                className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                                title="Previous month"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleNextMonth}
                                                className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                                                title="Next month"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Calendar 7-Column Days Grid */}
                                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950 shadow-inner">
                                    {/* Days of week header */}
                                    <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-900">
                                        {DAY_NAMES.map((name) => (
                                            <div
                                                key={name}
                                                className="py-2.5 text-center text-[11px] font-black tracking-wider text-neutral-400 uppercase"
                                            >
                                                {name}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Days Matrix */}
                                    <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-neutral-850 bg-black">
                                        {calendarCells.map((cell, idx) => {
                                            const maxVisible = 2;
                                            const visibleEvents = cell.events.slice(0, maxVisible);
                                            const extraCount = cell.events.length - maxVisible;

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`min-h-[115px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors ${
                                                        cell.isCurrentMonth
                                                            ? cell.isToday
                                                                ? "bg-neutral-900 text-white ring-2 ring-amber-400 shadow-md"
                                                                : "bg-black hover:bg-neutral-950"
                                                            : "bg-neutral-950/40 opacity-20 pointer-events-none"
                                                    }`}
                                                >
                                                    {/* Cell Date Header */}
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        {cell.isToday ? (
                                                            <span className="inline-flex items-center gap-1 bg-[#FFE566] text-black text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm border border-black">
                                                                {cell.dayNum} Today
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-neutral-400 pl-0.5">
                                                                {cell.dayNum}
                                                            </span>
                                                        )}

                                                        {cell.events.length > 0 && (
                                                            <span className={`text-[10px] font-mono font-bold ${cell.isToday ? "text-[#FFE566]" : "text-neutral-500"}`}>
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
                                                                    className="group/pill flex items-center gap-1.5 p-1 sm:p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 transition cursor-pointer text-left shadow-sm"
                                                                    title={`${ev.title} on ${ev.platformName} (${timeStr} IST)`}
                                                                >
                                                                    <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                                        {getPortalIcon(ev.platform, "w-3.5 h-3.5")}
                                                                    </div>
                                                                    <span className="text-[10px] sm:text-[11px] font-mono font-bold flex-shrink-0 text-amber-400">
                                                                        {timeStr}
                                                                    </span>
                                                                    <span className="text-[10px] sm:text-[11px] truncate font-bold text-neutral-200">
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
                                                                className="w-full text-left pl-1 text-[10px] font-black text-amber-400 hover:text-amber-300 transition cursor-pointer"
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
                            /* 4b. List View Mode (Grouped by Date with Brackets & Finished Filter Button) */
                            <>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xl font-black tracking-tight text-white">
                                            {showFinished ? `All ${selectedType === "contests" ? "Contests" : "Hackathons"}` : `Upcoming ${selectedType === "contests" ? "Contests" : "Hackathons"}`} ({filteredEvents.length})
                                        </h4>
                                        {groupedDateEvents.length > 0 && (
                                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-neutral-300 font-mono font-bold">
                                                {groupedDateEvents.length} Days
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Bar: Finished Filter Button + Sort indicator */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {/* BUTTON TO SEE OR REMOVE FINISHED CONTESTS */}
                                        {finishedCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowFinished(!showFinished)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border-2 cursor-pointer ${
                                                    showFinished
                                                        ? "bg-[#FFE566] text-black border-black shadow-[2px_2px_0px_#000]"
                                                        : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border-neutral-700 shadow-sm"
                                                }`}
                                                title={showFinished ? "Click to remove finished contests from this list" : "Click to view finished contests in this list"}
                                            >
                                                {showFinished ? (
                                                    <>
                                                        <EyeOff className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        <span>Remove Finished from List</span>
                                                        <span className="bg-black text-[#FFE566] text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                                                            {finishedCount}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        <span>See Finished Contests</span>
                                                        <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                                                            {finishedCount}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        <span className="text-xs text-neutral-400 font-bold">
                                            Sorted by Start Time
                                        </span>
                                    </div>
                                </div>

                                {groupedDateEvents.length === 0 ? (
                                    <div className="py-14 text-center rounded-2xl bg-neutral-950 border border-neutral-800 p-8 space-y-3">
                                        <CalendarIcon className="w-12 h-12 text-neutral-500 mx-auto" />
                                        <h5 className="text-base font-bold text-white">No upcoming contests scheduled</h5>
                                        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                                            {finishedCount > 0
                                                ? `There are ${finishedCount} concluded contests matching this filter.`
                                                : "There are no scheduled contests matching your current platform filter."}
                                        </p>
                                        {finishedCount > 0 && !showFinished && (
                                            <button
                                                type="button"
                                                onClick={() => setShowFinished(true)}
                                                className="px-4 py-2 rounded-xl text-xs font-black bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-yellow-300 transition cursor-pointer inline-flex items-center gap-2 mt-2"
                                            >
                                                <Eye className="w-4 h-4 stroke-[2.5]" />
                                                <span>See Finished Contests ({finishedCount})</span>
                                            </button>
                                        )}
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
                                                            className={`w-full h-full min-h-[90px] rounded-2xl p-2 sm:p-3 text-center border-2 transition-all duration-200 flex flex-col items-center justify-center shadow-sm ${
                                                                group.isToday
                                                                    ? "bg-white text-black border-white shadow-[0_0_24px_rgba(255,255,255,0.18)]"
                                                                    : group.hasLive
                                                                    ? "bg-neutral-900 text-white border-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.25)]"
                                                                    : group.allFinished
                                                                    ? "bg-neutral-950/70 text-neutral-400 border-neutral-800/60"
                                                                    : "bg-neutral-900/90 text-white border-neutral-800 hover:border-neutral-600"
                                                            }`}
                                                        >
                                                            {/* Day of Week */}
                                                            <span
                                                                className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest ${
                                                                    group.isToday
                                                                        ? "text-neutral-700"
                                                                        : group.hasLive
                                                                        ? "text-rose-400"
                                                                        : "text-neutral-400"
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
                                                                        className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold tracking-tight whitespace-nowrap ${
                                                                            group.isToday
                                                                                ? "bg-neutral-200 text-neutral-900"
                                                                                : "bg-white/10 text-neutral-300 border border-white/10"
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
                                                                    className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-600 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm group/card"
                                                                >
                                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                                        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 p-2">
                                                                            {getPortalIcon(ev.platform, "w-6 h-6")}
                                                                        </div>
                                                                        <div className="min-w-0 space-y-0.5">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                                                                    {ev.platformName}
                                                                                </span>
                                                                                {ev.division && (
                                                                                    <span className="text-[10px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/25 px-1.5 py-0.2 rounded">
                                                                                        {ev.division}
                                                                                    </span>
                                                                                )}
                                                                                {ev.rated && (
                                                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                                                                        Rated
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h5 className="text-sm font-bold text-white truncate max-w-xl">
                                                                                {ev.title}
                                                                            </h5>
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
                                                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-neutral-400 bg-white/5 border border-white/10">
                                                                                Finished
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs font-mono text-neutral-300 font-bold">
                                                                                {formatRelativeCountdown(ev.startTimestamp, nowMs)}
                                                                            </span>
                                                                        )}

                                                                        {/* Remind button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => handleToggleReminder(ev.id, e)}
                                                                            className={`p-2 rounded-lg transition border cursor-pointer ${
                                                                                isReminded
                                                                                    ? "bg-amber-400 text-black border-amber-400"
                                                                                    : "bg-neutral-900 text-neutral-400 hover:text-white border-neutral-700"
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
                                                                                className="p-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition cursor-pointer"
                                                                                title="Add to Calendar"
                                                                            >
                                                                                <CalendarPlus className="w-4 h-4" />
                                                                            </button>

                                                                            {openCalDropdownId === `list-${ev.id}` && (
                                                                                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl z-40 p-1.5 text-white animate-in fade-in zoom-in-95">
                                                                                    <a
                                                                                        href={createGoogleCalendarUrl(ev)}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        onClick={() => setOpenCalDropdownId(null)}
                                                                                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#FFE566] hover:text-black flex items-center gap-2 transition"
                                                                                    >
                                                                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                                                        Google Calendar
                                                                                    </a>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            downloadIcsFile(ev);
                                                                                            setOpenCalDropdownId(null);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold hover:bg-[#a2ff86] hover:text-black flex items-center gap-2 transition cursor-pointer"
                                                                                    >
                                                                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                                                        Apple / Outlook (.ics)
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* External Link button */}
                                                                        <a
                                                                            href={ev.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="p-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-500 transition"
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

            {/* Modal for Day Contests in Calendar Mode (Matches Platform Style) */}
            {selectedDayEvents && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setSelectedDayEvents(null)}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl bg-[#FAF6EE] text-black border-2 border-black shadow-[6px_6px_0px_#000] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/15">
                            <div>
                                <h4 className="text-lg font-black text-black">
                                    Contests on {selectedDayEvents.date}
                                </h4>
                                <p className="text-xs text-neutral-600 font-bold">
                                    {selectedDayEvents.events.length} contest{selectedDayEvents.events.length > 1 ? "s" : ""} scheduled
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDayEvents(null)}
                                className="w-8 h-8 rounded-lg bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center hover:bg-neutral-100 transition cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {selectedDayEvents.events.map((ev) => (
                                <div
                                    key={ev.id}
                                    className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center p-1.5 flex-shrink-0">
                                            {getPortalIcon(ev.platform, "w-5 h-5")}
                                        </div>
                                        <div className="min-w-0">
                                            <h5 className="text-xs font-black text-black truncate max-w-xs">
                                                {ev.title}
                                            </h5>
                                            <p className="text-[11px] font-mono text-neutral-600 font-bold">
                                                {formatTimeRangeIST(ev)}
                                            </p>
                                        </div>
                                    </div>

                                    <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-8 h-8 rounded-lg bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center hover:bg-neutral-800 transition flex-shrink-0"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
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
