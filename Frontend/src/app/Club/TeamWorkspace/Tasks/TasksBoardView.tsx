// Frontend/src/app/Club/TeamWorkspace/Tasks/TasksBoardView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Plus,
    Search,
    Kanban,
    List,
    CheckSquare,
    Calendar,
    Lock,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceTask,
    WorkspaceTaskStatus,
    WorkspaceTaskPriority,
    WorkspaceDepartment,
    WorkspaceMember,
    WorkspaceRole,
} from "../../../../types/workspace";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { useToast } from "../../../../context/ToastContext";

interface TasksBoardViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    members: WorkspaceMember[];
    roles: WorkspaceRole[];
    currentMember: WorkspaceMember | null;
    canCreateTasks: boolean;
}

const KANBAN_COLUMNS: Array<{ id: WorkspaceTaskStatus; title: string; color: string }> = [
    { id: "draft", title: "Draft", color: "bg-slate-100 border-slate-300" },
    { id: "assigned", title: "Assigned", color: "bg-indigo-50 border-indigo-300" },
    { id: "in_progress", title: "In Progress", color: "bg-blue-50 border-blue-300" },
    { id: "blocked", title: "Blocked", color: "bg-amber-50 border-amber-300" },
    { id: "submitted", title: "Submitted", color: "bg-purple-50 border-purple-300" },
    { id: "changes_requested", title: "Changes Req.", color: "bg-orange-50 border-orange-300" },
    { id: "approved", title: "Approved", color: "bg-teal-50 border-teal-300" },
    { id: "completed", title: "Completed", color: "bg-emerald-50 border-emerald-300" },
];

export const TasksBoardView: React.FC<TasksBoardViewProps> = ({
    clubId,
    departments,
    members,
    roles,
    currentMember,
    canCreateTasks,
}) => {
    const toast = useToast();
    const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

    // Filters
    const [search, setSearch] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
    const [selectedPriority, setSelectedPriority] = useState<string>("all");
    const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
    const [includeArchived, setIncludeArchived] = useState(false);

    // Modals
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const loadTasks = useCallback(async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.listTasks({
                clubId,
                departmentId: selectedDepartment !== "all" ? selectedDepartment : undefined,
                priority: selectedPriority !== "all" ? (selectedPriority as WorkspaceTaskPriority) : undefined,
                assigneeUserId: selectedAssignee !== "all" ? selectedAssignee : undefined,
                search: search.trim() || undefined,
                isArchived: includeArchived,
                limit: 200,
            });

            if (res.success) {
                setTasks(res.tasks || []);
            }
        } catch (err: any) {
            console.error("Failed to load tasks:", err);
            toast.error("Failed to load workspace tasks.");
        } finally {
            setLoading(false);
        }
    }, [clubId, selectedDepartment, selectedPriority, selectedAssignee, search, includeArchived]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Group tasks by status for Kanban columns
    const kanbanTasks = useMemo(() => {
        const map: Record<string, WorkspaceTask[]> = {};
        for (const col of KANBAN_COLUMNS) {
            map[col.id] = [];
        }
        for (const t of tasks) {
            if (map[t.status]) {
                map[t.status].push(t);
            }
        }
        return map;
    }, [tasks]);

    return (
        <div className="flex-1 flex flex-col h-full bg-[#FAF6EE] overflow-hidden">
            {/* Top Toolbar */}
            <div className="p-4 sm:p-6 bg-white border-b-2 border-black space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-xl shadow-neo-xs">
                                <Kanban className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-black">Workspace Tasks</h1>
                                <p className="text-xs font-semibold text-neutral-600">
                                    Track delegations, deliverable reviews, and cross-functional progress
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Switcher */}
                        <div className="flex bg-neutral-100 border-2 border-black rounded-xl p-1 shadow-neo-xs">
                            <button
                                onClick={() => setViewMode("kanban")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                                    viewMode === "kanban"
                                        ? "bg-white text-black shadow-neo-xs border border-black"
                                        : "text-neutral-600 hover:text-black"
                                }`}
                            >
                                <Kanban className="w-3.5 h-3.5" /> Board
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                                    viewMode === "list"
                                        ? "bg-white text-black shadow-neo-xs border border-black"
                                        : "text-neutral-600 hover:text-black"
                                }`}
                            >
                                <List className="w-3.5 h-3.5" /> List
                            </button>
                        </div>

                        {/* Reload */}
                        <button
                            onClick={() => loadTasks()}
                            className="p-2.5 bg-white border-2 border-black rounded-xl text-neutral-600 hover:text-black hover:bg-neutral-100 transition shadow-neo-xs"
                            title="Refresh Tasks"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>

                        {/* Create Task Button */}
                        {canCreateTasks && (
                            <button
                                onClick={() => setIsCreateOpen(true)}
                                className="px-4 py-2 bg-[#A6FF70] hover:bg-[#92ec5d] text-black border-2 border-black rounded-xl text-xs font-black transition shadow-neo flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" /> Create Task
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter by title or keyword..."
                            className="w-full pl-8 pr-3 py-1.5 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none"
                        />
                    </div>

                    {/* Department Filter */}
                    <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none"
                    >
                        <option value="all">All Departments</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>

                    {/* Priority Filter */}
                    <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none"
                    >
                        <option value="all">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>

                    {/* Assignee Filter */}
                    <select
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black focus:outline-none"
                    >
                        <option value="all">All Assignees</option>
                        {members.map((m) => (
                            <option key={m.id} value={m.userId}>
                                {m.user?.firstName} {m.user?.lastName}
                            </option>
                        ))}
                    </select>

                    {/* Archived toggle */}
                    <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 cursor-pointer ml-2">
                        <input
                            type="checkbox"
                            checked={includeArchived}
                            onChange={(e) => setIncludeArchived(e.target.checked)}
                            className="accent-black rounded"
                        />
                        <span>Archived</span>
                    </label>
                </div>
            </div>

            {/* Board Area */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center text-neutral-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-black" />
                    <span className="text-sm font-bold">Loading tasks...</span>
                </div>
            ) : viewMode === "kanban" ? (
                /* KANBAN BOARD VIEW */
                <div className="flex-1 overflow-x-auto p-4 sm:p-6">
                    <div className="flex gap-4 items-start min-w-max pb-6">
                        {KANBAN_COLUMNS.map((col) => {
                            const columnTasks = kanbanTasks[col.id] || [];
                            return (
                                <div
                                    key={col.id}
                                    className={`w-72 rounded-2xl border-2 border-black p-3.5 ${col.color} shadow-neo-xs flex flex-col max-h-[calc(100vh-220px)]`}
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                                {col.title}
                                            </span>
                                            <span className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-black flex items-center justify-center">
                                                {columnTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Column Cards */}
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                        {columnTasks.length === 0 ? (
                                            <div className="p-4 text-center text-neutral-400 text-xs italic border border-dashed border-neutral-300 rounded-xl">
                                                No tasks
                                            </div>
                                        ) : (
                                            columnTasks.map((task) => {
                                                const completedCount =
                                                    task.checklist?.filter((c) => c.isCompleted).length || 0;
                                                const totalCount = task.checklist?.length || 0;

                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => setSelectedTaskId(task.id)}
                                                        className="p-3.5 bg-white border-2 border-black rounded-xl shadow-neo-xs hover:shadow-neo hover:-translate-y-0.5 transition cursor-pointer space-y-2.5"
                                                    >
                                                        {/* Badges row */}
                                                        <div className="flex items-center justify-between gap-1 flex-wrap">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {task.priority === "urgent" && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-rose-200 text-rose-900 border border-black">
                                                                        Urgent
                                                                    </span>
                                                                )}
                                                                {task.priority === "high" && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-black">
                                                                        High
                                                                    </span>
                                                                )}
                                                                {task.isRestricted && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 flex items-center gap-0.5">
                                                                        <Lock className="w-2.5 h-2.5" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {task.department && (
                                                                <span
                                                                    className="px-2 py-0.5 rounded text-[10px] font-bold border border-black truncate max-w-[120px]"
                                                                    style={{
                                                                        backgroundColor: `${task.department.color}20`,
                                                                    }}
                                                                >
                                                                    {task.department.name}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Title */}
                                                        <h4 className="text-xs font-black text-black leading-snug line-clamp-2">
                                                            {task.title}
                                                        </h4>

                                                        {/* Checklist progress */}
                                                        {totalCount > 0 && (
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600">
                                                                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>
                                                                    {completedCount}/{totalCount} items
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Footer: Due date and Assignees */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                                                            {task.dueDate ? (
                                                                <span className="text-[10px] font-bold text-neutral-600 flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3 text-neutral-400" />
                                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                                </span>
                                                            ) : (
                                                                <span />
                                                            )}

                                                            {/* Assignee avatars */}
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
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* LIST VIEW TABLE */
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                    <div className="bg-white border-2 border-black rounded-2xl shadow-neo overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#FAF6EE] border-b-2 border-black font-black uppercase text-neutral-600">
                                <tr>
                                    <th className="p-3.5">Task Title</th>
                                    <th className="p-3.5">Department</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5">Priority</th>
                                    <th className="p-3.5">Assignees</th>
                                    <th className="p-3.5">Checklist</th>
                                    <th className="p-3.5">Due Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                                {tasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-neutral-400 font-medium italic">
                                            No tasks found matching your filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    tasks.map((task) => {
                                        const completedCount =
                                            task.checklist?.filter((c) => c.isCompleted).length || 0;
                                        const totalCount = task.checklist?.length || 0;

                                        return (
                                            <tr
                                                key={task.id}
                                                onClick={() => setSelectedTaskId(task.id)}
                                                className="hover:bg-neutral-50 cursor-pointer transition font-medium"
                                            >
                                                <td className="p-3.5 font-bold text-black max-w-xs truncate">
                                                    <div className="flex items-center gap-1.5">
                                                        {task.isRestricted && (
                                                            <Lock className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                                        )}
                                                        <span className="truncate">{task.title}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3.5">
                                                    {task.department ? (
                                                        <span
                                                            className="px-2 py-0.5 rounded text-[10px] font-bold border border-black"
                                                            style={{
                                                                backgroundColor: `${task.department.color}20`,
                                                            }}
                                                        >
                                                            {task.department.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-neutral-400">—</span>
                                                    )}
                                                </td>
                                                <td className="p-3.5">
                                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border border-black bg-neutral-100">
                                                        {task.status.replace("_", " ")}
                                                    </span>
                                                </td>
                                                <td className="p-3.5">
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
                                                </td>
                                                <td className="p-3.5">
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
                                                </td>
                                                <td className="p-3.5 text-neutral-600 font-bold">
                                                    {totalCount > 0 ? `${completedCount}/${totalCount}` : "—"}
                                                </td>
                                                <td className="p-3.5 text-neutral-600">
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateTaskModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                clubId={clubId}
                departments={departments}
                members={members}
                roles={roles}
                onTaskCreated={() => loadTasks()}
            />

            {selectedTaskId && (
                <TaskDetailModal
                    isOpen={Boolean(selectedTaskId)}
                    onClose={() => setSelectedTaskId(null)}
                    taskId={selectedTaskId}
                    clubId={clubId}
                    currentMember={currentMember}
                    allMembers={members}
                    departments={departments}
                    onTaskUpdated={() => loadTasks()}
                />
            )}
        </div>
    );
};
