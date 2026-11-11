// Frontend/src/app/Club/TeamWorkspace/Tasks/TaskDetailModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    X,
    CheckSquare,
    Link as LinkIcon,
    Calendar,
    Users,
    Shield,
    Star,
    Send,
    MessageSquare,
    Activity,
    FileText,
    CheckCircle2,
    AlertCircle,
    Archive,
    Loader2,
    Lock,
    FolderKanban,
    Edit3,
    Save,
    Eye,
    Paperclip,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceTask,
    WorkspaceTaskStatus,
    WorkspaceTaskPriority,
    WorkspaceTaskComment,
    WorkspaceTaskActivity,
    WorkspaceMember,
    WorkspaceDepartment,
    WorkspaceFile,
} from "../../../../types/workspace";
import { useToast } from "../../../../context/ToastContext";
import { FileUploadZone } from "../Files/FileUploadZone";
import { AttachmentList } from "../Files/AttachmentList";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoDateTimePicker } from "../../../../components/NeoDateTimePicker";

interface TaskDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    taskId: string;
    clubId: string;
    currentMember: WorkspaceMember | null;
    allMembers: WorkspaceMember[];
    departments: WorkspaceDepartment[];
    onTaskUpdated: () => void;
}

const STATUS_CONFIG: Record<
    WorkspaceTaskStatus,
    { label: string; color: string; border: string }
> = {
    draft: { label: "Draft", color: "bg-slate-100 text-slate-700", border: "border-slate-300" },
    assigned: { label: "Assigned", color: "bg-indigo-50 text-indigo-700", border: "border-indigo-300" },
    in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800", border: "border-blue-400" },
    blocked: { label: "Blocked", color: "bg-amber-100 text-amber-800", border: "border-amber-400" },
    submitted: { label: "Submitted", color: "bg-purple-100 text-purple-800", border: "border-purple-400" },
    changes_requested: { label: "Changes Requested", color: "bg-orange-100 text-orange-800", border: "border-orange-400" },
    approved: { label: "Approved", color: "bg-teal-100 text-teal-800", border: "border-teal-400" },
    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800", border: "border-emerald-400" },
    archived: { label: "Archived", color: "bg-neutral-200 text-neutral-800", border: "border-neutral-400" },
    cancelled: { label: "Cancelled", color: "bg-rose-100 text-rose-800", border: "border-rose-300" },
};

const ALLOWED_TRANSITIONS: Record<WorkspaceTaskStatus, WorkspaceTaskStatus[]> = {
    draft: ["assigned", "in_progress", "cancelled"],
    assigned: ["in_progress", "blocked", "cancelled"],
    in_progress: ["blocked", "submitted", "cancelled"],
    blocked: ["in_progress", "assigned", "cancelled"],
    submitted: ["changes_requested", "approved", "cancelled"],
    changes_requested: ["in_progress", "submitted", "cancelled"],
    approved: ["completed", "cancelled"],
    completed: ["archived", "in_progress"],
    cancelled: ["archived", "draft", "assigned"],
    archived: ["draft", "assigned", "completed"],
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
    isOpen,
    onClose,
    taskId,
    clubId,
    currentMember,
    allMembers,
    onTaskUpdated,
}) => {
    const toast = useToast();
    const [task, setTask] = useState<WorkspaceTask | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"discussion" | "submission" | "activity">("discussion");

    // Comments state
    const [comments, setComments] = useState<WorkspaceTaskComment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [replyToId, setReplyToId] = useState<string | null>(null);
    const [submittingComment, setSubmittingComment] = useState(false);

    // Deliverable submission state
    const [submissionContent, setSubmissionContent] = useState("");
    const [submissionFileUrl, setSubmissionFileUrl] = useState("");
    const [submittingDeliverable, setSubmittingDeliverable] = useState(false);

    // Deliverable review state
    const [reviewDecision, setReviewDecision] = useState<"approved" | "changes_requested">("approved");
    const [reviewComments, setReviewComments] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);

    // Files & Attachments state
    const [taskFiles, setTaskFiles] = useState<WorkspaceFile[]>([]);
    const [submissionFiles, setSubmissionFiles] = useState<WorkspaceFile[]>([]);

    // Activity state
    const [activity, setActivity] = useState<WorkspaceTaskActivity[]>([]);

    // Reassign members modal state
    const [isReassigning, setIsReassigning] = useState(false);
    const [reassignUserIds, setReassignUserIds] = useState<string[]>([]);

    // Edit details (Priority & Schedule) state
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editPriority, setEditPriority] = useState<WorkspaceTaskPriority>("medium");
    const [editStartDate, setEditStartDate] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [savingDetails, setSavingDetails] = useState(false);

    const isOwner = currentMember?.role?.slug === "owner" || (currentMember?.role?.rank || 0) >= 1000;

    const loadTask = useCallback(async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getTask(taskId, clubId);
            if (res.success && res.task) {
                setTask(res.task);
                setReassignUserIds((res.task.currentAssignees || []).map((a) => a.userId));
                setEditPriority(res.task.priority);
                setEditStartDate(res.task.startDate ? res.task.startDate.substring(0, 10) : "");
                setEditDueDate(res.task.dueDate ? res.task.dueDate.substring(0, 10) : "");
            }

            // Load attachments for this task
            const filesRes = await workspaceApi.listFiles({ taskId, clubId });
            if (filesRes.success) {
                setTaskFiles(filesRes.files || []);
            }
        } catch (err: any) {
            console.error("Failed to load task:", err);
            toast.error(err.response?.data?.message || "Failed to load task.");
        } finally {
            setLoading(false);
        }
    }, [taskId, clubId]);

    const loadComments = useCallback(async () => {
        try {
            const res = await workspaceApi.getTaskComments(taskId, clubId);
            if (res.success) {
                setComments(res.comments || []);
            }
        } catch (err) {
            console.error("Failed to load comments:", err);
        }
    }, [taskId, clubId]);

    const loadActivity = useCallback(async () => {
        try {
            const res = await workspaceApi.getTaskActivity(taskId, 50, clubId);
            if (res.success) {
                setActivity(res.activity || []);
            }
        } catch (err) {
            console.error("Failed to load activity:", err);
        }
    }, [taskId, clubId]);

    useEffect(() => {
        if (isOpen && taskId) {
            loadTask();
            loadComments();
            loadActivity();
        }
    }, [isOpen, taskId, loadTask, loadComments, loadActivity]);

    if (!isOpen) return null;

    // Check self-review condition
    const isSubmitterOrCreator =
        Boolean(currentMember?.userId) &&
        (task?.creatorId === currentMember?.userId ||
            task?.latestSubmission?.submittedBy === currentMember?.userId ||
            task?.currentAssignees?.some((a) => a.userId === currentMember?.userId));

    const cannotApproveDueToSelfReview = isSubmitterOrCreator && !isOwner;

    // Status transition handler
    const handleStatusTransition = async (targetStatus: WorkspaceTaskStatus) => {
        if (!task) return;
        try {
            const res = await workspaceApi.transitionTaskStatus(
                task.id,
                {
                    targetStatus,
                    expectedVersion: task.version,
                },
                clubId
            );
            if (res.success) {
                toast.success(`Task status changed to ${STATUS_CONFIG[targetStatus]?.label || targetStatus}`);
                setTask(res.task);
                onTaskUpdated();
                loadActivity();
            }
        } catch (err: any) {
            console.error("Transition error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to change status.");
        }
    };

    // Checklist item toggle handler (optimistic locking)
    const handleToggleChecklist = async (itemId: string) => {
        if (!task) return;
        const updatedChecklist = task.checklist.map((item) =>
            item.id === itemId
                ? {
                      ...item,
                      isCompleted: !item.isCompleted,
                      completedBy: !item.isCompleted ? currentMember?.userId : null,
                      completedAt: !item.isCompleted ? new Date().toISOString() : null,
                  }
                : item
        );

        // Optimistic local update
        setTask((prev) => (prev ? { ...prev, checklist: updatedChecklist } : null));

        try {
            const res = await workspaceApi.updateTaskChecklist(
                task.id,
                updatedChecklist,
                task.version,
                clubId
            );
            if (res.success) {
                setTask(res.task);
                onTaskUpdated();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to update checklist item.");
            loadTask(); // Revert on failure
        }
    };

    // Submit deliverable handler
    const handleSubmitDeliverable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task || !submissionContent.trim()) return;

        try {
            setSubmittingDeliverable(true);
            const attachments = [
                ...submissionFiles.map((f) => ({ name: f.fileName, url: f.cloudinarySecureUrl, fileId: f.id })),
                ...(submissionFileUrl.trim() ? [{ name: "External Link", url: submissionFileUrl.trim() }] : []),
            ];

            const res = await workspaceApi.submitTask(
                task.id,
                {
                    content: submissionContent.trim(),
                    attachments,
                    expectedVersion: task.version,
                    fileIds: submissionFiles.map((f) => f.id),
                },
                clubId
            );

            if (res.success) {
                toast.success("Deliverable submitted for review!");
                setSubmissionContent("");
                setSubmissionFileUrl("");
                setSubmissionFiles([]);
                setTask(res.task);
                onTaskUpdated();
                loadActivity();
            }
        } catch (err: any) {
            console.error("Submission error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to submit work.");
        } finally {
            setSubmittingDeliverable(false);
        }
    };

    // Save details (Priority & Schedule) handler
    const handleSaveDetails = async () => {
        if (!task) return;
        try {
            setSavingDetails(true);
            const res = await workspaceApi.updateTask(
                task.id,
                {
                    priority: editPriority,
                    startDate: editStartDate ? new Date(editStartDate).toISOString() : null,
                    dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
                    expectedVersion: task.version,
                },
                clubId
            );
            if (res.success) {
                toast.success("Task details updated successfully!");
                setTask(res.task);
                setIsEditingDetails(false);
                onTaskUpdated();
                loadActivity();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to update task details.");
        } finally {
            setSavingDetails(false);
        }
    };

    // Review deliverable handler
    const handleReviewDeliverable = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task || !task.latestSubmission || !reviewComments.trim()) return;

        try {
            setSubmittingReview(true);
            const res = await workspaceApi.reviewTask(
                task.id,
                {
                    submissionId: task.latestSubmission.id,
                    decision: reviewDecision,
                    comments: reviewComments.trim(),
                    expectedVersion: task.version,
                },
                clubId
            );

            if (res.success) {
                toast.success(
                    reviewDecision === "approved"
                        ? "Deliverable approved!"
                        : "Changes requested from assignees."
                );
                setReviewComments("");
                setTask(res.task);
                onTaskUpdated();
                loadActivity();
            }
        } catch (err: any) {
            console.error("Review error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to submit review.");
        } finally {
            setSubmittingReview(false);
        }
    };

    // Add comment handler
    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task || !newComment.trim()) return;

        try {
            setSubmittingComment(true);
            const res = await workspaceApi.addTaskComment(
                task.id,
                {
                    content: newComment.trim(),
                    parentCommentId: replyToId,
                },
                clubId
            );

            if (res.success) {
                setNewComment("");
                setReplyToId(null);
                loadComments();
                loadActivity();
            }
        } catch (err: any) {
            console.error("Comment error:", err);
            toast.error(err.response?.data?.message || "Failed to post comment.");
        } finally {
            setSubmittingComment(false);
        }
    };

    // Toggle watcher handler
    const handleToggleWatcher = async () => {
        if (!task) return;
        try {
            const res = await workspaceApi.toggleTaskWatcher(task.id, clubId);
            if (res.success) {
                setTask((prev) => (prev ? { ...prev, isWatching: res.isWatching } : null));
                toast.info(res.isWatching ? "You are now watching this task" : "Unwatched task");
            }
        } catch (err: any) {
            toast.error("Failed to toggle watcher subscription.");
        }
    };

    // Archive task handler
    const handleArchiveTask = async () => {
        if (!task || !window.confirm("Are you sure you want to archive this task?")) return;
        try {
            const res = await workspaceApi.archiveTask(task.id, clubId);
            if (res.success) {
                toast.success("Task archived.");
                onTaskUpdated();
                onClose();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to archive task.");
        }
    };

    // Reassign members handler
    const handleSaveReassignment = async () => {
        if (!task) return;
        try {
            const res = await workspaceApi.assignTask(task.id, reassignUserIds, clubId);
            if (res.success) {
                toast.success("Task assignees updated successfully!");
                setTask(res.task);
                setIsReassigning(false);
                onTaskUpdated();
                loadActivity();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to reassign members.");
        }
    };

    const completedChecklistCount = task?.checklist?.filter((c) => c.isCompleted).length || 0;
    const totalChecklistCount = task?.checklist?.length || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#FAF6EE] border-4 border-black rounded-2xl w-full max-w-4xl shadow-neo overflow-hidden my-6 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-5 bg-white border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-xl shadow-neo-xs">
                            <CheckSquare className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black bg-neutral-100">
                                    v{task?.version || 1}
                                </span>
                                {task?.isRestricted && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black bg-amber-100 text-amber-900 flex items-center gap-1">
                                        <Lock className="w-2.5 h-2.5" /> Restricted
                                    </span>
                                )}
                                {task?.department && (
                                    <span
                                        className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black flex items-center gap-1"
                                        style={{ backgroundColor: `${task.department.color}20` }}
                                    >
                                        <FolderKanban className="w-2.5 h-2.5" />
                                        {task.department.name}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-black text-black mt-1">{task?.title || "Loading..."}</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Watcher toggle */}
                        <button
                            onClick={handleToggleWatcher}
                            title={task?.isWatching ? "Watching" : "Watch task"}
                            className={`p-2 rounded-xl border-2 border-black transition ${
                                task?.isWatching
                                    ? "bg-amber-300 text-black shadow-neo-xs"
                                    : "bg-white text-neutral-400 hover:text-black"
                            }`}
                        >
                            <Star className="w-4 h-4" />
                        </button>

                        {/* Archive button */}
                        <button
                            onClick={handleArchiveTask}
                            title="Archive Task"
                            className="p-2 bg-white text-neutral-500 hover:text-red-600 rounded-xl border-2 border-black hover:bg-neutral-100 transition shadow-neo-xs"
                        >
                            <Archive className="w-4 h-4" />
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 text-neutral-500 hover:text-black rounded-xl border-2 border-black bg-white hover:bg-neutral-100 transition shadow-neo-xs"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Sub-header: Status and Transitions */}
                {task && (
                    <div className="px-6 py-3 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-neutral-600">Current Status:</span>
                            <span
                                className={`px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-black ${
                                    STATUS_CONFIG[task.status]?.color || "bg-white text-black"
                                } shadow-neo-xs`}
                            >
                                {STATUS_CONFIG[task.status]?.label || task.status}
                            </span>
                        </div>

                        {/* Server-validated transition buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-neutral-500 mr-1">Move to:</span>
                            {(ALLOWED_TRANSITIONS[task.status] || []).map((targetStatus) => {
                                const isApproval = targetStatus === "approved";
                                const isBlockedSelfApproval = isApproval && cannotApproveDueToSelfReview;
                                return (
                                    <button
                                        key={targetStatus}
                                        onClick={() => !isBlockedSelfApproval && handleStatusTransition(targetStatus)}
                                        disabled={isBlockedSelfApproval}
                                        title={
                                            isBlockedSelfApproval
                                                ? "Self-review policy prevents approving own deliverable"
                                                : `Transition to ${STATUS_CONFIG[targetStatus]?.label}`
                                        }
                                        className={`px-2.5 py-1 text-[11px] font-black uppercase rounded-lg border-2 border-black transition ${
                                            isBlockedSelfApproval
                                                ? "bg-neutral-200 text-neutral-400 cursor-not-allowed border-neutral-300"
                                                : "bg-white hover:bg-black hover:text-white shadow-neo-xs"
                                        }`}
                                    >
                                        {STATUS_CONFIG[targetStatus]?.label || targetStatus}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Content Layout */}
                {loading ? (
                    <div className="p-12 flex items-center justify-center text-neutral-500 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-black" />
                        <span className="text-sm font-bold">Loading task details...</span>
                    </div>
                ) : task ? (
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x-2 divide-black overflow-y-auto">
                        {/* Left & Middle Column (2 cols): Details, Checklist, Tabs */}
                        <div className="md:col-span-2 p-6 space-y-6 overflow-y-auto">
                            {/* Description */}
                            <div>
                                <h3 className="text-xs font-black uppercase text-neutral-500 tracking-wider mb-1.5">
                                    Description & Instructions
                                </h3>
                                <p className="text-sm text-black leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border-2 border-black shadow-neo-xs font-medium">
                                    {task.description || "No description provided."}
                                </p>
                            </div>

                            {/* Checklist Progress */}
                            {task.checklist && task.checklist.length > 0 && (
                                <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black">
                                                Task Checklist
                                            </h3>
                                        </div>
                                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                            {completedChecklistCount} of {totalChecklistCount} completed
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-neutral-100 rounded-full h-2.5 border border-black overflow-hidden">
                                        <div
                                            className="bg-[#A6FF70] h-full transition-all duration-300"
                                            style={{
                                                width: `${
                                                    totalChecklistCount > 0
                                                        ? (completedChecklistCount / totalChecklistCount) * 100
                                                        : 0
                                                }%`,
                                            }}
                                        />
                                    </div>

                                    {/* Checklist items list */}
                                    <div className="space-y-1.5 pt-1">
                                        {task.checklist.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={() => handleToggleChecklist(item.id)}
                                                className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer border transition text-xs font-medium ${
                                                    item.isCompleted
                                                        ? "bg-emerald-50/50 border-emerald-300 text-neutral-500 line-through"
                                                        : "bg-white border-neutral-200 hover:border-black text-black"
                                                }`}
                                            >
                                                <NeoCheckbox
                                                    checked={item.isCompleted}
                                                    onChange={() => {}}
                                                    size="sm"
                                                    colorScheme="green"
                                                />
                                                <span className="flex-1 pt-0.5">{item.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reference Links */}
                            {task.referenceLinks && task.referenceLinks.length > 0 && (
                                <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-2">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" /> Reference Links
                                    </h3>
                                    <div className="space-y-1">
                                        {task.referenceLinks.map((link, idx) => (
                                            <a
                                                key={idx}
                                                href={link.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200 rounded-lg hover:border-black text-xs font-bold text-blue-600 transition"
                                            >
                                                <span>{link.title}</span>
                                                <span className="text-[10px] text-neutral-500 underline truncate max-w-xs">
                                                    {link.url}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Task Attachments & Supporting Documents */}
                            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-purple-600" /> Attachments & Media ({taskFiles.length})
                                    </h3>
                                </div>

                                {taskFiles.length > 0 && (
                                    <AttachmentList
                                        files={taskFiles}
                                        clubId={clubId}
                                        canDelete={isOwner}
                                        onFileDeleted={(id) => setTaskFiles((prev) => prev.filter((f) => f.id !== id))}
                                    />
                                )}

                                <FileUploadZone
                                    clubId={clubId}
                                    departmentId={task.departmentId}
                                    parentResourceType="task"
                                    parentResourceId={task.id}
                                    compact
                                    onFileUploaded={(newFile) => setTaskFiles((prev) => [...prev, newFile])}
                                />
                            </div>

                            {/* Tabs: Discussion, Deliverable Submission, Activity */}
                            <div className="space-y-3">
                                <div className="flex border-b-2 border-black gap-2">
                                    <button
                                        onClick={() => setActiveTab("discussion")}
                                        className={`px-4 py-2 text-xs font-black uppercase transition border-b-2 -mb-[2px] flex items-center gap-1.5 ${
                                            activeTab === "discussion"
                                                ? "border-black text-black bg-white"
                                                : "border-transparent text-neutral-500 hover:text-black"
                                        }`}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" /> Discussion ({comments.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("submission")}
                                        className={`px-4 py-2 text-xs font-black uppercase transition border-b-2 -mb-[2px] flex items-center gap-1.5 ${
                                            activeTab === "submission"
                                                ? "border-black text-black bg-white"
                                                : "border-transparent text-neutral-500 hover:text-black"
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5" /> Deliverable & Reviews
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("activity")}
                                        className={`px-4 py-2 text-xs font-black uppercase transition border-b-2 -mb-[2px] flex items-center gap-1.5 ${
                                            activeTab === "activity"
                                                ? "border-black text-black bg-white"
                                                : "border-transparent text-neutral-500 hover:text-black"
                                        }`}
                                    >
                                        <Activity className="w-3.5 h-3.5" /> Activity Stream
                                    </button>
                                </div>

                                {/* TAB 1: DISCUSSION */}
                                {activeTab === "discussion" && (
                                    <div className="space-y-4">
                                        {/* Post comment box */}
                                        <form onSubmit={handleAddComment} className="space-y-2">
                                            {replyToId && (
                                                <div className="flex items-center justify-between px-3 py-1 bg-neutral-200 rounded text-[11px] font-bold text-neutral-700">
                                                    <span>Replying to comment...</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyToId(null)}
                                                        className="text-neutral-500 hover:text-black"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                            <div className="relative">
                                                <textarea
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    placeholder="Share update, ask questions, or tag teammates..."
                                                    rows={2}
                                                    className="w-full p-3 bg-white border-2 border-black rounded-xl text-xs font-medium text-black focus:outline-none shadow-neo-xs resize-none"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={submittingComment || !newComment.trim()}
                                                    className="absolute right-2 bottom-2 px-3 py-1.5 bg-[#A6FF70] border-2 border-black rounded-lg text-xs font-black text-black shadow-neo-xs hover:bg-[#92ec5d] transition flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    {submittingComment ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Send className="w-3 h-3" />
                                                    )}
                                                    Post
                                                </button>
                                            </div>
                                        </form>

                                        {/* Comments list */}
                                        <div className="space-y-3">
                                            {comments.length === 0 ? (
                                                <p className="text-xs text-neutral-500 italic p-4 text-center">
                                                    No comments yet. Start the conversation!
                                                </p>
                                            ) : (
                                                comments.map((c) => (
                                                    <div
                                                        key={c.id}
                                                        className="p-3 bg-white border-2 border-black rounded-xl shadow-neo-xs space-y-2"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-neutral-200 border border-black flex items-center justify-center font-bold text-[10px]">
                                                                    {c.author?.firstName?.charAt(0) || "?"}
                                                                </div>
                                                                <span className="text-xs font-black text-black">
                                                                    {c.author?.firstName} {c.author?.lastName}
                                                                </span>
                                                                <span className="text-[10px] text-neutral-500">
                                                                    {new Date(c.createdAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setReplyToId(c.id)}
                                                                className="text-[11px] font-bold text-indigo-600 hover:underline"
                                                            >
                                                                Reply
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-neutral-800 font-medium pl-8">
                                                            {c.content}
                                                        </p>

                                                        {/* Threaded replies */}
                                                        {c.replies && c.replies.length > 0 && (
                                                            <div className="ml-8 mt-2 space-y-2 border-l-2 border-neutral-200 pl-3">
                                                                {c.replies.map((rep) => (
                                                                    <div key={rep.id} className="text-xs">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-black text-black">
                                                                                {rep.author?.firstName} {rep.author?.lastName}:
                                                                            </span>
                                                                            <span className="text-neutral-700 font-medium">
                                                                                {rep.content}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* TAB 2: DELIVERABLE & REVIEWS */}
                                {activeTab === "submission" && (
                                    <div className="space-y-4">
                                        {/* Historical Submissions & Deliverables Stream */}
                                        {((task.submissions && task.submissions.length > 0) || task.latestSubmission) ? (
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4 text-purple-600" /> Deliverables & Review History ({task.submissions?.length || 1})
                                                </h4>
                                                {(task.submissions && task.submissions.length > 0
                                                    ? task.submissions
                                                    : task.latestSubmission
                                                    ? [task.latestSubmission]
                                                    : []
                                                ).map((sub, idx, arr) => (
                                                    <div
                                                        key={sub.id}
                                                        className="p-4 bg-white border-2 border-black rounded-xl shadow-neo-xs space-y-3"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-900 border border-black text-[10px] font-black flex items-center justify-center">
                                                                    #{arr.length - idx}
                                                                </span>
                                                                <h5 className="text-xs font-black uppercase text-black">
                                                                    {idx === 0 && arr.length > 1 ? "Latest Submission" : idx === arr.length - 1 ? "Initial Deliverable" : `Revision #${arr.length - idx}`}
                                                                </h5>
                                                                <span className="text-[10px] text-neutral-500 font-medium">
                                                                    {new Date(sub.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <span
                                                                className={`text-[10px] font-black px-2 py-0.5 rounded border border-black ${
                                                                    sub.status === "approved"
                                                                        ? "bg-teal-100 text-teal-900 border-teal-400"
                                                                        : sub.status === "changes_requested"
                                                                        ? "bg-orange-100 text-orange-900 border-orange-400"
                                                                        : "bg-purple-100 text-purple-900 border-purple-400"
                                                                }`}
                                                            >
                                                                {sub.status.replace("_", " ").toUpperCase()}
                                                            </span>
                                                        </div>

                                                        {sub.submitter && (
                                                            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                                                                <span className="font-bold text-black">Submitted by:</span>
                                                                <span>
                                                                    {sub.submitter.firstName} {sub.submitter.lastName} (@{sub.submitter.username})
                                                                </span>
                                                            </div>
                                                        )}

                                                        <p className="text-xs text-black font-medium leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-200 whitespace-pre-wrap">
                                                            {sub.content}
                                                        </p>

                                                        {sub.attachments && sub.attachments.length > 0 && (
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] font-black uppercase text-neutral-500">
                                                                    Deliverable Files & Links ({sub.attachments.length}):
                                                                </span>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                    {sub.attachments.map((att, i) => (
                                                                        <a
                                                                            key={i}
                                                                            href={att.url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="flex items-center gap-1.5 p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-bold text-blue-600 hover:border-black hover:underline truncate"
                                                                        >
                                                                            <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                                            <span className="truncate">{att.name || att.url}</span>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Attached Review (if reviewed) */}
                                                        {sub.review && (
                                                            <div
                                                                className={`p-3 rounded-lg border-2 border-black space-y-1.5 mt-2 ${
                                                                    sub.review.decision === "approved"
                                                                        ? "bg-teal-50 border-teal-500"
                                                                        : "bg-orange-50 border-orange-500"
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[11px] font-black uppercase tracking-wider text-black flex items-center gap-1">
                                                                        <Shield className="w-3.5 h-3.5" />
                                                                        Review Decision: {sub.review.decision === "approved" ? "Approved" : "Changes Requested"}
                                                                    </span>
                                                                    <span className="text-[10px] text-neutral-500">
                                                                        {new Date(sub.review.createdAt).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                {sub.review.reviewer && (
                                                                    <p className="text-[11px] font-bold text-neutral-700">
                                                                        Reviewed by {sub.review.reviewer.firstName} {sub.review.reviewer.lastName}
                                                                    </p>
                                                                )}
                                                                <p className="text-xs text-neutral-800 font-medium">
                                                                    {sub.review.comments}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-neutral-500 italic p-3 text-center bg-white border border-neutral-200 rounded-xl">
                                                No deliverables have been submitted yet.
                                            </p>
                                        )}

                                        {/* Submit Deliverable Form (if in progress or changes requested) */}
                                        {(task.status === "in_progress" ||
                                            task.status === "changes_requested" ||
                                            task.status === "assigned") && (
                                            <form
                                                onSubmit={handleSubmitDeliverable}
                                                className="p-4 bg-white border-2 border-black rounded-xl shadow-neo-xs space-y-3"
                                            >
                                                <h4 className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                                                    <FileText className="w-4 h-4 text-indigo-600" /> Submit Work for Review
                                                </h4>
                                                <textarea
                                                    value={submissionContent}
                                                    onChange={(e) => setSubmissionContent(e.target.value)}
                                                    placeholder="Describe the deliverables completed, PR links, deployment notes..."
                                                    rows={3}
                                                    required
                                                    className="w-full p-2.5 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none resize-none"
                                                />
                                                <input
                                                    type="url"
                                                    value={submissionFileUrl}
                                                    onChange={(e) => setSubmissionFileUrl(e.target.value)}
                                                    placeholder="External deliverable or deployment URL (optional)..."
                                                    className="w-full p-2 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none"
                                                />

                                                {/* File Upload Zone for Submission Deliverables */}
                                                <div className="space-y-2 pt-1">
                                                    <label className="text-[11px] font-black uppercase text-neutral-700">
                                                        Upload Deliverable Files (PDF, Images, ZIP, Docs)
                                                    </label>
                                                    <FileUploadZone
                                                        clubId={clubId}
                                                        departmentId={task.departmentId}
                                                        parentResourceType="task_submission"
                                                        parentResourceId={task.id}
                                                        compact
                                                        onFileUploaded={(newFile) => setSubmissionFiles((prev) => [...prev, newFile])}
                                                    />
                                                    {submissionFiles.length > 0 && (
                                                        <AttachmentList
                                                            files={submissionFiles}
                                                            clubId={clubId}
                                                            canDelete
                                                            onFileDeleted={(id) => setSubmissionFiles((prev) => prev.filter((f) => f.id !== id))}
                                                        />
                                                    )}
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={submittingDeliverable || !submissionContent.trim()}
                                                    className="px-4 py-2 bg-[#A6FF70] border-2 border-black rounded-xl text-xs font-black text-black hover:bg-[#92ec5d] transition shadow-neo flex items-center gap-1.5"
                                                >
                                                    {submittingDeliverable && (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    )}
                                                    Submit for Review
                                                </button>
                                            </form>
                                        )}

                                        {/* Review Panel (if task is in 'submitted' status) */}
                                        {task.status === "submitted" && (
                                            <div className="p-4 bg-white border-2 border-black rounded-xl shadow-neo-xs space-y-3">
                                                <h4 className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                                                    <Shield className="w-4 h-4 text-purple-600" /> Review Deliverable
                                                </h4>

                                                {cannotApproveDueToSelfReview && (
                                                    <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg flex items-start gap-2">
                                                        <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs text-amber-900 font-bold">
                                                            Self-Review Protection: You are the submitter/creator of this task.
                                                            Orbix governance policy requires an authorized department lead or administrator to approve your deliverable.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewDecision("approved")}
                                                        disabled={cannotApproveDueToSelfReview}
                                                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg border-2 border-black transition ${
                                                            reviewDecision === "approved"
                                                                ? "bg-teal-300 text-teal-950 shadow-neo-xs font-black"
                                                                : "bg-white text-neutral-600 opacity-60"
                                                        } ${
                                                            cannotApproveDueToSelfReview
                                                                ? "cursor-not-allowed opacity-30"
                                                                : ""
                                                        }`}
                                                    >
                                                        Approve Work
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReviewDecision("changes_requested")}
                                                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg border-2 border-black transition ${
                                                            reviewDecision === "changes_requested"
                                                                ? "bg-orange-300 text-orange-950 shadow-neo-xs font-black"
                                                                : "bg-white text-neutral-600 opacity-60"
                                                        }`}
                                                    >
                                                        Request Changes
                                                    </button>
                                                </div>

                                                <textarea
                                                    value={reviewComments}
                                                    onChange={(e) => setReviewComments(e.target.value)}
                                                    placeholder="Provide detailed feedback or approval comments..."
                                                    rows={2}
                                                    required
                                                    className="w-full p-2.5 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none resize-none"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={handleReviewDeliverable}
                                                    disabled={
                                                        submittingReview ||
                                                        !reviewComments.trim() ||
                                                        (reviewDecision === "approved" && cannotApproveDueToSelfReview)
                                                    }
                                                    className="px-4 py-2 bg-black text-white border-2 border-black rounded-xl text-xs font-black hover:bg-neutral-800 transition shadow-neo flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    {submittingReview && (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    )}
                                                    Submit Review Decision
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 3: ACTIVITY STREAM */}
                                {activeTab === "activity" && (
                                    <div className="space-y-2">
                                        {activity.length === 0 ? (
                                            <p className="text-xs text-neutral-500 italic p-3 text-center">
                                                No activity recorded.
                                            </p>
                                        ) : (
                                            activity.map((act) => (
                                                <div
                                                    key={act.id}
                                                    className="p-2.5 bg-white border border-neutral-200 rounded-lg text-xs flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-black">
                                                            {act.actor?.firstName} {act.actor?.lastName}
                                                        </span>
                                                        <span className="text-neutral-500">
                                                            performed <b>{act.action.replace("_", " ")}</b>
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-neutral-400">
                                                        {new Date(act.createdAt).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column (1 col): Metadata, Assignees, Dates */}
                        <div className="p-6 space-y-5 bg-[#FAF6EE]">
                            {/* Priority & Dates Card */}
                            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-amber-600" /> Priority & Schedule
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingDetails(!isEditingDetails)}
                                        className="text-[10px] font-black uppercase text-indigo-600 hover:underline flex items-center gap-1"
                                    >
                                        <Edit3 className="w-3 h-3" />
                                        {isEditingDetails ? "Cancel" : "Edit"}
                                    </button>
                                </div>

                                {!isEditingDetails ? (
                                    <>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
                                                Priority
                                            </span>
                                            <span
                                                className={`px-2.5 py-1 rounded text-xs font-black uppercase border border-black ${
                                                    task.priority === "urgent"
                                                        ? "bg-rose-200 text-rose-900"
                                                        : task.priority === "high"
                                                        ? "bg-amber-100 text-amber-900"
                                                        : "bg-blue-100 text-blue-900"
                                                }`}
                                            >
                                                {task.priority}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
                                                Timeline
                                            </span>
                                            <div className="text-xs font-bold text-black space-y-0.5">
                                                <p>
                                                    <Calendar className="w-3.5 h-3.5 inline mr-1 text-neutral-500" />
                                                    Start: {task.startDate ? new Date(task.startDate).toLocaleDateString() : "Not set"}
                                                </p>
                                                <p>
                                                    <Calendar className="w-3.5 h-3.5 inline mr-1 text-red-600" />
                                                    Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No deadline"}
                                                </p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-3 pt-1">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-neutral-600 block mb-1">
                                                Priority
                                            </label>
                                            <NeoSelect
                                                value={editPriority}
                                                onChange={(v) => setEditPriority(v as WorkspaceTaskPriority)}
                                                size="sm"
                                                triggerClassName="w-full text-xs font-bold"
                                                options={[
                                                    { value: "low", label: "Low" },
                                                    { value: "medium", label: "Medium" },
                                                    { value: "high", label: "High" },
                                                    { value: "urgent", label: "Urgent" },
                                                ]}
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-neutral-600 block mb-1">
                                                Start Date
                                            </label>
                                            <NeoDateTimePicker
                                                mode="date"
                                                value={editStartDate}
                                                onChange={(val) => setEditStartDate(val)}
                                                className="w-full"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-black uppercase text-neutral-600 block mb-1">
                                                Due Date
                                            </label>
                                            <NeoDateTimePicker
                                                mode="date"
                                                value={editDueDate}
                                                onChange={(val) => setEditDueDate(val)}
                                                className="w-full"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSaveDetails}
                                            disabled={savingDetails}
                                            className="w-full py-2 bg-[#A6FF70] border border-black rounded-lg text-xs font-black text-black hover:bg-[#92ec5d] transition shadow-neo-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            {savingDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Save Changes
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Active Watchers Card */}
                            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Eye className="w-4 h-4 text-amber-600" /> Watchers ({task.watchers?.length || 0})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleToggleWatcher}
                                        className="text-[10px] font-black uppercase text-amber-700 hover:underline"
                                    >
                                        {task.isWatching ? "Unwatch" : "Watch"}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {(task.watchers || []).length > 0 ? (
                                        task.watchers?.map((w) => (
                                            <span
                                                key={w.id}
                                                title={w.user?.username}
                                                className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black text-[10px] font-bold text-black"
                                            >
                                                @{w.user?.username || "user"}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-xs text-neutral-400 italic">No watchers subscribed</p>
                                    )}
                                </div>
                            </div>

                            {/* Assignees Card */}
                            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-indigo-600" /> Assigned Members
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => setIsReassigning(!isReassigning)}
                                        className="text-[10px] font-black uppercase text-indigo-600 hover:underline"
                                    >
                                        {isReassigning ? "Cancel" : "Reassign"}
                                    </button>
                                </div>

                                {!isReassigning ? (
                                    <div className="space-y-2">
                                        {task.currentAssignees && task.currentAssignees.length > 0 ? (
                                            task.currentAssignees.map((a) => (
                                                <div key={a.id} className="flex items-center gap-2 text-xs font-bold text-black">
                                                    <div className="w-6 h-6 rounded-full bg-neutral-200 border border-black flex items-center justify-center text-[10px]">
                                                        {a.user?.firstName?.charAt(0) || "?"}
                                                    </div>
                                                    <span>
                                                        {a.user?.firstName} {a.user?.lastName}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-neutral-400 italic">No members assigned</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="max-h-36 overflow-y-auto space-y-1">
                                            {allMembers
                                                .filter((m) => m.membershipStatus === "active" && !m.isSuspended)
                                                .map((m) => {
                                                    const isChecked = reassignUserIds.includes(m.userId);
                                                    return (
                                                        <div
                                                            key={m.id}
                                                            onClick={() => {
                                                                setReassignUserIds((prev) =>
                                                                    isChecked
                                                                        ? prev.filter((id) => id !== m.userId)
                                                                        : [...prev, m.userId]
                                                                );
                                                            }}
                                                            className={`p-1.5 rounded cursor-pointer border text-xs flex items-center justify-between ${
                                                                isChecked
                                                                    ? "bg-indigo-50 border-indigo-600 font-bold"
                                                                    : "bg-white border-neutral-200"
                                                            }`}
                                                        >
                                                            <span>
                                                                {m.user?.firstName} {m.user?.lastName}
                                                            </span>
                                                            <NeoCheckbox
                                                                checked={isChecked}
                                                                onChange={() => {}}
                                                                size="sm"
                                                                colorScheme="cyan"
                                                            />
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSaveReassignment}
                                            className="w-full py-1.5 bg-[#A6FF70] border border-black rounded-lg text-xs font-black text-black hover:bg-[#92ec5d] transition shadow-neo-xs"
                                        >
                                            Save Assignments
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Creator Card */}
                            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-1.5 text-xs">
                                <span className="text-[10px] font-black uppercase text-neutral-500 block">Created By</span>
                                <p className="font-bold text-black">
                                    {task.creator?.firstName} {task.creator?.lastName} (@{task.creator?.username})
                                </p>
                                <span className="text-[10px] text-neutral-400">
                                    {new Date(task.createdAt).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
