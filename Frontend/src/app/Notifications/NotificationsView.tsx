// Frontend/src/app/Notifications/NotificationsView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
    Mail,
    Search,
    Trash2,
    Check,
    Copy,
    RefreshCw,
    Inbox,
    ArrowUpRight,
    User,
    Users,
    Building2,
    UserPlus,
    UserCheck,
    GraduationCap,
    MapPin,
    Trophy,
    Code2,
    ExternalLink,
    ShieldCheck,
    ShieldAlert,
    Laptop,
    Monitor,
    Smartphone,
    Tablet,
    Radio,
    CheckCheck,
    KeyRound,
    AlertTriangle,
    LifeBuoy,
    Calendar,
    Clock,
    Ticket,
    QrCode,
    Printer,
    CheckCircle2,
    Award,
    Sparkles,
    Download,
} from "lucide-react";
import { revealCertificateNotification } from "../../api/certificateStudioApi";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader, OrbixButton } from "../../components/ui/loader";
import { VerifiedBadge } from "../../components/VerifiedBadge";
import { terminateSession } from "../../api/sessionActivityApi";
import { useAppSelector } from "../../store";
import { OrbixCardQR } from "../Profile/CardStudio/OrbixCardQR";
import {
    fetchNotifications,
    deleteNotification,
    markNotificationsAsRead,
    type UserNotification,
} from "../../utils/profileApi";
import { RelationshipActionButton } from "../../components/RelationshipActionButton";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";

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
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const [searchParams, setSearchParams] = useSearchParams();
    const queryId = searchParams.get("id");

    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "requests" | "security" | "teams" | "inquiries" | "unread">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [actingInvitationId, setActingInvitationId] = useState<string | null>(null);

    // Interactive security session termination from inbox
    const [terminatedSessionIds, setTerminatedSessionIds] = useState<Set<string>>(new Set());
    const [isTerminatingSession, setIsTerminatingSession] = useState<string | null>(null);
    const [isMarkingAllRead, setIsMarkingAllRead] = useState<boolean>(false);
    const [revealedCertificates, setRevealedCertificates] = useState<Record<string, boolean>>({});

    // Load notifications with automatic read marking
    const loadNotifications = useCallback(
        async (isRefresh = false) => {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            try {
                // Fetch with autoMarkRead=true so unread count clears automatically on arrival
                const res = await fetchNotifications(true);
                setNotifications(res.notifications || []);

                // Broadcast update so navbar and sidebar unread counts update
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("orbix_notifications_updated"));
                }

                // If queryId is provided, select it; otherwise select first item if none selected
                if (queryId && res.notifications?.some((n) => n.id === queryId)) {
                    setSelectedId(queryId);
                } else if (!selectedId && res.notifications && res.notifications.length > 0) {
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

    // Mark all notifications as read
    const handleMarkAllAsRead = async () => {
        setIsMarkingAllRead(true);
        try {
            await markNotificationsAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("orbix_notifications_updated"));
            }
            toast.success("All notifications marked as read.");
        } catch {
            toast.error("Failed to mark notifications as read.");
        } finally {
            setIsMarkingAllRead(false);
        }
    };

    // Terminate session remotely directly from security notification
    const handleTerminateSessionFromInbox = async (sessionId: string, deviceName: string) => {
        if (!sessionId) return;
        setIsTerminatingSession(sessionId);
        try {
            await terminateSession(sessionId);
            setTerminatedSessionIds((prev) => new Set(prev).add(sessionId));
            toast.warning(`Session on ${deviceName || "device"} terminated immediately.`, {
                title: "Remote Logout Executed",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to terminate session.");
        } finally {
            setIsTerminatingSession(null);
        }
    };

    // Helper functions for notification types
    const isSecurityAlert = useCallback((item: UserNotification): boolean => {
        const type = (item.type || "").toLowerCase();
        const notifType = ((item as any).notification_type || "").toLowerCase();
        const title = (item.title || "").toLowerCase();
        return (
            type === "security_alert" ||
            notifType === "new_device_login" ||
            notifType === "security_alert" ||
            notifType.includes("session") ||
            notifType.includes("password") ||
            title.includes("login detected") ||
            title.includes("security alert") ||
            title.includes("password changed") ||
            title.includes("device login")
        );
    }, []);

    const isHelpTicket = useCallback((item: UserNotification): boolean => {
        const type = (item.type || "").toLowerCase();
        const notifType = ((item as any).notification_type || "").toLowerCase();
        const title = (item.title || "").toLowerCase();
        return (
            type === "help_ticket" ||
            notifType.includes("help_ticket") ||
            title.includes("help ticket") ||
            Boolean(item.metadata?.ticketNumber || item.metadata?.ticketId)
        );
    }, []);

    const isAccountGovernance = useCallback((item: UserNotification): boolean => {
        const notifType = ((item as any).notification_type || "").toLowerCase();
        const type = (item.type || "").toLowerCase();
        return (
            notifType === "account_deletion" ||
            notifType === "privacy_update" ||
            type === "governance"
        );
    }, []);

    const isCertificateAward = useCallback((item: UserNotification): boolean => {
        const type = (item.type || "").toLowerCase();
        const notifType = ((item as any).notification_type || "").toLowerCase();
        const title = (item.title || "").toLowerCase();
        return (
            type === "certificate_awarded" ||
            notifType === "certificate_awarded" ||
            Boolean(item.metadata?.certificateId || item.metadata?.credentialCode) ||
            title.includes("certificate")
        );
    }, []);

    const renderDeviceIcon = (deviceStr: string, className = "w-4 h-4") => {
        const d = (deviceStr || "").toLowerCase();
        if (d.includes("iphone") || d.includes("android") || d.includes("mobile")) {
            return <Smartphone className={className} />;
        }
        if (d.includes("ipad") || d.includes("tablet")) {
            return <Tablet className={className} />;
        }
        if (d.includes("mac") || d.includes("windows") || d.includes("laptop")) {
            return <Laptop className={className} />;
        }
        return <Monitor className={className} />;
    };

    // Helper functions for relationship-aware notifications
    const isPendingConnectionRequest = useCallback((item: UserNotification): boolean => {
        const isConnReq =
            item.type === "connection_request" ||
            (item as any).notification_type === "connection_request";
        const status = (item.metadata as any)?.relationshipStatus;
        if (status && status !== "pending") return false;
        if (item.type === "connection_accepted" || item.type === "connection_declined") return false;
        return isConnReq;
    }, []);

    const isConnectionAcceptedItem = useCallback((item: UserNotification): boolean => {
        return (
            item.type === "connection_accepted" ||
            (item as any).notification_type === "connection_accepted" ||
            (item.metadata as any)?.relationshipStatus === "connected"
        );
    }, []);

    const isConnectionInteraction = useCallback((item: UserNotification): boolean => {
        const type = item.type || (item as any).notification_type;
        const status = (item.metadata as any)?.relationshipStatus;
        return (
            type === "connection_request" ||
            type === "connection_accepted" ||
            type === "connection_declined" ||
            Boolean(status)
        );
    }, []);

    // Helper functions for club team invitations
    const isClubTeamInvitation = useCallback((item: UserNotification): boolean => {
        const type = item.type || (item as any).notification_type;
        return (
            type === "club_team_invitation" ||
            Boolean((item.metadata as any)?.invitationId)
        );
    }, []);

    // Helper functions for club campus events
    const isClubEvent = useCallback((item: UserNotification): boolean => {
        const type = (item.type || (item as any).notification_type || "").toLowerCase();
        return (
            type === "club_event" ||
            type.startsWith("event_") ||
            Boolean(item.metadata?.eventId)
        );
    }, []);

    const handleAcceptTeamInvitation = async (notificationId: string, invitationId: string) => {
        setActingInvitationId(invitationId);
        try {
            const res = await fetch(`/api/club/team/invitations/${invitationId}/accept`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to accept invitation.");
                return;
            }

            setNotifications((prev) =>
                prev.map((notif) => {
                    if (notif.id === notificationId) {
                        return {
                            ...notif,
                            metadata: {
                                ...notif.metadata,
                                invitationStatus: "accepted",
                            },
                        };
                    }
                    return notif;
                })
            );
        } catch (err) {
            console.error("Accept invitation error:", err);
        } finally {
            setActingInvitationId(null);
        }
    };

    const handleDeclineTeamInvitation = async (notificationId: string, invitationId: string) => {
        setActingInvitationId(invitationId);
        try {
            const res = await fetch(`/api/club/team/invitations/${invitationId}/decline`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to decline invitation.");
                return;
            }

            setNotifications((prev) =>
                prev.map((notif) => {
                    if (notif.id === notificationId) {
                        return {
                            ...notif,
                            metadata: {
                                ...notif.metadata,
                                invitationStatus: "declined",
                            },
                        };
                    }
                    return notif;
                })
            );
        } catch (err) {
            console.error("Decline invitation error:", err);
        } finally {
            setActingInvitationId(null);
        }
    };

    // Immediate reactive state updater when user accepts or declines connection in the UI
    const handleRelationshipStateChange = useCallback((notificationId: string, newState: string) => {
        setNotifications((prev) =>
            prev.map((notif) => {
                if (notif.id === notificationId) {
                    const isNowConnected = newState === "connected";
                    const isNowDeclined = newState === "declined" || newState === "none";
                    return {
                        ...notif,
                        type: isNowConnected ? "connection_accepted" : isNowDeclined ? "connection_declined" : notif.type,
                        title: isNowConnected ? "Connection Request Accepted" : isNowDeclined ? "Connection Request Declined" : notif.title,
                        body: isNowConnected ? "You accepted the connection request. You are now connected!" : notif.body,
                        metadata: {
                            ...notif.metadata,
                            relationshipStatus: newState,
                        },
                    };
                }
                return notif;
            })
        );
    }, []);

    // Listen for broadcast events so relationship changes anywhere in the app immediately reflect here
    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleSync = (e: Event) => {
            const customEvent = e as CustomEvent<{ targetUserId: string; state: string }>;
            if (customEvent.detail?.targetUserId && customEvent.detail?.state) {
                const { targetUserId, state } = customEvent.detail;
                setNotifications((prev) =>
                    prev.map((notif) => {
                        const actorId = notif.metadata?.senderProfile?.id || notif.metadata?.actorId;
                        const username = notif.metadata?.senderProfile?.username || notif.metadata?.username;
                        const matches =
                            (actorId && (actorId === targetUserId || actorId.toLowerCase() === targetUserId.toLowerCase())) ||
                            (username && username.toLowerCase() === targetUserId.toLowerCase());

                        if (matches) {
                            const isNowConnected = state === "connected";
                            const isNowDeclined = state === "declined" || state === "none";
                            return {
                                ...notif,
                                type: isNowConnected ? "connection_accepted" : isNowDeclined ? "connection_declined" : notif.type,
                                title: isNowConnected ? "Connection Request Accepted" : isNowDeclined ? "Connection Request Declined" : notif.title,
                                body: isNowConnected ? "You accepted the connection request. You are now connected!" : notif.body,
                                metadata: {
                                    ...notif.metadata,
                                    relationshipStatus: state,
                                },
                            };
                        }
                        return notif;
                    })
                );
            }
        };

        window.addEventListener("orbix_relationship_changed", handleSync);
        return () => {
            window.removeEventListener("orbix_relationship_changed", handleSync);
        };
    }, []);

    // Filter and search logic
    const filteredNotifications = useMemo(() => {
        return notifications.filter((item) => {
            const isConnReq = isPendingConnectionRequest(item);
            const isTeamInv = isClubTeamInvitation(item);
            const isPendingTeam = isTeamInv && (item.metadata?.invitationStatus === "pending" || !item.metadata?.invitationStatus);
            const isHire =
                item.type === "hire_inquiry" ||
                (item as any).notification_type === "hire_inquiry";
            const isSec = isSecurityAlert(item);

            if (filter === "requests" && !isConnReq && !isPendingTeam) return false;
            if (filter === "security" && !isSec) return false;
            if (filter === "teams" && !isTeamInv) return false;
            if (filter === "inquiries" && !isHire) return false;
            if (filter === "unread" && item.isRead) return false;

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase();
            const meta = item.metadata || {};
            const senderProfile = meta.senderProfile || {};
            const senderName = (
                senderProfile.displayName ||
                meta.displayName ||
                meta.senderName ||
                ""
            ).toLowerCase();
            const username = (
                senderProfile.username ||
                meta.username ||
                ""
            ).toLowerCase();
            const company = (meta.company || "").toLowerCase();
            const clubName = (meta.clubName || "").toLowerCase();
            const teamName = (meta.teamName || "").toLowerCase();
            const positionTitle = (meta.positionTitle || "").toLowerCase();
            const body = (meta.fullMessage || item.body || "").toLowerCase();
            const commEmail = (meta.communicationEmail || "").toLowerCase();
            const college = (senderProfile.college || meta.college || "").toLowerCase();
            const deviceName = (meta.deviceName || "").toLowerCase();
            const location = (meta.location || "").toLowerCase();
            const title = (item.title || "").toLowerCase();
            const ticketNum = (meta.ticketNumber || "").toLowerCase();

            return (
                senderName.includes(q) ||
                username.includes(q) ||
                company.includes(q) ||
                clubName.includes(q) ||
                teamName.includes(q) ||
                positionTitle.includes(q) ||
                body.includes(q) ||
                commEmail.includes(q) ||
                college.includes(q) ||
                deviceName.includes(q) ||
                location.includes(q) ||
                title.includes(q) ||
                ticketNum.includes(q)
            );
        });
    }, [notifications, filter, searchQuery, isPendingConnectionRequest, isClubTeamInvitation, isSecurityAlert]);

    const activeItem = useMemo(() => {
        return notifications.find((n) => n.id === selectedId) || filteredNotifications[0] || null;
    }, [notifications, selectedId, filteredNotifications]);

    const totalCount = notifications.length;
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    const requestsCount = notifications.filter((item) => {
        return (
            isPendingConnectionRequest(item) ||
            (isClubTeamInvitation(item) &&
                (item.metadata?.invitationStatus === "pending" || !item.metadata?.invitationStatus))
        );
    }).length;
    const securityCount = notifications.filter((n) => isSecurityAlert(n)).length;
    const teamInvCount = notifications.filter((n) => isClubTeamInvitation(n)).length;
    const inquiryCount = notifications.filter(
        (n) => n.type === "hire_inquiry" || (n as any).notification_type === "hire_inquiry"
    ).length;

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
                        {unreadCount > 0 && (
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                                <span>{unreadCount} Unread</span>
                            </span>
                        )}
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium mt-1">
                        Connection requests, security alerts, developer interactions, and direct opportunities
                    </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            disabled={isMarkingAllRead}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                            title="Mark all notifications as read"
                        >
                            <CheckCheck className={`w-3.5 h-3.5 text-black stroke-[2.5] ${isMarkingAllRead ? "animate-pulse" : ""}`} />
                            <span>{isMarkingAllRead ? "Marking..." : "Mark All Read"}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => loadNotifications(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] active:translate-x-0.5 active:translate-y-0.5 text-xs font-black text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh inbox"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
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
                                placeholder="Search by name, handle, college, or text..."
                                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white text-xs border-2 border-black focus:outline-none placeholder-neutral-400 font-bold text-black shadow-[2px_2px_0px_#000]"
                            />
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                                onClick={() => setFilter("requests")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    filter === "requests"
                                        ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black hover:bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                Requests ({requestsCount})
                            </button>
                            {securityCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilter("security")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        filter === "security"
                                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                            : "bg-white text-black hover:bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    Security ({securityCount})
                                </button>
                            )}
                            {teamInvCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilter("teams")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        filter === "teams"
                                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                            : "bg-white text-black hover:bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    Teams ({teamInvCount})
                                </button>
                            )}
                            {inquiryCount > 0 && (
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
                            )}
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilter("unread")}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        filter === "unread"
                                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                            : "bg-white text-black hover:bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000]"
                                    }`}
                                >
                                    Unread ({unreadCount})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="flex-1 overflow-y-auto divide-y-2 divide-black/10 max-h-[660px]">
                        {loading && notifications.length === 0 ? (
                            <div className="py-16 flex items-center justify-center text-black">
                                <OrbixLoader size="md" />
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black mb-3">
                                    <Inbox className="w-6 h-6 stroke-[2.5]" />
                                </div>
                                <h4 className="text-sm font-black text-black">No messages</h4>
                                <p className="text-xs font-bold text-neutral-600 mt-1 max-w-[220px]">
                                    {searchQuery ? "No matching notifications found." : "Connection requests and updates will appear here."}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map((item) => {
                                const isSelected = activeItem?.id === item.id;
                                const isConnReq = isPendingConnectionRequest(item);
                                const isConnAccepted = isConnectionAcceptedItem(item);
                                const isConnInteraction = isConnectionInteraction(item);
                                const isTeamInv = isClubTeamInvitation(item);
                                const isClubEvt = isClubEvent(item);
                                const isHire =
                                    item.type === "hire_inquiry" ||
                                    (item as any).notification_type === "hire_inquiry";
                                const isSecurity = isSecurityAlert(item);
                                const isHelp = isHelpTicket(item);
                                const isGov = isAccountGovernance(item);
                                const isCert = isCertificateAward(item);

                                const meta = item.metadata || {};
                                const senderProfile = meta.senderProfile || {};

                                const invStatus = meta.invitationStatus || "pending";
                                const isPendingTeamInv = isTeamInv && invStatus === "pending";
                                const isAcceptedTeamInv = isTeamInv && invStatus === "accepted";
                                const isDeclinedTeamInv = isTeamInv && invStatus === "declined";
                                const isTerminatedSession = isSecurity && meta.sessionId && terminatedSessionIds.has(meta.sessionId);

                                const senderDisplayName =
                                    isSecurity
                                        ? (item.title || "Security Alert")
                                        : isHelp
                                        ? (item.title || "Help Support Ticket")
                                        : isGov
                                        ? (item.title || "Account Governance")
                                        : isCert
                                        ? (meta.clubName || "Campus Club")
                                        : isTeamInv
                                        ? (meta.clubName || "Club Team Invitation")
                                        : isClubEvt
                                        ? (meta.clubName || item.title || "Campus Event")
                                        : (senderProfile.displayName ||
                                           meta.displayName ||
                                           meta.senderName ||
                                           (isConnInteraction ? "Developer" : item.title || "Inquiry"));

                                const senderAvatar =
                                    isTeamInv
                                        ? (meta.clubLogoUrl || DEFAULT_AVATAR_URL)
                                        : (senderProfile.avatarUrl ||
                                           meta.avatarUrl ||
                                           DEFAULT_AVATAR_URL);

                                const senderUsername =
                                    isSecurity
                                        ? (meta.deviceName ? `${meta.deviceName} · ${meta.location || "Location unavailable"}` : "")
                                        : isHelp
                                        ? (meta.ticketNumber ? `Ticket ${meta.ticketNumber}` : "")
                                        : isCert
                                        ? (meta.credentialCode ? `Code: ${meta.credentialCode}` : "Verified Credential")
                                        : isTeamInv
                                        ? (meta.positionTitle ? `${meta.positionTitle}${meta.teamName ? ` · ${meta.teamName}` : ""}` : "")
                                        : isClubEvt
                                        ? (meta.collegeName ? `${meta.collegeName} · Campus Event` : "Campus Club Event")
                                        : (senderProfile.username ||
                                           meta.username ||
                                           "");

                                const snippet = meta.message || meta.fullMessage || item.body || "";

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
                                        <div className="flex items-start gap-3">
                                            {/* Thumbnail Icon / Avatar */}
                                            {isSecurity ? (
                                                <div className={`relative w-10 h-10 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 mt-0.5 ${
                                                    isTerminatedSession ? "bg-neutral-200 text-neutral-600" : "bg-amber-100 text-amber-900"
                                                }`}>
                                                    {renderDeviceIcon(meta.deviceName || meta.browser || "", "w-5 h-5 stroke-[2.2]")}
                                                    {!item.isRead && (
                                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-black animate-pulse" />
                                                    )}
                                                </div>
                                            ) : isHelp ? (
                                                <div className="relative w-10 h-10 rounded-xl bg-sky-100 text-sky-900 border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 mt-0.5">
                                                    <LifeBuoy className="w-5 h-5 stroke-[2.2]" />
                                                    {!item.isRead && (
                                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sky-500 border border-black animate-pulse" />
                                                    )}
                                                </div>
                                            ) : isGov ? (
                                                <div className="relative w-10 h-10 rounded-xl bg-rose-100 text-rose-900 border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 mt-0.5">
                                                    <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
                                                </div>
                                            ) : isCert ? (
                                                <div className="relative w-10 h-10 rounded-xl bg-[#a2ff86] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 mt-0.5">
                                                    <Award className="w-5 h-5 stroke-[2.2]" />
                                                    {!item.isRead && (
                                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black animate-pulse" />
                                                    )}
                                                </div>
                                            ) : isClubEvt ? (
                                                <div className={`relative w-10 h-10 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 mt-0.5 ${
                                                    meta.action === "application_approved" || Boolean(meta.ticketCode)
                                                        ? "bg-[#a2ff86] text-black"
                                                        : meta.action === "application_submitted" || meta.action === "application_received"
                                                        ? "bg-amber-100 text-amber-900"
                                                        : meta.action === "cancelled"
                                                        ? "bg-rose-100 text-rose-800"
                                                        : meta.action === "completed"
                                                        ? "bg-sky-100 text-sky-800"
                                                        : "bg-[#a2ff86] text-black"
                                                }`}>
                                                    {meta.action === "application_approved" || Boolean(meta.ticketCode) ? (
                                                        <Ticket className="w-5 h-5 stroke-[2.2]" />
                                                    ) : meta.action === "application_submitted" || meta.action === "application_received" ? (
                                                        <Clock className="w-5 h-5 stroke-[2.2]" />
                                                    ) : (
                                                        <Calendar className="w-5 h-5 stroke-[2.2]" />
                                                    )}
                                                    {!item.isRead && (
                                                        <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-black ${
                                                            meta.action === "cancelled" ? "bg-rose-500" : "bg-emerald-500"
                                                        }`} />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="relative w-10 h-10 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] overflow-hidden shrink-0 mt-0.5">
                                                    <img
                                                        src={senderAvatar}
                                                        alt={senderDisplayName}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                        }}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {isConnReq && (
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#a2ff86] border border-black flex items-center justify-center">
                                                            <UserPlus className="w-2.5 h-2.5 text-black stroke-[3]" />
                                                        </div>
                                                    )}
                                                    {isConnAccepted && (
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#a2ff86] border border-black flex items-center justify-center">
                                                            <UserCheck className="w-2.5 h-2.5 text-black stroke-[3]" />
                                                        </div>
                                                    )}
                                                    {isTeamInv && (
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black text-[#a2ff86] border border-black flex items-center justify-center">
                                                            <Users className="w-2.5 h-2.5 stroke-[2.5]" />
                                                        </div>
                                                    )}
                                                    {!item.isRead && (
                                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Sender & Preview */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-black text-black truncate">
                                                        {senderDisplayName}
                                                    </span>

                                                    {/* Contextual Type Badges */}
                                                    {isSecurity && (
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 ${
                                                            isTerminatedSession ? "bg-neutral-200 text-neutral-700" : "bg-[#FFE566] text-black"
                                                        }`}>
                                                            <ShieldAlert className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>{isTerminatedSession ? "Terminated" : "Security Alert"}</span>
                                                        </span>
                                                    )}

                                                    {isHelp && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-sky-200 text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                            <LifeBuoy className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>Support Ticket</span>
                                                        </span>
                                                    )}

                                                    {isGov && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-200 text-black border border-black shadow-[1px_1px_0px_#000]">
                                                            Governance
                                                        </span>
                                                    )}

                                                    {isCert && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                            <Award className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>{meta.certificateType ? String(meta.certificateType).toUpperCase() : "CREDENTIAL"}</span>
                                                        </span>
                                                    )}

                                                    {isConnReq && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                            Connection Request
                                                        </span>
                                                    )}

                                                    {isConnAccepted && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                            <span>Connected</span>
                                                        </span>
                                                    )}

                                                    {isClubEvt && (
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 ${
                                                            meta.action === "cancelled"
                                                                ? "bg-rose-200 text-rose-900"
                                                                : meta.action === "completed"
                                                                ? "bg-sky-200 text-sky-900"
                                                                : "bg-[#a2ff86] text-black"
                                                        }`}>
                                                            <Calendar className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>
                                                                {meta.action === "cancelled"
                                                                    ? "Event Cancelled"
                                                                    : meta.action === "completed"
                                                                    ? "Event Completed"
                                                                    : "Campus Event"}
                                                            </span>
                                                        </span>
                                                    )}

                                                    {isTeamInv && isPendingTeamInv && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                            <Users className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>Team Invitation</span>
                                                        </span>
                                                    )}

                                                    {isTeamInv && isAcceptedTeamInv && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                            <span>Joined Team</span>
                                                        </span>
                                                    )}

                                                    {isTeamInv && isDeclinedTeamInv && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-700 border border-black">
                                                            Declined
                                                        </span>
                                                    )}

                                                    {isHire && meta.company && (
                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] truncate max-w-[130px]">
                                                            {meta.company}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Handle / device signature and snippet */}
                                                {senderUsername && (
                                                    <span className="text-[11px] font-mono font-bold text-neutral-500 block truncate">
                                                        {isTeamInv || isSecurity || isHelp || isGov ? senderUsername : `@${senderUsername}`}
                                                    </span>
                                                )}

                                                <p className="text-xs text-neutral-700 font-medium line-clamp-2 mt-1 leading-relaxed">
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
                            const isConnAccepted = isConnectionAcceptedItem(activeItem);
                            const isConnInteraction = isConnectionInteraction(activeItem);

                            const isHireInquiry =
                                activeItem.type === "hire_inquiry" ||
                                (activeItem as any).notification_type === "hire_inquiry";

                            const meta = activeItem.metadata || {};
                            const senderProfile = meta.senderProfile || {};

                            const senderUsername =
                                senderProfile.username ||
                                meta.username ||
                                "";

                            const senderDisplayName =
                                senderProfile.displayName ||
                                meta.displayName ||
                                meta.senderName ||
                                (isConnInteraction ? "Developer" : isHireInquiry ? "Recruiter" : activeItem.title || "Inquiry");

                            const senderAvatar =
                                senderProfile.avatarUrl ||
                                meta.avatarUrl ||
                                DEFAULT_AVATAR_URL;

                            const senderHeadline =
                                senderProfile.headline ||
                                meta.headline ||
                                null;

                            const senderCollege =
                                senderProfile.college ||
                                meta.college ||
                                null;

                            const senderLocation =
                                senderProfile.location ||
                                meta.location ||
                                null;

                            const senderBio =
                                senderProfile.bio ||
                                meta.bio ||
                                null;

                            const senderScore =
                                senderProfile.orbixScore ??
                                meta.orbixScore ??
                                null;

                            const senderSolved =
                                senderProfile.totalSolved ??
                                meta.totalSolved ??
                                null;

                            const actorId =
                                senderProfile.id ||
                                meta.actorId ||
                                senderUsername;

                            // -------------------------------------------------------------
                            // CASE CERT: CERTIFICATE AWARD WITH SPOILER PREVIEW & REVEAL
                            // -------------------------------------------------------------
                            if (isCertificateAward(activeItem)) {
                                const certId = meta.certificateId || "";
                                const credentialCode = meta.credentialCode || "";
                                const clubName = meta.clubName || "Campus Club";
                                const clubSlug = meta.clubSlug || "";
                                const clubLogo = meta.clubLogo || null;
                                const certTitle = meta.certificateTitle || activeItem.title || "Certificate of Recognition";
                                const certType = meta.certificateType || "participation";
                                const awardPosition = meta.awardPosition || null;
                                const isRevealed = Boolean(meta.spoilerRevealed || revealedCertificates[activeItem.id]);

                                const handleReveal = async () => {
                                    setRevealedCertificates((prev) => ({ ...prev, [activeItem.id]: true }));
                                    try {
                                        if (certId) {
                                            await revealCertificateNotification(certId);
                                        }
                                    } catch (err) {
                                        console.error("Failed to mark reveal on server:", err);
                                    }
                                };

                                return (
                                    <div className="flex-1 flex flex-col justify-between overflow-y-auto p-6 sm:p-8 space-y-6">
                                        {/* Header Bar */}
                                        <div className="flex items-start justify-between gap-4 pb-6 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3">
                                                {clubLogo ? (
                                                    <img
                                                        src={clubLogo}
                                                        alt={clubName}
                                                        className="w-12 h-12 rounded-xl border-2 border-black object-cover shadow-[2px_2px_0px_#000]"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black text-black shadow-[2px_2px_0px_#000]">
                                                        <Award className="w-6 h-6 stroke-[2.5]" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-base sm:text-lg font-black text-black">
                                                            {clubName}
                                                        </h3>
                                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#FFE566] border border-black rounded shadow-[1px_1px_0px_#000]">
                                                            {certType}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-semibold text-neutral-500">
                                                        Awarded on {formatFullDateTime(activeItem.createdAt)}
                                                    </div>
                                                </div>
                                            </div>

                                            {clubSlug && (
                                                <Link
                                                    to={`/clubs/${clubSlug}`}
                                                    className="text-xs font-black text-blue-700 hover:underline flex items-center gap-1 shrink-0"
                                                >
                                                    <span>View Club</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            )}
                                        </div>

                                        {/* Award Message Content */}
                                        <div className="space-y-3">
                                            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                                {certTitle}
                                            </h2>
                                            {awardPosition && (
                                                <div className="inline-block px-3 py-1 bg-amber-100 border-2 border-black rounded-lg text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                                                    🏆 {awardPosition}
                                                </div>
                                            )}
                                            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed font-medium">
                                                {activeItem.body}
                                            </p>
                                        </div>

                                        {/* SPOILER CARD / REVEALED CERTIFICATE */}
                                        <div className="relative rounded-2xl border-3 border-black overflow-hidden shadow-[5px_5px_0px_#000] bg-neutral-900 text-white min-h-[260px] flex flex-col justify-center items-center p-6 text-center">
                                            {!isRevealed ? (
                                                <div className="space-y-4 max-w-md">
                                                    <div className="w-16 h-16 rounded-2xl bg-[#FFE566] text-black border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000] animate-bounce">
                                                        <Sparkles className="w-8 h-8 stroke-[2.5]" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-black/60 border border-neutral-700 rounded-full text-[#a2ff86]">
                                                            Digital Credential Unlocked
                                                        </span>
                                                        <h4 className="text-lg sm:text-xl font-black text-white">
                                                            You received an official certificate!
                                                        </h4>
                                                        <p className="text-xs text-neutral-300">
                                                            Tap below to unseal your personalized certificate and download the cryptographically signed PDF.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleReveal}
                                                        className="px-6 py-3 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black font-black text-xs sm:text-sm shadow-[3px_3px_0px_#000] flex items-center gap-2 mx-auto transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                                                    >
                                                        <Sparkles className="w-4 h-4 stroke-[2.5]" />
                                                        <span>Tap to Reveal Certificate</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-full space-y-5">
                                                    <div className="p-4 rounded-xl bg-neutral-800/90 border-2 border-neutral-700 space-y-2">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-mono text-[#a2ff86] font-bold">
                                                                ID: {credentialCode}
                                                            </span>
                                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#a2ff86] text-black rounded">
                                                                Verified
                                                            </span>
                                                        </div>
                                                        <h4 className="text-lg sm:text-xl font-black text-white tracking-tight">
                                                            {certTitle}
                                                        </h4>
                                                        <div className="text-xs text-neutral-300">
                                                            Issued to <strong className="text-white">{user ? `${user.firstName} ${user.lastName}`.trim() : "Recipient"}</strong> by {clubName}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                                        {credentialCode && (
                                                            <a
                                                                href={`/api/club/certificates/${encodeURIComponent(credentialCode)}/download`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black font-black text-xs shadow-[3px_3px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                            >
                                                                <Download className="w-4 h-4 stroke-[2.5]" />
                                                                <span>Download Signed PDF</span>
                                                            </a>
                                                        )}

                                                        {credentialCode && (
                                                            <Link
                                                                to={`/verify/certificate/${encodeURIComponent(credentialCode)}`}
                                                                target="_blank"
                                                                className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black font-black text-xs shadow-[3px_3px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                                <span>Public Verification Link</span>
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Security Verification footer note */}
                                        <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-black flex items-center gap-2.5 text-xs text-emerald-900 font-semibold">
                                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                                            <span>
                                                This credential is cryptographically sealed in the Orbix ledger. You can share this verification link on resumes, LinkedIn, and portfolios.
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE 0: CLUB TEAM INVITATION (CONSENT-BASED INVITATION)
                            // -------------------------------------------------------------
                            if (isClubTeamInvitation(activeItem)) {
                                const clubName = meta.clubName || "Collegiate Club";
                                const clubSlug = meta.clubSlug || "";
                                const clubLogo = meta.clubLogoUrl || null;
                                const collegeName = meta.collegeName || "Collegiate Institution";
                                const teamName = meta.teamName || "Club Wide";
                                const positionTitle = meta.positionTitle || "Member";
                                const clubRole = meta.clubRole || "member";
                                const teamRole = meta.teamRole || "member";
                                const inviterName = meta.inviterName || "Club Management";
                                const inviterUsername = meta.inviterUsername || "";
                                const inviterAvatar = meta.inviterAvatarUrl || DEFAULT_AVATAR_URL;
                                const invitationMessage = meta.message || null;
                                const expiresAt = meta.expiresAt || null;
                                const invitationId = meta.invitationId || "";
                                const invStatus = meta.invitationStatus || "pending";
                                const isPending = invStatus === "pending";
                                const isAccepted = invStatus === "accepted";
                                const isDeclined = invStatus === "declined";
                                const isActing = actingInvitationId === invitationId;

                                const isExpired = expiresAt && new Date(expiresAt).getTime() < Date.now();

                                return (
                                    <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5">
                                        {/* Detail Top Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                {/* Club Logo */}
                                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-100 border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden shrink-0 flex items-center justify-center font-black text-xl">
                                                    {clubLogo ? (
                                                        <img
                                                            src={clubLogo}
                                                            alt={clubName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        clubName.slice(0, 2).toUpperCase()
                                                    )}
                                                </div>

                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight truncate">
                                                            {clubName}
                                                        </h3>
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-300 text-black border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                                            <ShieldCheck className="w-3.5 h-3.5" />
                                                            <span>Verified Club</span>
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                                        <span className="font-bold text-neutral-600 flex items-center gap-1">
                                                            <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                                                            <span>{collegeName}</span>
                                                        </span>
                                                        <span className="text-neutral-400">•</span>
                                                        <span className="text-neutral-500 font-mono font-bold text-[11px]">
                                                            Received {formatFullDateTime(activeItem.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions Top Right */}
                                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                                {clubSlug && (
                                                    <Link
                                                        to={`/clubs/${clubSlug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                                    >
                                                        <span>Club Page</span>
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, activeItem.id)}
                                                    disabled={deletingId === activeItem.id}
                                                    className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                    title="Delete notification"
                                                >
                                                    {deletingId === activeItem.id ? (
                                                        <OrbixLoader size="xs" variant="inline" color="#f43f5e" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Team Invitation Summary Banner */}
                                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                                <span className="text-[11px] font-black uppercase font-mono tracking-wider text-neutral-600 flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5 text-black" />
                                                    <span>Team Role & Department Offer</span>
                                                </span>
                                                {isPending && !isExpired && (
                                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                        Action Required
                                                    </span>
                                                )}
                                                {isAccepted && (
                                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                        <Check className="w-3 h-3 stroke-[3]" />
                                                        <span>Accepted</span>
                                                    </span>
                                                )}
                                                {isDeclined && (
                                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-700 border border-black">
                                                        Declined
                                                    </span>
                                                )}
                                                {isExpired && (
                                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-black">
                                                        Expired
                                                    </span>
                                                )}
                                            </div>

                                            {/* 4 Cards Assessment Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {/* Assigned Department */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-sky-100 border border-black flex items-center justify-center shrink-0">
                                                        <Building2 className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Department / Team
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {teamName}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Position Title */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center shrink-0">
                                                        <Users className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Position Title
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {positionTitle}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Access Role */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-100 border border-black flex items-center justify-center shrink-0">
                                                        <ShieldCheck className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Club Access Level
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block capitalize">
                                                            {clubRole.replace("_", " ")} {teamRole !== "member" ? `(${teamRole.replace("_", " ")})` : ""}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Invited By */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0 overflow-hidden">
                                                        <img src={inviterAvatar} alt={inviterName} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Invited By
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {inviterName} {inviterUsername ? `(@${inviterUsername})` : ""}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Personal message from manager if provided */}
                                            {invitationMessage && (
                                                <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] space-y-1">
                                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 block">
                                                        Note from Manager
                                                    </span>
                                                    <p className="text-xs text-neutral-800 font-medium leading-relaxed italic">
                                                        "{invitationMessage}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Expiry note */}
                                            {expiresAt && isPending && (
                                                <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-600">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                    <span>Invitation expires on {formatFullDateTime(expiresAt)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Explanatory consent note */}
                                        <div className="p-4 rounded-xl bg-[#FAF6EE]/60 border-2 border-black/20 text-xs font-medium text-neutral-700 leading-relaxed space-y-1">
                                            <p className="font-bold text-black">
                                                What happens next?
                                            </p>
                                            <p>
                                                Orbix uses a permissioned consent workflow. Accepting this invitation adds you directly to{" "}
                                                <span className="font-black text-black">{clubName}</span> as an active {positionTitle}.
                                                You will appear in the public club directory and gain internal team collaboration access.
                                            </p>
                                        </div>

                                        {/* Bottom Decision Footer */}
                                        {isPending && !isExpired && (
                                            <div className="mt-auto p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-black text-black uppercase tracking-wider block">
                                                        Membership Decision
                                                    </span>
                                                    <span className="text-xs text-neutral-600 font-medium block">
                                                        Accept to activate your membership or decline to dismiss the request.
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeclineTeamInvitation(activeItem.id, invitationId)}
                                                        disabled={isActing}
                                                        className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 font-bold text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                                                    >
                                                        Decline
                                                    </button>
                                                    <OrbixButton
                                                        variant="black"
                                                        size="sm"
                                                        icon={<Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                        loading={isActing}
                                                        loadingLabel="Processing..."
                                                        onClick={() => handleAcceptTeamInvitation(activeItem.id, invitationId)}
                                                    >
                                                        Accept Invitation
                                                    </OrbixButton>
                                                </div>
                                            </div>
                                        )}

                                        {isAccepted && (
                                            <div className="mt-auto p-4 rounded-2xl bg-[#a2ff86]/30 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                        <span>You are a member of {clubName}</span>
                                                    </span>
                                                    <span className="text-xs text-neutral-700 font-medium block">
                                                        Your position is registered as {positionTitle} ({teamName}).
                                                    </span>
                                                </div>
                                                {clubSlug && (
                                                    <Link
                                                        to={`/clubs/${clubSlug}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all"
                                                    >
                                                        <span>Open Club Page</span>
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        )}

                                        {isDeclined && (
                                            <div className="mt-auto p-4 rounded-2xl bg-neutral-100 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-4">
                                                <span className="text-xs font-bold text-neutral-600">
                                                    You declined this invitation to join {clubName}.
                                                </span>
                                            </div>
                                        )}

                                        {isExpired && isPending && (
                                            <div className="mt-auto p-4 rounded-2xl bg-rose-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-4">
                                                <span className="text-xs font-bold text-rose-700">
                                                    This invitation expired and can no longer be accepted. Contact the club manager to send a new one.
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE C: CAMPUS CLUB EVENT NOTIFICATION (PUBLISHED, CANCELLED, COMPLETED)
                            // -------------------------------------------------------------
                            if (isClubEvent(activeItem)) {
                                const eventId = meta.eventId || "";
                                const eventTitle = meta.eventTitle || activeItem.title || "Campus Event";
                                const clubName = meta.clubName || "Verified Club";
                                const clubSlug = meta.clubSlug || "";
                                const collegeName = meta.collegeName || "Collegiate Institution";
                                const action = (meta.action || "published").toLowerCase();
                                const startsAt = meta.startsAt;
                                const venue = meta.venueOrLocation;

                                const formattedStartsAt = startsAt
                                    ? new Date(startsAt).toLocaleString("en-US", {
                                          weekday: "short",
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                          hour12: true,
                                      })
                                    : null;

                                const isAppApproved =
                                    action === "application_approved" ||
                                    (activeItem.type || (activeItem as any).notification_type) === "application_approved" ||
                                    Boolean(meta.ticketCode);
                                const isAppSubmitted =
                                    action === "application_submitted" ||
                                    (activeItem.type || (activeItem as any).notification_type) === "application_submitted";
                                const isAppReceived =
                                    action === "application_received" ||
                                    (activeItem.type || (activeItem as any).notification_type) === "application_received";
                                const isAppRejected =
                                    action === "application_rejected" ||
                                    (activeItem.type || (activeItem as any).notification_type) === "application_rejected";

                                const isCancelled = action === "cancelled";
                                const isCompleted = action === "completed";

                                return (
                                    <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5">
                                        {/* Detail Top Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div
                                                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden shrink-0 flex items-center justify-center font-black ${
                                                        isAppApproved
                                                            ? "bg-[#a2ff86] text-black"
                                                            : isAppSubmitted || isAppReceived
                                                            ? "bg-amber-100 text-amber-900"
                                                            : isCancelled || isAppRejected
                                                            ? "bg-rose-100 text-rose-700"
                                                            : isCompleted
                                                            ? "bg-sky-100 text-sky-700"
                                                            : "bg-[#a2ff86] text-black"
                                                    }`}
                                                >
                                                    {isAppApproved ? (
                                                        <Ticket className="w-8 h-8 stroke-[2.2]" />
                                                    ) : isAppSubmitted || isAppReceived ? (
                                                        <Clock className="w-8 h-8 stroke-[2.2]" />
                                                    ) : (
                                                        <Calendar className="w-8 h-8 stroke-[2.2]" />
                                                    )}
                                                </div>

                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight truncate">
                                                            {eventTitle}
                                                        </h3>
                                                        <span
                                                            className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000] shrink-0 ${
                                                                isAppApproved
                                                                    ? "bg-[#a2ff86] text-black"
                                                                    : isAppSubmitted || isAppReceived
                                                                    ? "bg-amber-200 text-amber-950"
                                                                    : isCancelled || isAppRejected
                                                                    ? "bg-rose-300 text-black"
                                                                    : isCompleted
                                                                    ? "bg-sky-300 text-black"
                                                                    : "bg-[#a2ff86] text-black"
                                                            }`}
                                                        >
                                                            <span>
                                                                {isAppApproved
                                                                    ? "Application Accepted · Pass Active"
                                                                    : isAppSubmitted
                                                                    ? "Application Submitted · Under Review"
                                                                    : isAppReceived
                                                                    ? "New Applicant · Review Needed"
                                                                    : isAppRejected
                                                                    ? "Application Rejected"
                                                                    : isCancelled
                                                                    ? "Cancelled"
                                                                    : isCompleted
                                                                    ? "Completed"
                                                                    : "Live & Published"}
                                                            </span>
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                                        <span className="font-bold text-neutral-800 flex items-center gap-1">
                                                            <span>{clubName}</span>
                                                        </span>
                                                        <span className="text-neutral-400">•</span>
                                                        <span className="font-medium text-neutral-600 flex items-center gap-1">
                                                            <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                                                            <span>{collegeName}</span>
                                                        </span>
                                                        <span className="text-neutral-400">•</span>
                                                        <span className="text-neutral-500 font-mono font-bold text-[11px]">
                                                            Received {formatFullDateTime(activeItem.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Message / Banner */}
                                        <div
                                            className={`p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] ${
                                                isAppApproved
                                                    ? "bg-[#a2ff86] border-black"
                                                    : isAppSubmitted || isAppReceived
                                                    ? "bg-amber-50 border-amber-950"
                                                    : isCancelled || isAppRejected
                                                    ? "bg-rose-50 border-rose-950"
                                                    : isCompleted
                                                    ? "bg-sky-50 border-sky-950"
                                                    : "bg-[#FAF6EE]"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`p-2 rounded-xl border border-black shrink-0 ${
                                                        isAppApproved
                                                            ? "bg-black text-[#a2ff86]"
                                                            : isAppSubmitted || isAppReceived
                                                            ? "bg-amber-200 text-amber-950"
                                                            : isCancelled || isAppRejected
                                                            ? "bg-rose-200 text-rose-900"
                                                            : isCompleted
                                                            ? "bg-sky-200 text-sky-900"
                                                            : "bg-[#a2ff86] text-black"
                                                    }`}
                                                >
                                                    {isAppApproved ? (
                                                        <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                                                    ) : isAppSubmitted || isAppReceived ? (
                                                        <Clock className="w-5 h-5 stroke-[2.2]" />
                                                    ) : (
                                                        <Calendar className="w-5 h-5 stroke-[2.2]" />
                                                    )}
                                                </div>
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <h4 className="text-sm font-black text-black">
                                                        {activeItem.title}
                                                    </h4>
                                                    <p className="text-xs text-neutral-800 leading-relaxed font-bold">
                                                        {activeItem.body}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Case: Application Accepted - Display Scannable Digital Entry Pass with Real QR Code */}
                                        {isAppApproved && meta.ticketCode && (
                                            <div className="p-5 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4 text-center">
                                                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-neutral-500 border-b border-black/10 pb-2">
                                                    <span className="flex items-center gap-1.5 text-black">
                                                        <Ticket className="w-4 h-4 text-black" />
                                                        Verified Event Entry Pass
                                                    </span>
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                        Active Admission Pass
                                                    </span>
                                                </div>

                                                {/* High-DPI Scannable QR Code */}
                                                <div className="flex flex-col items-center justify-center py-2">
                                                    <div className="p-4 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] inline-block">
                                                        <OrbixCardQR
                                                            value={meta.ticketCode}
                                                            size={190}
                                                            showLogo={true}
                                                            noShadow={true}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-mono font-bold text-neutral-600 mt-2.5 flex items-center gap-1.5 justify-center">
                                                        <QrCode className="w-3.5 h-3.5 text-black" />
                                                        Scan at registration desk for campus admission check-in
                                                    </span>
                                                </div>

                                                {/* Pass Code Box */}
                                                <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                                        Your Ticket Pass Code
                                                    </span>
                                                    <div className="flex items-center justify-center gap-2.5">
                                                        <span className="font-mono text-xl sm:text-2xl font-black text-black tracking-widest bg-white px-4 py-1.5 rounded-xl border border-black shadow-[1px_1px_0px_#000]">
                                                            {meta.ticketCode}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(meta.ticketCode);
                                                                setCopiedField("pass_code");
                                                                toast.success("Ticket pass code copied!");
                                                                setTimeout(() => setCopiedField(null), 2000);
                                                            }}
                                                            className="p-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                                            title="Copy Ticket Pass Code"
                                                        >
                                                            {copiedField === "pass_code" ? (
                                                                <Check className="w-4 h-4 text-emerald-600" />
                                                            ) : (
                                                                <Copy className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Attendee Details Strip */}
                                                <div className="p-3 rounded-xl bg-neutral-50 border border-black/20 text-xs font-bold text-left grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[9px] uppercase font-black text-neutral-400 block">
                                                            Ticket Holder
                                                        </span>
                                                        <span className="text-black font-black truncate block">
                                                            {meta.applicantName || user?.firstName || user?.username || "Student Attendee"}
                                                        </span>
                                                    </div>
                                                    {meta.rollNumber && (
                                                        <div>
                                                            <span className="text-[9px] uppercase font-black text-neutral-400 block">
                                                                Student ID / Roll No
                                                            </span>
                                                            <span className="text-neutral-800 font-mono text-[11px] block">
                                                                {meta.rollNumber}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {meta.department && (
                                                        <div>
                                                            <span className="text-[9px] uppercase font-black text-neutral-400 block">
                                                                Department
                                                            </span>
                                                            <span className="text-neutral-800 text-[11px] block">
                                                                {meta.department}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {meta.registrationId && (
                                                        <div>
                                                            <span className="text-[9px] uppercase font-black text-neutral-400 block">
                                                                Registration ID
                                                            </span>
                                                            <span className="text-neutral-600 font-mono text-[10px] truncate block">
                                                                {meta.registrationId}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Case: Application Pending Review */}
                                        {isAppSubmitted && (
                                            <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-800/40 text-amber-950 space-y-2 text-left">
                                                <div className="flex items-center gap-2 font-black text-xs">
                                                    <Clock className="w-4 h-4 text-amber-700" />
                                                    <span>Entry Pass Pending Review</span>
                                                </div>
                                                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                                                    The {clubName} organizers have been notified of your registration. Your admission entry pass and check-in QR code will be generated immediately once your application is accepted.
                                                </p>
                                            </div>
                                        )}

                                        {/* Event Specific Info Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>Scheduled Date & Time</span>
                                                </span>
                                                <p className="text-xs font-bold text-black font-mono">
                                                    {formattedStartsAt || "Date details in event portal"}
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span>Location / Venue</span>
                                                </span>
                                                <p className="text-xs font-bold text-black truncate">
                                                    {venue || "Campus Hall / Online"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions Footer */}
                                        <div className="mt-auto pt-4 border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                {isAppApproved && (
                                                    <button
                                                        type="button"
                                                        onClick={() => window.print()}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        <span>Print Pass Receipt</span>
                                                    </button>
                                                )}

                                                <Link
                                                    to="/applications"
                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all"
                                                >
                                                    <span>View My Applications</span>
                                                </Link>

                                                {clubSlug && (
                                                    <Link
                                                        to={`/clubs/${clubSlug}`}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all"
                                                    >
                                                        <span>View Club Page</span>
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {eventId && (
                                                    <Link
                                                        to={`/college-events?eventId=${eventId}`}
                                                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all"
                                                    >
                                                        <span>Open Event Details</span>
                                                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE A: DEVELOPER RELATIONSHIP / CONNECTION INTERACTION
                            // -------------------------------------------------------------
                            if (isConnInteraction) {
                                return (
                                    <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5">
                                        {/* Detail Top Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                {/* Sender Profile Picture */}
                                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden shrink-0">
                                                    <img
                                                        src={senderAvatar}
                                                        alt={senderDisplayName}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                        }}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight truncate">
                                                            {senderDisplayName}
                                                        </h3>
                                                        {Boolean(senderProfile.isVerifiedCoder || senderProfile.isEmailVerified) && (
                                                            <VerifiedBadge size="sm" title="Verified Developer" />
                                                        )}
                                                        {!isConnAccepted && (
                                                            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1 shrink-0">
                                                                <UserPlus className="w-3 h-3 stroke-[2.5]" />
                                                                <span>Connection Request</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                                        {senderUsername && (
                                                            <Link
                                                                to={`/profile/u/${encodeURIComponent(senderUsername)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-mono font-bold text-neutral-600 hover:text-black flex items-center gap-1 hover:underline"
                                                                title="View public profile"
                                                            >
                                                                <span>@{senderUsername}</span>
                                                                <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                                                            </Link>
                                                        )}
                                                        <span className="text-neutral-400">•</span>
                                                        <span className="text-neutral-500 font-mono font-bold text-[11px]">
                                                            Received {formatFullDateTime(activeItem.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions Top Right */}
                                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                                <RelationshipActionButton
                                                    targetUserId={actorId}
                                                    targetUsername={senderUsername}
                                                    targetDisplayName={senderDisplayName}
                                                    initialState={isConnAccepted ? "connected" : "incoming_pending"}
                                                    onStateChange={(newState) => handleRelationshipStateChange(activeItem.id, newState)}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, activeItem.id)}
                                                    disabled={deletingId === activeItem.id}
                                                    className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                    title="Delete notification"
                                                >
                                                    {deletingId === activeItem.id ? (
                                                        <OrbixLoader size="xs" variant="inline" color="#f43f5e" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Judging The Sender: Comprehensive Developer Profile Summary */}
                                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black/10">
                                                <span className="text-[11px] font-black uppercase font-mono tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-black" />
                                                    <span>Developer Profile Details</span>
                                                </span>
                                                {senderUsername && (
                                                    <Link
                                                        to={`/profile/u/${encodeURIComponent(senderUsername)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-black text-black hover:text-neutral-700 underline underline-offset-4"
                                                    >
                                                        <span>Inspect Full Showcase Profile</span>
                                                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    </Link>
                                                )}
                                            </div>

                                            {/* Headline / Tagline */}
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-black leading-snug">
                                                    {senderHeadline || "Developer on Orbix"}
                                                </p>
                                                {senderBio && (
                                                    <p className="text-xs text-neutral-600 font-medium leading-relaxed italic border-l-2 border-black/30 pl-2.5 mt-1">
                                                        "{senderBio}"
                                                    </p>
                                                )}
                                            </div>

                                            {/* 4 Metric Assessment Chips */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                                {/* College / Institution */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-sky-100 border border-black flex items-center justify-center shrink-0">
                                                        <GraduationCap className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Institution / College
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {senderCollege || "No College Listed"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Location */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-black flex items-center justify-center shrink-0">
                                                        <MapPin className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Location
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {senderLocation || "Location Not Set"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Orbix Score */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0">
                                                        <Trophy className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Orbix Score
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {senderScore ? `${senderScore} Pts` : "Unrated / New"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Problems Solved */}
                                                <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-100 border border-black flex items-center justify-center shrink-0">
                                                        <Code2 className="w-4 h-4 text-black stroke-[2]" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                                            Problems Solved
                                                        </span>
                                                        <span className="text-xs font-black text-black truncate block">
                                                            {senderSolved ? `${senderSolved} Solved` : "0 Tracked"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Network Context Note (Only shown when connection request is pending) */}
                                        {!isConnAccepted && (
                                            <div className="p-4 rounded-xl bg-[#FAF6EE]/60 border-2 border-black/20 text-xs font-medium text-neutral-700 leading-relaxed space-y-1">
                                                <p className="font-bold text-black">
                                                    Why connect on Orbix?
                                                </p>
                                                <p>
                                                    Accepting this connection request adds{" "}
                                                    <span className="font-black text-black">{senderDisplayName}</span> to
                                                    your network, enabling shared progress tracking, mutual platform
                                                    insights, and direct updates.
                                                </p>
                                            </div>
                                        )}

                                        {/* Bottom Action Footer: Decision for Pending requests, Profile Link for Connected */}
                                        {isConnAccepted ? (
                                            <div className="mt-auto p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-black text-black uppercase tracking-wider block">
                                                        Network Connection
                                                    </span>
                                                    <span className="text-xs text-neutral-600 font-medium block">
                                                        You are connected with {senderDisplayName}{senderUsername ? ` (@${senderUsername})` : ""} on Orbix.
                                                    </span>
                                                </div>
                                                {senderUsername && (
                                                    <Link
                                                        to={`/profile/u/${encodeURIComponent(senderUsername)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer self-start sm:self-auto"
                                                    >
                                                        <span>View Full Profile</span>
                                                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    </Link>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-auto p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-black text-black uppercase tracking-wider block">
                                                        Connection Decision
                                                    </span>
                                                    <span className="text-xs text-neutral-600 font-medium block">
                                                        Choose whether to accept or decline {senderDisplayName}'s request.
                                                    </span>
                                                </div>
                                                <RelationshipActionButton
                                                    targetUserId={actorId}
                                                    targetUsername={senderUsername}
                                                    targetDisplayName={senderDisplayName}
                                                    initialState="incoming_pending"
                                                    onStateChange={(newState) => handleRelationshipStateChange(activeItem.id, newState)}
                                                    size="md"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE S: SECURITY ALERTS & NEW DEVICE LOGINS
                            // -------------------------------------------------------------
                            if (isSecurityAlert(activeItem)) {
                                const deviceName = meta.deviceName || meta.device || "Personal Computer";
                                const browser = meta.browser || "Web Browser";
                                const os = meta.os || meta.operatingSystem || "Operating System";
                                const location = meta.location || meta.locationSummary || "Location unavailable";
                                const sessionId = meta.sessionId || "";
                                const isTerminated = Boolean(sessionId && terminatedSessionIds.has(sessionId));
                                const isTerminating = isTerminatingSession === sessionId;

                                return (
                                    <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5 animate-fadeIn">
                                        {/* Detail Top Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                {/* Device / Security Icon */}
                                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden shrink-0 flex items-center justify-center ${
                                                    isTerminated ? "bg-neutral-200 text-neutral-700" : "bg-amber-100 text-amber-900"
                                                }`}>
                                                    <ShieldAlert className="w-8 h-8 stroke-[2.2]" />
                                                </div>

                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight truncate">
                                                            {activeItem.title || `New Login: ${deviceName}`}
                                                        </h3>
                                                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000] shrink-0 ${
                                                            isTerminated
                                                                ? "bg-neutral-200 text-neutral-800"
                                                                : "bg-[#FFE566] text-black"
                                                        }`}>
                                                            <span className={`w-2 h-2 rounded-full ${isTerminated ? "bg-neutral-500" : "bg-amber-600 animate-pulse"}`} />
                                                            <span>{isTerminated ? "Session Terminated" : "Security Alert"}</span>
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                                        <span className="font-bold text-neutral-600 flex items-center gap-1">
                                                            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                                                            <span>{location}</span>
                                                        </span>
                                                        <span className="text-neutral-400">•</span>
                                                        <span className="text-neutral-500 font-mono font-bold text-[11px]">
                                                            Received {formatFullDateTime(activeItem.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Actions Top Right */}
                                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                                <Link
                                                    to={`/settings?view=your-activity${sessionId ? `&sessionId=${sessionId}` : ""}`}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-[#FAF6EE] text-xs font-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                                >
                                                    <span>Your Activity</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, activeItem.id)}
                                                    disabled={deletingId === activeItem.id}
                                                    className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                                                    title="Delete notification"
                                                >
                                                    {deletingId === activeItem.id ? (
                                                        <OrbixLoader size="xs" variant="inline" color="#f43f5e" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* 4 Diagnostic Info Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                        Device & Platform
                                                    </span>
                                                    {renderDeviceIcon(deviceName || browser, "w-3.5 h-3.5 text-black stroke-[2.5]")}
                                                </div>
                                                <p className="text-sm font-black text-black">{deviceName}</p>
                                                <p className="text-xs font-bold text-neutral-600 truncate">{browser} on {os}</p>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                        Approximate Location
                                                    </span>
                                                    <MapPin className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                </div>
                                                <p className="text-sm font-black text-black truncate">{location}</p>
                                                <p className="text-xs font-bold text-neutral-600">IP Geolocation</p>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                        Session State
                                                    </span>
                                                    <Radio className={`w-3.5 h-3.5 ${isTerminated ? "text-neutral-400" : "text-emerald-600 animate-pulse"} stroke-[2.5]`} />
                                                </div>
                                                <p className="text-sm font-black text-black flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${isTerminated ? "bg-rose-500" : "bg-emerald-500"}`} />
                                                    <span>{isTerminated ? "Terminated Remotely" : "Active Device Session"}</span>
                                                </p>
                                                <p className="text-xs font-bold text-neutral-600">
                                                    {isTerminated ? "Access revoked" : "Authorized token active"}
                                                </p>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                        Authentication Protocol
                                                    </span>
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                                </div>
                                                <p className="text-sm font-black text-black">Canonical SSO</p>
                                                <p className="text-xs font-bold text-emerald-700">Protected Identity</p>
                                            </div>
                                        </div>

                                        {/* Security Advisory Notice Card */}
                                        <div className="rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] p-5 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="w-4 h-4 text-amber-700 stroke-[2.5]" />
                                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                                    Authentication Context & Advisory
                                                </h4>
                                            </div>
                                            <p className="text-sm font-medium leading-relaxed text-black whitespace-pre-wrap select-text">
                                                {activeItem.body}
                                            </p>
                                            <p className="text-xs text-neutral-600 font-medium leading-relaxed pt-1">
                                                Orbix detected a sign-in from a new device signature. If this was you, you can safely dismiss this notification. If you do not recognize this device or location, terminate this session immediately to invalidate all session tokens and prevent unauthorized access.
                                            </p>
                                        </div>

                                        {/* Direct Interactive Security Action Buttons */}
                                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t-2 border-black/10">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Link
                                                    to={`/settings?view=your-activity${sessionId ? `&sessionId=${sessionId}` : ""}`}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                                >
                                                    <Laptop className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Inspect In Your Activity</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </Link>

                                                <Link
                                                    to="/settings?view=password-security"
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#FAF6EE] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Change Password</span>
                                                </Link>
                                            </div>

                                            {sessionId && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleTerminateSessionFromInbox(sessionId, deviceName)}
                                                    disabled={isTerminated || isTerminating}
                                                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                                        isTerminated
                                                            ? "bg-neutral-200 text-neutral-600 border-neutral-400 cursor-not-allowed shadow-none"
                                                            : "bg-rose-500 hover:bg-rose-600 text-white shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px]"
                                                    }`}
                                                >
                                                    {isTerminating ? (
                                                        <OrbixLoader size="xs" variant="inline" color="currentColor" />
                                                    ) : isTerminated ? (
                                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                    ) : (
                                                        <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    )}
                                                    <span>
                                                        {isTerminated
                                                            ? "Session Terminated Remotely"
                                                            : isTerminating
                                                            ? "Terminating..."
                                                            : "This Wasn't Me — Terminate Session"}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE H: HELP TICKETS & SUPPORT RESPONSES
                            // -------------------------------------------------------------
                            if (isHelpTicket(activeItem)) {
                                const ticketNumber = meta.ticketNumber || "";
                                const category = meta.category || "General Platform Inquiry";
                                const priority = meta.priority || "Normal";

                                return (
                                    <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5 animate-fadeIn">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-sky-100 border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden shrink-0 flex items-center justify-center text-sky-900">
                                                    <LifeBuoy className="w-8 h-8 stroke-[2.2]" />
                                                </div>

                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight truncate">
                                                            {activeItem.title}
                                                        </h3>
                                                        {ticketNumber && (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                                                <span>{ticketNumber}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-xs text-neutral-500 font-mono font-bold">
                                                        Received {formatFullDateTime(activeItem.createdAt)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                                <Link
                                                    to="/settings?view=help"
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-[#FAF6EE] text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                                >
                                                    <span>Help Center</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, activeItem.id)}
                                                    disabled={deletingId === activeItem.id}
                                                    className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                                    title="Delete notification"
                                                >
                                                    {deletingId === activeItem.id ? (
                                                        <OrbixLoader size="xs" variant="inline" color="#f43f5e" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Ticket Details Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                                    Ticket ID
                                                </span>
                                                <p className="text-sm font-mono font-black text-black">{ticketNumber || "Ticket Received"}</p>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                                    Category
                                                </span>
                                                <p className="text-sm font-black text-black capitalize">{category}</p>
                                            </div>

                                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                                    Priority
                                                </span>
                                                <p className="text-sm font-black text-black capitalize">{priority}</p>
                                            </div>
                                        </div>

                                        {/* Message Content */}
                                        <div className="rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] p-5 text-black leading-relaxed space-y-2">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                                Support Details
                                            </h4>
                                            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap select-text">
                                                {activeItem.body}
                                            </p>
                                        </div>

                                        {/* Action Bar */}
                                        <div className="pt-2 flex items-center justify-start border-t-2 border-black/10">
                                            <Link
                                                to="/settings?view=help"
                                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                            >
                                                <LifeBuoy className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>View In Help Center</span>
                                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE G: ACCOUNT GOVERNANCE & PRIVACY NOTIFICATIONS
                            // -------------------------------------------------------------
                            if (isAccountGovernance(activeItem)) {
                                return (
                                    <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5 animate-fadeIn">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-100 border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden shrink-0 flex items-center justify-center text-rose-900">
                                                    <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
                                                </div>

                                                <div className="min-w-0 space-y-1">
                                                    <h3 className="text-lg sm:text-xl font-black text-black tracking-tight truncate">
                                                        {activeItem.title}
                                                    </h3>
                                                    <p className="text-xs text-neutral-500 font-mono font-bold">
                                                        Received {formatFullDateTime(activeItem.createdAt)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                                <Link
                                                    to="/settings?view=privacy-center"
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-[#FAF6EE] text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                                >
                                                    <span>Privacy Center</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(e, activeItem.id)}
                                                    disabled={deletingId === activeItem.id}
                                                    className="p-2 rounded-xl border-2 border-black bg-white text-black hover:text-rose-600 hover:bg-rose-50 shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                                    title="Delete notification"
                                                >
                                                    {deletingId === activeItem.id ? (
                                                        <OrbixLoader size="xs" variant="inline" color="#f43f5e" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4 stroke-[2]" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl bg-rose-50 border-2 border-black shadow-[2px_2px_0px_#000] p-5 text-black leading-relaxed space-y-2">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                                                Governance Advisory
                                            </h4>
                                            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap select-text">
                                                {activeItem.body}
                                            </p>
                                        </div>

                                        <div className="pt-2 flex items-center justify-start border-t-2 border-black/10">
                                            <Link
                                                to="/settings?view=privacy-center"
                                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                            >
                                                <span>Manage In Privacy Center</span>
                                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            }

                            // -------------------------------------------------------------
                            // CASE B: RECRUITER / HIRE INQUIRY OR OTHER NOTIFICATIONS
                            // -------------------------------------------------------------
                            const company = meta.company || "";
                            const commEmail = meta.communicationEmail || meta.senderEmail || "";
                            const workEmail = meta.senderEmail || "";
                            const fullMsg = meta.fullMessage || activeItem.body || "";

                            const mailSubject = encodeURIComponent(
                                `Re: Opportunity${company ? ` at ${company}` : ""} for ${user?.firstName || user?.username || "Developer"}`
                            );
                            const mailBody = encodeURIComponent(
                                `Hi ${senderDisplayName},\n\nThank you for reaching out${company ? ` regarding ${company}` : ""}.\n\n`
                            );
                            const mailtoUrl = commEmail
                                ? `mailto:${commEmail}?subject=${mailSubject}&body=${mailBody}`
                                : "#";

                            return (
                                <div className="flex-1 flex flex-col p-5 sm:p-6 space-y-5">
                                    {/* Detail Top Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] overflow-hidden flex-shrink-0">
                                                <img
                                                    src={senderAvatar}
                                                    alt={senderDisplayName}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                    }}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                                        {senderDisplayName}
                                                    </h3>
                                                    {company && (
                                                        <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                                                            {company}
                                                        </span>
                                                    )}
                                                    {isHireInquiry && !company && (
                                                        <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                            Recruiter Opportunity
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-neutral-500 font-mono font-bold mt-1">
                                                    Received {formatFullDateTime(activeItem.createdAt)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
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
                                                    <OrbixLoader size="xs" variant="inline" color="#f43f5e" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4 stroke-[2]" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Contact Information Chips (Only if communication email exists) */}
                                    {commEmail && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                    )}

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
                                            <span>
                                                Direct reply enabled to{" "}
                                                <span className="font-mono text-black font-black">{commEmail}</span>
                                            </span>
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
                            <h3 className="text-sm font-black text-black">Select a notification</h3>
                            <p className="text-xs font-bold text-neutral-600 mt-1 max-w-[240px]">
                                Choose a connection request or update from the left panel to review details.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsView;
