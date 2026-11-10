// Frontend/src/app/Club/TeamWorkspace/Modals/CreateChannelModal.tsx
import React, { useState } from "react";
import {
    Hash,
    Volume2,
    MessageSquare,
    CheckSquare,
    X,
    Lock,
    RefreshCw,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceDepartment,
    WorkspaceRole,
    WorkspaceMember,
    WorkspaceChannelCategory,
    WorkspaceChannel,
    WorkspaceChannelType,
} from "../../../../types/workspace";

interface CreateChannelModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    categories: WorkspaceChannelCategory[];
    departments: WorkspaceDepartment[];
    roles: WorkspaceRole[];
    members: WorkspaceMember[];
    defaultCategoryId?: string | null;
    defaultDepartmentId?: string | null;
    onChannelCreated: (channel: WorkspaceChannel) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
    isOpen,
    onClose,
    clubId,
    categories,
    departments,
    roles,
    defaultCategoryId,
    defaultDepartmentId,
    onChannelCreated,
}) => {
    const toast = useToast();
    const [name, setName] = useState("");
    const [topic, setTopic] = useState("");
    const [channelType, setChannelType] = useState<WorkspaceChannelType>("text");
    const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId || (categories[0]?.id || null));
    const [departmentId, setDepartmentId] = useState<string | null>(defaultDepartmentId || null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [isCategorySynced, setIsCategorySynced] = useState(true);
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const channelTypes: Array<{
        type: WorkspaceChannelType;
        label: string;
        desc: string;
        icon: React.ReactNode;
    }> = [
        {
            type: "text",
            label: "Text Channel",
            desc: "Post messages, share documents, stickers, and threads",
            icon: <Hash className="w-5 h-5 text-indigo-400" />,
        },
        {
            type: "announcement",
            label: "Announcement Channel",
            desc: "Only authorized leaders can post; members can read and react",
            icon: <Volume2 className="w-5 h-5 text-amber-400" />,
        },
        {
            type: "forum",
            label: "Discussion / Forum",
            desc: "Organized topic-based discussion boards",
            icon: <MessageSquare className="w-5 h-5 text-cyan-400" />,
        },
        {
            type: "task_discussion",
            label: "Task Discussion / Thread",
            desc: "Dedicated context channel linked to team project deliverables",
            icon: <CheckSquare className="w-5 h-5 text-emerald-400" />,
        },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formattedName = name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9_-]/g, "");

        if (!formattedName) {
            toast.error("Valid channel name is required.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.createChannel(
                {
                    name: formattedName,
                    topic: topic.trim() || undefined,
                    channelType,
                    categoryId: categoryId || null,
                    departmentId: departmentId || null,
                    isPrivate,
                    isCategorySynced,
                },
                clubId
            );

            if (res.success && res.channel) {
                // If private channel and roles selected: configure overrides
                if (isPrivate && selectedRoleIds.length > 0) {
                    for (const roleId of selectedRoleIds) {
                        await workspaceApi.setChannelOverride(
                            res.channel.id,
                            {
                                roleId,
                                allowPermissions: ["view_channel", "send_messages"],
                            },
                            clubId
                        );
                    }
                }

                toast.success(`Channel #${res.channel.name} created successfully.`);
                onChannelCreated(res.channel);
                handleClose();
            }
        } catch (err: any) {
            console.error("Failed to create channel:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to create channel.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setName("");
        setTopic("");
        setChannelType("text");
        setCategoryId(defaultCategoryId || (categories[0]?.id || null));
        setDepartmentId(defaultDepartmentId || null);
        setIsPrivate(false);
        setIsCategorySynced(true);
        setSelectedRoleIds([]);
        onClose();
    };

    const toggleRole = (roleId: string) => {
        setSelectedRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Hash className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Create Channel</h3>
                            <p className="text-xs text-slate-400">Configure channel type, privacy, and permissions</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/60 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {/* Channel Type Selector */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                            Channel Type
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {channelTypes.map((ct) => {
                                const isSelected = channelType === ct.type;
                                return (
                                    <button
                                        type="button"
                                        key={ct.type}
                                        onClick={() => setChannelType(ct.type)}
                                        className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                                            isSelected
                                                ? "bg-indigo-600/15 border-indigo-500/80 ring-1 ring-indigo-500/50"
                                                : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                                        }`}
                                    >
                                        <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 shrink-0">
                                            {ct.icon}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-200">{ct.label}</div>
                                            <div className="text-xs text-slate-400 leading-snug mt-0.5">{ct.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Channel Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Channel Name <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                                #
                            </span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="new-channel"
                                required
                                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm font-medium transition"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Spaces are automatically converted to hyphens.</p>
                    </div>

                    {/* Topic / Description */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Topic / Purpose (Optional)
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="What is this channel about?"
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 text-sm transition"
                        />
                    </div>

                    {/* Category & Department selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                Parent Category
                            </label>
                            <select
                                value={categoryId || ""}
                                onChange={(e) => setCategoryId(e.target.value ? e.target.value : null)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50 transition"
                            >
                                <option value="">No Category</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                Department Association
                            </label>
                            <select
                                value={departmentId || ""}
                                onChange={(e) => setDepartmentId(e.target.value ? e.target.value : null)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50 transition"
                            >
                                <option value="">Club-Wide</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Category Permission Sync */}
                    {categoryId && (
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
                            <div className="flex items-center gap-2.5">
                                <RefreshCw className="w-4 h-4 text-emerald-400" />
                                <div>
                                    <div className="text-sm font-medium text-slate-200">
                                        Sync Permissions with Category
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        Inherit permission overrides from parent category
                                    </div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={isCategorySynced}
                                onChange={(e) => setIsCategorySynced(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-700 bg-slate-900 focus:ring-indigo-500 focus:ring-offset-slate-900"
                            />
                        </div>
                    )}

                    {/* Private Channel Toggle */}
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Lock className="w-4 h-4 text-amber-400" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-200">Private Channel</div>
                                    <div className="text-xs text-slate-400">
                                        Only selected roles and members can view this channel
                                    </div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPrivate}
                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Role selection if private */}
                        {isPrivate && (
                            <div className="pt-3 border-t border-slate-800/80 space-y-2 animate-in fade-in duration-150">
                                <div className="text-xs font-semibold text-slate-400">
                                    Allowed Roles (Admins & Owners have access automatically):
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                                    {roles.map((role) => {
                                        const isSelected = selectedRoleIds.includes(role.id);
                                        return (
                                            <button
                                                type="button"
                                                key={role.id}
                                                onClick={() => toggleRole(role.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                                }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: role.color || "#6366f1" }}
                                                />
                                                {role.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !name.trim()}
                            className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition"
                        >
                            {submitting ? "Creating..." : "Create Channel"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
