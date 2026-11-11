// Frontend/src/app/Club/TeamWorkspace/Recognition/ThreeLeaderboardsView.tsx
import React, { useState, useEffect } from "react";
import {
    Trophy,
    Award,
    Medal,
    Lightbulb,
    TrendingUp,
    TrendingDown,
    Minus,
    Sparkles,
    Building2,
    Crown,
    Users,
    Clock,
    CheckCircle2,
    Info,
    Filter,
    RefreshCw,
    X,
    Percent,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { NeoSelect } from "../../../../components/NeoSelect";
import type {
    LeaderboardPeriod,
    ThreeLeaderboardsResponse,
    DepartmentLeaderboardEntry,
    WorkspaceDepartment,
} from "../../../../types/workspace";
import { MemberRecognitionProfileModal } from "./MemberRecognitionProfileModal";

interface ThreeLeaderboardsViewProps {
    clubId: string;
    workspaceId?: string;
    departments: WorkspaceDepartment[];
    isOwner: boolean;
    isWorkspaceManager: boolean;
}

export const ThreeLeaderboardsView: React.FC<ThreeLeaderboardsViewProps> = ({
    clubId,
    workspaceId,
    departments,
    isOwner: _isOwner,
    isWorkspaceManager: _isWorkspaceManager,
}) => {
    // Active leaderboard type: contributors | leads | departments
    const [activeBoard, setActiveBoard] = useState<"contributors" | "leads" | "departments">("contributors");
    const [period, setPeriod] = useState<LeaderboardPeriod>("this_month");
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    // Data state
    const [data, setData] = useState<ThreeLeaderboardsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Selected member for profile modal
    const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

    // Selected department for DPI Inspection modal
    const [inspectedDept, setInspectedDept] = useState<DepartmentLeaderboardEntry | null>(null);

    const loadLeaderboards = async (isManual = false) => {
        try {
            if (isManual) setRefreshing(true);
            else setLoading(true);

            const deptArg = departmentFilter !== "all" ? departmentFilter : undefined;
            const res = await workspaceApi.getLeaderboards(period, deptArg, clubId, workspaceId);

            if (res.success && res.leaderboards) {
                setData(res.leaderboards);
            }
        } catch (err) {
            console.error("[ThreeLeaderboardsView] Failed to load leaderboards:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadLeaderboards();
    }, [period, departmentFilter, clubId, workspaceId]);

    const getRankBadge = (rank: number, hasSufficientData = true) => {
        if (!hasSufficientData || rank === 0) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Unranked
                </span>
            );
        }
        if (rank === 1) {
            return (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 text-sm" title="1st Place">
                    <Trophy className="w-4 h-4 text-amber-300 stroke-[2.5]" />
                </span>
            );
        }
        if (rank === 2) {
            return (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 font-bold border border-slate-300/30 text-sm" title="2nd Place">
                    <Medal className="w-4 h-4 text-slate-200 stroke-[2.5]" />
                </span>
            );
        }
        if (rank === 3) {
            return (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 font-bold border border-amber-700/30 text-sm" title="3rd Place">
                    <Award className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                </span>
            );
        }
        return (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-bold text-xs border border-slate-700">
                #{rank}
            </span>
        );
    };

    const renderTrend = (trend: { rankChange: number | "new"; pointsDelta?: number; dpiDelta?: number; direction: "up" | "down" | "same" | "new" }) => {
        if (trend.direction === "new") {
            return (
                <span className="inline-flex items-center text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    <Sparkles className="w-3 h-3 mr-1" /> New
                </span>
            );
        }
        if (trend.direction === "up") {
            return (
                <span className="inline-flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {typeof trend.rankChange === "number" && trend.rankChange > 0 ? `+${trend.rankChange}` : "Up"}
                </span>
            );
        }
        if (trend.direction === "down") {
            return (
                <span className="inline-flex items-center text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    {typeof trend.rankChange === "number" && trend.rankChange < 0 ? `${trend.rankChange}` : "Down"}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center text-xs text-slate-400">
                <Minus className="w-3 h-3 mr-1" /> Same
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* 1. Header & Controls */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    Orbix Three Leaderboards
                                </h2>
                                <p className="text-xs text-slate-400">
                                    Transparent performance rankings divided across Contributors, Department Leads, and Departments.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Period Selector Tabs */}
                    <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                        {(
                            [
                                { id: "this_week", label: "This Week" },
                                { id: "this_month", label: "This Month" },
                                { id: "last_30_days", label: "Last 30 Days" },
                                { id: "last_90_days", label: "Last 90 Days" },
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
                            onClick={() => loadLeaderboards(true)}
                            disabled={refreshing}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            title="Refresh rankings"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
                        </button>
                    </div>
                </div>

                {/* Current Member Position Banner */}
                {data?.currentMemberPosition && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {data.currentMemberPosition.type === "contributor" && (
                            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl text-indigo-300 w-full sm:w-auto">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span>
                                    Your Contributor Standing:{" "}
                                    <strong className="text-white font-semibold">
                                        Rank #{data.currentMemberPosition.rank || "N/A"}
                                    </strong>{" "}
                                    with{" "}
                                    <strong className="text-amber-400 font-semibold">
                                        +{data.currentMemberPosition.orbits || 0} Orbits
                                    </strong>
                                    {data.currentMemberPosition.departmentName && (
                                        <span className="text-slate-400 ml-1">
                                            ({data.currentMemberPosition.departmentName})
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}

                        {data.currentMemberPosition.type === "lead" && (
                            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-amber-300 w-full sm:w-auto">
                                <Crown className="w-4 h-4 text-amber-400" />
                                <span>
                                    Department Leadership Standing:{" "}
                                    <strong className="text-white font-semibold">
                                        Rank #{data.currentMemberPosition.rank || "N/A"}
                                    </strong>{" "}
                                    (Team DPI:{" "}
                                    <strong className="text-amber-400 font-semibold">
                                        {data.currentMemberPosition.dpi ?? "N/A"}
                                    </strong>
                                    , Personal:{" "}
                                    <strong className="text-white">
                                        +{data.currentMemberPosition.orbits || 0} Orbits
                                    </strong>
                                    ) in {data.currentMemberPosition.departmentName}
                                </span>
                            </div>
                        )}

                        {data.currentMemberPosition.type === "excluded_manager" && (
                            <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/40 px-3 py-2 rounded-xl text-slate-300 w-full sm:w-auto">
                                <Info className="w-4 h-4 text-slate-400" />
                                <span>
                                    <strong>Workspace Administration:</strong> Club and Workspace Managers are exempt from competitive contributor boards to preserve member appreciation fairness.
                                </span>
                            </div>
                        )}

                        <div className="text-slate-500 text-[11px] flex items-center gap-2">
                            <span>Formula: <strong>{data.formulaVersion || "v1.0"}</strong></span>
                            <span>•</span>
                            <span>Ties: <strong>Competition Standard (1st, 1st, 3rd)</strong></span>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Board Type Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                        onClick={() => setActiveBoard("contributors")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                            activeBoard === "contributors"
                                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        Contributors
                        {data?.contributors && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
                                {data.contributors.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveBoard("leads")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                            activeBoard === "leads"
                                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <Crown className="w-4 h-4" />
                        Department Leads
                        {data?.leads && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
                                {data.leads.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveBoard("departments")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                            activeBoard === "departments"
                                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                                : "text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <Building2 className="w-4 h-4" />
                        Departments (DPI)
                        {data?.departments && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
                                {data.departments.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Department filter (active on Contributors board) */}
                {activeBoard === "contributors" && (
                    <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <NeoSelect
                            value={departmentFilter}
                            onChange={(val) => setDepartmentFilter(val)}
                            options={[
                                { value: "all", label: "All Departments" },
                                ...departments.map((d) => ({
                                    value: d.id,
                                    label: d.name,
                                })),
                            ]}
                            placeholder="All Departments"
                            size="sm"
                        />
                    </div>
                )}
            </div>

            {/* 3. Leaderboard Contents */}
            {loading ? (
                <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Loading rankings...</p>
                </div>
            ) : (
                <>
                    {/* BOARD 1: CONTRIBUTORS */}
                    {activeBoard === "contributors" && (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                <span>
                                    Ranked by <strong>net Orbits earned</strong> in selected period. Club Manager, Workspace Manager, and Department Leads are excluded.
                                </span>
                                <span>{data?.contributors.length || 0} Eligible Contributors</span>
                            </div>

                            {data?.contributors && data.contributors.length > 0 ? (
                                <div className="divide-y divide-slate-800/60">
                                    {data.contributors.map((c) => (
                                        <div
                                            key={c.userId}
                                            onClick={() => setSelectedProfileUserId(c.userId)}
                                            className="p-4 hover:bg-slate-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 flex justify-center">
                                                    {getRankBadge(c.rank)}
                                                </div>

                                                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0">
                                                    {c.avatarUrl ? (
                                                        <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-400 bg-amber-500/10">
                                                            {c.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-white group-hover:text-amber-400 transition text-sm">
                                                            {c.name}
                                                        </span>
                                                        <span className="text-xs text-slate-400">@{c.username}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {c.departmentName ? (
                                                            <span
                                                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                                                style={{
                                                                    backgroundColor: `${c.departmentColor || "#6366f1"}20`,
                                                                    color: c.departmentColor || "#818cf8",
                                                                }}
                                                            >
                                                                {c.departmentName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-500">General</span>
                                                        )}
                                                        <span className="text-[10px] text-slate-500">• {c.roleName}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Category Breakdown & Points */}
                                            <div className="flex items-center justify-between sm:justify-end gap-6 pl-11 sm:pl-0">
                                                {/* Category Breakdown Chips */}
                                                <div className="hidden lg:flex items-center gap-1.5">
                                                    {Object.entries(c.categoryBreakdown).slice(0, 3).map(([slug, cat]) => (
                                                        <span
                                                            key={slug}
                                                            className="text-[10px] bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded text-slate-300"
                                                            title={`${cat.name}: ${cat.points} Orbits (${cat.count} awards)`}
                                                        >
                                                            {cat.name}: +{cat.points}
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Trend */}
                                                <div className="flex flex-col items-end">
                                                    {renderTrend(c.trend)}
                                                </div>

                                                {/* Orbits Score */}
                                                <div className="text-right min-w-[90px]">
                                                    <div className="text-base font-bold text-amber-400 flex items-center justify-end gap-1">
                                                        <Award className="w-4 h-4 text-amber-500" />
                                                        +{c.orbitsEarned}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {c.awardsCount} {c.awardsCount === 1 ? "award" : "awards"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    <Award className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-slate-300">No contributor awards recorded</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Awards given to non-lead members during this period will appear here.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BOARD 2: DEPARTMENT LEADS */}
                    {activeBoard === "leads" && (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                <span>
                                    Ranked primarily by their department's <strong>Department Performance Index (DPI)</strong>. Personal Orbits are displayed separately.
                                </span>
                                <span>{data?.leads.length || 0} Leads & Co-Leads</span>
                            </div>

                            {data?.leads && data.leads.length > 0 ? (
                                <div className="divide-y divide-slate-800/60">
                                    {data.leads.map((l) => (
                                        <div
                                            key={`${l.departmentId}-${l.userId}`}
                                            className="p-4 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 flex justify-center">
                                                    {getRankBadge(l.rank, l.hasSufficientData)}
                                                </div>

                                                <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/30 overflow-hidden flex-shrink-0">
                                                    {l.avatarUrl ? (
                                                        <img src={l.avatarUrl} alt={l.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-amber-400 bg-amber-500/10">
                                                            {l.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            onClick={() => setSelectedProfileUserId(l.userId)}
                                                            className="font-semibold text-white hover:text-amber-400 transition cursor-pointer text-sm"
                                                        >
                                                            {l.name}
                                                        </span>
                                                        <span className="text-xs text-slate-400">@{l.username}</span>
                                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.2 rounded-full font-medium">
                                                            {l.roleName}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                                                        <span
                                                            className="font-medium"
                                                            style={{ color: l.departmentColor || "#818cf8" }}
                                                        >
                                                            {l.departmentName}
                                                        </span>
                                                        {l.isCoLead && l.coLeads && l.coLeads.length > 0 && (
                                                            <span className="text-[11px] text-slate-400">
                                                                (Shared with {l.coLeads.map((c) => c.name).join(", ")})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Department DPI & Stats */}
                                            <div className="flex items-center justify-between md:justify-end gap-6 pl-11 md:pl-0">
                                                {/* Delivery stats pills */}
                                                <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400">
                                                    <div className="flex items-center gap-1" title="Approved Tasks Rate">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span>{l.deliveryStatistics.approvedTaskDeliveryRate}% approved</span>
                                                    </div>
                                                    <div className="flex items-center gap-1" title="On-Time Delivery Rate">
                                                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                                                        <span>{l.deliveryStatistics.onTimeDeliveryRate}% on-time</span>
                                                    </div>
                                                    <div className="flex items-center gap-1" title="Participation Rate">
                                                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                                                        <span>{l.deliveryStatistics.participationRate}% participation</span>
                                                    </div>
                                                </div>

                                                {/* Lead's Personal Orbits (separate) */}
                                                <div className="text-right">
                                                    <div className="text-xs font-semibold text-slate-200">
                                                        +{l.leadPersonalOrbits} Orbits
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">Lead Personal</div>
                                                </div>

                                                {/* Department Performance Index (Criterion) */}
                                                <div className="text-right min-w-[100px]">
                                                    {l.hasSufficientData && l.departmentPerformanceIndex !== null ? (
                                                        <>
                                                            <div className="text-base font-bold text-amber-400">
                                                                {l.departmentPerformanceIndex}{" "}
                                                                <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">Department DPI</div>
                                                        </>
                                                    ) : (
                                                        <div className="text-right">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                Insufficient Data
                                                            </span>
                                                            <div className="text-[10px] text-slate-500 mt-0.5">Need &gt;=1 task</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400">
                                    <Crown className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-slate-300">No Department Leads found</p>
                                    <p className="text-xs text-slate-500 mt-1">Assign department leads to enable leadership rankings.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BOARD 3: DEPARTMENTS (DPI) */}
                    {activeBoard === "departments" && (
                        <div className="space-y-4">
                            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                    <span>
                                        Ranked by <strong>Department Performance Index (0–100)</strong> calculated from verified task delivery, on-time submissions, active participation, and capped recognition.
                                    </span>
                                    <span>{data?.departments.length || 0} Departments</span>
                                </div>

                                {data?.departments && data.departments.length > 0 ? (
                                    <div className="divide-y divide-slate-800/60">
                                        {data.departments.map((dept) => (
                                            <div
                                                key={dept.departmentId}
                                                className="p-5 hover:bg-slate-800/30 transition flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-8 flex justify-center pt-1">
                                                        {getRankBadge(dept.rank, dept.hasSufficientData)}
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: dept.departmentColor || "#6366f1" }}
                                                            />
                                                            <h3 className="text-base font-bold text-white tracking-tight">
                                                                {dept.departmentName}
                                                            </h3>
                                                        </div>

                                                        {/* Leads list */}
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                            <span>Lead:</span>
                                                            {dept.leadUser ? (
                                                                <span className="text-slate-200 font-medium">
                                                                    {dept.leadUser.name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500">Unassigned</span>
                                                            )}
                                                            {dept.coLeadUsers && dept.coLeadUsers.length > 0 && (
                                                                <span>
                                                                    (Co-leads: {dept.coLeadUsers.map((c) => c.name).join(", ")})
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* 4 DPI Components Breakdown */}
                                                        {dept.hasSufficientData && (
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                                                                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                                                    <div className="text-[10px] text-slate-400">Approved Tasks (35%)</div>
                                                                    <div className="font-semibold text-emerald-400 mt-0.5">
                                                                        {dept.approvedTaskDeliveryRate}%
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        {dept.metrics.tasksApproved} of {dept.metrics.tasksDue} due
                                                                    </div>
                                                                </div>

                                                                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                                                    <div className="text-[10px] text-slate-400">On-Time (35%)</div>
                                                                    <div className="font-semibold text-sky-400 mt-0.5">
                                                                        {dept.onTimeDeliveryRate}%
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        {dept.metrics.tasksOnTime} on-schedule
                                                                    </div>
                                                                </div>

                                                                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                                                    <div className="text-[10px] text-slate-400">Participation (20%)</div>
                                                                    <div className="font-semibold text-indigo-400 mt-0.5">
                                                                        {dept.activeParticipationRate}%
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        {dept.metrics.participatingMemberCount} of {dept.metrics.activeMemberCount} active
                                                                    </div>
                                                                </div>

                                                                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                                                    <div className="text-[10px] text-slate-400">Recognition (10%)</div>
                                                                    <div className="font-semibold text-amber-400 mt-0.5">
                                                                        {dept.normalizedRecognitionScore}%
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        avg {dept.metrics.rawOrbitsPerMember} pts (capped 50)
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* DPI Score & Action */}
                                                <div className="flex sm:flex-row lg:flex-col items-end justify-between gap-3 min-w-[140px] pl-12 lg:pl-0">
                                                    <div className="text-right">
                                                        {dept.hasSufficientData && dept.departmentPerformanceIndex !== null ? (
                                                            <div>
                                                                <div className="text-2xl font-black text-amber-400 flex items-center justify-end gap-1">
                                                                    {dept.departmentPerformanceIndex}
                                                                    <span className="text-xs text-slate-400 font-normal">/ 100</span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 font-medium">
                                                                    Performance Index
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                                    Insufficient Data
                                                                </span>
                                                                <div className="text-[11px] text-slate-500 mt-1">
                                                                    {dept.insufficientDataReason || "No activity in period"}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => setInspectedDept(dept)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                                                    >
                                                        <Info className="w-3.5 h-3.5" />
                                                        Inspect Formula
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-12 text-center text-slate-400">
                                        <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-slate-300">No departments configured</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 4. DPI Formula & Metrics Inspection Modal */}
            {inspectedDept && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                    <Percent className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">
                                        DPI Inspection: {inspectedDept.departmentName}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Formula Version: {inspectedDept.formulaVersion}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setInspectedDept(null)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Formula Components & Weights
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <div className="text-slate-400">Approved Task Delivery:</div>
                                        <div className="font-semibold text-white">
                                            {inspectedDept.weightsUsed.approvedTasks}% weight
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400">On-Time Delivery Rate:</div>
                                        <div className="font-semibold text-white">
                                            {inspectedDept.weightsUsed.onTime}% weight
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400">Active Participation:</div>
                                        <div className="font-semibold text-white">
                                            {inspectedDept.weightsUsed.participation}% weight
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400">Normalized Recognition:</div>
                                        <div className="font-semibold text-white">
                                            {inspectedDept.weightsUsed.recognition}% weight
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Underlying Verified Metrics
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Tasks Evaluated:</div>
                                        <div className="font-bold text-white text-sm">{inspectedDept.metrics.tasksDue}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Tasks Approved:</div>
                                        <div className="font-bold text-emerald-400 text-sm">{inspectedDept.metrics.tasksApproved}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Tasks On-Time:</div>
                                        <div className="font-bold text-sky-400 text-sm">{inspectedDept.metrics.tasksOnTime}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Blocked Tasks:</div>
                                        <div className="font-bold text-amber-400 text-sm">{inspectedDept.metrics.tasksBlocked}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Active Members:</div>
                                        <div className="font-bold text-white text-sm">{inspectedDept.metrics.activeMemberCount}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Contributing Members:</div>
                                        <div className="font-bold text-indigo-400 text-sm">{inspectedDept.metrics.participatingMemberCount}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Total Dept Orbits:</div>
                                        <div className="font-bold text-amber-400 text-sm">+{inspectedDept.metrics.totalDepartmentOrbits}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Raw Orbits/Member:</div>
                                        <div className="font-bold text-white text-sm">{inspectedDept.metrics.rawOrbitsPerMember}</div>
                                    </div>
                                    <div className="p-2 bg-slate-900 rounded-lg">
                                        <div className="text-slate-400">Capped (Max 50):</div>
                                        <div className="font-bold text-white text-sm">{inspectedDept.metrics.cappedOrbitsPerMember}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="text-xs text-slate-400 leading-relaxed bg-slate-800/30 p-3 rounded-lg border border-slate-800 flex items-start gap-2">
                                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong>Safeguards Policy:</strong> Cancelled tasks and archived tasks are excluded from performance evaluation. Normalized recognition is capped per member to prevent point inflation from skewing operational delivery metrics.
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                            <button
                                onClick={() => setInspectedDept(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Member Profile Modal */}
            {selectedProfileUserId && (
                <MemberRecognitionProfileModal
                    clubId={clubId}
                    userId={selectedProfileUserId}
                    isOpen={!!selectedProfileUserId}
                    onClose={() => setSelectedProfileUserId(null)}
                />
            )}
        </div>
    );
};
