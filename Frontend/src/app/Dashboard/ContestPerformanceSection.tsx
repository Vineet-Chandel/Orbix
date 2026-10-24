import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
    LineChart as ChartIcon,
    Trophy,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    Award,
    CheckCircle2,
    RefreshCw,
    X,
    ExternalLink,
    ChevronRight,
    Sparkles,
    AlertCircle,
} from "lucide-react";
import { useAppDispatch, useAppSelector, fetchContestPerformance, type PlatformContestAnalytics, type ContestHistoryPoint } from "../../store";
import { getPortalIcon } from "../../utils/portalIcons";
import { RecentContestsCard } from "./RecentContestsCard";
import { CodeforcesBadge } from "../../components/CodeforcesBadge";
import { CodeforcesRatingLadder } from "../../components/CodeforcesRatingLadder";
import { LeetCodeBadge } from "../../components/LeetCodeBadge";
import { LeetCodeRatingLadder } from "../../components/LeetCodeRatingLadder";
import { CodeChefBadge } from "../../components/CodeChefBadge";
import { CodeChefRatingLadder } from "../../components/CodeChefRatingLadder";
import { AtCoderBadge } from "../../components/AtCoderBadge";
import { AtCoderRatingLadder } from "../../components/AtCoderRatingLadder";

interface ContestPerformanceSectionProps {
    connectedPortals: Record<string, any>;
    username?: string;
}

type TimeRangeFilter = "6M" | "1Y" | "ALL";

export const CONTEST_ELIGIBLE_REGISTRY: Record<string, { name: string; exploreUrl: string }> = {
    codeforces: { name: "Codeforces", exploreUrl: "https://codeforces.com/contests" },
    leetcode: { name: "LeetCode", exploreUrl: "https://leetcode.com/contest/" },
    codechef: { name: "CodeChef", exploreUrl: "https://www.codechef.com/contests" },
    atcoder: { name: "AtCoder", exploreUrl: "https://atcoder.jp/contests/" },
    hackerrank: { name: "HackerRank", exploreUrl: "https://www.hackerrank.com/contests" },
    topcoder: { name: "TopCoder", exploreUrl: "https://www.topcoder.com/community/single-round-match" },
    geeksforgeeks: { name: "GeeksforGeeks", exploreUrl: "https://practice.geeksforgeeks.org/events/rec/gfg-weekly-coding-contest" },
    hackerearth: { name: "HackerEarth", exploreUrl: "https://www.hackerearth.com/challenges/" },
    interviewbit: { name: "InterviewBit", exploreUrl: "https://www.interviewbit.com/contest/" },
    code360: { name: "Code360", exploreUrl: "https://www.naukri.com/code360/contests" },
};

export const ContestPerformanceSection: React.FC<ContestPerformanceSectionProps> = ({
    connectedPortals,
    username = "",
}) => {
    const effectiveUser = (username || "").trim();
    const dispatch = useAppDispatch();

    // Redux store state
    const contestData = useAppSelector((state) => state.contests.dataByUser[effectiveUser]);
    const isLoading = useAppSelector((state) => state.contests.loadingByUser[effectiveUser]);

    // Active platform selection
    const [selectedPortal, setSelectedPortal] = useState<string>("codeforces");
    const [hasUserSelected, setHasUserSelected] = useState<boolean>(false);
    const [timeRange, setTimeRange] = useState<TimeRangeFilter>("ALL");
    const [hoveredPoint, setHoveredPoint] = useState<ContestHistoryPoint | null>(null);
    const [isTierModalOpen, setIsTierModalOpen] = useState<boolean>(false);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    const activePortalsMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!connectedPortals || typeof connectedPortals !== "object") return map;
        for (const [k, v] of Object.entries(connectedPortals)) {
            const portalKey = k.toLowerCase().trim();
            const rawUser = typeof v === "object" ? v?.username || v?.portalUsername || "" : String(v || "");
            const cleanUser = rawUser.trim();
            if (cleanUser && portalKey !== "github" && !portalKey.startsWith("_") && portalKey !== "theme") {
                map.set(portalKey, cleanUser);
            }
        }
        return map;
    }, [connectedPortals]);

    const portalsFingerprint = useMemo(() => {
        return Array.from(activePortalsMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join("|");
    }, [activePortalsMap]);

    const prevFingerprintRef = useRef<string | null>(null);

    // Initial and dynamic sync whenever connected portals change
    useEffect(() => {
        if (!effectiveUser) return;
        const isInitial = prevFingerprintRef.current === null;
        const hasChanged = prevFingerprintRef.current !== portalsFingerprint;
        prevFingerprintRef.current = portalsFingerprint;

        dispatch(fetchContestPerformance({
            username: effectiveUser,
            portals: connectedPortals,
            force: !isInitial && hasChanged
        }));
    }, [effectiveUser, dispatch, connectedPortals, portalsFingerprint]);

    // Discover eligible platforms dynamically - ONLY those where contest data can be extracted AND user is connected
    const platformsList: PlatformContestAnalytics[] = useMemo(() => {
        if (contestData?.platforms && contestData.platforms.length > 0) {
            // Filter strictly to platforms that are currently active in activePortalsMap (if available) and where contest data can be extracted
            const filtered = contestData.platforms.filter((p) => {
                const portalKey = p.portal.toLowerCase();
                if (activePortalsMap.size > 0 && !activePortalsMap.has(portalKey)) {
                    return false;
                }
                const isConn = Boolean(p.connected && p.portalUsername);
                const isExtractable = p.status === "valid" || p.status === "no_contests" || p.status === "syncing";
                const isEligible = Boolean(CONTEST_ELIGIBLE_REGISTRY[portalKey]);
                return isConn && isExtractable && isEligible;
            });

            // Sort: highest contest count first, then rating, then alphabetical
            return [...filtered].sort((a, b) => {
                if (a.ratedContestsCount !== b.ratedContestsCount) {
                    return b.ratedContestsCount - a.ratedContestsCount;
                }
                const ratingA = a.currentRating || 0;
                const ratingB = b.currentRating || 0;
                if (ratingA !== ratingB) return ratingB - ratingA;
                return a.portalName.localeCompare(b.portalName);
            });
        }

        // Fallback local discovery from connectedPortals props if remote not loaded yet
        if (connectedPortals && typeof connectedPortals === "object") {
            const list: PlatformContestAnalytics[] = [];
            for (const [k, v] of Object.entries(connectedPortals)) {
                const portalKey = k.toLowerCase().trim();
                if (CONTEST_ELIGIBLE_REGISTRY[portalKey]) {
                    const pUser = typeof v === "object" ? v?.username || v?.portalUsername || "" : String(v || "");
                    if (pUser) {
                        const cfg = CONTEST_ELIGIBLE_REGISTRY[portalKey]!;
                        list.push({
                            portal: portalKey,
                            portalName: cfg.name,
                            portalUsername: pUser,
                            profileUrl: "",
                            connected: true,
                            currentRating: null,
                            peakRating: null,
                            tier: null,
                            tierColor: null,
                            tierInfo: null,
                            officialRank: null,
                            percentile: null,
                            ratedContestsCount: 0,
                            history: [],
                            recentChange90d: null,
                            lastSyncAt: new Date().toISOString(),
                            status: "syncing",
                            exploreContestsUrl: cfg.exploreUrl,
                        });
                    }
                }
            }
            return list;
        }

        return [];
    }, [contestData, connectedPortals, activePortalsMap]);

    // Default select the first connected platform that has contests or is connected
    useEffect(() => {
        if (platformsList.length > 0) {
            const currentSelected = platformsList.find((p) => p.portal === selectedPortal);
            if (!hasUserSelected || !currentSelected) {
                const firstWithContests = platformsList.find((p) => p.ratedContestsCount > 0);
                const target = firstWithContests || platformsList[0];
                if (target && target.portal !== selectedPortal) {
                    setSelectedPortal(target.portal);
                }
            }
        }
    }, [platformsList, selectedPortal, hasUserSelected]);

    // Active platform analytics
    const activePlatform = useMemo(() => {
        return platformsList.find((p) => p.portal === selectedPortal) || platformsList[0];
    }, [platformsList, selectedPortal]);

    // Filter history by time range
    const filteredHistory = useMemo(() => {
        if (!activePlatform || !activePlatform.history || activePlatform.history.length === 0) {
            return [];
        }
        if (timeRange === "ALL") {
            return activePlatform.history;
        }
        const now = Date.now();
        const days = timeRange === "6M" ? 180 : 365;
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        const filtered = activePlatform.history.filter((pt) => pt.timestamp >= cutoff);
        // If the filtered range has at least 1 point, return it; otherwise fallback to all available
        return filtered.length > 0 ? filtered : activePlatform.history;
    }, [activePlatform, timeRange]);

    // Latest contest point in the active platform's history
    const latestContestPoint = useMemo(() => {
        if (!activePlatform?.history || activePlatform.history.length === 0) return null;
        return activePlatform.history[activePlatform.history.length - 1] || null;
    }, [activePlatform]);

    // Current display point (either hovered or latest)
    const displayedPoint = hoveredPoint || latestContestPoint;

    // Total rated contests summary across all platforms
    const totalRatedContests = useMemo(() => {
        if (contestData?.summary?.totalRatedContests !== undefined) {
            return contestData.summary.totalRatedContests;
        }
        return platformsList.reduce((acc, p) => acc + (p.connected ? p.ratedContestsCount : 0), 0);
    }, [contestData, platformsList]);

    // Proportional platform contest breakdown for top-right card
    const contestBreakdown = useMemo(() => {
        const list = platformsList.filter((p) => p.connected || p.ratedContestsCount > 0);
        const maxCount = Math.max(1, ...list.map((p) => p.ratedContestsCount));
        return list.map((p) => ({
            portal: p.portal,
            portalName: p.portalName,
            count: p.ratedContestsCount,
            percentage: Math.round((p.ratedContestsCount / maxCount) * 100),
        }));
    }, [platformsList]);

    // Rating progression chart metrics
    const chartData = useMemo(() => {
        if (!filteredHistory || filteredHistory.length === 0) {
            return null;
        }

        const ratings = filteredHistory.map((h) => h.rating);
        const minRating = Math.min(...ratings);
        const maxRating = Math.max(...ratings);

        // Add padding to Y-axis scale
        const ratingPadding = Math.max(30, Math.round((maxRating - minRating) * 0.15));
        const yMin = Math.max(0, minRating - ratingPadding);
        const yMax = maxRating + ratingPadding;
        const yRange = Math.max(1, yMax - yMin);

        // SVG dimensions
        const svgWidth = 900;
        const svgHeight = 300;
        const padLeft = 45;
        const padRight = 30;
        const padTop = 25;
        const padBottom = 40;
        const plotWidth = svgWidth - padLeft - padRight;
        const plotHeight = svgHeight - padTop - padBottom;

        const timestamps = filteredHistory.map((h) => h.timestamp);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const tsRange = Math.max(1, maxTs - minTs);

        // Calculate (x, y) coordinates for each point
        const points = filteredHistory.map((pt, idx) => {
            const xRatio = tsRange === 0 || filteredHistory.length === 1 ? 0.5 : (pt.timestamp - minTs) / tsRange;
            const x = padLeft + xRatio * plotWidth;
            const yRatio = (pt.rating - yMin) / yRange;
            const y = svgHeight - padBottom - yRatio * plotHeight;
            return {
                x,
                y,
                point: pt,
                index: idx,
            };
        });

        // Path generator
        let pathD = "";
        let areaD = "";

        if (points.length === 1 && points[0]) {
            pathD = `M ${padLeft} ${points[0].y} L ${svgWidth - padRight} ${points[0].y}`;
            areaD = `M ${padLeft} ${points[0].y} L ${svgWidth - padRight} ${points[0].y} L ${svgWidth - padRight} ${svgHeight - padBottom} L ${padLeft} ${svgHeight - padBottom} Z`;
        } else if (points.length > 1) {
            pathD = `M ${points[0]?.x} ${points[0]?.y}`;
            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                if (prev && curr) {
                    // Smooth connecting curve
                    const cpX = (prev.x + curr.x) / 2;
                    pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
                }
            }

            const firstPoint = points[0];
            const lastPoint = points[points.length - 1];
            if (firstPoint && lastPoint) {
                areaD = `${pathD} L ${lastPoint.x} ${svgHeight - padBottom} L ${firstPoint.x} ${svgHeight - padBottom} Z`;
            }
        }

        // Generate 4 horizontal gridlines
        const gridLines = [0, 0.33, 0.66, 1].map((ratio) => {
            const ratingVal = Math.round(yMin + ratio * yRange);
            const y = svgHeight - padBottom - ratio * plotHeight;
            return { ratingVal, y };
        });

        // Generate date ticks
        const dateTicks: Array<{ label: string; x: number }> = [];
        if (points.length > 0) {
            const step = Math.max(1, Math.floor(points.length / 5));
            for (let i = 0; i < points.length; i += step) {
                const p = points[i];
                if (p) {
                    const d = new Date(p.point.timestamp);
                    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                    dateTicks.push({ label, x: p.x });
                }
            }
            // Ensure last point date tick is included
            const lastPt = points[points.length - 1];
            if (lastPt && (dateTicks.length === 0 || Math.abs(dateTicks[dateTicks.length - 1]!.x - lastPt.x) > 60)) {
                const d = new Date(lastPt.point.timestamp);
                dateTicks.push({
                    label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
                    x: lastPt.x,
                });
            }
        }

        return {
            svgWidth,
            svgHeight,
            padLeft,
            padRight,
            padTop,
            padBottom,
            plotHeight,
            plotWidth,
            points,
            pathD,
            areaD,
            gridLines,
            dateTicks,
            yMin,
            yMax,
        };
    }, [filteredHistory]);

    // Handle mouse movement over chart to identify nearest point
    const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!chartData || chartData.points.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * chartData.svgWidth;

        // Find nearest point along X
        let nearest = chartData.points[0];
        let minDist = Infinity;
        for (const pt of chartData.points) {
            const dist = Math.abs(pt.x - mouseX);
            if (dist < minDist) {
                minDist = dist;
                nearest = pt;
            }
        }
        if (nearest) {
            setHoveredPoint(nearest.point);
        }
    };

    const handleChartMouseLeave = () => {
        setHoveredPoint(null);
    };

    // Force re-sync handler
    const handleRefresh = () => {
        if (effectiveUser) {
            dispatch(fetchContestPerformance({ username: effectiveUser, force: true, portals: connectedPortals }));
        }
    };

    // Helper formatters
    const formatNumber = (num: number | null | undefined): string => {
        if (num === null || num === undefined) return "—";
        return num.toLocaleString();
    };

    const formatDateStr = (dateStr: string | number | undefined): string => {
        if (!dateStr) return "—";
        const d = typeof dateStr === "number" ? new Date(dateStr) : new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <section
            className="w-full rounded-2xl bg-white border-2 border-black text-neutral-900 p-6 sm:p-8 shadow-[4px_4px_0px_#000] relative overflow-hidden select-none font-sans"
            aria-label="Contest Performance Module"
        >
            {/* ========================================================================= */}
            {/* TOP ROW — Contest Rating Graph (Left) & Total Contests Summary (Right)    */}
            {/* ========================================================================= */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
                {/* Primary Column: Rating & Progression Graph (8 of 12 cols on desktop) */}
                <div className="lg:col-span-8 flex flex-col justify-between">
                    {/* Section Header & Platform Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-black/15">
                        {/* Title & Icon */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                                <ChartIcon className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-black tracking-tight flex items-center gap-2">
                                    <span>Contest rating</span>
                                    {isLoading && (
                                        <RefreshCw className="w-3.5 h-3.5 text-neutral-500 animate-spin" />
                                    )}
                                </h3>
                                <p className="text-xs text-neutral-600 font-bold">
                                    Rating progression over time
                                </p>
                            </div>
                        </div>

                        {/* Platform Selector Tabs */}
                        {platformsList.length > 0 ? (
                            <div
                                role="tablist"
                                aria-label="Connected Contest Platforms"
                                className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] overflow-x-auto no-scrollbar self-start sm:self-auto max-w-full"
                            >
                                {platformsList.map((platform) => {
                                    const isActive = platform.portal === selectedPortal;
                                    return (
                                        <button
                                            key={platform.portal}
                                            type="button"
                                            role="tab"
                                            aria-selected={isActive}
                                            onClick={() => {
                                                setSelectedPortal(platform.portal);
                                                setHasUserSelected(true);
                                                setHoveredPoint(null);
                                            }}
                                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                                                isActive
                                                    ? "bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]"
                                                    : "text-neutral-700 hover:text-black hover:bg-neutral-200"
                                            }`}
                                        >
                                            <span className="w-3.5 h-3.5 flex items-center justify-center">
                                                {getPortalIcon(platform.portal, "w-3.5 h-3.5")}
                                            </span>
                                            <span>{platform.portalName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <Link
                                to="/profile"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-black hover:bg-neutral-100 bg-white border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                <span>Connect contest platform</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                    </div>

                    {/* Rating Summary (Primary & Supporting Metrics) */}
                    <div className="pt-5 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-5 relative z-10">
                        {/* Rating, Tier badge, Peak & Contests */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider block">
                                Rating
                            </span>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Current Rating */}
                                <span className="text-4xl sm:text-5xl font-black text-black tracking-tight font-sans">
                                    {activePlatform?.currentRating !== null && activePlatform?.currentRating !== undefined
                                        ? activePlatform.currentRating
                                        : "—"}
                                </span>

                                {/* Tier Badge */}
                                {activePlatform?.tier && (
                                    activePlatform.portal.toLowerCase() === "codeforces" ? (
                                        <CodeforcesBadge
                                            tier={activePlatform.tier}
                                            rating={activePlatform.currentRating}
                                            size="sm"
                                        />
                                    ) : activePlatform.portal.toLowerCase() === "leetcode" ? (
                                        <LeetCodeBadge
                                            tier={activePlatform.tier}
                                            rating={activePlatform.currentRating}
                                            size="sm"
                                        />
                                    ) : activePlatform.portal.toLowerCase() === "codechef" ? (
                                        <CodeChefBadge
                                            tier={activePlatform.tier}
                                            rating={activePlatform.currentRating}
                                            size="sm"
                                        />
                                    ) : activePlatform.portal.toLowerCase() === "atcoder" ? (
                                        <AtCoderBadge
                                            tier={activePlatform.tier}
                                            rating={activePlatform.currentRating}
                                            size="sm"
                                        />
                                    ) : (
                                        <span
                                            style={{
                                                backgroundColor: activePlatform.tierColor || "#171717",
                                            }}
                                            className="px-2.5 py-1 rounded-md text-xs font-black text-white uppercase tracking-wider shadow-[1px_1px_0px_#000] border border-black"
                                        >
                                            {activePlatform.tier}
                                        </span>
                                    )
                                )}

                                {/* Secondary Metrics: Max & Contests */}
                                <div className="flex items-center gap-4 text-xs font-bold text-neutral-700 pl-1">
                                    {activePlatform?.peakRating !== null && activePlatform?.peakRating !== undefined && (
                                        <div>
                                            <span>Max</span>{" "}
                                            <strong className="text-black font-black font-mono">{activePlatform.peakRating}</strong>
                                        </div>
                                    )}
                                    <div>
                                        <span>Contests</span>{" "}
                                        <strong className="text-black font-black font-mono">{activePlatform?.ratedContestsCount || 0}</strong>
                                    </div>

                                    {/* 90-Day Rating Change */}
                                    {typeof activePlatform?.recentChange90d === "number" && activePlatform.recentChange90d !== 0 && (
                                        <div
                                            className={`inline-flex items-center gap-1 font-black ${
                                                activePlatform.recentChange90d > 0 ? "text-black" : "text-neutral-700"
                                            }`}
                                        >
                                            {activePlatform.recentChange90d > 0 ? (
                                                <TrendingUp className="w-3.5 h-3.5 text-black" />
                                            ) : (
                                                <TrendingDown className="w-3.5 h-3.5 text-neutral-700" />
                                            )}
                                            <span>
                                                {activePlatform.recentChange90d > 0 ? `+${activePlatform.recentChange90d}` : activePlatform.recentChange90d} in 90d
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* What does [Tier] mean? Modal Trigger */}
                            {activePlatform?.tier && (
                                <button
                                    type="button"
                                    onClick={() => setIsTierModalOpen(true)}
                                    className="text-xs font-bold text-neutral-700 hover:text-black transition-colors inline-flex items-center gap-1 cursor-pointer pt-1"
                                >
                                    <span>What does {activePlatform.tier} mean?</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Top-Right Info Highlight on Hover / Latest Contest */}
                        {displayedPoint && (
                            <div className="flex flex-col items-start md:items-end text-left md:text-right space-y-1 bg-[#FAF6EE] p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                <div className="flex items-center gap-2 md:justify-end">
                                    <span className="text-[11px] font-bold text-neutral-500 uppercase">Rating</span>
                                    <span className="text-xl sm:text-2xl font-black text-black font-mono">
                                        {displayedPoint.rating}
                                    </span>
                                </div>
                                <div className="text-xs font-black text-black max-w-xs truncate">
                                    {displayedPoint.contestName}
                                </div>
                                <div className="text-[11px] font-bold text-neutral-600 flex items-center gap-2 md:justify-end">
                                    <span>{formatDateStr(displayedPoint.date || displayedPoint.timestamp)}</span>
                                    {displayedPoint.rank && (
                                        <>
                                            <span className="w-1.5 h-1.5 rounded-full bg-black" />
                                            <span>Rank {formatNumber(displayedPoint.rank)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Time Range Filters & Chart Area */}
                    <div className="w-full flex items-center justify-end pb-2 pt-1 relative z-10">
                        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black">
                            {(["6M", "1Y", "ALL"] as TimeRangeFilter[]).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setTimeRange(r)}
                                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-black ${
                                        timeRange === r
                                            ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                            : "text-neutral-700 hover:text-black"
                                    }`}
                                >
                                    {r === "ALL" ? "All Time" : r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* The Rating Line Chart or Empty State Container */}
                    <div
                        ref={chartContainerRef}
                        className="w-full flex-1 min-h-[260px] sm:min-h-[300px] flex flex-col justify-end relative"
                    >
                        {/* CASE A & B: Connected but no contests, or timeline unavailable */}
                        {(!activePlatform || activePlatform.status === "no_contests" || filteredHistory.length === 0) && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-black/[0.02] border border-dashed border-black/10">
                                <div className="w-12 h-12 rounded-2xl bg-black/[0.04] border border-black/10 flex items-center justify-center text-neutral-700">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-extrabold text-neutral-900">
                                        {activePlatform?.status === "history_unavailable"
                                            ? "Rating history unavailable"
                                            : "No contest history yet"}
                                    </h4>
                                    <p className="text-xs text-neutral-500 leading-relaxed">
                                        {activePlatform?.statusMessage ||
                                            `Participate in a rated contest on ${activePlatform?.portalName} to start tracking your rating progression.`}
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <a
                                        href={activePlatform?.exploreContestsUrl || `https://${activePlatform?.portal}.com`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                                    >
                                        <span>Explore contests</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* CASE C: Syncing state */}
                        {activePlatform?.status === "syncing" && filteredHistory.length === 0 && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-black/[0.02] border border-black/10">
                                <RefreshCw className="w-8 h-8 text-neutral-800 animate-spin" />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-extrabold text-neutral-900">Preparing contest data</h4>
                                    <p className="text-xs text-neutral-500">
                                        Synchronizing latest contest standings from {activePlatform?.portalName}...
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* CASE D: Sync error */}
                        {activePlatform?.status === "error" && filteredHistory.length === 0 && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-black/[0.02] border border-black/10">
                                <AlertCircle className="w-8 h-8 text-neutral-700" />
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-extrabold text-neutral-900">Unable to refresh contest data</h4>
                                    <p className="text-xs text-neutral-500">
                                        {activePlatform?.statusMessage || "Could not retrieve contest history at this moment."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Retry</span>
                                </button>
                            </div>
                        )}

                        {/* CASE E: Not Connected */}
                        {activePlatform?.connected === false && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-black/[0.02] border border-dashed border-black/10">
                                <div className="w-12 h-12 rounded-2xl bg-black/[0.04] border border-black/10 flex items-center justify-center text-neutral-700">
                                    {getPortalIcon(activePlatform.portal, "w-6 h-6")}
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-extrabold text-neutral-900">
                                        Connect {activePlatform.portalName}
                                    </h4>
                                    <p className="text-xs text-neutral-500">
                                        Connect your {activePlatform.portalName} handle in your profile to track your contest rating progression and official rank.
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <Link
                                        to="/profile"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-extrabold transition-all cursor-pointer shadow-xs"
                                    >
                                        <span>Connect platform</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* ACTUAL RATING GRAPH (rendered when valid history exists) */}
                        {chartData && filteredHistory.length > 0 && (
                            <div className="w-full relative">
                                <svg
                                    viewBox={`0 0 ${chartData.svgWidth} ${chartData.svgHeight}`}
                                    className="w-full h-auto overflow-visible select-none cursor-crosshair"
                                    onMouseMove={handleChartMouseMove}
                                    onMouseLeave={handleChartMouseLeave}
                                >
                                    <defs>
                                        <linearGradient id="contestAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#000000" stopOpacity="0.08" />
                                            <stop offset="85%" stopColor="#000000" stopOpacity="0.01" />
                                            <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                                        </linearGradient>
                                        <filter id="glowPoint" x="-50%" y="-50%" width="200%" height="200%">
                                            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
                                        </filter>
                                    </defs>

                                    {/* Horizontal Dashed Gridlines & Ticks */}
                                    {chartData.gridLines.map((grid, idx) => (
                                        <g key={idx}>
                                            <line
                                                x1={chartData.padLeft}
                                                y1={grid.y}
                                                x2={chartData.svgWidth - chartData.padRight}
                                                y2={grid.y}
                                                stroke="rgba(0,0,0,0.06)"
                                                strokeDasharray="4 4"
                                                strokeWidth="1"
                                            />
                                            <text
                                                x={chartData.padLeft - 8}
                                                y={grid.y + 3.5}
                                                textAnchor="end"
                                                fill="#9ca3af"
                                                fontSize="10"
                                                fontFamily="sans-serif"
                                                fontWeight="600"
                                            >
                                                {grid.ratingVal}
                                            </text>
                                        </g>
                                    ))}

                                    {/* Area Fill beneath curve */}
                                    {chartData.areaD && (
                                        <path d={chartData.areaD} fill="url(#contestAreaGrad)" />
                                    )}

                                    {/* Primary Rating Progression Line */}
                                    {chartData.pathD && (
                                        <path
                                            d={chartData.pathD}
                                            fill="none"
                                            stroke="#000000"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    )}

                                    {/* Date Ticks on X-Axis */}
                                    {chartData.dateTicks.map((tick, idx) => (
                                        <text
                                            key={idx}
                                            x={tick.x}
                                            y={chartData.svgHeight - chartData.padBottom + 18}
                                            textAnchor="middle"
                                            fill="#9ca3af"
                                            fontSize="10"
                                            fontFamily="sans-serif"
                                            fontWeight="600"
                                        >
                                            {tick.label}
                                        </text>
                                    ))}

                                    {/* Interactive Hover Vertical Guideline & Glowing Dot */}
                                    {chartData.points.map((pt) => {
                                        const isHovered = hoveredPoint?.contestId === pt.point.contestId;
                                        if (!isHovered) return null;
                                        return (
                                            <g key={pt.index}>
                                                {/* Vertical Guideline */}
                                                <line
                                                    x1={pt.x}
                                                    y1={chartData.padTop}
                                                    x2={pt.x}
                                                    y2={chartData.svgHeight - chartData.padBottom}
                                                    stroke="#000000"
                                                    strokeOpacity="0.3"
                                                    strokeWidth="1.5"
                                                    strokeDasharray="3 3"
                                                />

                                                {/* Outer Halo */}
                                                <circle
                                                    cx={pt.x}
                                                    cy={pt.y}
                                                    r="8"
                                                    fill="#000000"
                                                    fillOpacity="0.1"
                                                />

                                                {/* Inner Dot with Glow */}
                                                <circle
                                                    cx={pt.x}
                                                    cy={pt.y}
                                                    r="4.5"
                                                    fill="#000000"
                                                    stroke="#ffffff"
                                                    strokeWidth="2"
                                                    filter="url(#glowPoint)"
                                                />
                                            </g>
                                        );
                                    })}

                                    {/* Latest Contest Point Permanent Marker if not hovered */}
                                    {!hoveredPoint && chartData.points.length > 0 && (
                                        (() => {
                                            const lastPt = chartData.points[chartData.points.length - 1];
                                            if (!lastPt) return null;
                                            return (
                                                <g>
                                                    <circle
                                                        cx={lastPt.x}
                                                        cy={lastPt.y}
                                                        r="6"
                                                        fill="#000000"
                                                        fillOpacity="0.1"
                                                    />
                                                    <circle
                                                        cx={lastPt.x}
                                                        cy={lastPt.y}
                                                        r="3.5"
                                                        fill="#000000"
                                                        stroke="#ffffff"
                                                        strokeWidth="1.5"
                                                    />
                                                </g>
                                            );
                                        })()
                                    )}
                                </svg>
                            </div>
                        )}
                    </div>
                </div>

                {/* Secondary Column: Contests Total Summary (4 of 12 cols on desktop) */}
                <div className="lg:col-span-4 flex flex-col justify-between lg:border-l-2 lg:border-black/15 lg:pl-8 pt-6 lg:pt-0 border-t-2 lg:border-t-0 border-black/15">
                    <div className="space-y-5">
                        {/* Card Header: Trophy icon + Contests */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                                <Trophy className="w-5 h-5 text-black" />
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                Contests
                            </h3>
                        </div>

                        {/* Big Count: Total Rated Contests */}
                        <div className="space-y-1">
                            <div className="text-4xl sm:text-5xl font-black text-black tracking-tight font-sans">
                                {totalRatedContests}
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                rated contests in total
                            </p>
                        </div>

                        {/* Platform Breakdown with Proportional Progress Bars & Badges */}
                        <div className="space-y-3 pt-1">
                            {contestBreakdown.map((item) => (
                                <button
                                    key={item.portal}
                                    type="button"
                                    onClick={() => setSelectedPortal(item.portal)}
                                    className={`w-full flex flex-col gap-2 p-3 rounded-xl border-2 border-black transition-all cursor-pointer group text-left shadow-[2px_2px_0px_#000] ${
                                        selectedPortal === item.portal
                                            ? "bg-[#FAF6EE]"
                                            : "bg-white hover:bg-[#FAF6EE]"
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-xs sm:text-sm">
                                        <div className="flex items-center gap-2 font-black text-black transition-colors">
                                            <span className="w-4.5 h-4.5 flex items-center justify-center">
                                                {getPortalIcon(item.portal, "w-4.5 h-4.5")}
                                            </span>
                                            <span>{item.portalName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-black bg-[#FFE566] border border-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_#000]">
                                                {item.percentage}%
                                            </span>
                                            <span className="font-black text-black font-mono">
                                                {item.count}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Horizontal Bar */}
                                    <div className="w-full h-2 rounded-full bg-neutral-200 border border-black overflow-hidden">
                                        <div
                                            style={{ width: `${item.percentage}%` }}
                                            className="h-full bg-black rounded-full transition-all duration-500"
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Contest Highlights Panel to beautifully fill vertical space and provide rich insights */}
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <div className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                <span>Contest Highlights</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="space-y-0.5">
                                    <span className="text-neutral-600 font-bold text-[11px]">Primary Platform</span>
                                    <div className="font-black text-black truncate">
                                        {contestBreakdown[0]?.portalName || "All Connected"}
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-neutral-600 font-bold text-[11px]">Best Peak Rating</span>
                                    <div className="font-black text-black font-mono">
                                        {Math.max(...platformsList.map((p) => p.peakRating || p.currentRating || 0), 0) || "—"}
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-neutral-600 font-bold text-[11px]">Platforms Synced</span>
                                    <div className="font-black text-black">
                                        {platformsList.length} Active
                                    </div>
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-neutral-600 font-bold text-[11px]">Contest Standing</span>
                                    <div className="font-black text-black truncate">
                                        {activePlatform?.tier || "Ranked"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer synchronization note */}
                    <div className="pt-4 mt-6 border-t-2 border-black/15 flex items-center justify-between text-xs text-neutral-600 font-bold">
                        <span>Dynamic Multi-Platform Sync</span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="text-black hover:text-neutral-700 transition-colors cursor-pointer flex items-center gap-1 font-black"
                            title="Refresh contest performance"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Sync</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* HORIZONTAL DIVIDER                                                        */}
            {/* ========================================================================= */}
            <div className="w-full h-[2px] bg-black/15 my-7 relative z-10" />

            {/* ========================================================================= */}
            {/* SECTION 2 — Platform Ranks and Recent Contests (Parallel in same block)   */}
            {/* ========================================================================= */}
            <div className="w-full relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Side: Platform ranks */}
                <div className="space-y-4">
                    {/* Header: Trophy/Award icon + Platform ranks */}
                    <div className="flex items-center gap-3 pb-3 border-b-2 border-black/15">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <Award className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                Platform ranks
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                Current contest standings and rank progress across eligible platforms
                            </p>
                        </div>
                    </div>

                    {/* Responsive Multi-Platform Grid */}
                    {platformsList.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {platformsList.map((platform) => {
                                const isSelected = platform.portal === selectedPortal;
                                const hasContests = platform.ratedContestsCount > 0;
                                const hasRating = platform.currentRating !== null && platform.currentRating !== undefined;

                                return (
                                    <button
                                        key={platform.portal}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPortal(platform.portal);
                                            setHasUserSelected(true);
                                            chartContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                        }}
                                        className={`flex flex-col justify-between p-4 sm:p-5 rounded-2xl transition-all cursor-pointer text-left relative overflow-hidden border-2 border-black shadow-[4px_4px_0px_#000] ${
                                            isSelected
                                                ? "bg-black text-white"
                                                : "bg-white text-black hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000]"
                                        }`}
                                    >
                                        {/* Top: Platform Icon + Name + Verified Badge */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                        isSelected
                                                            ? "bg-white/10 border border-white/20"
                                                            : "bg-white border-2 border-black shadow-[1px_1px_0px_#000]"
                                                    }`}>
                                                        {getPortalIcon(platform.portal, "w-4.5 h-4.5")}
                                                    </div>
                                                    <span className={`font-black text-sm sm:text-base ${isSelected ? "text-white" : "text-black"}`}>
                                                        {platform.portalName}
                                                    </span>
                                                </div>

                                                {platform.connected && (
                                                    <div
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center border border-black ${
                                                            isSelected ? "bg-[#a2ff86] text-black" : "bg-black text-[#a2ff86]"
                                                        }`}
                                                        title="Verified Connected Profile"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Middle: Rating & Tier Badge */}
                                            <div className="flex items-baseline gap-2 pt-1">
                                                <span className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${
                                                    isSelected ? "text-white" : "text-black"
                                                }`}>
                                                    {hasRating ? platform.currentRating : "—"}
                                                </span>

                                                {platform.tier && (
                                                    platform.portal.toLowerCase() === "codeforces" ? (
                                                        <CodeforcesBadge
                                                            tier={platform.tier}
                                                            rating={platform.currentRating}
                                                            size="sm"
                                                        />
                                                    ) : platform.portal.toLowerCase() === "leetcode" ? (
                                                        <LeetCodeBadge
                                                            tier={platform.tier}
                                                            rating={platform.currentRating}
                                                            size="sm"
                                                        />
                                                    ) : platform.portal.toLowerCase() === "codechef" ? (
                                                        <CodeChefBadge
                                                            tier={platform.tier}
                                                            rating={platform.currentRating}
                                                            size="sm"
                                                        />
                                                    ) : platform.portal.toLowerCase() === "atcoder" ? (
                                                        <AtCoderBadge
                                                            tier={platform.tier}
                                                            rating={platform.currentRating}
                                                            size="sm"
                                                        />
                                                    ) : (
                                                        <span
                                                            className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider border border-black ${
                                                                isSelected ? "bg-white text-black" : "bg-black text-white"
                                                            }`}
                                                        >
                                                            {platform.tier}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        {/* Bottom: Tier Progress or Platform Rank Milestone */}
                                        <div className={`pt-4 space-y-1.5 border-t-2 mt-3 ${
                                            isSelected ? "border-white/20" : "border-black/15"
                                        }`}>
                                            {platform.tierInfo?.nextTierName && typeof platform.tierInfo.pointsToNextTier === "number" ? (
                                                <>
                                                    {/* Progress Bar */}
                                                    <div className={`w-full h-2 rounded-full overflow-hidden border border-black ${
                                                        isSelected ? "bg-white/20" : "bg-[#FAF6EE]"
                                                    }`}>
                                                        <div
                                                            style={{
                                                                width: `${platform.tierInfo.progressPercent || 0}%`,
                                                            }}
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                isSelected ? "bg-[#a2ff86]" : "bg-black"
                                                            }`}
                                                        />
                                                    </div>
                                                    <div className={`text-xs sm:text-sm flex items-center gap-1 font-bold ${
                                                        isSelected ? "text-neutral-300" : "text-neutral-700"
                                                    }`}>
                                                        <span>{platform.tierInfo.pointsToNextTier} to</span>
                                                        <strong className={`font-black ${isSelected ? "text-white" : "text-black"}`}>
                                                            {platform.tierInfo.nextTierName}
                                                        </strong>
                                                    </div>
                                                </>
                                            ) : platform.officialRank ? (
                                                <div className={`text-xs sm:text-sm flex items-center gap-1.5 font-bold ${
                                                    isSelected ? "text-neutral-300" : "text-neutral-700"
                                                }`}>
                                                    <span>Rank #{formatNumber(platform.officialRank)}</span>
                                                    {platform.peakRating && (
                                                        <>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-neutral-500" : "bg-neutral-400"}`} />
                                                            <span>max {platform.peakRating}</span>
                                                        </>
                                                    )}
                                                </div>
                                            ) : hasContests ? (
                                                <div className={`text-xs sm:text-sm font-bold ${isSelected ? "text-neutral-300" : "text-neutral-700"}`}>
                                                    {platform.ratedContestsCount} contests attended
                                                </div>
                                            ) : platform.connected ? (
                                                <div className={`text-xs sm:text-sm italic font-medium ${isSelected ? "text-neutral-400" : "text-neutral-500"}`}>
                                                    Attend a contest to get started
                                                </div>
                                            ) : (
                                                <div className={`text-xs sm:text-sm font-black underline underline-offset-2 ${
                                                    isSelected ? "text-white" : "text-black"
                                                }`}>
                                                    Connect platform
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* 4th slot: Multi-Platform Standing Summary to fill gap if odd number of platforms */}
                            {platformsList.length % 2 === 1 && (
                                <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl border-2 border-black bg-[#FAF6EE] text-neutral-900 shadow-[4px_4px_0px_#000]">
                                    <div className="space-y-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-white border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center">
                                                <Trophy className="w-4 h-4 text-black" />
                                            </div>
                                            <span className="font-black text-sm text-black">
                                                Contest Summary
                                            </span>
                                        </div>
                                        <div className="pt-1">
                                            <span className="text-2xl sm:text-3xl font-black text-black tracking-tight font-sans">
                                                {totalRatedContests} Contests
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-700 font-bold leading-relaxed">
                                            Multi-platform rating across {platformsList.length} connected competitive programming portals.
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t-2 border-black/15 flex items-center justify-between text-xs text-neutral-700 font-black mt-3">
                                        <span>Overall Standing</span>
                                        <span className="px-2 py-0.5 rounded bg-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] text-black">Active Competitor</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full p-8 rounded-2xl bg-black/[0.02] border border-dashed border-black/10 flex flex-col items-center justify-center text-center space-y-3">
                            <Award className="w-8 h-8 text-neutral-400" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold text-neutral-900">No platform ranks to display</h4>
                                <p className="text-xs text-neutral-500">Connect your contest accounts in your profile to see your official standings here.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Recent Contests */}
                <div className="w-full">
                    <RecentContestsCard
                        connectedPortals={connectedPortals}
                        username={effectiveUser}
                        embedded={true}
                    />
                </div>
            </div>

            {/* ========================================================================= */}
            {/* TIER EXPLANATION MODAL ("What does Candidate Master mean?")                */}
            {/* ========================================================================= */}
            {isTierModalOpen && activePlatform && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tier-modal-title"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
                >
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-black/10 shadow-2xl p-6 sm:p-7 space-y-5 text-neutral-900 relative">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setIsTierModalOpen(false)}
                            className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-black/[0.05] transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-black/[0.04] border border-black/10 flex items-center justify-center text-neutral-800">
                                {getPortalIcon(activePlatform.portal, "w-5 h-5")}
                            </div>
                            <div>
                                <h3 id="tier-modal-title" className="text-lg font-black text-neutral-900">
                                    {activePlatform.portalName} Rating System
                                </h3>
                                <p className="text-xs text-neutral-500">
                                    Official competitive rank ladder
                                </p>
                            </div>
                        </div>

                        {/* Current Tier Highlight */}
                        <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/[0.06] space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-500 font-medium">Current Standing</span>
                                {activePlatform.portal.toLowerCase() === "codeforces" ? (
                                    <CodeforcesBadge
                                        tier={activePlatform.tier}
                                        rating={activePlatform.currentRating}
                                        size="sm"
                                    />
                                ) : activePlatform.portal.toLowerCase() === "leetcode" ? (
                                    <LeetCodeBadge
                                        tier={activePlatform.tier}
                                        rating={activePlatform.currentRating}
                                        size="sm"
                                    />
                                ) : activePlatform.portal.toLowerCase() === "codechef" ? (
                                    <CodeChefBadge
                                        tier={activePlatform.tier}
                                        rating={activePlatform.currentRating}
                                        size="sm"
                                    />
                                ) : activePlatform.portal.toLowerCase() === "atcoder" ? (
                                    <AtCoderBadge
                                        tier={activePlatform.tier}
                                        rating={activePlatform.currentRating}
                                        size="sm"
                                    />
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded text-xs font-black text-white bg-black uppercase tracking-wider">
                                        {activePlatform.tier}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                {activePlatform.tierInfo?.description ||
                                    `${activePlatform.tier} is an official competitive rating tier on ${activePlatform.portalName}.`}
                            </p>
                        </div>

                        {/* If Codeforces: render all 10 rating badges */}
                        {activePlatform.portal.toLowerCase() === "codeforces" && (
                            <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-3">
                                <div className="text-xs font-bold text-neutral-900">
                                    Codeforces Rating Badges
                                </div>
                                <CodeforcesRatingLadder
                                    currentRating={activePlatform.currentRating}
                                    currentTier={activePlatform.tier}
                                />
                            </div>
                        )}

                        {/* If LeetCode: render all 3 rating badges */}
                        {activePlatform.portal.toLowerCase() === "leetcode" && (
                            <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-3">
                                <div className="text-xs font-bold text-neutral-900">
                                    LeetCode Ranks & Ratings
                                </div>
                                <LeetCodeRatingLadder
                                    currentRating={activePlatform.currentRating}
                                    currentTier={activePlatform.tier}
                                />
                            </div>
                        )}

                        {/* If CodeChef: render all 7 rating badges with division breakdown */}
                        {activePlatform.portal.toLowerCase() === "codechef" && (
                            <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-3">
                                <div className="text-xs font-bold text-neutral-900">
                                    CodeChef Ranks & Ratings
                                </div>
                                <CodeChefRatingLadder
                                    currentRating={activePlatform.currentRating}
                                    currentTier={activePlatform.tier}
                                />
                            </div>
                        )}

                        {/* If AtCoder: render all 8 rating badges */}
                        {activePlatform.portal.toLowerCase() === "atcoder" && (
                            <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-3">
                                <div className="text-xs font-bold text-neutral-900">
                                    AtCoder Ranks & Ratings
                                </div>
                                <AtCoderRatingLadder
                                    currentRating={activePlatform.currentRating}
                                    currentTier={activePlatform.tier}
                                />
                            </div>
                        )}

                        {/* Progress to next tier */}
                        {activePlatform.tierInfo?.nextTierName && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-neutral-500">
                                    <span>Progress to {activePlatform.tierInfo.nextTierName}</span>
                                    <strong className="text-neutral-900 font-bold">
                                        {activePlatform.tierInfo.pointsToNextTier} points needed
                                    </strong>
                                </div>
                                <div className="w-full h-2 rounded-full bg-black/[0.06] overflow-hidden">
                                    <div
                                        style={{
                                            width: `${activePlatform.tierInfo.progressPercent || 0}%`,
                                        }}
                                        className="h-full rounded-full bg-black transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsTierModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
