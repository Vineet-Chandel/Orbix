import React, { useEffect, useMemo } from "react";
import { Calendar, Flame } from "lucide-react";
import type { DevelopmentChartsData } from "../../../store/developmentSlice";
import { computeDevelopmentCharts } from "../../../utils/submissionsAggregator";
import { useAppDispatch, useAppSelector } from "../../../store/index";
import { fetchDevelopmentAnalytics } from "../../../store/developmentAnalyticsSlice";

interface DevelopmentActivityChartsProps {
    dailyMerged?: Record<string, { count: number; platforms?: string[] } | number>;
    serverCharts?: DevelopmentChartsData | null;
    totalContributions?: number;
    isLoading?: boolean;
    username?: string;
    githubHandle?: string;
}

export const DevelopmentActivityCharts: React.FC<DevelopmentActivityChartsProps> = ({
    dailyMerged,
    serverCharts,
    totalContributions = 0,
    isLoading = false,
    username,
    githubHandle,
}) => {
    const dispatch = useAppDispatch();
    const currentUser = useAppSelector((state) => state.user.user?.username || "");
    const effectiveUser = (username || currentUser || "").trim();

    const analyticsData = useAppSelector((state) =>
        effectiveUser ? state.developmentAnalytics.dataByUser[effectiveUser] : undefined
    );
    const isAnalyticsLoading = useAppSelector((state) =>
        effectiveUser ? state.developmentAnalytics.loadingByUser[effectiveUser] || false : false
    );

    // Fetch development analytics for repository highlights if not loaded
    useEffect(() => {
        if (effectiveUser && !analyticsData && !isAnalyticsLoading) {
            dispatch(
                fetchDevelopmentAnalytics({
                    username: effectiveUser,
                    githubHandle: githubHandle || effectiveUser,
                })
            );
        }
    }, [effectiveUser, githubHandle, analyticsData, isAnalyticsLoading, dispatch]);

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

    // 1. Best month metric: Month with highest contribution count
    const bestMonthText = useMemo(() => {
        if (!monthlyContributions || monthlyContributions.length === 0) {
            return "No contributions yet";
        }
        let top = monthlyContributions[0];
        for (const m of monthlyContributions) {
            if (m.count > (top?.count || 0)) {
                top = m;
            }
        }
        if (!top || top.count <= 0) {
            return "No contributions yet";
        }
        return `${top.label} ${top.year} with ${top.count} contribution${top.count === 1 ? "" : "s"}`;
    }, [monthlyContributions]);

    // 2. Best day metric: Calendar day with highest contribution count
    const bestDayText = useMemo(() => {
        if (!dailyMerged || Object.keys(dailyMerged).length === 0) {
            return "No contributions yet";
        }
        let maxCount = 0;
        let bestDateStr = "";

        for (const [, val] of Object.entries(dailyMerged)) {
            const count = typeof val === "number" ? val : (val?.count || 0);
            if (count > maxCount) {
                maxCount = count;
            }
        }

        // Find the date with this max count
        if (maxCount > 0) {
            for (const [dateStr, val] of Object.entries(dailyMerged)) {
                const count = typeof val === "number" ? val : (val?.count || 0);
                if (count === maxCount) {
                    bestDateStr = dateStr;
                    break;
                }
            }
        }

        if (!bestDateStr || maxCount <= 0) {
            return "No contributions yet";
        }

        const parts = bestDateStr.split("-");
        if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const dt = new Date(Date.UTC(y, m, d));
            const shortMonth = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
            return `${d} ${shortMonth} ${y} with ${maxCount} contribution${maxCount === 1 ? "" : "s"}`;
        }

        return `${bestDateStr} with ${maxCount} contribution${maxCount === 1 ? "" : "s"}`;
    }, [dailyMerged]);

    // 3. Most starred repository
    const mostStarred = useMemo(() => {
        if (analyticsData?.mostStarred) {
            return analyticsData.mostStarred;
        }
        if (analyticsData?.topRepositories && analyticsData.topRepositories.length > 0) {
            const top = analyticsData.topRepositories[0];
            return {
                name: top.name,
                stars: top.stars,
                url: top.url,
            };
        }
        return null;
    }, [analyticsData]);

    // 4. Latest work repository
    const latestWork = useMemo(() => {
        if (analyticsData?.latestWork) {
            return analyticsData.latestWork;
        }
        if (analyticsData?.topRepositories && analyticsData.topRepositories.length > 0) {
            const top = analyticsData.topRepositories[0];
            return {
                name: top.name,
                relativeTime: "recently",
                url: top.url,
            };
        }
        return null;
    }, [analyticsData]);

    if (isLoading && !serverCharts && totalContributions === 0) {
        return (
            <div className="flex flex-col gap-4 sm:gap-6 w-full font-sans select-none animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
                    <div className="rounded-2xl bg-black border border-neutral-800 p-5 sm:p-6 h-56 flex flex-col justify-between">
                        <div className="h-4 w-40 bg-white/[0.08] rounded" />
                        <div className="grid grid-cols-12 gap-2 items-end h-36">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="h-24 bg-white/[0.05] rounded-t-lg" />
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl bg-black border border-neutral-800 p-5 sm:p-6 h-56 flex flex-col justify-between">
                        <div className="h-4 w-48 bg-white/[0.08] rounded" />
                        <div className="grid grid-cols-7 gap-3 items-end h-36">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="h-24 bg-white/[0.05] rounded-t-lg" />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="w-full rounded-2xl bg-black p-5 sm:p-6 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="h-3 w-20 bg-white/[0.08] rounded" />
                            <div className="h-4 w-48 bg-white/[0.05] rounded" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-20 bg-white/[0.08] rounded" />
                            <div className="h-4 w-48 bg-white/[0.05] rounded" />
                        </div>
                    </div>
                    <div className="h-px bg-white/[0.08]" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="h-3 w-24 bg-white/[0.08] rounded" />
                            <div className="h-4 w-52 bg-white/[0.05] rounded" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-24 bg-white/[0.08] rounded" />
                            <div className="h-4 w-52 bg-white/[0.05] rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6 w-full font-sans select-none">
            {/* Top Charts: Contributions by month & Your coding days */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
                {/* Card 1: Contributions by month */}
                <div className="rounded-2xl bg-black p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:border-neutral-700">
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
                                    title={`${item.label} ${item.year}: ${item.count} contribution${item.count === 1 ? "" : "s"
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
                                            className={`w-full max-w-[26px] sm:max-w-[32px] rounded-t-lg sm:rounded-t-xl transition-all duration-500 ease-out ${item.isMax
                                                ? "bg-[#22c55e]"
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
                <div className="rounded-2xl bg-black p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:border-neutral-700">
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
                                    title={`${item.label}: ${item.count} contribution${item.count === 1 ? "" : "s"
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
                                            className={`w-full max-w-[36px] sm:max-w-[44px] rounded-t-lg sm:rounded-t-xl transition-all duration-500 ease-out ${item.isMax
                                                ? "bg-[#22c55e]"
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

            {/* Profile Activity Highlights Section: Best month, Best day, Most starred, Latest work */}
            <div className="w-full rounded-2xl bg-black p-5 sm:p-6 select-none border-none">
                {/* Row 1: Best month & Best day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                        <div className="text-xs sm:text-sm font-medium text-neutral-400">
                            Best month
                        </div>
                        <div className="mt-1 text-sm sm:text-base font-normal text-white">
                            {bestMonthText}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs sm:text-sm font-medium text-neutral-400">
                            Best day
                        </div>
                        <div className="mt-1 text-sm sm:text-base font-normal text-white">
                            {bestDayText}
                        </div>
                    </div>
                </div>

                {/* Horizontal Divider Line */}
                <div className="h-px bg-white/[0.08] my-4 sm:my-5" />

                {/* Row 2: Most starred & Latest work */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                        <div className="text-xs sm:text-sm font-medium text-neutral-400">
                            Most starred
                        </div>
                        <div className="mt-1 text-sm sm:text-base font-normal text-white truncate">
                            {mostStarred ? (
                                <span>
                                    {mostStarred.url ? (
                                        <a
                                            href={mostStarred.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline hover:text-white transition-colors"
                                        >
                                            {mostStarred.name}
                                        </a>
                                    ) : (
                                        mostStarred.name
                                    )}{" "}
                                    with {mostStarred.stars} star{mostStarred.stars === 1 ? "" : "s"}
                                </span>
                            ) : (
                                <span className="text-neutral-500">No public repositories</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs sm:text-sm font-medium text-neutral-400">
                            Latest work
                        </div>
                        <div className="mt-1 text-sm sm:text-base font-normal text-white truncate">
                            {latestWork ? (
                                <span>
                                    {latestWork.url ? (
                                        <a
                                            href={latestWork.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline hover:text-white transition-colors"
                                        >
                                            {latestWork.name}
                                        </a>
                                    ) : (
                                        latestWork.name
                                    )}
                                    {latestWork.relativeTime ? `, pushed ${latestWork.relativeTime}` : ""}
                                </span>
                            ) : (
                                <span className="text-neutral-500">No recent activity</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
