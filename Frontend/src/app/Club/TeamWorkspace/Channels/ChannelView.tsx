// Frontend/src/app/Club/TeamWorkspace/Channels/ChannelView.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Hash,
    Volume2,
    MessageSquare,
    CheckSquare,
    Lock,
    Pin,
    Smile,
    Paperclip,
    Send,
    Search,
    Edit3,
    Trash2,
    MessageCircle,
    Check,
    AlertCircle,
    X,
    CornerUpLeft,
    Clock,
    User,
    Shield,
    Building2,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceChannel,
    WorkspaceMessage,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceThread,
    WorkspaceFile,
} from "../../../../types/workspace";
import { FileUploadZone } from "../Files/FileUploadZone";
import { AttachmentList } from "../Files/AttachmentList";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

interface ChannelViewProps {
    channel: WorkspaceChannel;
    clubId: string;
    clubName?: string;
    clubLogoUrl?: string | null;
    isClubContext?: boolean;
    currentMember: WorkspaceMember | null;
    canManageChannels: boolean;
    members?: WorkspaceMember[];
    roles?: WorkspaceRole[];
    onOpenThread: (thread: WorkspaceThread) => void;
    onChannelUpdated?: (channel: WorkspaceChannel) => void;
}

const COMMON_EMOJIS = ["👍", "❤️", "🔥", "🎉", "🚀", "👀", "💡", "👏"];

export const ChannelView: React.FC<ChannelViewProps> = ({
    channel,
    clubId,
    clubName,
    clubLogoUrl,
    isClubContext = false,
    currentMember,
    canManageChannels,
    members = [],
    roles = [],
    onOpenThread,
    onChannelUpdated,
}) => {
    const toast = useToast();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Data states
    const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const [showAttachmentZone, setShowAttachmentZone] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<WorkspaceFile[]>([]);

    // In-channel Quote / Reply state
    const [replyingTo, setReplyingTo] = useState<WorkspaceMessage | null>(null);

    // Mention autocomplete state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);

    // Slowmode cooldown countdown (in seconds)
    const [slowmodeTimer, setSlowmodeTimer] = useState<number>(0);

    // Editing message
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");

    // Pinned messages panel
    const [showPinned, setShowPinned] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // Delete message confirmation modal state
    const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);
    const [searchResults, setSearchResults] = useState<WorkspaceMessage[]>([]);

    // Emoji picker popover state: messageId -> boolean
    const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<string | null>(null);

    // Thread creation modal state
    const [threadModalMsg, setThreadModalMsg] = useState<WorkspaceMessage | null>(null);
    const [threadName, setThreadName] = useState("");
    const [creatingThread, setCreatingThread] = useState(false);

    // Syncing state
    const [syncing, setSyncing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Slowmode timer countdown
    useEffect(() => {
        if (slowmodeTimer <= 0) return;
        const interval = setInterval(() => {
            setSlowmodeTimer((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [slowmodeTimer]);

    // Live Real-Time Message and Reaction Sync
    useEffect(() => {
        const handleRealtime = (e: any) => {
            const data = e.detail;
            if (!data || !data.payload) return;

            const targetChannelId = data.payload.channelId || data.payload.channel?.id;
            if (targetChannelId !== channel.id) return;

            if (data.event === "message:new") {
                const newMsg = data.payload.message;
                if (newMsg && !newMsg.threadId) {
                    setMessages((prev) => {
                        if (prev.some((m) => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                }
            } else if (data.event === "message:updated") {
                const updatedMsg = data.payload.message;
                if (updatedMsg) {
                    setMessages((prev) =>
                        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
                    );
                }
            } else if (data.event === "message:deleted") {
                const deletedId = data.payload.messageId;
                if (deletedId) {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === deletedId
                                ? { ...m, isDeleted: true, content: "This message was deleted." }
                                : m
                        )
                    );
                }
            } else if (data.event === "message:pinned") {
                const { messageId, isPinned } = data.payload;
                setMessages((prev) =>
                    prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m))
                );
            } else if (data.event === "reaction:added" || data.event === "reaction:removed") {
                fetchMessages();
            }
        };

        window.addEventListener("workspace:realtime", handleRealtime);
        return () => window.removeEventListener("workspace:realtime", handleRealtime);
    }, [channel.id]);

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getMessages(channel.id, {
                clubId,
                limit: 50,
            });
            if (res.success && res.messages) {
                // Reverse to chronological order (oldest to newest)
                setMessages([...res.messages].reverse());
            }

            // Mark channel as read
            await workspaceApi.markChannelRead(channel.id, null, clubId);
        } catch (err: any) {
            console.error("Failed to load channel messages:", err);
            toast.error(err.message || "Failed to load messages.");
        } finally {
            setLoading(false);
        }
    }, [channel.id, clubId, toast]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // Filter matching mentions for autocomplete
    const matchingMentions = React.useMemo(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.toLowerCase();
        const results: Array<{
            type: "member" | "role";
            tag: string;
            label: string;
            sub?: string;
        }> = [];

        // Roles
        (roles || []).forEach((r) => {
            if (r.name.toLowerCase().includes(q)) {
                results.push({
                    type: "role",
                    tag: r.name.toLowerCase().replace(/\s+/g, "-"),
                    label: r.name,
                    sub: "Role Mention",
                });
            }
        });

        // Members
        (members || []).forEach((m) => {
            const u = m.user;
            if (!u) return;
            const full = `${u.firstName || ""} ${u.lastName || ""}`.trim();
            if (
                u.username.toLowerCase().includes(q) ||
                full.toLowerCase().includes(q)
            ) {
                results.push({
                    type: "member",
                    tag: u.username,
                    label: full || u.username,
                    sub: `@${u.username}`,
                });
            }
        });

        return results.slice(0, 5);
    }, [mentionQuery, members, roles]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);
        const cursor = e.target.selectionStart;
        const textBefore = val.slice(0, cursor);
        const match = textBefore.match(/@([a-zA-Z0-9_]*)$/);
        if (match) {
            setMentionQuery(match[1]);
        } else {
            setMentionQuery(null);
        }
    };

    const handleApplyMention = (tag: string) => {
        if (!textareaRef.current) return;
        const cursor = textareaRef.current.selectionStart;
        const textBefore = content.slice(0, cursor);
        const textAfter = content.slice(cursor);
        const replaced = textBefore.replace(/@([a-zA-Z0-9_]*)$/, `@${tag} `);
        setContent(replaced + textAfter);
        setMentionQuery(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    // Render formatted content (quotes, mentions)
    const renderFormattedContent = (rawText: string) => {
        if (!rawText) return null;
        if (rawText.startsWith("> ")) {
            const lines = rawText.split("\n");
            const quoteLines: string[] = [];
            const normalLines: string[] = [];
            let inQuote = true;
            for (const l of lines) {
                if (inQuote && l.startsWith("> ")) {
                    quoteLines.push(l.slice(2));
                } else {
                    inQuote = false;
                    normalLines.push(l);
                }
            }
            return (
                <div>
                    <div className="border-l-4 border-black pl-2.5 py-1 text-xs text-neutral-700 bg-black/5 rounded-r mb-1.5 italic font-medium">
                        {quoteLines.join("\n")}
                    </div>
                    <div>{renderFormattedContent(normalLines.join("\n"))}</div>
                </div>
            );
        }

        const parts = rawText.split(/(@[a-zA-Z0-9_-]+)/g);
        return parts.map((part, idx) => {
            if (part.startsWith("@")) {
                return (
                    <span
                        key={idx}
                        className="inline-block px-1.5 py-0.2 mx-0.5 text-xs font-black bg-[#FFE566] text-black border border-black rounded shadow-neo-xxs"
                    >
                        {part}
                    </span>
                );
            }
            return part;
        });
    };

    // Send message
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (slowmodeTimer > 0 && !canManageChannels) {
            toast.error(`Slowmode is active. Wait ${slowmodeTimer}s before sending again.`);
            return;
        }

        const trimmed = content.trim();
        if ((!trimmed && pendingAttachments.length === 0) || sending) return;

        try {
            setSending(true);

            let finalContent = trimmed;
            if (replyingTo) {
                const quoteSnippet = replyingTo.content.slice(0, 80).replace(/\n/g, " ");
                const senderName = replyingTo.sender?.username || "user";
                finalContent = `> @${senderName}: ${quoteSnippet}\n\n${trimmed}`;
            }

            const res = await workspaceApi.sendMessage(
                channel.id,
                {
                    content: finalContent || (pendingAttachments.length > 0 ? "Shared attachment(s)" : ""),
                    messageType: channel.channelType === "announcement" ? "announcement" : "text",
                    parentMessageId: replyingTo ? replyingTo.id : null,
                    attachments: pendingAttachments.map((f) => ({
                        fileName: f.fileName,
                        fileSizeBytes: f.fileSizeBytes,
                        mimeType: f.mimeType,
                        cloudinaryUrl: f.cloudinaryUrl,
                        cloudinarySecureUrl: f.cloudinarySecureUrl,
                        cloudinaryPublicId: f.cloudinaryPublicId,
                    })),
                },
                clubId
            );

            if (res.success && res.message) {
                setContent("");
                setReplyingTo(null);
                setPendingAttachments([]);
                setShowAttachmentZone(false);
                setMessages((prev) => {
                    if (prev.some((m) => m.id === res.message.id)) return prev;
                    return [...prev, res.message];
                });

                // Apply slowmode cooldown if configured
                if (channel.defaultSlowmodeSeconds && channel.defaultSlowmodeSeconds > 0 && !canManageChannels) {
                    setSlowmodeTimer(channel.defaultSlowmodeSeconds);
                }
            }
        } catch (err: any) {
            console.error("Failed to send message:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to send message.");
        } finally {
            setSending(false);
        }
    };

    // Edit message
    const handleSaveEdit = async (messageId: string) => {
        if (!editContent.trim()) return;
        try {
            const res = await workspaceApi.editMessage(messageId, editContent.trim(), clubId);
            if (res.success && res.message) {
                setMessages((prev) =>
                    prev.map((m) => (m.id === messageId ? res.message : m))
                );
                setEditingMessageId(null);
                setEditContent("");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to edit message.");
        }
    };

    // Delete message
    const handleDeleteMessage = (messageId: string) => {
        setMessageToDelete(messageId);
    };

    const confirmDeleteMessage = async () => {
        if (!messageToDelete) return;
        try {
            setIsDeletingMessage(true);
            const res = await workspaceApi.deleteMessage(messageToDelete, clubId);
            if (res.success) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === messageToDelete
                            ? { ...m, isDeleted: true, content: "This message was deleted." }
                            : m
                    )
                );
                setMessageToDelete(null);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete message.");
        } finally {
            setIsDeletingMessage(false);
        }
    };

    // Toggle reaction
    const handleToggleReaction = async (messageId: string, emoji: string) => {
        try {
            const res = await workspaceApi.toggleReaction(channel.id, messageId, emoji, clubId);
            if (res.success) {
                setMessages((prev) =>
                    prev.map((m) => {
                        if (m.id !== messageId) return m;
                        const existing = m.reactions || [];
                        const found = existing.find((r) => r.emoji === emoji);
                        const currentUserId = currentMember?.userId || "me";
                        let updated;
                        if (res.added) {
                            if (found) {
                                updated = existing.map((r) =>
                                    r.emoji === emoji
                                        ? {
                                              ...r,
                                              count: r.count + 1,
                                              hasReacted: true,
                                              users: r.users?.includes(currentUserId) ? r.users : [...(r.users || []), currentUserId],
                                          }
                                        : r
                                );
                            } else {
                                updated = [
                                    ...existing,
                                    { emoji, count: 1, hasReacted: true, users: [currentUserId] },
                                ];
                            }
                        } else {
                            if (found && found.count > 1) {
                                updated = existing.map((r) =>
                                    r.emoji === emoji
                                        ? {
                                              ...r,
                                              count: r.count - 1,
                                              hasReacted: false,
                                              users: (r.users || []).filter((u) => u !== currentUserId),
                                          }
                                        : r
                                );
                            } else {
                                updated = existing.filter((r) => r.emoji !== emoji);
                            }
                        }
                        return { ...m, reactions: updated };
                    })
                );
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to react.");
        } finally {
            setActiveEmojiPickerMsgId(null);
        }
    };

    // Toggle pin
    const handleTogglePin = async (message: WorkspaceMessage) => {
        try {
            const nextPinned = !message.isPinned;
            const res = await workspaceApi.togglePinMessage(channel.id, message.id, nextPinned, clubId);
            if (res.success) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === message.id ? { ...m, isPinned: nextPinned } : m
                    )
                );
                toast.success(nextPinned ? "Message pinned!" : "Message unpinned.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update pin.");
        }
    };

    // Create thread from message
    const handleCreateThread = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!threadModalMsg || !threadName.trim()) return;

        try {
            setCreatingThread(true);
            const res = await workspaceApi.createThread(
                channel.id,
                {
                    parentMessageId: threadModalMsg.id,
                    name: threadName.trim(),
                },
                clubId
            );

            if (res.success && res.thread) {
                toast.success(`Thread "${res.thread.name}" created!`);
                setThreadModalMsg(null);
                setThreadName("");
                onOpenThread(res.thread);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to create thread.");
        } finally {
            setCreatingThread(false);
        }
    };

    // Sync now with category
    const handleSyncWithCategory = async () => {
        try {
            setSyncing(true);
            const res = await workspaceApi.syncChannelWithCategory(channel.id, clubId);
            if (res.success) {
                toast.success("Channel permissions synchronized with category!");
                if (onChannelUpdated) {
                    onChannelUpdated({ ...channel, isCategorySynced: true });
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to sync permissions.");
        } finally {
            setSyncing(false);
        }
    };

    // Search messages
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        try {
            setIsSearching(true);
            const res = await workspaceApi.searchMessages(searchQuery.trim(), clubId);
            if (res.success && res.messages) {
                setSearchResults(res.messages.filter((m) => m.channelId === channel.id));
            }
        } catch (err: any) {
            toast.error(err.message || "Search failed.");
        }
    };

    const isAnnouncementReadOnly =
        !isClubContext &&
        channel.channelType === "announcement" &&
        !canManageChannels &&
        currentMember?.role?.slug !== "owner" &&
        currentMember?.role?.slug !== "dept_lead" &&
        currentMember?.role?.slug !== "lead";

    const isObserverReadOnly =
        !isClubContext &&
        currentMember?.role?.slug !== "owner" &&
        !canManageChannels &&
        !currentMember?.role?.permissions?.includes("messages:send") &&
        !currentMember?.role?.permissions?.includes("*");

    return (
        <div className="flex-1 flex flex-col h-full bg-[#FAF6EE] overflow-hidden">
            {/* 1. CHANNEL HEADER */}
            <header className="px-6 py-3.5 border-b-2 border-black bg-white flex items-center justify-between shrink-0 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        {channel.channelType === "announcement" ? (
                            <Volume2 className="w-5 h-5 text-amber-500 shrink-0" />
                        ) : channel.channelType === "forum" ? (
                            <MessageSquare className="w-5 h-5 text-cyan-600 shrink-0" />
                        ) : channel.channelType === "task_discussion" ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                            <Hash className="w-5 h-5 text-black shrink-0" />
                        )}
                        <h2 className="text-base font-black text-black truncate">
                            {channel.name}
                        </h2>
                        {channel.isPrivate && (
                            <span title="Private Channel">
                                <Lock className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                            </span>
                        )}
                    </div>

                    {channel.topic && (
                        <>
                            <span className="text-neutral-300 hidden md:inline">|</span>
                            <span className="text-xs font-bold text-neutral-600 truncate max-w-sm hidden md:inline">
                                {channel.topic}
                            </span>
                        </>
                    )}
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-2.5">
                    {/* Category Permission Sync Badge */}
                    {channel.categoryId && (
                        <div>
                            {channel.isCategorySynced ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#A6FF70] px-2.5 py-1 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                    <Check className="w-3 h-3 text-black" /> Synced
                                </span>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-black bg-[#FFE566] px-2.5 py-1 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                        <AlertCircle className="w-3 h-3 text-black" /> Not Synced
                                    </span>
                                    {canManageChannels && (
                                        <button
                                            onClick={handleSyncWithCategory}
                                            disabled={syncing}
                                            className="text-[11px] font-black text-black hover:underline transition"
                                        >
                                            {syncing ? "Syncing..." : "Sync Now"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pinned Messages Toggle */}
                    <button
                        onClick={() => setShowPinned(!showPinned)}
                        className={`p-2 rounded-xl border-2 border-black transition ${
                            showPinned
                                ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                        }`}
                        title="View Pinned Messages"
                    >
                        <Pin className="w-4 h-4" />
                    </button>

                    {/* Search Bar */}
                    <div className="relative hidden sm:block">
                        <form onSubmit={handleSearch} className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search in channel..."
                                className="w-40 lg:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black placeholder-neutral-400 focus:outline-none shadow-[2px_2px_0px_#000]"
                            />
                            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </form>

                        {/* Search Results Dropdown */}
                        {isSearching && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border-2 border-black rounded-xl p-3 shadow-neo z-40 max-h-60 overflow-y-auto space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-black text-black">
                                    <span>Search Results ({searchResults.length})</span>
                                    <button
                                        onClick={() => {
                                            setIsSearching(false);
                                            setSearchResults([]);
                                            setSearchQuery("");
                                        }}
                                        className="text-neutral-500 hover:text-black"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {searchResults.length === 0 ? (
                                    <p className="text-xs font-semibold text-neutral-500 py-2">No matches found.</p>
                                ) : (
                                    searchResults.map((sr) => (
                                        <div
                                            key={sr.id}
                                            className="p-2 rounded-lg bg-[#FAF6EE] border border-black text-xs text-black"
                                        >
                                            <div className="font-black text-black">
                                                {sr.sender?.firstName} {sr.sender?.lastName}
                                            </div>
                                            <div className="mt-0.5 text-neutral-700 font-medium line-clamp-2">{sr.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Pinned Messages Drawer */}
            {showPinned && (
                <div className="bg-white border-b-2 border-black p-4 max-h-48 overflow-y-auto space-y-2.5 shadow-sm animate-in slide-in-from-top duration-200">
                    <div className="flex items-center justify-between text-xs font-black text-black uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-black">
                            <Pin className="w-3.5 h-3.5 text-black" /> Pinned Messages
                        </span>
                        <button
                            onClick={() => setShowPinned(false)}
                            className="text-neutral-500 hover:text-black"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {messages.filter((m) => m.isPinned).length === 0 ? (
                        <p className="text-xs font-semibold text-neutral-500 italic">No pinned messages in this channel.</p>
                    ) : (
                        messages
                            .filter((m) => m.isPinned)
                            .map((pinned) => (
                                <div
                                    key={pinned.id}
                                    className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs text-black flex items-start justify-between gap-3 shadow-[1.5px_1.5px_0px_#000]"
                                >
                                    <div>
                                        <div className="font-black text-black">
                                            {pinned.sender?.firstName} {pinned.sender?.lastName}
                                        </div>
                                        <div className="mt-0.5 font-medium text-neutral-800">{pinned.content}</div>
                                    </div>
                                    {canManageChannels && (
                                        <button
                                            onClick={() => handleTogglePin(pinned)}
                                            className="text-neutral-600 hover:text-rose-600 font-bold shrink-0 text-[10px]"
                                        >
                                            Unpin
                                        </button>
                                    )}
                                </div>
                            ))
                    )}
                </div>
            )}

            {/* 2. MESSAGE FEED */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Channel Header Welcome Banner */}
                <div className="py-6 border-b-2 border-black/10 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black mb-3">
                        <Hash className="w-6 h-6 text-black" />
                    </div>
                    <h3 className="text-xl font-black text-black">Welcome to #{channel.name}!</h3>
                    <p className="text-xs font-semibold text-neutral-600 mt-1">
                        {channel.topic || "This is the start of the #" + channel.name + " channel."}
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-neutral-500 font-bold text-xs">
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500 font-bold text-xs">
                        No messages yet. Say hello to get the conversation started!
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isAuthor = currentMember?.userId === msg.senderId;
                        const canDelete = isAuthor || canManageChannels;
                        const isEditing = editingMessageId === msg.id;

                        return (
                            <div
                                key={msg.id}
                                className={`group relative flex items-start gap-3 p-2.5 -mx-2 rounded-xl transition ${
                                    msg.isPinned
                                        ? "bg-[#FFF9D2] border-2 border-black shadow-[2px_2px_0px_#000]"
                                        : "hover:bg-white hover:border-2 hover:border-black/15 border-2 border-transparent"
                                }`}
                            >
                                {/* Sender Avatar */}
                                <div
                                    className={`w-9 h-9 rounded-full border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center font-black text-xs text-black uppercase shrink-0 mt-0.5 overflow-hidden ${
                                        msg.sender?.isClub || msg.senderRole?.name === "Club Identity"
                                            ? "bg-amber-300"
                                            : "bg-[#FFE566]"
                                    }`}
                                >
                                    {msg.sender?.avatarUrl ? (
                                        <img
                                            src={msg.sender.avatarUrl}
                                            alt={msg.sender.firstName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : msg.sender?.isClub ? (
                                        <Building2 className="w-4 h-4 text-black" />
                                    ) : (
                                        msg.sender?.firstName?.[0] || "U"
                                    )}
                                </div>

                                {/* Message Content Container */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-black text-black flex items-center gap-1.5">
                                            {(msg.sender?.isClub || msg.senderRole?.name === "Club Identity") && (
                                                <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            )}
                                            {msg.sender?.firstName} {msg.sender?.lastName}
                                        </span>

                                        {/* Sender Role Badge */}
                                        {(msg.senderRole || msg.sender?.isClub) && (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-[10px] font-black border-2 border-black shadow-[1px_1px_0px_#000]"
                                                style={{
                                                    color: "#000",
                                                    backgroundColor:
                                                        msg.sender?.isClub || msg.senderRole?.name === "Club Identity"
                                                            ? "#FCD34D"
                                                            : msg.senderRole?.color || "#FFE566",
                                                }}
                                            >
                                                {msg.sender?.isClub || msg.senderRole?.name === "Club Identity"
                                                    ? "🏛️ Club Identity"
                                                    : msg.senderRole?.name}
                                            </span>
                                        )}

                                        <span className="text-[11px] font-bold text-neutral-500">
                                            {new Date(msg.createdAt).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>

                                        {msg.isEdited && (
                                            <span className="text-[10px] text-neutral-400 italic">(edited)</span>
                                        )}
                                        {msg.isPinned && (
                                            <span title="Pinned">
                                                <Pin className="w-3 h-3 text-black shrink-0" />
                                            </span>
                                        )}
                                    </div>

                                    {/* Body */}
                                    {isEditing ? (
                                        <div className="mt-2 space-y-2">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                rows={2}
                                                className="w-full p-2.5 rounded-xl bg-white border-2 border-black text-xs font-semibold text-black focus:outline-none resize-none shadow-[2px_2px_0px_#000]"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleSaveEdit(msg.id)}
                                                    className="px-3 py-1 bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black rounded-lg text-xs font-black shadow-[1.5px_1.5px_0px_#000]"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingMessageId(null)}
                                                    className="px-3 py-1 bg-white hover:bg-neutral-100 text-black border-2 border-black rounded-lg text-xs font-bold"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`text-sm font-semibold text-neutral-900 leading-relaxed mt-1 whitespace-pre-wrap break-words ${
                                                msg.isDeleted ? "text-neutral-400 italic font-normal" : ""
                                            }`}
                                        >
                                            {msg.isDeleted ? msg.content : renderFormattedContent(msg.content)}
                                        </div>
                                    )}

                                    {/* Attachments */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="mt-2.5">
                                            <AttachmentList files={msg.attachments} clubId={clubId} compact />
                                        </div>
                                    )}

                                    {/* Reactions */}
                                    {msg.reactions && msg.reactions.length > 0 && (
                                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                            {msg.reactions.map((rx) => (
                                                <button
                                                    key={rx.emoji}
                                                    onClick={() => handleToggleReaction(msg.id, rx.emoji)}
                                                    className={`px-2.5 py-1 rounded-lg border-2 border-black text-xs font-black flex items-center gap-1.5 transition ${
                                                        rx.hasReacted
                                                            ? "bg-[#A6FF70] text-black shadow-[2px_2px_0px_#000]"
                                                            : "bg-white hover:bg-neutral-100 text-black shadow-[1px_1px_0px_#000]"
                                                    }`}
                                                >
                                                    <span>{rx.emoji}</span>
                                                    <span className="text-[11px] font-black">{rx.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Thread summary if thread started */}
                                    {msg.thread && (
                                        <button
                                            onClick={() => onOpenThread(msg.thread!)}
                                            className="mt-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black text-black flex items-center gap-2 transition"
                                        >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                            <span>{msg.thread.name}</span>
                                            <span className="text-[11px] text-neutral-600 font-bold">
                                                {msg.thread.messageCount || 0} replies
                                            </span>
                                        </button>
                                    )}
                                </div>

                                {/* Floating Hover Actions */}
                                {!msg.isDeleted && (
                                    <div className="opacity-0 group-hover:opacity-100 absolute right-3 -top-3.5 bg-white border-2 border-black rounded-xl px-2 py-1 flex items-center gap-1 shadow-[3px_3px_0px_#000] transition z-10">
                                        {/* Quick Emoji Reaction Buttons */}
                                        <div className="relative">
                                            <button
                                                onClick={() =>
                                                    setActiveEmojiPickerMsgId(
                                                        activeEmojiPickerMsgId === msg.id ? null : msg.id
                                                    )
                                                }
                                                className="p-1.5 text-black hover:bg-[#FAF6EE] rounded-lg transition"
                                                title="Add Reaction"
                                            >
                                                <Smile className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Emoji Picker Popover */}
                                            {activeEmojiPickerMsgId === msg.id && (
                                                <div className="absolute right-0 bottom-full mb-2 bg-white border-2 border-black rounded-2xl p-2 flex items-center gap-1 shadow-neo z-30">
                                                    {COMMON_EMOJIS.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                            className="p-1.5 text-base hover:scale-125 transition"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Quote / In-channel Reply */}
                                        <button
                                            onClick={() => {
                                                setReplyingTo(msg);
                                                textareaRef.current?.focus();
                                            }}
                                            className="p-1.5 text-black hover:bg-[#FAF6EE] rounded-lg transition"
                                            title="Quote / Reply in Channel"
                                        >
                                            <CornerUpLeft className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Reply / Start Thread */}
                                        <button
                                            onClick={() => {
                                                if (msg.thread) {
                                                    onOpenThread(msg.thread);
                                                } else {
                                                    setThreadModalMsg(msg);
                                                    setThreadName(`Thread on: ${msg.content.slice(0, 30)}...`);
                                                }
                                            }}
                                            className="p-1.5 text-black hover:bg-[#FAF6EE] rounded-lg transition"
                                            title="Reply in Thread"
                                        >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Pin / Unpin */}
                                        {canManageChannels && (
                                            <button
                                                onClick={() => handleTogglePin(msg)}
                                                className="p-1.5 text-black hover:bg-[#FAF6EE] rounded-lg transition"
                                                title={msg.isPinned ? "Unpin Message" : "Pin Message"}
                                            >
                                                <Pin className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Edit own */}
                                        {isAuthor && (
                                            <button
                                                onClick={() => {
                                                    setEditingMessageId(msg.id);
                                                    setEditContent(msg.content);
                                                }}
                                                className="p-1.5 text-black hover:bg-[#FAF6EE] rounded-lg transition"
                                                title="Edit Message"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Delete */}
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                title="Delete Message"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 3. MESSAGE COMPOSER */}
            <div className="p-4 border-t-2 border-black bg-white shrink-0">
                {isObserverReadOnly ? (
                    <div className="p-3 rounded-xl bg-neutral-100 border-2 border-black text-center text-xs font-black text-neutral-700 shadow-[2px_2px_0px_#000]">
                        Observers have read-only viewing access and cannot post messages in this channel.
                    </div>
                ) : isAnnouncementReadOnly ? (
                    <div className="p-3 rounded-xl bg-[#FFE566] border-2 border-black text-center text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                        Only chapter administrators and leads can post in announcement channels.
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="space-y-2">
                        {/* Replying To Banner */}
                        {replyingTo && (
                            <div className="flex items-center justify-between px-3 py-1.5 bg-[#FFE566] border-2 border-black rounded-xl text-xs font-black shadow-neo-xxs animate-in fade-in">
                                <span className="flex items-center gap-1.5 truncate">
                                    <CornerUpLeft className="w-3.5 h-3.5 shrink-0 text-black" />
                                    <span>Replying to @{replyingTo.sender?.username || "user"}:</span>
                                    <span className="font-medium text-neutral-800 truncate">
                                        "{replyingTo.content.slice(0, 50)}..."
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setReplyingTo(null)}
                                    className="p-0.5 hover:bg-black/10 rounded text-black shrink-0"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Matching Mentions Autocomplete Popover */}
                        {matchingMentions.length > 0 && (
                            <div className="p-2 bg-white border-2 border-black rounded-xl shadow-neo space-y-1 animate-in fade-in max-h-44 overflow-y-auto">
                                <div className="text-[10px] font-black uppercase text-neutral-500 px-2 py-0.5">
                                    Mention Member or Role
                                </div>
                                {matchingMentions.map((item) => (
                                    <button
                                        key={item.tag}
                                        type="button"
                                        onClick={() => handleApplyMention(item.tag)}
                                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-black hover:bg-[#FFE566] text-left transition"
                                    >
                                        <span className="flex items-center gap-2">
                                            {item.type === "role" ? (
                                                <Shield className="w-3.5 h-3.5 text-black" />
                                            ) : (
                                                <User className="w-3.5 h-3.5 text-black" />
                                            )}
                                            <span>{item.label}</span>
                                        </span>
                                        <span className="text-[10px] font-bold text-neutral-500">{item.sub}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Inline Emoji Quick Picker Popover */}
                        {showEmojiPicker && (
                            <div className="p-2 bg-white border-2 border-black rounded-xl shadow-neo flex items-center gap-1.5 flex-wrap animate-in fade-in">
                                {["👋", "👍", "❤️", "🔥", "🎉", "🚀", "👀", "💡", "👏", "✅"].map((em) => (
                                    <button
                                        key={em}
                                        type="button"
                                        onClick={() => {
                                            setContent((prev) => (prev ? `${prev} ${em}` : em));
                                            setShowEmojiPicker(false);
                                            textareaRef.current?.focus();
                                        }}
                                        className="w-8 h-8 rounded-lg hover:bg-[#FFE566] border border-transparent hover:border-black flex items-center justify-center text-base transition"
                                    >
                                        {em}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(false)}
                                    className="ml-auto p-1 text-neutral-500 hover:text-black rounded-lg"
                                    title="Close emoji picker"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Expandable Attachment Zone */}
                        {showAttachmentZone && (
                            <div className="mb-3 p-3 bg-white border-2 border-black rounded-2xl space-y-2 shadow-neo">
                                <div className="flex items-center justify-between text-xs text-black font-black">
                                    <span className="flex items-center gap-1.5">
                                        <Paperclip className="w-3.5 h-3.5" /> Attach Media & Documents to #{channel.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowAttachmentZone(false)}
                                        className="p-1 hover:bg-neutral-100 rounded-md text-neutral-600 hover:text-black"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <FileUploadZone
                                    clubId={clubId}
                                    parentResourceType="channel"
                                    parentResourceId={channel.id}
                                    departmentId={channel.departmentId}
                                    compact
                                    onFileUploaded={(newFile) => setPendingAttachments((prev) => [...prev, newFile])}
                                />

                                {pendingAttachments.length > 0 && (
                                    <AttachmentList
                                        files={pendingAttachments}
                                        clubId={clubId}
                                        canDelete
                                        compact
                                        onFileDeleted={(id) => setPendingAttachments((prev) => prev.filter((f) => f.id !== id))}
                                    />
                                )}
                            </div>
                        )}

                        <div className="relative rounded-2xl bg-[#FAF6EE] border-2 border-black focus-within:shadow-[3px_3px_0px_#000] transition overflow-hidden">
                            {isClubContext && (
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-100 border-b border-black/15 text-[11px] font-black text-amber-900">
                                    {clubLogoUrl ? (
                                        <img src={clubLogoUrl} alt={clubName} className="w-4 h-4 rounded-full border border-black object-cover" />
                                    ) : (
                                        <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    )}
                                    <span>Posting as official club: <strong className="text-black">{clubName || "Club"}</strong> (Club Identity)</span>
                                </div>
                            )}

                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={handleTextareaChange}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder={
                                    isClubContext
                                        ? `Message #${channel.name} as ${clubName || "Club"} (Club Official)...`
                                        : `Message #${channel.name}...`
                                }
                                rows={2}
                                className="w-full px-4 pt-3 pb-12 bg-transparent text-sm font-semibold text-black placeholder-neutral-500 focus:outline-none resize-none"
                            />

                            {/* Composer Toolbar Footer */}
                            <div className="absolute left-3 bottom-2.5 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                                    className={`p-1.5 rounded-lg border transition ${
                                        showEmojiPicker
                                            ? "border-black bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                            : "border-transparent hover:border-black hover:bg-white text-black"
                                    }`}
                                    title="Add emoji"
                                >
                                    <Smile className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAttachmentZone((prev) => !prev)}
                                    className={`p-1.5 rounded-lg border transition ${
                                        showAttachmentZone || pendingAttachments.length > 0
                                            ? "border-black bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                            : "border-transparent hover:border-black hover:bg-white text-black"
                                    }`}
                                    title="Attach File"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="absolute right-3 bottom-2.5 flex items-center gap-2">
                                {slowmodeTimer > 0 && (
                                    <span className="px-2 py-1 text-[11px] font-black bg-[#FFE566] text-black border border-black rounded-lg flex items-center gap-1 shadow-neo-xxs animate-pulse">
                                        <Clock className="w-3 h-3" /> {slowmodeTimer}s
                                    </span>
                                )}
                                <button
                                    type="submit"
                                    disabled={sending || (!content.trim() && pendingAttachments.length === 0) || slowmodeTimer > 0}
                                    className="p-2 rounded-xl bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black font-black disabled:opacity-40 transition shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            {/* Start Thread Modal */}
            {threadModalMsg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white border-2 border-black rounded-2xl w-full max-w-md shadow-neo p-6 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                            <h3 className="text-base font-black text-black flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-black" />
                                Start a Thread
                            </h3>
                            <button
                                onClick={() => setThreadModalMsg(null)}
                                className="text-neutral-500 hover:text-black p-1 hover:bg-neutral-100 rounded-lg transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs text-black">
                            <div className="font-black text-black">
                                {threadModalMsg.sender?.firstName} {threadModalMsg.sender?.lastName}
                            </div>
                            <div className="mt-0.5 font-medium text-neutral-800 line-clamp-2">{threadModalMsg.content}</div>
                        </div>

                        <form onSubmit={handleCreateThread} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                                    Thread Title
                                </label>
                                <input
                                    type="text"
                                    value={threadName}
                                    onChange={(e) => setThreadName(e.target.value)}
                                    placeholder="Give this thread a title..."
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-black font-semibold text-sm focus:outline-none focus:bg-white shadow-[2px_2px_0px_#000]"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setThreadModalMsg(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-black text-black bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingThread || !threadName.trim()}
                                    className="px-4 py-2 rounded-xl text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition disabled:opacity-50"
                                >
                                    {creatingThread ? "Creating..." : "Start Thread"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Message Confirmation Modal */}
            <ConfirmationModal
                isOpen={Boolean(messageToDelete)}
                onClose={() => setMessageToDelete(null)}
                onConfirm={confirmDeleteMessage}
                title="Delete Message?"
                description="Are you sure you want to delete this message? This action will permanently remove its contents."
                confirmText="Delete Message"
                cancelText="Cancel"
                variant="danger"
                isLoading={isDeletingMessage}
            />
        </div>
    );
};
