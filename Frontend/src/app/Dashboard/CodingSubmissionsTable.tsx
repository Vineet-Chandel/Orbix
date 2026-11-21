import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    GitCommit,
    Flame,
    Code2,
    Layers,
    Sparkles,
    CheckCircle2,
    ArrowRight,
    Trophy,
    RotateCw,
} from "lucide-react";
import { useAppDispatch, useAppSelector, fetchUnifiedSubmissions, invalidateSubmissions } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import {
    CODING_PRACTICE_PLATFORMS,
    aggregateClientPortalsSubmissions,
    buildWeeklySubmissionColumns,
    calculateUnifiedStreak,
    normalizeDateKey,
    type DaySubmissionCell,
    type PlatformSubmissionStat,
} from "../../utils/submissionsAggregator";
import { InteractiveActivityHeatmap } from "../../components/charts/InteractiveActivityHeatmap";
import { isDemoProfileUsername, demoUnifiedSubmissions } from "../../data/demoProfileData";

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
    const isDemo = isDemoProfileUsername(effectiveUser);
    const dispatch = useAppDispatch();
    const reduxRemoteData = useAppSelector((state) => (effectiveUser ? state.submissions.dataByUser[effectiveUser] : undefined));
    const reduxLoading = useAppSelector((state) => (effectiveUser ? (state.submissions.loadingByUser[effectiveUser] && !state.submissions.dataByUser[effectiveUser]) : false));

    const remoteData = isDemo ? demoUnifiedSubmissions : reduxRemoteData;
    const isLoading = isDemo ? false : reduxLoading;

    const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

    // Calculate cooldown seconds from remoteData
    useEffect(() => {
        if (remoteData?.cooldownExpiresAt) {
            const diff = Math.ceil((remoteData.cooldownExpiresAt - Date.now()) / 1000);
            setCooldownSeconds(diff > 0 ? diff : 0);
        } else if (remoteData?.cooldownRemaining) {
            setCooldownSeconds(remoteData.cooldownRemaining > 0 ? remoteData.cooldownRemaining : 0);
        } else {
            setCooldownSeconds(0);
        }
    }, [remoteData?.cooldownExpiresAt, remoteData?.cooldownRemaining]);

    // Timer tick down every 1 second when cooldown is active
    useEffect(() => {
        if (cooldownSeconds <= 0) return;
        const timer = setInterval(() => {
            setCooldownSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldownSeconds]);

    const formatCooldownTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        if (m > 0) {
            return `${m}m ${s < 10 ? `0${s}` : s}s`;
        }
        return `${s}s`;
    };

    const handleSyncClick = () => {
        if (isDemo || cooldownSeconds > 0 || isLoading || !effectiveUser) return;
        dispatch(invalidateSubmissions(effectiveUser));
        dispatch(fetchUnifiedSubmissions({ username: effectiveUser, force: true, portals: connectedPortals }));
    };

    const weeksCount = 52; // Full 1 Year activity heatmap

    const user = useAppSelector((state) => state.user.user);

    // Map of currently active connected portals and usernames (strictly targeting verified coding platforms)
    const activePortalsMap = useMemo(() => {
        const map = new Map<string, string>();
        if (connectedPortals && typeof connectedPortals === "object") {
            for (const [k, v] of Object.entries(connectedPortals)) {
                const lk = k.toLowerCase().trim();
                if (!CODING_PRACTICE_PLATFORMS.has(lk)) continue;
                const handle = (v?.username || v?.portal_username || "").trim().toLowerCase();
                if (handle) map.set(lk, handle);
            }
        }
        // Fallback to user.platforms from Redux if map is empty
        if (map.size === 0 && user?.platforms && Array.isArray(user.platforms)) {
            for (const p of user.platforms) {
                const lk = (p.portal || "").toLowerCase().trim();
                if (!CODING_PRACTICE_PLATFORMS.has(lk)) continue;
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
        if (!effectiveUser || isDemo) return;

        if (prevFingerprintRef.current === null) {
            prevFingerprintRef.current = portalsFingerprint;
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, portals: connectedPortals }));
        } else if (prevFingerprintRef.current !== portalsFingerprint) {
            prevFingerprintRef.current = portalsFingerprint;
            // Platforms were added, changed, or removed: immediately invalidate cache and force fresh data
            dispatch(invalidateSubmissions(effectiveUser));
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, force: true, portals: connectedPortals }));
        }
    }, [effectiveUser, portalsFingerprint, connectedPortals, dispatch, isDemo]);

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
    // Displays all practice platforms the user currently has connected
    const connectedPlatformsList = useMemo(() => {
        const list = Object.values(platformBreakdown).filter((p) => p.portal !== "github");
        // Ensure every currently connected platform in activePortalsMap is represented
        for (const [portalKey, handle] of activePortalsMap.entries()) {
            if (!list.some((p) => p.portal.toLowerCase() === portalKey)) {
                list.push({
                    name: portalKey.charAt(0).toUpperCase() + portalKey.slice(1),
                    portal: portalKey,
                    username: handle,
                    solved: 0,
                    submissions: 0,
                    activeDays: 0,
                });
            }
        }
        return list.sort((a, b) => {
            const countA = Math.max(a.submissions || 0, a.solved || 0);
            const countB = Math.max(b.submissions || 0, b.solved || 0);
            if (countB !== countA) return countB - countA;
            return a.portal.localeCompare(b.portal);
        });
    }, [platformBreakdown, activePortalsMap]);

    // Reset selected portal back to "all" if the currently selected portal is no longer in the list
    useEffect(() => {
        if (selectedPortal !== "all" && !connectedPlatformsList.some((p) => p.portal === selectedPortal)) {
            setSelectedPortal("all");
        }
    }, [selectedPortal, connectedPlatformsList]);

    // Build weeks, daily counts, and totals from sanitized data (strictly excluding removed platforms)
    const { weeks, monthNames, totalSubmissions, streakMetrics } = useMemo(() => {
        // Robust multi-source calendar merger: merges client cached submissions with remote server submissions
        // so no connected platform's submission history is ever lost
        const rawMap: Record<string, { count: number; platforms: string[]; platformCounts?: Record<string, number> }> = {};

        if (clientAgg.dailyMerged) {
            for (const [dateKey, val] of Object.entries(clientAgg.dailyMerged)) {
                rawMap[dateKey] = {
                    count: val.count,
                    platforms: [...(val.platforms || [])],
                    platformCounts: { ...((val as any).platformCounts || {}) },
                };
            }
        }

        if (remoteData?.dailyMerged) {
            for (const [dateKey, val] of Object.entries(remoteData.dailyMerged)) {
                if (!rawMap[dateKey]) {
                    rawMap[dateKey] = {
                        count: val.count,
                        platforms: [...(val.platforms || [])],
                        platformCounts: { ...((val as any).platformCounts || {}) },
                    };
                } else {
                    const existing = rawMap[dateKey];
                    existing.count = Math.max(existing.count, val.count);
                    for (const p of val.platforms || []) {
                        if (!existing.platforms.includes(p)) {
                            existing.platforms.push(p);
                        }
                    }
                    if ((val as any).platformCounts) {
                        existing.platformCounts = {
                            ...(existing.platformCounts || {}),
                            ...((val as any).platformCounts || {}),
                        };
                    }
                }
            }
        }

        const activePortalsSet = new Set(Object.keys(platformBreakdown).map((p) => p.toLowerCase()));

        const sanitizedMap: Record<string, { count: number; platforms: string[] }> = {};
        let totalCount = 0;

        const isPlatformSpecific = selectedPortal !== "all";
        const targetPortal = selectedPortal.toLowerCase().trim();

        for (const [rawDateStr, entry] of Object.entries(rawMap)) {
            if (!entry || entry.count <= 0) continue;
            const dateStr = normalizeDateKey(rawDateStr) || rawDateStr;

            const entryPlatforms = (entry.platforms || []).map((p) => p.toLowerCase().trim());
            const platformCounts = (entry as any).platformCounts as Record<string, number> | undefined;

            if (isPlatformSpecific) {
                // Strictly verify if this entry has submissions for the selected platform
                let specificCount = 0;
                if (platformCounts && typeof platformCounts === "object") {
                    specificCount = platformCounts[targetPortal] ?? 0;
                } else if (entryPlatforms.length === 1 && entryPlatforms[0] === targetPortal) {
                    specificCount = entry.count;
                } else if (entryPlatforms.includes(targetPortal)) {
                    // Fallback if platformCounts was omitted
                    specificCount = entry.count;
                }

                // STRICT FILTERING: If there were 0 submissions on targetPortal on this day, SKIP!
                if (specificCount <= 0) {
                    continue;
                }

                sanitizedMap[dateStr] = {
                    count: specificCount,
                    platforms: [targetPortal], // STRICTLY only the selected platform!
                };
                totalCount += specificCount;
            } else {
                // "all" platforms view: filter only by active portals
                const filteredPlatforms = entryPlatforms.filter((p) => activePortalsSet.has(p));
                if (activePortalsSet.size > 0 && entryPlatforms.length > 0 && filteredPlatforms.length === 0) {
                    continue;
                }

                let cellCount = entry.count;
                if (platformCounts && filteredPlatforms.length > 0) {
                    const sum = filteredPlatforms.reduce(
                        (s: number, p: string) => s + (platformCounts[p] || 0),
                        0
                    );
                    if (sum > 0) cellCount = sum;
                }
                if (cellCount <= 0) continue; // STRICT: never fabricate active days

                const effectivePlatforms = filteredPlatforms.length > 0 ? filteredPlatforms : entryPlatforms;

                if (!sanitizedMap[dateStr]) {
                    sanitizedMap[dateStr] = {
                        count: cellCount,
                        platforms: effectivePlatforms,
                    };
                } else {
                    sanitizedMap[dateStr].count += cellCount;
                    for (const p of effectivePlatforms) {
                        if (!sanitizedMap[dateStr].platforms.includes(p)) {
                            sanitizedMap[dateStr].platforms.push(p);
                        }
                    }
                }
                totalCount += cellCount;
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

        // Production unified streak algorithm across all active platforms
        const computedStreak = calculateUnifiedStreak(sanitizedMap);

        // Synchronize with remote server metrics if available and larger ONLY when selectedPortal === "all"
        if (selectedPortal === "all") {
            if (remoteData?.dayStreak && remoteData.dayStreak > computedStreak.currentStreak) {
                computedStreak.currentStreak = remoteData.dayStreak;
            }
            if (remoteData?.maxStreak && remoteData.maxStreak > computedStreak.maxStreak) {
                computedStreak.maxStreak = remoteData.maxStreak;
            }
        }
        computedStreak.maxStreak = Math.max(computedStreak.maxStreak, computedStreak.currentStreak);

        return {
            weeks: built.weeks,
            monthNames: built.monthNames,
            totalSubmissions: finalTotal,
            activeDays: daysCount || (finalTotal > 0 ? 1 : 0),
            streakMetrics: computedStreak,
        };
    }, [remoteData, clientAgg, platformBreakdown, selectedPortal, weeksCount]);

    // Neo-Brutalist Practice Shader mapping - visually distinct from Development (GitHub Green)
    const PRACTICE_PALETTES = {
        default: {
            colors: ["#FAF6EE", "#fed7aa", "#fb923c", "#ea580c", "#c2410c"],
            4: "bg-[#c2410c] border-black shadow-[1px_1px_0px_#000]",
            3: "bg-[#ea580c] border-black shadow-[1px_1px_0px_#000]",
            2: "bg-[#fb923c] border-black",
            1: "bg-[#fed7aa] border-black",
            0: "bg-[#FAF6EE] border-black/25 hover:border-black",
            legend: [
                "bg-[#FAF6EE] border border-black/30",
                "bg-[#fed7aa] border border-black",
                "bg-[#fb923c] border border-black",
                "bg-[#ea580c] border border-black shadow-xs",
                "bg-[#c2410c] border border-black shadow-xs",
            ],
        },
        codeforces: {
            colors: ["#FAF6EE", "#bfdbfe", "#60a5fa", "#2563eb", "#1e40af"],
            4: "bg-[#1e40af] border-black shadow-[1px_1px_0px_#000]",
            3: "bg-[#2563eb] border-black shadow-[1px_1px_0px_#000]",
            2: "bg-[#60a5fa] border-black",
            1: "bg-[#bfdbfe] border-black",
            0: "bg-[#FAF6EE] border-black/25 hover:border-black",
            legend: [
                "bg-[#FAF6EE] border border-black/30",
                "bg-[#bfdbfe] border border-black",
                "bg-[#60a5fa] border border-black",
                "bg-[#2563eb] border border-black shadow-xs",
                "bg-[#1e40af] border border-black shadow-xs",
            ],
        },
        codechef: {
            colors: ["#FAF6EE", "#fde68a", "#f59e0b", "#d97706", "#78350f"],
            4: "bg-[#78350f] border-black shadow-[1px_1px_0px_#000]",
            3: "bg-[#d97706] border-black shadow-[1px_1px_0px_#000]",
            2: "bg-[#f59e0b] border-black",
            1: "bg-[#fde68a] border-black",
            0: "bg-[#FAF6EE] border-black/25 hover:border-black",
            legend: [
                "bg-[#FAF6EE] border border-black/30",
                "bg-[#fde68a] border border-black",
                "bg-[#f59e0b] border border-black",
                "bg-[#d97706] border border-black shadow-xs",
                "bg-[#78350f] border border-black shadow-xs",
            ],
        },
    };

    const activePalette = useMemo(() => {
        const portal = (selectedPortal || "").toLowerCase();
        if (portal === "codeforces") return PRACTICE_PALETTES.codeforces;
        if (portal === "codechef") return PRACTICE_PALETTES.codechef;
        return PRACTICE_PALETTES.default;
    }, [selectedPortal]);

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
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black hover:bg-neutral-900 text-[#FFE566] font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
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
        <div className="w-full rounded-2xl bg-white text-neutral-900 p-4 sm:p-7 border-2 border-black shadow-[4px_4px_0px_#000] relative overflow-hidden select-none">
            {/* Top Header Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 relative z-10">
                <div className="flex items-center gap-3 sm:gap-3.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                        <Code2 className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                            <h3 className="text-lg sm:text-2xl font-black text-black tracking-tight leading-tight">
                                Practice Activity
                            </h3>
                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFE566] border-2 border-black text-[10px] sm:text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                <Sparkles className="w-3 h-3 text-black" />
                                <span>Multi-Platform Practice</span>
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-bold mt-0.5 sm:mt-1">
                            Merged problem solving and practice submissions from all connected platforms (excluding GitHub)
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full lg:w-auto flex-wrap">
                    {/* Sync / Refetch Platforms Button with 1-Hour Cooldown */}
                    <button
                        type="button"
                        onClick={handleSyncClick}
                        disabled={cooldownSeconds > 0 || isLoading}
                        title={
                            cooldownSeconds > 0
                                ? `Platform sync cooldown active (${formatCooldownTime(cooldownSeconds)} remaining)`
                                : "Sync and refetch fresh submissions from all connected coding platforms"
                        }
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black border-2 border-black transition-all shadow-[2px_2px_0px_#000] select-none ${
                            cooldownSeconds > 0
                                ? "bg-neutral-100 text-neutral-500 border-neutral-400 cursor-not-allowed opacity-80"
                                : isLoading
                                ? "bg-[#FFE566] text-black cursor-wait"
                                : "bg-[#FAF6EE] hover:bg-[#FFE566] text-black active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        }`}
                    >
                        <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        <span>
                            {isLoading
                                ? "Syncing..."
                                : cooldownSeconds > 0
                                ? `Cooldown (${formatCooldownTime(cooldownSeconds)})`
                                : "Sync Platforms"}
                        </span>
                    </button>

                    {/* Total Submissions Metric */}
                    <div className="text-right">
                        <span className="text-2xl sm:text-4xl font-mono font-black text-black block leading-none">
                            {totalSubmissions.toLocaleString()}
                        </span>
                        <div className="inline-flex items-center justify-end gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider text-black mt-1 bg-[#FAF6EE] border-2 border-black px-2 sm:px-2.5 py-0.5 rounded-lg shadow-[1px_1px_0px_#000]">
                            <GitCommit className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-black" />
                            <span>Submissions Done</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Filter Chips Row with Smooth Touch Scrolling */}
            <div
                style={{ WebkitOverflowScrolling: "touch" }}
                className="flex items-center gap-2 overflow-x-auto py-3 my-2 border-y-2 border-black/15 relative z-10 scrollbar-none"
            >
                <button
                    type="button"
                    onClick={() => setSelectedPortal("all")}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex-shrink-0 border-2 border-black shadow-[2px_2px_0px_#000] ${
                        selectedPortal === "all"
                            ? "bg-black text-[#FFE566]"
                            : "bg-[#FAF6EE] hover:bg-neutral-200 text-black"
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
                            className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex-shrink-0 border-2 border-black shadow-[2px_2px_0px_#000] ${
                                isSelected
                                    ? "bg-black text-[#FFE566]"
                                    : "bg-[#FAF6EE] hover:bg-neutral-200 text-black"
                            }`}
                        >
                            <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                {getPortalIcon(plat.portal, "w-full h-full object-contain")}
                            </div>
                            <span className="portal-tab-label hidden sm:inline capitalize">{plat.portal}</span>
                            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-black ${
                                isSelected ? "bg-[#FFE566] text-black" : "bg-white text-black"
                            }`}>
                                {Math.max(plat.submissions || 0, plat.solved || 0)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <InteractiveActivityHeatmap
                weeks={weeks}
                monthNames={monthNames}
                colors={activePalette.colors}
                activity="submissions"
                onHoverDay={setHoveredCell}
            />

            {/* Hover Tooltip Info Banner if cell is hovered */}
            <div className="min-h-[32px] flex items-center text-xs sm:text-sm font-mono text-neutral-800 pt-1">
                {hoveredCell ? (
                    <div className="inline-flex items-center gap-2 bg-[#FAF6EE] border-2 border-black rounded-xl px-3 py-1 shadow-[2px_2px_0px_#000]">
                        <span className="font-black text-black">{hoveredCell.displayDate}:</span>
                        <span className="text-black font-black bg-[#FFE566] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
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
                    <span className="text-neutral-600 text-xs font-bold font-sans">Hover or use arrow keys for daily details. Tap the chart to change its view.</span>
                )}
            </div>

            {/* Bottom Footer Row with Metrics and Circular Curvy Legend */}
            <div className="pt-4 mt-2 border-t-2 border-black/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-neutral-800 relative z-10">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                        <Flame className={`w-4 h-4 ${streakMetrics.currentStreak > 0 ? "text-orange-500 fill-orange-400" : "text-neutral-400"}`} />
                        <span>{streakMetrics.currentStreak} day streak</span>
                        {streakMetrics.isActiveToday ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-orange-950 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-400 font-bold ml-0.5 select-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                Active today
                            </span>
                        ) : streakMetrics.canExtendToday ? (
                            <span className="inline-flex items-center text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-400 font-bold ml-0.5 select-none">
                                Extend today
                            </span>
                        ) : null}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                        <Trophy className="w-4 h-4 text-amber-500 fill-amber-300" />
                        <span>{streakMetrics.maxStreak} day best streak</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                        <CheckCircle2 className="w-4 h-4 text-orange-600" />
                        <span>
                            {selectedPortal === "all"
                                ? `${connectedPlatformsList.length} platform${connectedPlatformsList.length === 1 ? "" : "s"} synced`
                                : `${selectedPortal.charAt(0).toUpperCase() + selectedPortal.slice(1)} active`}
                        </span>
                    </div>
                </div>

                {/* Circular Curvy Legend: Less (o)(o)(o)(o)(o) More */}
                <div className="flex items-center gap-2 flex-shrink-0 bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1 shadow-[2px_2px_0px_#000]">
                    <span className="text-[10px] uppercase font-black text-black tracking-wider">Less</span>
                    <div className="flex items-center gap-1.5">
                        {activePalette.legend.map((dotClass, idx) => (
                            <span key={idx} className={`w-3 h-3 rounded-full ${dotClass}`} />
                        ))}
                    </div>
                    <span className="text-[10px] uppercase font-black text-black tracking-wider">More</span>
                </div>
            </div>
        </div>
    );
};
