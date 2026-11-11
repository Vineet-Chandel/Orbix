// Frontend/src/app/Club/TeamWorkspace/Notifications/NotificationBell.tsx
import React, { useState, useEffect, useRef } from "react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type { WorkspaceNotification } from "../../../../types/workspace";
import {
    Bell,
    CheckCircle,
    FileText,
    MessageSquare,
    AtSign,
    Users,
    Shield,
    Settings,
    Clock,
} from "lucide-react";
import { NotificationPreferencesModal } from "./NotificationPreferencesModal";

interface NotificationBellProps {
    clubId?: string;
    onNavigate?: (url: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ clubId, onNavigate }) => {
    const [notifications, setNotifications] = useState<WorkspaceNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
    const [showPreferences, setShowPreferences] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadNotifications = async () => {
        try {
            const res = await workspaceApi.getNotifications({ clubId, limit: 30 });
            if (res?.data) {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch (err) {
            console.warn("Failed to load workspace notifications:", err);
        }
    };

    useEffect(() => {
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000); // 30s fallback poll
        
        const handleRealtime = (e: any) => {
            const detail = e.detail;
            if (detail?.event?.startsWith("notification:") || detail?.event?.startsWith("task:") || detail?.event?.startsWith("member:")) {
                loadNotifications();
            }
        };
        window.addEventListener("workspace:realtime", handleRealtime);

        return () => {
            clearInterval(interval);
            window.removeEventListener("workspace:realtime", handleRealtime);
        };
    }, [clubId]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await workspaceApi.markNotificationRead(notificationId, clubId);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
            );
            setUnreadCount((prev) => Math.max(prev - 1, 0));
        } catch (err) {
            console.error("Failed to mark notification read:", err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await workspaceApi.markAllNotificationsRead(clubId);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to mark all notifications read:", err);
        }
    };

    const handleItemClick = (n: WorkspaceNotification) => {
        if (!n.isRead) {
            handleMarkAsRead(n.id);
        }
        setIsOpen(false);
        if (onNavigate && n.destinationUrl) {
            onNavigate(n.destinationUrl);
        } else if (n.destinationUrl) {
            window.location.href = n.destinationUrl;
        }
    };

    const getEventIcon = (type: string) => {
        switch (type) {
            case "task_assigned":
            case "task_reassigned":
                return <FileText className="h-4 w-4 text-indigo-400" />;
            case "task_approved":
                return <CheckCircle className="h-4 w-4 text-emerald-400" />;
            case "task_changes_requested":
                return <Clock className="h-4 w-4 text-amber-400" />;
            case "task_comment":
                return <MessageSquare className="h-4 w-4 text-sky-400" />;
            case "member_mention":
            case "role_mention":
                return <AtSign className="h-4 w-4 text-pink-400" />;
            case "department_membership_added":
            case "department_membership_removed":
                return <Users className="h-4 w-4 text-purple-400" />;
            case "role_assigned":
            case "role_removed":
                return <Shield className="h-4 w-4 text-blue-400" />;
            default:
                return <Bell className="h-4 w-4 text-slate-400" />;
        }
    };

    const filtered = activeTab === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Bell Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-xl p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition focus:outline-none"
                title="Notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-900 animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 rounded-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-indigo-950/40 z-50 text-slate-100 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded hover:bg-indigo-500/10 transition"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setShowPreferences(true);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Notification Settings"
                            >
                                <Settings className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex border-b border-slate-800 px-4 pt-2 gap-4 text-xs font-medium">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`pb-2 border-b-2 transition ${
                                activeTab === "all"
                                    ? "border-indigo-500 text-indigo-400"
                                    : "border-transparent text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("unread")}
                            className={`pb-2 border-b-2 transition ${
                                activeTab === "unread"
                                    ? "border-indigo-500 text-indigo-400"
                                    : "border-transparent text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Unread ({unreadCount})
                        </button>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/60">
                        {filtered.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400">
                                {activeTab === "unread" ? "No unread notifications" : "No notifications yet"}
                            </div>
                        ) : (
                            filtered.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className={`flex items-start gap-3 p-3.5 hover:bg-slate-800/60 cursor-pointer transition ${
                                        !item.isRead ? "bg-indigo-500/5" : ""
                                    }`}
                                >
                                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700/60">
                                        {getEventIcon(item.eventType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <p
                                                className={`text-xs font-medium truncate ${
                                                    !item.isRead ? "text-white font-semibold" : "text-slate-300"
                                                }`}
                                            >
                                                {item.title}
                                            </p>
                                            {!item.isRead && (
                                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                                            {item.message}
                                        </p>
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            {new Date(item.createdAt).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-slate-800 bg-slate-900/60 text-center">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                setShowPreferences(true);
                            }}
                            className="text-[11px] text-slate-400 hover:text-indigo-400 transition"
                        >
                            Notification & Email Preferences
                        </button>
                    </div>
                </div>
            )}

            {/* Preferences Modal */}
            <NotificationPreferencesModal
                isOpen={showPreferences}
                onClose={() => setShowPreferences(false)}
                clubId={clubId}
            />
        </div>
    );
};
