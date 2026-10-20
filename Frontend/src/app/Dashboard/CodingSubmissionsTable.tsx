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

    const hasConnectedPlatforms = useMemo(() => {
        return activePortalsMap.size > 0;
    }, [activePortalsMap]);

    if (!hasConnectedPlatforms) {
        return (
            <div className="w-full rounded-3xl bg-black text-white p-8 sm:p-12 border border-neutral-800 shadow-2xl relative overflow-hidden select-none">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-5">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-xl">
                        <Code2 className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Practice Field</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            No Practice Platforms Connected
                        </h3>
                        <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
                            Connect your coding handles (LeetCode, Codeforces, HackerRank, CodeChef, AtCoder & more) to track daily submissions, active streaks, and solve metrics.
                        </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <Link
                            to="/onboarding"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <span>Connect Coding Platforms</span>
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
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-lg">
                        <Code2 className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                                Practice Activity
                            </h3>
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                                <span>Multi-Platform Practice</span>
                            </span>
                        </div>
                        <p className="text-xs text-neutral-400 font-medium mt-1">
                            Merged problem solving and practice submissions from all connected platforms (excluding GitHub)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5 flex-shrink-0">
                    {/* Total Submissions Metric */}
                    <div className="text-right">
                        <span className="text-3xl sm:text-4xl font-mono font-black text-emerald-400 block leading-none">
                            {totalSubmissions.toLocaleString()}
                        </span>
                        <div className="flex items-center justify-end gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 mt-1">
                            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Submissions Done</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Filter Chips Row */}
            <div className="flex items-center gap-2 overflow-x-auto py-3 my-2 border-y border-white/[0.06] relative z-10 scrollbar-none">
                <button
                    type="button"
                    onClick={() => setSelectedPortal("all")}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                        selectedPortal === "all"
                            ? "bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]"
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
                                            title={`${day.count} submissions on ${day.displayDate}${
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
                                ? "No submissions"
                                : `${hoveredCell.count} ${hoveredCell.count === 1 ? "submission" : "submissions"}`}
                        </span>
                        {hoveredCell.platforms.length > 0 && (
                            <span className="text-neutral-400">
                                via <span className="capitalize text-neutral-200">{hoveredCell.platforms.join(", ")}</span>
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-neutral-500 text-[11px]">Hover over any circular dot to view daily submission breakdown.</span>
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
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>{activeDays} active coding days</span>
                    </div>
                    <span className="text-neutral-700">•</span>
                    <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                        <span>{connectedPlatformsList.length} platforms synced</span>
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
