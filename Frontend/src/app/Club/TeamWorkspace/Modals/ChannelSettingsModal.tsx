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
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceDepartment,
    WorkspaceRole,
    WorkspaceMember,
    WorkspaceChannelCategory,
    WorkspaceChannel,
} from "../../../../types/workspace";

interface ChannelSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    channel: WorkspaceChannel;
    categories: WorkspaceChannelCategory[];
    departments: WorkspaceDepartment[];
    roles: WorkspaceRole[];
    members: WorkspaceMember[];
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
    canManageChannel,
    onChannelUpdated,
    onChannelDeleted,
}) => {
    const toast = useToast();
    const [name, setName] = useState(channel.name);
    const [topic, setTopic] = useState(channel.topic || "");
    const [categoryId, setCategoryId] = useState<string | null>(channel.categoryId || null);
    const [departmentId, setDepartmentId] = useState<string | null>(channel.departmentId || null);
    const [isPrivate, setIsPrivate] = useState(channel.isPrivate);
    const [isCategorySynced, setIsCategorySynced] = useState(channel.isCategorySynced);

    // Category move prompt state
    const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
    const [showCategoryMoveConfirm, setShowCategoryMoveConfirm] = useState(false);

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
            fetchDetails();
        }
    }, [isOpen, channel.id]);

    const fetchDetails = async () => {
        try {
            const res = await workspaceApi.getChannelDetails(channel.id, clubId);
            if (res.success && res.channel) {
                setIsCategorySynced(res.channel.isCategorySynced);
            }
        } catch (err) {
            console.error("Failed to load channel details:", err);
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
            toast.error(err.message || "Failed to update category.");
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
            toast.error(err.message || "Failed to sync permissions.");
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
                },
                clubId
            );

            if (res.success && res.channel) {
                toast.success("Channel settings updated.");
                onChannelUpdated(res.channel);
                onClose();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to save channel settings.");
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
            toast.error(err.message || "Failed to delete channel.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Hash className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">
                                Channel Settings: #{channel.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs uppercase font-semibold text-slate-400">
                                    {channel.channelType}
                                </span>
                                <span className="text-slate-600">•</span>
                                {isCategorySynced ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        <Check className="w-3 h-3" /> Synced with Category
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        <AlertCircle className="w-3 h-3" /> Custom Overrides (Unsynced)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/60 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Category Move Confirmation Modal/Prompt */}
                    {showCategoryMoveConfirm && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-sm font-semibold text-amber-200">
                                        Sync Permissions with New Parent Category?
                                    </div>
                                    <div className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                                        Do you want this channel to inherit the permission overrides of its new parent category, or keep its existing overrides?
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => confirmCategoryMove(false)}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition"
                                >
                                    Keep Existing (Unsynced)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmCategoryMove(true)}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
                                >
                                    <RefreshCw className="w-3 h-3" /> Sync Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* General Settings Form */}
                    <form onSubmit={handleSaveGeneral} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                Channel Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={!canManageChannel}
                                required
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 font-medium focus:outline-none focus:border-indigo-500/50 text-sm transition"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                Topic / Description
                            </label>
                            <textarea
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                disabled={!canManageChannel}
                                rows={2}
                                placeholder="Describe the purpose of this channel..."
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500/50 text-sm transition resize-none"
                            />
                        </div>

                        {/* Category & Department */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Parent Category
                                </label>
                                <select
                                    value={categoryId || ""}
                                    onChange={(e) => handleCategoryChange(e.target.value ? e.target.value : null)}
                                    disabled={!canManageChannel}
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
                                    disabled={!canManageChannel}
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

                        {/* Permission Sync Panel (Discord Style) */}
                        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <div className="text-sm font-semibold text-slate-200">
                                            Category Permission Synchronization
                                        </div>
                                        <div className="text-xs text-slate-400">
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
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
                                        Sync Now / Revert
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Private Channel Setting */}
                        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Lock className="w-4 h-4 text-amber-400" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-200">Private Channel</div>
                                    <div className="text-xs text-slate-400">
                                        Restrict visibility to members with explicit roles or grants
                                    </div>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={isPrivate}
                                onChange={(e) => setIsPrivate(e.target.checked)}
                                disabled={!canManageChannel}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-700 bg-slate-900 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Save Button */}
                        {canManageChannel && (
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition"
                                >
                                    {submitting ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        )}
                    </form>

                    {/* Danger Zone: Delete Channel */}
                    {canManageChannel && (
                        <div className="pt-6 border-t border-slate-800/80">
                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-rose-300">Delete Channel</div>
                                    <div className="text-xs text-rose-400/80">
                                        Permanently delete this channel, its messages, attachments and threads
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDeleteChannel}
                                    disabled={deleting}
                                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {deleting ? "Deleting..." : "Delete Channel"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
