// Frontend/src/app/Club/TeamWorkspace/Tasks/CreateTaskModal.tsx
import React, { useState, useMemo } from "react";
import {
    X,
    CheckSquare,
    Link as LinkIcon,
    Calendar,
    Users,
    Lock,
    Plus,
    Trash2,
    Search,
    Loader2,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceDepartment,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceTaskPriority,
    WorkspaceTaskChecklistItem,
    WorkspaceTaskReferenceLink,
    WorkspaceFile,
} from "../../../../types/workspace";
import { useToast } from "../../../../context/ToastContext";
import { FileUploadZone } from "../Files/FileUploadZone";
import { AttachmentList } from "../Files/AttachmentList";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoDateTimePicker } from "../../../../components/NeoDateTimePicker";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

interface CreateTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    departments: WorkspaceDepartment[];
    members: WorkspaceMember[];
    roles: WorkspaceRole[];
    defaultDepartmentId?: string | null;
    onTaskCreated: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
    isOpen,
    onClose,
    clubId,
    departments,
    members,
    roles,
    defaultDepartmentId,
    onTaskCreated,
}) => {
    const toast = useToast();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [departmentId, setDepartmentId] = useState<string>(defaultDepartmentId || "");
    const [priority, setPriority] = useState<WorkspaceTaskPriority>("medium");
    const [startDate, setStartDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [isRestricted, setIsRestricted] = useState(false);
    const [assignedRoleId, setAssignedRoleId] = useState<string>("");

    // Multi-member assignment state
    const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
    const [memberSearch, setMemberSearch] = useState("");
    const [memberDeptFilter, setMemberDeptFilter] = useState("all");

    // Checklist state
    const [checklist, setChecklist] = useState<WorkspaceTaskChecklistItem[]>([]);
    const [newChecklistText, setNewChecklistText] = useState("");

    // Reference links state
    const [referenceLinks, setReferenceLinks] = useState<WorkspaceTaskReferenceLink[]>([]);
    const [newLinkTitle, setNewLinkTitle] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");

    // Supporting documents & media attachments
    const [uploadedFiles, setUploadedFiles] = useState<WorkspaceFile[]>([]);

    const [submitting, setSubmitting] = useState(false);

    // Filter members for assignee selector
    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            if (m.membershipStatus !== "active" || m.isSuspended) return false;
            if (memberDeptFilter !== "all" && m.departmentId !== memberDeptFilter) return false;
            if (memberSearch.trim()) {
                const q = memberSearch.toLowerCase();
                const u = m.user;
                const matchName = `${u?.firstName || ""} ${u?.lastName || ""}`.toLowerCase().includes(q);
                const matchUser = (u?.username || "").toLowerCase().includes(q);
                return matchName || matchUser;
            }
            return true;
        });
    }, [members, memberDeptFilter, memberSearch]);

    if (!isOpen) return null;

    const handleAddChecklistItem = () => {
        if (!newChecklistText.trim()) return;
        const newItem: WorkspaceTaskChecklistItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            text: newChecklistText.trim(),
            isCompleted: false,
        };
        setChecklist((prev) => [...prev, newItem]);
        setNewChecklistText("");
    };

    const handleRemoveChecklistItem = (id: string) => {
        setChecklist((prev) => prev.filter((item) => item.id !== id));
    };

    const handleAddLink = () => {
        if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
        setReferenceLinks((prev) => [
            ...prev,
            { title: newLinkTitle.trim(), url: newLinkUrl.trim() },
        ]);
        setNewLinkTitle("");
        setNewLinkUrl("");
    };

    const handleRemoveLink = (idx: number) => {
        setReferenceLinks((prev) => prev.filter((_, i) => i !== idx));
    };

    const toggleAssignee = (userId: string) => {
        setSelectedAssigneeIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Task title is required.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.createTask(
                {
                    title: title.trim(),
                    description: description.trim() || undefined,
                    departmentId: departmentId || null,
                    priority,
                    startDate: startDate ? new Date(startDate).toISOString() : null,
                    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                    assignedRoleId: assignedRoleId || null,
                    checklist,
                    referenceLinks,
                    isRestricted,
                    assigneeUserIds: selectedAssigneeIds,
                    fileIds: uploadedFiles.map((f) => f.id),
                },
                clubId
            );

            if (res.success) {
                toast.success("Task created successfully!");
                onTaskCreated();
                onClose();
            }
        } catch (err: any) {
            console.error("Create task error:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to create task.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-[#FAF6EE] border-4 border-black rounded-2xl w-full max-w-2xl shadow-neo overflow-hidden my-8">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b-2 border-black bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#A6FF70] border-2 border-black rounded-xl shadow-neo-xs">
                            <CheckSquare className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-black">Create Workspace Task</h2>
                            <p className="text-xs font-semibold text-neutral-600">
                                Define goals, assign responsibilities, and set clear milestones
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg border border-transparent hover:border-black transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                            Task Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Design Event Registration Flow"
                            required
                            className="w-full px-4 py-2.5 bg-white border-2 border-black rounded-xl font-medium text-black focus:outline-none focus:ring-2 focus:ring-black shadow-neo-xs"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                            Description & Deliverables
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Provide task background, expected outcomes, and technical instructions..."
                            rows={3}
                            className="w-full px-4 py-2.5 bg-white border-2 border-black rounded-xl font-medium text-black focus:outline-none focus:ring-2 focus:ring-black shadow-neo-xs resize-none"
                        />
                    </div>

                    {/* Department, Target Role & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Department (Optional)
                            </label>
                            <NeoSelect
                                value={departmentId}
                                onChange={(val) => setDepartmentId(val)}
                                size="sm"
                                triggerClassName="w-full text-xs font-bold"
                                options={[
                                    { value: "", label: "Workspace-Wide" },
                                    ...departments.map((d) => ({ value: d.id, label: d.name })),
                                ]}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Target Role (Optional)
                            </label>
                            <NeoSelect
                                value={assignedRoleId}
                                onChange={(val) => setAssignedRoleId(val)}
                                size="sm"
                                triggerClassName="w-full text-xs font-bold"
                                options={[
                                    { value: "", label: "Any Role" },
                                    ...roles.map((r) => ({ value: r.id, label: r.name })),
                                ]}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Priority Level
                            </label>
                            <div className="grid grid-cols-4 gap-1">
                                {(["low", "medium", "high", "urgent"] as WorkspaceTaskPriority[]).map((p) => {
                                    const active = priority === p;
                                    const colors = {
                                        low: "bg-slate-200 text-slate-800",
                                        medium: "bg-blue-100 text-blue-800",
                                        high: "bg-amber-100 text-amber-800",
                                        urgent: "bg-rose-200 text-rose-900",
                                    };
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setPriority(p)}
                                            className={`py-2 text-xs font-black uppercase rounded-lg border-2 border-black transition ${
                                                active
                                                    ? `${colors[p]} shadow-neo-xs font-black scale-[1.02]`
                                                    : "bg-white text-neutral-600 opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Dates row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                <Calendar className="w-3.5 h-3.5 inline mr-1" /> Start Date
                            </label>
                            <NeoDateTimePicker
                                mode="date"
                                value={startDate}
                                onChange={(val) => setStartDate(val)}
                                placeholder="Select start date..."
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                <Calendar className="w-3.5 h-3.5 inline mr-1 text-red-600" /> Due Date / Deadline
                            </label>
                            <NeoDateTimePicker
                                mode="date"
                                value={dueDate}
                                onChange={(val) => setDueDate(val)}
                                placeholder="Select deadline..."
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Multi-Member Assignees */}
                    <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-indigo-600" /> Assign Team Members
                            </label>
                            <span className="text-xs font-bold text-neutral-500">
                                {selectedAssigneeIds.length} Selected
                            </span>
                        </div>

                        {/* Selected Assignees Pills */}
                        {selectedAssigneeIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-neutral-200">
                                {selectedAssigneeIds.map((uid) => {
                                    const m = members.find((mem) => mem.userId === uid);
                                    const name = m?.user
                                        ? `${m.user.firstName} ${m.user.lastName}`
                                        : uid;
                                    return (
                                        <span
                                            key={uid}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-black rounded-lg text-xs font-bold text-indigo-900 shadow-neo-xs"
                                        >
                                            {name}
                                            <button
                                                type="button"
                                                onClick={() => toggleAssignee(uid)}
                                                className="hover:text-red-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Search & Filter */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    placeholder="Search by name or username..."
                                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none shadow-neo-xs placeholder:text-neutral-400 placeholder:font-normal"
                                />
                            </div>
                            <div className="min-w-[170px]">
                                <NeoSelect
                                    value={memberDeptFilter}
                                    onChange={(val) => setMemberDeptFilter(val)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={[
                                        { value: "all", label: "All Departments" },
                                        ...departments.map((d) => ({ value: d.id, label: d.name })),
                                    ]}
                                />
                            </div>
                        </div>

                        {/* Member List Preview */}
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {filteredMembers.map((m) => {
                                const isSelected = selectedAssigneeIds.includes(m.userId);
                                return (
                                    <div
                                        key={m.id}
                                        onClick={() => toggleAssignee(m.userId)}
                                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer border-2 text-xs font-medium transition ${
                                            isSelected
                                                ? "bg-indigo-50 border-black shadow-neo-xs text-black font-bold"
                                                : "bg-white border-neutral-200 hover:border-black text-neutral-800"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <NeoCheckbox
                                                checked={isSelected}
                                                onChange={() => {}}
                                                size="sm"
                                                colorScheme="cyan"
                                            />
                                            <div className="w-6 h-6 rounded-full bg-neutral-200 border border-black flex items-center justify-center font-black text-[10px] text-black">
                                                {m.user?.firstName?.charAt(0) || "?"}
                                            </div>
                                            <div>
                                                <span className="font-bold text-black">
                                                    {m.user?.firstName} {m.user?.lastName}
                                                </span>
                                                <span className="text-[10px] text-neutral-500 ml-1.5 font-medium">
                                                    (@{m.user?.username})
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 bg-neutral-100 rounded-lg border border-black font-black text-neutral-700">
                                            {m.role?.name || "Member"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Interactive Checklist Builder */}
                    <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                        <label className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-emerald-600" /> Task Checklist Items
                        </label>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newChecklistText}
                                onChange={(e) => setNewChecklistText(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddChecklistItem();
                                    }
                                }}
                                placeholder="Add actionable checklist item..."
                                className="flex-1 px-3 py-1.5 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={handleAddChecklistItem}
                                className="px-3 py-1.5 bg-[#A6FF70] border border-black rounded-lg text-xs font-bold text-black shadow-neo-xs hover:bg-[#92ec5d] transition flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                        </div>

                        {checklist.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                {checklist.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-neutral-400 font-bold text-[10px]">{idx + 1}.</span>
                                            <span className="text-black">{item.text}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveChecklistItem(item.id)}
                                            className="text-neutral-400 hover:text-red-600 transition"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reference Links */}
                    <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                        <label className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                            <LinkIcon className="w-4 h-4 text-blue-600" /> Reference Links
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={newLinkTitle}
                                onChange={(e) => setNewLinkTitle(e.target.value)}
                                placeholder="Link title (e.g. Figma Prototype)"
                                className="px-3 py-1.5 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={newLinkUrl}
                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 px-3 py-1.5 bg-neutral-50 border border-black rounded-lg text-xs font-medium text-black focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddLink}
                                    className="px-3 py-1.5 bg-blue-100 border border-black rounded-lg text-xs font-bold text-blue-900 shadow-neo-xs hover:bg-blue-200 transition"
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        {referenceLinks.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                                {referenceLinks.map((link, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium"
                                    >
                                        <div className="truncate mr-2">
                                            <span className="font-bold text-black">{link.title}: </span>
                                            <span className="text-blue-600 underline truncate">{link.url}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLink(idx)}
                                            className="text-neutral-400 hover:text-red-600 transition"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Supporting Documents & Media Attachments */}
                    <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo-xs space-y-3">
                        <label className="text-xs font-black uppercase tracking-wider text-black flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <LinkIcon className="w-4 h-4 text-purple-600" /> Supporting Documents & Media
                            </span>
                            <span className="text-[10px] text-neutral-500 font-bold">PDFs, Images, Videos, Office Docs</span>
                        </label>

                        <FileUploadZone
                            clubId={clubId}
                            departmentId={departmentId || null}
                            parentResourceType="attachment"
                            compact
                            onFileUploaded={(newFile) => setUploadedFiles((prev) => [...prev, newFile])}
                        />

                        {uploadedFiles.length > 0 && (
                            <AttachmentList
                                files={uploadedFiles}
                                clubId={clubId}
                                canDelete
                                onFileDeleted={(id) => setUploadedFiles((prev) => prev.filter((f) => f.id !== id))}
                            />
                        )}
                    </div>

                    {/* Department Privacy / Restricted Task Switch */}
                    <div className="flex items-center justify-between p-3.5 bg-neutral-100 border-2 border-black rounded-xl">
                        <div className="flex items-start gap-2.5">
                            <Lock className="w-4 h-4 text-neutral-800 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-black text-black">Restricted Department Task</h4>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                    Limit access exclusively to assigned members, department staff, and workspace administrators.
                                </p>
                            </div>
                        </div>
                        <NeoCheckbox
                            checked={isRestricted}
                            onCheckedChange={(checked) => setIsRestricted(checked)}
                            colorScheme="yellow"
                            size="sm"
                        />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 bg-white border-2 border-black rounded-xl text-xs font-black text-black hover:bg-neutral-100 transition shadow-neo-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-[#A6FF70] border-2 border-black rounded-xl text-xs font-black text-black hover:bg-[#92ec5d] transition shadow-neo flex items-center gap-2"
                        >
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Create Task
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
