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
import { DevelopmentActivityCharts } from "./DevelopmentAnalytics/DevelopmentActivityCharts";
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

    const user = useAppSelector((state) => state.user.user);

    const gh = connectedPortals?.github || connectedPortals?.["GitHub"] || connectedPortals?.["Github"];
    const rawGhHandle = useMemo(() => {
        if (typeof gh === "object" && gh) {
            const h = (gh.username || gh.portal_username || gh.handle || "").trim();
            if (h) return h;
        }
        if (typeof gh === "string" && gh.trim()) {
            return gh.trim();
        }
        // Fallback to user.platforms or user.github from Redux
        if (user?.platforms && Array.isArray(user.platforms)) {
            const ghPlatform = user.platforms.find(
                (p: any) => (p.portal || "").toLowerCase() === "github"
            );
            if (ghPlatform) {
                const h = (ghPlatform.portalUsername || ghPlatform.portal_username || ghPlatform.username || "").trim();
                if (h) return h;
            }
        }
        if (user?.github) {
            return user.github.trim();
        }
        return "";
    }, [gh, user?.platforms, user?.github]);
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

    // Neo-Brutalist Green Accent Shader mapping
    const getCellColor = (level: 0 | 1 | 2 | 3 | 4) => {
        switch (level) {
            case 4:
                return "bg-[#115e24] border-black shadow-[1px_1px_0px_#000]";
            case 3:
                return "bg-[#22c55e] border-black shadow-[1px_1px_0px_#000]";
            case 2:
                return "bg-[#4ade80] border-black";
            case 1:
                return "bg-[#a2ff86] border-black";
            case 0:
            default:
                return "bg-[#FAF6EE] border-black/25 hover:border-black";
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
            <div className="w-full rounded-2xl bg-white text-black p-8 sm:p-12 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none">
                <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_#000]">
                        <GitBranch className="w-8 h-8 text-black" />
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                            <Sparkles className="w-3.5 h-3.5 text-black" />
                            <span>Development Field</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            GitHub Profile Not Connected
                        </h3>
                        <p className="text-sm text-neutral-600 leading-relaxed max-w-md font-medium">
                            Connect your GitHub profile to automatically sync your repository contributions, commits, pull requests, issues, and live 365-day development heatmaps.
                        </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <Link
                            to="/onboarding"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                        >
                            <span>Connect GitHub Platform</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/profile"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#FAF6EE] hover:bg-white text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer"
                        >
                            <span>Manage Profile</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full rounded-2xl bg-white text-black p-6 sm:p-8 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none">
            {/* Top Header Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                        <GitBranch className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                                Development Activity
                            </h3>
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF6EE] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                <Sparkles className="w-3 h-3 text-black" />
                                <span>GitHub Development</span>
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium mt-1">
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
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] border-2 border-black text-xs sm:text-sm font-mono font-black text-black transition-all cursor-pointer shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 group"
                            title={`View ${rawGhHandle} on GitHub`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-black" />
                            <span>@{rawGhHandle}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-black group-hover:translate-x-0.5 transition-transform" />
                        </a>
                    </div>
                )}
            </div>

            {/* 4 Metric Stats: Contributions, Repositories, Stars, Followers */}
            <div className="py-5 my-2 border-t-2 border-black/10 relative z-10">
                <DevelopmentMetricCards
                    data={analyticsData}
                    isLoading={isAnalyticsLoading}
                    totalContributionsFallback={totalContributions}
                />
            </div>

            {/* Platform Filter Chips Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-3 my-2 border-y-2 border-black/10 relative z-10 scrollbar-none">
                <button
                    type="button"
                    onClick={() => setSelectedPortal("all")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer flex-shrink-0 ${
                        selectedPortal === "all"
                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] font-black"
                            : "bg-[#FAF6EE] hover:bg-white text-black border-2 border-black shadow-[1px_1px_0px_#000] font-bold"
                    }`}
                >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">All Platforms</span>
                    <span className="sm:hidden">All</span>
                    <span>({connectedPlatformsList.length})</span>
                </button>

                {connectedPlatformsList.map((plat) => {
                    const isSelected = selectedPortal === plat.portal;
                    return (
                        <button
                            key={plat.portal}
                            type="button"
                            onClick={() => setSelectedPortal(plat.portal)}
                            title={plat.portal}
                            aria-label={plat.portal}
                            className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-all cursor-pointer flex-shrink-0 ${
                                isSelected
                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] font-black"
                                    : "bg-[#FAF6EE] hover:bg-white text-black border-2 border-black shadow-[1px_1px_0px_#000] font-bold"
                            }`}
                        >
                            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                {getPortalIcon(plat.portal, "w-full h-full object-contain")}
                            </div>
                            <span className="portal-tab-label hidden sm:inline capitalize">{plat.portal}</span>
                            <span className={`text-xs font-mono font-black px-1.5 py-0.5 rounded-md border border-black ${
                                isSelected ? "bg-[#a2ff86] text-black" : "bg-black/5 text-black"
                            }`}>
                                {Math.max(plat.submissions || 0, plat.solved || 0)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Heatmap Area: Uncovered, Circular Curvy Monochrome Dots with Spaces */}
            <div className="py-4 relative z-10 overflow-x-auto scrollbar-none">
                <div className="min-w-[700px] flex flex-col space-y-2">
                    {/* Month Labels Row aligned across columns */}
                    <div
                        className="grid text-xs font-mono text-black/70 font-black select-none pl-7 pr-1"
                        style={{ gridTemplateColumns: `repeat(${monthNames.length}, minmax(0, 1fr))` }}
                    >
                        {monthNames.map((m, idx) => (
                            <span key={idx} className="block text-left uppercase text-[10px] tracking-wider">
                                {m}
                            </span>
                        ))}
                    </div>

                    {/* Day Labels Column + Week Columns Grid */}
                    <div className="flex items-center gap-2.5">
                        {/* Day labels (Sun through Sat, showing Mon, Wed, Fri aligned with square rows) */}
                        <div className="flex flex-col gap-1.5 text-[11px] font-mono text-black/60 font-black select-none w-5 flex-shrink-0 text-right">
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
                                            className={`w-full aspect-square rounded-full border transition-all duration-150 hover:scale-130 cursor-pointer ${getCellColor(
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
            <div className="min-h-[36px] flex items-center text-xs sm:text-sm font-mono text-black pt-1">
                {hoveredCell ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="font-black text-black">{hoveredCell.displayDate}:</span>
                        <span className="text-black font-black bg-[#a2ff86] px-2 py-0.5 rounded-md border border-black">
                            {hoveredCell.count === 0
                                ? "No contributions"
                                : `${hoveredCell.count} ${hoveredCell.count === 1 ? "contribution" : "contributions"}`}
                        </span>
                        {hoveredCell.platforms.length > 0 && (
                            <span className="text-neutral-700 font-sans font-medium text-xs">
                                via <span className="capitalize text-black font-black">{hoveredCell.platforms.join(", ")}</span>
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-neutral-500 text-xs font-sans font-medium">Hover over any circular dot to view daily contribution breakdown.</span>
                )}
            </div>

            {/* Bottom Footer Row with Metrics and Circular Curvy Legend */}
            <div className="pt-4 mt-2 border-t-2 border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-neutral-600 relative z-10">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-black font-black">
                        <Flame className="w-3.5 h-3.5 text-black" />
                        <span>{dayStreak} day streak</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-black font-black">
                        <Calendar className="w-3.5 h-3.5 text-black" />
                        <span>{activeDays} active days</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-black font-black">
                        <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                        <span>{connectedPlatformsList.length} platform{connectedPlatformsList.length === 1 ? "" : "s"}</span>
                    </div>
                </div>

                {/* Circular Curvy Legend: Less (o)(o)(o)(o)(o) More */}
                <div className="flex items-center gap-2 flex-shrink-0 bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-1 rounded-full">
                    <span className="text-[10px] uppercase font-black text-black tracking-wider">Less</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#FAF6EE] border border-black/30" />
                        <span className="w-3 h-3 rounded-full bg-[#a2ff86] border border-black" />
                        <span className="w-3 h-3 rounded-full bg-[#4ade80] border border-black" />
                        <span className="w-3 h-3 rounded-full bg-[#22c55e] border border-black" />
                        <span className="w-3 h-3 rounded-full bg-[#115e24] border border-black shadow-xs" />
                    </div>
                    <span className="text-[10px] uppercase font-black text-black tracking-wider">More</span>
                </div>
            </div>

            {/* Dynamic Development Activity Charts: Contributions by month & Coding days */}
            <div className="pt-6 mt-6 border-t-2 border-black/10 relative z-10">
                <DevelopmentActivityCharts
                    dailyMerged={remoteData?.dailyMerged || clientAgg.dailyMerged}
                    serverCharts={remoteData?.charts || clientAgg.charts}
                    totalContributions={totalContributions}
                    username={effectiveUser}
                    githubHandle={rawGhHandle || effectiveUser}
                />
            </div>
        </div>
    );
};
