// Frontend/src/app/Club/TeamWorkspace/Dashboard/WorkspaceOverviewView.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Users,
    FolderKanban,
    CheckCircle2,
    Clock,
    AlertCircle,
    ListTodo,
    Activity,
    ArrowRight,
    RefreshCw,
    TrendingUp,
    Shield,
    FileText,
    MessageSquare,
    ChevronRight,
    Megaphone,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
    WorkspaceDepartment,
    WorkspaceActivityEvent,
    MemberCapabilityResolution,
} from "../../../../types/workspace";

interface WorkspaceOverviewViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    isAdmin: boolean;
    isClubContext?: boolean;
    capabilities?: MemberCapabilityResolution | null;
    onNavigateToSection: (section: "overview" | "departments" | "roster" | "invitations" | "channels" | "all-tasks" | "my-tasks" | "activity" | "audit") => void;
    onSelectDepartment?: (departmentId: string) => void;
}

export const WorkspaceOverviewView: React.FC<WorkspaceOverviewViewProps> = ({
    clubId,
    departments,
    isAdmin,
    isClubContext = false,
    capabilities,
    onNavigateToSection,
    onSelectDepartment,
}) => {
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const isFetchingRef = useRef(false);
    const [metrics, setMetrics] = useState<WorkspaceOverviewMetrics | null>(null);
    const [deptInsights, setDeptInsights] = useState<Record<string, WorkspaceDepartmentInsight>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Filter departments strictly authorized to this user (prevents leaking restricted departments)
    const isGlobalManager = isAdmin || Boolean(capabilities?.capabilities.departments.viewAll);
    const authorizedDepartments = useMemo(() => {
        return departments.filter((d) => {
            if (isGlobalManager) return true;
            const assignedIds = [
                ...(capabilities?.capabilities.departments.memberDepartmentIds || []),
                ...(capabilities?.leadDepartmentIds || []),
            ];
            return assignedIds.includes(d.id);
        });
    }, [departments, isGlobalManager, capabilities]);

    // Stable serialized department key for dependencies
    const authorizedDeptIdsKey = useMemo(() => {
        return authorizedDepartments.slice(0, 8).map((d) => d.id).sort().join(",");
    }, [authorizedDepartments]);

    const loadData = useCallback(async (isRefresh = false) => {
        if (!clubId) return;
        if (isFetchingRef.current && !isRefresh) return;
        isFetchingRef.current = true;

        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const overviewRes = await workspaceApi.getWorkspaceOverview(clubId);
            if (overviewRes?.data) {
                setMetrics(overviewRes.data);
            }

            // Fetch insights only for authorized departments (up to 8)
            const targetDepts = authorizedDepartments.slice(0, 8);
            if (targetDepts.length > 0) {
                const insightsMap: Record<string, WorkspaceDepartmentInsight> = {};

                await Promise.all(
                    targetDepts.map(async (dept) => {
                        try {
                            const insightRes = await workspaceApi.getDepartmentInsight(dept.id, clubId);
                            if (insightRes?.data) {
                                insightsMap[dept.id] = insightRes.data;
                            }
                        } catch {
                            // Suppress individual department permission errors
                        }
                    })
                );

                setDeptInsights(insightsMap);
            }
        } catch (err: any) {
            console.error("Failed to load workspace overview metrics:", err);
            toastRef.current.error(err.message || "Failed to load workspace metrics.");
        } finally {
            setLoading(false);
            setRefreshing(false);
            isFetchingRef.current = false;
        }
    }, [clubId, authorizedDeptIdsKey, authorizedDepartments]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const formatEventDescription = (evt: WorkspaceActivityEvent) => {
        const actorName = evt.actor ? `${evt.actor.firstName} ${evt.actor.lastName}` : "System";
        const meta = evt.metadata || evt.payload || {};
        switch (evt.eventType) {
            case "task:created":
                return `${actorName} created task "${evt.title || meta.title || "Untitled"}"`;
            case "task:submitted":
                return `${actorName} submitted work for "${evt.title || meta.title || "a task"}"`;
            case "task:approved":
                return `${actorName} approved task "${evt.title || meta.title || "a task"}"`;
            case "task:changes_requested":
                return `${actorName} requested revisions on "${evt.title || meta.title || "a task"}"`;
            case "member:joined":
                return `${actorName} joined the workspace`;
            case "member:role_updated":
                return `${actorName} updated member role`;
            case "department:created":
                return `${actorName} created department "${evt.title || meta.name || ""}"`;
            case "channel:created":
                return `${actorName} created channel #${evt.title || meta.name || ""}`;
            case "document:uploaded":
                return `${actorName} shared file "${evt.title || meta.filename || "document"}"`;
            default:
                return `${actorName} performed action ${evt.eventType.replace(/_/g, " ")}`;
        }
    };

    const getEventIcon = (eventType: string) => {
        if (eventType.startsWith("task:")) {
            return <ListTodo className="w-4 h-4 text-indigo-500" />;
        }
        if (eventType.startsWith("member:")) {
            return <Users className="w-4 h-4 text-emerald-500" />;
        }
        if (eventType.startsWith("channel:")) {
            return <MessageSquare className="w-4 h-4 text-cyan-500" />;
        }
        if (eventType.startsWith("document:")) {
            return <FileText className="w-4 h-4 text-amber-500" />;
        }
        return <Activity className="w-4 h-4 text-slate-500" />;
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-28 bg-slate-100 rounded-xl border-2 border-black" />
                    ))}
                </div>
                <div className="h-64 bg-slate-100 rounded-xl border-2 border-black" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Top Overview Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b-2 border-black">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-black text-black tracking-tight">
                            Workspace Overview & Insights
                        </h2>
                        <span className="px-2 py-0.5 text-[10px] font-black border border-black rounded-full bg-yellow-100 text-yellow-800">
                            {isGlobalManager
                                ? "Chapter-Wide Scope"
                                : (capabilities?.leadDepartmentIds?.length || 0) > 0
                                ? `Department Scope (${authorizedDepartments.length} depts)`
                                : "Personal Team Scope"}
                        </span>
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">
                        Real-time operational health, task velocity, and department progress
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className="px-3 py-1.5 text-xs font-black bg-white hover:bg-neutral-100 border-2 border-black rounded-lg shadow-neo-xs flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => onNavigateToSection("audit")}
                            className="px-3 py-1.5 text-xs font-black bg-neutral-900 text-white hover:bg-black border-2 border-black rounded-lg shadow-neo-xs flex items-center gap-1.5 transition"
                        >
                            <Shield className="w-3.5 h-3.5" />
                            <span>Audit Logs</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Relevant Announcements Banner */}
            {metrics?.recentAnnouncements && metrics.recentAnnouncements.length > 0 && (
                <div className="bg-[#FFE566] border-2 border-black rounded-xl p-4 shadow-neo space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-black" />
                            <h4 className="text-xs font-black uppercase text-black tracking-wide">
                                Latest Chapter Announcement
                            </h4>
                        </div>
                        <span className="text-[10px] font-bold text-neutral-800">
                            #{metrics.recentAnnouncements[0].channelName || "announcements"}
                        </span>
                    </div>
                    <p className="text-xs font-bold text-neutral-900 leading-relaxed">
                        {metrics.recentAnnouncements[0].content}
                    </p>
                    <div className="text-[10px] font-medium text-neutral-700 flex items-center justify-between pt-1 border-t border-black/10">
                        <span>
                            Posted by {metrics.recentAnnouncements[0].sender?.firstName || metrics.recentAnnouncements[0].sender?.username || "Lead"}
                        </span>
                        <span>
                            {new Date(metrics.recentAnnouncements[0].createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </div>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* Total Members */}
                <div
                    onClick={() => onNavigateToSection("roster")}
                    className="bg-white border-2 border-black rounded-xl p-4 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition"
                >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px] font-black uppercase">
                        <span>Members</span>
                        <Users className="w-4 h-4 text-black" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-black">
                        {metrics?.totalMembers ?? 0}
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-600 font-bold truncate">
                        {metrics?.activeMembers ?? 0} active
                    </p>
                </div>

                {/* Departments */}
                <div
                    onClick={() => onNavigateToSection("departments")}
                    className="bg-white border-2 border-black rounded-xl p-4 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition"
                >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px] font-black uppercase">
                        <span>Departments</span>
                        <FolderKanban className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-black">
                        {metrics?.totalDepartments ?? authorizedDepartments.length}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-600 font-medium">
                        Operational units
                    </p>
                </div>

                {/* Active Tasks */}
                <div
                    onClick={() => onNavigateToSection("all-tasks")}
                    className="bg-white border-2 border-black rounded-xl p-4 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition"
                >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px] font-black uppercase">
                        <span>Active Tasks</span>
                        <ListTodo className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-black">
                        {metrics?.activeTasks ?? 0}
                    </div>
                    <p className="mt-1 text-[11px] text-indigo-600 font-bold truncate">
                        In flight
                    </p>
                </div>

                {/* Completed Tasks */}
                <div
                    onClick={() => onNavigateToSection("all-tasks")}
                    className="bg-white border-2 border-black rounded-xl p-4 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition"
                >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px] font-black uppercase">
                        <span>Completed</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="mt-2 text-2xl font-black text-black">
                        {metrics?.completedTasks ?? 0}
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700 font-bold truncate">
                        Approved tasks
                    </p>
                </div>

                {/* Overdue Tasks */}
                <div
                    onClick={() => onNavigateToSection("all-tasks")}
                    className={`border-2 border-black rounded-xl p-4 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition ${
                        (metrics?.overdueTasks ?? 0) > 0 ? "bg-red-50" : "bg-white"
                    }`}
                >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px] font-black uppercase">
                        <span>Overdue</span>
                        <AlertCircle className={`w-4 h-4 ${(metrics?.overdueTasks ?? 0) > 0 ? "text-red-600" : "text-neutral-400"}`} />
                    </div>
                    <div className={`mt-2 text-2xl font-black ${(metrics?.overdueTasks ?? 0) > 0 ? "text-red-600" : "text-black"}`}>
                        {metrics?.overdueTasks ?? 0}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-600 font-medium">
                        {(metrics?.overdueTasks ?? 0) > 0 ? "Needs attention" : "On schedule"}
                    </p>
                </div>

                {/* Tasks Awaiting Review */}
                <div
                    onClick={() => onNavigateToSection("all-tasks")}
                    className={`border-2 border-black rounded-xl p-4 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition ${
                        (metrics?.tasksAwaitingReview ?? 0) > 0 ? "bg-amber-50" : "bg-white"
                    }`}
                >
                    <div className="flex items-center justify-between text-neutral-500 text-[11px] font-black uppercase">
                        <span>Submitted</span>
                        <Clock className={`w-4 h-4 ${(metrics?.tasksAwaitingReview ?? 0) > 0 ? "text-amber-600" : "text-neutral-400"}`} />
                    </div>
                    <div className={`mt-2 text-2xl font-black ${(metrics?.tasksAwaitingReview ?? 0) > 0 ? "text-amber-600" : "text-black"}`}>
                        {metrics?.tasksAwaitingReview ?? 0}
                    </div>
                    <p className="mt-1 text-[11px] text-neutral-600 font-medium">
                        {(metrics?.tasksAwaitingReview ?? 0) > 0 ? "Awaiting review" : "Queue clear"}
                    </p>
                </div>
            </div>

            {/* Department Health & Insights Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-black">Department Operational Insights</h3>
                        <p className="text-xs text-neutral-600">Active staffing, completion rates, and submission progress per department</p>
                    </div>
                    <button
                        onClick={() => onNavigateToSection("departments")}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group"
                    >
                        <span>Manage Departments</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </button>
                </div>

                {authorizedDepartments.length === 0 ? (
                    <div className="bg-white border-2 border-black rounded-xl p-8 text-center shadow-neo">
                        <FolderKanban className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-neutral-700">No departments configured or assigned.</p>
                        <p className="text-xs text-neutral-500 mt-1">Set up departments to organize teams and delegate task responsibilities.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {authorizedDepartments.map((dept) => {
                            const insight = deptInsights[dept.id];
                            const totalSub = insight?.submissionProgress?.total || 0;
                            const approvedSub = insight?.submissionProgress?.approved || 0;
                            const approvalPercent = totalSub > 0 ? Math.round((approvedSub / totalSub) * 100) : 0;

                            return (
                                <div
                                    key={dept.id}
                                    onClick={() => onSelectDepartment?.(dept.id)}
                                    className="bg-white border-2 border-black rounded-xl p-5 shadow-neo hover:translate-x-[1px] hover:translate-y-[1px] transition cursor-pointer flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Dept Title & Color Tag */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3.5 h-3.5 rounded-md border border-black shadow-neo-xs"
                                                    style={{ backgroundColor: dept.color || "#4F46E5" }}
                                                />
                                                <span className="font-black text-sm text-black truncate max-w-[180px]">
                                                    {dept.name}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-neutral-100 border border-black rounded-md">
                                                {insight?.memberCount ?? dept.memberCount ?? 0} members
                                            </span>
                                        </div>

                                        {/* Dept Description */}
                                        {dept.description && (
                                            <p className="text-xs text-neutral-600 line-clamp-2 mb-4">
                                                {dept.description}
                                            </p>
                                        )}

                                        {/* Task Health Metrics */}
                                        <div className="grid grid-cols-3 gap-2 py-3 border-y border-neutral-200 text-center my-3">
                                            <div>
                                                <div className="text-xs font-black text-neutral-800">
                                                    {insight?.activeTasks ?? 0}
                                                </div>
                                                <div className="text-[10px] text-neutral-500 font-semibold uppercase">
                                                    Active
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-emerald-600">
                                                    {insight?.completedTasks ?? 0}
                                                </div>
                                                <div className="text-[10px] text-neutral-500 font-semibold uppercase">
                                                    Done
                                                </div>
                                            </div>
                                            <div>
                                                <div className={`text-xs font-black ${(insight?.overdueTasks ?? 0) > 0 ? "text-red-600" : "text-neutral-800"}`}>
                                                    {insight?.overdueTasks ?? 0}
                                                </div>
                                                <div className="text-[10px] text-neutral-500 font-semibold uppercase">
                                                    Overdue
                                                </div>
                                            </div>
                                        </div>

                                        {/* Submission Progress Bar */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600">
                                                <span>Work Approval Rate</span>
                                                <span className="font-black text-black">{approvalPercent}%</span>
                                            </div>
                                            <div className="w-full h-2.5 bg-neutral-100 border border-black rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#A6FF70] transition-all duration-300"
                                                    style={{ width: `${approvalPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] font-bold text-neutral-500">
                                        <span>{totalSub} submissions total</span>
                                        <span className="text-indigo-600 flex items-center gap-0.5">
                                            View details <ChevronRight className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Row: Recent Activity Feed & Architecture Notice */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity Ticker (2 cols) */}
                <div className="lg:col-span-2 bg-white border-2 border-black rounded-xl p-6 shadow-neo space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-600" />
                            <h3 className="text-base font-black text-black">Recent Activity Stream</h3>
                        </div>
                        <button
                            onClick={() => onNavigateToSection("activity")}
                            className="text-xs font-black text-neutral-800 hover:text-black flex items-center gap-1 group"
                        >
                            <span>Full Activity Feed</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                        </button>
                    </div>

                    {(!metrics?.recentActivity || metrics.recentActivity.length === 0) ? (
                        <div className="py-8 text-center text-xs text-neutral-500">
                            No recent activity recorded yet in this workspace.
                        </div>
                    ) : (
                        <div className="space-y-3 divide-y divide-neutral-100">
                            {metrics.recentActivity.slice(0, 7).map((evt) => (
                                <div key={evt.id} className="pt-3 first:pt-0 flex items-start gap-3">
                                    <div className="p-2 bg-neutral-100 border border-black rounded-lg shrink-0 mt-0.5">
                                        {getEventIcon(evt.eventType)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-neutral-900 leading-snug">
                                            {formatEventDescription(evt)}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-1">
                                            <span>
                                                {new Date(evt.createdAt).toLocaleDateString([], {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            {evt.departmentId && (
                                                <span className="font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-300">
                                                    Department
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Quick Shortcuts */}
                <div className="space-y-4">
                    <div className="bg-[#FAF6EE] border-2 border-black rounded-xl p-5 shadow-neo space-y-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-black" />
                            <h4 className="text-sm font-black text-black">Workspace Actions</h4>
                        </div>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Organize departments, assign structured tasks, and securely collaborate across channels.
                        </p>
                        <div className="space-y-2 pt-2">
                            <button
                                onClick={() => onNavigateToSection("all-tasks")}
                                className="w-full py-2 px-3 text-xs font-black bg-white hover:bg-neutral-50 border-2 border-black rounded-lg shadow-neo-xs flex items-center justify-between text-left transition"
                            >
                                <span className="flex items-center gap-2">
                                    <ListTodo className="w-3.5 h-3.5 text-indigo-600" />
                                    Task Workflow Board
                                </span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {!isClubContext && (capabilities ? capabilities.navigation.canViewMyTasks : true) && (
                                <button
                                    onClick={() => onNavigateToSection("my-tasks")}
                                    className="w-full py-2 px-3 text-xs font-black bg-white hover:bg-neutral-50 border-2 border-black rounded-lg shadow-neo-xs flex items-center justify-between text-left transition"
                                >
                                    <span className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        My Assigned Tasks
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}

                            <button
                                onClick={() => onNavigateToSection("channels")}
                                className="w-full py-2 px-3 text-xs font-black bg-white hover:bg-neutral-50 border-2 border-black rounded-lg shadow-neo-xs flex items-center justify-between text-left transition"
                            >
                                <span className="flex items-center gap-2">
                                    <MessageSquare className="w-3.5 h-3.5 text-cyan-600" />
                                    Channels & Collaboration
                                </span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
