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
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white border-2 border-black rounded-2xl w-full max-w-xl shadow-neo overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black">
                            <Hash className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-black">Create Channel</h3>
                            <p className="text-xs font-semibold text-neutral-600">Configure channel type, privacy, and permissions</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-neutral-500 hover:text-black p-2 rounded-lg hover:bg-neutral-100 border-2 border-transparent hover:border-black transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {/* Channel Type Selector */}
                    <div>
                        <label className="block text-xs font-black text-black uppercase tracking-wider mb-2.5">
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
                                        className={`p-3 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                                            isSelected
                                                ? "bg-[#A6FF70] border-black shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] border-black/30 hover:border-black"
                                        }`}
                                    >
                                        <div className="p-2 rounded-lg bg-white border border-black shrink-0">
                                            {ct.icon}
                                        </div>
                                        <div>
                                            <div className="text-sm font-black text-black">{ct.label}</div>
                                            <div className="text-xs text-neutral-700 leading-snug mt-0.5 font-medium">{ct.desc}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Channel Name */}
                    <div>
                        <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                            Channel Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 font-mono text-sm font-bold">
                                #
                            </span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="new-channel"
                                required
                                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-black placeholder-neutral-400 focus:outline-none focus:bg-white text-sm font-semibold transition shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                        <p className="text-xs text-neutral-500 font-medium mt-1">Spaces are automatically converted to hyphens.</p>
                    </div>

                    {/* Topic / Description */}
                    <div>
                        <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                            Topic / Purpose (Optional)
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="What is this channel about?"
                            className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-black placeholder-neutral-400 focus:outline-none focus:bg-white text-sm font-semibold transition shadow-[2px_2px_0px_#000]"
                        />
                    </div>

                    {/* Category & Department selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                                Parent Category
                            </label>
                            <NeoSelect
                                value={categoryId || ""}
                                onChange={(val) => setCategoryId(val ? val : null)}
                                options={[
                                    { value: "", label: "No Category" },
                                    ...categories.map((cat) => ({
                                        value: cat.id,
                                        label: cat.name,
                                    })),
                                ]}
                                placeholder="No Category"
                                size="md"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                                Department Association
                            </label>
                            <NeoSelect
                                value={departmentId || ""}
                                onChange={(val) => setDepartmentId(val ? val : null)}
                                options={[
                                    { value: "", label: "Club-Wide" },
                                    ...departments.map((dept) => ({
                                        value: dept.id,
                                        label: dept.name,
                                    })),
                                ]}
                                placeholder="Club-Wide"
                                size="md"
                            />
                        </div>
                    </div>

                    {/* Category Permission Sync */}
                    {categoryId && (
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <div className="flex items-center gap-2.5">
                                <RefreshCw className="w-4 h-4 text-black" />
                                <div>
                                    <div className="text-sm font-black text-black">
                                        Sync Permissions with Category
                                    </div>
                                    <div className="text-xs font-medium text-neutral-600">
                                        Inherit permission overrides from parent category
                                    </div>
                                </div>
                            </div>
                            <NeoCheckbox
                                checked={isCategorySynced}
                                onCheckedChange={(checked) => setIsCategorySynced(checked)}
                                colorScheme="cyan"
                                size="sm"
                            />
                        </div>
                    )}

                    {/* Private Channel Toggle */}
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3 shadow-[2px_2px_0px_#000]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Lock className="w-4 h-4 text-black" />
                                <div>
                                    <div className="text-sm font-black text-black">Private Channel</div>
                                    <div className="text-xs font-medium text-neutral-600">
                                        Only selected roles and members can view this channel
                                    </div>
                                </div>
                            </div>
                            <NeoCheckbox
                                checked={isPrivate}
                                onCheckedChange={(checked) => setIsPrivate(checked)}
                                colorScheme="yellow"
                                size="sm"
                            />
                        </div>

                        {/* Role selection if private */}
                        {isPrivate && (
                            <div className="pt-3 border-t-2 border-black/10 space-y-2 animate-in fade-in duration-150">
                                <div className="text-xs font-black text-black">
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
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 border-black transition flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? "bg-[#A6FF70] text-black shadow-[2px_2px_0px_#000]"
                                                        : "bg-white text-black hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full border border-black"
                                                    style={{ backgroundColor: role.color || "#000" }}
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
                    <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-xl text-xs font-black text-black bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !name.trim()}
                            className="px-5 py-2 rounded-xl text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Creating..." : "Create Channel"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
