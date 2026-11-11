// Frontend/src/app/Club/TeamWorkspace/Recognition/MemberIndividualAnalyticsModal.tsx
import React, { useState, useEffect } from "react";
import {
    X,
    User,
    Award,
    CheckCircle2,
    Clock,
    RefreshCw,
    TrendingUp,
    AlertCircle,
    Briefcase,
    RotateCcw,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type { IndividualMemberAnalytics, LeaderboardPeriod } from "../../../../types/workspace";

interface MemberIndividualAnalyticsModalProps {
    clubId: string;
    workspaceId?: string;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const MemberIndividualAnalyticsModal: React.FC<MemberIndividualAnalyticsModalProps> = ({
    clubId,
    workspaceId,
    userId,
    isOpen,
    onClose,
}) => {
    const [period, setPeriod] = useState<LeaderboardPeriod>("this_month");
    const [data, setData] = useState<IndividualMemberAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    const loadMemberAnalytics = async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getIndividualMemberAnalytics(userId, period, clubId, workspaceId);
            if (res.success && res.analytics) {
                setData(res.analytics);
            }
        } catch (err) {
            console.error("Failed to load individual member analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && userId) {
            loadMemberAnalytics();
        }
    }, [isOpen, userId, period]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {data?.avatarUrl ? (
                                <img src={data.avatarUrl} alt={data.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-6 h-6 text-slate-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {data?.name || "Member Analytics"}
                                {data?.department && (
                                    <span
                                        className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                                        style={{
                                            backgroundColor: `${data.department.color || "#6366f1"}20`,
                                            color: data.department.color || "#818cf8",
                                        }}
                                    >
                                        {data.department.name}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-400">
                                @{data?.username} • {data?.roleTitle}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Period Selector Tabs */}
                <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        {(
                            [
                                { id: "this_week", label: "This Week" },
                                { id: "this_month", label: "This Month" },
                                { id: "last_30_days", label: "30 Days" },
                                { id: "all_time", label: "All Time" },
                            ] as Array<{ id: LeaderboardPeriod; label: string }>
                        ).map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                    period === p.id
                                        ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="text-[11px] text-slate-500 italic">
                        Actionable Delivery & Performance Metrics
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400">
                            <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                            <p className="text-xs">Computing individual member analytics...</p>
                        </div>
                    ) : !data ? (
                        <div className="py-12 text-center text-slate-500 text-xs">
                            Analytics data unavailable.
                        </div>
                    ) : (
                        <>
                            {/* KPI Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span>Total Orbits</span>
                                        <Award className="w-3.5 h-3.5 text-amber-400" />
                                    </div>
                                    <div className="text-2xl font-black text-amber-400">+{data.totalOrbits}</div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {data.monthlyOrbits} earned this month
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span>Approved Work</span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                    <div className="text-2xl font-black text-emerald-400">
                                        {data.tasksApproved}{" "}
                                        <span className="text-xs text-slate-500 font-normal">/ {data.tasksAssigned}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">Verified deliverables</div>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span>On-Time Rate</span>
                                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                                    </div>
                                    <div className="text-2xl font-black text-sky-400">
                                        {data.onTimeSubmissionRate !== null ? `${data.onTimeSubmissionRate}%` : "—"}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {data.onTimeSubmissionRate !== null ? "Deadline reliability" : "No timed tasks"}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                                        <span>Revision Rate</span>
                                        <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                                    </div>
                                    <div className="text-2xl font-black text-purple-400">
                                        {data.submissionRevisionRate !== null ? `${data.submissionRevisionRate}%` : "0%"}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">Changes requested rate</div>
                                </div>
                            </div>

                            {/* Performance Safeguard Note */}
                            <div className="p-3 bg-slate-800/30 border border-slate-800 rounded-xl flex items-center gap-2.5 text-xs text-slate-400">
                                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <span>
                                    <strong>Holistic Evaluation:</strong> High task volume alone is not treated as high performance. Delivery quality, on-time submissions, and peer teamwork are evaluated together.
                                </span>
                            </div>

                            {/* 4-Week Trend */}
                            <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-400" />
                                    Recent Weekly Trend
                                </h4>
                                <div className="grid grid-cols-4 gap-2">
                                    {data.trends.map((t, idx) => (
                                        <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-1">
                                            <div className="text-[10px] text-slate-500 font-medium">{t.periodLabel}</div>
                                            <div className="text-sm font-bold text-amber-400">+{t.orbits} Orbits</div>
                                            <div className="text-[10px] text-slate-400">{t.tasksCompleted} tasks done</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Category Distribution */}
                            <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-indigo-400" />
                                    Recognition Categories
                                </h4>
                                {data.categoriesBreakdown.length === 0 ? (
                                    <div className="py-6 text-center text-slate-500 text-xs">
                                        No categorized appreciation received yet.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {data.categoriesBreakdown.map((cat) => (
                                            <div
                                                key={cat.slug}
                                                className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-slate-200">{cat.name}</span>
                                                    <span className="text-[10px] text-slate-500">
                                                        ({cat.count} {cat.count === 1 ? "award" : "awards"})
                                                    </span>
                                                </div>
                                                <span className="font-bold text-amber-400">+{cat.points} Orbits</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
