import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Mail,
    Search,
    Trash2,
    Check,
    Copy,
    RefreshCw,
    Inbox,
    Loader2,
    ArrowUpRight,
} from "lucide-react";
import { useAppSelector } from "../../store";
import {
    fetchNotifications,
    deleteNotification,
    type UserNotification,
} from "../../utils/profileApi";

function formatRelativeTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return "Just now";
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
        return "";
    }
}

function formatFullDateTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    } catch {
        return dateString;
    }
}

export const NotificationsView: React.FC = () => {
    const { user } = useAppSelector((state) => state.user);
    const [searchParams, setSearchParams] = useSearchParams();
    const queryId = searchParams.get("id");

    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "inquiries" | "unread">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Load notifications with automatic read marking
    const loadNotifications = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            try {
                // Fetch with autoMarkRead=true so unread count clears automatically on arrival
                const res = await fetchNotifications(true);
                setNotifications(res.notifications);

                // Broadcast update so navbar and sidebar unread counts update
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("orbix_notifications_updated"));
                }

                // If queryId is provided, select it; otherwise select first item if none selected
                if (queryId && res.notifications.some((n) => n.id === queryId)) {
                    setSelectedId(queryId);
                } else if (!selectedId && res.notifications.length > 0) {
                    setSelectedId(res.notifications[0].id);
                }
            } catch (err) {
                console.error("Failed to load notifications:", err);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [queryId, selectedId]
    );

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Update selectedId if queryId changes
    useEffect(() => {
        if (queryId) {
            setSelectedId(queryId);
        }
    }, [queryId]);

    // Handle selecting a notification
    const handleSelect = (notif: UserNotification) => {
        setSelectedId(notif.id);
        setSearchParams({ id: notif.id }, { replace: true });
    };

    // Handle delete
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            const success = await deleteNotification(id);
            if (success) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
                if (selectedId === id) {
                    const remaining = notifications.filter((n) => n.id !== id);
                    setSelectedId(remaining[0]?.id || null);
                }
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("orbix_notifications_updated"));
                }
            }
        } catch (err) {
            console.error("Failed to delete notification:", err);
        } finally {
            setDeletingId(null);
        }
    };

    // Handle copy email
    const handleCopy = (text: string, fieldKey: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldKey);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Filter and search logic
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            if (filter === "inquiries" && item.type !== "hire_inquiry") return false;
            if (filter === "unread" && item.isRead) return false;

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase();
            const senderName = (item.metadata?.senderName || "").toLowerCase();
            const company = (item.metadata?.company || "").toLowerCase();
            const body = (item.metadata?.fullMessage || item.body || "").toLowerCase();
            const commEmail = (item.metadata?.communicationEmail || "").toLowerCase();

            return (
                senderName.includes(q) ||
                company.includes(q) ||
                body.includes(q) ||
                commEmail.includes(q)
            );
        });
    }, [notifications, filter, searchQuery]);

    const activeItem = useMemo(() => {
        return notifications.find((n) => n.id === selectedId) || filteredNotifications[0] || null;
    }, [notifications, selectedId, filteredNotifications]);

    const totalCount = notifications.length;
    const inquiryCount = notifications.filter((n) => n.type === "hire_inquiry").length;

    return (
        <div className="flex-1 flex flex-col min-w-0 space-y-5 select-none">
            {/* Top Workspace Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight flex items-center gap-3">
                        <span>Inbox</span>
                        <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-md bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                            {totalCount}
                        </span>
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium mt-1">
                        Direct inquiries from recruiters and platform updates
                    </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => loadNotifications(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] active:translate-x-0.5 active:translate-y-0.5 text-xs font-black text-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh inbox"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${refreshing ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Main Split-Pane Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start min-h-[600px]">
                {/* Left Column: Messages List (lg:col-span-5) */}
                <div className="lg:col-span-5 flex flex-col rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden min-h-[580px]">
                    {/* Search & Filter Header */}
                    <div className="p-4 border-b-2 border-black bg-[#FAF6EE] space-y-3">
                        {/* Search input */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 stroke-[2.5]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search sender, company, message..."
                                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white text-xs border-2 border-black focus:outline-none placeholder-neutral-400 font-bold text-black shadow-[2px_2px_0px_#000]"
                            />
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFilter("all")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    filter === "all"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                All ({totalCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilter("inquiries")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    filter === "inquiries"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                Recruiter ({inquiryCount})
                            </button>
                        </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="flex-1 overflow-y-auto divide-y-2 divide-black/10 max-h-[660px]">
                        {loading && notifications.length === 0 ? (
                            <div className="p-12 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-black" />
                                <span className="text-xs font-bold text-neutral-600">Loading inbox...</span>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black mb-3">
                                    <Inbox className="w-6 h-6 stroke-[2.5]" />
                                </div>
                                <h4 className="text-sm font-black text-black">No messages</h4>
                                <p className="text-xs font-bold text-neutral-600 mt-1 max-w-[220px]">
                                    {searchQuery ? "No matching inquiries found." : "Inquiries from recruiters will appear here."}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map((item) => {
                                const isSelected = activeItem?.id === item.id;
                                const meta = item.metadata || {};
                                const senderName = meta.senderName || item.title || "Inquiry";
                                const company = meta.company || "";
                                const snippet = meta.fullMessage || item.body || "";

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelect(item)}
                                        className={`group relative p-4 text-left transition-all cursor-pointer border-l-4 ${
                                            isSelected
                                                ? "bg-[#FAF6EE] border-l-black"
                                                : "hover:bg-[#FAF6EE]/50 border-l-transparent"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            {/* Sender & Company */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-black truncate">
                                                        {senderName}
                                                    </span>
                                                    {company && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] truncate max-w-[140px]">
                                                            {company}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-neutral-700 font-medium line-clamp-2 mt-1.5 leading-relaxed">
                                                    {snippet}
                                                </p>
                                            </div>

                                            {/* Timestamp & delete icon on hover */}
                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                <span className="text-[10px] text-neutral-500 font-mono font-bold">
                                                    {formatRelativeTime(item.createdAt)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, item.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-black hover:text-rose-600 bg-white hover:bg-rose-50 rounded-lg border border-black shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
                                                    title="Delete message"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Column: Message Detail Pane (lg:col-span-7) */}
                <div className="lg:col-span-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex flex-col min-h-[580px]">
                    {activeItem ? (
                        (() => {
                            const meta = activeItem.metadata || {};
                            const senderName = meta.senderName || "Recruiter";
                            const company = meta.company || "Company";
                            const commEmail = meta.communicationEmail || meta.senderEmail || "";
                            const workEmail = meta.senderEmail || "";
                            const fullMsg = meta.fullMessage || activeItem.body || "";

                            const mailSubject = encodeURIComponent(
                                `Re: Opportunity at ${company} for ${user?.firstName || user?.username || "Developer"}`
                            );
                            const mailBody = encodeURIComponent(
                                `Hi ${senderName},\n\nThank you for reaching out regarding the opportunity at ${company}.\n\n`
                            );
                            const mailtoUrl = commEmail
                                ? `mailto:${commEmail}?subject=${mailSubject}&body=${mailBody}`
                                : "#";

                            return (
                                <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5">
                                    {/* Detail Top Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-11 h-11 rounded-xl bg-[#FFE566] text-black font-black flex items-center justify-center text-base border-2 border-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                                                {senderName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                                        {senderName}
                                                    </h3>
                                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                                                        {company}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-500 font-mono font-bold mt-1">
                                                    Received {formatFullDateTime(activeItem.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 self-start sm:self-auto">
                                            {commEmail && (
                                                <a
                                                    href={mailtoUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                    <span>Reply</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </a>
                                            )}

                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(e, activeItem.id)}
                                                disabled={deletingId === activeItem.id}
                                                className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                title="Delete message"
                                            >
                                                {deletingId === activeItem.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4 stroke-[2]" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Contact Information Chips */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {commEmail && (
                                            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <div className="min-w-0 pr-2">
                                                    <span className="block text-[10px] font-black text-neutral-600 uppercase tracking-wider">
                                                        Communication Email
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-black truncate block mt-0.5">
                                                        {commEmail}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(commEmail, "comm")}
                                                    className="p-1.5 rounded-lg text-black bg-white hover:bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000] transition-colors cursor-pointer flex-shrink-0"
                                                    title="Copy communication email"
                                                >
                                                    {copiedField === "comm" ? (
                                                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        {workEmail && workEmail !== commEmail && (
                                            <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <div className="min-w-0 pr-2">
                                                    <span className="block text-[10px] font-black text-neutral-600 uppercase tracking-wider">
                                                        Work Email
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-black truncate block mt-0.5">
                                                        {workEmail}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(workEmail, "work")}
                                                    className="p-1.5 rounded-lg text-black bg-white hover:bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000] transition-colors cursor-pointer flex-shrink-0"
                                                    title="Copy work email"
                                                >
                                                    {copiedField === "work" ? (
                                                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Message Body Content */}
                                    <div className="flex-1 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] p-5 text-black leading-relaxed space-y-3">
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium text-black select-text">
                                            {fullMsg}
                                        </p>
                                    </div>

                                    {/* Direct Reply Bar */}
                                    {commEmail && (
                                        <div className="pt-2 flex items-center gap-2 text-xs font-bold text-neutral-600">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black" />
                                            <span>Direct reply enabled to <span className="font-mono text-black font-black">{commEmail}</span></span>
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    ) : (
                        <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black mb-3">
                                <Inbox className="w-7 h-7 stroke-[2.5]" />
                            </div>
                            <h3 className="text-sm font-black text-black">Select a message</h3>
                            <p className="text-xs font-bold text-neutral-600 mt-1 max-w-[240px]">
                                Choose an inquiry from the left panel to review recruiter details and reply.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsView;
