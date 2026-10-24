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
                    <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 h-56 flex flex-col justify-between shadow-[4px_4px_0px_#000]">
                        <div className="h-4 w-40 bg-neutral-200 rounded" />
                        <div className="grid grid-cols-12 gap-2 items-end h-36">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="h-24 bg-[#FAF6EE] border border-black/20 rounded-t-lg" />
                            ))}
                        </div>
                    </div>
                    <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 h-56 flex flex-col justify-between shadow-[4px_4px_0px_#000]">
                        <div className="h-4 w-48 bg-neutral-200 rounded" />
                        <div className="grid grid-cols-7 gap-3 items-end h-36">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} className="h-24 bg-[#FAF6EE] border border-black/20 rounded-t-lg" />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="w-full rounded-2xl bg-[#FAF6EE] border-2 border-black p-5 sm:p-6 flex flex-col gap-4 shadow-[4px_4px_0px_#000]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="h-3 w-20 bg-neutral-200 rounded" />
                            <div className="h-4 w-48 bg-neutral-100 rounded" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-20 bg-neutral-200 rounded" />
                            <div className="h-4 w-48 bg-neutral-100 rounded" />
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
                <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[4px_4px_0px_#000] relative overflow-hidden flex flex-col justify-between transition-all hover:translate-x-0.5 hover:-translate-y-0.5">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                            <Calendar className="w-4.5 h-4.5 text-black" />
                        </div>
                        <h4 className="text-lg sm:text-xl font-black text-black tracking-tight">
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
                                    <span className="text-xs font-mono font-black text-black text-center mb-1.5 transition-transform group-hover:scale-110">
                                        {item.count}
                                    </span>

                                    {/* Bar shape */}
                                    <div className="w-full flex items-end justify-center h-32 sm:h-36">
                                        <div
                                            style={{ height: `${heightPct}%` }}
                                            className={`w-full max-w-[26px] sm:max-w-[32px] rounded-t-lg sm:rounded-t-xl transition-all duration-300 ease-out border-t-2 border-x-2 border-black ${item.isMax
                                                ? "bg-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] group-hover:bg-[#FFE566]"
                                                }`}
                                        />
                                    </div>

                                    {/* Month label below */}
                                    <span className="text-[11px] font-mono font-bold text-neutral-600 text-center mt-2 truncate w-full uppercase">
                                        {item.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Card 2: Your coding days */}
                <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[4px_4px_0px_#000] relative overflow-hidden flex flex-col justify-between transition-all hover:translate-x-0.5 hover:-translate-y-0.5">
                    {/* Header with dynamic busiest day */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                            <Flame className="w-4.5 h-4.5 text-black" />
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <h4 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                Your coding days
                            </h4>
                            <span className="text-xs sm:text-sm font-bold text-neutral-600">
                                · busiest on <span className="text-black font-black underline decoration-[#a2ff86] decoration-2">{busiestDay}</span>
                            </span>
                        </div>
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
                                    <span className="text-xs font-mono font-black text-black text-center mb-1.5 transition-transform group-hover:scale-110">
                                        {item.count}
                                    </span>

                                    {/* Bar shape */}
                                    <div className="w-full flex items-end justify-center h-32 sm:h-36">
                                        <div
                                            style={{ height: `${heightPct}%` }}
                                            className={`w-full max-w-[36px] sm:max-w-[44px] rounded-t-lg sm:rounded-t-xl transition-all duration-300 ease-out border-t-2 border-x-2 border-black ${item.isMax
                                                ? "bg-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] group-hover:bg-[#FFE566]"
                                                }`}
                                        />
                                    </div>

                                    {/* Day label below */}
                                    <span className="text-xs font-mono font-bold text-neutral-600 text-center mt-2">
                                        {item.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Profile Activity Highlights Section: Best month, Best day, Most starred, Latest work */}
            <div className="w-full rounded-2xl bg-[#FAF6EE] border-2 border-black p-6 sm:p-7 shadow-[4px_4px_0px_#000] select-none">
                {/* Row 1: Best month & Best day */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                        <div className="text-xs sm:text-sm font-black text-black/60 uppercase tracking-wider">
                            Best month
                        </div>
                        <div className="mt-1.5 text-base sm:text-lg font-black text-black">
                            {bestMonthText}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs sm:text-sm font-black text-black/60 uppercase tracking-wider">
                            Best day
                        </div>
                        <div className="mt-1.5 text-base sm:text-lg font-black text-black">
                            {bestDayText}
                        </div>
                    </div>
                </div>

                {/* Horizontal Divider Line */}
                <div className="h-0.5 bg-black/10 my-4 sm:my-5" />

                {/* Row 2: Most starred & Latest work */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                        <div className="text-xs sm:text-sm font-black text-black/60 uppercase tracking-wider">
                            Most starred
                        </div>
                        <div className="mt-1.5 text-base sm:text-lg font-black text-black truncate">
                            {mostStarred ? (
                                <span>
                                    {mostStarred.url ? (
                                        <a
                                            href={mostStarred.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline hover:text-black transition-colors"
                                        >
                                            {mostStarred.name}
                                        </a>
                                    ) : (
                                        mostStarred.name
                                    )}{" "}
                                    <span className="text-xs font-mono font-black bg-[#FFE566] px-1.5 py-0.5 rounded border border-black ml-1">
                                        ★ {mostStarred.stars}
                                    </span>
                                </span>
                            ) : (
                                <span className="text-neutral-500 font-medium text-sm">No public repositories</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="text-xs sm:text-sm font-black text-black/60 uppercase tracking-wider">
                            Latest work
                        </div>
                        <div className="mt-1.5 text-base sm:text-lg font-black text-black truncate">
                            {latestWork ? (
                                <span>
                                    {latestWork.url ? (
                                        <a
                                            href={latestWork.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:underline hover:text-black transition-colors"
                                        >
                                            {latestWork.name}
                                        </a>
                                    ) : (
                                        latestWork.name
                                    )}
                                    {latestWork.relativeTime ? (
                                        <span className="text-xs font-mono font-bold text-neutral-600 ml-1">
                                            · {latestWork.relativeTime}
                                        </span>
                                    ) : ""}
                                </span>
                            ) : (
                                <span className="text-neutral-500 font-medium text-sm">No recent activity</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
