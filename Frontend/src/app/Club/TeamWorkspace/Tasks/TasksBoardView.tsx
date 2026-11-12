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
    Shield,
    UserCheck,
    FileEdit,
    Send,
    FolderKanban,
    Archive,
    AlertCircle,
    CheckCircle2,
    ArrowUpDown,
    Clock,
    Layers,
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
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

interface TasksBoardViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    members: WorkspaceMember[];
    roles: WorkspaceRole[];
    currentMember: WorkspaceMember | null;
    canCreateTasks: boolean;
    canViewAllTasks?: boolean;
    isClubContext?: boolean;
}

export type TaskViewPreset =
    | "all"
    | "department"
    | "my_tasks"
    | "created_by_me"
    | "assigned_by_me"
    | "awaiting_review"
    | "overdue"
    | "completed"
    | "archived";

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
    canViewAllTasks = true,
    isClubContext = false,
}) => {
    const toast = useToast();
    const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [activePreset, setActivePreset] = useState<TaskViewPreset>("all");

    useEffect(() => {
        if (isClubContext && activePreset === "my_tasks") {
            setActivePreset("all");
        }
    }, [isClubContext, activePreset]);

    // Filters
    const [search, setSearch] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
    const [selectedPriority, setSelectedPriority] = useState<string>("all");
    const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
    const [includeArchived, setIncludeArchived] = useState(false);
    const [sortBy, setSortBy] = useState<"created_at" | "due_date" | "priority" | "title">("created_at");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [groupByDueDate, setGroupByDueDate] = useState(false);

    // Drag-and-drop state
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dragOverCol, setDragOverCol] = useState<WorkspaceTaskStatus | null>(null);

    // Modals
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const loadTasks = useCallback(async () => {
        try {
            setLoading(true);

            // Compute effective query filters based on activePreset
            let deptId = selectedDepartment !== "all" ? selectedDepartment : undefined;
            let assigneeId = selectedAssignee !== "all" ? selectedAssignee : undefined;
            let creatorId: string | undefined = undefined;
            let assignedById: string | undefined = undefined;
            let statusFilter: string | undefined = undefined;
            let isArch = includeArchived;

            if (activePreset === "department") {
                if (selectedDepartment === "all" && currentMember?.departmentId) {
                    deptId = currentMember.departmentId;
                }
            } else if (activePreset === "my_tasks") {
                assigneeId = currentMember?.userId;
            } else if (activePreset === "created_by_me") {
                creatorId = currentMember?.userId;
            } else if (activePreset === "assigned_by_me") {
                assignedById = currentMember?.userId;
            } else if (activePreset === "awaiting_review") {
                statusFilter = "submitted";
            } else if (activePreset === "completed") {
                statusFilter = "completed";
            } else if (activePreset === "archived") {
                isArch = true;
            }

            const res = await workspaceApi.listTasks({
                clubId,
                departmentId: deptId,
                priority: selectedPriority !== "all" ? (selectedPriority as WorkspaceTaskPriority) : undefined,
                assigneeUserId: assigneeId,
                creatorId,
                assignedByUserId: assignedById,
                status: statusFilter,
                search: search.trim() || undefined,
                isArchived: isArch,
                sortBy,
                sortDir,
                limit: 200,
            });

            if (res.success) {
                let loaded = res.tasks || [];
                // If overdue preset, filter client-side for overdue
                if (activePreset === "overdue") {
                    const now = new Date();
                    loaded = loaded.filter(
                        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "cancelled"
                    );
                }
                setTasks(loaded);
            }
        } catch (err: any) {
            console.error("Failed to load tasks:", err);
            toast.error("Failed to load workspace tasks.");
        } finally {
            setLoading(false);
        }
    }, [
        clubId,
        activePreset,
        selectedDepartment,
        selectedPriority,
        selectedAssignee,
        search,
        includeArchived,
        sortBy,
        sortDir,
        currentMember,
    ]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    // Live real-time task update listener
    useEffect(() => {
        const handleRealtime = (e: any) => {
            const detail = e.detail;
            if (detail?.event?.startsWith("task:")) {
                loadTasks();
            }
        };
        window.addEventListener("workspace:realtime", handleRealtime);
        return () => window.removeEventListener("workspace:realtime", handleRealtime);
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

    // Group tasks by due date for List view
    const dueDateGroups = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

        const groups = {
            overdue: [] as WorkspaceTask[],
            today: [] as WorkspaceTask[],
            thisWeek: [] as WorkspaceTask[],
            later: [] as WorkspaceTask[],
            noDate: [] as WorkspaceTask[],
        };

        for (const t of tasks) {
            if (!t.dueDate) {
                groups.noDate.push(t);
            } else {
                const d = new Date(t.dueDate);
                if (d < startOfToday && t.status !== "completed" && t.status !== "cancelled") {
                    groups.overdue.push(t);
                } else if (d >= startOfToday && d <= endOfToday) {
                    groups.today.push(t);
                } else if (d > endOfToday && d <= endOfWeek) {
                    groups.thisWeek.push(t);
                } else {
                    groups.later.push(t);
                }
            }
        }
        return groups;
    }, [tasks]);

    // Drag-and-drop handlers
    const handleDragStart = (e: React.DragEvent, task: WorkspaceTask) => {
        setDraggedTaskId(task.id);
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, colId: WorkspaceTaskStatus) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverCol !== colId) {
            setDragOverCol(colId);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverCol(null);
    };

    const handleDrop = async (e: React.DragEvent, targetStatus: WorkspaceTaskStatus) => {
        e.preventDefault();
        setDragOverCol(null);
        const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
        if (!taskId) return;

        const targetTask = tasks.find((t) => t.id === taskId);
        if (!targetTask || targetTask.status === targetStatus) return;

        try {
            const res = await workspaceApi.transitionTaskStatus(
                taskId,
                { targetStatus, expectedVersion: targetTask.version },
                clubId
            );

            if (res.success) {
                toast.success(
                    `Task transitioned to ${KANBAN_COLUMNS.find((c) => c.id === targetStatus)?.title || targetStatus}`
                );
                loadTasks();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to update task status");
        } finally {
            setDraggedTaskId(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#FAF6EE] overflow-hidden">
            {/* Top Toolbar */}
            <div className="p-4 sm:p-6 bg-white border-b-2 border-black space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-xl shadow-neo-xs">
                            <Kanban className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-black">Workspace Tasks</h1>
                            <p className="text-xs font-semibold text-neutral-600">
                                Delegation tracking, deliverable reviews, and cross-functional progress
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
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

                        {/* List Due-Date Grouping Toggle */}
                        {viewMode === "list" && (
                            <button
                                onClick={() => setGroupByDueDate(!groupByDueDate)}
                                className={`px-3 py-1.5 border-2 border-black rounded-xl text-xs font-black transition shadow-neo-xs flex items-center gap-1.5 ${
                                    groupByDueDate ? "bg-[#FFE566] text-black" : "bg-white text-neutral-600 hover:text-black"
                                }`}
                                title="Toggle grouping by deadline"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                {groupByDueDate ? "Grouped by Due Date" : "Flat List"}
                            </button>
                        )}

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

                {/* Preset Views Switcher Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-neutral-100">
                    {canViewAllTasks && (
                        <button
                            onClick={() => setActivePreset("all")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                                activePreset === "all"
                                    ? "bg-black text-white border-black shadow-neo-xs"
                                    : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                            }`}
                        >
                            <Kanban className="w-3.5 h-3.5" /> All Workspace Tasks
                        </button>
                    )}

                    <button
                        onClick={() => setActivePreset("department")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "department"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <FolderKanban className="w-3.5 h-3.5 text-teal-500" /> Department Tasks
                    </button>

                    {!isClubContext && (
                        <button
                            onClick={() => setActivePreset("my_tasks")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                                activePreset === "my_tasks"
                                    ? "bg-black text-white border-black shadow-neo-xs"
                                    : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                            }`}
                        >
                            <UserCheck className="w-3.5 h-3.5 text-indigo-500" /> My Tasks
                        </button>
                    )}

                    <button
                        onClick={() => setActivePreset("created_by_me")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "created_by_me"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <FileEdit className="w-3.5 h-3.5 text-blue-500" /> Created by Me
                    </button>

                    <button
                        onClick={() => setActivePreset("assigned_by_me")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "assigned_by_me"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <Send className="w-3.5 h-3.5 text-cyan-500" /> Assigned by Me
                    </button>

                    <button
                        onClick={() => setActivePreset("awaiting_review")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "awaiting_review"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5 text-purple-500" /> Awaiting Review
                    </button>

                    <button
                        onClick={() => setActivePreset("overdue")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "overdue"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Overdue
                    </button>

                    <button
                        onClick={() => setActivePreset("completed")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "completed"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Completed
                    </button>

                    <button
                        onClick={() => setActivePreset("archived")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition border-2 flex items-center gap-1.5 whitespace-nowrap ${
                            activePreset === "archived"
                                ? "bg-black text-white border-black shadow-neo-xs"
                                : "bg-white text-neutral-600 border-neutral-200 hover:border-black hover:text-black"
                        }`}
                    >
                        <Archive className="w-3.5 h-3.5 text-neutral-500" /> Archived
                    </button>
                </div>

                {/* Filters & Sorting Row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter by title or keyword..."
                            className="w-full pl-8 pr-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none shadow-neo-xs placeholder:text-neutral-400 placeholder:font-normal"
                        />
                    </div>

                    {/* Department Filter */}
                    <div className="min-w-[150px]">
                        <NeoSelect
                            value={selectedDepartment}
                            onChange={(val) => setSelectedDepartment(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: "All Departments" },
                                ...departments.map((d) => ({ value: d.id, label: d.name })),
                            ]}
                        />
                    </div>

                    {/* Priority Filter */}
                    <div className="min-w-[130px]">
                        <NeoSelect
                            value={selectedPriority}
                            onChange={(val) => setSelectedPriority(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: "All Priorities" },
                                { value: "urgent", label: "Urgent" },
                                { value: "high", label: "High" },
                                { value: "medium", label: "Medium" },
                                { value: "low", label: "Low" },
                            ]}
                        />
                    </div>

                    {/* Assignee Filter */}
                    <div className="min-w-[140px]">
                        <NeoSelect
                            value={selectedAssignee}
                            onChange={(val) => setSelectedAssignee(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: "All Assignees" },
                                ...members.map((m) => ({
                                    value: m.userId,
                                    label:
                                        `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                                        m.user?.username ||
                                        m.userId,
                                })),
                            ]}
                        />
                    </div>

                    {/* Sort Selector */}
                    <div className="min-w-[150px]">
                        <NeoSelect
                            value={sortBy}
                            onChange={(val) => setSortBy(val as any)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "created_at", label: "Sort: Created Date" },
                                { value: "due_date", label: "Sort: Due Date" },
                                { value: "priority", label: "Sort: Priority" },
                                { value: "title", label: "Sort: Title (A-Z)" },
                            ]}
                        />
                    </div>

                    {/* Sort Direction Toggle */}
                    <button
                        onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                        className="p-2 bg-white border-2 border-black rounded-xl text-xs font-bold hover:bg-neutral-100 transition shadow-neo-xs flex items-center gap-1"
                        title={sortDir === "asc" ? "Ascending order" : "Descending order"}
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span className="uppercase text-[10px]">{sortDir}</span>
                    </button>

                    {/* Archived toggle */}
                    {activePreset !== "archived" && (
                        <div className="flex items-center ml-1">
                            <NeoCheckbox
                                checked={includeArchived}
                                onCheckedChange={(checked) => setIncludeArchived(checked)}
                                size="sm"
                                colorScheme="yellow"
                                label={<span className="text-xs font-bold text-black">Archived</span>}
                            />
                        </div>
                    )}
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
                            const isOver = dragOverCol === col.id;

                            return (
                                <div
                                    key={col.id}
                                    onDragOver={(e) => handleDragOver(e, col.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, col.id)}
                                    className={`w-72 rounded-2xl border-2 p-3.5 transition-all flex flex-col max-h-[calc(100vh-250px)] ${
                                        isOver
                                            ? "border-black bg-[#A6FF70]/20 shadow-neo scale-[1.01]"
                                            : `${col.color} border-black shadow-neo-xs`
                                    }`}
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
                                                {isOver ? "Drop to transition..." : "No tasks"}
                                            </div>
                                        ) : (
                                            columnTasks.map((task) => {
                                                const completedCount =
                                                    task.checklist?.filter((c) => c.isCompleted).length || 0;
                                                const totalCount = task.checklist?.length || 0;

                                                return (
                                                    <div
                                                        key={task.id}
                                                        draggable={true}
                                                        onDragStart={(e) => handleDragStart(e, task)}
                                                        onDragEnd={() => setDraggedTaskId(null)}
                                                        onClick={() => setSelectedTaskId(task.id)}
                                                        className="p-3.5 bg-white border-2 border-black rounded-xl shadow-neo-xs hover:shadow-neo hover:-translate-y-0.5 transition cursor-grab active:cursor-grabbing space-y-2.5"
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
                <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
                    {groupByDueDate ? (
                        /* Grouped by Deadline */
                        ([
                            { key: "overdue", label: "Overdue", icon: AlertCircle, color: "text-rose-600", items: dueDateGroups.overdue },
                            { key: "today", label: "Due Today", icon: Clock, color: "text-amber-600", items: dueDateGroups.today },
                            { key: "thisWeek", label: "Due This Week", icon: Calendar, color: "text-blue-600", items: dueDateGroups.thisWeek },
                            { key: "later", label: "Later", icon: Calendar, color: "text-neutral-600", items: dueDateGroups.later },
                            { key: "noDate", label: "No Due Date", icon: Calendar, color: "text-neutral-400", items: dueDateGroups.noDate },
                        ] as const).map((grp) => {
                            if (grp.items.length === 0) return null;
                            const Icon = grp.icon;
                            return (
                                <div key={grp.key} className="space-y-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <Icon className={`w-4 h-4 ${grp.color}`} />
                                        <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                            {grp.label} ({grp.items.length})
                                        </h3>
                                    </div>
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
                                                {grp.items.map((task) => (
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
                                                                    style={{ backgroundColor: `${task.department.color}20` }}
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
                                                            {task.checklist?.length
                                                                ? `${task.checklist.filter((c) => c.isCompleted).length}/${task.checklist.length}`
                                                                : "—"}
                                                        </td>
                                                        <td className="p-3.5 text-neutral-600">
                                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        /* Flat List View */
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
                    )}
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
