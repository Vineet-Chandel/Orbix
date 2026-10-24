import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Mail, Trash2, X, Inbox, Loader2, ArrowUpRight } from "lucide-react";
import { useAppSelector } from "../store";
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    deleteNotification,
    type UserNotification,
} from "../utils/profileApi";

interface NotificationBellProps {
    variant?: "dark" | "light";
    className?: string;
}

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

export const NotificationBell: React.FC<NotificationBellProps> = ({
    variant = "dark",
    className = "",
}) => {
    const navigate = useNavigate();
    const { user } = useAppSelector((state) => state.user);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    // 1. Automatic unread count polling
    const updateUnreadCount = useCallback(async () => {
        if (!user) return;
        try {
            const count = await fetchUnreadNotificationCount();
            setUnreadCount(count);
        } catch {
            // Silently swallow background polling errors
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        updateUnreadCount();

        const interval = setInterval(updateUnreadCount, 25000);
        const onFocus = () => updateUnreadCount();
        const onCustomSync = () => updateUnreadCount();

        window.addEventListener("focus", onFocus);
        window.addEventListener("orbix_notifications_updated", onCustomSync);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("orbix_notifications_updated", onCustomSync);
        };
    }, [user, updateUnreadCount]);

    // 2. When dropdown opens, automatically fetch notifications and mark as read
    const handleOpenDropdown = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);

        if (nextState && user) {
            setUnreadCount(0);
            setLoading(true);

            try {
                const res = await fetchNotifications(true);
                setNotifications(res.notifications);
                setUnreadCount(res.unreadCount);
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("orbix_notifications_updated"));
                }
            } catch (err) {
                console.error("Failed to load notifications:", err);
            } finally {
                setLoading(false);
            }
        }
    };

    // Close when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // Handle delete notification
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            const success = await deleteNotification(id);
            if (success) {
                setNotifications((prev) => prev.filter((n) => n.id !== id));
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

    const handleViewAll = () => {
        setIsOpen(false);
        navigate("/notifications");
    };

    const handleOpenItem = (id: string) => {
        setIsOpen(false);
        navigate(`/notifications?id=${encodeURIComponent(id)}`);
    };

    if (!user) {
        return null;
    }

    const isDark = variant === "dark";

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            {/* Bell Trigger Button */}
            <button
                type="button"
                onClick={handleOpenDropdown}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
                title="Notifications"
                className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none ${
                    isDark
                        ? "text-neutral-300 hover:text-white hover:bg-white/[0.08] active:translate-x-0.5 active:translate-y-0.5"
                        : "text-black hover:bg-[#FAF6EE] active:translate-x-0.5 active:translate-y-0.5"
                } ${isOpen ? (isDark ? "bg-white/[0.12] text-white" : "bg-[#FAF6EE] text-black") : ""}`}
            >
                <Bell className="w-4.5 h-4.5 transition-transform group-hover:rotate-6" />

                {/* Automatic Unread Counter Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black leading-none text-black bg-[#FFE566] rounded-full border-2 border-black shadow-[1px_1px_0px_#000]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Dropdown Flyout */}
            {isOpen && (
                <div
                    className={`absolute right-0 mt-3 w-[360px] sm:w-[420px] max-w-[94vw] rounded-2xl border-2 border-black z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none ${
                        isDark
                            ? "bg-[#0B0F17] text-neutral-100 shadow-[6px_6px_0px_#000]"
                            : "bg-white text-black shadow-[6px_6px_0px_#000]"
                    }`}
                >
                    {/* Header */}
                    <div
                        className={`flex items-center justify-between px-4 py-3 border-b-2 border-black ${
                            isDark ? "bg-neutral-900" : "bg-[#FAF6EE]"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-black tracking-tight">
                                Notifications
                            </span>
                            {notifications.length > 0 && (
                                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                                    {notifications.length}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleViewAll}
                                className="text-[11px] font-black px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 bg-[#FFE566] text-black hover:bg-[#FFE566]/90"
                            >
                                <span>Open Inbox</span>
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className={`p-1 rounded-lg transition-all cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 ${
                                    isDark
                                        ? "bg-neutral-800 text-neutral-200 hover:text-white"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                                aria-label="Close"
                            >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </div>
                    </div>

                    {/* Notification Items List */}
                    <div className={`max-h-[380px] overflow-y-auto divide-y-2 ${isDark ? "divide-neutral-800" : "divide-black/10"}`}>
                        {loading && notifications.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-black" />
                                <span className={`text-xs font-bold ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                                    Checking updates...
                                </span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 px-6 text-center flex flex-col items-center justify-center">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 border-2 border-black shadow-[3px_3px_0px_#000] bg-[#FFE566] text-black">
                                    <Inbox className="w-6 h-6 stroke-[2.5]" />
                                </div>
                                <p className={`text-sm font-black tracking-tight ${isDark ? "text-neutral-100" : "text-black"}`}>
                                    Inbox Zero
                                </p>
                                <p className={`text-xs font-bold mt-1 ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                                    Recruiter messages will appear here.
                                </p>
                            </div>
                        ) : (
                            notifications.map((item) => {
                                const meta = item.metadata || {};
                                const senderName = meta.senderName || item.title || "Inquiry";
                                const company = meta.company || "";
                                const commEmail = meta.communicationEmail || meta.senderEmail || "";
                                const snippet = meta.fullMessage || item.body || "";
                                const isDeleting = deletingId === item.id;

                                const mailSubject = encodeURIComponent(`Re: Opportunity at ${company} for ${user.firstName || user.username}`);
                                const mailBody = encodeURIComponent(`Hi ${senderName},\n\nThank you for reaching out regarding the opportunity at ${company}.\n\n`);
                                const mailtoUrl = commEmail ? `mailto:${commEmail}?subject=${mailSubject}&body=${mailBody}` : "#";

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleOpenItem(item.id)}
                                        className={`group p-3.5 transition-colors text-left cursor-pointer ${
                                            isDark ? "hover:bg-neutral-900" : "hover:bg-[#FAF6EE]"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            {/* Left: Sender & Company */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-xs font-black truncate ${
                                                        isDark ? "text-neutral-100" : "text-black"
                                                    }`}>
                                                        {senderName}
                                                    </span>
                                                    {company && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_#000] truncate max-w-[140px] bg-[#FFE566] text-black">
                                                            {company}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className={`text-xs font-medium line-clamp-2 mt-1 leading-relaxed ${
                                                    isDark ? "text-neutral-300" : "text-neutral-700"
                                                }`}>
                                                    {snippet}
                                                </p>
                                            </div>

                                            {/* Right: Timestamp & Actions */}
                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                <span className={`text-[10px] font-mono font-bold ${
                                                    isDark ? "text-neutral-400" : "text-neutral-500"
                                                }`}>
                                                    {formatRelativeTime(item.createdAt)}
                                                </span>

                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {commEmail && (
                                                        <a
                                                            href={mailtoUrl}
                                                            onClick={(e) => e.stopPropagation()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 rounded-lg bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all"
                                                            title="Reply via email"
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(e, item.id)}
                                                        disabled={isDeleting}
                                                        className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-black hover:text-rose-600 border border-black shadow-[1px_1px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        {isDeleting ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer Link to Dedicated Page */}
                    {notifications.length > 0 && (
                        <div
                            className={`p-3 border-t-2 border-black text-center ${
                                isDark ? "bg-neutral-900" : "bg-[#FAF6EE]"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={handleViewAll}
                                className="w-full py-2 px-4 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <span>View all in dedicated Inbox</span>
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
