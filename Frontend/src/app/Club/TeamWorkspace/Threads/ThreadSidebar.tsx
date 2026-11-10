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
                            <div className="w-7 h-7 rounded-full bg-[#FFE566] border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center font-black text-[10px] text-black uppercase shrink-0 mt-0.5">
                                {msg.sender?.firstName?.[0] || "U"}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-black text-black">
                                        {msg.sender?.firstName} {msg.sender?.lastName}
                                    </span>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        {new Date(msg.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <div className="text-neutral-900 font-semibold leading-relaxed mt-0.5 whitespace-pre-wrap">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="p-3 border-t-2 border-black bg-white">
                {thread.isLocked ? (
                    <div className="py-2 px-3 rounded-xl bg-[#FFE566] border-2 border-black text-center text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000]">
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
                            className="flex-1 px-3.5 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-semibold text-black placeholder-neutral-500 focus:outline-none shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <button
                            type="submit"
                            disabled={sending || !replyContent.trim()}
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
