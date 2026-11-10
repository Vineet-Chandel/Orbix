// Frontend/src/app/Club/TeamWorkspace/Activity/ActivityFeedView.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Activity,
    Filter,
    Users,
    Hash,
    ListTodo,
    FileText,
    RefreshCw,
    Clock,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceActivityEvent,
    WorkspaceDepartment,
    WorkspaceMember,
} from "../../../../types/workspace";

interface ActivityFeedViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    members: WorkspaceMember[];
    onNavigate?: (url: string) => void;
}

const EVENT_TYPE_OPTIONS = [
    { label: "All Events", value: "" },
    { label: "Tasks", value: "task" },
    { label: "Members & Roles", value: "member" },
    { label: "Departments", value: "department" },
    { label: "Channels", value: "channel" },
    { label: "Documents", value: "document" },
];

export const ActivityFeedView: React.FC<ActivityFeedViewProps> = ({
    clubId,
    departments,
    members,
}) => {
    const toast = useToast();
    const [events, setEvents] = useState<WorkspaceActivityEvent[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Filters
    const [selectedDeptId, setSelectedDeptId] = useState<string>("");
    const [selectedActorId, setSelectedActorId] = useState<string>("");
    const [selectedEventType, setSelectedEventType] = useState<string>("");

    // Pagination
    const [offset, setOffset] = useState<number>(0);
    const limit = 25;

    const loadEvents = useCallback(
        async (isRefresh = false, newOffset = 0) => {
            try {
                if (isRefresh) setRefreshing(true);
                else setLoading(true);

                const res = await workspaceApi.getActivityFeed({
                    clubId,
                    departmentId: selectedDeptId || undefined,
                    actorId: selectedActorId || undefined,
                    eventType: selectedEventType || undefined,
                    limit,
                    offset: newOffset,
                });

                if (res?.data) {
                    if (newOffset === 0) {
                        setEvents(res.data.events || []);
                    } else {
                        setEvents((prev) => [...prev, ...(res.data.events || [])]);
                    }
                    setTotal(res.data.total || 0);
                    setOffset(newOffset);
                }
            } catch (err: any) {
                console.error("Failed to load activity feed:", err);
                toast.error(err.message || "Failed to load activity feed.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [clubId, selectedDeptId, selectedActorId, selectedEventType, toast]
    );

    useEffect(() => {
        loadEvents(false, 0);
    }, [loadEvents]);

    const getEventBadge = (eventType: string) => {
        if (eventType.startsWith("task:")) {
            return {
                bg: "bg-indigo-50 border-indigo-200 text-indigo-700",
                icon: <ListTodo className="w-3.5 h-3.5" />,
                group: "TASK",
            };
        }
        if (eventType.startsWith("member:")) {
            return {
                bg: "bg-emerald-50 border-emerald-200 text-emerald-700",
                icon: <Users className="w-3.5 h-3.5" />,
                group: "MEMBER",
            };
        }
        if (eventType.startsWith("channel:")) {
            return {
                bg: "bg-cyan-50 border-cyan-200 text-cyan-700",
                icon: <Hash className="w-3.5 h-3.5" />,
                group: "CHANNEL",
            };
        }
        if (eventType.startsWith("document:")) {
            return {
                bg: "bg-amber-50 border-amber-200 text-amber-700",
                icon: <FileText className="w-3.5 h-3.5" />,
                group: "FILE",
            };
        }
        return {
            bg: "bg-neutral-100 border-neutral-300 text-neutral-700",
            icon: <Activity className="w-3.5 h-3.5" />,
            group: "SYSTEM",
        };
    };

    const renderEventContent = (evt: WorkspaceActivityEvent) => {
        const actor = evt.actor;
        const actorName = actor ? `${actor.firstName} ${actor.lastName}` : "System";
        const meta = evt.metadata || evt.payload || {};

        switch (evt.eventType) {
            case "task:created":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> created task{" "}
                        <span className="font-black text-black">"{evt.title || meta.title || "Untitled"}"</span>
                        {meta.priority && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-neutral-100 border border-neutral-300 rounded">
                                {meta.priority}
                            </span>
                        )}
                    </div>
                );
            case "task:assigned":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> assigned task{" "}
                        <span className="font-black text-black">"{evt.title || meta.title || "a task"}"</span>
                    </div>
                );
            case "task:submitted":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> submitted work for{" "}
                        <span className="font-black text-black">"{evt.title || meta.title || "a task"}"</span>
                    </div>
                );
            case "task:approved":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> approved work on{" "}
                        <span className="font-black text-black">"{evt.title || meta.title || "a task"}"</span>
                    </div>
                );
            case "task:changes_requested":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> requested revisions on{" "}
                        <span className="font-black text-black">"{evt.title || meta.title || "a task"}"</span>
                    </div>
                );
            case "member:joined":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> joined the workspace
                    </div>
                );
            case "member:role_updated":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> updated member role to{" "}
                        <span className="font-bold text-black">{meta.newRoleName || "a new role"}</span>
                    </div>
                );
            case "department:created":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> created department{" "}
                        <span className="font-black text-black">"{evt.title || meta.name || ""}"</span>
                    </div>
                );
            case "channel:created":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> created channel{" "}
                        <span className="font-bold text-black">#{evt.title || meta.name || ""}</span>
                    </div>
                );
            case "document:uploaded":
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> uploaded document{" "}
                        <span className="font-black text-black">"{evt.title || meta.filename || "file"}"</span>
                    </div>
                );
            default:
                return (
                    <div>
                        <span className="font-bold text-neutral-900">{actorName}</span> performed{" "}
                        <span className="font-mono text-xs">{evt.eventType}</span>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b-2 border-black">
                <div>
                    <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Workspace Activity Log
                    </h2>
                    <p className="text-xs text-neutral-600 mt-0.5">
                        Chronological, permission-filtered audit stream of member and task activity
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadEvents(true, 0)}
                        disabled={refreshing}
                        className="px-3 py-1.5 text-xs font-black bg-white hover:bg-neutral-100 border-2 border-black rounded-lg shadow-neo-xs flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-700 mr-2">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter By:</span>
                </div>

                {/* Event Type Filter */}
                <div className="min-w-[140px]">
                    <select
                        value={selectedEventType}
                        onChange={(e) => setSelectedEventType(e.target.value)}
                        className="w-full text-xs font-bold bg-neutral-50 border-2 border-black rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                        {EVENT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Department Filter */}
                <div className="min-w-[160px]">
                    <select
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                        className="w-full text-xs font-bold bg-neutral-50 border-2 border-black rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                        <option value="">All Departments</option>
                        {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                                {dept.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Actor Filter */}
                <div className="min-w-[160px]">
                    <select
                        value={selectedActorId}
                        onChange={(e) => setSelectedActorId(e.target.value)}
                        className="w-full text-xs font-bold bg-neutral-50 border-2 border-black rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                        <option value="">All Members</option>
                        {members.map((mem) => (
                            <option key={mem.userId} value={mem.userId}>
                                {mem.user?.firstName} {mem.user?.lastName} (@{mem.user?.username})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Clear Filters Button */}
                {(selectedDeptId || selectedActorId || selectedEventType) && (
                    <button
                        onClick={() => {
                            setSelectedDeptId("");
                            setSelectedActorId("");
                            setSelectedEventType("");
                        }}
                        className="text-xs font-black text-neutral-600 hover:text-black underline ml-auto"
                    >
                        Reset Filters
                    </button>
                )}
            </div>

            {/* Activity Stream */}
            <div className="bg-white border-2 border-black rounded-xl p-5 shadow-neo">
                {loading && events.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-500 animate-pulse">
                        Loading workspace activity...
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-12 text-center">
                        <Activity className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-neutral-700">No activity events found.</p>
                        <p className="text-xs text-neutral-500 mt-1">
                            {selectedDeptId || selectedActorId || selectedEventType
                                ? "Try adjusting your filter criteria."
                                : "Activity events will be tracked here as your team collaborates."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 space-y-6">
                            {events.map((evt) => {
                                const badge = getEventBadge(evt.eventType);
                                return (
                                    <div key={evt.id} className="relative group">
                                        {/* Dot on line */}
                                        <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-black flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${badge.bg}`}
                                                >
                                                    {badge.icon}
                                                    {badge.group}
                                                </span>
                                                <div className="text-xs text-neutral-800">
                                                    {renderEventContent(evt)}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 shrink-0">
                                                <Clock className="w-3 h-3 text-neutral-400" />
                                                <span>
                                                    {new Date(evt.createdAt).toLocaleDateString([], {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Load More Pagination */}
                        {events.length < total && (
                            <div className="pt-4 border-t border-neutral-100 text-center">
                                <button
                                    onClick={() => loadEvents(false, offset + limit)}
                                    disabled={loading}
                                    className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-lg shadow-neo-xs transition disabled:opacity-50"
                                >
                                    {loading ? "Loading more..." : `Load More (${total - events.length} remaining)`}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
