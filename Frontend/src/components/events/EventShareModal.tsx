import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Share2,
    Copy,
    Check,
    X,
    Search,
    Users,
    Globe,
    Send,
    Lock,
    ExternalLink,
    AlertCircle,
    UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../store";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader } from "../ui/loader";
import { fetchUserConnectionsList, type ConnectedUserItem } from "../../api/relationshipApi";
import type { InternalShareResponse } from "../../hooks/useEventEngagement";

export interface EventShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    eventTitle?: string;
    eventSummary?: string;
    shareCount: number;
    onInternalShare: (
        recipientUserIds: string | string[],
        note?: string
    ) => Promise<InternalShareResponse>;
    onNativeShare: () => Promise<boolean>;
    onCopyLink: () => Promise<boolean>;
}

export const EventShareModal: React.FC<EventShareModalProps> = ({
    isOpen,
    onClose,
    eventId,
    eventTitle = "Orbix Campus Event",
    eventSummary,
    shareCount,
    onInternalShare,
    onNativeShare,
    onCopyLink,
}) => {
    const navigate = useNavigate();
    const toast = useToast();
    const { isAuthenticated, user } = useAppSelector((state) => state.user);
    const isClubAccount = user?.accountType === "club";

    const [activeTab, setActiveTab] = useState<"internal" | "external">("internal");
    const effectiveTab = isClubAccount ? "external" : activeTab;

    // Connections state
    const [connections, setConnections] = useState<ConnectedUserItem[]>([]);
    const [isLoadingConnections, setIsLoadingConnections] = useState(false);
    const [connectionsError, setConnectionsError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [personalNote, setPersonalNote] = useState("");

    // Sharing action state
    const [isSending, setIsSending] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const canonicalUrl = useMemo(() => {
        if (typeof window === "undefined") return "";
        return `${window.location.origin}/college-events?event=${encodeURIComponent(eventId)}`;
    }, [eventId]);

    // Load connections when modal opens and user is authenticated (personal accounts only)
    useEffect(() => {
        if (!isOpen) {
            setSelectedUserIds(new Set());
            setPersonalNote("");
            setSearchQuery("");
            setConnectionsError(null);
            setIsSending(false);
            return;
        }

        // Club accounts and unauthenticated users must never fetch peer connections
        if (!isAuthenticated || isClubAccount) return;

        let isMounted = true;
        setIsLoadingConnections(true);
        setConnectionsError(null);

        fetchUserConnectionsList(50, undefined, searchQuery.trim() || undefined)
            .then((data) => {
                if (isMounted) {
                    if (data?.success && Array.isArray(data.connections)) {
                        setConnections(data.connections);
                    } else {
                        setConnections([]);
                    }
                }
            })
            .catch((err: any) => {
                if (isMounted) {
                    console.warn("[EventShareModal] Failed to fetch connections:", err);
                    setConnectionsError("Could not load your connections. Please try again.");
                }
            })
            .finally(() => {
                if (isMounted) {
                    setIsLoadingConnections(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, isAuthenticated, isClubAccount, searchQuery]);

    // Escape key listener to close modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isSending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isSending, onClose]);

    // Filter connections locally by search query
    const filteredConnections = useMemo(() => {
        if (!searchQuery.trim()) return connections;
        const q = searchQuery.toLowerCase().trim();
        return connections.filter(
            (c) =>
                c.displayName?.toLowerCase().includes(q) ||
                c.username?.toLowerCase().includes(q) ||
                c.college?.toLowerCase().includes(q) ||
                c.headline?.toLowerCase().includes(q)
        );
    }, [connections, searchQuery]);

    const handleToggleRecipient = (userId: string) => {
        if (isSending) return;
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (isSending) return;
        if (selectedUserIds.size === filteredConnections.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(filteredConnections.map((c) => c.connectedUserId)));
        }
    };

    // Internal send action
    const handleSendInternal = async () => {
        if (selectedUserIds.size === 0 || isSending) return;
        setIsSending(true);

        const recipients = Array.from(selectedUserIds);
        try {
            const result = await onInternalShare(recipients, personalNote.trim() || undefined);
            if (result.success) {
                toast.success(
                    recipients.length === 1
                        ? "Event shared with your connection!"
                        : `Event shared with ${result.deliveredCount} connections!`
                );
                onClose();
            } else {
                toast.error(result.error || "Failed to share event with selected connections.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to share event. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    // External native share action
    const handleNativeShareClick = async () => {
        if (isSending) return;
        setIsSending(true);
        try {
            const success = await onNativeShare();
            if (success) {
                onClose();
            }
        } finally {
            setIsSending(false);
        }
    };

    // Copy link action
    const handleCopyLinkClick = async () => {
        const success = await onCopyLink();
        if (success) {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    if (!isOpen || typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm overflow-y-auto"
                onClick={(e) => {
                    if (e.target === e.currentTarget && !isSending) onClose();
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-modal-title"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="relative w-full max-w-lg bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-3xl border-4 border-black shadow-[10px_10px_0px_#000] overflow-hidden my-auto flex flex-col max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-3.5 bg-white border-b-3 border-black flex items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                <Share2 className="w-4 h-4 text-black stroke-[2.5]" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2
                                        id="share-modal-title"
                                        className="text-base sm:text-lg font-black text-black tracking-tight leading-tight truncate"
                                    >
                                        Share Event
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neutral-100 text-neutral-700 border border-black/30">
                                        {shareCount} share{shareCount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                <p className="text-[11px] font-bold text-neutral-500 truncate">
                                    {eventTitle}
                                </p>
                                {eventSummary && (
                                    <p className="text-[10px] font-semibold text-neutral-400 truncate hidden sm:block">
                                        {eventSummary}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSending}
                            className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-50"
                            aria-label="Close modal"
                        >
                            <X className="w-4 h-4 text-black stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Navigation Header: 2 Tabs for Normal Users, Direct Banner for Club Accounts */}
                    {isClubAccount ? (
                        <div className="px-5 py-2.5 bg-[#F3EEDF] border-b-2 border-black flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-neutral-800 stroke-[2.5]" />
                                <span className="text-xs font-black text-neutral-900 tracking-tight">
                                    Share Event Outside Orbix
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-600 bg-white px-2 py-0.5 rounded-full border border-black/20 uppercase tracking-wider">
                                External Link Only
                            </span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 p-2 bg-[#F3EEDF] border-b-2 border-black gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab("internal")}
                                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all border-2 ${
                                    effectiveTab === "internal"
                                        ? "bg-[#FFE566] text-black border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-neutral-700 border-black/40 hover:bg-neutral-50"
                                }`}
                            >
                                <Users className="w-4 h-4 stroke-[2.5]" />
                                <span>Orbix Peers</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("external")}
                                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all border-2 ${
                                    effectiveTab === "external"
                                        ? "bg-[#FFE566] text-black border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-neutral-700 border-black/40 hover:bg-neutral-50"
                                }`}
                            >
                                <Globe className="w-4 h-4 stroke-[2.5]" />
                                <span>External & Link</span>
                            </button>
                        </div>
                    )}

                    {/* Tab 1: Share within Orbix (Connections) - Strictly normal users only */}
                    {effectiveTab === "internal" && !isClubAccount && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                            {!isAuthenticated ? (
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center mx-auto text-amber-700">
                                        <Lock className="w-6 h-6 stroke-[2.5]" />
                                    </div>
                                    <h3 className="text-base font-black text-black">
                                        Sign In Required
                                    </h3>
                                    <p className="text-xs font-bold text-neutral-600 leading-relaxed max-w-xs mx-auto">
                                        Sign in with your Orbix student account to share events directly with your connected peers.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            navigate("/login");
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <span>Sign In Now</span>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Search & Selection Controls */}
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 stroke-[2.5]" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search connections by name or @username..."
                                                className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#FFE566]"
                                            />
                                        </div>

                                        {filteredConnections.length > 0 && (
                                            <div className="flex items-center justify-between text-xs px-1">
                                                <span className="font-bold text-neutral-600">
                                                    {filteredConnections.length} connection
                                                    {filteredConnections.length !== 1 ? "s" : ""} available
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleSelectAll}
                                                    className="font-black text-neutral-900 hover:text-black underline cursor-pointer"
                                                >
                                                    {selectedUserIds.size === filteredConnections.length
                                                        ? "Deselect All"
                                                        : "Select All"}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Connections List */}
                                    <div className="bg-white rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] overflow-hidden max-h-56 overflow-y-auto divide-y-2 divide-neutral-100">
                                        {isLoadingConnections ? (
                                            <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500">
                                                <OrbixLoader size={20} variant="minimal" color="currentColor" />
                                                <span className="text-xs font-bold">Loading connections...</span>
                                            </div>
                                        ) : connectionsError ? (
                                            <div className="p-4 text-center space-y-2">
                                                <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                                                <p className="text-xs font-bold text-rose-700">{connectionsError}</p>
                                            </div>
                                        ) : filteredConnections.length === 0 ? (
                                            <div className="py-8 px-4 text-center space-y-1 text-neutral-500">
                                                <UserCheck className="w-6 h-6 mx-auto stroke-[2] opacity-40 text-neutral-600" />
                                                <p className="text-xs font-bold text-neutral-700">
                                                    {searchQuery ? "No matching connections found" : "No connections yet"}
                                                </p>
                                                <p className="text-[11px] font-semibold text-neutral-500">
                                                    Connect with peers on Orbix to share campus events with them!
                                                </p>
                                            </div>
                                        ) : (
                                            filteredConnections.map((conn) => {
                                                const isSelected = selectedUserIds.has(conn.connectedUserId);
                                                const initials = (conn.displayName || conn.username || "U")
                                                    .slice(0, 2)
                                                    .toUpperCase();

                                                return (
                                                    <div
                                                        key={conn.connectedUserId}
                                                        onClick={() => handleToggleRecipient(conn.connectedUserId)}
                                                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none ${
                                                            isSelected ? "bg-amber-50/70" : "hover:bg-neutral-50"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {conn.avatarUrl ? (
                                                                <img
                                                                    src={conn.avatarUrl}
                                                                    alt={conn.displayName}
                                                                    className="w-9 h-9 rounded-xl border-2 border-black object-cover shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="w-9 h-9 rounded-xl border-2 border-black bg-gradient-to-br from-amber-200 to-sky-200 flex items-center justify-center font-black text-xs text-black shrink-0">
                                                                    {initials}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-black truncate">
                                                                    {conn.displayName}
                                                                </p>
                                                                <p className="text-[11px] font-bold text-neutral-500 truncate">
                                                                    @{conn.username} {conn.college ? `• ${conn.college}` : ""}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div
                                                            className={`w-5 h-5 rounded-lg border-2 border-black flex items-center justify-center shrink-0 transition-all ${
                                                                isSelected
                                                                    ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                                                    : "bg-white"
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Optional Personal Note */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black uppercase text-neutral-700 tracking-wider">
                                            Optional Note
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={personalNote}
                                            onChange={(e) => setPersonalNote(e.target.value)}
                                            placeholder="Add a message for your peers (e.g. 'Hey, want to attend this together?')..."
                                            maxLength={250}
                                            className="w-full p-2.5 text-xs font-bold bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#FFE566] resize-none"
                                        />
                                    </div>

                                    {/* Send Action */}
                                    <div className="pt-1 flex items-center justify-between gap-3">
                                        <span className="text-xs font-black text-neutral-800">
                                            {selectedUserIds.size} recipient{selectedUserIds.size !== 1 ? "s" : ""} selected
                                        </span>

                                        <button
                                            type="button"
                                            onClick={handleSendInternal}
                                            disabled={selectedUserIds.size === 0 || isSending}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSending ? (
                                                <>
                                                    <OrbixLoader size={14} variant="minimal" color="currentColor" />
                                                    <span>Sending...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Send Event</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tab 2: Share Outside Orbix (Native Share & Copy Link) */}
                    {effectiveTab === "external" && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                            {/* Club Account Informational Banner */}
                            {isClubAccount && (
                                <div className="p-3.5 rounded-2xl bg-amber-50/80 border-2 border-amber-300 shadow-[2px_2px_0px_#f59e0b] flex items-start gap-2.5">
                                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                    <div className="text-[11px] font-bold text-amber-900 leading-snug">
                                        <p className="font-black">Club Account Sharing</p>
                                        <p className="text-amber-800">
                                            Club accounts share event links externally via native device apps or clipboard. Club shares do not alter public attendee share counts.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Option 1: Native Share Sheet */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-100 border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center text-blue-700">
                                        <Share2 className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs sm:text-sm font-black text-black">
                                            Native OS / App Sharing
                                        </h3>
                                        <p className="text-[11px] font-semibold text-neutral-500">
                                            Share directly via WhatsApp, Telegram, X, Messages, etc.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleNativeShareClick}
                                    disabled={isSending}
                                    className="w-full py-2.5 px-4 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <Share2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Share via Device Apps</span>
                                    <ExternalLink className="w-3.5 h-3.5 ml-auto text-neutral-800" />
                                </button>
                            </div>

                            {/* Option 2: Copy Link */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-100 border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center text-emerald-700">
                                        <Copy className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs sm:text-sm font-black text-black">
                                            Copy Event Link
                                        </h3>
                                        <p className="text-[11px] font-semibold text-neutral-500">
                                            Link copies are tracked separately from public shares.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={canonicalUrl}
                                        className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-neutral-100 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] text-neutral-800 select-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyLinkClick}
                                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                                    >
                                        {copiedLink ? (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                                <span className="text-emerald-700">Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 stroke-[2.5]" />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default EventShareModal;
