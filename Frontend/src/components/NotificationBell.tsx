import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    Bell,
    Mail,
    Trash2,
    X,
    Inbox,
    ArrowUpRight,
    ShieldCheck,
    Award,
    Calendar,
    CheckCircle2,
    Ticket,
    Laptop,
} from "lucide-react";
import { OrbixLoader } from "./ui/loader";
import { useAppSelector } from "../store";
import {
    fetchNotifications,
    fetchUnreadNotificationCount,
    deleteNotification,
    type UserNotification,
} from "../utils/profileApi";

interface NotificationBellProps {
    variant?: "dark" | "light" | "neo";
    className?: string;
}

function cleanEmojiText(text: string): string {
    if (!text) return "";
    return text
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1FA70}-\u{1FAFF}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function getNotificationIcon(title: string, body?: string) {
    const lower = `${title} ${body || ""}`.toLowerCase();
    if (lower.includes("login") || lower.includes("device") || lower.includes("macbook") || lower.includes("windows") || lower.includes("session")) {
        return {
            Icon: Laptop,
            bg: "bg-sky-100 text-sky-900",
        };
    }
    if (lower.includes("security") || lower.includes("password") || lower.includes("alert")) {
        return {
            Icon: ShieldCheck,
            bg: "bg-amber-100 text-amber-900",
        };
    }
    if (lower.includes("certificate") || lower.includes("award") || lower.includes("credential")) {
        return {
            Icon: Award,
            bg: "bg-[#FFE566] text-black",
        };
    }
    if (lower.includes("application") || lower.includes("accepted") || lower.includes("approved")) {
        return {
            Icon: CheckCircle2,
            bg: "bg-[#a2ff86] text-black",
        };
    }
    if (lower.includes("ticket") || lower.includes("pass") || lower.includes("check in") || lower.includes("checked in")) {
        return {
            Icon: Ticket,
            bg: "bg-[#a2ff86] text-black",
        };
    }
    if (lower.includes("event") || lower.includes("workshop") || lower.includes("campus") || lower.includes("session")) {
        return {
            Icon: Calendar,
            bg: "bg-[#a2ff86] text-black",
        };
    }
    if (lower.includes("recruiter") || lower.includes("inquiry") || lower.includes("message") || lower.includes("mail")) {
        return {
            Icon: Mail,
            bg: "bg-purple-100 text-purple-900",
        };
    }
    return {
        Icon: Bell,
        bg: "bg-[#FAF6EE] text-black",
    };
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
    const [dropdownStyle, setDropdownStyle] = useState<{
        top: number;
        left: number;
        width: number;
        maxHeight: number;
    } | null>(null);

    const updateDropdownPosition = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Bounded width with safety margins
        const width = Math.min(420, Math.max(300, vw - 24));

        // Horizontal position:
        // Anchor relative to button, flipping cleanly based on screen half
        let left: number;
        if (rect.left > vw / 2) {
            left = rect.right - width;
        } else {
            left = rect.left;
        }

        // Clamp strictly within viewport boundaries [12px, vw - width - 12px]
        left = Math.max(12, Math.min(vw - width - 12, left));

        // Vertical position:
        let top = rect.bottom + 8;
        let maxHeight = vh - top - 16;

        // If space below is constrained (< 220px) and there is ample room above, flip above the button
        if (maxHeight < 220 && rect.top > 250) {
            maxHeight = Math.min(480, rect.top - 24);
            top = rect.top - maxHeight - 8;
        } else {
            maxHeight = Math.min(480, Math.max(180, maxHeight));
        }

        setDropdownStyle({
            top,
            left,
            width,
            maxHeight,
        });
    }, []);

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

    // 2. When dropdown opens, calculate position and load notifications
    const handleOpenDropdown = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);

        if (nextState && user) {
            updateDropdownPosition();
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

    // Recompute dropdown position on resize or scroll
    useEffect(() => {
        if (!isOpen) return;
        updateDropdownPosition();

        const handleResizeOrScroll = () => {
            updateDropdownPosition();
        };

        window.addEventListener("resize", handleResizeOrScroll);
        window.addEventListener("scroll", handleResizeOrScroll, true);

        return () => {
            window.removeEventListener("resize", handleResizeOrScroll);
            window.removeEventListener("scroll", handleResizeOrScroll, true);
        };
    }, [isOpen, updateDropdownPosition]);

    // Close when clicking outside or pressing Escape
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
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
    const isNeo = variant === "neo";

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            {/* Bell Trigger Button */}
            <button
                type="button"
                onClick={handleOpenDropdown}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
                title="Notifications"
                className={`relative flex items-center justify-center transition-all cursor-pointer group outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 select-none ${
                    isNeo
                        ? `w-10 h-10 rounded-xl bg-white hover:bg-[#FFE566]/20 text-black border-2 border-black ${
                              isOpen
                                  ? "bg-[#FFE566] shadow-[1px_1px_0px_#000] translate-x-[1px] translate-y-[1px]"
                                  : "shadow-[2.5px_2.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                          }`
                        : isDark
                        ? `w-9 h-9 rounded-xl text-neutral-300 hover:text-white hover:bg-white/[0.08] active:translate-x-0.5 active:translate-y-0.5 ${
                              isOpen ? "bg-white/[0.12] text-white" : ""
                          }`
                        : `w-9 h-9 rounded-xl text-black hover:bg-[#FAF6EE] active:translate-x-0.5 active:translate-y-0.5 ${
                              isOpen ? "bg-[#FAF6EE] text-black" : ""
                          }`
                }`}
            >
                <Bell
                    className={`${
                        isNeo ? "w-5 h-5 stroke-[2.2]" : "w-4.5 h-4.5 stroke-[2]"
                    } transition-transform duration-200 group-hover:rotate-6 text-current`}
                />

                {/* Automatic Unread Counter Badge — Half Outer / Half Inner floating badge */}
                {unreadCount > 0 && (
                    <span
                        className={`absolute ${
                            isNeo ? "-top-2 -right-2" : "-top-1.5 -right-1.5"
                        } z-10 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-black leading-none text-black bg-[#FFE566] rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] pointer-events-none select-none`}
                    >
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Dropdown Portal — Intelligent Viewport-Clamped Flyout */}
            {isOpen && dropdownStyle && typeof document !== "undefined" && createPortal(
                <>
                    {/* Outside Click Catcher Backdrop */}
                    <div
                        className="fixed inset-0 z-[99990] bg-black/15 backdrop-blur-[1px]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Notification Dropdown Container */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Notifications"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            top: `${dropdownStyle.top}px`,
                            left: `${dropdownStyle.left}px`,
                            width: `${dropdownStyle.width}px`,
                            maxHeight: `${dropdownStyle.maxHeight}px`,
                        }}
                        className={`fixed z-[99995] flex flex-col rounded-2xl border-2 border-black overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none ${
                            isDark
                                ? "bg-[#0B0F17] text-neutral-100 shadow-[6px_6px_0px_#000]"
                                : "bg-white text-black shadow-[6px_6px_0px_#000]"
                        }`}
                    >
                        {/* Header */}
                        <div
                            className={`shrink-0 flex items-center justify-between gap-2 flex-wrap px-3.5 sm:px-4 py-3 border-b-2 border-black ${
                                isDark ? "bg-neutral-900" : "bg-[#FAF6EE]"
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-black tracking-tight whitespace-nowrap">
                                    Notifications
                                </span>
                                {notifications.length > 0 && (
                                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                        {notifications.length}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                                <button
                                    type="button"
                                    onClick={handleViewAll}
                                    className="text-[11px] font-black px-2.5 sm:px-3 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1 border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 bg-[#FFE566] text-black hover:bg-[#FFE566]/90 whitespace-nowrap shrink-0"
                                >
                                    <span>Open Inbox</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className={`p-1 rounded-lg transition-all cursor-pointer border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 shrink-0 ${
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
                        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain divide-y-2 ${isDark ? "divide-neutral-800" : "divide-black/10"}`}>
                            {loading && notifications.length === 0 ? (
                                <div className="py-8 flex flex-col items-center justify-center">
                                    <OrbixLoader size="sm" />
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
                                    const rawTitle = item.title || "Inquiry";
                                    const cleanTitle = cleanEmojiText(rawTitle);
                                    const senderName = cleanEmojiText(meta.senderName || cleanTitle);
                                    const company = cleanEmojiText(meta.company || "");
                                    const commEmail = meta.communicationEmail || meta.senderEmail || "";
                                    const snippet = cleanEmojiText(meta.fullMessage || item.body || "");
                                    const isDeleting = deletingId === item.id;
                                    const { Icon: NotifIcon, bg: iconBg } = getNotificationIcon(rawTitle, snippet);

                                    const mailSubject = encodeURIComponent(`Re: Opportunity at ${company} for ${user.firstName || user.username}`);
                                    const mailBody = encodeURIComponent(`Hi ${senderName},\n\nThank you for reaching out regarding the opportunity at ${company}.\n\n`);
                                    const mailtoUrl = commEmail ? `mailto:${commEmail}?subject=${mailSubject}&body=${mailBody}` : "#";

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => handleOpenItem(item.id)}
                                            className={`group p-3 sm:p-3.5 transition-colors text-left cursor-pointer min-w-0 ${
                                                isDark ? "hover:bg-neutral-900" : "hover:bg-[#FAF6EE]"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                {/* Lucide React Notification Type Icon */}
                                                <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000] mt-0.5 ${iconBg}`}>
                                                    <NotifIcon className="w-4 h-4 stroke-[2.4]" />
                                                </div>

                                                {/* Middle: Sender & Company & Snippet */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                        <span className={`text-xs font-black truncate max-w-full ${
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

                                                    <p className={`text-xs font-medium line-clamp-2 break-words mt-1 leading-relaxed ${
                                                        isDark ? "text-neutral-300" : "text-neutral-700"
                                                    }`}>
                                                        {snippet}
                                                    </p>
                                                </div>

                                                {/* Right: Timestamp & Actions */}
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                    <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${
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
                                                                <OrbixLoader size="xs" variant="inline" color="currentColor" />
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
                                className={`shrink-0 p-3 border-t-2 border-black text-center ${
                                    isDark ? "bg-neutral-900" : "bg-[#FAF6EE]"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={handleViewAll}
                                    className="w-full py-2 px-4 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>View all in dedicated Inbox</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
                                </button>
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default NotificationBell;
