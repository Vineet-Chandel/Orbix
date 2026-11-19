import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Inbox,
    Mail,
    Search,
    VolumeX,
    Volume2,
    Ban,
    UserCheck,
    Archive,
    RotateCcw,
    Send,
    ExternalLink,
    AlertTriangle,
    CheckSquare,
    Trash2,
    Check,
    MoreVertical,
    ArrowLeft,
    MailOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader } from "../../components/ui/loader";
import { useModalDismiss } from "../../hooks/useModalDismiss";

interface ClubInboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    clubName: string;
    onUnreadCountChange?: (newCount: number) => void;
}

interface ConversationSummary {
    id: string;
    clubId: string;
    userId: string;
    subject: string;
    status: "open" | "closed" | "archived";
    isReadByClub: boolean;
    lastMessagePreview: string | null;
    lastMessageAt: string;
    createdAt: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    email: string | null;
    isMuted: boolean;
    isBlocked: boolean;
}

interface MessageItem {
    id: string;
    conversationId: string;
    senderId: string;
    senderType: "user" | "club";
    body: string;
    isMutedDelivery: boolean;
    createdAt: string;
    senderUsername?: string;
    senderFirstName?: string;
    senderAvatarUrl?: string;
}

export default function ClubInboxModal({
    isOpen,
    onClose,
    clubId: _clubId,
    clubName,
    onUnreadCountChange,
}: ClubInboxModalProps) {
    const toast = useToast();

    // Inbox state
    const [activeTab, setActiveTab] = useState<"inbox" | "muted" | "archived">("inbox");
    const [searchQuery, setSearchQuery] = useState("");
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [selectedConvDetails, setSelectedConvDetails] = useState<any>(null);

    // Loading states
    const [loadingList, setLoadingList] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sendingReply, setSendingReply] = useState(false);
    const [replyBody, setReplyBody] = useState("");

    // Moderation Modal state
    const [blockConfirmUser, setBlockConfirmUser] = useState<{ id: string; username: string; name: string } | null>(null);
    const [blockReason, setBlockReason] = useState("");
    const [isExecutingModeration, setIsExecutingModeration] = useState(false);

    // Multi-selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        conv: ConversationSummary;
    } | null>(null);

    // Close context menu on outside click or escape
    useEffect(() => {
        if (!contextMenu) return;
        const handleClose = () => setContextMenu(null);
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setContextMenu(null);
        };
        window.addEventListener("click", handleClose);
        window.addEventListener("contextmenu", handleClose);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("click", handleClose);
            window.removeEventListener("contextmenu", handleClose);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [contextMenu]);

    // Fetch conversation list
    const fetchConversations = async (tab = activeTab) => {
        try {
            setLoadingList(true);
            const res = await fetch(`/api/club/inbox?filter=${tab}`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => null);
            if (data?.success && Array.isArray(data.conversations)) {
                setConversations(data.conversations);
                // Update parent unread count
                const unread = data.conversations.filter((c: ConversationSummary) => !c.isReadByClub && !c.isMuted).length;
                if (onUnreadCountChange) onUnreadCountChange(unread);
            }
        } catch (err) {
            console.error("Fetch inbox error:", err);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchConversations(activeTab);
        }
    }, [isOpen, activeTab]);

    // Load active conversation messages
    const loadConversation = async (convId: string) => {
        setSelectedConvId(convId);
        setLoadingMessages(true);
        try {
            const res = await fetch(`/api/club/inbox/${convId}/messages`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => null);
            if (data?.success) {
                setMessages(data.messages || []);
                setSelectedConvDetails(data.conversation || null);

                // Update local list unread state
                setConversations((prev) =>
                    prev.map((c) => (c.id === convId ? { ...c, isReadByClub: true } : c))
                );
            }
        } catch (err) {
            console.error("Load conversation error:", err);
        } finally {
            setLoadingMessages(false);
        }
    };

    // Filter conversations by search
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            (c) =>
                c.username?.toLowerCase().includes(q) ||
                c.firstName?.toLowerCase().includes(q) ||
                c.lastName?.toLowerCase().includes(q) ||
                c.subject?.toLowerCase().includes(q) ||
                c.lastMessagePreview?.toLowerCase().includes(q)
        );
    }, [conversations, searchQuery]);

    // Send reply
    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedConvId || !replyBody.trim()) return;

        setSendingReply(true);
        try {
            const res = await fetch(`/api/club/inbox/${selectedConvId}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ body: replyBody.trim() }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to post reply.");

            setReplyBody("");
            toast.success("Reply dispatched to applicant.");
            loadConversation(selectedConvId);
            fetchConversations(activeTab);
        } catch (err: any) {
            toast.error(err.message || "Failed to post reply.", { title: "Error" });
        } finally {
            setSendingReply(false);
        }
    };

    // Toggle Mute
    const handleToggleMute = async (userId: string, currentlyMuted: boolean) => {
        const endpoint = currentlyMuted ? "/api/club/moderation/unmute" : "/api/club/moderation/mute";
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to update mute state.");

            toast.info(currentlyMuted ? "User unmuted for this club." : "User muted. Future messages filtered to Muted tab.");
            if (selectedConvId) loadConversation(selectedConvId);
            fetchConversations(activeTab);
        } catch (err: any) {
            toast.error(err.message || "Failed to update mute state.", { title: "Error" });
        }
    };

    // Execute Block
    const handleExecuteBlock = async () => {
        if (!blockConfirmUser) return;
        setIsExecutingModeration(true);
        try {
            const res = await fetch("/api/club/moderation/block", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    userId: blockConfirmUser.id,
                    reason: blockReason || "Violated community or club guidelines.",
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to block user.");

            toast.warning(`@${blockConfirmUser.username} is now blocked from messaging, event RSVP, and club access.`);
            setBlockConfirmUser(null);
            setBlockReason("");
            if (selectedConvId) loadConversation(selectedConvId);
            fetchConversations(activeTab);
        } catch (err: any) {
            toast.error(err.message || "Failed to block user.", { title: "Error" });
        } finally {
            setIsExecutingModeration(false);
        }
    };

    // Unblock User
    const handleUnblock = async (userId: string, username: string) => {
        try {
            const res = await fetch("/api/club/moderation/unblock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to unblock user.");

            toast.success(`@${username} has been unblocked.`);
            if (selectedConvId) loadConversation(selectedConvId);
            fetchConversations(activeTab);
        } catch (err: any) {
            toast.error(err.message || "Failed to unblock user.", { title: "Error" });
        }
    };

    // Toggle Archive
    const handleToggleArchive = async (convId: string, currentStatus: string) => {
        const isArchiving = currentStatus !== "archived";
        try {
            const res = await fetch(`/api/club/inbox/${convId}/archive`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ isArchived: isArchiving }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.message || "Failed to update archive state.");

            toast.info(isArchiving ? "Conversation archived." : "Conversation restored to inbox.");
            fetchConversations(activeTab);
            if (selectedConvId === convId) setSelectedConvId(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to update archive state.", { title: "Error" });
        }
    };

    // Right click context menu handler
    const handleContextMenu = (e: React.MouseEvent, conv: ConversationSummary) => {
        e.preventDefault();
        e.stopPropagation();
        const menuWidth = 200;
        const menuHeight = 160;
        const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
        const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
        setContextMenu({ x: Math.max(10, x), y: Math.max(10, y), conv });
    };

    // Toggle Read / Unread for single conversation
    const handleToggleReadSingle = async (conv: ConversationSummary) => {
        setContextMenu(null);
        const newReadState = !conv.isReadByClub;
        setConversations((prev) =>
            prev.map((c) => (c.id === conv.id ? { ...c, isReadByClub: newReadState } : c))
        );
        try {
            await fetch(`/api/club/inbox/${conv.id}/read`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ isRead: newReadState }),
            });
            toast.info(newReadState ? "Marked as read." : "Marked as unread.");
            const unread = conversations
                .map((c) => (c.id === conv.id ? { ...c, isReadByClub: newReadState } : c))
                .filter((c) => !c.isReadByClub && !c.isMuted).length;
            if (onUnreadCountChange) onUnreadCountChange(unread);
        } catch {
            toast.error("Failed to update status.");
        }
    };

    // Delete single conversation from context menu
    const handleDeleteSingle = async (conv: ConversationSummary) => {
        setContextMenu(null);
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (selectedConvId === conv.id) {
            setSelectedConvId(null);
            setSelectedConvDetails(null);
            setMessages([]);
        }
        try {
            const res = await fetch(`/api/club/inbox/${conv.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed");
            toast.info("Conversation deleted.");
            const unread = conversations
                .filter((c) => c.id !== conv.id)
                .filter((c) => !c.isReadByClub && !c.isMuted).length;
            if (onUnreadCountChange) onUnreadCountChange(unread);
        } catch {
            toast.error("Failed to delete conversation.");
            fetchConversations(activeTab);
        }
    };

    // Enter multi-select mode starting with this conversation
    const handleStartSelectWithConv = (conv: ConversationSummary) => {
        setContextMenu(null);
        setIsSelectionMode(true);
        setSelectedConvIds(new Set([conv.id]));
    };

    // Toggle multi-select of a conversation
    const handleToggleSelectConv = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedConvIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select All / Deselect All visible conversations
    const handleToggleSelectAll = (visibleIds: string[]) => {
        const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedConvIds.has(id));
        if (isAllSelected) {
            setSelectedConvIds(new Set());
        } else {
            setSelectedConvIds(new Set(visibleIds));
        }
    };

    // Bulk Mark as Read / Unread
    const handleBulkMarkRead = async (isRead: boolean) => {
        if (selectedConvIds.size === 0) return;
        const ids = Array.from(selectedConvIds);
        setConversations((prev) =>
            prev.map((c) => (selectedConvIds.has(c.id) ? { ...c, isReadByClub: isRead } : c))
        );
        try {
            await fetch("/api/club/inbox/bulk-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ conversationIds: ids, isRead }),
            });
            toast.info(isRead ? `${ids.length} marked as read.` : `${ids.length} marked as unread.`);
            const unread = conversations
                .map((c) => (selectedConvIds.has(c.id) ? { ...c, isReadByClub: isRead } : c))
                .filter((c) => !c.isReadByClub && !c.isMuted).length;
            if (onUnreadCountChange) onUnreadCountChange(unread);
        } catch {
            toast.error("Failed to update conversations.");
        }
    };

    // Bulk Delete
    const handleBulkDelete = async () => {
        if (selectedConvIds.size === 0) return;
        const ids = Array.from(selectedConvIds);
        setIsBulkDeleting(true);
        try {
            setConversations((prev) => prev.filter((c) => !selectedConvIds.has(c.id)));
            if (selectedConvId && selectedConvIds.has(selectedConvId)) {
                setSelectedConvId(null);
                setSelectedConvDetails(null);
                setMessages([]);
            }
            await fetch("/api/club/inbox/bulk-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ conversationIds: ids }),
            });
            toast.success(`${ids.length} inquiry/inquiries deleted.`);
            setSelectedConvIds(new Set());
            setIsSelectionMode(false);
            const unread = conversations
                .filter((c) => !selectedConvIds.has(c.id))
                .filter((c) => !c.isReadByClub && !c.isMuted).length;
            if (onUnreadCountChange) onUnreadCountChange(unread);
        } catch {
            toast.error("Failed to delete conversations.");
            fetchConversations(activeTab);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const { handleBackdropClick } = useModalDismiss({
        isOpen: isOpen && !blockConfirmUser,
        onClose,
    });

    const { handleBackdropClick: handleBlockBackdropClick } = useModalDismiss({
        isOpen: Boolean(blockConfirmUser),
        onClose: () => setBlockConfirmUser(null),
    });

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs select-none"
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-5xl h-[88vh] bg-[#FAF6EE] border-2 border-black rounded-3xl shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top Action Header */}
                <div className="p-4 sm:px-6 bg-white border-b-2 border-black flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center text-white border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Inbox className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black text-black tracking-tight">{clubName} Inbox</h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
                                    Direct Inquiries
                                </span>
                            </div>
                            <span className="text-xs font-bold text-neutral-500">
                                Messages from authenticated platform students & developers
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl border-2 border-black hover:bg-neutral-100 cursor-pointer shadow-[2px_2px_0px_#000] flex items-center gap-1.5 text-xs font-black"
                    >
                        <X className="w-4 h-4 text-black" />
                        <span className="hidden sm:inline">Close</span>
                    </button>
                </div>

                {/* Subheader: Filter Tabs & Search Bar */}
                <div className="px-4 sm:px-6 py-3 bg-[#FAF6EE] border-b-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("inbox");
                                setSelectedConvId(null);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                activeTab === "inbox"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            Active Inbox
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("muted");
                                setSelectedConvId(null);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "muted"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>Muted / Filtered</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab("archived");
                                setSelectedConvId(null);
                            }}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "archived"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Archived</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative max-w-xs w-full">
                            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search sender, subject..."
                                className="w-full pl-9 pr-3 py-1.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                if (isSelectionMode) setSelectedConvIds(new Set());
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                isSelectionMode
                                    ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-black hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span className="hidden xs:inline">{isSelectionMode ? "Cancel" : "Select"}</span>
                        </button>
                    </div>
                </div>

                {/* Main Split-Pane Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Pane: Conversation List */}
                    <div
                        className={`w-full lg:w-96 border-r-2 border-black bg-white flex flex-col overflow-y-auto ${
                            selectedConvId ? "hidden lg:flex" : "flex"
                        }`}
                    >
                        {/* Multi-Select Action Toolbar */}
                        {isSelectionMode && (
                            <div className="p-3 bg-amber-50 border-b-2 border-black flex items-center justify-between gap-2 flex-wrap shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleSelectAll(filteredConversations.map((c) => c.id))}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>
                                            {filteredConversations.length > 0 && filteredConversations.every((c) => selectedConvIds.has(c.id))
                                                ? "Deselect All"
                                                : "Select All"}
                                        </span>
                                    </button>
                                    <span className="text-xs font-black text-black">
                                        {selectedConvIds.size} selected
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => handleBulkMarkRead(true)}
                                        disabled={selectedConvIds.size === 0}
                                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] disabled:opacity-50 cursor-pointer"
                                    >
                                        Mark Read
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleBulkMarkRead(false)}
                                        disabled={selectedConvIds.size === 0}
                                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] disabled:opacity-50 cursor-pointer"
                                    >
                                        Mark Unread
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBulkDelete}
                                        disabled={selectedConvIds.size === 0 || isBulkDeleting}
                                        className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Delete</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSelectionMode(false);
                                            setSelectedConvIds(new Set());
                                        }}
                                        className="px-2.5 py-1 rounded-xl bg-black text-white border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}

                        {loadingList ? (
                            <div className="p-8 flex items-center justify-center text-black">
                                <OrbixLoader size="sm" />
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="p-8 text-center space-y-3 my-auto">
                                <div className="w-12 h-12 rounded-2xl bg-neutral-100 border-2 border-black mx-auto flex items-center justify-center text-neutral-400">
                                    <Inbox className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-black">
                                        {activeTab === "muted"
                                            ? "No muted conversations"
                                            : activeTab === "archived"
                                            ? "No archived conversations"
                                            : "Inbox Zero"}
                                    </p>
                                    <p className="text-[11px] font-medium text-neutral-500 max-w-[200px] mx-auto">
                                        {activeTab === "muted"
                                            ? "Inquiries from muted users will appear filtered here."
                                            : "When platform developers contact your club, their messages will arrive here."}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y-2 divide-black/10">
                                {filteredConversations.map((conv) => {
                                    const isSelected = selectedConvId === conv.id;
                                    const displayName =
                                        conv.firstName
                                            ? `${conv.firstName} ${conv.lastName || ""}`.trim()
                                            : conv.username || "Developer";

                                    return (
                                        <button
                                            key={conv.id}
                                            type="button"
                                            onClick={() => {
                                                if (isSelectionMode) {
                                                    handleToggleSelectConv(conv.id);
                                                } else {
                                                    loadConversation(conv.id);
                                                }
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, conv)}
                                            className={`w-full p-4 text-left transition-colors cursor-pointer flex items-start gap-3 relative ${
                                                isSelectionMode && selectedConvIds.has(conv.id)
                                                    ? "bg-amber-100/80"
                                                    : isSelected
                                                    ? "bg-[#FFE566] text-black"
                                                    : !conv.isReadByClub
                                                    ? "bg-amber-50/70 hover:bg-neutral-100"
                                                    : "hover:bg-neutral-50"
                                            }`}
                                        >
                                            {/* Checkbox in selection mode */}
                                            {isSelectionMode && (
                                                <div
                                                    onClick={(e) => handleToggleSelectConv(conv.id, e)}
                                                    className={`w-5 h-5 rounded-lg border-2 border-black flex items-center justify-center shrink-0 self-center transition-colors cursor-pointer ${
                                                        selectedConvIds.has(conv.id)
                                                            ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                                            : "bg-white hover:bg-neutral-100"
                                                    }`}
                                                >
                                                    {selectedConvIds.has(conv.id) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                </div>
                                            )}

                                            {/* Unread dot */}
                                            {!conv.isReadByClub && !isSelected && !isSelectionMode && (
                                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-black absolute top-4 right-4" />
                                            )}

                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-2xl border-2 border-black bg-emerald-200 overflow-hidden shrink-0 font-black text-xs flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]">
                                                {conv.avatarUrl ? (
                                                    <img src={conv.avatarUrl} alt={conv.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    conv.username?.slice(0, 2).toUpperCase() || "DV"
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0 pr-1">
                                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                                    <span className="font-black text-xs truncate text-black">
                                                        {displayName}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-[10px] font-bold text-neutral-500">
                                                            {new Date(conv.lastMessageAt).toLocaleDateString(undefined, {
                                                                month: "short",
                                                                day: "numeric",
                                                            })}
                                                        </span>
                                                        {!isSelectionMode && (
                                                            <span
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={(e) => handleContextMenu(e, conv)}
                                                                className="p-1 rounded-lg hover:bg-black/10 transition-colors text-neutral-600 hover:text-black cursor-pointer inline-flex items-center justify-center"
                                                                title="Options"
                                                            >
                                                                <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className="text-[10px] font-bold text-neutral-600 truncate">
                                                        @{conv.username}
                                                    </span>
                                                    <span className="px-1.5 py-0.2 rounded-md bg-white border border-black text-[9px] font-black uppercase text-neutral-700">
                                                        {conv.subject}
                                                    </span>
                                                    {conv.isMuted && (
                                                        <span className="px-1.5 py-0.2 rounded-md bg-neutral-200 border border-black text-[9px] font-black text-neutral-800">
                                                            Muted
                                                        </span>
                                                    )}
                                                    {conv.isBlocked && (
                                                        <span className="px-1.5 py-0.2 rounded-md bg-rose-200 border border-black text-[9px] font-black text-rose-900">
                                                            Blocked
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-neutral-700 font-medium truncate">
                                                    {conv.lastMessagePreview || "No preview"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Pane: Selected Conversation Thread */}
                    <div className={`flex-1 flex flex-col bg-[#FAF6EE] ${!selectedConvId ? "hidden lg:flex" : "flex"}`}>
                        {!selectedConvId ? (
                            <div className="my-auto text-center p-8 space-y-3">
                                <div className="w-14 h-14 rounded-3xl bg-white border-2 border-black mx-auto flex items-center justify-center text-neutral-400 shadow-[4px_4px_0px_#000]">
                                    <Mail className="w-7 h-7 text-black" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-black text-sm text-black">Select an Inquiry</h3>
                                    <p className="text-xs font-medium text-neutral-500 max-w-xs mx-auto">
                                        Choose an inquiry on the left to read messages, send replies, or manage sender permissions.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Conversation Header */}
                                {selectedConvDetails && (
                                    <div className="p-4 bg-white border-b-2 border-black flex items-center justify-between gap-3 shrink-0">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedConvId(null)}
                                                className="lg:hidden px-2.5 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 flex items-center gap-1.5 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                            >
                                                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                                                <span>Back</span>
                                            </button>

                                            <div className="w-10 h-10 rounded-2xl border-2 border-black bg-emerald-200 overflow-hidden font-black text-xs flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]">
                                                {selectedConvDetails.avatarUrl ? (
                                                    <img src={selectedConvDetails.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    selectedConvDetails.username?.slice(0, 2).toUpperCase()
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-xs text-black">
                                                        {selectedConvDetails.firstName
                                                            ? `${selectedConvDetails.firstName} ${selectedConvDetails.lastName || ""}`
                                                            : selectedConvDetails.username}
                                                    </span>
                                                    <Link
                                                        to={`/profile/${selectedConvDetails.username}`}
                                                        target="_blank"
                                                        className="text-[10px] font-bold text-neutral-500 hover:text-black flex items-center gap-0.5"
                                                    >
                                                        <span>@{selectedConvDetails.username}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                                <span className="text-[10px] font-bold text-neutral-500 block">
                                                    Topic: <span className="text-black font-black">{selectedConvDetails.subject}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Moderation Controls */}
                                        <div className="flex items-center gap-2">
                                            {/* Mute/Unmute */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleMute(selectedConvDetails.userId, selectedConvDetails.isMuted)}
                                                className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer ${
                                                    selectedConvDetails.isMuted
                                                        ? "bg-amber-300 text-black hover:bg-amber-400"
                                                        : "bg-white hover:bg-neutral-100 text-neutral-800"
                                                }`}
                                                title={selectedConvDetails.isMuted ? "Unmute user" : "Mute notifications from user"}
                                            >
                                                {selectedConvDetails.isMuted ? (
                                                    <>
                                                        <Volume2 className="w-3.5 h-3.5" />
                                                        <span>Unmute</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <VolumeX className="w-3.5 h-3.5" />
                                                        <span>Mute</span>
                                                    </>
                                                )}
                                            </button>

                                            {/* Block/Unblock */}
                                            {selectedConvDetails.isBlocked ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnblock(selectedConvDetails.userId, selectedConvDetails.username)}
                                                    className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer text-emerald-700"
                                                >
                                                    <UserCheck className="w-3.5 h-3.5" />
                                                    <span>Unblock</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setBlockConfirmUser({
                                                            id: selectedConvDetails.userId,
                                                            username: selectedConvDetails.username,
                                                            name: selectedConvDetails.firstName
                                                                ? `${selectedConvDetails.firstName} ${selectedConvDetails.lastName || ""}`
                                                                : selectedConvDetails.username,
                                                        })
                                                    }
                                                    className="px-3 py-1.5 rounded-xl border-2 border-black bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Ban className="w-3.5 h-3.5 text-rose-700" />
                                                    <span>Block</span>
                                                </button>
                                            )}

                                            {/* Archive */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleArchive(selectedConvDetails.id, selectedConvDetails.status)}
                                                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-neutral-700 shadow-[2px_2px_0px_#000] cursor-pointer"
                                                title={selectedConvDetails.status === "archived" ? "Restore to inbox" : "Archive inquiry"}
                                            >
                                                {selectedConvDetails.status === "archived" ? (
                                                    <RotateCcw className="w-4 h-4" />
                                                ) : (
                                                    <Archive className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Message History */}
                                <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
                                    {loadingMessages ? (
                                        <div className="p-8 flex items-center justify-center text-black">
                                            <OrbixLoader size="sm" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div className="text-center py-8 text-xs font-bold text-neutral-500">
                                            No messages found in this inquiry.
                                        </div>
                                    ) : (
                                        messages.map((msg) => {
                                            const isClub = msg.senderType === "club";
                                            return (
                                                <div
                                                    key={msg.id}
                                                    className={`flex flex-col max-w-xl ${
                                                        isClub ? "ml-auto items-end" : "mr-auto items-start"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                            {isClub ? `${clubName} (You)` : msg.senderUsername || "Sender"}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-neutral-400">
                                                            {new Date(msg.createdAt).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>

                                                    <div
                                                        className={`p-4 rounded-2xl border-2 border-black text-xs font-medium whitespace-pre-wrap leading-relaxed shadow-[3px_3px_0px_#000] ${
                                                            isClub
                                                                ? "bg-[#FFE566] text-black"
                                                                : "bg-white text-neutral-900"
                                                        }`}
                                                    >
                                                        {msg.body}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Reply Composer */}
                                <form onSubmit={handleSendReply} className="p-4 bg-white border-t-2 border-black flex gap-2.5">
                                    <textarea
                                        value={replyBody}
                                        onChange={(e) => setReplyBody(e.target.value)}
                                        placeholder={`Reply as ${clubName} leadership...`}
                                        rows={2}
                                        maxLength={5000}
                                        required
                                        className="flex-1 px-3.5 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-medium placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black shadow-[2px_2px_0px_#000] resize-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sendingReply || !replyBody.trim()}
                                        className="px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-2 cursor-pointer self-end transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        {sendingReply ? <OrbixLoader size="xs" variant="inline" color="currentColor" /> : <Send className="w-4 h-4" />}
                                        <span className="hidden sm:inline">Reply</span>
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Context Menu Popup */}
            {contextMenu && (
                <div
                    className="fixed z-[999] bg-[#FAF6EE] border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] p-1.5 min-w-[190px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => handleToggleReadSingle(contextMenu.conv)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                    >
                        {contextMenu.conv.isReadByClub ? (
                            <>
                                <Mail className="w-4 h-4 stroke-[2.5] text-amber-600" />
                                <span>Mark as Unread</span>
                            </>
                        ) : (
                            <>
                                <MailOpen className="w-4 h-4 stroke-[2.5] text-emerald-600" />
                                <span>Mark as Read</span>
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleStartSelectWithConv(contextMenu.conv)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                    >
                        <CheckSquare className="w-4 h-4 stroke-[2.5] text-sky-600" />
                        <span>Select Message</span>
                    </button>
                    <div className="my-1 border-t-2 border-black/10" />
                    <button
                        type="button"
                        onClick={() => handleDeleteSingle(contextMenu.conv)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                        <Trash2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Delete</span>
                    </button>
                </div>
            )}

            {/* Block Confirmation Modal */}
            {blockConfirmUser && (
                <div
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none"
                    onClick={handleBlockBackdropClick}
                >
                    <div
                        className="w-full max-w-md bg-[#FAF6EE] border-2 border-black rounded-3xl p-6 shadow-[8px_8px_0px_#000] space-y-4 animate-in fade-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-2xl bg-rose-100 border-2 border-black flex items-center justify-center text-rose-700 shadow-[2px_2px_0px_#000]">
                            <AlertTriangle className="w-6 h-6" />
                        </div>

                        <div>
                            <h3 className="font-black text-base text-black">
                                Block @{blockConfirmUser.username} from this club?
                            </h3>
                            <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                Blocking is enforced on the server. The user will lose the ability to message your club, view protected club details, and register for or attend your club events.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                Moderation Reason (Internal Audit)
                            </label>
                            <input
                                type="text"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="e.g. Inappropriate spam or behavioral violation"
                                className="w-full px-3 py-2 rounded-xl border-2 border-black bg-white text-xs font-bold text-black focus:outline-none shadow-[2px_2px_0px_#000]"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setBlockConfirmUser(null)}
                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isExecutingModeration}
                                onClick={handleExecuteBlock}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                            >
                                {isExecutingModeration ? <OrbixLoader size="xs" variant="inline" color="currentColor" /> : <Ban className="w-3.5 h-3.5" />}
                                <span>Confirm Block</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
}
