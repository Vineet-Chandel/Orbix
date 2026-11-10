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
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

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

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
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
                                colorScheme="yellow"
                                size="sm"
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
                </div>
            </div>
        </div>
    );
};
