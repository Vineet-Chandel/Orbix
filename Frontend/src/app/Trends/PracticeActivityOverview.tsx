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
                <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[4px_4px_0px_#000] flex flex-col justify-between transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Last 7 days
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000]" />
                    </div>
                    <div className="my-3">
                        <span className="text-3xl sm:text-4xl font-black text-black tracking-tight font-mono">
                            {trends.last7Days}
                        </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black text-xs font-black text-neutral-800 shadow-[1px_1px_0px_#000] self-start">
                        problems solved
                    </span>
                </div>

                {/* Last 30 days */}
                <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[4px_4px_0px_#000] flex flex-col justify-between transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Last 30 days
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]" />
                    </div>
                    <div className="my-3">
                        <span className="text-3xl sm:text-4xl font-black text-black tracking-tight font-mono">
                            {trends.last30Days}
                        </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black text-xs font-black text-neutral-800 shadow-[1px_1px_0px_#000] self-start">
                        problems solved
                    </span>
                </div>

                {/* Last 12 months */}
                <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[4px_4px_0px_#000] flex flex-col justify-between transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000]">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Last 12 months
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-black border border-black shadow-[1px_1px_0px_#000]" />
                    </div>
                    <div className="my-3">
                        <span className="text-3xl sm:text-4xl font-black text-black tracking-tight font-mono">
                            {trends.last12Months}
                        </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black text-xs font-black text-neutral-800 shadow-[1px_1px_0px_#000] self-start">
                        problems solved
                    </span>
                </div>
            </div>

            {/* ROW 2: Month So Far Card (<Month> <Year> so far) */}
            <div className="rounded-2xl bg-white border-2 border-black p-6 sm:p-7 shadow-[4px_4px_0px_#000] space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3 pb-2 border-b-2 border-black/10">
                    <div className="p-1.5 rounded-lg bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <FileText className="w-4 h-4 text-black stroke-[2.5]" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                        {trends.monthSoFar.monthName}
                    </h3>
                </div>

                {/* 4 Sub-stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Problems solved */}
                    <div className="rounded-xl bg-[#FAF6EE] border-2 border-black p-4 sm:p-5 space-y-2 flex flex-col justify-between shadow-[3px_3px_0px_#000]">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Problems solved
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {trends.monthSoFar.problemsSolved}
                        </div>
                        <div className="pt-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] ${
                                    trends.monthSoFar.problemsSolvedDelta.includes("more")
                                        ? "bg-[#a2ff86] text-black"
                                        : trends.monthSoFar.problemsSolvedDelta.includes("less")
                                        ? "bg-[#ff9494] text-black"
                                        : "bg-white text-neutral-800"
                                }`}
                            >
                                {trends.monthSoFar.problemsSolvedDelta}
                            </span>
                        </div>
                    </div>

                    {/* Active days */}
                    <div className="rounded-xl bg-[#FAF6EE] border-2 border-black p-4 sm:p-5 space-y-2 flex flex-col justify-between shadow-[3px_3px_0px_#000]">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Active days
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {trends.monthSoFar.activeDays}
                        </div>
                        <div className="pt-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] ${
                                    trends.monthSoFar.activeDaysDelta.includes("more")
                                        ? "bg-[#a2ff86] text-black"
                                        : trends.monthSoFar.activeDaysDelta.includes("less")
                                        ? "bg-[#ff9494] text-black"
                                        : "bg-white text-neutral-800"
                                }`}
                            >
                                {trends.monthSoFar.activeDaysDelta}
                            </span>
                        </div>
                    </div>

                    {/* Hard problems */}
                    <div className="rounded-xl bg-[#FAF6EE] border-2 border-black p-4 sm:p-5 space-y-2 flex flex-col justify-between shadow-[3px_3px_0px_#000]">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Hard problems
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {trends.monthSoFar.hardProblems}
                        </div>
                        <div className="pt-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] ${
                                    trends.monthSoFar.hardProblemsDelta.includes("more")
                                        ? "bg-[#a2ff86] text-black"
                                        : trends.monthSoFar.hardProblemsDelta.includes("less")
                                        ? "bg-[#ff9494] text-black"
                                        : "bg-white text-neutral-800"
                                }`}
                            >
                                {trends.monthSoFar.hardProblemsDelta}
                            </span>
                        </div>
                    </div>

                    {/* Contests */}
                    <div className="rounded-xl bg-[#FAF6EE] border-2 border-black p-4 sm:p-5 space-y-2 flex flex-col justify-between shadow-[3px_3px_0px_#000]">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                            Contests
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {trends.monthSoFar.contests}
                        </div>
                        <div className="pt-1">
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] ${
                                    trends.monthSoFar.contestsDelta.includes("more")
                                        ? "bg-[#a2ff86] text-black"
                                        : trends.monthSoFar.contestsDelta.includes("less")
                                        ? "bg-[#ff9494] text-black"
                                        : "bg-white text-neutral-800"
                                }`}
                            >
                                {trends.monthSoFar.contestsDelta}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details Breakdown Row (2 columns) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t-2 border-black/10">
                    {/* Left Column: Best day & Rating changes */}
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                Best day
                            </span>
                            <span className="text-sm font-black text-black mt-1 block">
                                {trends.monthSoFar.bestDay.text}
                            </span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                Rating changes
                            </span>
                            <span className="text-sm font-black text-black mt-1 block">
                                {trends.monthSoFar.ratingChanges}
                            </span>
                        </div>
                    </div>

                    {/* Right Column: Where you solved & Topics practiced most */}
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                Where you solved
                            </span>
                            <span className="text-sm font-black text-black mt-1 block">
                                {trends.monthSoFar.whereYouSolved}
                            </span>
                        </div>
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600 block mb-2.5">
                                Topics you practised most
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {trends.monthSoFar.topicsPracticedMost.length > 0 ? (
                                    trends.monthSoFar.topicsPracticedMost.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="rounded-lg bg-white border-2 border-black px-3 py-1 text-xs text-black font-black inline-flex items-center gap-2 shadow-[2px_2px_0px_#000] hover:bg-[#FFE566] transition-all cursor-default"
                                        >
                                            <span>{item.topic}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black font-mono text-[11px] font-black">
                                                {item.count}
                                            </span>
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs font-bold text-neutral-500">
                                        No recent practice topics
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3: Problems Solved Stacked Bar Chart */}
            <div className="rounded-2xl bg-white border-2 border-black p-6 sm:p-7 shadow-[4px_4px_0px_#000] space-y-6">
                {/* Header with Switcher */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Calendar className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Problems solved
                        </h3>
                    </div>

                    {/* Weeks / Months toggle */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                        <button
                            type="button"
                            onClick={() => setChartMode("weeks")}
                            className={`px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                chartMode === "weeks"
                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black border-2 border-transparent"
                            }`}
                        >
                            Weeks
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartMode("months")}
                            className={`px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                chartMode === "months"
                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black border-2 border-transparent"
                            }`}
                        >
                            Months
                        </button>
                    </div>
                </div>

                {/* The Stacked Bar Chart Container */}
                <div className="w-full pt-4 pb-2 relative">
                    <div className="w-full h-52 sm:h-60 flex items-end justify-between gap-1 sm:gap-2 px-1 relative">
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
                                        <span className="text-[10px] sm:text-[11px] font-black text-black font-mono mb-1 select-none">
                                            {bucket.total}
                                        </span>
                                    )}

                                    {/* Stacked Bar Container */}
                                    <div
                                        style={{ height: `${heightPercent}%` }}
                                        className={`w-full max-w-[20px] sm:max-w-[26px] rounded-t-md border-2 border-black overflow-hidden flex flex-col-reverse shadow-[1px_1px_0px_#000] transition-all duration-200 ${
                                            isHovered ? "ring-2 ring-black scale-105" : ""
                                        }`}
                                    >
                                        {/* Easy (Bottom) */}
                                        {bucket.easy > 0 && (
                                            <div
                                                style={{ height: `${easyH}%` }}
                                                className="w-full bg-[#d4d4d4] transition-all border-b border-black/20"
                                                title={`Easy: ${bucket.easy}`}
                                            />
                                        )}
                                        {/* Medium (Middle) */}
                                        {bucket.medium > 0 && (
                                            <div
                                                style={{ height: `${medH}%` }}
                                                className="w-full bg-[#737373] transition-all border-b border-black/20"
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
                                            <span className="text-[9px] sm:text-[10px] text-neutral-800 whitespace-nowrap font-black font-mono">
                                                {bucket.label}
                                            </span>
                                        )}
                                    </div>

                                    {/* Hover Tooltip */}
                                    {isHovered && !isZero && (
                                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30 p-3 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-xs whitespace-nowrap pointer-events-none">
                                            <div className="font-black text-black mb-1.5 pb-1 border-b border-black/15">
                                                {bucket.label}
                                            </div>
                                            <div className="space-y-1 font-bold text-neutral-800">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-[#d4d4d4] border border-black" />
                                                    <span>Easy: {bucket.easy}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-[#737373] border border-black" />
                                                    <span>Medium: {bucket.medium}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-[#000000] border border-black" />
                                                    <span>Hard: {bucket.hard}</span>
                                                </div>
                                                <div className="pt-1 mt-1 border-t-2 border-black/10 font-black text-black flex items-center justify-between gap-4">
                                                    <span>Total:</span>
                                                    <span className="font-mono">{bucket.total}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend at bottom-left matching Neo-Brutalism */}
                <div className="flex items-center gap-3 text-xs font-black text-black pt-2 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#d4d4d4] border border-black" />
                        <span>Easy</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#737373] border border-black" />
                        <span>Medium</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#000000] border border-black" />
                        <span>Hard</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#a3a3a3] border border-black" />
                        <span>No level</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
