// Frontend/src/app/Club/TeamWorkspace/Threads/ThreadSidebar.tsx
import React, { useState, useEffect, useRef } from "react";
import {
    X,
    Lock,
    Archive,
    Send,
    MessageCircle,
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
    currentMember: WorkspaceMember | null;
    canManageThreads: boolean;
    onClose: () => void;
    onThreadUpdated: (updated: WorkspaceThread) => void;
}

export const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
    thread,
    channelId,
    clubId,
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
                setMessages((prev) => [...prev, res.message]);
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
        <aside className="w-80 sm:w-96 bg-[#0f172a] border-l border-slate-800 flex flex-col h-full shadow-2xl z-20 shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                    <MessageCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-100 truncate">
                            {thread.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{messages.length} replies</span>
                            {thread.isLocked && (
                                <span className="text-amber-400 flex items-center gap-0.5">
                                    <Lock className="w-3 h-3" /> Locked
                                </span>
                            )}
                            {thread.isArchived && (
                                <span className="text-slate-500 flex items-center gap-0.5">
                                    <Archive className="w-3 h-3" /> Archived
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {canModify && (
                        <>
                            <button
                                onClick={handleToggleLock}
                                disabled={updatingThread}
                                title={thread.isLocked ? "Unlock Thread" : "Lock Thread"}
                                className={`p-1.5 rounded-lg border transition ${
                                    thread.isLocked
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800"
                                }`}
                            >
                                <Lock className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleToggleArchive}
                                disabled={updatingThread}
                                title={thread.isArchived ? "Unarchive Thread" : "Archive Thread"}
                                className={`p-1.5 rounded-lg border transition ${
                                    thread.isArchived
                                        ? "bg-slate-800 text-slate-300 border-slate-700"
                                        : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800"
                                }`}
                            >
                                <Archive className="w-4 h-4" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-slate-500 text-xs">
                        Loading thread history...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                        No replies in this thread yet. Be the first to start the discussion!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="flex items-start gap-2.5 text-xs">
                            <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px] text-indigo-300 uppercase shrink-0 mt-0.5">
                                {msg.sender?.firstName?.[0] || "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-200">
                                        {msg.sender?.firstName} {msg.sender?.lastName}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                        {new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <div className="text-slate-300 leading-relaxed mt-0.5 whitespace-pre-wrap">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60">
                {thread.isLocked ? (
                    <div className="py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300">
                        This thread has been locked. New replies are disabled.
                    </div>
                ) : (
                    <form onSubmit={handleSendReply} className="flex items-center gap-2">
                        <input
                            type="text"
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Reply in thread..."
                            disabled={sending}
                            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                        />
                        <button
                            type="submit"
                            disabled={sending || !replyContent.trim()}
                            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition shadow-md shadow-indigo-600/30"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </form>
                )}
            </div>
        </aside>
    );
};
