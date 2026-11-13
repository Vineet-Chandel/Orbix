// Frontend/src/app/Club/TeamWorkspace/Threads/ThreadSidebar.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    X,
    Lock,
    Archive,
    Send,
    MessageCircle,
    Users,
    Building2,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceThread,
    WorkspaceMessage,
    WorkspaceMember,
} from "../../../../types/workspace";

interface ThreadSidebarProps {
    thread: WorkspaceThread;
    channelId: string;
    clubId: string;
    clubName?: string;
    isClubContext?: boolean;
    currentMember: WorkspaceMember | null;
    canManageThreads: boolean;
    onClose: () => void;
    onThreadUpdated: (updated: WorkspaceThread) => void;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
    thread,
    channelId,
    clubId,
    clubName,
    isClubContext = false,
    currentMember,
    canManageThreads,
    onClose,
    onThreadUpdated,
}) => {
    const toast = useToast();
    const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyContent, setReplyContent] = useState("");
    const [sending, setSending] = useState(false);
    const [updatingThread, setUpdatingThread] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isCreator = currentMember?.userId === thread.creatorId;
    const canModify = isCreator || canManageThreads;

    const fetchThreadMessages = async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getMessages(channelId, {
                threadId: thread.id,
                clubId,
                limit: 100,
            });
            if (res.success && res.messages) {
                setMessages(res.messages);
            }
        } catch (err: any) {
            console.error("Failed to load thread messages:", err);
            toast.error(err.message || "Failed to load thread messages.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (thread.id) {
            fetchThreadMessages();
        }
    }, [thread.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Live real-time updates for replies
    useEffect(() => {
        const handleRealtime = (e: any) => {
            const data = e.detail;
            if (data.event === "message:new" && data.payload?.message?.threadId === thread.id) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === data.payload.message.id)) return prev;
                    return [...prev, data.payload.message];
                });
            } else if (data.event === "thread:updated" && data.payload?.thread?.id === thread.id) {
                onThreadUpdated(data.payload.thread);
            }
        };

        window.addEventListener("workspace:realtime", handleRealtime);
        return () => window.removeEventListener("workspace:realtime", handleRealtime);
    }, [thread.id, onThreadUpdated]);

    // Extract distinct participants
    const participants = useMemo(() => {
        const map = new Map<string, { id: string; name: string; username: string; initial: string }>();
        messages.forEach((m) => {
            if (m.sender && !map.has(m.senderId)) {
                map.set(m.senderId, {
                    id: m.senderId,
                    name: `${m.sender.firstName || ""} ${m.sender.lastName || ""}`.trim() || "User",
                    username: m.sender.username || "user",
                    initial: (m.sender.firstName?.[0] || "U").toUpperCase(),
                });
            }
        });
        return Array.from(map.values());
    }, [messages]);

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = replyContent.trim();
        if (!trimmed || sending) return;

        if (thread.isLocked) {
            toast.error("This thread is locked.");
            return;
        }

        try {
            setSending(true);
            const res = await workspaceApi.sendMessage(
                channelId,
                {
                    content: trimmed,
                    threadId: thread.id,
                },
                clubId
            );

            if (res.success && res.message) {
                setReplyContent("");
                setMessages((prev) => {
                    if (prev.some((m) => m.id === res.message.id)) return prev;
                    return [...prev, res.message];
                });
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to reply in thread.");
        } finally {
            setSending(false);
        }
    };

    const handleToggleLock = async () => {
        if (!canModify) return;
        try {
            setUpdatingThread(true);
            const res = await workspaceApi.updateThread(
                thread.id,
                { isLocked: !thread.isLocked },
                clubId
            );
            if (res.success && res.thread) {
                onThreadUpdated(res.thread);
                toast.success(res.thread.isLocked ? "Thread locked." : "Thread unlocked.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update thread lock.");
        } finally {
            setUpdatingThread(false);
        }
    };

    const handleToggleArchive = async () => {
        if (!canModify) return;
        try {
            setUpdatingThread(true);
            const res = await workspaceApi.updateThread(
                thread.id,
                { isArchived: !thread.isArchived },
                clubId
            );
            if (res.success && res.thread) {
                onThreadUpdated(res.thread);
                toast.success(res.thread.isArchived ? "Thread archived." : "Thread unarchived.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update thread archive status.");
        } finally {
            setUpdatingThread(false);
        }
    };

    return (
        <aside className="w-80 sm:w-96 bg-white border-l-2 border-black flex flex-col h-full shadow-neo z-20 shrink-0">
            {/* Header */}
            <div className="p-4 border-b-2 border-black bg-[#FAF6EE] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-[#FFE566] border-2 border-black rounded-lg shadow-[1px_1px_0px_#000] shrink-0">
                        <MessageCircle className="w-4 h-4 text-black" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-black text-black truncate">
                            {thread.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-600">
                            <span>{messages.length} replies</span>
                            {thread.isLocked && (
                                <span className="text-amber-700 font-black flex items-center gap-0.5">
                                    <Lock className="w-3 h-3" /> Locked
                                </span>
                            )}
                            {thread.isArchived && (
                                <span className="text-neutral-500 font-black flex items-center gap-0.5">
                                    <Archive className="w-3 h-3" /> Archived
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* View Participants toggle */}
                    <button
                        onClick={() => setShowParticipants((prev) => !prev)}
                        title={`View Participants (${participants.length})`}
                        className={`p-1.5 rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-1 text-xs font-black ${
                            showParticipants ? "bg-[#A6FF70]" : "bg-white hover:bg-neutral-100"
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>{participants.length}</span>
                    </button>

                    {canModify && (
                        <>
                            <button
                                onClick={handleToggleLock}
                                disabled={updatingThread}
                                title={thread.isLocked ? "Unlock Thread" : "Lock Thread"}
                                className={`p-1.5 rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition ${
                                    thread.isLocked
                                        ? "bg-[#FFE566] text-black"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                <Lock className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleToggleArchive}
                                disabled={updatingThread}
                                title={thread.isArchived ? "Unarchive Thread" : "Archive Thread"}
                                className={`p-1.5 rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition ${
                                    thread.isArchived
                                        ? "bg-neutral-300 text-black"
                                        : "bg-white text-black hover:bg-neutral-100"
                                }`}
                            >
                                <Archive className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-transparent hover:border-black text-black hover:bg-neutral-100 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Participants Drawer (Toggleable) */}
            {showParticipants && (
                <div className="p-3 bg-amber-50 border-b-2 border-black animate-in fade-in space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-black flex items-center justify-between">
                        <span>Thread Participants ({participants.length})</span>
                        <button
                            onClick={() => setShowParticipants(false)}
                            className="text-neutral-500 hover:text-black"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    {participants.length === 0 ? (
                        <p className="text-xs text-neutral-500 font-bold">No participants yet.</p>
                    ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {participants.map((p) => (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-black text-xs shadow-neo-xxs"
                                >
                                    <div className="w-5 h-5 rounded-full bg-[#FFE566] border border-black flex items-center justify-center font-black text-[9px] text-black">
                                        {p.initial}
                                    </div>
                                    <div className="min-w-0 flex-1 truncate font-bold text-black">
                                        {p.name}
                                    </div>
                                    <div className="text-[10px] text-neutral-500 font-medium">
                                        @{p.username}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF6EE]">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-neutral-500 font-bold text-xs">
                        Loading thread history...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500 font-bold text-xs">
                        No replies in this thread yet. Be the first to start the discussion!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-2.5 text-xs">
                            <div
                                className={`w-7 h-7 rounded-full border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center font-black text-[10px] text-black uppercase shrink-0 mt-0.5 overflow-hidden ${
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
                                    <Building2 className="w-3.5 h-3.5 text-black" />
                                ) : (
                                    msg.sender?.firstName?.[0] || "U"
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-black flex items-center gap-1">
                                        {(msg.sender?.isClub || msg.senderRole?.name === "Club Identity") && (
                                            <Building2 className="w-3 h-3 text-amber-600 shrink-0" />
                                        )}
                                        {msg.sender?.firstName} {msg.sender?.lastName}
                                    </span>
                                    {(msg.senderRole || msg.sender?.isClub) && (
                                        <span
                                            className="px-1.5 py-0.5 rounded-full text-[9px] font-black border border-black"
                                            style={{
                                                color: "#000",
                                                backgroundColor:
                                                    msg.sender?.isClub || msg.senderRole?.name === "Club Identity"
                                                        ? "#FCD34D"
                                                        : msg.senderRole?.color || "#FFE566",
                                            }}
                                        >
                                            {msg.sender?.isClub || msg.senderRole?.name === "Club Identity"
                                                ? "Club Identity"
                                                : msg.senderRole?.name}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        {new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <div className="p-2.5 mt-1 rounded-xl bg-white border-2 border-black font-medium text-black shadow-[1px_1px_0px_#000] whitespace-pre-wrap leading-relaxed">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="p-3 border-t-2 border-black bg-white">
                {thread.isLocked ? (
                    <div className="py-2 px-3 rounded-xl bg-[#FFE566] border-2 border-black text-center text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                        <span>This thread has been locked by a moderator.</span>
                    </div>
                ) : !isClubContext &&
                  currentMember?.role?.slug !== "owner" &&
                  !canManageThreads &&
                  !currentMember?.role?.permissions?.includes("messages:send") &&
                  !currentMember?.role?.permissions?.includes("*") ? (
                    <div className="py-2 px-3 rounded-xl bg-neutral-100 border-2 border-black text-center text-xs font-black text-neutral-700 shadow-[1.5px_1.5px_0px_#000]">
                        Observers have read-only access to threads.
                    </div>
                ) : (
                    <form onSubmit={handleSendReply} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder={
                                isClubContext
                                    ? `Reply as ${clubName || "Club"} (Club Identity)...`
                                    : `Reply to #${thread.name}...`
                            }
                            disabled={sending}
                            className="flex-1 px-3.5 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-semibold text-black placeholder-neutral-500 focus:outline-none shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <button
                            type="submit"
                            disabled={!replyContent.trim() || sending}
                            className="p-2 rounded-xl bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black font-black disabled:opacity-40 transition shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                )}
            </div>
        </aside>
    );
};
