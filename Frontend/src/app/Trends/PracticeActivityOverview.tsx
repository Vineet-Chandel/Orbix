import React, { useState, useMemo, useEffect } from "react";
import { FileText, Calendar } from "lucide-react";
import { useAppDispatch, useAppSelector, fetchPracticeAnalytics, fetchUnifiedSubmissions } from "../../store";
import type { PracticeTrendsData, PracticeChartBucket } from "../../store/practiceAnalyticsSlice";

interface PracticeActivityOverviewProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

export const PracticeActivityOverview: React.FC<PracticeActivityOverviewProps> = ({
    connectedPortals,
    username = "",
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();
    const dispatch = useAppDispatch();

    const [chartMode, setChartMode] = useState<"weeks" | "months">("weeks");
    const [hoveredBucket, setHoveredBucket] = useState<PracticeChartBucket | null>(null);

    // Fetch practice analytics & submissions
    const analyticsData = useAppSelector(
        (state) => (effectiveUser ? state.practiceAnalytics.dataByUser[effectiveUser] : undefined)
    );
    const submissionsData = useAppSelector(
        (state) => (effectiveUser ? state.submissions.dataByUser[effectiveUser] : undefined)
    );
    const contestsData = useAppSelector(
        (state) => (effectiveUser ? state.contests.dataByUser[effectiveUser] : undefined)
    );

    useEffect(() => {
        if (effectiveUser) {
            dispatch(fetchPracticeAnalytics({ username: effectiveUser, portals: connectedPortals }));
            dispatch(fetchUnifiedSubmissions({ username: effectiveUser, portals: connectedPortals }));
        }
    }, [effectiveUser, connectedPortals, dispatch]);

    // Compute or extract dynamic trends data
    const trends: PracticeTrendsData = useMemo(() => {
        // If backend already calculated trends, use it
        if (analyticsData?.trends && analyticsData.trends.weeklyChart?.length > 0) {
            return analyticsData.trends;
        }

        // Real-time client-side fallback computation from submissionsData.dailyMerged
        const now = new Date();
        const nowTs = now.getTime();
        const dailyMerged = submissionsData?.dailyMerged || {};

        let count7 = 0;
        let count30 = 0;
        let count365 = 0;

        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        const curMonthPrefix = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;

        const prevYear = curMonth === 0 ? curYear - 1 : curYear;
        const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
        const prevMonthPrefix = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

        let curMonthSolved = 0;
        let curMonthActiveDays = 0;
        let curMonthHard = 0;
        let bestDayDate = "";
        let bestDayCount = 0;
        const curMonthPlatforms: Record<string, number> = {};

        let prevMonthSolved = 0;
        let prevMonthActiveDays = 0;
        let prevMonthHard = 0;

        const diffTotal = analyticsData?.difficulty?.total || 1;
        const hardRatio = (analyticsData?.difficulty?.hard || 0) / diffTotal;
        const mediumRatio = (analyticsData?.difficulty?.medium || 0) / diffTotal;
        const easyRatio = (analyticsData?.difficulty?.easy || 0) / diffTotal;

        for (const [dateStr, entry] of Object.entries(dailyMerged)) {
            const dTime = new Date(dateStr).getTime();
            const c = entry.count || 0;
            if (dTime >= nowTs - 7 * 86400000) count7 += c;
            if (dTime >= nowTs - 30 * 86400000) count30 += c;
            if (dTime >= nowTs - 365 * 86400000) count365 += c;

            if (dateStr.startsWith(curMonthPrefix)) {
                curMonthSolved += c;
                if (c > 0) curMonthActiveDays++;
                curMonthHard += Math.round(c * hardRatio);
                for (const p of entry.platforms || []) {
                    curMonthPlatforms[p] = (curMonthPlatforms[p] || 0) + c;
                }
                if (c > bestDayCount) {
                    bestDayCount = c;
                    bestDayDate = dateStr;
                }
            } else if (dateStr.startsWith(prevMonthPrefix)) {
                prevMonthSolved += c;
                if (c > 0) prevMonthActiveDays++;
                prevMonthHard += Math.round(c * hardRatio);
            }
        }

        const formatDelta = (current: number, prev: number) => {
            const diff = current - prev;
            if (diff > 0) return `↗ ${diff} more than last month`;
            if (diff < 0) return `↘ ${Math.abs(diff)} less than last month`;
            return "same as last month";
        };

        let bestDayText = "No problems solved yet";
        let bestDayLabel = "—";
        if (bestDayDate && bestDayCount > 0) {
            const bd = new Date(bestDayDate);
            bestDayLabel = `${bd.getDate()} ${bd.toLocaleDateString("en-US", { month: "short" })}`;
            bestDayText = `${bestDayLabel} with ${bestDayCount} ${bestDayCount === 1 ? "problem" : "problems"}`;
        }

        // Contest participations in current month
        let contestsThisMonth = 0;
        let contestsLastMonth = 0;
        let ratingChangesThisMonth = 0;
        const recentContests = contestsData?.recentContests || [];
        for (const ct of recentContests) {
            const ts = ct.timestamp > 1e11 ? ct.timestamp : ct.timestamp * 1000;
            const cDate = new Date(ts);
            if (cDate.getFullYear() === curYear && cDate.getMonth() === curMonth) {
                contestsThisMonth++;
                if (typeof ct.ratingChange === "number") ratingChangesThisMonth += ct.ratingChange;
            } else if (cDate.getFullYear() === prevYear && cDate.getMonth() === prevMonth) {
                contestsLastMonth++;
            }
        }

        let ratingChangesText = "No rated contests";
        if (contestsThisMonth > 0) {
            ratingChangesText = ratingChangesThisMonth >= 0
                ? `+${ratingChangesThisMonth} in ${contestsThisMonth} ${contestsThisMonth === 1 ? "contest" : "contests"}`
                : `${ratingChangesThisMonth} in ${contestsThisMonth} ${contestsThisMonth === 1 ? "contest" : "contests"}`;
        }

        const whereSolvedList = Object.entries(curMonthPlatforms)
            .filter(([_, c]) => c > 0)
            .map(([p, c]) => `${p.charAt(0).toUpperCase() + p.slice(1)} ${c}`);
        const whereYouSolved = whereSolvedList.length > 0 ? whereSolvedList.join(", ") : (curMonthSolved > 0 ? `LeetCode ${curMonthSolved}` : "None");

        const topicsPracticedMost = (analyticsData?.dsaTopics || []).slice(0, 6).map((t) => ({
            topic: t.topic,
            count: Math.max(1, Math.min(curMonthSolved || 15, Math.round(t.count / 25) || 5)),
        }));

        // Build 26 weeks
        const weeklyChart: PracticeChartBucket[] = [];
        const currentMonday = new Date(now);
        const dayOfWeek = currentMonday.getDay();
        const distToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentMonday.setDate(currentMonday.getDate() - distToMonday);
        currentMonday.setHours(0, 0, 0, 0);

        for (let w = 25; w >= 0; w--) {
            const weekStart = new Date(currentMonday);
            weekStart.setDate(weekStart.getDate() - w * 7);

            let wTotal = 0;
            for (let d = 0; d < 7; d++) {
                const checkD = new Date(weekStart);
                checkD.setDate(checkD.getDate() + d);
                const dStr = checkD.toISOString().split("T")[0] || "";
                wTotal += dailyMerged[dStr]?.count || 0;
            }

            const wEasy = Math.round(wTotal * easyRatio);
            const wMed = Math.round(wTotal * mediumRatio);
            const wHard = Math.max(0, wTotal - wEasy - wMed);

            const dateNum = weekStart.getDate();
            const monShort = weekStart.toLocaleDateString("en-US", { month: "short" });
            weeklyChart.push({
                key: weekStart.toISOString().split("T")[0] || "",
                label: `${dateNum} ${monShort}`,
                easy: wEasy,
                medium: wMed,
                hard: wHard,
                noLevel: 0,
                total: wTotal,
            });
        }

        // Build 12 months
        const monthlyChart: PracticeChartBucket[] = [];
        for (let m = 11; m >= 0; m--) {
            const mDate = new Date(curYear, curMonth - m, 1);
            const y = mDate.getFullYear();
            const mo = mDate.getMonth();
            const mPrefix = `${y}-${String(mo + 1).padStart(2, "0")}`;

            let mTotal = 0;
            for (const [dStr, entry] of Object.entries(dailyMerged)) {
                if (dStr.startsWith(mPrefix)) {
                    mTotal += entry.count || 0;
                }
            }

            const mEasy = Math.round(mTotal * easyRatio);
            const mMed = Math.round(mTotal * mediumRatio);
            const mHard = Math.max(0, mTotal - mEasy - mMed);

            monthlyChart.push({
                key: mPrefix,
                label: mDate.toLocaleDateString("en-US", { month: "short" }),
                easy: mEasy,
                medium: mMed,
                hard: mHard,
                noLevel: 0,
                total: mTotal,
            });
        }

        const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now);

        return {
            last7Days: count7,
            last30Days: count30,
            last12Months: count365,
            monthSoFar: {
                monthName: `${monthName} so far`,
                problemsSolved: curMonthSolved,
                problemsSolvedDelta: formatDelta(curMonthSolved, prevMonthSolved),
                activeDays: curMonthActiveDays,
                activeDaysDelta: formatDelta(curMonthActiveDays, prevMonthActiveDays),
                hardProblems: curMonthHard,
                hardProblemsDelta: formatDelta(curMonthHard, prevMonthHard),
                contests: contestsThisMonth,
                contestsDelta: formatDelta(contestsThisMonth, contestsLastMonth),
                bestDay: {
                    dayLabel: bestDayLabel,
                    problemsCount: bestDayCount,
                    text: bestDayText,
                },
                ratingChanges: ratingChangesText,
                whereYouSolved,
                topicsPracticedMost,
            },
            weeklyChart,
            monthlyChart,
        };
    }, [analyticsData, submissionsData, contestsData]);

    const activeChartData = chartMode === "weeks" ? trends.weeklyChart : trends.monthlyChart;

    const maxChartValue = useMemo(() => {
        const max = Math.max(...activeChartData.map((b) => b.total), 1);
        return Math.max(max, 8);
    }, [activeChartData]);

    return (
        <div className="space-y-6 text-neutral-900 font-sans select-none">
            {/* ROW 1: Top 3 Solved Metric Cards (Last 7 days, Last 30 days, Last 12 months) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {/* Last 7 days */}
                <div className="rounded-3xl bg-white border border-black/[0.06] p-6 shadow-xs flex flex-col justify-between transition-all hover:border-black/10">
                    <span className="text-xs sm:text-sm font-semibold text-neutral-500">
                        Last 7 days
                    </span>
                    <div className="my-2">
                        <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                            {trends.last7Days}
                        </span>
                    </div>
                    <span className="text-xs text-neutral-400 font-medium">
                        problems solved
                    </span>
                </div>

                {/* Last 30 days */}
                <div className="rounded-3xl bg-white border border-black/[0.06] p-6 shadow-xs flex flex-col justify-between transition-all hover:border-black/10">
                    <span className="text-xs sm:text-sm font-semibold text-neutral-500">
                        Last 30 days
                    </span>
                    <div className="my-2">
                        <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                            {trends.last30Days}
                        </span>
                    </div>
                    <span className="text-xs text-neutral-400 font-medium">
                        problems solved
                    </span>
                </div>

                {/* Last 12 months */}
                <div className="rounded-3xl bg-white border border-black/[0.06] p-6 shadow-xs flex flex-col justify-between transition-all hover:border-black/10">
                    <span className="text-xs sm:text-sm font-semibold text-neutral-500">
                        Last 12 months
                    </span>
                    <div className="my-2">
                        <span className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                            {trends.last12Months}
                        </span>
                    </div>
                    <span className="text-xs text-neutral-400 font-medium">
                        problems solved
                    </span>
                </div>
            </div>

            {/* ROW 2: Month So Far Card (<Month> <Year> so far) */}
            <div className="rounded-3xl bg-white border border-black/[0.06] p-6 sm:p-7 shadow-xs space-y-6">
                {/* Header */}
                <div className="flex items-center gap-2.5 pb-2">
                    <FileText className="w-4 h-4 text-neutral-800" />
                    <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 tracking-tight">
                        {trends.monthSoFar.monthName}
                    </h3>
                </div>

                {/* 4 Sub-stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Problems solved */}
                    <div className="rounded-2xl bg-black/[0.02] border border-black/[0.06] p-4 space-y-1.5 flex flex-col justify-between">
                        <span className="text-xs text-neutral-500 font-medium">Problems solved</span>
                        <div className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {trends.monthSoFar.problemsSolved}
                        </div>
                        <div className="text-xs font-semibold text-neutral-600 flex items-center gap-1">
                            <span>{trends.monthSoFar.problemsSolvedDelta}</span>
                        </div>
                    </div>

                    {/* Active days */}
                    <div className="rounded-2xl bg-black/[0.02] border border-black/[0.06] p-4 space-y-1.5 flex flex-col justify-between">
                        <span className="text-xs text-neutral-500 font-medium">Active days</span>
                        <div className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {trends.monthSoFar.activeDays}
                        </div>
                        <div className="text-xs font-semibold text-neutral-600 flex items-center gap-1">
                            <span>{trends.monthSoFar.activeDaysDelta}</span>
                        </div>
                    </div>

                    {/* Hard problems */}
                    <div className="rounded-2xl bg-black/[0.02] border border-black/[0.06] p-4 space-y-1.5 flex flex-col justify-between">
                        <span className="text-xs text-neutral-500 font-medium">Hard problems</span>
                        <div className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {trends.monthSoFar.hardProblems}
                        </div>
                        <div className="text-xs font-semibold text-neutral-600 flex items-center gap-1">
                            <span>{trends.monthSoFar.hardProblemsDelta}</span>
                        </div>
                    </div>

                    {/* Contests */}
                    <div className="rounded-2xl bg-black/[0.02] border border-black/[0.06] p-4 space-y-1.5 flex flex-col justify-between">
                        <span className="text-xs text-neutral-500 font-medium">Contests</span>
                        <div className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {trends.monthSoFar.contests}
                        </div>
                        <div className="text-xs font-medium text-neutral-600 flex items-center gap-1">
                            <span>{trends.monthSoFar.contestsDelta}</span>
                        </div>
                    </div>
                </div>

                {/* Details Breakdown Row (2 columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-black/[0.06]">
                    {/* Left Column: Best day & Rating changes */}
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs text-neutral-500 font-medium block">Best day</span>
                            <span className="text-sm font-semibold text-neutral-900 mt-0.5 block">
                                {trends.monthSoFar.bestDay.text}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-neutral-500 font-medium block">Rating changes</span>
                            <span className="text-sm font-semibold text-neutral-900 mt-0.5 block">
                                {trends.monthSoFar.ratingChanges}
                            </span>
                        </div>
                    </div>

                    {/* Right Column: Where you solved & Topics practiced most */}
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs text-neutral-500 font-medium block">Where you solved</span>
                            <span className="text-sm font-semibold text-neutral-900 mt-0.5 block">
                                {trends.monthSoFar.whereYouSolved}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-neutral-500 font-medium block mb-2">
                                Topics you practised most
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {trends.monthSoFar.topicsPracticedMost.map((item, idx) => (
                                    <span
                                        key={idx}
                                        className="rounded-md bg-black/[0.03] border border-black/[0.06] px-2.5 py-1 text-xs text-neutral-800 font-medium inline-flex items-center gap-1.5 shadow-2xs hover:border-black/10 transition-colors"
                                    >
                                        <span>{item.topic}</span>
                                        <span className="text-neutral-500 font-mono text-[11px]">{item.count}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3: Problems Solved Stacked Bar Chart */}
            <div className="rounded-3xl bg-white border border-black/[0.06] p-6 sm:p-7 shadow-xs space-y-6">
                {/* Header with Switcher */}
                <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-neutral-800" />
                        <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 tracking-tight">
                            Problems solved
                        </h3>
                    </div>

                    {/* Weeks / Months toggle */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-black/[0.04] border border-black/[0.06]">
                        <button
                            type="button"
                            onClick={() => setChartMode("weeks")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                chartMode === "weeks"
                                    ? "bg-black text-white shadow-xs"
                                    : "text-neutral-500 hover:text-black"
                            }`}
                        >
                            Weeks
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartMode("months")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                chartMode === "months"
                                    ? "bg-black text-white shadow-xs"
                                    : "text-neutral-500 hover:text-black"
                            }`}
                        >
                            Months
                        </button>
                    </div>
                </div>

                {/* The Stacked Bar Chart Container */}
                <div className="w-full pt-4 pb-2 relative">
                    <div className="w-full h-48 sm:h-56 flex items-end justify-between gap-1 sm:gap-2 px-1 relative">
                        {activeChartData.map((bucket, idx) => {
                            const isZero = bucket.total === 0;
                            // In Weeks mode, show dates every 2 weeks to match the screenshot
                            const shouldShowLabel =
                                chartMode === "months" ? true : idx % 2 === 0 || idx === activeChartData.length - 1;

                            const heightPercent = Math.min(100, Math.max(isZero ? 0 : 8, (bucket.total / maxChartValue) * 100));

                            // Segment ratios
                            const bSum = bucket.total || 1;
                            const easyH = (bucket.easy / bSum) * 100;
                            const medH = (bucket.medium / bSum) * 100;
                            const hardH = (bucket.hard / bSum) * 100;
                            const noLevelH = (bucket.noLevel / bSum) * 100;

                            const isHovered = hoveredBucket?.key === bucket.key;

                            return (
                                <div
                                    key={bucket.key}
                                    className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                                    onMouseEnter={() => setHoveredBucket(bucket)}
                                    onMouseLeave={() => setHoveredBucket(null)}
                                >
                                    {/* Number above the bar */}
                                    {!isZero && (
                                        <span className="text-[10px] sm:text-[11px] font-bold text-neutral-900 font-mono mb-1 select-none">
                                            {bucket.total}
                                        </span>
                                    )}

                                    {/* Stacked Bar Container */}
                                    <div
                                        style={{ height: `${heightPercent}%` }}
                                        className={`w-full max-w-[20px] sm:max-w-[26px] rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-200 ${
                                            isHovered ? "ring-2 ring-black/20" : ""
                                        }`}
                                    >
                                        {/* Easy (Bottom) */}
                                        {bucket.easy > 0 && (
                                            <div
                                                style={{ height: `${easyH}%` }}
                                                className="w-full bg-[#d4d4d4] transition-all"
                                                title={`Easy: ${bucket.easy}`}
                                            />
                                        )}
                                        {/* Medium (Middle) */}
                                        {bucket.medium > 0 && (
                                            <div
                                                style={{ height: `${medH}%` }}
                                                className="w-full bg-[#737373] transition-all"
                                                title={`Medium: ${bucket.medium}`}
                                            />
                                        )}
                                        {/* Hard (Top) */}
                                        {bucket.hard > 0 && (
                                            <div
                                                style={{ height: `${hardH}%` }}
                                                className="w-full bg-[#000000] transition-all"
                                                title={`Hard: ${bucket.hard}`}
                                            />
                                        )}
                                        {/* No Level */}
                                        {bucket.noLevel > 0 && (
                                            <div
                                                style={{ height: `${noLevelH}%` }}
                                                className="w-full bg-[#a3a3a3] transition-all"
                                                title={`No Level: ${bucket.noLevel}`}
                                            />
                                        )}
                                    </div>

                                    {/* Date tick label */}
                                    <div className="h-6 flex items-center justify-center mt-2">
                                        {shouldShowLabel && (
                                            <span className="text-[9px] sm:text-[10px] text-neutral-500 whitespace-nowrap font-medium">
                                                {bucket.label}
                                            </span>
                                        )}
                                    </div>

                                    {/* Hover Tooltip */}
                                    {isHovered && !isZero && (
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30 p-2.5 rounded-xl bg-white border border-black/10 shadow-2xl text-[11px] whitespace-nowrap pointer-events-none">
                                            <div className="font-bold text-neutral-900 mb-1">{bucket.label}</div>
                                            <div className="space-y-0.5 text-neutral-600">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#d4d4d4]" />
                                                    <span>Easy: {bucket.easy}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#737373]" />
                                                    <span>Medium: {bucket.medium}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-[#000000]" />
                                                    <span>Hard: {bucket.hard}</span>
                                                </div>
                                                <div className="pt-1 mt-1 border-t border-black/[0.06] font-bold text-neutral-900">
                                                    Total: {bucket.total}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend at bottom-left matching screenshot */}
                <div className="flex items-center gap-4 text-xs text-neutral-500 font-medium pt-2">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#d4d4d4]" />
                        <span>Easy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#737373]" />
                        <span>Medium</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#000000]" />
                        <span>Hard</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#a3a3a3]" />
                        <span>No level</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
