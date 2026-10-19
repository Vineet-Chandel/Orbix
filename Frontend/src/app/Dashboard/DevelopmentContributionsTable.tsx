import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    GitBranch,
    Flame,
    Calendar,
    Layers,
    Sparkles,
    CheckCircle2,
    ArrowRight,
    ExternalLink,
} from "lucide-react";
import { useAppDispatch, useAppSelector, fetchUnifiedDevelopment, clearDevelopmentCache, fetchDevelopmentAnalytics } from "../../store";
import { DevelopmentMetricCards } from "./DevelopmentAnalytics/DevelopmentMetricCards";
import { getPortalIcon } from "../../utils/portalIcons";
import {
    aggregateClientDevelopmentContributions,
    buildWeeklySubmissionColumns,
    type DaySubmissionCell,
} from "../../utils/submissionsAggregator";

interface DevelopmentContributionsTableProps {
    connectedPortals: Record<string, any>;
    username?: string;
}

export const DevelopmentContributionsTable: React.FC<DevelopmentContributionsTableProps> = ({
    connectedPortals,
    username = "",
}) => {
    const [selectedPortal, setSelectedPortal] = useState<string>("all");
    const [hoveredCell, setHoveredCell] = useState<DaySubmissionCell | null>(null);

    const effectiveUser = (username || "").trim();
    const dispatch = useAppDispatch();
    const remoteData = useAppSelector((state) => state.development.dataByUser[effectiveUser]);

    const weeksCount = 52; // Full 1 Year activity heatmap

    const gh = connectedPortals?.github || connectedPortals?.["GitHub"] || connectedPortals?.["Github"];
    const rawGhHandle = useMemo(() => {
        if (typeof gh === "object" && gh) {
            return (gh.username || gh.portal_username || gh.handle || "").trim();
        }
        if (typeof gh === "string") {
            return gh.trim();
        }
        return "";
    }, [gh]);
    const githubHandle = rawGhHandle.toLowerCase();

    const analyticsData = useAppSelector((state) => state.developmentAnalytics.dataByUser[effectiveUser]);
    const isAnalyticsLoading = useAppSelector(
        (state) => state.developmentAnalytics.loadingByUser[effectiveUser] || false
    );

    const prevGhRef = React.useRef<string | null>(null);

    // Fetch unified development contributions dynamically when github connection changes
    useEffect(() => {
        if (!effectiveUser) return;
        if (prevGhRef.current === null) {
            prevGhRef.current = githubHandle;
            dispatch(fetchUnifiedDevelopment({ username: effectiveUser, portals: connectedPortals }));
        } else if (prevGhRef.current !== githubHandle) {
            prevGhRef.current = githubHandle;
            dispatch(clearDevelopmentCache(effectiveUser));
            dispatch(fetchUnifiedDevelopment({ username: effectiveUser, force: true, portals: connectedPortals }));
        }
    }, [effectiveUser, githubHandle, connectedPortals, dispatch]);

    // Fetch development analytics if not loaded yet
    useEffect(() => {
        if (!effectiveUser) return;
        if (!analyticsData && !isAnalyticsLoading) {
            dispatch(
                fetchDevelopmentAnalytics({
                    username: effectiveUser,
                    githubHandle: rawGhHandle || effectiveUser,
                    portals: connectedPortals,
                })
            );
        }
    }, [effectiveUser, rawGhHandle, connectedPortals, analyticsData, isAnalyticsLoading, dispatch]);

    // Compute fallback client development aggregation
    const clientAgg = useMemo(() => {
        return aggregateClientDevelopmentContributions(connectedPortals, weeksCount);
    }, [connectedPortals, weeksCount]);

    // Active combined data
    const totalContributions = remoteData ? (remoteData.totalContributions || remoteData.totalSubmissions) : clientAgg.totalSubmissions;
    const activeDays = remoteData ? remoteData.activeDays : clientAgg.activeDays;
    const dayStreak = remoteData ? remoteData.dayStreak : clientAgg.dayStreak;
    const platformBreakdown = remoteData && Object.keys(remoteData.platformBreakdown).length > 0
        ? remoteData.platformBreakdown
        : clientAgg.platformBreakdown;

    // Build weeks from dailyMerged if remoteData is available, filtered by selected portal
    const { weeks, monthNames } = useMemo(() => {
        const rawMap = remoteData?.dailyMerged || {};
        if (Object.keys(rawMap).length > 0) {
            let filteredMap = rawMap;
            if (selectedPortal !== "all") {
                filteredMap = {};
                for (const [d, entry] of Object.entries(rawMap)) {
                    if (entry.platforms.includes(selectedPortal)) {
                        filteredMap[d] = entry;
                    }
                }
            }
            return buildWeeklySubmissionColumns(filteredMap, weeksCount);
        }
        return { weeks: clientAgg.weeks, monthNames: clientAgg.monthNames };
    }, [remoteData, selectedPortal, weeksCount, clientAgg]);

    // Circular Curvy Green Shader mapping
    const getCellColor = (level: 0 | 1 | 2 | 3 | 4) => {
        switch (level) {
            case 4:
                return "bg-[#39d353] border-[#72ff8f] shadow-[0_0_12px_rgba(57,211,83,0.85)]";
            case 3:
                return "bg-[#26a641] border-[#3ee667] shadow-[0_0_8px_rgba(38,166,65,0.6)]";
            case 2:
                return "bg-[#006d32] border-[#20964c] shadow-[0_0_5px_rgba(0,109,50,0.45)]";
            case 1:
                return "bg-[#0e4429] border-[#1b7342]/70 shadow-[0_0_3px_rgba(14,68,41,0.35)]";
            case 0:
            default:
                return "bg-[#141b25] border-white/[0.08]";
        }
    };

    // Series of platforms sorted strictly from largest number of contributions to lowest
    // ONLY display platforms where contributions can be extracted (count > 0)
    const connectedPlatformsList = useMemo(() => {
        return Object.values(platformBreakdown)
            .filter((p) => {
                const count = Math.max(p.submissions || 0, p.solved || 0);
                return count > 0;
            })
            .sort((a, b) => {
                const countA = Math.max(a.submissions || 0, a.solved || 0);
                const countB = Math.max(b.submissions || 0, b.solved || 0);
                if (countB !== countA) return countB - countA;
                return a.portal.localeCompare(b.portal);
            });
    }, [platformBreakdown]);

    // Reset selected portal back to "all" if the currently selected portal is no longer in the list
    useEffect(() => {
        if (selectedPortal !== "all" && !connectedPlatformsList.some((p) => p.portal === selectedPortal)) {
            setSelectedPortal("all");
        }
    }, [selectedPortal, connectedPlatformsList]);

    const isGitHubConnected = useMemo(() => {
        return Boolean(githubHandle);
    }, [githubHandle]);

    if (!isGitHubConnected) {
        return (
            <div className="w-full rounded-3xl bg-black text-white p-8 sm:p-12 border border-neutral-800 shadow-2xl relative overflow-hidden select-none">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-5">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-xl">
                        <GitBranch className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Development Field</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            GitHub Profile Not Connected
                        </h3>
                        <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
                            Connect your GitHub profile to automatically sync your repository contributions, commits, pull requests, issues, and live 365-day development heatmaps.
                        </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <Link
                            to="/onboarding"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <span>Connect GitHub Platform</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/profile"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-bold text-xs border border-white/10 transition-all cursor-pointer"
                        >
                            <span>Manage Profile</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full rounded-3xl bg-black text-white p-6 sm:p-8 border border-neutral-800 shadow-2xl relative overflow-hidden select-none">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-sky-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-lg">
                        <GitBranch className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                                Development Activity
                            </h3>
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                                <span>GitHub Development</span>
                            </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-medium mt-1">
                            Merged development contributions, repositories & commits from GitHub
                        </p>
                    </div>
                </div>

                {rawGhHandle && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <a
                            href={`https://github.com/${rawGhHandle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm group"
                            title={`View ${rawGhHandle} on GitHub`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>@{rawGhHandle}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
                        </a>
                    </div>
                )}
            </div>

            {/* 4 Metric Stats: Contributions, Repositories, Stars, Followers */}
            <div className="py-5 my-2 border-t border-white/[0.08] relative z-10">
                <DevelopmentMetricCards
                    data={analyticsData}
                    isLoading={isAnalyticsLoading}
                    totalContributionsFallback={totalContributions}
                />
            </div>

            {/* Platform Filter Chips Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-3 my-2 border-y border-white/[0.08] relative z-10 scrollbar-none">
                <button
                    type="button"
                    onClick={() => setSelectedPortal("all")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                        selectedPortal === "all"
                            ? "bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                            : "bg-white/[0.05] hover:bg-white/[0.09] text-neutral-300 border border-white/10"
                    }`}
                >
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Platforms ({connectedPlatformsList.length})</span>
                </button>

                {connectedPlatformsList.map((plat) => {
                    const isSelected = selectedPortal === plat.portal;
                    return (
                        <button
                            key={plat.portal}
                            type="button"
                            onClick={() => setSelectedPortal(plat.portal)}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                                isSelected
                                    ? "bg-white text-black shadow-md font-black"
                                    : "bg-white/[0.05] hover:bg-white/[0.09] text-neutral-300 border border-white/10"
                            }`}
                        >
                            <div className="w-4 h-4 flex items-center justify-center">
                                {getPortalIcon(plat.portal, "w-full h-full object-contain")}
                            </div>
                            <span className="capitalize">{plat.portal}</span>
                            <span className="text-[10px] font-mono opacity-70 px-1.5 py-0.5 rounded-md bg-white/10">
                                {Math.max(plat.submissions || 0, plat.solved || 0)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Heatmap Area: Uncovered, Circular Curvy Green Dots with Spaces */}
            <div className="py-4 relative z-10 overflow-x-auto scrollbar-none">
                <div className="min-w-[700px] flex flex-col space-y-2">
                    {/* Month Labels Row aligned across columns */}
                    <div
                        className="grid text-[11px] font-mono text-neutral-300 font-semibold select-none pl-7 pr-1"
                        style={{ gridTemplateColumns: `repeat(${monthNames.length}, minmax(0, 1fr))` }}
                    >
                        {monthNames.map((m, idx) => (
                            <span key={idx} className="block text-left">
                                {m}
                            </span>
                        ))}
                    </div>

                    {/* Day Labels Column + Week Columns Grid */}
                    <div className="flex items-center gap-2.5">
                        {/* Day labels (Sun through Sat, showing Mon, Wed, Fri aligned with square rows) */}
                        <div className="flex flex-col gap-1.5 text-[10px] font-mono text-neutral-400 select-none w-5 flex-shrink-0 text-right">
                            <div className="aspect-square flex items-center justify-end leading-none" />
                            <div className="aspect-square flex items-center justify-end leading-none">Mon</div>
                            <div className="aspect-square flex items-center justify-end leading-none" />
                            <div className="aspect-square flex items-center justify-end leading-none">Wed</div>
                            <div className="aspect-square flex items-center justify-end leading-none" />
                            <div className="aspect-square flex items-center justify-end leading-none">Fri</div>
                            <div className="aspect-square flex items-center justify-end leading-none" />
                        </div>

                        {/* Weekly Columns Grid with Circular Curvy Dots */}
                        <div className="flex-1 flex items-center justify-between gap-1.5">
                            {weeks.map((week, wIdx) => (
                                <div key={wIdx} className="flex flex-col gap-1.5 flex-1">
                                    {week.map((day, dIdx) => (
                                        <div
                                            key={dIdx}
                                            onMouseEnter={() => setHoveredCell(day)}
                                            onMouseLeave={() => setHoveredCell(null)}
                                            title={`${day.count} contributions on ${day.displayDate}${
                                                day.platforms.length > 0 ? ` (${day.platforms.join(", ")})` : ""
                                            }`}
                                            className={`w-full aspect-square rounded-full border transition-all duration-200 hover:scale-140 cursor-pointer ${getCellColor(
                                                day.level
                                            )}`}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hover Tooltip Info Banner if cell is hovered */}
            <div className="min-h-[26px] flex items-center text-xs font-mono text-neutral-300 pt-1">
                {hoveredCell ? (
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{hoveredCell.displayDate}:</span>
                        <span className="text-emerald-400 font-bold">
                            {hoveredCell.count === 0
                                ? "No contributions"
                                : `${hoveredCell.count} ${hoveredCell.count === 1 ? "contribution" : "contributions"}`}
                        </span>
                        {hoveredCell.platforms.length > 0 && (
                            <span className="text-neutral-400">
                                via <span className="capitalize text-neutral-200">{hoveredCell.platforms.join(", ")}</span>
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-neutral-500 text-[11px]">Hover over any circular dot to view daily contribution breakdown.</span>
                )}
            </div>

            {/* Bottom Footer Row with Metrics and Circular Curvy Legend */}
            <div className="pt-4 mt-2 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-neutral-400 relative z-10">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                        <Flame className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                        <span>{dayStreak} day streak</span>
                    </div>
                    <span className="text-neutral-700">•</span>
                    <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span>{activeDays} active development days</span>
                    </div>
                    <span className="text-neutral-700">•</span>
                    <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{connectedPlatformsList.length} platform{connectedPlatformsList.length === 1 ? "" : "s"} synced</span>
                    </div>
                </div>

                {/* Circular Curvy Legend: Less (o)(o)(o)(o)(o) More */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Less</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#141b25] border border-white/[0.08]" />
                        <span className="w-3 h-3 rounded-full bg-[#0e4429] border border-[#1b7342]" />
                        <span className="w-3 h-3 rounded-full bg-[#006d32] border border-[#20964c]" />
                        <span className="w-3 h-3 rounded-full bg-[#26a641] border border-[#3ee667]" />
                        <span className="w-3 h-3 rounded-full bg-[#39d353] border border-[#72ff8f] shadow-[0_0_8px_rgba(57,211,83,0.7)]" />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400">More</span>
                </div>
            </div>
        </div>
    );
};
