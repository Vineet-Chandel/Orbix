import React, { useState, useMemo } from "react";
import { Calendar, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { useAppSelector, type UnifiedRecentContestItem } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";

interface RecentContestsCardProps {
    connectedPortals?: Record<string, any>;
    username?: string;
    embedded?: boolean;
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
    username,
    embedded = false,
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();
    const remoteData = useAppSelector((state) => (effectiveUser ? state.contests.dataByUser[effectiveUser] : undefined));
    const isLoading = useAppSelector((state) => (effectiveUser ? state.contests.loadingByUser[effectiveUser] || false : false));

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
            className={
                embedded
                    ? "w-full text-neutral-900 select-none flex flex-col justify-between"
                    : "w-full rounded-2xl bg-white text-neutral-900 p-6 sm:p-7 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none flex flex-col justify-between"
            }
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-black/15 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <Calendar className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h3 id="recent-contests-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
                                Recent contests
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                Unified chronological contest participation and rating changes
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black font-black text-xs text-black shadow-[1px_1px_0px_#000]">
                            {allContests.length > 0 ? `${allContests.length} total` : "0 recorded"}
                        </span>
                    </div>
                </div>

                {/* Optional platform filter chips if contests from multiple platforms exist */}
                {platformsList.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-3 border-b-2 border-black/15 relative z-10 scrollbar-none text-xs sm:text-sm">
                        <button
                            type="button"
                            onClick={() => setSelectedPortal("all")}
                            className={`px-3.5 py-1.5 rounded-xl font-black transition-all cursor-pointer text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] ${
                                selectedPortal === "all"
                                    ? "bg-black text-[#a2ff86]"
                                    : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
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
                                    className={`px-3.5 py-1.5 rounded-xl font-black capitalize transition-all cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] ${
                                        selectedPortal === p
                                            ? "bg-black text-[#a2ff86]"
                                            : "bg-[#FAF6EE] text-black hover:bg-neutral-200"
                                    }`}
                                >
                                    <span className="w-3.5 h-3.5 flex items-center justify-center">
                                        {getPortalIcon(p, "w-full h-full object-contain")}
                                    </span>
                                    <span>{p}</span>
                                    <span className="text-xs font-mono font-bold">({count})</span>
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
                                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-100 border border-neutral-200 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-neutral-200" />
                                        <div className="space-y-1.5">
                                            <div className="w-48 sm:w-72 h-4 bg-neutral-200 rounded-full" />
                                            <div className="w-32 h-3 bg-neutral-200 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="w-12 h-6 bg-neutral-200 rounded-lg" />
                                </div>
                            ))}
                        </div>
                    ) : filteredContests.length === 0 ? (
                        /* Empty State */
                        <div className="py-16 text-center max-w-xs mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center mx-auto text-black shadow-[2px_2px_0px_#000]">
                                <Trophy className="w-6 h-6 text-black" />
                            </div>
                            <h4 className="text-base font-black text-black">No contest history yet</h4>
                            <p className="text-sm text-neutral-600 font-bold leading-relaxed">
                                Participate in a contest on a supported platform (Codeforces, LeetCode, CodeChef, AtCoder) to build your contest history.
                            </p>
                        </div>
                    ) : (
                        /* Chronological Recent Contests List */
                        <div className="divide-y divide-black/10">
                            {displayedContests.map((contest, index) => {
                                const delta = contest.ratingChange;
                                const isPositive = delta !== null && delta !== undefined && delta > 0;
                                const isNegative = delta !== null && delta !== undefined && delta < 0;
                                const isZero = delta === 0;

                                return (
                                    <div
                                        key={`${contest.portal}-${contest.contestId}-${contest.timestamp}-${index}`}
                                        onClick={() => handleOpenContest(contest.contestUrl)}
                                        className="py-3.5 px-3 -mx-2 rounded-xl group hover:bg-[#FAF6EE] border-2 border-transparent hover:border-black transition-all cursor-pointer flex items-center justify-between gap-3 hover:shadow-[2px_2px_0px_#000]"
                                        title={`View contest details on ${contest.portalName}`}
                                    >
                                        {/* Left: Platform Icon + Info */}
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {/* Platform Icon Badge */}
                                            <div className="w-10 h-10 rounded-xl bg-white border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-all">
                                                {getPortalIcon(contest.portal, "w-5 h-5 object-contain")}
                                            </div>

                                            {/* Contest Name & Metadata */}
                                            <div className="min-w-0">
                                                <h4 className="text-sm sm:text-base font-black text-black group-hover:underline transition-colors truncate max-w-[240px] sm:max-w-[420px]">
                                                    {contest.contestName}
                                                </h4>
                                                <p className="text-xs sm:text-sm text-neutral-600 font-bold mt-0.5 truncate">
                                                    <span>{formatRecentContestDate(contest.date, contest.timestamp)}</span>
                                                    {contest.rank !== null && contest.rank !== undefined && (
                                                        <>
                                                            <span className="mx-1.5 text-black">·</span>
                                                            <span className="text-black font-black">rank {contest.rank.toLocaleString()}</span>
                                                        </>
                                                    )}
                                                    {contest.division && (
                                                        <>
                                                            <span className="mx-1.5 text-black">·</span>
                                                            <span className="text-neutral-700">{contest.division}</span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right: Rating Change */}
                                        <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                                            {isPositive && (
                                                <span className="text-sm sm:text-base font-mono font-black text-black bg-[#a2ff86] border-2 border-black px-3 py-1 rounded-lg shadow-[2px_2px_0px_#000]">
                                                    +{delta}
                                                </span>
                                            )}
                                            {isNegative && (
                                                <span className="text-sm sm:text-base font-mono font-black text-black bg-[#fee2e2] border-2 border-black px-3 py-1 rounded-lg shadow-[2px_2px_0px_#000]">
                                                    {delta}
                                                </span>
                                            )}
                                            {isZero && (
                                                <span className="text-sm sm:text-base font-mono font-black text-black bg-[#FAF6EE] border-2 border-black px-3 py-1 rounded-lg shadow-[1px_1px_0px_#000]">
                                                    0
                                                </span>
                                            )}
                                            {(delta === null || delta === undefined) && (
                                                <span className="text-sm font-mono text-neutral-400">
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
                <div className="pt-4 mt-2 border-t-2 border-black/15 text-center relative z-10">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-100 active:translate-x-[1px] active:translate-y-[1px] text-xs sm:text-sm font-black text-black border-2 border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer"
                    >
                        <span>
                            {isExpanded
                                ? `Show latest ${INITIAL_LIMIT} contests`
                                : `View all ${filteredContests.length} contests`}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            )}
        </section>
    );
};

export default RecentContestsCard;
