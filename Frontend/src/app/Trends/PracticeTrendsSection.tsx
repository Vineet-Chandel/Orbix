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
        <div className="space-y-10">
            {/* Top Practice Activity Overview Block (Matching media_1792423732472_9a9c7c70.png) */}
            <PracticeActivityOverview
                connectedPortals={connectedPortals}
                username={effectiveUser}
            />

            {/* Rating history Section */}
            <div className="space-y-6 pt-4 border-t border-black/[0.06]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06]">
                <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl" role="img" aria-label="Trending chart">
                        📈
                    </span>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                            Rating history
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Real-time competitive rating trajectory and contest records across all connected platforms
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                    {/* Live platform count badge */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.04] border border-black/10 text-xs font-semibold text-neutral-700">
                        <span className="w-2 h-2 rounded-full bg-neutral-900" />
                        <span>{platforms.length} {platforms.length === 1 ? "platform" : "platforms"} linked</span>
                    </div>

                    {/* Manual Refresh Button */}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                        title="Sync real-time contest performance"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-white" : ""}`} />
                        <span>{isLoading ? "Syncing..." : "Sync"}</span>
                    </button>
                </div>
            </div>

            {/* Quick summary stats bar */}
            {platforms.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            Total Contests
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-neutral-900">{totalContests}</span>
                            <span className="text-xs text-neutral-500 font-medium">participations</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            Peak Competitive Rating
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                                {peakPlatform ? peakPlatform.rating : "—"}
                            </span>
                            {peakPlatform && (
                                <span className="text-xs text-neutral-500 truncate font-medium">
                                    on {peakPlatform.portalName}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            Active Platforms
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-neutral-900">{platforms.length}</span>
                            <span className="text-xs text-neutral-500 font-medium">portals</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            Data Source
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-xs font-mono text-neutral-700 bg-black/[0.04] px-2 py-1 rounded-md border border-black/10">
                                Official APIs Verified
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Platform Rating History Cards Grid (2-column on desktop, matching screenshot) */}
            {platforms.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {platforms.map((platform) => (
                        <PlatformRatingHistoryCard key={platform.portal} platform={platform} />
                    ))}
                </div>
            ) : (
                /* Empty state when no coding platforms are linked */
                <div className="w-full rounded-3xl bg-black/[0.02] border border-dashed border-black/10 p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-black/[0.04] border border-black/10 flex items-center justify-center text-neutral-800">
                        <TrendingUp className="w-8 h-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                        <h3 className="text-lg font-bold text-neutral-900">No Connected Platforms Found</h3>
                        <p className="text-xs text-neutral-500 leading-relaxed">
                            Connect your competitive coding handles (LeetCode, Codeforces, CodeChef, AtCoder, etc.) to
                            track dynamic rating histories and contest timelines.
                        </p>
                    </div>
                    <Link
                        to="/onboarding"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white text-xs font-extrabold hover:bg-neutral-800 transition-all shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Connect Coding Platforms</span>
                    </Link>
                </div>
            )}
            </div>
        </div>
    );
};
