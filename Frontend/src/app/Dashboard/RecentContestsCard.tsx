import React, { useState, useMemo } from "react";
import { Calendar, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { useAppSelector, type UnifiedRecentContestItem } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";

interface RecentContestsCardProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

function formatRecentContestDate(dateStr: string, timestamp?: number): string {
    const ts = timestamp || (dateStr ? new Date(dateStr).getTime() : 0);
    if (!ts || isNaN(ts)) return dateStr || "";
    const d = new Date(ts);
    const day = d.getDate();
    const year = d.getFullYear();
    // Matches standard CP contest date formatting (e.g. "9 Oct 2023", "30 Sept 2023")
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()] || "Oct";
    return `${day} ${month} ${year}`;
}

export const RecentContestsCard: React.FC<RecentContestsCardProps> = ({
    connectedPortals: _connectedPortals,
    username = "vineet_chandel",
}) => {
    const effectiveUser = (username || "vineet_chandel").trim();
    const remoteData = useAppSelector((state) => state.contests.dataByUser[effectiveUser]);
    const isLoading = useAppSelector((state) => state.contests.loadingByUser[effectiveUser] || false);

    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [selectedPortal, setSelectedPortal] = useState<string>("all");

    // Unified chronological list of all contests participated in across platforms
    const allContests: UnifiedRecentContestItem[] = useMemo(() => {
        if (remoteData?.recentContests && remoteData.recentContests.length > 0) {
            return remoteData.recentContests;
        }

        // Fallback: derive from platforms history if recentContests is not yet populated
        const list: UnifiedRecentContestItem[] = [];
        for (const p of remoteData?.platforms || []) {
            if (!p.connected || !p.history) continue;
            for (const h of p.history) {
                list.push({
                    portal: p.portal,
                    portalName: p.portalName,
                    contestId: String(h.contestId),
                    contestName: h.contestName,
                    contestUrl: `https://${p.portal}.com`,
                    date: h.date,
                    timestamp: h.timestamp,
                    rank: h.rank ?? null,
                    rating: h.rating,
                    ratingBefore: h.ratingBefore ?? null,
                    ratingChange: h.ratingChange ?? null,
                    division: h.division ?? null,
                    problemsSolved: h.problemsSolved ?? null,
                    totalProblems: h.totalProblems ?? null,
                });
            }
        }
        list.sort((a, b) => b.timestamp - a.timestamp);
        return list;
    }, [remoteData]);

    // Unique participating platforms for optional filter
    const platformsList = useMemo(() => {
        const set = new Set<string>();
        for (const c of allContests) {
            set.add(c.portal.toLowerCase());
        }
        return Array.from(set);
    }, [allContests]);

    const filteredContests = useMemo(() => {
        if (selectedPortal === "all") return allContests;
        return allContests.filter((c) => c.portal.toLowerCase() === selectedPortal.toLowerCase());
    }, [allContests, selectedPortal]);

    // Initial visible slice: latest 6-8 records (matches UI reference screenshot)
    const INITIAL_LIMIT = 6;
    const displayedContests = useMemo(() => {
        if (isExpanded || filteredContests.length <= INITIAL_LIMIT) {
            return filteredContests;
        }
        return filteredContests.slice(0, INITIAL_LIMIT);
    }, [filteredContests, isExpanded]);

    const handleOpenContest = (url?: string) => {
        if (url && typeof window !== "undefined") {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <section
            aria-labelledby="recent-contests-title"
            className="w-full rounded-3xl bg-[#0c1017] text-white p-6 sm:p-7 border border-neutral-800 shadow-2xl relative overflow-hidden select-none flex flex-col justify-between"
        >
            {/* Subtle ambient glow */}
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-indigo-400 shadow-sm">
                            <Calendar className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h3 id="recent-contests-title" className="text-lg sm:text-xl font-black text-white tracking-tight">
                            Recent contests
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-400">
                            {allContests.length > 0 ? `${allContests.length} total` : "0 recorded"}
                        </span>
                    </div>
                </div>

                {/* Optional platform filter chips if contests from multiple platforms exist */}
                {platformsList.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-white/[0.05] relative z-10 scrollbar-none text-[11px]">
                        <button
                            type="button"
                            onClick={() => setSelectedPortal("all")}
                            className={`px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                                selectedPortal === "all"
                                    ? "bg-white text-black"
                                    : "bg-white/[0.05] text-neutral-400 hover:text-white"
                            }`}
                        >
                            All ({allContests.length})
                        </button>
                        {platformsList.map((p) => {
                            const count = allContests.filter((c) => c.portal.toLowerCase() === p).length;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setSelectedPortal(p)}
                                    className={`px-2.5 py-1 rounded-full font-bold capitalize transition-all cursor-pointer flex items-center gap-1 ${
                                        selectedPortal === p
                                            ? "bg-white text-black"
                                            : "bg-white/[0.05] text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    <span className="w-3 h-3 flex items-center justify-center">
                                        {getPortalIcon(p, "w-full h-full object-contain")}
                                    </span>
                                    <span>{p}</span>
                                    <span className="opacity-60 text-[10px]">({count})</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Content Area */}
                <div className="pt-2 relative z-10 min-h-[460px]">
                    {isLoading && allContests.length === 0 ? (
                        /* Skeleton Loading Rows */
                        <div className="space-y-3 pt-2">
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white/[0.06]" />
                                        <div className="space-y-1.5">
                                            <div className="w-40 sm:w-60 h-3 bg-white/[0.06] rounded-full" />
                                            <div className="w-24 h-2 bg-white/[0.04] rounded-full" />
                                        </div>
                                    </div>
                                    <div className="w-10 h-4 bg-white/[0.06] rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : filteredContests.length === 0 ? (
                        /* Empty State */
                        <div className="py-16 text-center max-w-xs mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-white">No contest history yet</h4>
                            <p className="text-xs text-neutral-400 leading-relaxed">
                                Participate in a contest on a supported platform (Codeforces, LeetCode, CodeChef, AtCoder) to build your contest history.
                            </p>
                        </div>
                    ) : (
                        /* Chronological Recent Contests List */
                        <div className="divide-y divide-white/[0.05]">
                            {displayedContests.map((contest, index) => {
                                const delta = contest.ratingChange;
                                const isPositive = delta !== null && delta !== undefined && delta > 0;
                                const isNegative = delta !== null && delta !== undefined && delta < 0;
                                const isZero = delta === 0;

                                return (
                                    <div
                                        key={`${contest.portal}-${contest.contestId}-${contest.timestamp}-${index}`}
                                        onClick={() => handleOpenContest(contest.contestUrl)}
                                        className="py-3 px-2 -mx-2 rounded-xl group hover:bg-white/[0.03] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-3"
                                        title={`View contest details on ${contest.portalName}`}
                                    >
                                        {/* Left: Platform Icon + Info */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Platform Icon Badge */}
                                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 group-hover:border-white/20 transition-all">
                                                {getPortalIcon(contest.portal, "w-4 h-4 object-contain")}
                                            </div>

                                            {/* Contest Name & Metadata */}
                                            <div className="min-w-0">
                                                <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate max-w-[210px] sm:max-w-[320px]">
                                                    {contest.contestName}
                                                </h4>
                                                <p className="text-[11px] text-neutral-400 font-medium mt-0.5 truncate">
                                                    <span>{formatRecentContestDate(contest.date, contest.timestamp)}</span>
                                                    {contest.rank !== null && contest.rank !== undefined && (
                                                        <>
                                                            <span className="mx-1 text-neutral-600">·</span>
                                                            <span>rank {contest.rank.toLocaleString()}</span>
                                                        </>
                                                    )}
                                                    {contest.division && (
                                                        <>
                                                            <span className="mx-1 text-neutral-600">·</span>
                                                            <span className="text-neutral-400">{contest.division}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right: Rating Change */}
                                        <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                                            {isPositive && (
                                                <span className="text-xs sm:text-sm font-mono font-black text-emerald-400 tracking-tight">
                                                    +{delta}
                                                </span>
                                            )}
                                            {isNegative && (
                                                <span className="text-xs sm:text-sm font-mono font-black text-rose-500 tracking-tight">
                                                    {delta}
                                                </span>
                                            )}
                                            {isZero && (
                                                <span className="text-xs sm:text-sm font-mono font-bold text-neutral-400">
                                                    0
                                                </span>
                                            )}
                                            {(delta === null || delta === undefined) && (
                                                <span className="text-xs font-mono text-neutral-500">
                                                    —
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions: View all toggle */}
            {filteredContests.length > INITIAL_LIMIT && (
                <div className="pt-4 mt-2 border-t border-white/[0.06] text-center relative z-10">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-xs font-bold text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                    >
                        <span>
                            {isExpanded
                                ? `Show latest ${INITIAL_LIMIT} contests`
                                : `View all ${filteredContests.length} contests`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                </div>
            )}
        </section>
    );
};

export default RecentContestsCard;
