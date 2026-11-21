import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    ChevronLeft,
    ChevronRight,
    Bell,
    Check,
    CalendarPlus,
    Clock,
    ExternalLink,
    X,
} from "lucide-react";
import type { EventItem } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import { useModalDismiss } from "../../hooks/useModalDismiss";

export interface EventTrackerCalendarProps {
    /** List of events to display (filtered by type / platform) */
    events: EventItem[];
    /** Currently selected month in "YYYY-MM" format */
    selectedMonth: string;
    /** The 3 allowed months [Past, Now, Next] determined by the 3-month tracking algorithm */
    allowedMonths: string[];
    /** The current active month string in "YYYY-MM" format */
    currentMonthStr: string;
    /** Callback when user changes the active month */
    onSelectMonth: (month: string) => void;
    /** List of event IDs that have active user reminders */
    reminders?: string[];
    /** Callback to toggle event reminder */
    onToggleReminder?: (eventId: string, e?: React.MouseEvent) => void;
    /** Live timestamp in ms */
    nowMs?: number;
    /** Optional external className */
    className?: string;
    /** Optional external day click handler */
    onDayClick?: (cell: { dateStr: string; events: EventItem[] }) => void;
}

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES_FULL = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

// Format date string to "HH:MM" in IST
export const formatTimeIST = (dateString: string): string => {
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

// Format start and end times in IST: "19:00–22:00 IST · 3h"
export const formatTimeRangeIST = (event: EventItem): string => {
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

// Generate Google Calendar Link
export const createGoogleCalendarUrl = (event: EventItem): string => {
    const startIso = new Date(event.startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endIso = new Date(event.endTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`Contest on ${event.platformName}: ${event.url}`);
    const location = encodeURIComponent(event.url);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
};

// Generate .ics file download
export const downloadIcsFile = (event: EventItem) => {
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

// Helper: format day date string into human friendly format e.g. "Saturday, Oct 17, 2026"
export const formatDayTitle = (dateStr: string): string => {
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

export interface DayEventsModalData {
    date: string;
    events: EventItem[];
}

export interface EventTrackerDayEventsModalProps {
    data: DayEventsModalData | null;
    onClose: () => void;
    reminders?: string[];
    onToggleReminder?: (eventId: string, e?: React.MouseEvent) => void;
}

/**
 * Reusable Day Events Breakdown Modal with Midnight-Yellow Neo-Brutalist styling
 */
export const EventTrackerDayEventsModal: React.FC<EventTrackerDayEventsModalProps> = ({
    data,
    onClose,
    reminders = [],
    onToggleReminder,
}) => {
    const { handleBackdropClick } = useModalDismiss({
        isOpen: Boolean(data),
        onClose,
    });

    const [openCalDropdownId, setOpenCalDropdownId] = useState<string | null>(null);

    // Close calendar dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = () => setOpenCalDropdownId(null);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    if (!data || typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
            onClick={handleBackdropClick}
        >
            <div
                className="relative z-[101] w-full max-w-xl rounded-2xl sm:rounded-3xl bg-[#0e0f14] border-3 border-black p-4 sm:p-6 shadow-[8px_8px_0px_#FFE566] space-y-4 text-white ring-1 ring-white/10 animate-in zoom-in-95 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-neutral-800 pb-3 flex-shrink-0">
                    <div className="min-w-0 pr-2">
                        <h3 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
                            Contests on {formatDayTitle(data.date)}
                        </h3>
                        <p className="text-xs font-bold text-neutral-400 mt-0.5 flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#FFE566]" />
                            <span>
                                {data.events.length} round{data.events.length > 1 ? "s" : ""} scheduled
                            </span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-black hover:bg-[#FFE566] border-2 border-transparent hover:border-black transition-all cursor-pointer flex-shrink-0"
                        title="Close dialog"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>

                {/* Dynamic Contest Cards List */}
                <div className="overflow-y-auto space-y-2.5 pr-1 scrollbar-thin flex-1 min-h-0">
                    {data.events.map((ev) => {
                        const isReminded = reminders.includes(ev.id);

                        return (
                            <div
                                key={ev.id}
                                className="p-3 sm:p-3.5 rounded-2xl bg-[#14151B] border-2 border-neutral-800/90 hover:border-[#FFE566] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#000] group/card"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-black border-2 border-black flex items-center justify-center flex-shrink-0 p-2 shadow-[2px_2px_0px_#000]">
                                        {getPortalIcon(ev.platform, "w-6 h-6 object-contain")}
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                                {ev.platformName}
                                            </span>
                                            {ev.division && (
                                                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded-md">
                                                    {ev.division}
                                                </span>
                                            )}
                                            {ev.rated && (
                                                <span className="text-[10px] font-black text-black bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000] px-2 py-0.5 rounded-md">
                                                    Rated
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-xs sm:text-sm font-black text-white truncate max-w-sm sm:max-w-md group-hover/card:text-[#FFE566] transition-colors">
                                            {ev.title}
                                        </h4>
                                        <p className="text-[11px] sm:text-xs text-neutral-400 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-[#FFE566] flex-shrink-0" />
                                            <span className="font-mono text-neutral-300 font-bold">
                                                {formatTimeRangeIST(ev)}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="flex items-center gap-2 ml-auto sm:ml-0 flex-shrink-0">
                                    {/* Reminder Toggle */}
                                    {onToggleReminder && (
                                        <button
                                            type="button"
                                            onClick={(e) => onToggleReminder(ev.id, e)}
                                            className={`p-2 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 text-xs font-black ${
                                                isReminded
                                                    ? "bg-[#FFE566] text-black border-black shadow-[2px_2px_0px_#000]"
                                                    : "bg-[#1E1F26] text-neutral-300 hover:text-black hover:bg-[#FFE566] border-black shadow-[1.5px_1.5px_0px_#000]"
                                            }`}
                                            title={isReminded ? "Remove alert" : "Remind me before start"}
                                        >
                                            {isReminded ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                    <span className="hidden sm:inline">Set</span>
                                                </>
                                            ) : (
                                                <Bell className="w-3.5 h-3.5 stroke-[2.5]" />
                                            )}
                                        </button>
                                    )}

                                    {/* Add to Calendar */}
                                    <div className="relative">
                                        {openCalDropdownId === `cal-modal-${ev.id}` ? (
                                            <div className="flex items-center gap-1 bg-[#1A1B22] border-2 border-black p-1 rounded-xl shadow-[3px_3px_0px_#FFE566] animate-in fade-in zoom-in-95">
                                                <a
                                                    href={createGoogleCalendarUrl(ev)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => setOpenCalDropdownId(null)}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-black bg-neutral-800 hover:bg-[#FFE566] hover:text-black text-white flex items-center gap-1.5 transition-colors"
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
                                                    className="px-2.5 py-1 rounded-lg text-xs font-black bg-neutral-800 hover:bg-[#FFE566] hover:text-black text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                                                    title="Download .ics for Apple/Outlook"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                    .ics
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenCalDropdownId(null)}
                                                    className="p-1 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
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
                                                    setOpenCalDropdownId(`cal-modal-${ev.id}`);
                                                }}
                                                className="px-2.5 py-2 rounded-xl bg-[#1E1F26] text-neutral-200 hover:text-black hover:bg-[#FFE566] border-2 border-black shadow-[1.5px_1.5px_0px_#000] transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer"
                                                title="Add to calendar"
                                            >
                                                <CalendarPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span className="hidden sm:inline">Add to cal</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Open contest link */}
                                    <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-xl bg-[#1E1F26] text-neutral-300 hover:text-black hover:bg-[#FFE566] border-2 border-black shadow-[1.5px_1.5px_0px_#000] transition-all cursor-pointer"
                                        title="Open contest page"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>,
        document.body
    );
};

/**
 * Production-ready Event Tracker Calendar Component
 * Styled in Orbix Signature Midnight-Yellow Neo-Brutalist Theme.
 * Implements the strict 3-month rolling window (1 Past, 1 Current, 1 Next).
 * Fully responsive down to 300px mobile widths.
 */
export const EventTrackerCalendar: React.FC<EventTrackerCalendarProps> = ({
    events,
    selectedMonth,
    allowedMonths,
    currentMonthStr,
    onSelectMonth,
    reminders = [],
    onToggleReminder,
    nowMs = Date.now(),
    className = "",
    onDayClick,
}) => {
    // Active Year and Month Index from selectedMonth (or fallback to current date)
    const [viewYear, viewMonthIndex] = useMemo(() => {
        if (!selectedMonth) {
            const d = new Date();
            return [d.getFullYear(), d.getMonth()];
        }
        const [yStr, mStr] = selectedMonth.split("-");
        return [parseInt(yStr, 10), parseInt(mStr, 10) - 1];
    }, [selectedMonth]);

    const monthLabel = MONTH_NAMES[viewMonthIndex] || "Month";

    // 3-month sliding window boundaries
    const currentAllowedIdx = allowedMonths.indexOf(selectedMonth);
    const canGoPrev = currentAllowedIdx > 0;
    const canGoNext = currentAllowedIdx !== -1 && currentAllowedIdx < allowedMonths.length - 1;

    const handlePrevMonth = () => {
        if (canGoPrev) {
            onSelectMonth(allowedMonths[currentAllowedIdx - 1]);
        }
    };

    const handleNextMonth = () => {
        if (canGoNext) {
            onSelectMonth(allowedMonths[currentAllowedIdx + 1]);
        }
    };

    const handleResetToday = () => {
        if (allowedMonths.includes(currentMonthStr)) {
            onSelectMonth(currentMonthStr);
        }
    };

    // Calendar grid cells construction
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

        // Previous month calculation
        const prevDate = new Date(viewYear, viewMonthIndex - 1, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth();

        // 1. Fill previous month's trailing days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const dNum = prevMonthLastDay - i;
            const prevDateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
            const isToday = prevYear === todayYear && prevMonth === todayMonth && dNum === todayDay;

            const dayEvents = events.filter((ev) => {
                const evDate = new Date(ev.startTime);
                const evDayStr = evDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                return evDayStr === prevDateStr;
            });

            cells.push({
                dayNum: dNum,
                dateStr: prevDateStr,
                isCurrentMonth: false,
                isToday,
                events: dayEvents,
            });
        }

        // 2. Fill current month's days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const isToday = viewYear === todayYear && viewMonthIndex === todayMonth && d === todayDay;

            const dayEvents = events.filter((ev) => {
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

        // Next month calculation
        const nextDate = new Date(viewYear, viewMonthIndex + 1, 1);
        const nextYear = nextDate.getFullYear();
        const nextMonth = nextDate.getMonth();

        // 3. Fill next month's leading days
        const remaining = (7 - (cells.length % 7)) % 7;
        for (let n = 1; n <= remaining; n++) {
            const nextDateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
            const isToday = nextYear === todayYear && nextMonth === todayMonth && n === todayDay;

            const dayEvents = events.filter((ev) => {
                const evDate = new Date(ev.startTime);
                const evDayStr = evDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                return evDayStr === nextDateStr;
            });

            cells.push({
                dayNum: n,
                dateStr: nextDateStr,
                isCurrentMonth: false,
                isToday,
                events: dayEvents,
            });
        }

        return cells;
    }, [viewYear, viewMonthIndex, events]);

    // Internal modal state when user clicks on a day cell or "+N more"
    const [selectedDayEvents, setSelectedDayEvents] = useState<DayEventsModalData | null>(null);

    const handleCellClick = (cell: { dateStr: string; events: EventItem[] }) => {
        if (onDayClick) {
            onDayClick(cell);
        } else {
            setSelectedDayEvents({ date: cell.dateStr, events: cell.events });
        }
    };

    return (
        <div className={`space-y-4 select-none ${className}`}>
            {/* 1. Header Bar: Month Label, Present Badge, and 3-Month Sliding Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Month Title & Present Month Pill */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        <span>{monthLabel}</span>
                        <span className="text-[#FFE566] font-mono font-bold text-lg sm:text-xl">
                            {viewYear}
                        </span>
                    </h3>
                    {selectedMonth === currentMonthStr && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000] tracking-wide">
                            Present Month
                        </span>
                    )}
                </div>

                {/* Controls: Quick 3-Month Switcher + Today + Arrows */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Quick 3-Month Pills (Past, Now, Next) strictly matching 3-month tracking algorithm */}
                    <div className="flex items-center rounded-xl bg-[#14151B] border-2 border-black p-1 shadow-[2px_2px_0px_#000]">
                        {allowedMonths.map((mStr, idx) => {
                            const [_y, m] = mStr.split("-").map(Number);
                            const isSelected = selectedMonth === mStr;
                            const isCurr = mStr === currentMonthStr;
                            const mName = MONTH_NAMES[m - 1]?.slice(0, 3) || mStr;
                            const tag = isCurr ? "Now" : idx === 0 ? "Past" : "Next";

                            return (
                                <button
                                    key={mStr}
                                    type="button"
                                    onClick={() => onSelectMonth(mStr)}
                                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
                                            : "text-neutral-400 hover:text-white hover:bg-white/5 border-2 border-transparent"
                                    }`}
                                    title={`View ${MONTH_NAMES[m - 1]}`}
                                >
                                    <span>{mName}</span>{" "}
                                    <span className="text-[10px] opacity-75 font-mono">({tag})</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Today Button */}
                    <button
                        type="button"
                        onClick={handleResetToday}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border-2 border-black cursor-pointer ${
                            selectedMonth === currentMonthStr
                                ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                : "bg-[#14151B] text-neutral-300 hover:text-black hover:bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                        }`}
                        title="Jump to current month"
                    >
                        Today
                    </button>

                    {/* Previous / Next Arrow Controls */}
                    <div className="flex items-center rounded-xl bg-[#14151B] border-2 border-black p-0.5 shadow-[2px_2px_0px_#000]">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            disabled={!canGoPrev}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
                                canGoPrev
                                    ? "text-neutral-300 hover:text-black hover:bg-[#FFE566] cursor-pointer"
                                    : "text-neutral-600 opacity-25 cursor-not-allowed"
                            }`}
                            title={canGoPrev ? "Previous month" : "Only 1 month in the past is tracked"}
                            aria-label="Previous Month"
                        >
                            <ChevronLeft className="w-4 h-4 stroke-[3]" />
                        </button>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            disabled={!canGoNext}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
                                canGoNext
                                    ? "text-neutral-300 hover:text-black hover:bg-[#FFE566] cursor-pointer"
                                    : "text-neutral-600 opacity-25 cursor-not-allowed"
                            }`}
                            title={canGoNext ? "Next month" : "Only 1 month in the future is tracked"}
                            aria-label="Next Month"
                        >
                            <ChevronRight className="w-4 h-4 stroke-[3]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Calendar Grid in Midnight-Yellow Theme */}
            <div className="border-3 border-black rounded-2xl overflow-hidden bg-[#0a0b0e] shadow-[4px_4px_0px_#000] w-full min-w-0">
                {/* Days of week header row */}
                <div className="grid grid-cols-7 border-b-2 border-black bg-[#15161c]">
                    {DAY_NAMES_FULL.map((name, i) => (
                        <div
                            key={name}
                            className="py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-black tracking-wider text-[#FFE566] uppercase font-mono"
                        >
                            <span className="hidden sm:inline">{name}</span>
                            <span className="inline sm:hidden">{DAY_NAMES_SHORT[i]}</span>
                        </div>
                    ))}
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 auto-rows-fr divide-x-2 divide-y-2 divide-black/90 bg-[#0a0b0e]">
                    {calendarCells.map((cell, idx) => {
                        const maxVisible = 2;
                        const visibleEvents = cell.events.slice(0, maxVisible);
                        const extraCount = cell.events.length - maxVisible;

                        return (
                            <div
                                key={idx}
                                onClick={() => handleCellClick(cell)}
                                className={`min-h-[75px] xs:min-h-[90px] sm:min-h-[115px] md:min-h-[135px] p-1 sm:p-2 flex flex-col justify-between transition-all cursor-pointer group ${
                                    cell.isCurrentMonth
                                        ? cell.isToday
                                            ? "bg-[#1d1b10] ring-2 ring-[#FFE566] ring-inset hover:bg-[#252214]"
                                            : "bg-[#0f1015] hover:bg-[#181922]"
                                        : "bg-[#08090c] hover:bg-[#121319] text-neutral-600 opacity-60 hover:opacity-90"
                                }`}
                            >
                                {/* Cell Date Header */}
                                <div className="flex items-center justify-between mb-1 gap-1 min-w-0">
                                    {cell.isToday ? (
                                        <span className="inline-flex items-center gap-1 bg-[#FFE566] text-black text-[10px] sm:text-[11px] font-black px-1.5 sm:px-2.5 py-0.5 rounded-full border border-black shadow-[1.5px_1.5px_0px_#000] shrink-0">
                                            <span>{cell.dayNum}</span>
                                            <span className="hidden xs:inline">Today</span>
                                        </span>
                                    ) : (
                                        <span
                                            className={`text-[11px] sm:text-xs font-black pl-0.5 ${
                                                cell.isCurrentMonth
                                                    ? "text-neutral-200 group-hover:text-[#FFE566]"
                                                    : "text-neutral-500"
                                            }`}
                                        >
                                            {cell.dayNum}
                                        </span>
                                    )}

                                    {/* Contest Count Indicator */}
                                    {cell.events.length > 0 && (
                                        <span
                                            className={`text-[9px] sm:text-[10px] font-mono font-black px-1 sm:px-1.5 py-0.2 rounded border shrink-0 ${
                                                cell.isToday
                                                    ? "bg-[#FFE566] text-black border-black font-black"
                                                    : cell.isCurrentMonth
                                                    ? "bg-[#FFE566]/15 text-[#FFE566] border-[#FFE566]/30"
                                                    : "bg-neutral-800 text-neutral-400 border-neutral-700"
                                            }`}
                                            title={`${cell.events.length} contest${cell.events.length > 1 ? "s" : ""}`}
                                        >
                                            {cell.events.length}
                                        </span>
                                    )}
                                </div>

                                {/* Contest Pills List inside Cell */}
                                <div className="flex-1 space-y-1 overflow-hidden min-w-0">
                                    {visibleEvents.map((ev) => {
                                        const timeStr = formatTimeIST(ev.startTime);
                                        const isFinished = ev.status === "FINISHED" || (ev.endTimestamp && ev.endTimestamp < nowMs);
                                        const isLive = ev.status === "LIVE" || (ev.startTimestamp <= nowMs && ev.endTimestamp > nowMs);

                                        return (
                                            <div
                                                key={ev.id}
                                                className={`flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-lg border transition-all text-left shadow-xs ${
                                                    isLive
                                                        ? "bg-[#2d1216] hover:bg-[#3d181e] border-rose-500 text-rose-300 font-bold animate-pulse"
                                                        : isFinished
                                                        ? "bg-[#121318] hover:bg-[#1a1b22] border-neutral-800/80 text-neutral-400"
                                                        : "bg-[#181922] hover:bg-[#222430] border-neutral-800 hover:border-[#FFE566] text-white"
                                                }`}
                                                title={`${ev.title} on ${ev.platformName} (${timeStr} IST)${isFinished ? " · Finished" : isLive ? " · LIVE" : ""}`}
                                            >
                                                <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
                                                    {getPortalIcon(ev.platform, "w-3.5 h-3.5 object-contain")}
                                                </div>

                                                <span
                                                    className={`text-[9px] sm:text-[10px] font-mono font-bold flex-shrink-0 ${
                                                        isFinished ? "text-neutral-500" : "text-[#FFE566]"
                                                    }`}
                                                >
                                                    {timeStr}
                                                </span>

                                                <span
                                                    className={`truncate text-[9px] sm:text-[10px] font-bold min-w-0 hidden xs:inline ${
                                                        isFinished ? "text-neutral-400" : "text-neutral-200"
                                                    }`}
                                                >
                                                    {ev.title}
                                                </span>

                                                {/* Mini status indicator */}
                                                {isFinished && (
                                                    <span className="text-[8px] font-black uppercase text-neutral-400 bg-neutral-800 px-1 py-0.2 rounded ml-auto flex-shrink-0 hidden md:inline">
                                                        Done
                                                    </span>
                                                )}
                                                {isLive && (
                                                    <span className="text-[8px] font-black uppercase bg-rose-500 text-white px-1 py-0.2 rounded ml-auto flex-shrink-0">
                                                        Live
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* +N More Indicator */}
                                    {extraCount > 0 && (
                                        <div
                                            className="w-full text-center py-0.5 text-[9px] sm:text-[10px] font-mono font-black text-[#FFE566] hover:text-yellow-300 bg-[#FFE566]/10 hover:bg-[#FFE566]/20 border border-[#FFE566]/30 rounded transition-colors"
                                        >
                                            +{extraCount} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. Day Contests Breakdown Modal */}
            <EventTrackerDayEventsModal
                data={selectedDayEvents}
                onClose={() => setSelectedDayEvents(null)}
                reminders={reminders}
                onToggleReminder={onToggleReminder}
            />
        </div>
    );
};

export default EventTrackerCalendar;
