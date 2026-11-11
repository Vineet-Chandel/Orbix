// Frontend/src/app/Club/TeamWorkspace/Modals/ChannelSettingsModal.tsx
import React, { useState, useEffect } from "react";
import {
    Hash,
    X,
    Lock,
    RefreshCw,
    Trash2,
    AlertCircle,
    Check,
    Shield,
    Clock,
    Plus,
    User,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceDepartment,
    WorkspaceRole,
    WorkspaceMember,
    WorkspaceChannelCategory,
    WorkspaceChannel,
    WorkspaceChannelOverride,
} from "../../../../types/workspace";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

interface ChannelSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    channel: WorkspaceChannel;
    categories: WorkspaceChannelCategory[];
    departments: WorkspaceDepartment[];
    roles?: WorkspaceRole[];
    members?: WorkspaceMember[];
    canManageChannel: boolean;
    onChannelUpdated: (updated: WorkspaceChannel) => void;
    onChannelDeleted: (channelId: string) => void;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
    isOpen,
    onClose,
    clubId,
    channel,
    categories,
    departments,
    roles = [],
    members = [],
    canManageChannel,
    onChannelUpdated,
    onChannelDeleted,
}) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<"general" | "overrides">("general");

    // General fields
    const [name, setName] = useState(channel.name);
    const [topic, setTopic] = useState(channel.topic || "");
    const [categoryId, setCategoryId] = useState<string | null>(channel.categoryId || null);
    const [departmentId, setDepartmentId] = useState<string | null>(channel.departmentId || null);
    const [isPrivate, setIsPrivate] = useState(channel.isPrivate);
    const [isCategorySynced, setIsCategorySynced] = useState(channel.isCategorySynced);
    const [slowmode, setSlowmode] = useState<number>(channel.defaultSlowmodeSeconds || 0);

    // Category move prompt state
    const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
    const [showCategoryMoveConfirm, setShowCategoryMoveConfirm] = useState(false);

    // Overrides state
    const [overrides, setOverrides] = useState<WorkspaceChannelOverride[]>([]);
    const [loadingOverrides, setLoadingOverrides] = useState(false);
    const [showAddOverride, setShowAddOverride] = useState(false);
    const [overrideTargetType, setOverrideTargetType] = useState<"role" | "member">("role");
    const [selectedTargetId, setSelectedTargetId] = useState<string>("");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["view_channel"]);
    const [overrideType, setOverrideType] = useState<"allow" | "deny">("allow");
    const [savingOverride, setSavingOverride] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        if (isOpen && channel.id) {
            setName(channel.name);
            setTopic(channel.topic || "");
            setCategoryId(channel.categoryId || null);
            setDepartmentId(channel.departmentId || null);
            setIsPrivate(channel.isPrivate);
            setIsCategorySynced(channel.isCategorySynced);
            setSlowmode(channel.defaultSlowmodeSeconds || 0);
            fetchDetails();
        }
    }, [isOpen, channel.id]);

    const fetchDetails = async () => {
        try {
            setLoadingOverrides(true);
            const res = await workspaceApi.getChannelDetails(channel.id, clubId);
            if (res.success && res.channel) {
                setIsCategorySynced(res.channel.isCategorySynced);
                if ((res.channel as any).overrides) {
                    setOverrides((res.channel as any).overrides);
                }
            }
        } catch (err) {
            console.error("Failed to load channel details:", err);
        } finally {
            setLoadingOverrides(false);
        }
    };

    if (!isOpen) return null;

    const handleCategoryChange = (newCatId: string | null) => {
        if (newCatId !== categoryId) {
            setPendingCategoryId(newCatId);
            setShowCategoryMoveConfirm(true);
        }
    };

    const confirmCategoryMove = async (syncWithNew: boolean) => {
        try {
            setSubmitting(true);
            const res = await workspaceApi.updateChannel(
                channel.id,
                {
                    categoryId: pendingCategoryId,
                    syncWithNewCategory: syncWithNew,
                },
                clubId
            );

            if (res.success && res.channel) {
                setCategoryId(pendingCategoryId);
                setIsCategorySynced(res.channel.isCategorySynced);
                onChannelUpdated(res.channel);
                toast.success(
                    syncWithNew
                        ? "Channel moved and synced with new category permissions."
                        : "Channel moved while preserving independent permissions."
                );
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to update category.");
        } finally {
            setShowCategoryMoveConfirm(false);
            setPendingCategoryId(null);
            setSubmitting(false);
        }
    };

    const handleSyncNow = async () => {
        try {
            setSyncing(true);
            const res = await workspaceApi.syncChannelWithCategory(channel.id, clubId);
            if (res.success) {
                setIsCategorySynced(true);
                toast.success("Permissions successfully synced with category!");
                fetchDetails();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to sync permissions.");
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const res = await workspaceApi.updateChannel(
                channel.id,
                {
                    name: name.trim().toLowerCase().replace(/\s+/g, "-"),
                    topic: topic.trim() || undefined,
                    departmentId: departmentId || null,
                    isPrivate,
                    defaultSlowmodeSeconds: slowmode,
                },
                clubId
            );

            if (res.success && res.channel) {
                toast.success("Channel settings updated.");
                onChannelUpdated(res.channel);
                onClose();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to save channel settings.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteChannel = async () => {
        if (!confirm(`Are you sure you want to permanently delete #${channel.name}? All messages will be lost.`)) {
            return;
        }

        try {
            setDeleting(true);
            const res = await workspaceApi.deleteChannel(channel.id, clubId);
            if (res.success) {
                toast.success(`Channel #${channel.name} deleted.`);
                onChannelDeleted(channel.id);
                onClose();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to delete channel.");
        } finally {
            setDeleting(false);
        }
    };

    const handleAddOverride = async () => {
        if (!selectedTargetId) {
            toast.error("Please select a role or member.");
            return;
        }
        if (selectedPermissions.length === 0) {
            toast.error("Select at least one permission.");
            return;
        }

        try {
            setSavingOverride(true);
            const payload = {
                roleId: overrideTargetType === "role" ? selectedTargetId : null,
                memberId: overrideTargetType === "member" ? selectedTargetId : null,
                allowPermissions: overrideType === "allow" ? selectedPermissions : [],
                denyPermissions: overrideType === "deny" ? selectedPermissions : [],
            };

            const res = await workspaceApi.setChannelOverride(channel.id, payload, clubId);
            if (res.success) {
                toast.success("Channel override saved.");
                setShowAddOverride(false);
                setSelectedTargetId("");
                fetchDetails();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to set override.");
        } finally {
            setSavingOverride(false);
        }
    };

    const handleDeleteOverride = async (overrideId: string) => {
        try {
            const res = await workspaceApi.deleteChannelOverride(channel.id, overrideId, clubId);
            if (res.success) {
                toast.success("Override removed.");
                setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to remove override.");
        }
    };

    const togglePermissionSelection = (perm: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
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
                            <h3 className="text-lg font-black text-black">
                                Channel Settings: #{channel.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs uppercase font-bold text-neutral-600">
                                    {channel.channelType}
                                </span>
                                <span className="text-neutral-400">•</span>
                                {isCategorySynced ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#A6FF70] px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                        <Check className="w-3 h-3 text-black" /> Synced with Category
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#FFE566] px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                        <AlertCircle className="w-3 h-3 text-black" /> Custom Overrides
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-black p-2 rounded-lg hover:bg-neutral-100 border-2 border-transparent hover:border-black transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b-2 border-black bg-[#FAF6EE] px-6 gap-2">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`px-4 py-2.5 text-xs font-black border-b-2 -mb-[2px] transition ${
                            activeTab === "general"
                                ? "border-black text-black bg-white rounded-t-lg"
                                : "border-transparent text-neutral-600 hover:text-black"
                        }`}
                    >
                        General & Moderation
                    </button>
                    <button
                        onClick={() => setActiveTab("overrides")}
                        className={`px-4 py-2.5 text-xs font-black border-b-2 -mb-[2px] transition flex items-center gap-1.5 ${
                            activeTab === "overrides"
                                ? "border-black text-black bg-white rounded-t-lg"
                                : "border-transparent text-neutral-600 hover:text-black"
                        }`}
                    >
                        <Shield className="w-3.5 h-3.5" />
                        Permission Overrides ({overrides.length})
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* TAB 1: GENERAL & MODERATION */}
                    {activeTab === "general" && (
                        <>
                            {/* Category Move Confirmation Modal/Prompt */}
                            {showCategoryMoveConfirm && (
                                <div className="p-4 rounded-xl bg-[#FFF9D2] border-2 border-black text-black space-y-3 shadow-[2px_2px_0px_#000] animate-in fade-in duration-150">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-black shrink-0 mt-0.5" />
                                        <div>
                                            <div className="text-sm font-black text-black">
                                                Sync Permissions with New Parent Category?
                                            </div>
                                            <div className="text-xs text-neutral-800 mt-1 leading-relaxed font-medium">
                                                Do you want this channel to inherit the permission overrides of its new parent category, or keep its existing overrides?
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2.5 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => confirmCategoryMove(false)}
                                            className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-white border-2 border-black text-black hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000] transition"
                                        >
                                            Keep Existing (Unsynced)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => confirmCategoryMove(true)}
                                            className="px-3.5 py-1.5 rounded-lg text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] transition flex items-center gap-1.5"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Sync Now
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* General Settings Form */}
                            <form onSubmit={handleSaveGeneral} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                                        Channel Name
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={!canManageChannel}
                                        required
                                        className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-black font-semibold focus:outline-none focus:bg-white text-sm transition shadow-[2px_2px_0px_#000]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                                        Topic / Description
                                    </label>
                                    <textarea
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        disabled={!canManageChannel}
                                        rows={2}
                                        placeholder="Describe the purpose of this channel..."
                                        className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-black font-semibold focus:outline-none focus:bg-white text-sm transition resize-none shadow-[2px_2px_0px_#000]"
                                    />
                                </div>

                                {/* Category & Department */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                                            Parent Category
                                        </label>
                                        <NeoSelect
                                            value={categoryId || ""}
                                            onChange={(val) => handleCategoryChange(val ? val : null)}
                                            disabled={!canManageChannel}
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
                                            disabled={!canManageChannel}
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

                                {/* Slowmode / Moderation */}
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2 shadow-[2px_2px_0px_#000]">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-black" />
                                        <span className="text-xs font-black uppercase text-black">
                                            Slowmode (Message Cooldown)
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Members will be restricted to sending one message per cooldown interval.
                                    </p>
                                    <NeoSelect
                                        value={String(slowmode)}
                                        onChange={(val) => setSlowmode(parseInt(val, 10))}
                                        disabled={!canManageChannel}
                                        options={[
                                            { value: "0", label: "Off (No Cooldown)" },
                                            { value: "5", label: "5 Seconds" },
                                            { value: "10", label: "10 Seconds" },
                                            { value: "30", label: "30 Seconds" },
                                            { value: "60", label: "1 Minute" },
                                            { value: "120", label: "2 Minutes" },
                                            { value: "300", label: "5 Minutes" },
                                        ]}
                                        triggerClassName="w-full text-xs font-bold"
                                    />
                                </div>

                                {/* Permission Sync Panel (Discord Style) */}
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3 shadow-[2px_2px_0px_#000]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <RefreshCw className="w-4 h-4 text-black" />
                                            <div>
                                                <div className="text-sm font-black text-black">
                                                    Category Permission Synchronization
                                                </div>
                                                <div className="text-xs font-medium text-neutral-600">
                                                    {isCategorySynced
                                                        ? "This channel automatically inherits permissions from its category."
                                                        : "This channel has independent permission overrides."}
                                                </div>
                                            </div>
                                        </div>
                                        {!isCategorySynced && canManageChannel && (
                                            <button
                                                type="button"
                                                onClick={handleSyncNow}
                                                disabled={syncing || !categoryId}
                                                className="px-3 py-1.5 rounded-lg text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] transition flex items-center gap-1.5"
                                            >
                                                <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                                                Sync Now / Revert
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Private Channel Setting */}
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000]">
                                    <div className="flex items-center gap-2.5">
                                        <Lock className="w-4 h-4 text-black" />
                                        <div>
                                            <div className="text-sm font-black text-black">Private Channel</div>
                                            <div className="text-xs font-medium text-neutral-600">
                                                Restrict visibility to members with explicit roles or grants
                                            </div>
                                        </div>
                                    </div>
                                    <NeoCheckbox
                                        checked={isPrivate}
                                        onCheckedChange={(checked) => setIsPrivate(checked)}
                                        disabled={!canManageChannel}
                                    />
                                </div>

                                {/* Save Button */}
                                {canManageChannel && (
                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-5 py-2 rounded-xl text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                                        >
                                            {submitting ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                )}
                            </form>

                            {/* Danger Zone: Delete Channel */}
                            {canManageChannel && (
                                <div className="pt-6 border-t-2 border-black/15">
                                    <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-400 flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-black text-rose-900">Delete Channel</div>
                                            <div className="text-xs font-medium text-rose-700">
                                                Permanently delete this channel, its messages, attachments and threads
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleDeleteChannel}
                                            disabled={deleting}
                                            className="px-3.5 py-2 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-600 text-white border-2 border-black transition flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            {deleting ? "Deleting..." : "Delete Channel"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* TAB 2: PERMISSION OVERRIDES */}
                    {activeTab === "overrides" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-black text-black">Active Overrides</h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Role and member-level allowances or denials for #{channel.name}
                                    </p>
                                </div>
                                {canManageChannel && !showAddOverride && (
                                    <button
                                        onClick={() => setShowAddOverride(true)}
                                        className="px-3 py-1.5 bg-[#A6FF70] hover:bg-[#92f25a] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xxs flex items-center gap-1"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Override
                                    </button>
                                )}
                            </div>

                            {/* Add Override Sub-form */}
                            {showAddOverride && (
                                <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-3 shadow-neo-xs animate-in fade-in">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-black text-black uppercase">Configure Override</div>
                                        <button
                                            onClick={() => setShowAddOverride(false)}
                                            className="text-neutral-500 hover:text-black"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Target Selector */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOverrideTargetType("role");
                                                setSelectedTargetId("");
                                            }}
                                            className={`py-1.5 text-xs font-black rounded-lg border-2 border-black transition ${
                                                overrideTargetType === "role" ? "bg-[#FFE566]" : "bg-white"
                                            }`}
                                        >
                                            Role Override
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOverrideTargetType("member");
                                                setSelectedTargetId("");
                                            }}
                                            className={`py-1.5 text-xs font-black rounded-lg border-2 border-black transition ${
                                                overrideTargetType === "member" ? "bg-[#FFE566]" : "bg-white"
                                            }`}
                                        >
                                            Member Override
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-neutral-600 block mb-1">
                                            Select {overrideTargetType === "role" ? "Role" : "Member"}
                                        </label>
                                        <NeoSelect
                                            value={selectedTargetId}
                                            onChange={(val) => setSelectedTargetId(val)}
                                            options={[
                                                { value: "", label: `-- Select ${overrideTargetType} --` },
                                                ...(overrideTargetType === "role"
                                                    ? roles.map((r) => ({ value: r.id, label: r.name }))
                                                    : members.map((m) => ({
                                                          value: m.id,
                                                          label: `${m.user?.firstName} ${m.user?.lastName} (@${m.user?.username})`,
                                                      }))),
                                            ]}
                                            triggerClassName="w-full text-xs font-bold"
                                        />
                                    </div>

                                    {/* Action: Allow vs Deny */}
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs font-black text-black">Policy:</label>
                                        <button
                                            type="button"
                                            onClick={() => setOverrideType("allow")}
                                            className={`px-3 py-1 text-xs font-black rounded-lg border border-black ${
                                                overrideType === "allow" ? "bg-[#A6FF70]" : "bg-white"
                                            }`}
                                        >
                                            Allow
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOverrideType("deny")}
                                            className={`px-3 py-1 text-xs font-black rounded-lg border border-black ${
                                                overrideType === "deny" ? "bg-rose-300" : "bg-white"
                                            }`}
                                        >
                                            Deny
                                        </button>
                                    </div>

                                    {/* Permissions to configure */}
                                    <div className="space-y-1.5 pt-1">
                                        {[
                                            { id: "view_channel", label: "View Channel & History" },
                                            { id: "send_messages", label: "Send Messages & Attachments" },
                                            { id: "send_thread_messages", label: "Create & Reply in Threads" },
                                            { id: "manage_messages", label: "Moderate & Delete Messages" },
                                        ].map((perm) => (
                                            <div key={perm.id} className="flex items-center gap-2">
                                                <NeoCheckbox
                                                    checked={selectedPermissions.includes(perm.id)}
                                                    onChange={() => togglePermissionSelection(perm.id)}
                                                />
                                                <span className="text-xs font-bold text-black">{perm.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddOverride(false)}
                                            className="px-3 py-1 text-xs font-bold text-neutral-600 hover:text-black"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={savingOverride}
                                            onClick={handleAddOverride}
                                            className="px-3 py-1.5 bg-[#A6FF70] hover:bg-[#92f25a] text-black font-black text-xs border-2 border-black rounded-lg shadow-neo-xxs"
                                        >
                                            {savingOverride ? "Saving..." : "Apply Override"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Overrides List */}
                            {loadingOverrides ? (
                                <div className="p-4 text-center text-xs font-bold text-neutral-500">
                                    Loading overrides...
                                </div>
                            ) : overrides.length === 0 ? (
                                <div className="p-6 text-center bg-[#FAF6EE] border-2 border-black rounded-xl">
                                    <p className="text-xs font-bold text-neutral-600">
                                        No explicit overrides configured. Channel follows workspace & category defaults.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {overrides.map((ov) => (
                                        <div
                                            key={ov.id}
                                            className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl flex items-center justify-between gap-3 shadow-neo-xxs"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    {ov.roleId ? (
                                                        <span className="px-2 py-0.5 text-[10px] font-black bg-[#FFE566] text-black border border-black rounded-md flex items-center gap-1">
                                                            <Shield className="w-2.5 h-2.5" />
                                                            {ov.roleName || "Role"}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-[10px] font-black bg-white text-black border border-black rounded-md flex items-center gap-1">
                                                            <User className="w-2.5 h-2.5" />
                                                            {ov.memberFirstName ? `${ov.memberFirstName} ${ov.memberLastName}` : `@${ov.memberUsername}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                    {(ov.allowPermissions || []).map((p) => (
                                                        <span
                                                            key={p}
                                                            className="text-[9px] font-black px-1.5 py-0.2 bg-[#A6FF70] text-black border border-black rounded"
                                                        >
                                                            +{p}
                                                        </span>
                                                    ))}
                                                    {(ov.denyPermissions || []).map((p) => (
                                                        <span
                                                            key={p}
                                                            className="text-[9px] font-black px-1.5 py-0.2 bg-rose-200 text-rose-900 border border-black rounded"
                                                        >
                                                            -{p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {canManageChannel && (
                                                <button
                                                    onClick={() => handleDeleteOverride(ov.id)}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-300 hover:border-rose-600 rounded-lg transition"
                                                    title="Remove Override"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
