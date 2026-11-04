import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    X,
    BarChart3,
    Users,
    CheckCircle2,
    Calendar,
    GraduationCap,
    Clock,
    FileSpreadsheet,
    TrendingUp,
    RefreshCw,
} from "lucide-react";
import {
    fetchClubEventApplications,
    type ClubEventApplicationsResponse,
} from "../../api/collegeEventsApi";
import { OrbixLoader } from "../../components/ui/loader";

export interface EventAnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string | null;
    eventTitle?: string;
    onOpenApplicationsSheet?: () => void;
}

export const EventAnalyticsModal: React.FC<EventAnalyticsModalProps> = ({
    isOpen,
    onClose,
    eventId,
    eventTitle,
    onOpenApplicationsSheet,
}) => {
    const [data, setData] = useState<ClubEventApplicationsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const res = await fetchClubEventApplications(eventId);
            setData(res);
        } catch (err: any) {
            console.error("Failed to fetch event analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && eventId) {
            loadData();
        }
    }, [isOpen, eventId]);

    // Breakdown computations
    const analytics = useMemo(() => {
        if (!data) {
            return {
                total: 0,
                registered: 0,
                attended: 0,
                waitlisted: 0,
                cancelled: 0,
                turnoutRate: 0,
                deptBreakdown: [] as { name: string; count: number; pct: number }[],
                yearBreakdown: [] as { year: string; count: number; pct: number }[],
            };
        }

        const { total, registered, attended, waitlisted, cancelled } = data.summary;
        const totalActive = registered + attended;
        const turnoutRate =
            totalActive > 0 ? Math.round((attended / totalActive) * 100) : 0;

        // Department breakdown
        const deptMap = new Map<string, number>();
        const yearMap = new Map<string, number>();

        for (const app of data.applications) {
            const dept = (app.department || "General Engineering").trim();
            deptMap.set(dept, (deptMap.get(dept) || 0) + 1);

            const yr = app.yearOfStudy ? `${app.yearOfStudy} Year` : "Undisclosed";
            yearMap.set(yr, (yearMap.get(yr) || 0) + 1);
        }

        const deptBreakdown = Array.from(deptMap.entries())
            .map(([name, count]) => ({
                name,
                count,
                pct: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const yearBreakdown = Array.from(yearMap.entries())
            .map(([year, count]) => ({
                year,
                count,
                pct: total > 0 ? Math.round((count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);

        return {
            total,
            registered,
            attended,
            waitlisted,
            cancelled,
            turnoutRate,
            deptBreakdown,
            yearBreakdown,
        };
    }, [data]);

    if (!isOpen || !eventId) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
                className="w-full max-w-2xl bg-[#FAF6EE] border-3 border-black rounded-3xl shadow-[8px_8px_0px_#000] p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200 text-black max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2.5 rounded-xl bg-[#38BDF8] border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0">
                            <BarChart3 className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white text-black border border-black/40 inline-block mb-1">
                                Event Analytics & Performance
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-black truncate">
                                {eventTitle || data?.event?.title || "Event Analytics"}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="p-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[1px_1px_0px_#000] cursor-pointer"
                            title="Refresh Analytics"
                        >
                            <RefreshCw
                                className={`w-4 h-4 stroke-[2.5] ${
                                    loading ? "animate-spin" : ""
                                }`}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[1px_1px_0px_#000] cursor-pointer"
                            title="Close"
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                        <OrbixLoader size="md" variant="centered" color="#000" />
                        <span className="text-xs font-black text-neutral-600">
                            Aggregating attendee metrics...
                        </span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* KPI Stat Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="p-3.5 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block">
                                    Total RSVPs
                                </span>
                                <div className="text-2xl font-black text-black mt-1">
                                    {analytics.total}
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500 mt-1 flex items-center gap-1">
                                    <Users className="w-3 h-3 text-neutral-600" />
                                    Total applications
                                </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-emerald-800 block">
                                    Confirmed
                                </span>
                                <div className="text-2xl font-black text-emerald-950 mt-1">
                                    {analytics.registered}
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Ready to attend
                                </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-purple-50 border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-purple-800 block">
                                    Attended
                                </span>
                                <div className="text-2xl font-black text-purple-950 mt-1">
                                    {analytics.attended}
                                </div>
                                <span className="text-[10px] font-bold text-purple-700 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-purple-600" />
                                    Checked-in
                                </span>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[10px] font-black uppercase text-black block">
                                    Turnout Rate
                                </span>
                                <div className="text-2xl font-black text-black mt-1">
                                    {analytics.turnoutRate}%
                                </div>
                                <span className="text-[10px] font-bold text-neutral-800 mt-1 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-black" />
                                    Attendance ratio
                                </span>
                            </div>
                        </div>

                        {/* Department Distribution */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                <div className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-black stroke-[2.2]" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Department / Branch Distribution
                                    </h4>
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500">
                                    Top 5 Disciplines
                                </span>
                            </div>

                            {analytics.deptBreakdown.length === 0 ? (
                                <p className="text-xs text-neutral-500 font-bold py-2 text-center">
                                    No department data recorded yet.
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    {analytics.deptBreakdown.map((dept, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs font-bold text-black">
                                                <span className="truncate">{dept.name}</span>
                                                <span className="font-mono text-neutral-600 shrink-0">
                                                    {dept.count} ({dept.pct}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-neutral-100 border border-black overflow-hidden">
                                                <div
                                                    className="h-full bg-[#a2ff86] border-r border-black"
                                                    style={{ width: `${Math.max(dept.pct, 4)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Year of Study Breakdown */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-black stroke-[2.2]" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Year of Study Cohort Breakdown
                                    </h4>
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500">
                                    Academic Demographics
                                </span>
                            </div>

                            {analytics.yearBreakdown.length === 0 ? (
                                <p className="text-xs text-neutral-500 font-bold py-2 text-center">
                                    No year cohort data recorded yet.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {analytics.yearBreakdown.map((yr, idx) => (
                                        <div
                                            key={idx}
                                            className="p-2.5 rounded-xl bg-[#FAF6EE] border border-black text-center"
                                        >
                                            <span className="text-[10px] font-black uppercase text-neutral-600 block">
                                                {yr.year}
                                            </span>
                                            <span className="text-base font-black text-black">
                                                {yr.count}
                                            </span>
                                            <span className="text-[9px] font-bold text-neutral-500 block">
                                                {yr.pct}% of total
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer Action to Jump to Applications Sheet */}
                        {onOpenApplicationsSheet && (
                            <div className="pt-2 flex items-center justify-between gap-3">
                                <span className="text-xs text-neutral-600 font-medium truncate">
                                    Want to inspect individual applicant rows or export an Excel sheet?
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenApplicationsSheet();
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-[#38BDF8] hover:bg-[#0ea5e9] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 shrink-0 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Open Applications Sheet</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
