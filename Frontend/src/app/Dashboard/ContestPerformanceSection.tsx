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
    username = "vineet_chandel",
}) => {
    const effectiveUser = (username || "vineet_chandel").trim();
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

    // Initial fetch passing connected portals from props
    useEffect(() => {
        dispatch(fetchContestPerformance({ username: effectiveUser, portals: connectedPortals }));
    }, [effectiveUser, dispatch, connectedPortals]);

    // Discover eligible platforms dynamically
    const platformsList: PlatformContestAnalytics[] = useMemo(() => {
        const eligibleKeys = Object.keys(CONTEST_ELIGIBLE_REGISTRY);

        if (contestData?.platforms && contestData.platforms.length > 0) {
            // Start with backend-returned platforms (filtered strictly to eligible contest platforms)
            const map = new Map<string, PlatformContestAnalytics>();
            for (const p of contestData.platforms) {
                if (CONTEST_ELIGIBLE_REGISTRY[p.portal]) {
                    map.set(p.portal, { ...p });
                }
            }

            // Sync any client-side connected portals if not marked connected yet
            if (connectedPortals && typeof connectedPortals === "object") {
                for (const [k, v] of Object.entries(connectedPortals)) {
                    if (CONTEST_ELIGIBLE_REGISTRY[k]) {
                        const pUser = typeof v === "object" ? v?.username || v?.portalUsername || "" : String(v || "");
                        const existing = map.get(k);
                        if (!existing) {
                            map.set(k, {
                                portal: k,
                                portalName: CONTEST_ELIGIBLE_REGISTRY[k]!.name,
                                portalUsername: pUser,
                                profileUrl: "",
                                connected: Boolean(pUser),
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
                                status: pUser ? "syncing" : "not_connected",
                                exploreContestsUrl: CONTEST_ELIGIBLE_REGISTRY[k]!.exploreUrl,
                            });
                        } else if (pUser && !existing.connected) {
                            existing.connected = true;
                            existing.portalUsername = pUser;
                            if (existing.status === "not_connected") {
                                existing.status = "syncing";
                            }
                        }
                    }
                }
            }

            // Ensure every eligible contest platform is present in the list
            for (const k of eligibleKeys) {
                if (!map.has(k)) {
                    const cfg = CONTEST_ELIGIBLE_REGISTRY[k]!;
                    const isConn = Boolean(connectedPortals && connectedPortals[k]);
                    const pUsername = connectedPortals?.[k]?.username || (typeof connectedPortals?.[k] === "string" ? connectedPortals[k] : "");
                    map.set(k, {
                        portal: k,
                        portalName: cfg.name,
                        portalUsername: pUsername,
                        profileUrl: "",
                        connected: isConn,
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
                        status: isConn ? "syncing" : "not_connected",
                        exploreContestsUrl: cfg.exploreUrl,
                    });
                }
            }

            const list = Array.from(map.values());
            // Sort: connected with contests first, then connected without contests, then unconnected
            list.sort((a, b) => {
                if (a.connected && !b.connected) return -1;
                if (!a.connected && b.connected) return 1;
                if (a.ratedContestsCount !== b.ratedContestsCount) {
                    return b.ratedContestsCount - a.ratedContestsCount;
                }
                return a.portalName.localeCompare(b.portalName);
            });

            return list;
        }

        // Fallback local discovery from CONTEST_ELIGIBLE_REGISTRY and connectedPortals props if remote not loaded yet
        const fallbackList = eligibleKeys.map((p) => {
            const cfg = CONTEST_ELIGIBLE_REGISTRY[p]!;
            const isConn = Boolean(connectedPortals && connectedPortals[p]);
            const pUsername = connectedPortals?.[p]?.username || (typeof connectedPortals?.[p] === "string" ? connectedPortals[p] : "");
            return {
                portal: p,
                portalName: cfg.name,
                portalUsername: pUsername,
                profileUrl: "",
                connected: isConn,
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
                status: isConn ? "syncing" : "not_connected",
                exploreContestsUrl: cfg.exploreUrl,
            } as PlatformContestAnalytics;
        });

        fallbackList.sort((a, b) => {
            if (a.connected && !b.connected) return -1;
            if (!a.connected && b.connected) return 1;
            return a.portalName.localeCompare(b.portalName);
        });

        return fallbackList;
    }, [contestData, connectedPortals]);

    // Default select the first connected platform that has contests or is connected
    useEffect(() => {
        if (platformsList.length > 0) {
            const currentSelected = platformsList.find((p) => p.portal === selectedPortal);
            // If the user hasn't explicitly picked a platform, or the current selected is not connected,
            // automatically select the first connected platform (with contests preferred)
            if (!hasUserSelected || !currentSelected?.connected) {
                const firstConnectedWithContests = platformsList.find((p) => p.connected && p.ratedContestsCount > 0);
                const firstConnected = platformsList.find((p) => p.connected);
                const target = firstConnectedWithContests || firstConnected || platformsList[0];
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
        dispatch(fetchContestPerformance({ username: effectiveUser, force: true, portals: connectedPortals }));
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
        <section className="w-full space-y-6 select-none font-sans" aria-label="Contest Performance Module">
            {/* ========================================================================= */}
            {/* SECTION 1 — Contest Performance (Primary Line Chart, Summary & Controls) */}
            {/* ========================================================================= */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Primary Column: Rating & Progression Graph (8 of 12 cols on desktop) */}
                <div className="lg:col-span-8 flex flex-col rounded-3xl bg-[#0c1017] border border-neutral-800/80 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
                    {/* Subtle ambient lighting */}
                    <div className="absolute -top-24 -left-24 w-80 h-80 bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />

                    {/* Section Header & Platform Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-800/80 relative z-10">
                        {/* Title & Icon */}
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
                                <ChartIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                                    <span>Contest rating</span>
                                    {isLoading && (
                                        <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                    )}
                                </h3>
                                <p className="text-[11px] text-neutral-400">
                                    Rating progression over time
                                </p>
                            </div>
                        </div>

                        {/* Platform Selector Tabs */}
                        <div
                            role="tablist"
                            aria-label="Eligible Contest Platforms"
                            className="flex items-center gap-1.5 p-1 rounded-xl bg-[#121824] border border-neutral-800 overflow-x-auto no-scrollbar self-start sm:self-auto max-w-full"
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
                                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-amber-400/50 ${
                                            isActive
                                                ? "bg-[#1c2436] text-white border border-neutral-700 shadow-sm"
                                                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]"
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
                    </div>

                    {/* Rating Summary (Primary & Supporting Metrics) */}
                    <div className="pt-5 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-5 relative z-10">
                        {/* Rating, Tier badge, Peak & Contests */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                                Rating
                            </span>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Current Rating */}
                                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                                    {activePlatform?.currentRating !== null && activePlatform?.currentRating !== undefined
                                        ? activePlatform.currentRating
                                        : "—"}
                                </span>

                                {/* Tier Badge */}
                                {activePlatform?.tier && (
                                    <span
                                        style={{
                                            backgroundColor: activePlatform.tierColor || "#ea3943",
                                        }}
                                        className="px-2.5 py-1 rounded-md text-xs font-black text-white uppercase tracking-wider shadow-sm"
                                    >
                                        {activePlatform.tier}
                                    </span>
                                )}

                                {/* Secondary Metrics: Max & Contests */}
                                <div className="flex items-center gap-4 text-xs font-medium text-neutral-400 pl-1">
                                    {activePlatform?.peakRating !== null && activePlatform?.peakRating !== undefined && (
                                        <div>
                                            <span>Max</span>{" "}
                                            <strong className="text-white font-bold">{activePlatform.peakRating}</strong>
                                        </div>
                                    )}
                                    <div>
                                        <span>Contests</span>{" "}
                                        <strong className="text-white font-bold">{activePlatform?.ratedContestsCount || 0}</strong>
                                    </div>

                                    {/* 90-Day Rating Change */}
                                    {typeof activePlatform?.recentChange90d === "number" && activePlatform.recentChange90d !== 0 && (
                                        <div
                                            className={`inline-flex items-center gap-1 font-bold ${
                                                activePlatform.recentChange90d > 0 ? "text-emerald-400" : "text-rose-400"
                                            }`}
                                        >
                                            {activePlatform.recentChange90d > 0 ? (
                                                <TrendingUp className="w-3.5 h-3.5" />
                                            ) : (
                                                <TrendingDown className="w-3.5 h-3.5" />
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
                                    className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors inline-flex items-center gap-1 cursor-pointer pt-1"
                                >
                                    <span>What does {activePlatform.tier} mean?</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Top-Right Info Highlight on Hover / Latest Contest */}
                        {displayedPoint && (
                            <div className="flex flex-col items-start md:items-end text-left md:text-right space-y-1 bg-[#121824]/60 md:bg-transparent p-3 md:p-0 rounded-xl border md:border-none border-neutral-800">
                                <div className="flex items-center gap-2 md:justify-end">
                                    <span className="text-[11px] text-neutral-400">Rating</span>
                                    <span className="text-xl sm:text-2xl font-black text-amber-400">
                                        {displayedPoint.rating}
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-white max-w-xs truncate">
                                    {displayedPoint.contestName}
                                </div>
                                <div className="text-[11px] text-neutral-400 flex items-center gap-2 md:justify-end">
                                    <span>{formatDateStr(displayedPoint.date || displayedPoint.timestamp)}</span>
                                    {displayedPoint.rank && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-neutral-600" />
                                            <span>Rank {formatNumber(displayedPoint.rank)}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Time Range Filters & Chart Area */}
                    <div className="w-full flex items-center justify-end pb-2 pt-1 relative z-10">
                        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#121824] border border-neutral-800 text-[11px] font-bold">
                            {(["6M", "1Y", "ALL"] as TimeRangeFilter[]).map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setTimeRange(r)}
                                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                                        timeRange === r
                                            ? "bg-amber-500/20 text-amber-300 font-extrabold shadow-xs"
                                            : "text-neutral-400 hover:text-neutral-200"
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
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-[#090d13]/60 border border-dashed border-neutral-800">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-extrabold text-white">
                                        {activePlatform?.status === "history_unavailable"
                                            ? "Rating history unavailable"
                                            : "No contest history yet"}
                                    </h4>
                                    <p className="text-xs text-neutral-400 leading-relaxed">
                                        {activePlatform?.statusMessage ||
                                            `Participate in a rated contest on ${activePlatform?.portalName} to start tracking your rating progression.`}
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <a
                                        href={activePlatform?.exploreContestsUrl || `https://${activePlatform?.portal}.com`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                                    >
                                        <span>Explore contests</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* CASE C: Syncing state */}
                        {activePlatform?.status === "syncing" && filteredHistory.length === 0 && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-[#090d13]/60 border border-neutral-800">
                                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                                <div className="space-y-1">
                                    <h4 className="text-sm font-extrabold text-white">Preparing contest data</h4>
                                    <p className="text-xs text-neutral-400">
                                        Synchronizing latest contest standings from {activePlatform?.portalName}...
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* CASE D: Sync error */}
                        {activePlatform?.status === "error" && filteredHistory.length === 0 && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-[#090d13]/60 border border-neutral-800">
                                <AlertCircle className="w-8 h-8 text-rose-400" />
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-extrabold text-white">Unable to refresh contest data</h4>
                                    <p className="text-xs text-neutral-400">
                                        {activePlatform?.statusMessage || "Could not retrieve contest history at this moment."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all cursor-pointer"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Retry</span>
                                </button>
                            </div>
                        )}

                        {/* CASE E: Not Connected */}
                        {activePlatform?.connected === false && (
                            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 space-y-3 rounded-2xl bg-[#090d13]/60 border border-dashed border-neutral-800">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-neutral-400">
                                    {getPortalIcon(activePlatform.portal, "w-6 h-6")}
                                </div>
                                <div className="space-y-1 max-w-sm">
                                    <h4 className="text-sm font-extrabold text-white">
                                        Connect {activePlatform.portalName}
                                    </h4>
                                    <p className="text-xs text-neutral-400">
                                        Connect your {activePlatform.portalName} handle in your profile to track your contest rating progression and official rank.
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <Link
                                        to="/profile"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold transition-all cursor-pointer shadow-md shadow-amber-500/20"
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
                                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
                                            <stop offset="85%" stopColor="#f59e0b" stopOpacity="0.01" />
                                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                                        </linearGradient>
                                        <filter id="glowPoint" x="-50%" y="-50%" width="200%" height="200%">
                                            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.8" />
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
                                                stroke="#263044"
                                                strokeDasharray="4 4"
                                                strokeWidth="1"
                                                opacity="0.6"
                                            />
                                            <text
                                                x={chartData.padLeft - 8}
                                                y={grid.y + 3.5}
                                                textAnchor="end"
                                                fill="#64748b"
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
                                            stroke="#f59e0b"
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
                                            fill="#64748b"
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
                                                    stroke="#f59e0b"
                                                    strokeOpacity="0.4"
                                                    strokeWidth="1.5"
                                                    strokeDasharray="3 3"
                                                />

                                                {/* Outer Halo */}
                                                <circle
                                                    cx={pt.x}
                                                    cy={pt.y}
                                                    r="8"
                                                    fill="#f59e0b"
                                                    fillOpacity="0.25"
                                                />

                                                {/* Inner Dot with Glow */}
                                                <circle
                                                    cx={pt.x}
                                                    cy={pt.y}
                                                    r="4.5"
                                                    fill="#f59e0b"
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
                                                        fill="#f59e0b"
                                                        fillOpacity="0.25"
                                                    />
                                                    <circle
                                                        cx={lastPt.x}
                                                        cy={lastPt.y}
                                                        r="3.5"
                                                        fill="#f59e0b"
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

                {/* Secondary Column: Contests Total Summary Card (4 of 12 cols on desktop) */}
                <div className="lg:col-span-4 flex flex-col justify-between rounded-3xl bg-[#0c1017] border border-neutral-800/80 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
                    <div className="space-y-6">
                        {/* Card Header: Trophy icon + Contests */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                                <Trophy className="w-4 h-4" />
                            </div>
                            <h3 className="text-base font-extrabold text-white tracking-tight">
                                Contests
                            </h3>
                        </div>

                        {/* Big Count: Total Rated Contests */}
                        <div className="space-y-1">
                            <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                                {totalRatedContests}
                            </div>
                            <p className="text-xs text-neutral-400 font-medium">
                                rated contests in total
                            </p>
                        </div>

                        {/* Platform Breakdown with Proportional Progress Bars */}
                        <div className="space-y-3.5 pt-2">
                            {contestBreakdown.map((item) => (
                                <button
                                    key={item.portal}
                                    type="button"
                                    onClick={() => setSelectedPortal(item.portal)}
                                    className="w-full flex flex-col gap-1.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group text-left"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 font-bold text-neutral-300 group-hover:text-white transition-colors">
                                            <span className="w-4 h-4 flex items-center justify-center">
                                                {getPortalIcon(item.portal, "w-4 h-4")}
                                            </span>
                                            <span>{item.portalName}</span>
                                        </div>
                                        <span className="font-extrabold text-white">
                                            {item.count}
                                        </span>
                                    </div>

                                    {/* Horizontal Bar */}
                                    <div className="w-full h-2 rounded-full bg-[#1c2436] overflow-hidden">
                                        <div
                                            style={{ width: `${item.percentage}%` }}
                                            className="h-full bg-amber-400 rounded-full transition-all duration-500 group-hover:bg-amber-300"
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer synchronization note */}
                    <div className="pt-4 mt-6 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
                        <span>Dynamic Multi-Platform Sync</span>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            className="text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
                            title="Refresh contest performance"
                        >
                            <RefreshCw className="w-3 h-3" />
                            <span>Sync</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 2 — Contest Platforms Overview (Platform Ranks Grid)              */}
            {/* ========================================================================= */}
            <div className="w-full rounded-3xl bg-[#0c1017] border border-neutral-800/80 p-5 sm:p-7 shadow-2xl relative overflow-hidden">
                {/* Header: Trophy/Award icon + Platform ranks */}
                <div className="flex items-center gap-3 pb-5">
                    <div className="w-8 h-8 rounded-xl bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center text-amber-400">
                        <Award className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                            Platform ranks
                        </h3>
                        <p className="text-[11px] text-neutral-400">
                            Current contest standings and rank progress across eligible platforms
                        </p>
                    </div>
                </div>

                {/* Responsive Multi-Platform Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                                className={`flex flex-col justify-between p-5 rounded-2xl transition-all cursor-pointer text-left relative overflow-hidden border ${
                                    isSelected
                                        ? "bg-[#141b28] border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30"
                                        : "bg-[#0f141f] border-neutral-800/90 hover:border-neutral-700 hover:bg-[#121825]"
                                }`}
                            >
                                {/* Top: Platform Icon + Name + Verified Badge */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center">
                                                {getPortalIcon(platform.portal, "w-4 h-4")}
                                            </div>
                                            <span className="font-extrabold text-sm text-white">
                                                {platform.portalName}
                                            </span>
                                        </div>

                                        {platform.connected && (
                                            <div
                                                className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center"
                                                title="Verified Connected Profile"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Middle: Rating & Tier Badge */}
                                    <div className="flex items-baseline gap-2 pt-1">
                                        <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                            {hasRating ? platform.currentRating : "—"}
                                        </span>

                                        {platform.tier && (
                                            <span
                                                style={{
                                                    backgroundColor: platform.tierColor || "#ea3943",
                                                }}
                                                className="px-2 py-0.5 rounded text-[11px] font-black text-white uppercase tracking-wider"
                                            >
                                                {platform.tier}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom: Tier Progress or Platform Rank Milestone */}
                                <div className="pt-4 space-y-1.5 border-t border-neutral-800/60 mt-3">
                                    {platform.tierInfo?.nextTierName && typeof platform.tierInfo.pointsToNextTier === "number" ? (
                                        <>
                                            {/* Progress Bar */}
                                            <div className="w-full h-1.5 rounded-full bg-[#1c2436] overflow-hidden">
                                                <div
                                                    style={{
                                                        width: `${platform.tierInfo.progressPercent || 0}%`,
                                                        backgroundColor: platform.tierColor || "#f59e0b",
                                                    }}
                                                    className="h-full rounded-full transition-all duration-500"
                                                />
                                            </div>
                                            <div className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium">
                                                <span>{platform.tierInfo.pointsToNextTier} to</span>
                                                <strong className="text-white font-bold">
                                                    {platform.tierInfo.nextTierName}
                                                </strong>
                                            </div>
                                        </>
                                    ) : platform.officialRank ? (
                                        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                                            <span>Rank #{formatNumber(platform.officialRank)}</span>
                                            {platform.peakRating && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-neutral-600" />
                                                    <span>max {platform.peakRating}</span>
                                                </>
                                            )}
                                        </div>
                                    ) : hasContests ? (
                                        <div className="text-[11px] text-neutral-400">
                                            {platform.ratedContestsCount} contests attended
                                        </div>
                                    ) : platform.connected ? (
                                        <div className="text-[11px] text-neutral-500 italic">
                                            Attend a contest to get started
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-amber-400/90 font-medium">
                                            Connect platform
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
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
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
                >
                    <div className="w-full max-w-md rounded-3xl bg-[#0c1017] border border-neutral-700 shadow-2xl p-6 sm:p-7 space-y-5 text-white relative">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setIsTierModalOpen(false)}
                            className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                                {getPortalIcon(activePlatform.portal, "w-5 h-5")}
                            </div>
                            <div>
                                <h3 id="tier-modal-title" className="text-lg font-black text-white">
                                    {activePlatform.portalName} Rating System
                                </h3>
                                <p className="text-xs text-neutral-400">
                                    Official competitive rank ladder
                                </p>
                            </div>
                        </div>

                        {/* Current Tier Highlight */}
                        <div className="p-4 rounded-2xl bg-[#141b28] border border-neutral-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-400">Current Standing</span>
                                <span
                                    style={{
                                        backgroundColor: activePlatform.tierColor || "#ea3943",
                                    }}
                                    className="px-2.5 py-0.5 rounded text-xs font-black text-white uppercase tracking-wider"
                                >
                                    {activePlatform.tier}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-300 leading-relaxed">
                                {activePlatform.tierInfo?.description ||
                                    `${activePlatform.tier} is an official competitive rating tier on ${activePlatform.portalName}.`}
                            </p>
                        </div>

                        {/* Progress to next tier */}
                        {activePlatform.tierInfo?.nextTierName && (
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-neutral-400">
                                    <span>Progress to {activePlatform.tierInfo.nextTierName}</span>
                                    <strong className="text-white font-bold">
                                        {activePlatform.tierInfo.pointsToNextTier} points needed
                                    </strong>
                                </div>
                                <div className="w-full h-2 rounded-full bg-[#1c2436] overflow-hidden">
                                    <div
                                        style={{
                                            width: `${activePlatform.tierInfo.progressPercent || 0}%`,
                                            backgroundColor: activePlatform.tierColor || "#f59e0b",
                                        }}
                                        className="h-full rounded-full transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsTierModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold transition-all cursor-pointer"
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
