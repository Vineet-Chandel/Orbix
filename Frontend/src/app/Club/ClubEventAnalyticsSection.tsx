import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Calendar,
    Users,
    UserCheck,
    UserX,
    CheckCircle2,
    CheckCheck,
    FileText,
    Ban,
    BarChart3,
    TrendingUp,
    ArrowUpRight,
    Search,
    Clock,
    ChevronRight,
    Eye,
} from "lucide-react";
import type { ClubEvent, ClubEventFilter } from "../../store/clubEventsSlice";

interface ClubEventAnalyticsSectionProps {
    events: ClubEvent[];
    currentFilter: ClubEventFilter;
    onSelectFilter: (filter: ClubEventFilter) => void;
    onOpenCreateModal?: () => void;
}

export const ClubEventAnalyticsSection: React.FC<ClubEventAnalyticsSectionProps> = ({
    events,
    currentFilter,
    onSelectFilter,
}) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"visual" | "table">("visual");

    // 1. Stage Counts & Percentages
    const publishedEvents = useMemo(() => events.filter((e) => e.status === "published"), [events]);
    const completedEvents = useMemo(() => events.filter((e) => e.status === "completed"), [events]);
    const draftEvents = useMemo(() => events.filter((e) => e.status === "draft"), [events]);
    const cancelledEvents = useMemo(() => events.filter((e) => e.status === "cancelled"), [events]);

    const totalSessions = events.length;
    const publishedPct = totalSessions > 0 ? Math.round((publishedEvents.length / totalSessions) * 100) : 0;
    const completedPct = totalSessions > 0 ? Math.round((completedEvents.length / totalSessions) * 100) : 0;
    const draftPct = totalSessions > 0 ? Math.round((draftEvents.length / totalSessions) * 100) : 0;
    const cancelledPct = totalSessions > 0 ? Math.round((cancelledEvents.length / totalSessions) * 100) : 0;

    // 2. Aggregate Turnout & Application Numbers
    const totalRegistrations = useMemo(
        () => events.reduce((acc, e) => acc + (Number(e.registrationsCount) || 0), 0),
        [events]
    );
    const totalAttendees = useMemo(
        () => events.reduce((acc, e) => acc + (Number(e.attendeesCount) || 0), 0),
        [events]
    );
    const totalRejected = useMemo(
        () => events.reduce((acc, e) => acc + (Number(e.rejectedCount) || 0), 0),
        [events]
    );

    const overallTurnoutRate = totalRegistrations > 0
        ? Math.round((totalAttendees / totalRegistrations) * 100)
        : 0;

    // 3. Dynamic Last 4 Months Trend Calculation
    const last4MonthsData = useMemo(() => {
        const now = new Date();
        const months = [];

        for (let i = 3; i >= 0; i--) {
            const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const monthIndex = targetDate.getMonth();
            const monthShort = targetDate.toLocaleString("default", { month: "short" });
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

            // Aggregate events falling in this month
            const monthEvents = events.filter((e) => {
                const dateStr = e.startsAt || e.createdAt;
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return d.getFullYear() === year && d.getMonth() === monthIndex;
            });

            const sessionCount = monthEvents.length;
            const regCount = monthEvents.reduce((acc, e) => acc + (Number(e.registrationsCount) || 0), 0);
            const attCount = monthEvents.reduce((acc, e) => acc + (Number(e.attendeesCount) || 0), 0);
            const rejCount = monthEvents.reduce((acc, e) => acc + (Number(e.rejectedCount) || 0), 0);

            months.push({
                monthKey,
                label: monthShort.toUpperCase(),
                year,
                sessionCount,
                regCount,
                attCount,
                rejCount,
            });
        }

        // Calculate max scale for SVG chart height
        const maxVal = Math.max(
            ...months.map((m) => Math.max(m.sessionCount, m.regCount, m.attCount, 1))
        );

        return { months, maxVal };
    }, [events]);

    // 4. Filtered events for the event-wise table deep dive
    const filteredEventsForTable = useMemo(() => {
        return events.filter((ev) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                ev.title.toLowerCase().includes(q) ||
                (ev.summary && ev.summary.toLowerCase().includes(q)) ||
                (ev.venueOrLocation && ev.venueOrLocation.toLowerCase().includes(q))
            );
        });
    }, [events, searchQuery]);

    return (
        <div className="space-y-5">
            {/* MAIN ANALYTICS DECK CONTAINER */}
            <div className="p-5 sm:p-7 rounded-3xl bg-[#FAF6EE] border-3 border-black shadow-[6px_6px_0px_#000] space-y-6">
                {/* Deck Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/15 pb-5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black text-[#FFE566] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                                <BarChart3 className="w-3.5 h-3.5 stroke-[2.5]" />
                                Event Intelligence
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-200 text-black border border-black text-[11px] font-black shadow-[1px_1px_0px_#000]">
                                <TrendingUp className="w-3 h-3 stroke-[2.5]" />
                                Last 4 Months Active
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                            Event & Turnout Analytics
                        </h2>
                        <p className="text-xs text-neutral-600 font-bold">
                            Real-time session lifecycle tracking, student turnout ratios, and 4-month velocity.
                        </p>
                    </div>

                    {/* View Switcher Toggle (Visual Chart vs Event-Wise Table) */}
                    <div className="inline-flex items-center p-1 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] self-start sm:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode("visual")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                viewMode === "visual"
                                    ? "bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000] border-2 border-black"
                                    : "text-neutral-600 hover:text-black border-2 border-transparent"
                            }`}
                        >
                            Visual Charts
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                viewMode === "table"
                                    ? "bg-[#a2ff86] text-black shadow-[1.5px_1.5px_0px_#000] border-2 border-black"
                                    : "text-neutral-600 hover:text-black border-2 border-transparent"
                            }`}
                        >
                            Event-Wise Matrix
                        </button>
                    </div>
                </div>

                {/* 5 COMPACT KPI METRIC PILLS ROW */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Metric 1: Total Sessions */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Total Sessions
                            </span>
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 stroke-[2.5]" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black text-black">{totalSessions}</span>
                            <span className="text-[11px] font-bold text-neutral-500">sessions</span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-neutral-600 truncate">
                            {publishedEvents.length} Live · {completedEvents.length} Done
                        </div>
                    </div>

                    {/* Metric 2: Registrations */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-800">
                                Registered
                            </span>
                            <Users className="w-3.5 h-3.5 text-sky-600 stroke-[2.5]" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black text-black">{totalRegistrations}</span>
                            <span className="text-[11px] font-bold text-neutral-500">students</span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-sky-700 truncate">
                            Total campus RSVPs
                        </div>
                    </div>

                    {/* Metric 3: Confirmed Attendees */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                                Attendees
                            </span>
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black text-black">{totalAttendees}</span>
                            <span className="text-[11px] font-bold text-neutral-500">checked-in</span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-emerald-700 truncate">
                            Verified participation
                        </div>
                    </div>

                    {/* Metric 4: Overall Turnout Rate */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900">
                                Turnout Rate
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-purple-600 stroke-[2.5]" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black text-black">{overallTurnoutRate}%</span>
                            <span className="text-[11px] font-bold text-neutral-500">turnout</span>
                        </div>
                        {/* Compact Turnout Visual Bar */}
                        <div className="mt-1.5 w-full bg-neutral-100 rounded-full h-2 border border-black overflow-hidden">
                            <div
                                className="bg-[#a2ff86] h-full transition-all duration-500"
                                style={{ width: `${Math.min(overallTurnoutRate, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Metric 5: Applications Rejected / Moderated */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between col-span-2 sm:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                                Rejected / Cancelled
                            </span>
                            <UserX className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                        </div>
                        <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black text-black">{totalRejected}</span>
                            <span className="text-[11px] font-bold text-neutral-500">declined</span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-rose-700 truncate">
                            Moderated / withdrawn
                        </div>
                    </div>
                </div>

                {/* CONDITIONAL CONTENT: VISUAL DECK OR DETAILED TABLE */}
                {viewMode === "visual" ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* LEFT 7 COLS: LAST 4 MONTHS TREND GRAPH */}
                        <div className="lg:col-span-7 p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] border border-black" />
                                        <h3 className="font-black text-sm text-black">
                                            Last 4 Months Activity & RSVPs
                                        </h3>
                                    </div>
                                    <span className="text-[11px] font-bold text-neutral-500">
                                        {last4MonthsData.months[0]?.label} – {last4MonthsData.months[3]?.label} {last4MonthsData.months[3]?.year}
                                    </span>
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium mt-1">
                                    Monthly comparison of sessions organized, student registrations, and verified attendees.
                                </p>
                            </div>

                            {/* Neo-Brutalist Responsive Bar Graph */}
                            <div className="pt-4 pb-2">
                                <div className="grid grid-cols-4 gap-3 sm:gap-4 items-end h-48 border-b-2 border-black px-2 sm:px-4">
                                    {last4MonthsData.months.map((m) => {
                                        const sessionHeight = Math.max(
                                            (m.sessionCount / last4MonthsData.maxVal) * 100,
                                            m.sessionCount > 0 ? 12 : 4
                                        );
                                        const regHeight = Math.max(
                                            (m.regCount / last4MonthsData.maxVal) * 100,
                                            m.regCount > 0 ? 14 : 4
                                        );
                                        const attHeight = Math.max(
                                            (m.attCount / last4MonthsData.maxVal) * 100,
                                            m.attCount > 0 ? 12 : 4
                                        );

                                        return (
                                            <div
                                                key={m.monthKey}
                                                className="flex flex-col items-center justify-end h-full group relative"
                                            >
                                                {/* Tooltip on Hover */}
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-12 z-20 bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap">
                                                    <div>{m.label} {m.year}</div>
                                                    <div className="text-[#a2ff86]">Sessions: {m.sessionCount}</div>
                                                    <div className="text-[#38BDF8]">RSVPs: {m.regCount} · Attended: {m.attCount}</div>
                                                </div>

                                                {/* Grouped Bar Columns */}
                                                <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full pb-1">
                                                    {/* Bar 1: Sessions (Lime) */}
                                                    <div className="flex-1 max-w-[22px] flex flex-col items-center justify-end h-full">
                                                        <span className="text-[9px] font-black text-neutral-500 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {m.sessionCount}
                                                        </span>
                                                        <div
                                                            className="w-full bg-[#a2ff86] border-2 border-black rounded-t-md shadow-[1px_1px_0px_#000] transition-all duration-300"
                                                            style={{ height: `${sessionHeight}%` }}
                                                        />
                                                    </div>

                                                    {/* Bar 2: Registrations (Sky) */}
                                                    <div className="flex-1 max-w-[22px] flex flex-col items-center justify-end h-full">
                                                        <span className="text-[9px] font-black text-sky-700 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {m.regCount}
                                                        </span>
                                                        <div
                                                            className="w-full bg-[#38BDF8] border-2 border-black rounded-t-md shadow-[1px_1px_0px_#000] transition-all duration-300"
                                                            style={{ height: `${regHeight}%` }}
                                                        />
                                                    </div>

                                                    {/* Bar 3: Attendees (Emerald) */}
                                                    <div className="flex-1 max-w-[22px] flex flex-col items-center justify-end h-full">
                                                        <span className="text-[9px] font-black text-emerald-700 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {m.attCount}
                                                        </span>
                                                        <div
                                                            className="w-full bg-emerald-300 border-2 border-black rounded-t-md shadow-[1px_1px_0px_#000] transition-all duration-300"
                                                            style={{ height: `${attHeight}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Month Label */}
                                                <span className="mt-2 text-[10px] sm:text-xs font-black text-black">
                                                    {m.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Chart Legend */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] font-bold border-t border-black/10">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-xs bg-[#a2ff86] border border-black shadow-[0.5px_0.5px_0px_#000]" />
                                        <span className="text-neutral-700">Sessions</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-xs bg-[#38BDF8] border border-black shadow-[0.5px_0.5px_0px_#000]" />
                                        <span className="text-neutral-700">Registrations</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-xs bg-emerald-300 border border-black shadow-[0.5px_0.5px_0px_#000]" />
                                        <span className="text-neutral-700">Attendees</span>
                                    </div>
                                </div>
                                <span className="text-[10px] text-neutral-400 font-bold">
                                    Hover bar to view exact counts
                                </span>
                            </div>
                        </div>

                        {/* RIGHT 5 COLS: STAGE COMPARISON (LIVE vs COMPLETED vs DRAFT vs CANCELLED) */}
                        <div className="lg:col-span-5 p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFE566] border border-black" />
                                    <h3 className="font-black text-sm text-black">
                                        Session Lifecycle Breakdown
                                    </h3>
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium mt-1">
                                    Current distribution across all 4 stages of the session workflow.
                                </p>
                            </div>

                            {/* Multi-Segment Proportional Status Bar */}
                            <div className="space-y-1.5">
                                <div className="w-full h-6 rounded-xl border-2 border-black overflow-hidden flex bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]">
                                    {publishedPct > 0 && (
                                        <div
                                            className="bg-emerald-300 h-full border-r border-black/40 transition-all flex items-center justify-center text-[10px] font-black text-black"
                                            style={{ width: `${publishedPct}%` }}
                                            title={`Published (Live): ${publishedEvents.length} (${publishedPct}%)`}
                                        >
                                            {publishedPct >= 15 ? `${publishedPct}%` : ""}
                                        </div>
                                    )}
                                    {completedPct > 0 && (
                                        <div
                                            className="bg-sky-300 h-full border-r border-black/40 transition-all flex items-center justify-center text-[10px] font-black text-black"
                                            style={{ width: `${completedPct}%` }}
                                            title={`Completed: ${completedEvents.length} (${completedPct}%)`}
                                        >
                                            {completedPct >= 15 ? `${completedPct}%` : ""}
                                        </div>
                                    )}
                                    {draftPct > 0 && (
                                        <div
                                            className="bg-amber-300 h-full border-r border-black/40 transition-all flex items-center justify-center text-[10px] font-black text-black"
                                            style={{ width: `${draftPct}%` }}
                                            title={`Drafts: ${draftEvents.length} (${draftPct}%)`}
                                        >
                                            {draftPct >= 15 ? `${draftPct}%` : ""}
                                        </div>
                                    )}
                                    {cancelledPct > 0 && (
                                        <div
                                            className="bg-rose-300 h-full transition-all flex items-center justify-center text-[10px] font-black text-black"
                                            style={{ width: `${cancelledPct}%` }}
                                            title={`Cancelled: ${cancelledEvents.length} (${cancelledPct}%)`}
                                        >
                                            {cancelledPct >= 15 ? `${cancelledPct}%` : ""}
                                        </div>
                                    )}
                                    {totalSessions === 0 && (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-neutral-400">
                                            No sessions scheduled yet
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 4 Clickable Stage Selector Cards */}
                            <div className="grid grid-cols-2 gap-2.5">
                                {/* Stage 1: Published Live */}
                                <button
                                    type="button"
                                    onClick={() => onSelectFilter(currentFilter === "published" ? "all" : "published")}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        currentFilter === "published"
                                            ? "bg-emerald-300 border-black shadow-[2.5px_2.5px_0px_#000] font-black scale-[1.02]"
                                            : "bg-emerald-50/80 hover:bg-emerald-100/80 border-black/40 shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-emerald-900">
                                            Live Stage
                                        </span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1.5">
                                        <span className="text-xl font-black text-black">{publishedEvents.length}</span>
                                        <span className="text-[10px] font-bold text-emerald-800">{publishedPct}%</span>
                                    </div>
                                    <div className="text-[9px] font-bold text-emerald-900/70 mt-0.5 truncate">
                                        Open for RSVP
                                    </div>
                                </button>

                                {/* Stage 2: Completed */}
                                <button
                                    type="button"
                                    onClick={() => onSelectFilter(currentFilter === "completed" ? "all" : "completed")}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        currentFilter === "completed"
                                            ? "bg-sky-300 border-black shadow-[2.5px_2.5px_0px_#000] font-black scale-[1.02]"
                                            : "bg-sky-50/80 hover:bg-sky-100/80 border-black/40 shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-sky-900">
                                            Completed
                                        </span>
                                        <CheckCheck className="w-3.5 h-3.5 text-sky-700 stroke-[2.5]" />
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1.5">
                                        <span className="text-xl font-black text-black">{completedEvents.length}</span>
                                        <span className="text-[10px] font-bold text-sky-800">{completedPct}%</span>
                                    </div>
                                    <div className="text-[9px] font-bold text-sky-900/70 mt-0.5 truncate">
                                        Past & recorded
                                    </div>
                                </button>

                                {/* Stage 3: Drafts */}
                                <button
                                    type="button"
                                    onClick={() => onSelectFilter(currentFilter === "draft" ? "all" : "draft")}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        currentFilter === "draft"
                                            ? "bg-amber-300 border-black shadow-[2.5px_2.5px_0px_#000] font-black scale-[1.02]"
                                            : "bg-amber-50/80 hover:bg-amber-100/80 border-black/40 shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-amber-900">
                                            Drafts
                                        </span>
                                        <FileText className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1.5">
                                        <span className="text-xl font-black text-black">{draftEvents.length}</span>
                                        <span className="text-[10px] font-bold text-amber-800">{draftPct}%</span>
                                    </div>
                                    <div className="text-[9px] font-bold text-amber-900/70 mt-0.5 truncate">
                                        Internal review
                                    </div>
                                </button>

                                {/* Stage 4: Cancelled */}
                                <button
                                    type="button"
                                    onClick={() => onSelectFilter(currentFilter === "cancelled" ? "all" : "cancelled")}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        currentFilter === "cancelled"
                                            ? "bg-rose-300 border-black shadow-[2.5px_2.5px_0px_#000] font-black scale-[1.02]"
                                            : "bg-rose-50/80 hover:bg-rose-100/80 border-black/40 shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-rose-900">
                                            Cancelled
                                        </span>
                                        <Ban className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1.5">
                                        <span className="text-xl font-black text-black">{cancelledEvents.length}</span>
                                        <span className="text-[10px] font-bold text-rose-800">{cancelledPct}%</span>
                                    </div>
                                    <div className="text-[9px] font-bold text-rose-900/70 mt-0.5 truncate">
                                        Archived cancelled
                                    </div>
                                </button>
                            </div>

                            <div className="text-[10px] text-neutral-500 font-bold text-center">
                                Tip: Click any stage card to filter the event schedule below.
                            </div>
                        </div>
                    </div>
                ) : (
                    /* TABLE VIEW: EVENT-WISE ANALYTICS MATRIX */
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="font-black text-sm text-black">
                                    Event-by-Event Performance Matrix
                                </h3>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Detailed per-event breakdown of RSVPs, verified check-ins, turnout velocity, and rejections.
                                </p>
                            </div>

                            {/* Search Filter for Events */}
                            <div className="relative max-w-xs w-full">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[2.5]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Filter by title or venue..."
                                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border-2 border-black text-xs font-bold bg-[#FAF6EE] focus:bg-white focus:outline-none"
                                />
                            </div>
                        </div>

                        {filteredEventsForTable.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-neutral-300 rounded-xl space-y-2">
                                <Calendar className="w-8 h-8 text-neutral-300 mx-auto" />
                                <p className="text-xs font-bold text-neutral-600">
                                    No events match the current filter or search criteria.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-black bg-[#FAF6EE]">
                                            <th className="py-2.5 px-3 font-black text-black">Event Session</th>
                                            <th className="py-2.5 px-3 font-black text-black">Stage</th>
                                            <th className="py-2.5 px-3 font-black text-black text-center">Registered</th>
                                            <th className="py-2.5 px-3 font-black text-black text-center">Attended</th>
                                            <th className="py-2.5 px-3 font-black text-black text-center">Rejected / Cancelled</th>
                                            <th className="py-2.5 px-3 font-black text-black text-center">Turnout Rate</th>
                                            <th className="py-2.5 px-3 font-black text-black text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/10 font-bold">
                                        {filteredEventsForTable.map((ev) => {
                                            const reg = Number(ev.registrationsCount) || 0;
                                            const att = Number(ev.attendeesCount) || 0;
                                            const rej = Number(ev.rejectedCount) || 0;
                                            const turnout = reg > 0 ? Math.round((att / reg) * 100) : 0;

                                            return (
                                                <tr
                                                    key={ev.id}
                                                    className="hover:bg-neutral-50 transition-colors group cursor-pointer"
                                                    onClick={() => navigate(`/club/events/${ev.id}`)}
                                                >
                                                    <td className="py-3 px-3">
                                                        <div className="font-black text-black group-hover:underline max-w-xs truncate">
                                                            {ev.title}
                                                        </div>
                                                        <div className="text-[10px] text-neutral-500 font-medium flex items-center gap-1 mt-0.5">
                                                            <Clock className="w-3 h-3 text-neutral-400" />
                                                            {new Date(ev.startsAt).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black ${
                                                                ev.status === "published"
                                                                    ? "bg-emerald-300 text-black"
                                                                    : ev.status === "completed"
                                                                    ? "bg-sky-200 text-black"
                                                                    : ev.status === "draft"
                                                                    ? "bg-amber-200 text-black"
                                                                    : "bg-rose-200 text-black"
                                                            }`}
                                                        >
                                                            {ev.status === "published"
                                                                ? "Live"
                                                                : ev.status === "completed"
                                                                ? "Completed"
                                                                : ev.status === "draft"
                                                                ? "Draft"
                                                                : "Cancelled"}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-black text-sky-900">
                                                        {reg}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-black text-emerald-900">
                                                        {att}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-black text-rose-900">
                                                        {rej}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black border border-black ${
                                                                turnout >= 70
                                                                    ? "bg-emerald-200 text-emerald-950"
                                                                    : turnout >= 35
                                                                    ? "bg-amber-200 text-amber-950"
                                                                    : "bg-neutral-100 text-neutral-700"
                                                            }`}
                                                        >
                                                            {turnout}%
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/club/events/${ev.id}`);
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#a2ff86] border border-black text-[11px] font-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 transition-all"
                                                        >
                                                            <Eye className="w-3 h-3 stroke-[2.5]" />
                                                            <span>Roster</span>
                                                            <ChevronRight className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
