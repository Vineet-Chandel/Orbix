import React, { useMemo } from "react";
import { Calendar, Flame } from "lucide-react";
import type { DevelopmentChartsData } from "../../../store/developmentSlice";
import { computeDevelopmentCharts } from "../../../utils/submissionsAggregator";

interface DevelopmentActivityChartsProps {
    dailyMerged?: Record<string, { count: number; platforms?: string[] } | number>;
    serverCharts?: DevelopmentChartsData | null;
    totalContributions?: number;
    isLoading?: boolean;
}

export const DevelopmentActivityCharts: React.FC<DevelopmentActivityChartsProps> = ({
    dailyMerged,
    serverCharts,
    totalContributions = 0,
    isLoading = false,
}) => {
    const chartsData = useMemo(() => {
        if (
            serverCharts &&
            Array.isArray(serverCharts.monthlyContributions) &&
            serverCharts.monthlyContributions.length > 0
        ) {
            return serverCharts;
        }
        return computeDevelopmentCharts(dailyMerged || {}, totalContributions);
    }, [serverCharts, dailyMerged, totalContributions]);

    const { monthlyContributions, dayOfWeekContributions, busiestDay } = chartsData;

    const maxMonthCount = useMemo(() => {
        return Math.max(...monthlyContributions.map((m) => m.count), 1);
    }, [monthlyContributions]);

    const maxDayCount = useMemo(() => {
        return Math.max(...dayOfWeekContributions.map((d) => d.count), 1);
    }, [dayOfWeekContributions]);

    if (isLoading && !serverCharts && totalContributions === 0) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full font-sans select-none animate-pulse">
                <div className="rounded-2xl bg-[#0d1117] border border-white/[0.08] p-5 sm:p-6 h-56 flex flex-col justify-between">
                    <div className="h-4 w-40 bg-white/[0.08] rounded" />
                    <div className="grid grid-cols-12 gap-2 items-end h-36">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-24 bg-white/[0.05] rounded-t-lg" />
                        ))}
                    </div>
                </div>
                <div className="rounded-2xl bg-[#0d1117] border border-white/[0.08] p-5 sm:p-6 h-56 flex flex-col justify-between">
                    <div className="h-4 w-48 bg-white/[0.08] rounded" />
                    <div className="grid grid-cols-7 gap-3 items-end h-36">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="h-24 bg-white/[0.05] rounded-t-lg" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full font-sans select-none">
            {/* Card 1: Contributions by month */}
            <div className="rounded-2xl bg-[#0d1117] border border-white/[0.08] p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:border-white/[0.14]">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        Contributions by month
                    </h4>
                </div>

                {/* 12 Months Bar Chart */}
                <div className="grid grid-cols-12 gap-1 sm:gap-2 items-end h-44 sm:h-48 pt-6 pb-1">
                    {monthlyContributions.map((item, idx) => {
                        const heightPct =
                            item.count === 0
                                ? 6
                                : Math.max(Math.round((item.count / maxMonthCount) * 100), 8);

                        return (
                            <div
                                key={idx}
                                className="flex flex-col items-center justify-end h-full group relative"
                                title={`${item.label} ${item.year}: ${item.count} contribution${
                                    item.count === 1 ? "" : "s"
                                }`}
                            >
                                {/* Value directly above bar */}
                                <span className="text-[10px] sm:text-xs font-bold text-neutral-300 text-center mb-1.5 transition-transform group-hover:scale-110">
                                    {item.count}
                                </span>

                                {/* Bar shape */}
                                <div className="w-full flex items-end justify-center h-32 sm:h-36">
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className={`w-full max-w-[26px] sm:max-w-[32px] rounded-t-lg sm:rounded-t-xl transition-all duration-500 ease-out ${
                                            item.isMax
                                                ? "bg-[#F5A623] shadow-[0_0_14px_rgba(245,166,35,0.45)]"
                                                : "bg-[#E6EDF3] group-hover:bg-white"
                                        }`}
                                    />
                                </div>

                                {/* Month label below */}
                                <span className="text-[10px] sm:text-xs font-medium text-neutral-400 text-center mt-2 truncate w-full">
                                    {item.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Card 2: Your coding days */}
            <div className="rounded-2xl bg-[#0d1117] border border-white/[0.08] p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:border-white/[0.14]">
                {/* Header with dynamic busiest day */}
                <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                    <Flame className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        Your coding days
                    </h4>
                    <span className="text-xs sm:text-sm font-normal text-neutral-400">
                        · busiest on {busiestDay}
                    </span>
                </div>

                {/* 7 Days Bar Chart */}
                <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 sm:h-48 pt-6 pb-1">
                    {dayOfWeekContributions.map((item, idx) => {
                        const heightPct =
                            item.count === 0
                                ? 6
                                : Math.max(Math.round((item.count / maxDayCount) * 100), 8);

                        return (
                            <div
                                key={idx}
                                className="flex flex-col items-center justify-end h-full group relative"
                                title={`${item.label}: ${item.count} contribution${
                                    item.count === 1 ? "" : "s"
                                }`}
                            >
                                {/* Value directly above bar */}
                                <span className="text-[11px] sm:text-xs font-bold text-neutral-300 text-center mb-1.5 transition-transform group-hover:scale-110">
                                    {item.count}
                                </span>

                                {/* Bar shape */}
                                <div className="w-full flex items-end justify-center h-32 sm:h-36">
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className={`w-full max-w-[36px] sm:max-w-[44px] rounded-t-lg sm:rounded-t-xl transition-all duration-500 ease-out ${
                                            item.isMax
                                                ? "bg-[#F5A623] shadow-[0_0_14px_rgba(245,166,35,0.45)]"
                                                : "bg-[#E6EDF3] group-hover:bg-white"
                                        }`}
                                    />
                                </div>

                                {/* Day label below */}
                                <span className="text-[11px] sm:text-xs font-medium text-neutral-400 text-center mt-2">
                                    {item.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
