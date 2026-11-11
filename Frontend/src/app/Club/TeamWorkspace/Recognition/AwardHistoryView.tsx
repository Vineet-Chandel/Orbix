// Frontend/src/app/Club/TeamWorkspace/Recognition/AwardHistoryView.tsx
import React, { useState, useMemo } from "react";
import {
    Award,
    Sparkles,
    Search,
    Filter,
    RotateCcw,
    Clock,
    Flame,
    Zap,
    Users,
    Compass,
    Wrench,
    GraduationCap,
    ClockCheck,
    Lock,
    ShieldAlert,
} from "lucide-react";
import type {
    WorkspaceRecognitionLedgerEntry,
    WorkspaceRecognitionCategory,
    WorkspaceMember,
} from "../../../../types/workspace";
import { ReverseAwardModal } from "./ReverseAwardModal";
import { NeoSelect } from "../../../../components/NeoSelect";

interface AwardHistoryViewProps {
    clubId: string;
    entries: WorkspaceRecognitionLedgerEntry[];
    categories: WorkspaceRecognitionCategory[];
    members?: WorkspaceMember[];
    currentMember: WorkspaceMember | null;
    isOwner: boolean;
    onReversalSuccess: () => void;
}

export const AwardHistoryView: React.FC<AwardHistoryViewProps> = ({
    clubId,
    entries,
    categories,
    currentMember,
    isOwner,
    onReversalSuccess,
}) => {
    // Filters
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
    const [selectedIssuerId, setSelectedIssuerId] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "reversed">("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Modal state for reversal
    const [awardToReverse, setAwardToReverse] = useState<WorkspaceRecognitionLedgerEntry | null>(null);

    const getDisplayName = (u?: { name?: string; firstName?: string | null; lastName?: string | null; username: string }) => {
        if (!u) return "Teammate";
        if (u.name) return u.name;
        if (u.firstName) return `${u.firstName} ${u.lastName || ""}`.trim();
        return u.username;
    };

    // Dynamic icon resolution
    const getCategoryIcon = (slugOrIcon?: string) => {
        switch (slugOrIcon?.toLowerCase()) {
            case "teamwork":
            case "users":
                return <Users className="w-4 h-4 text-blue-600" />;
            case "leadership":
            case "compass":
                return <Compass className="w-4 h-4 text-purple-600" />;
            case "initiative":
            case "zap":
                return <Zap className="w-4 h-4 text-amber-500" />;
            case "impact":
            case "flame":
                return <Flame className="w-4 h-4 text-orange-600" />;
            case "problem_solving":
            case "wrench":
                return <Wrench className="w-4 h-4 text-cyan-600" />;
            case "mentorship":
            case "graduationcap":
                return <GraduationCap className="w-4 h-4 text-indigo-600" />;
            case "reliability":
            case "clockcheck":
                return <ClockCheck className="w-4 h-4 text-emerald-600" />;
            default:
                return <Award className="w-4 h-4 text-amber-500" />;
        }
    };

    // Filtered entries
    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            // Category filter
            if (selectedCategoryId !== "all" && entry.categoryId !== selectedCategoryId) {
                return false;
            }

            // Issuer filter
            if (selectedIssuerId !== "all" && entry.issuerId !== selectedIssuerId) {
                return false;
            }

            // Status filter
            if (statusFilter === "active" && (entry.isReversed || entry.transactionType === "reversal")) {
                return false;
            }
            if (statusFilter === "reversed" && !entry.isReversed && entry.transactionType !== "reversal") {
                return false;
            }

            // Search query (recipient name, username, reason)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const recipName = getDisplayName(entry.recipient).toLowerCase();
                const recipUsername = (entry.recipient?.username || "").toLowerCase();
                const issuerName = getDisplayName(entry.issuer).toLowerCase();
                const reason = (entry.appreciationReason || "").toLowerCase();
                return (
                    recipName.includes(q) ||
                    recipUsername.includes(q) ||
                    issuerName.includes(q) ||
                    reason.includes(q)
                );
            }

            return true;
        });
    }, [entries, selectedCategoryId, selectedIssuerId, statusFilter, searchQuery]);

    // Unique issuers for filter dropdown
    const uniqueIssuers = useMemo(() => {
        const map = new Map<string, string>();
        entries.forEach((e) => {
            if (e.issuerId && e.issuer) {
                map.set(e.issuerId, getDisplayName(e.issuer));
            }
        });
        return Array.from(map.entries());
    }, [entries]);

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by recipient, issuer or reason..."
                        className="w-full pl-9 pr-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-bold focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                    />
                </div>

                {/* Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 text-xs font-black min-w-[170px]">
                        <Filter className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                        <NeoSelect
                            value={selectedCategoryId}
                            onChange={(val) => setSelectedCategoryId(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: "All Categories" },
                                ...categories.map((c) => ({ value: c.id, label: c.name })),
                            ]}
                        />
                    </div>

                    {/* Issuer Filter */}
                    {uniqueIssuers.length > 0 && (
                        <div className="min-w-[150px]">
                            <NeoSelect
                                value={selectedIssuerId}
                                onChange={(val) => setSelectedIssuerId(val)}
                                size="sm"
                                triggerClassName="w-full text-xs font-bold"
                                options={[
                                    { value: "all", label: "All Issuers" },
                                    ...uniqueIssuers.map(([id, name]) => ({ value: id, label: name })),
                                ]}
                            />
                        </div>
                    )}

                    {/* Status Filter */}
                    <div className="flex items-center bg-neutral-100 p-1 border-2 border-black rounded-xl shadow-[1.5px_1.5px_0px_#000]">
                        <button
                            onClick={() => setStatusFilter("all")}
                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition ${
                                statusFilter === "all" ? "bg-white text-black shadow-neo-xxs" : "text-neutral-600"
                            }`}
                        >
                            All ({entries.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter("active")}
                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition ${
                                statusFilter === "active" ? "bg-[#A6FF70] text-black shadow-neo-xxs" : "text-neutral-600"
                            }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setStatusFilter("reversed")}
                            className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition ${
                                statusFilter === "reversed" ? "bg-red-200 text-black shadow-neo-xxs" : "text-neutral-600"
                            }`}
                        >
                            Reversals
                        </button>
                    </div>
                </div>
            </div>

            {/* Award Records Feed */}
            {filteredEntries.length === 0 ? (
                <div className="p-10 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] text-center space-y-2">
                    <Sparkles className="w-8 h-8 text-neutral-400 mx-auto" />
                    <p className="text-sm font-black text-black">No recognition awards found</p>
                    <p className="text-xs font-bold text-neutral-500">
                        {searchQuery || selectedCategoryId !== "all" || statusFilter !== "all"
                            ? "Try adjusting your search criteria or category filter."
                            : "Be the first to award Orbits to an outstanding teammate!"}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredEntries.map((entry) => {
                        const isReversal = entry.transactionType === "reversal";
                        const isHighValue = entry.pointsDelta >= 40;
                        const canReverse =
                            !entry.isReversed &&
                            !isReversal &&
                            (isOwner || entry.issuerId === currentMember?.userId);

                        return (
                            <div
                                key={entry.id}
                                className={`p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] transition hover:translate-x-[1px] hover:translate-y-[1px] ${
                                    isReversal
                                        ? "bg-red-50/50 border-red-300"
                                        : entry.isReversed
                                        ? "opacity-60 bg-neutral-50"
                                        : ""
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    {/* Left: Recipient & Issuer Info */}
                                    <div className="flex items-start gap-3 min-w-[240px]">
                                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-sm shrink-0 shadow-[2px_2px_0px_#000]">
                                            {isReversal ? (
                                                <RotateCcw className="w-5 h-5 text-red-700" />
                                            ) : (
                                                (entry.recipient?.name || "U")[0]
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-black">
                                                    {getDisplayName(entry.recipient)}
                                                </span>
                                                <span className="text-[10px] text-neutral-500 font-mono">
                                                    @{entry.recipient?.username}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-600 mt-0.5">
                                                <span>Awarded by</span>
                                                <span className="font-bold text-black">
                                                    {getDisplayName(entry.issuer)}
                                                </span>
                                                {(entry.department?.name || (entry as any).departmentName) && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="px-1.5 py-0.2 bg-[#FAF6EE] border border-black rounded text-[10px] font-bold">
                                                            {entry.department?.name || (entry as any).departmentName}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Points Delta & Category Badge */}
                                    <div className="flex items-center gap-3">
                                        {/* Category Badge */}
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-xl text-xs font-black shadow-[1.5px_1.5px_0px_#000]">
                                            {getCategoryIcon(entry.category?.name || (entry as any).categoryName)}
                                            <span>{entry.category?.name || (entry as any).categoryName || "Appreciation"}</span>
                                        </div>

                                        {/* Points Badge */}
                                        <div
                                            className={`px-3 py-1 border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 ${
                                                isReversal
                                                    ? "bg-red-200 text-red-900"
                                                    : entry.isReversed
                                                    ? "bg-neutral-200 text-neutral-500 line-through"
                                                    : "bg-[#FFE566] text-black"
                                            }`}
                                        >
                                            <Sparkles className="w-3.5 h-3.5 fill-black" />
                                            <span>
                                                {entry.pointsDelta > 0 ? `+${entry.pointsDelta}` : entry.pointsDelta} Orbits
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reason text */}
                                <div className="mt-3 pl-3 border-l-2 border-black/30">
                                    <p className="text-xs font-medium text-neutral-800 leading-relaxed italic">
                                        "{entry.appreciationReason}"
                                    </p>
                                    {entry.reversalReason && (
                                        <p className="text-[11px] font-bold text-red-700 mt-1">
                                            Reversal note: "{entry.reversalReason}"
                                        </p>
                                    )}
                                </div>

                                {/* Footer meta & actions */}
                                <div className="mt-3 pt-2.5 border-t border-neutral-200 flex items-center justify-between text-[11px] font-bold text-neutral-500">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                        {entry.linkedTask && (
                                            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 rounded text-neutral-700">
                                                Task: {entry.linkedTask.title}
                                            </span>
                                        )}
                                        {isHighValue && !entry.isReversed && (
                                            <span className="px-2 py-0.5 bg-amber-100 border border-amber-400 rounded text-amber-900 text-[10px] font-black">
                                                High Impact Award
                                            </span>
                                        )}
                                        {entry.visibility === "recipient_only" && (
                                            <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 border border-neutral-300 rounded text-[10px] font-black flex items-center gap-1">
                                                <Lock className="w-2.5 h-2.5" />
                                                Private Award
                                            </span>
                                        )}
                                        {entry.referenceAwardId && (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded text-[10px] font-black flex items-center gap-1">
                                                <RotateCcw className="w-2.5 h-2.5" />
                                                Correction for #{entry.referenceAwardId.slice(0, 8)}
                                            </span>
                                        )}
                                        {entry.isReversed && (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-300 rounded text-[10px] font-black flex items-center gap-1">
                                                <ShieldAlert className="w-2.5 h-2.5 text-red-600" />
                                                Reversed ({entry.reversalReason || "Compensated"})
                                            </span>
                                        )}
                                    </div>

                                    {/* Reversal Trigger */}
                                    {canReverse && (
                                        <button
                                            onClick={() => setAwardToReverse(entry)}
                                            className="px-2.5 py-1 bg-white hover:bg-red-50 text-red-700 hover:text-red-900 border border-red-300 hover:border-red-500 rounded-lg text-[11px] font-black transition flex items-center gap-1 shadow-neo-xxs active:translate-x-[1px] active:translate-y-[1px]"
                                            title="Issue compensating reversal for this award"
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            <span>Reverse</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reverse Award Modal */}
            <ReverseAwardModal
                isOpen={!!awardToReverse}
                onClose={() => setAwardToReverse(null)}
                clubId={clubId}
                award={awardToReverse}
                onReversalSuccess={() => {
                    setAwardToReverse(null);
                    onReversalSuccess();
                }}
            />
        </div>
    );
};
