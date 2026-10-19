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
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all cursor-pointer focus:outline-hidden ${
                    isDark
                        ? "text-neutral-300 hover:text-white hover:bg-white/[0.08] active:scale-95"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 active:scale-95"
                } ${isOpen ? (isDark ? "bg-white/[0.12] text-white" : "bg-neutral-100 text-neutral-900") : ""}`}
            >
                <Bell className="w-5 h-5 transition-transform group-hover:rotate-6" />

                {/* Automatic Unread Counter Badge */}
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black leading-none text-white bg-gradient-to-r from-rose-500 to-red-600 rounded-full shadow-md ring-2 ring-[#0c0d0e] animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Dropdown Flyout */}
            {isOpen && (
                <div
                    className={`absolute right-0 mt-2.5 w-[360px] sm:w-[410px] max-w-[94vw] rounded-2xl shadow-2xl border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                        isDark
                            ? "bg-[#0B0F17]/95 backdrop-blur-xl border-neutral-800 text-neutral-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
                            : "bg-white/95 backdrop-blur-xl border-neutral-200 text-neutral-900 shadow-[0_20px_40px_rgba(0,0,0,0.12)]"
                    }`}
                >
                    {/* Minimalist Header */}
                    <div
                        className={`flex items-center justify-between px-4 py-3 border-b ${
                            isDark ? "border-neutral-800/80 bg-neutral-900/50" : "border-neutral-100 bg-neutral-50/70"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                                Notifications
                            </span>
                            {notifications.length > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                    isDark ? "bg-neutral-800 text-neutral-300" : "bg-neutral-200 text-neutral-700"
                                }`}>
                                    {notifications.length}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handleViewAll}
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                    isDark
                                        ? "text-blue-400 hover:text-white hover:bg-neutral-800"
                                        : "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                }`}
                            >
                                <span>Open Inbox</span>
                                <ArrowUpRight className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                    isDark
                                        ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                                        : "text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200"
                                }`}
                                aria-label="Close"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Notification Items List */}
                    <div className={`max-h-[380px] overflow-y-auto divide-y ${isDark ? "divide-neutral-800/40" : "divide-neutral-100"}`}>
                        {loading && notifications.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                                <span className={`text-xs ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                                    Checking updates...
                                </span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-12 px-6 text-center flex flex-col items-center justify-center">
                                <div
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2.5 ${
                                        isDark ? "bg-neutral-900 text-neutral-500" : "bg-neutral-100 text-neutral-400"
                                    }`}
                                >
                                    <Inbox className="w-5 h-5" />
                                </div>
                                <p className={`text-xs font-bold ${isDark ? "text-neutral-200" : "text-neutral-800"}`}>
                                    Inbox Zero
                                </p>
                                <p className={`text-[11px] mt-0.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
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
                                            isDark ? "hover:bg-neutral-900/70" : "hover:bg-neutral-50"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2.5">
                                            {/* Left: Sender & Company */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-xs font-bold truncate ${
                                                        isDark ? "text-neutral-100" : "text-neutral-900"
                                                    }`}>
                                                        {senderName}
                                                    </span>
                                                    {company && (
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md truncate max-w-[140px] ${
                                                            isDark
                                                                ? "bg-neutral-800 text-neutral-300"
                                                                : "bg-neutral-100 text-neutral-700 border border-neutral-200/60"
                                                        }`}>
                                                            {company}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className={`text-[11px] line-clamp-2 mt-1 leading-relaxed ${
                                                    isDark ? "text-neutral-400" : "text-neutral-600"
                                                }`}>
                                                    {snippet}
                                                </p>
                                            </div>

                                            {/* Right: Timestamp & Actions */}
                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                <span className={`text-[10px] font-mono ${
                                                    isDark ? "text-neutral-500" : "text-neutral-400"
                                                }`}>
                                                    {formatRelativeTime(item.createdAt)}
                                                </span>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {commEmail && (
                                                        <a
                                                            href={mailtoUrl}
                                                            onClick={(e) => e.stopPropagation()}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`p-1 rounded-md transition-colors ${
                                                                isDark
                                                                    ? "text-blue-400 hover:text-blue-300 hover:bg-blue-950/40"
                                                                    : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            }`}
                                                            title="Reply via email"
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(e, item.id)}
                                                        disabled={isDeleting}
                                                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                                                            isDark
                                                                ? "text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40"
                                                                : "text-neutral-400 hover:text-rose-600 hover:bg-rose-50"
                                                        }`}
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

                    {/* Minimalist Footer Link to Dedicated Page */}
                    {notifications.length > 0 && (
                        <div
                            className={`px-4 py-2.5 border-t text-center ${
                                isDark ? "border-neutral-800/80 bg-neutral-900/40" : "border-neutral-100 bg-neutral-50/70"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={handleViewAll}
                                className={`text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                    isDark ? "text-neutral-300 hover:text-white" : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                <span>View all in dedicated Inbox</span>
                                <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
