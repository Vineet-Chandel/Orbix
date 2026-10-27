// Frontend/src/app/Settings/ConnectionsSettingsView.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Users,
    Search,
    ExternalLink,
    Bell,
    UserMinus,
    ShieldAlert,
    Loader2,
    RefreshCw,
    GraduationCap,
    Send,
} from "lucide-react";
import {
    fetchUserConnectionsList,
    removeActiveConnection,
    blockTargetUser,
    sendUserDirectNotification,
    type ConnectedUserItem,
} from "../../api/relationshipApi";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";

interface ConnectionsSettingsViewProps {
    user: any;
}

export const ConnectionsSettingsView: React.FC<ConnectionsSettingsViewProps> = ({ user }) => {
    const toast = useToast();
    const [connections, setConnections] = useState<ConnectedUserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [totalCount, setTotalCount] = useState(0);
    const [, setNextCursor] = useState<string | null>(null);

    // Modal states
    const [activeTarget, setActiveTarget] = useState<ConnectedUserItem | null>(null);
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
    const [notifyTitle, setNotifyTitle] = useState("");
    const [notifyBody, setNotifyBody] = useState("");
    const [isSendingNotify, setIsSendingNotify] = useState(false);

    const loadConnections = useCallback(
        async (cursor?: string, search?: string, isRefresh = false) => {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            try {
                const data = await fetchUserConnectionsList(20, cursor, search);
                setConnections(data.connections);
                setTotalCount(data.totalCount);
                setNextCursor(data.nextCursor);
            } catch (err: any) {
                console.error("Failed to load connections:", err);
                toast.error("Failed to load connections.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [toast]
    );

    useEffect(() => {
        loadConnections(undefined, searchQuery);
    }, [loadConnections, searchQuery]);

    // Handle Remove Connection
    const handleConfirmRemove = async () => {
        if (!activeTarget) return;
        try {
            const res = await removeActiveConnection(activeTarget.connectedUserId);
            if (res.success) {
                setConnections((prev) => prev.filter((c) => c.connectedUserId !== activeTarget.connectedUserId));
                setTotalCount((c) => Math.max(0, c - 1));
                toast.success(`Removed connection with ${activeTarget.displayName}.`);
            } else {
                toast.error(res.message || "Failed to remove connection.");
            }
        } catch (err: any) {
            toast.error(err.message || "Network error removing connection.");
        } finally {
            setIsRemoveModalOpen(false);
            setActiveTarget(null);
        }
    };

    // Handle Block User
    const handleConfirmBlock = async () => {
        if (!activeTarget) return;
        try {
            const res = await blockTargetUser(activeTarget.connectedUserId);
            if (res.success) {
                setConnections((prev) => prev.filter((c) => c.connectedUserId !== activeTarget.connectedUserId));
                setTotalCount((c) => Math.max(0, c - 1));
                toast.info(`Blocked @${activeTarget.username}.`);
            } else {
                toast.error(res.message || "Failed to block user.");
            }
        } catch (err: any) {
            toast.error(err.message || "Network error blocking user.");
        } finally {
            setIsBlockModalOpen(false);
            setActiveTarget(null);
        }
    };

    // Handle Notify Peer
    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTarget || !notifyTitle.trim() || !notifyBody.trim() || isSendingNotify) return;

        setIsSendingNotify(true);
        try {
            const res = await sendUserDirectNotification(
                activeTarget.connectedUserId,
                notifyTitle.trim(),
                notifyBody.trim()
            );

            if (res.success) {
                toast.success(`Notification sent to ${activeTarget.displayName}!`);
                setIsNotifyModalOpen(false);
                setNotifyTitle("");
                setNotifyBody("");
                setActiveTarget(null);
            } else if (res.code === "NOTIFICATION_LIMIT_REACHED") {
                toast.error(
                    `Rate limit reached: Maximum 3 notifications per 24 hours to this user. Retry in ${Math.ceil(
                        (res.retryAfter || 86400) / 3600
                    )} hours.`
                );
            } else {
                toast.error(res.message || "Failed to send notification.");
            }
        } catch (err: any) {
            toast.error(err.message || "Network error sending notification.");
        } finally {
            setIsSendingNotify(false);
        }
    };

    return (
        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-black">Developer Connections</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FFE566] border border-black text-black">
                            {totalCount}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Your direct professional network of peers, campus teammates, and collaborators.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => loadConnections(undefined, searchQuery, true)}
                    disabled={refreshing}
                    className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[2.5]" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search connections by name or username..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold placeholder:text-neutral-500 focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                />
            </div>

            {/* Content List */}
            {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-black" />
                    <span className="text-xs font-bold text-neutral-600">Loading your connections...</span>
                </div>
            ) : connections.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black">
                        <Users className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                        <h4 className="text-base font-black text-black">
                            {searchQuery ? "No matching connections" : "No connections yet"}
                        </h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            {searchQuery
                                ? "Try searching for a different username or full name."
                                : "Discover and connect with developers across institutions in the Explore catalog."}
                        </p>
                    </div>
                    {!searchQuery && (
                        <Link
                            to="/explore"
                            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                        >
                            <span>Explore Catalog</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            ) : (
                <div className="divide-y-2 divide-black/10 border-2 border-black rounded-2xl overflow-hidden shadow-[2px_2px_0px_#000]">
                    {connections.map((item) => {
                        const avatar =
                            (item.photoUrl && item.photoUrl !== DEFAULT_AVATAR_URL)
                                ? item.photoUrl
                                : (item.avatarUrl || DEFAULT_AVATAR_URL);
                        return (
                            <div
                                key={item.relationshipId}
                                className="p-4 bg-white hover:bg-[#FAF6EE]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                                {/* Left: Avatar & Info */}
                                <div className="flex items-start gap-3.5 min-w-0">
                                    <img
                                        src={avatar}
                                        alt={item.displayName}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                        }}
                                        className="w-11 h-11 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                    />
                                    <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link
                                                to={`/profile/user/${item.username}`}
                                                className="text-sm font-black text-black hover:text-emerald-700 transition-colors truncate"
                                            >
                                                {item.displayName}
                                            </Link>
                                            <span className="text-xs font-mono font-bold text-neutral-500">
                                                @{item.username}
                                            </span>
                                        </div>
                                        {item.headline && (
                                            <p className="text-xs text-neutral-700 font-medium truncate max-w-md">
                                                {item.headline}
                                            </p>
                                        )}
                                        {item.college && (
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                                                <GraduationCap className="w-3 h-3 text-black shrink-0" />
                                                <span className="truncate">{item.college}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Action Buttons */}
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                                    <Link
                                        to={`/profile/user/${item.username}`}
                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6EE] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] inline-flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="View Public Profile"
                                    >
                                        <span>Profile</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </Link>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTarget(item);
                                            setNotifyTitle(`Message from @${user?.username || "peer"}`);
                                            setIsNotifyModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] inline-flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="Send Notification (Subject to 3/24h rolling limit)"
                                    >
                                        <Bell className="w-3 h-3 stroke-[2.5]" />
                                        <span>Notify</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTarget(item);
                                            setIsRemoveModalOpen(true);
                                        }}
                                        className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-rose-600 border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                        title="Remove Connection"
                                    >
                                        <UserMinus className="w-4 h-4 stroke-[2]" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTarget(item);
                                            setIsBlockModalOpen(true);
                                        }}
                                        className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-neutral-600 hover:text-rose-600 border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                        title="Block User"
                                    >
                                        <ShieldAlert className="w-4 h-4 stroke-[2]" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirm Remove Connection Modal */}
            <ConfirmationModal
                isOpen={isRemoveModalOpen}
                title={`Remove connection with ${activeTarget?.displayName}?`}
                message={`Are you sure you want to end your connection with @${activeTarget?.username}? They will be removed from your network.`}
                confirmLabel="Remove Connection"
                variant="danger"
                onConfirm={handleConfirmRemove}
                onCancel={() => {
                    setIsRemoveModalOpen(false);
                    setActiveTarget(null);
                }}
            />

            {/* Confirm Block User Modal */}
            <ConfirmationModal
                isOpen={isBlockModalOpen}
                title={`Block @${activeTarget?.username}?`}
                message={`Blocking @${activeTarget?.username} will terminate your connection, cancel pending requests, and prevent them from contacting you or seeing your profile.`}
                confirmLabel="Block User"
                variant="danger"
                onConfirm={handleConfirmBlock}
                onCancel={() => {
                    setIsBlockModalOpen(false);
                    setActiveTarget(null);
                }}
            />

            {/* Notify Modal (Subject to 3/24h Limit) */}
            {isNotifyModalOpen && activeTarget && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
                    <div className="w-full max-w-md bg-white border-2 border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]">
                                    <Bell className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-black">Notify {activeTarget.displayName}</h4>
                                    <p className="text-[11px] font-mono font-bold text-neutral-500">@{activeTarget.username}</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 border border-black text-amber-900">
                                3/24h Limit
                            </span>
                        </div>

                        <form onSubmit={handleSendNotification} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-black text-black">Subject / Title</label>
                                <input
                                    type="text"
                                    value={notifyTitle}
                                    onChange={(e) => setNotifyTitle(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-black text-black">Message Body</label>
                                <textarea
                                    value={notifyBody}
                                    onChange={(e) => setNotifyBody(e.target.value)}
                                    required
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium text-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000] resize-none"
                                    placeholder="Type your message to this connected peer..."
                                />
                            </div>

                            <p className="text-[11px] text-neutral-500 font-medium">
                                Direct notifications are rate limited to 3 deliveries per 24 hours per peer to prevent notification spam.
                            </p>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNotifyModalOpen(false);
                                        setActiveTarget(null);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSendingNotify}
                                    className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-900 text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSendingNotify ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                    <span>Send Notification</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
