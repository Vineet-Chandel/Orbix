// Frontend/src/app/Club/TeamWorkspace/Tasks/MyTasksView.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    FileEdit,
    Shield,
    Calendar,
    CheckSquare,
    Loader2,
    RefreshCw,
    FolderKanban,
    Lock,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceTask,
    WorkspaceMember,
    WorkspaceDepartment,
    WorkspaceRole,
} from "../../../../types/workspace";
import { TaskDetailModal } from "./TaskDetailModal";
import { useToast } from "../../../../context/ToastContext";

interface MyTasksViewProps {
    clubId: string;
    currentMember: WorkspaceMember | null;
    allMembers: WorkspaceMember[];
    departments: WorkspaceDepartment[];
    roles?: WorkspaceRole[];
}

type MyTasksTab =
    | "assigned_to_me"
    | "created_by_me"
    | "due_soon"
    | "overdue"
    | "completed"
    | "awaiting_review";

const TABS: Array<{ id: MyTasksTab; label: string; icon: any; color: string }> = [
    { id: "assigned_to_me", label: "Assigned to Me", icon: UserCheck, color: "text-indigo-600" },
    { id: "created_by_me", label: "Created by Me", icon: FileEdit, color: "text-blue-600" },
    { id: "due_soon", label: "Due Soon", icon: Clock, color: "text-amber-600" },
    { id: "overdue", label: "Overdue", icon: AlertCircle, color: "text-red-600" },
    { id: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-600" },
    { id: "awaiting_review", label: "Awaiting Review", icon: Shield, color: "text-purple-600" },
];

export const MyTasksView: React.FC<MyTasksViewProps> = ({
    clubId,
    currentMember,
    allMembers,
    departments,
}) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<MyTasksTab>("assigned_to_me");
    const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const loadTabTasks = useCallback(async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getMyTasks(activeTab, clubId);
            if (res.success) {
                setTasks(res.tasks || []);
            }
        } catch (err: any) {
            console.error("Failed to load my tasks:", err);
            toast.error("Failed to load your tasks.");
        } finally {
            setLoading(false);
        }
    }, [activeTab, clubId]);

    useEffect(() => {
        loadTabTasks();
    }, [loadTabTasks]);

    return (
        <div className="flex-1 flex flex-col h-full bg-[#FAF6EE] overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 bg-white border-b-2 border-black space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-xl shadow-neo-xs">
                            <CheckCircle2 className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-black">My Delegations & Tasks</h1>
                            <p className="text-xs font-semibold text-neutral-600">
                                Personal dashboard for active delegations, deadlines, and deliverables
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => loadTabTasks()}
                        className="p-2.5 bg-white border-2 border-black rounded-xl text-neutral-600 hover:text-black hover:bg-neutral-100 transition shadow-neo-xs self-start sm:self-auto"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-neutral-100">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                                    isActive
                                        ? "bg-black text-white border-black shadow-neo-xs"
                                        : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                                }`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#A6FF70]" : tab.color}`} />
                                {tab.label}
                                {isActive && !loading && (
                                    <span className="ml-1 px-1.5 py-0.2 bg-white/20 text-white rounded text-[10px]">
                                        {tasks.length}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Task Cards Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loading ? (
                    <div className="p-12 flex items-center justify-center text-neutral-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-black" />
                        <span className="text-sm font-bold">Loading tasks...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="p-12 text-center bg-white border-2 border-black rounded-2xl shadow-neo max-w-md mx-auto my-12 space-y-2">
                        <div className="p-3 bg-neutral-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto border border-neutral-300">
                            <CheckSquare className="w-6 h-6 text-neutral-400" />
                        </div>
                        <h3 className="text-sm font-black text-black">No tasks found</h3>
                        <p className="text-xs text-neutral-600 font-medium">
                            You currently have no tasks in the <b>{activeTab.replace(/_/g, " ")}</b> view.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
                        {tasks.map((task) => {
                            const completedCount =
                                task.checklist?.filter((c) => c.isCompleted).length || 0;
                            const totalCount = task.checklist?.length || 0;
                            const isOverdue =
                                task.dueDate &&
                                new Date(task.dueDate) < new Date() &&
                                task.status !== "completed" &&
                                task.status !== "archived";

                            return (
                                <div
                                    key={task.id}
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className="p-5 bg-white border-2 border-black rounded-2xl shadow-neo hover:-translate-y-0.5 transition cursor-pointer flex flex-col justify-between space-y-3"
                                >
                                    <div className="space-y-2.5">
                                        {/* Status & Priority Row */}
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border border-black bg-neutral-100 text-black">
                                                {task.status.replace("_", " ")}
                                            </span>

                                            <div className="flex items-center gap-1.5">
                                                {task.isRestricted && (
                                                    <span className="p-1 rounded bg-amber-100 border border-amber-300 text-amber-900" title="Restricted Task">
                                                        <Lock className="w-3 h-3" />
                                                    </span>
                                                )}
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border border-black ${
                                                        task.priority === "urgent"
                                                            ? "bg-rose-100 text-rose-900"
                                                            : task.priority === "high"
                                                            ? "bg-amber-100 text-amber-900"
                                                            : "bg-blue-50 text-blue-900"
                                                    }`}
                                                >
                                                    {task.priority}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Department pill */}
                                        {task.department && (
                                            <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-600">
                                                <FolderKanban className="w-3 h-3 text-neutral-400" />
                                                <span>{task.department.name}</span>
                                            </div>
                                        )}

                                        {/* Title */}
                                        <h3 className="text-sm font-black text-black leading-snug line-clamp-2">
                                            {task.title}
                                        </h3>

                                        {/* Description preview */}
                                        {task.description && (
                                            <p className="text-xs text-neutral-600 line-clamp-2 font-medium">
                                                {task.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Bottom Info: Due Date, Checklist, Assignees */}
                                    <div className="pt-3 border-t border-neutral-100 space-y-2">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            {task.dueDate ? (
                                                <span
                                                    className={`flex items-center gap-1 text-[11px] ${
                                                        isOverdue
                                                            ? "text-red-600 font-black"
                                                            : "text-neutral-600"
                                                    }`}
                                                >
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                    {isOverdue && " (Overdue)"}
                                                </span>
                                            ) : (
                                                <span className="text-neutral-400 text-[11px]">No deadline</span>
                                            )}

                                            {totalCount > 0 && (
                                                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                                                    {completedCount}/{totalCount} items
                                                </span>
                                            )}
                                        </div>

                                        {/* Assignees circles */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-neutral-500 font-bold">
                                                Created by {task.creator?.firstName || "Member"}
                                            </span>
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {(task.currentAssignees || []).map((a) => (
                                                    <div
                                                        key={a.id}
                                                        title={`${a.user?.firstName} ${a.user?.lastName}`}
                                                        className="w-5 h-5 rounded-full bg-neutral-200 border border-black flex items-center justify-center text-[9px] font-black text-black"
                                                    >
                                                        {a.user?.firstName?.charAt(0) || "?"}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Task Detail Modal */}
            {selectedTaskId && (
                <TaskDetailModal
                    isOpen={Boolean(selectedTaskId)}
                    onClose={() => setSelectedTaskId(null)}
                    taskId={selectedTaskId}
                    clubId={clubId}
                    currentMember={currentMember}
                    allMembers={allMembers}
                    departments={departments}
                    onTaskUpdated={() => loadTabTasks()}
                />
            )}
        </div>
    );
};
