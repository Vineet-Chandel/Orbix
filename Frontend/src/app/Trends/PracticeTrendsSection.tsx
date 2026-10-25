import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, RefreshCw, Plus } from "lucide-react";
import { useAppDispatch, useAppSelector, fetchContestPerformance } from "../../store";
import { PlatformRatingHistoryCard } from "./PlatformRatingHistoryCard";
import { PracticeActivityOverview } from "./PracticeActivityOverview";
import type { PlatformContestAnalytics } from "../../store/contestsSlice";

interface PracticeTrendsSectionProps {
    connectedPortals: Record<string, any>;
    username?: string;
}

export const PracticeTrendsSection: React.FC<PracticeTrendsSectionProps> = ({
    connectedPortals,
    username = "",
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();
    const dispatch = useAppDispatch();

    const contestData = useAppSelector((state) => (effectiveUser ? state.contests.dataByUser[effectiveUser] : undefined));
    const isLoading = useAppSelector((state) => (effectiveUser ? state.contests.loadingByUser[effectiveUser] || false : false));

    const handleRefresh = () => {
        if (!effectiveUser) return;
        dispatch(
            fetchContestPerformance({
                username: effectiveUser,
                portals: connectedPortals,
                force: true,
            })
        );
    };

    // Gather all eligible platforms
    const platforms: PlatformContestAnalytics[] = useMemo(() => {
        if (contestData?.platforms && contestData.platforms.length > 0) {
            return contestData.platforms;
        }

        // Fallback from connectedPortals if remote call is still pending
        const fallbackList: PlatformContestAnalytics[] = [];
        if (connectedPortals && typeof connectedPortals === "object") {
            for (const [k, v] of Object.entries(connectedPortals)) {
                const portalKey = k.toLowerCase().trim();
                if (portalKey === "github" || portalKey.startsWith("_") || portalKey === "theme") continue;
                const pUser = typeof v === "object" ? v?.username || v?.portalUsername || "" : String(v || "");
                if (pUser) {
                    const name = portalKey.charAt(0).toUpperCase() + portalKey.slice(1);
                    fallbackList.push({
                        portal: portalKey,
                        portalName: name,
                        portalUsername: pUser,
                        profileUrl: "",
                        connected: true,
                        currentRating: null,
                        peakRating: null,
                        tier: null,
                        tierColor: null,
                        tierInfo: null,
                        officialRank: null,
                        percentile: null,
                        ratedContestsCount: 0,
                        history: [],
                        recentChange90d: null,
                        lastSyncAt: new Date().toISOString(),
                        status: "syncing",
                        exploreContestsUrl: "",
                    });
                }
            }
        }
        return fallbackList;
    }, [contestData, connectedPortals]);

    // Calculate aggregated high-level milestones
    const totalContests = useMemo(() => {
        return platforms.reduce((acc, p) => acc + (p.ratedContestsCount || 0), 0);
    }, [platforms]);

    const peakPlatform = useMemo(() => {
        let maxRating = 0;
        let peakName = "";
        for (const p of platforms) {
            const r = p.peakRating || p.currentRating || 0;
            if (r > maxRating) {
                maxRating = r;
                peakName = p.portalName;
            }
        }
        return maxRating > 0 ? { rating: maxRating, portalName: peakName } : null;
    }, [platforms]);

    return (
        <div className="space-y-8">
            {/* Top Practice Activity Overview Block */}
            <PracticeActivityOverview
                connectedPortals={connectedPortals}
                username={effectiveUser}
            />

            {/* Rating history Section */}
            <div className="space-y-6 pt-6 border-t-2 border-black/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <TrendingUp className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                Rating history
                            </h2>
                            <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-0.5">
                                Real-time competitive rating trajectory and contest records across all connected platforms
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                        {/* Live platform count badge */}
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black animate-pulse" />
                            <span>{platforms.length} {platforms.length === 1 ? "platform" : "platforms"} linked</span>
                        </div>

                        {/* Manual Refresh Button */}
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black transition-all cursor-pointer disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5"
                            title="Sync real-time contest performance"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isLoading ? "animate-spin text-[#a2ff86]" : ""}`} />
                            <span>{isLoading ? "Syncing..." : "Sync"}</span>
                        </button>
                    </div>
                </div>

                {/* Quick summary stats bar */}
                {platforms.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                            <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                                Total Contests
                            </span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-black text-black font-mono">{totalContests}</span>
                                <span className="text-xs text-neutral-600 font-bold">participations</span>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                            <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                                Peak Competitive Rating
                            </span>
                            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl sm:text-3xl font-black text-black font-mono">
                                    {peakPlatform ? peakPlatform.rating : "—"}
                                </span>
                                {peakPlatform && (
                                    <span className="text-xs font-black text-black px-2 py-0.5 rounded bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000] truncate">
                                        on {peakPlatform.portalName}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                            <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                                Active Platforms
                            </span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl sm:text-3xl font-black text-black font-mono">{platforms.length}</span>
                                <span className="text-xs text-neutral-600 font-bold">portals</span>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                            <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                                Data Source
                            </span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-xs font-black text-black bg-[#a2ff86] px-2.5 py-1 rounded-md border border-black shadow-[1px_1px_0px_#000] font-mono">
                                    Official APIs Verified
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Platform Rating History Cards Grid (2-column on desktop) */}
                {platforms.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {platforms.map((platform) => (
                            <PlatformRatingHistoryCard key={platform.portal} platform={platform} />
                        ))}
                    </div>
                ) : (
                    /* Empty state when no coding platforms are linked */
                    <div className="w-full rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-[4px_4px_0px_#000]">
                        <div className="w-16 h-16 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black">
                            <TrendingUp className="w-8 h-8 stroke-[2.5]" />
                        </div>
                        <div className="max-w-md space-y-1">
                            <h3 className="text-lg font-black text-black">No Connected Platforms Found</h3>
                            <p className="text-xs sm:text-sm font-bold text-neutral-600 leading-relaxed">
                                Connect your competitive coding handles (LeetCode, Codeforces, CodeChef, AtCoder, etc.) to
                                track dynamic rating histories and contest timelines.
                            </p>
                        </div>
                        <Link
                            to="/onboarding"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] text-xs font-black hover:bg-neutral-900 transition-all border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer"
                        >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>Connect Coding Platforms</span>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};
