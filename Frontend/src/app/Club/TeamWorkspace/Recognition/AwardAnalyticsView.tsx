// Frontend/src/app/Club/TeamWorkspace/Recognition/AwardAnalyticsView.tsx
import React, { useEffect, useState } from "react";
import {
    Sparkles,
    Award,
    BarChart3,
    CheckCircle2,
    Clock,
    Users,
    Building2,
    Crown,
    AlertTriangle,
    RefreshCw,
    TrendingUp,
    Shield,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceAnalyticsSummary,
    LeaderboardPeriod,
} from "../../../../types/workspace";
import { MemberIndividualAnalyticsModal } from "./MemberIndividualAnalyticsModal";

interface AwardAnalyticsViewProps {
    clubId: string;
    workspaceId?: string;
    isOwner?: boolean;
    isWorkspaceManager?: boolean;
}

export const AwardAnalyticsView: React.FC<AwardAnalyticsViewProps> = ({
    clubId,
    workspaceId,
    isOwner: _isOwner,
    isWorkspaceManager: _isWorkspaceManager,
}) => {
    const [period, setPeriod] = useState<LeaderboardPeriod>("this_month");
    const [analytics, setAnalytics] = useState<WorkspaceAnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Active sub-section: overview | departments | leadership | managers
    const [section, setSection] = useState<"overview" | "departments" | "leadership" | "managers">("overview");

    // Modal state for individual member analytics
    const [selectedMemberUserId, setSelectedMemberUserId] = useState<string | null>(null);

    const loadAnalytics = async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const res = await workspaceApi.getComprehensiveAnalytics(period, undefined, clubId, workspaceId);
            if (res.success && res.analytics) {
                setAnalytics(res.analytics);
            }
        } catch (err) {
            console.error("Failed to load comprehensive analytics:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [clubId, workspaceId, period]);

    if (loading) {
        return (
            <div className="p-16 text-center text-slate-400 bg-slate-900/40 border border-slate-800 rounded-3xl">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-200">Aggregating Team & Performance Analytics...</p>
                <p className="text-xs text-slate-500 mt-1">Evaluating task deliverables, deadlines, and recognition flow.</p>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-3xl">
                No analytics data available for this workspace.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 1. Header & Period Filter Controls */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    Team & Performance Analytics
                                </h2>
                                <p className="text-xs text-slate-400">
                                    Actionable operational insight across task delivery, on-time rates, and recognition balance.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Period Tabs */}
                    <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                        {(
                            [
                                { id: "this_week", label: "This Week" },
                                { id: "this_month", label: "This Month" },
                                { id: "last_30_days", label: "30 Days" },
                                { id: "last_90_days", label: "90 Days" },
                                { id: "all_time", label: "All Time" },
                            ] as Array<{ id: LeaderboardPeriod; label: string }>
                        ).map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setPeriod(p.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    period === p.id
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}

                        <button
                            onClick={() => loadAnalytics(true)}
                            disabled={refreshing}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            title="Refresh analytics"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Fairness & Overconcentration Alert Banners for Human Review */}
                {analytics.fairnessAlerts && analytics.fairnessAlerts.length > 0 ? (
                    <div className="mt-4 space-y-2">
                        {analytics.fairnessAlerts.map((alert, idx) => (
                            <div
                                key={idx}
                                className={`p-3.5 rounded-xl flex items-center gap-3 text-xs border ${
                                    alert.severity === "warning"
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                        : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                }`}
                            >
                                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <div>
                                    <strong className="font-bold mr-1.5">{alert.title}:</strong>
                                    <span>{alert.detail}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : analytics.recognitionDistribution.overconcentrationAlert ? (
                    <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-xs text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>{analytics.recognitionDistribution.overconcentrationAlert}</span>
                    </div>
                ) : null}
            </div>

            {/* 2. Top-Level Metric KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Orbits Awarded</span>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-400">+{analytics.totalOrbitsAwarded}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Points in active circulation</p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Contributors</span>
                        <Users className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-white">{analytics.activeContributors}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Active contributing teammates</p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Approved Tasks</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{analytics.totalApprovedTasks}</div>
                    <p className="text-[10px] text-slate-500 mt-1">Completed & verified deliverables</p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">On-Time Rate</span>
                        <Clock className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="text-2xl font-black text-sky-400">{analytics.onTimeCompletionRate}%</div>
                    <p className="text-[10px] text-slate-500 mt-1">Delivered on or before deadline</p>
                </div>

                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                        <span className="font-semibold uppercase tracking-wider text-[11px]">Departments</span>
                        <Building2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-black text-purple-400">
                        {analytics.departmentComparison.length}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Operational teams tracked</p>
                </div>
            </div>

            {/* 3. Section Navigation Switcher */}
            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
                <button
                    onClick={() => setSection("overview")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        section === "overview"
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Trends & Categories
                </button>

                <button
                    onClick={() => setSection("departments")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        section === "departments"
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <Building2 className="w-3.5 h-3.5" />
                    Department Comparison
                </button>

                <button
                    onClick={() => setSection("leadership")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        section === "leadership"
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <Crown className="w-3.5 h-3.5" />
                    Leadership Analytics
                </button>

                <button
                    onClick={() => setSection("managers")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        section === "managers"
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    <Shield className="w-3.5 h-3.5" />
                    Manager Award Activity
                </button>
            </div>

            {/* 4. Section Details */}

            {/* SECTION 1: TRENDS & CATEGORIES */}
            {section === "overview" && (
                <div className="space-y-6">
                    {/* Contribution Timeline Chart */}
                    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-amber-400" />
                                Contribution & Delivery Trends Over Time
                            </h3>
                            <span className="text-xs text-slate-500">4 Chronological Sub-Periods</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {analytics.contributionTrends.map((t, idx) => (
                                <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                                    <div className="text-[11px] text-slate-400 font-medium">{t.periodLabel}</div>
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-lg font-bold text-amber-400">+{t.orbits}</span>
                                        <span className="text-xs text-slate-500">Orbits</span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-xs">
                                        <span className="font-semibold text-emerald-400">{t.tasksApproved}</span>
                                        <span className="text-[10px] text-slate-500">tasks approved</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recognition Distribution & Categories */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Categories */}
                        <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-xl space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                                <Award className="w-4 h-4 text-amber-400" />
                                <h3 className="text-sm font-bold text-white">Most Recognized Categories</h3>
                            </div>

                            <div className="space-y-3">
                                {analytics.recognitionDistribution.categories.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-500">
                                        No categorized awards in selected period.
                                    </div>
                                ) : (
                                    analytics.recognitionDistribution.categories.slice(0, 6).map((c) => (
                                        <div key={c.slug} className="space-y-1 text-xs">
                                            <div className="flex justify-between text-slate-300">
                                                <span className="font-medium">{c.name}</span>
                                                <span className="font-bold text-amber-400">
                                                    +{c.points} Orbits ({c.percentage}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-400 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, c.percentage)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Department Distribution */}
                        <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-3xl shadow-xl space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
                                <Building2 className="w-4 h-4 text-indigo-400" />
                                <h3 className="text-sm font-bold text-white">Recognition by Department</h3>
                            </div>

                            <div className="space-y-3">
                                {analytics.recognitionDistribution.departments.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-500">
                                        No department recognition recorded.
                                    </div>
                                ) : (
                                    analytics.recognitionDistribution.departments.map((d) => (
                                        <div key={d.departmentName} className="space-y-1 text-xs">
                                            <div className="flex justify-between text-slate-300">
                                                <span className="font-medium">{d.departmentName}</span>
                                                <span className="font-bold text-indigo-400">
                                                    +{d.points} Orbits ({d.percentage}%)
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                                    style={{ width: `${Math.min(100, d.percentage)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: DEPARTMENT COMPARISON */}
            {section === "departments" && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="p-5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>
                            Comparing operational performance across departments using <strong>normalized metrics</strong>. Empty departments display Insufficient Data.
                        </span>
                        <span>{analytics.departmentComparison.length} Departments</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="py-3 px-4">Department</th>
                                    <th className="py-3 px-4 text-center">Headcount</th>
                                    <th className="py-3 px-4 text-center">Active Contribs</th>
                                    <th className="py-3 px-4 text-center">Tasks Done</th>
                                    <th className="py-3 px-4 text-center">Overdue</th>
                                    <th className="py-3 px-4 text-center">On-Time %</th>
                                    <th className="py-3 px-4 text-center">Avg Orbits/Mbr</th>
                                    <th className="py-3 px-4 text-right">DPI Score</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {analytics.departmentComparison.map((d) => (
                                    <tr key={d.departmentId} className="hover:bg-slate-800/30 transition">
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: d.color || "#6366f1" }}
                                                />
                                                <span className="font-bold text-white text-sm">
                                                    {d.departmentName}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-slate-300 font-medium">
                                            {d.memberCount}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-slate-300 font-medium">
                                            {d.activeContributors}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-emerald-400 font-bold">
                                            {d.tasksCompleted} / {d.tasksAssigned}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            {d.overdueTasks > 0 ? (
                                                <span className="text-rose-400 font-bold">{d.overdueTasks}</span>
                                            ) : (
                                                <span className="text-slate-500">0</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-sky-400 font-bold">
                                            {d.hasSufficientData ? `${d.onTimeDeliveryRate}%` : "—"}
                                        </td>
                                        <td className="py-3.5 px-4 text-center text-amber-400 font-bold">
                                            +{d.orbitsPerMember}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            {d.hasSufficientData && d.dpi !== null ? (
                                                <span className="text-sm font-black text-amber-400">
                                                    {d.dpi} <span className="text-[10px] text-slate-500 font-normal">/ 100</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20" title={d.insufficientDataReason}>
                                                    Insufficient Data
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SECTION 3: LEADERSHIP ANALYTICS */}
            {section === "leadership" && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="p-5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>
                            Department Lead performance analysis. Team failures are never attributed punitively to leads.
                        </span>
                        <span>{analytics.leadershipAnalytics.length} Leaders</span>
                    </div>

                    <div className="divide-y divide-slate-800/60">
                        {analytics.leadershipAnalytics.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-xs">
                                No department leads found.
                            </div>
                        ) : (
                            analytics.leadershipAnalytics.map((lead) => (
                                <div
                                    key={`${lead.departmentId}-${lead.leadId}`}
                                    onClick={() => setSelectedMemberUserId(lead.leadId)}
                                    className="p-5 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                            {lead.avatarUrl ? (
                                                <img src={lead.avatarUrl} alt={lead.leadName} className="w-full h-full object-cover" />
                                            ) : (
                                                <Crown className="w-5 h-5 text-amber-400" />
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white text-sm group-hover:text-amber-400 transition">
                                                    {lead.leadName}
                                                </span>
                                                <span className="text-xs text-slate-400">@{lead.username}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                                                    {lead.roleName}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                                <span>Department:</span>
                                                <span
                                                    className="font-semibold"
                                                    style={{ color: lead.departmentColor || "#818cf8" }}
                                                >
                                                    {lead.departmentName}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lead Performance Stats */}
                                    <div className="flex items-center justify-between md:justify-end gap-6 pl-13 md:pl-0 text-xs">
                                        <div>
                                            <div className="text-slate-400 text-[10px]">Team Participation</div>
                                            <div className="font-bold text-indigo-400 text-sm">
                                                {lead.teamParticipationRate}%
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-slate-400 text-[10px]">Approved Deliverables</div>
                                            <div className="font-bold text-emerald-400 text-sm">
                                                {lead.approvedWorkCount}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-slate-400 text-[10px]">Deadline Reliability</div>
                                            <div className="font-bold text-sky-400 text-sm">
                                                {lead.deadlineReliabilityRate}%
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-slate-400 text-[10px]">Lead Personal</div>
                                            <div className="font-bold text-slate-200 text-sm">
                                                +{lead.leadPersonalOrbits} Orbits
                                            </div>
                                        </div>

                                        <div className="text-right min-w-[90px]">
                                            <div className="text-slate-400 text-[10px]">Department DPI</div>
                                            <div className="text-base font-black text-amber-400">
                                                {lead.hasSufficientData && lead.dpi !== null ? `${lead.dpi}` : "N/A"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* SECTION 4: MANAGER AWARD ACTIVITY */}
            {section === "managers" && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                    <div className="p-5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>
                            Manager-side appreciation velocity and monthly award budget utilization.
                        </span>
                        <span>{analytics.managerAwardActivity.length} Managers</span>
                    </div>

                    <div className="divide-y divide-slate-800/60">
                        {analytics.managerAwardActivity.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-xs">
                                No manager award activity recorded in this period.
                            </div>
                        ) : (
                            analytics.managerAwardActivity.map((mgr) => (
                                <div
                                    key={mgr.managerId}
                                    className="p-5 hover:bg-slate-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                            {mgr.avatarUrl ? (
                                                <img src={mgr.avatarUrl} alt={mgr.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Shield className="w-5 h-5 text-indigo-400" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white text-sm">{mgr.name}</div>
                                            <div className="text-xs text-slate-400">
                                                @{mgr.username} • {mgr.roleTitle}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 pl-13 sm:pl-0 text-xs">
                                        <div>
                                            <div className="text-slate-400 text-[10px]">Awards Issued</div>
                                            <div className="font-bold text-white text-sm">{mgr.awardCount}</div>
                                        </div>

                                        <div>
                                            <div className="text-slate-400 text-[10px]">Total Orbits Given</div>
                                            <div className="font-bold text-amber-400 text-sm">
                                                +{mgr.totalOrbitsAwarded}
                                            </div>
                                        </div>

                                        <div className="text-right min-w-[120px]">
                                            <div className="text-slate-400 text-[10px]">Budget Utilization</div>
                                            <div className="font-bold text-indigo-400 text-sm">
                                                {mgr.budgetUsed} / {mgr.monthlyBudget} Orbits
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-950 rounded-full border border-slate-800 overflow-hidden mt-1">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full"
                                                    style={{
                                                        width: `${Math.min(100, Math.round((mgr.budgetUsed / (mgr.monthlyBudget || 1)) * 100))}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Individual Member Analytics Modal */}
            {selectedMemberUserId && (
                <MemberIndividualAnalyticsModal
                    clubId={clubId}
                    workspaceId={workspaceId}
                    userId={selectedMemberUserId}
                    isOpen={!!selectedMemberUserId}
                    onClose={() => setSelectedMemberUserId(null)}
                />
            )}
        </div>
    );
};
