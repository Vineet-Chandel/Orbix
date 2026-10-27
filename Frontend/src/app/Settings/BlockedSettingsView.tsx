// Frontend/src/app/Settings/BlockedSettingsView.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Search,
    RefreshCw,
    Loader2,
    Calendar,
    Unlock,
    UserX,
} from "lucide-react";
import {
    fetchBlockedUsersList,
    unblockTargetUser,
    type BlockedUserItem,
} from "../../api/relationshipApi";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";

function formatBlockedDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

export const BlockedSettingsView: React.FC = () => {
    const toast = useToast();
    const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [totalCount, setTotalCount] = useState(0);

    const [activeTarget, setActiveTarget] = useState<BlockedUserItem | null>(null);
    const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    const loadBlocked = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const data = await fetchBlockedUsersList(50);
            setBlockedUsers(data.blockedUsers);
            setTotalCount(data.totalCount);
        } catch (err: any) {
            console.error("Failed to load blocked users:", err);
            toast.error("Failed to load blocked accounts.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        loadBlocked();
    }, [loadBlocked]);

    const handleConfirmUnblock = async () => {
        if (!activeTarget) return;
        setUnblockingId(activeTarget.blockedId);
        try {
            const res = await unblockTargetUser(activeTarget.blockedId);
            if (res.success) {
                setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== activeTarget.blockedId));
                setTotalCount((c) => Math.max(0, c - 1));
                toast.success(`Unblocked @${activeTarget.username}.`);
            } else {
                toast.error(res.message || "Failed to unblock user.");
            }
        } catch (err: any) {
            toast.error(err.message || "Network error unblocking user.");
        } finally {
            setIsUnblockModalOpen(false);
            setUnblockingId(null);
            setActiveTarget(null);
        }
    };

    const filteredUsers = searchQuery.trim()
        ? blockedUsers.filter(
              (u) =>
                  u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : blockedUsers;

    return (
        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-black">Blocked Accounts</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-200 border border-black text-rose-900">
                            {totalCount}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Blocked accounts cannot view your full showcase, send requests, or message you.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => loadBlocked(true)}
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
                    placeholder="Search blocked accounts..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold placeholder:text-neutral-500 focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                />
            </div>

            {/* List Content */}
            {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-black" />
                    <span className="text-xs font-bold text-neutral-600">Loading blocked accounts...</span>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-rose-700">
                        <UserX className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                        <h4 className="text-base font-black text-black">
                            {searchQuery ? "No matching accounts found" : "No blocked accounts"}
                        </h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            {searchQuery
                                ? "No blocked users matched your search query."
                                : "Your blocked list is currently empty. You haven't blocked any accounts."}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="divide-y-2 divide-black/10 border-2 border-black rounded-2xl overflow-hidden shadow-[2px_2px_0px_#000]">
                    {filteredUsers.map((item) => {
                        const avatar =
                            (item.photoUrl && item.photoUrl !== DEFAULT_AVATAR_URL)
                                ? item.photoUrl
                                : (item.avatarUrl || DEFAULT_AVATAR_URL);
                        return (
                            <div
                                key={item.id}
                                className="p-4 bg-white hover:bg-[#FAF6EE]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-3.5 min-w-0">
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
                                            <span className="text-sm font-black text-black truncate">
                                                {item.displayName}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-neutral-500">
                                                @{item.username}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-neutral-500">
                                            <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                                            <span>Blocked on {formatBlockedDate(item.blockedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTarget(item);
                                        setIsUnblockModalOpen(true);
                                    }}
                                    disabled={unblockingId === item.blockedId}
                                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-neutral-800 hover:text-rose-700 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 self-end sm:self-auto"
                                    title="Unblock account"
                                >
                                    {unblockingId === item.blockedId ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Unlock className="w-3.5 h-3.5 stroke-[2.5]" />
                                    )}
                                    <span>Unblock</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirm Unblock Modal */}
            <ConfirmationModal
                isOpen={isUnblockModalOpen}
                title={`Unblock @${activeTarget?.username}?`}
                message={`Unblocking @${activeTarget?.username} allows them to view your public profile again. It does NOT automatically restore any previous connection or request.`}
                confirmLabel="Unblock Account"
                variant="neutral"
                onConfirm={handleConfirmUnblock}
                onCancel={() => {
                    setIsUnblockModalOpen(false);
                    setActiveTarget(null);
                }}
            />
        </div>
    );
};
