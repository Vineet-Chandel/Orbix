import React, { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector, fetchUnifiedSubmissions, invalidateSubmissions } from "../../../store";
import {
    aggregateClientPortalsSubmissions,
    buildWeeklySubmissionColumns,
} from "../../../utils/submissionsAggregator";

interface CodingSubmissionsChartProps {
    connectedPortals: Record<string, any>;
    username?: string;
    variant?: "linkedin" | "story";
}

export const CodingSubmissionsChart: React.FC<CodingSubmissionsChartProps> = React.memo(({
    connectedPortals,
    username = "",
    variant = "linkedin",
}) => {
    const isStory = variant === "story";
    const weeksCount = 28; // 28 weeks of contributions
    const effectiveUser = (username || "").trim();

    const dispatch = useAppDispatch();
    const cachedData = useAppSelector((state) => state.submissions.dataByUser[effectiveUser]);

    // Active connected platforms map (excluding GitHub)
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
        return map;
    }, [connectedPortals]);

    const portalsFingerprint = useMemo(() => {
        return Array.from(activePortalsMap.entries())
            .map(([portal, handle]) => `${portal}:${handle}`)
            .sort()
            .join(",");
    }, [activePortalsMap]);

    const prevFingerprintRef = useRef<string | null>(null);

    // Fetch unified submissions dynamically when portals change
    useEffect(() => {
        if (!effectiveUser || effectiveUser === "Vineet-Chandel") return;
        if (prevFingerprintRef.current === null) {
            prevFingerprintRef.current = portalsFingerprint;
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, portals: connectedPortals }));
        } else if (prevFingerprintRef.current !== portalsFingerprint) {
            prevFingerprintRef.current = portalsFingerprint;
            dispatch(invalidateSubmissions(effectiveUser));
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, force: true, portals: connectedPortals }));
        }
    }, [effectiveUser, portalsFingerprint, connectedPortals, dispatch]);

    // Clear any stale cached submissions for Vineet-Chandel from localStorage
    useEffect(() => {
        if (effectiveUser === "Vineet-Chandel") {
            try {
                const stored = localStorage.getItem("orbix_unified_submissions");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed["Vineet-Chandel"]) {
                        delete parsed["Vineet-Chandel"];
                        localStorage.setItem("orbix_unified_submissions", JSON.stringify(parsed));
                    }
                }
            } catch {
                // Ignore
            }
        }
    }, [effectiveUser]);

    // Client-side fallback aggregation (strictly excludes GitHub)
    const clientAgg = useMemo(() => {
        return aggregateClientPortalsSubmissions(connectedPortals, weeksCount);
    }, [connectedPortals, weeksCount]);

    // Build weeks from dailyMerged in Redux filtered strictly to active connected platforms
    const { weeks, totalLifetimeSubmissions } = useMemo(() => {
        const isMockUser = !effectiveUser || effectiveUser.toLowerCase() === "vineet-chandel";

        // For mock showcase profile, strictly prioritize client portals data so stale cache/API never interferes
        if (isMockUser) {
            return {
                weeks: clientAgg.weeks,
                totalLifetimeSubmissions: Math.max(clientAgg.totalSubmissions, 4540),
            };
        }

        // Robust multi-source calendar merger: merges client cached submissions with remote server submissions
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

        if (cachedData?.dailyMerged) {
            for (const [dateKey, val] of Object.entries(cachedData.dailyMerged)) {
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
                        if (!existing.platforms.includes(p)) existing.platforms.push(p);
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

        const activePortalsSet = new Set(Array.from(activePortalsMap.keys()));

        const sanitizedMap: Record<string, { count: number; platforms: string[] }> = {};
        let totalCount = 0;

        for (const [dateStr, entry] of Object.entries(rawMap)) {
            const filteredPlatforms = (entry.platforms || []).filter((p) => activePortalsSet.has(p.toLowerCase()));
            if (filteredPlatforms.length === 0) continue;

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

        const built = buildWeeklySubmissionColumns(sanitizedMap, weeksCount);
        const sumPlatform = Object.entries(cachedData?.platformBreakdown || {})
            .filter(([k]) => activePortalsSet.has(k.toLowerCase()))
            .reduce((acc, [_, p]) => acc + Math.max(p.submissions || 0, p.solved || 0), 0);

        const finalTotal = Math.max(totalCount, sumPlatform || clientAgg.totalSubmissions);

        return {
            weeks: built.weeks,
            totalLifetimeSubmissions: finalTotal,
        };
    }, [cachedData, weeksCount, clientAgg, activePortalsMap, effectiveUser]);

    // Calculate exact time period (e.g. "Apr – Oct 2026")
    const timePeriodStr = useMemo(() => {
        if (!weeks || weeks.length === 0) return "the last 7 months";
        const firstDay = weeks[0]?.[0];
        const lastWeek = weeks[weeks.length - 1];
        const lastDay = lastWeek?.[lastWeek.length - 1];

        if (firstDay?.dateStr && lastDay?.dateStr) {
            const start = new Date(firstDay.dateStr);
            const end = new Date(lastDay.dateStr);
            const startMonth = start.toLocaleDateString("en-US", { month: "short" });
            const endMonth = end.toLocaleDateString("en-US", { month: "short" });
            const startYear = start.getFullYear();
            const endYear = end.getFullYear();

            if (startYear === endYear) {
                return `${startMonth} – ${endMonth} ${endYear}`;
            }
            return `${startMonth} ${startYear} – ${endMonth} ${endYear}`;
        }
        return "the last 7 months";
    }, [weeks]);

    // Circular Curvy Green Shader mapping
    const getCellColor = (level: 0 | 1 | 2 | 3 | 4) => {
        switch (level) {
            case 4:
                return "bg-[#39d353] border-[#72ff8f] shadow-[0_0_9px_rgba(57,211,83,0.85)]";
            case 3:
                return "bg-[#26a641] border-[#3ee667] shadow-[0_0_7px_rgba(38,166,65,0.7)]";
            case 2:
                return "bg-[#1a8c42] border-[#34d468] shadow-[0_0_5px_rgba(26,140,66,0.5)]";
            case 1:
                return "bg-[#0e5c30] border-[#20964c]/80 shadow-[0_0_4px_rgba(14,92,48,0.4)]";
            case 0:
            default:
                return "bg-[#141b25] border-white/[0.08]";
        }
    };

    if (isStory) {
        // Pure uncovered, compact circular dots for Instagram Story (1080x1920)
        return (
            <div className="w-full flex flex-col items-center justify-center py-2 select-none">
                <div className="inline-flex items-center gap-[7.5px]">
                    {weeks.map((week, wIdx) => (
                        <div key={wIdx} className="flex flex-col gap-[7.5px]">
                            {week.map((day, dIdx) => (
                                <div
                                    key={dIdx}
                                    title={`${day.count} submissions on ${day.displayDate}${
                                        day.platforms.length > 0
                                            ? ` (${day.platforms.join(", ")})`
                                             : ""
                                    }`}
                                    className={`w-[24px] h-[24px] rounded-full border transition-transform duration-150 hover:scale-125 cursor-pointer ${getCellColor(
                                        day.level
                                    )}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                {/* Heading below contribution chart with Time Period + Total Lifetime Submissions */}
                <div className="flex items-center gap-2 mt-3 select-none">
                    <span className="text-sm font-mono font-medium text-neutral-400 tracking-wide">
                        Submissions from {timePeriodStr}
                    </span>
                    <span className="text-neutral-600 font-bold">•</span>
                    <span className="text-sm font-mono font-bold text-emerald-400 tracking-wide">
                        {totalLifetimeSubmissions.toLocaleString()} Total Lifetime Submissions
                    </span>
                </div>
            </div>
        );
    }

    // Default compact uncovered circular dots for LinkedIn Card (1200x627, left 7 cols)
    return (
        <div className="w-full flex flex-col items-center justify-center py-1 select-none">
            <div className="inline-flex items-center gap-[6px]">
                {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[6px]">
                        {week.map((day, dIdx) => (
                            <div
                                key={dIdx}
                                title={`${day.count} submissions on ${day.displayDate}${
                                    day.platforms.length > 0
                                        ? ` (${day.platforms.join(", ")})`
                                        : ""
                                }`}
                                className={`w-[16px] h-[16px] rounded-full border transition-transform duration-150 hover:scale-130 cursor-pointer ${getCellColor(
                                    day.level
                                )}`}
                            />
                        ))}
                    </div>
                ))}
            </div>
            {/* Heading below contribution chart with Time Period + Total Lifetime Submissions */}
            <div className="flex items-center gap-2 mt-2 select-none">
                <span className="text-[11px] font-mono font-medium text-neutral-400 tracking-wide">
                    Submissions from {timePeriodStr}
                </span>
                <span className="text-neutral-600 font-bold">•</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400 tracking-wide">
                    {totalLifetimeSubmissions.toLocaleString()} Total Lifetime Submissions
                </span>
            </div>
        </div>
    );
});
