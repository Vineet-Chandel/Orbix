import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    GitCommit,
    Flame,
    Calendar,
    Code2,
    Layers,
    Sparkles,
    CheckCircle2,
    ArrowRight,
} from "lucide-react";
import { useAppDispatch, useAppSelector, fetchUnifiedSubmissions, invalidateSubmissions } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import {
    aggregateClientPortalsSubmissions,
    buildWeeklySubmissionColumns,
    type DaySubmissionCell,
    type PlatformSubmissionStat,
} from "../../utils/submissionsAggregator";

interface CodingSubmissionsTableProps {
    connectedPortals: Record<string, any>;
    username?: string;
}

export const CodingSubmissionsTable: React.FC<CodingSubmissionsTableProps> = ({
    connectedPortals,
    username = "",
}) => {
    const [selectedPortal, setSelectedPortal] = useState<string>("all");
    const [hoveredCell, setHoveredCell] = useState<DaySubmissionCell | null>(null);

    const effectiveUser = (username || "").trim();
    const dispatch = useAppDispatch();
    const remoteData = useAppSelector((state) => state.submissions.dataByUser[effectiveUser]);

    const weeksCount = 52; // Full 1 Year activity heatmap

    const user = useAppSelector((state) => state.user.user);

    // Map of currently active connected portals and usernames (strictly excluding GitHub)
    const activePortalsMap = useMemo(() => {
        const map = new Map<string, string>();
        if (connectedPortals && typeof connectedPortals === "object") {
            for (const [k, v] of Object.entries(connectedPortals)) {
                const lk = k.toLowerCase().trim();
                if (lk === "github" || lk.startsWith("_") || lk === "theme") continue;
                const handle = (v?.username || v?.portal_username || "").trim().toLowerCase();
                if (handle) map.set(lk, handle);
            }
        }
        // Fallback to user.platforms from Redux if map is empty
        if (map.size === 0 && user?.platforms && Array.isArray(user.platforms)) {
            for (const p of user.platforms) {
                const lk = (p.portal || "").toLowerCase().trim();
                if (lk === "github") continue;
                const handle = (p.portalUsername || p.portal_username || p.username || "").trim().toLowerCase();
                if (handle) map.set(lk, handle);
            }
        }
        return map;
    }, [connectedPortals, user?.platforms]);

    // Unique fingerprint of currently connected non-github portals
    const portalsFingerprint = useMemo(() => {
        if (!connectedPortals) return "";
        return Array.from(activePortalsMap.entries())
            .map(([portal, handle]) => `${portal}:${handle}`)
            .sort()
            .join(",");
    }, [activePortalsMap]);

    // Track platform changes dynamically: whenever connected accounts change, re-sync immediately
    const prevFingerprintRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!effectiveUser) return;

        if (prevFingerprintRef.current === null) {
            prevFingerprintRef.current = portalsFingerprint;
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, portals: connectedPortals }));
        } else if (prevFingerprintRef.current !== portalsFingerprint) {
            prevFingerprintRef.current = portalsFingerprint;
            // Platforms were added, changed, or removed: immediately invalidate cache and force fresh data
            dispatch(invalidateSubmissions(effectiveUser));
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, force: true, portals: connectedPortals }));
        }
    }, [effectiveUser, portalsFingerprint, connectedPortals, dispatch]);

    // Compute instant fallback client aggregation
    const clientAgg = useMemo(() => {
        return aggregateClientPortalsSubmissions(connectedPortals, weeksCount);
    }, [connectedPortals, weeksCount]);

    // Dynamically filtered platform breakdown: ONLY contains currently connected platforms
    const platformBreakdown = useMemo(() => {
        const source = remoteData && Object.keys(remoteData.platformBreakdown).length > 0
            ? remoteData.platformBreakdown
            : clientAgg.platformBreakdown;

        const result: Record<string, PlatformSubmissionStat> = {};

        // 1. Include server platform stats ONLY if the platform is currently connected
        for (const [portal, stat] of Object.entries(source)) {
            const lk = portal.toLowerCase().trim();
            if (lk === "github") continue;
            if (!activePortalsMap.has(lk)) continue; // STRICTLY PRUNE REMOVED PLATFORMS

            const activeHandle = activePortalsMap.get(lk);
            if (stat.username && stat.username.toLowerCase().trim() !== activeHandle) continue;

            result[lk] = stat;
        }

        // 2. Include any newly added client platforms that might not be in remoteData yet
        for (const [portal, stat] of Object.entries(clientAgg.platformBreakdown)) {
            const lk = portal.toLowerCase().trim();
            if (lk === "github") continue;
            if (activePortalsMap.has(lk) && !result[lk]) {
                result[lk] = stat;
            }
        }

        return result;
    }, [remoteData, clientAgg, activePortalsMap]);

    // Series of platforms sorted strictly from largest number of submissions to lowest
    // ONLY display platforms that the user is currently connected to and count > 0
    const connectedPlatformsList = useMemo(() => {
        return Object.values(platformBreakdown)
            .filter((p) => {
                if (p.portal === "github") return false;
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

    // Build weeks, daily counts, and totals from sanitized data (strictly excluding removed platforms)
    const { weeks, monthNames, totalSubmissions, activeDays, dayStreak } = useMemo(() => {
        const rawMap = remoteData?.dailyMerged || {};
        const activePortalsSet = new Set(Object.keys(platformBreakdown));

        const sanitizedMap: Record<string, { count: number; platforms: string[] }> = {};
        let totalCount = 0;

        if (Object.keys(rawMap).length > 0) {
            for (const [dateStr, entry] of Object.entries(rawMap)) {
                const filteredPlatforms = (entry.platforms || []).filter((p) => activePortalsSet.has(p.toLowerCase()));
                if (filteredPlatforms.length === 0) continue;

                if (selectedPortal !== "all" && !filteredPlatforms.includes(selectedPortal)) {
                    continue;
                }

                let cellCount = entry.count;
                if ((entry as any).platformCounts) {
                    cellCount = filteredPlatforms.reduce(
                        (sum, p) => sum + ((entry as any).platformCounts[p] || 0),
                        0
                    );
                }
                if (cellCount <= 0) cellCount = 1;

                sanitizedMap[dateStr] = {
                    count: cellCount,
                    platforms: filteredPlatforms,
                };
                totalCount += cellCount;
            }
        } else {
            // Instant client fallback
            for (const [dateStr, cell] of clientAgg.weeks.flat().map((c) => [c.dateStr, c] as const)) {
                if (cell.count <= 0) continue;
                const filteredPlatforms = cell.platforms.filter((p) => activePortalsSet.has(p.toLowerCase()));
                if (filteredPlatforms.length === 0) continue;
                if (selectedPortal !== "all" && !filteredPlatforms.includes(selectedPortal)) continue;

                sanitizedMap[dateStr] = {
                    count: cell.count,
                    platforms: filteredPlatforms,
                };
                totalCount += cell.count;
            }
        }

        const built = buildWeeklySubmissionColumns(sanitizedMap, weeksCount);
        const daysCount = Object.keys(sanitizedMap).length;

        const sumPlatform = Object.values(platformBreakdown).reduce(
            (acc, p) => acc + Math.max(p.submissions || 0, p.solved || 0),
            0
        );

        const finalTotal = selectedPortal === "all"
            ? Math.max(totalCount, sumPlatform)
            : (platformBreakdown[selectedPortal]?.submissions || totalCount);

        let streak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split("T")[0] || "";
            const entry = sanitizedMap[dateStr];
            if (entry && entry.count > 0) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }

        return {
            weeks: built.weeks,
            monthNames: built.monthNames,
            totalSubmissions: finalTotal,
            activeDays: daysCount || (finalTotal > 0 ? 1 : 0),
            dayStreak: Math.max(streak, finalTotal > 0 ? 1 : 0),
        };
    }, [remoteData, clientAgg, platformBreakdown, selectedPortal, weeksCount]);

    // Circular Curvy Green Accent Shader mapping
    const getCellColor = (level: 0 | 1 | 2 | 3 | 4) => {
        switch (level) {
            case 4:
                return "bg-[#216e39] border-[#17562a] shadow-2xs";
            case 3:
                return "bg-[#30a14e] border-[#248941]";
            case 2:
                return "bg-[#40c463] border-[#33b255]";
            case 1:
                return "bg-[#9be9a8] border-[#7cd88c]";
            case 0:
            default:
                return "bg-neutral-100 border-neutral-200/90 hover:border-emerald-300";
        }
    };

    const hasConnectedPlatforms = useMemo(() => {
        return activePortalsMap.size > 0;
    }, [activePortalsMap]);

    if (!hasConnectedPlatforms) {
        return (
            <div className="w-full rounded-2xl bg-white text-neutral-900 p-8 sm:p-12 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none">
                <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-neutral-900 shadow-[3px_3px_0px_#000]">
                        <Code2 className="w-8 h-8 text-black" />
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                            <Sparkles className="w-3.5 h-3.5 text-black" />
                            <span>Practice Field</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            No Practice Platforms Connected
                        </h3>
                        <p className="text-sm text-neutral-700 leading-relaxed max-w-md font-bold">
                            Connect your coding handles (LeetCode, Codeforces, HackerRank, CodeChef, AtCoder & more) to track daily submissions, active streaks, and solve metrics.
                        </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <Link
                            to="/onboarding"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black hover:bg-neutral-900 text-[#a2ff86] font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        >
                            <span>Connect Coding Platforms</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/profile"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-200 text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        >
                            <span>Manage Profile</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full rounded-2xl bg-white text-neutral-900 p-6 sm:p-7 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none">
            {/* Top Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                        <Code2 className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                                Practice Activity
                            </h3>
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                <Sparkles className="w-3 h-3 text-black" />
                                <span>Multi-Platform Practice</span>
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-bold mt-1">
                            Merged problem solving and practice submissions from all connected platforms (excluding GitHub)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5 flex-shrink-0">
                    {/* Total Submissions Metric */}
                    <div className="text-left md:text-right">
                        <span className="text-3xl sm:text-4xl font-mono font-black text-black block leading-none">
                            {totalSubmissions.toLocaleString()}
                        </span>
                        <div className="inline-flex items-center md:justify-end gap-1.5 text-xs font-black uppercase tracking-wider text-black mt-1.5 bg-[#FAF6EE] border-2 border-black px-2.5 py-0.5 rounded-lg shadow-[1px_1px_0px_#000]">
                            <GitCommit className="w-3.5 h-3.5 text-black" />
                            <span>Submissions Done</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Filter Chips Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-3 my-2 border-y-2 border-black/15 relative z-10 scrollbar-none">
                <button
                    type="button"
                    onClick={() => setSelectedPortal("all")}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex-shrink-0 border-2 border-black shadow-[2px_2px_0px_#000] ${
                        selectedPortal === "all"
                            ? "bg-black text-[#a2ff86]"
                            : "bg-[#FAF6EE] hover:bg-neutral-200 text-black"
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
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex-shrink-0 border-2 border-black shadow-[2px_2px_0px_#000] ${
                                isSelected
                                    ? "bg-black text-[#a2ff86]"
                                    : "bg-[#FAF6EE] hover:bg-neutral-200 text-black"
                            }`}
                        >
                            <div className="w-4 h-4 flex items-center justify-center">
                                {getPortalIcon(plat.portal, "w-full h-full object-contain")}
                            </div>
                            <span className="capitalize">{plat.portal}</span>
                            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-black ${
                                isSelected ? "bg-[#a2ff86] text-black" : "bg-white text-black"
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
                        className="grid text-xs font-mono text-black font-black select-none pl-7 pr-1"
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
                        <div className="flex flex-col gap-1.5 text-[11px] font-mono text-neutral-600 font-bold select-none w-5 flex-shrink-0 text-right">
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
                                            title={`${day.count} submissions on ${day.displayDate}${
                                                day.platforms.length > 0 ? ` (${day.platforms.join(", ")})` : ""
                                            }`}
                                            className={`w-full aspect-square rounded-full border transition-all duration-200 hover:scale-130 cursor-pointer ${getCellColor(
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
            <div className="min-h-[32px] flex items-center text-xs sm:text-sm font-mono text-neutral-800 pt-1">
                {hoveredCell ? (
                    <div className="inline-flex items-center gap-2 bg-[#FAF6EE] border-2 border-black rounded-xl px-3 py-1 shadow-[2px_2px_0px_#000]">
                        <span className="font-black text-black">{hoveredCell.displayDate}:</span>
                        <span className="text-black font-black bg-[#a2ff86] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                            {hoveredCell.count === 0
                                ? "No submissions"
                                : `${hoveredCell.count} ${hoveredCell.count === 1 ? "submission" : "submissions"}`}
                        </span>
                        {hoveredCell.platforms.length > 0 && (
                            <span className="text-neutral-700 font-sans font-bold">
                                via <span className="capitalize text-black font-black">{hoveredCell.platforms.join(", ")}</span>
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-neutral-600 text-xs font-bold font-sans">Hover over any circular dot to view daily submission breakdown.</span>
                )}
            </div>

            {/* Bottom Footer Row with Metrics and Circular Curvy Legend */}
            <div className="pt-4 mt-2 border-t-2 border-black/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-neutral-800 relative z-10">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                        <Flame className="w-4 h-4 text-black" />
                        <span>{dayStreak} day streak</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                        <Calendar className="w-4 h-4 text-black" />
                        <span>{activeDays} active coding days</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                        <CheckCircle2 className="w-4 h-4 text-black" />
                        <span>{connectedPlatformsList.length} platform{connectedPlatformsList.length === 1 ? "" : "s"} synced</span>
                    </div>
                </div>

                {/* Circular Curvy Legend: Less (o)(o)(o)(o)(o) More */}
                <div className="flex items-center gap-2 flex-shrink-0 bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1 shadow-[2px_2px_0px_#000]">
                    <span className="text-[10px] uppercase font-black text-black tracking-wider">Less</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-neutral-100 border border-neutral-400" />
                        <span className="w-3 h-3 rounded-full bg-[#9be9a8] border border-[#7cd88c]" />
                        <span className="w-3 h-3 rounded-full bg-[#40c463] border border-[#33b255]" />
                        <span className="w-3 h-3 rounded-full bg-[#30a14e] border border-[#248941]" />
                        <span className="w-3 h-3 rounded-full bg-[#216e39] border border-[#17562a] shadow-xs" />
                    </div>
                    <span className="text-[10px] uppercase font-black text-black tracking-wider">More</span>
                </div>
            </div>
        </div>
    );
};
