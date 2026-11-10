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
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceChannel,
    WorkspaceMessage,
    WorkspaceMember,
    WorkspaceThread,
    WorkspaceFile,
} from "../../../../types/workspace";
import { FileUploadZone } from "../Files/FileUploadZone";
import { AttachmentList } from "../Files/AttachmentList";

interface ChannelViewProps {
    channel: WorkspaceChannel;
    clubId: string;
    currentMember: WorkspaceMember | null;
    canManageChannels: boolean;
    onOpenThread: (thread: WorkspaceThread) => void;
    onChannelUpdated?: (channel: WorkspaceChannel) => void;
}

const COMMON_EMOJIS = ["👍", "❤️", "🔥", "🎉", "🚀", "👀", "💡", "👏"];

export const ChannelView: React.FC<ChannelViewProps> = ({
    channel,
    clubId,
    currentMember,
    canManageChannels,
    onOpenThread,
    onChannelUpdated,
}) => {
    const toast = useToast();

    // Data states
    const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState("");
    const [sending, setSending] = useState(false);
    const [showAttachmentZone, setShowAttachmentZone] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<WorkspaceFile[]>([]);

    // Editing message
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");

    // Pinned messages panel
    const [showPinned, setShowPinned] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
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

    // Send message
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = content.trim();
        if ((!trimmed && pendingAttachments.length === 0) || sending) return;

        try {
            setSending(true);
            const res = await workspaceApi.sendMessage(
                channel.id,
                {
                    content: trimmed || (pendingAttachments.length > 0 ? "Shared attachment(s)" : ""),
                    messageType: channel.channelType === "announcement" ? "announcement" : "text",
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
                setPendingAttachments([]);
                setShowAttachmentZone(false);
                setMessages((prev) => [...prev, res.message]);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to post message.");
        } finally {
            setSending(false);
        }
    };

    // Edit message
    const handleSaveEdit = async (messageId: string) => {
        const trimmed = editContent.trim();
        if (!trimmed) return;

        try {
            const res = await workspaceApi.editMessage(channel.id, messageId, trimmed, clubId);
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
    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm("Are you sure you want to delete this message?")) return;

        try {
            const res = await workspaceApi.deleteMessage(channel.id, messageId, clubId);
            if (res.success) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === messageId
                            ? { ...m, isDeleted: true, content: "[This message was deleted]" }
                            : m
                    )
                );
                toast.success("Message deleted.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete message.");
        }
    };

    // Toggle pin
    const handleTogglePin = async (message: WorkspaceMessage) => {
        try {
            const newPinState = !message.isPinned;
            const res = await workspaceApi.togglePinMessage(
                channel.id,
                message.id,
                newPinState,
                clubId
            );
            if (res.success) {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === message.id ? { ...m, isPinned: newPinState } : m
                    )
                );
                toast.success(newPinState ? "Message pinned." : "Message unpinned.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to toggle pin.");
        }
    };

    // Toggle reaction
    const handleToggleReaction = async (messageId: string, emoji: string) => {
        try {
            setActiveEmojiPickerMsgId(null);
            const res = await workspaceApi.toggleReaction(channel.id, messageId, emoji, clubId);
            if (res.success) {
                // Refresh local message reaction
                fetchMessages();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to react.");
        }
    };

    // Handle Thread Start
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
        channel.channelType === "announcement" &&
        !canManageChannels &&
        currentMember?.role?.slug !== "owner" &&
        currentMember?.role?.slug !== "lead";

    return (
        <div className="flex-1 flex flex-col h-full bg-[#0B0F17] overflow-hidden">
            {/* 1. CHANNEL HEADER */}
            <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        {channel.channelType === "announcement" ? (
                            <Volume2 className="w-5 h-5 text-amber-400 shrink-0" />
                        ) : channel.channelType === "forum" ? (
                            <MessageSquare className="w-5 h-5 text-cyan-400 shrink-0" />
                        ) : channel.channelType === "task_discussion" ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                            <Hash className="w-5 h-5 text-indigo-400 shrink-0" />
                        )}
                        <h2 className="text-base font-bold text-slate-100 truncate">
                            {channel.name}
                        </h2>
                        {channel.isPrivate && (
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Private Channel" />
                        )}
                    </div>

                    {channel.topic && (
                        <>
                            <span className="text-slate-600 hidden md:inline">|</span>
                            <span className="text-xs text-slate-400 truncate max-w-sm hidden md:inline">
                                {channel.topic}
                            </span>
                        </>
                    )}
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-3">
                    {/* Category Permission Sync Badge */}
                    {channel.categoryId && (
                        <div>
                            {channel.isCategorySynced ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                    <Check className="w-3 h-3" /> Synced
                                </span>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                        <AlertCircle className="w-3 h-3" /> Not Synced
                                    </span>
                                    {canManageChannels && (
                                        <button
                                            onClick={handleSyncWithCategory}
                                            disabled={syncing}
                                            className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline transition"
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
                        className={`p-2 rounded-xl border transition ${
                            showPinned
                                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                                : "text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800/60"
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
                                className="w-40 lg:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </form>

                        {/* Search Results Dropdown */}
                        {isSearching && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0f172a] border border-slate-800 rounded-xl p-3 shadow-2xl z-40 max-h-60 overflow-y-auto space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                                    <span>Search Results ({searchResults.length})</span>
                                    <button
                                        onClick={() => {
                                            setIsSearching(false);
                                            setSearchResults([]);
                                            setSearchQuery("");
                                        }}
                                        className="text-slate-500 hover:text-slate-300"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {searchResults.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-2">No matches found.</p>
                                ) : (
                                    searchResults.map((sr) => (
                                        <div
                                            key={sr.id}
                                            className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300"
                                        >
                                            <div className="font-semibold text-slate-200">
                                                {sr.sender?.firstName} {sr.sender?.lastName}
                                            </div>
                                            <div className="mt-0.5 text-slate-400 line-clamp-2">{sr.content}</div>
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
                <div className="bg-slate-900/90 border-b border-slate-800 p-4 max-h-48 overflow-y-auto space-y-2.5 animate-in slide-in-from-top duration-200">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5 text-indigo-400">
                            <Pin className="w-3.5 h-3.5" /> Pinned Messages
                        </span>
                        <button
                            onClick={() => setShowPinned(false)}
                            className="text-slate-500 hover:text-slate-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {messages.filter((m) => m.isPinned).length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No pinned messages in this channel.</p>
                    ) : (
                        messages
                            .filter((m) => m.isPinned)
                            .map((pinned) => (
                                <div
                                    key={pinned.id}
                                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start justify-between gap-3"
                                >
                                    <div>
                                        <div className="font-semibold text-slate-200">
                                            {pinned.sender?.firstName} {pinned.sender?.lastName}
                                        </div>
                                        <div className="mt-0.5">{pinned.content}</div>
                                    </div>
                                    {canManageChannels && (
                                        <button
                                            onClick={() => handleTogglePin(pinned)}
                                            className="text-slate-500 hover:text-rose-400 shrink-0 text-[10px]"
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
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Channel Header Welcome Banner */}
                <div className="py-6 border-b border-slate-800/60 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                        <Hash className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-100">Welcome to #{channel.name}!</h3>
                    <p className="text-xs text-slate-400 mt-1">
                        {channel.topic || "This is the start of the #" + channel.name + " channel."}
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-500 text-xs">
                        Loading messages...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
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
                                className={`group relative flex items-start gap-3 p-2 -mx-2 rounded-xl transition ${
                                    msg.isPinned ? "bg-indigo-500/5 border-l-2 border-indigo-500" : "hover:bg-slate-900/40"
                                }`}
                            >
                                {/* Sender Avatar */}
                                <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 uppercase shrink-0 mt-0.5">
                                    {msg.sender?.firstName?.[0] || "U"}
                                </div>

                                {/* Message Content Container */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-200">
                                            {msg.sender?.firstName} {msg.sender?.lastName}
                                        </span>

                                        {/* Sender Role Badge */}
                                        {msg.senderRole && (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                                                style={{
                                                    color: msg.senderRole.color || "#6366f1",
                                                    borderColor: `${msg.senderRole.color || "#6366f1"}40`,
                                                    backgroundColor: `${msg.senderRole.color || "#6366f1"}15`,
                                                }}
                                            >
                                                {msg.senderRole.name}
                                            </span>
                                        )}

                                        <span className="text-[11px] text-slate-500">
                                            {new Date(msg.createdAt).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>

                                        {msg.isEdited && (
                                            <span className="text-[10px] text-slate-500 italic">(edited)</span>
                                        )}
                                        {msg.isPinned && (
                                            <Pin className="w-3 h-3 text-indigo-400 shrink-0" title="Pinned" />
                                        )}
                                    </div>

                                    {/* Body */}
                                    {isEditing ? (
                                        <div className="mt-2 space-y-2">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                rows={2}
                                                className="w-full p-2.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-xs text-slate-200 focus:outline-none resize-none"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleSaveEdit(msg.id)}
                                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingMessageId(null)}
                                                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className={`text-sm text-slate-300 leading-relaxed mt-1 whitespace-pre-wrap break-words ${
                                                msg.isDeleted ? "text-slate-500 italic" : ""
                                            }`}
                                        >
                                            {msg.content}
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
                                                    className={`px-2 py-0.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                                                        rx.hasReacted
                                                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                                    }`}
                                                >
                                                    <span>{rx.emoji}</span>
                                                    <span className="text-[11px] font-semibold">{rx.count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Thread summary if thread started */}
                                    {msg.thread && (
                                        <button
                                            onClick={() => onOpenThread(msg.thread!)}
                                            className="mt-2.5 px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2 transition"
                                        >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                            <span className="font-semibold">{msg.thread.name}</span>
                                            <span className="text-[11px] text-indigo-400/80">
                                                {msg.thread.messageCount || 0} replies
                                            </span>
                                        </button>
                                    )}
                                </div>

                                {/* Floating Hover Actions */}
                                {!msg.isDeleted && (
                                    <div className="opacity-0 group-hover:opacity-100 absolute right-3 -top-3.5 bg-slate-900 border border-slate-800 rounded-xl px-1.5 py-1 flex items-center gap-1 shadow-xl transition">
                                        {/* Quick Emoji Reaction Buttons */}
                                        <div className="relative">
                                            <button
                                                onClick={() =>
                                                    setActiveEmojiPickerMsgId(
                                                        activeEmojiPickerMsgId === msg.id ? null : msg.id
                                                    )
                                                }
                                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                                                title="Add Reaction"
                                            >
                                                <Smile className="w-3.5 h-3.5" />
                                            </button>

                                            {/* Emoji Picker Popover */}
                                            {activeEmojiPickerMsgId === msg.id && (
                                                <div className="absolute right-0 bottom-full mb-2 bg-[#0f172a] border border-slate-800 rounded-2xl p-2 flex items-center gap-1 shadow-2xl z-30">
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
                                            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                                            title="Reply in Thread"
                                        >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Pin / Unpin */}
                                        {canManageChannels && (
                                            <button
                                                onClick={() => handleTogglePin(msg)}
                                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
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
                                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                                                title="Edit Message"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Delete */}
                                        {canDelete && (
                                            <button
                                                onClick={() => handleDeleteMessage(msg.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
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
            <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 shrink-0">
                {isAnnouncementReadOnly ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300">
                        Only chapter administrators and leads can post in announcement channels.
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="space-y-2">
                        {/* Expandable Attachment Zone */}
                        {showAttachmentZone && (
                            <div className="mb-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 shadow-xl">
                                <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                                    <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                                        <Paperclip className="w-3.5 h-3.5" /> Attach Media & Documents to #{channel.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowAttachmentZone(false)}
                                        className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200"
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

                        <div className="relative rounded-2xl bg-slate-950/70 border border-slate-800 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition overflow-hidden">
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder={`Message #${channel.name}...`}
                                rows={2}
                                className="w-full px-4 pt-3 pb-10 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none resize-none"
                            />

                            {/* Composer Toolbar Footer */}
                            <div className="absolute left-3 bottom-2.5 flex items-center gap-1.5 text-slate-400">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const emoji = prompt("Enter an emoji to insert:", "👋");
                                        if (emoji) setContent((prev) => prev + " " + emoji);
                                    }}
                                    className="p-1.5 rounded-lg hover:text-slate-200 hover:bg-slate-800/60 transition"
                                    title="Add emoji"
                                >
                                    <Smile className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAttachmentZone((prev) => !prev)}
                                    className={`p-1.5 rounded-lg transition ${
                                        showAttachmentZone || pendingAttachments.length > 0
                                            ? "text-purple-400 bg-purple-500/10"
                                            : "hover:text-slate-200 hover:bg-slate-800/60"
                                    }`}
                                    title="Attach File"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="absolute right-3 bottom-2.5">
                                <button
                                    type="submit"
                                    disabled={sending || !content.trim()}
                                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shadow-lg shadow-indigo-600/25"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-indigo-400" />
                                Start a Thread
                            </h3>
                            <button
                                onClick={() => setThreadModalMsg(null)}
                                className="text-slate-400 hover:text-slate-200"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                            <div className="font-semibold text-slate-300">
                                {threadModalMsg.sender?.firstName} {threadModalMsg.sender?.lastName}
                            </div>
                            <div className="mt-0.5 line-clamp-2">{threadModalMsg.content}</div>
                        </div>

                        <form onSubmit={handleCreateThread} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Thread Title
                                </label>
                                <input
                                    type="text"
                                    value={threadName}
                                    onChange={(e) => setThreadName(e.target.value)}
                                    placeholder="Give this thread a title..."
                                    required
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setThreadModalMsg(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingThread || !threadName.trim()}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25"
                                >
                                    {creatingThread ? "Creating..." : "Start Thread"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
