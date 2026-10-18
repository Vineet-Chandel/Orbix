import React, { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector, fetchUnifiedSubmissions } from "../../../store";
import {
    aggregateClientPortalsSubmissions,
    buildWeeklySubmissionColumns,
} from "../../../utils/submissionsAggregator";

interface CodingSubmissionsChartProps {
    connectedPortals: Record<string, any>;
    username?: string;
    variant?: "linkedin" | "story";
}

export const CodingSubmissionsChart: React.FC<CodingSubmissionsChartProps> = ({
    connectedPortals,
    username = "",
    variant = "linkedin",
}) => {
    const isStory = variant === "story";
    const weeksCount = 28; // 28 weeks of contributions
    const effectiveUser = (username || "").trim();

    const dispatch = useAppDispatch();
    // Read cached unified submissions from Redux store (hydrated instantly from localStorage)
    const cachedData = useAppSelector((state) => state.submissions.dataByUser[effectiveUser]);

    // Fetch unified submissions only if data is not already present in Redux
    useEffect(() => {
        if (effectiveUser && !cachedData) {
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser }));
        }
    }, [effectiveUser, cachedData, dispatch]);

    // Client-side fallback aggregation (strictly excludes GitHub)
    const clientAgg = useMemo(() => {
        return aggregateClientPortalsSubmissions(connectedPortals, weeksCount);
    }, [connectedPortals, weeksCount]);

    // Build weeks from dailyMerged in Redux if available, otherwise fallback
    const { weeks } = useMemo(() => {
        const rawMap = cachedData?.dailyMerged || {};
        if (Object.keys(rawMap).length > 0) {
            return buildWeeklySubmissionColumns(rawMap, weeksCount);
        }
        return { weeks: clientAgg.weeks, monthNames: clientAgg.monthNames };
    }, [cachedData, weeksCount, clientAgg]);

    // Total lifetime submissions count across all connected platforms (excl. GitHub)
    const totalLifetimeSubmissions = cachedData?.totalSubmissions || clientAgg.totalSubmissions;

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
                return "bg-[#39d353] border-[#72ff8f] shadow-[0_0_8px_rgba(57,211,83,0.85)]";
            case 3:
                return "bg-[#26a641] border-[#3ee667] shadow-[0_0_5px_rgba(38,166,65,0.6)]";
            case 2:
                return "bg-[#006d32] border-[#20964c] shadow-[0_0_4px_rgba(0,109,50,0.4)]";
            case 1:
                return "bg-[#0e4429] border-[#1b7342]/70 shadow-[0_0_3px_rgba(14,68,41,0.3)]";
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
};
