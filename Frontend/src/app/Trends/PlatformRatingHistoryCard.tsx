import React, { useState, useMemo } from "react";
import { ExternalLink, Award } from "lucide-react";
import type { PlatformContestAnalytics, ContestHistoryPoint } from "../../store/contestsSlice";
import { getPortalIcon } from "../../utils/portalIcons";

interface PlatformRatingHistoryCardProps {
    platform: PlatformContestAnalytics;
}

export const PlatformRatingHistoryCard: React.FC<PlatformRatingHistoryCardProps> = ({
    platform,
}) => {
    const history = platform.history || [];
    const hasHistory = history.length > 0;

    // Hovered contest point state. If null, we default to the latest contest in history
    const [hoveredPoint, setHoveredPoint] = useState<ContestHistoryPoint | null>(null);

    // Default displayed point is the latest contest
    const activePoint = useMemo(() => {
        if (hoveredPoint) return hoveredPoint;
        if (hasHistory) return history[history.length - 1] || null;
        return null;
    }, [hoveredPoint, hasHistory, history]);

    // Format date string as e.g. "27 Sept 2023" matching screenshot
    const formatDate = (dateStrOrTs: string | number): string => {
        try {
            const d = new Date(dateStrOrTs);
            if (isNaN(d.getTime())) return String(dateStrOrTs);
            const day = d.getDate();
            const month = d.toLocaleDateString("en-US", { month: "short" });
            const year = d.getFullYear();
            return `${day} ${month} ${year}`;
        } catch {
            return String(dateStrOrTs);
        }
    };

    // Format month for X-axis ticks (e.g. "Dec", "Jan", "Mar", "May", "Sept")
    const formatMonthTick = (ts: number): string => {
        try {
            const d = new Date(ts);
            return d.toLocaleDateString("en-US", { month: "short" });
        } catch {
            return "";
        }
    };

    // Unique gradient ID per platform to prevent SVG def collisions
    const gradientId = `ratingAreaGrad_${platform.portal.replace(/[^a-zA-Z0-9]/g, "_")}`;

    // SVG plotting dimensions and calculations
    const chartData = useMemo(() => {
        if (!hasHistory) return null;

        const svgWidth = 540;
        const svgHeight = 175;
        const padLeft = 20;
        const padRight = 20;
        const padTop = 15;
        const padBottom = 30;
        const plotWidth = svgWidth - padLeft - padRight;
        const plotHeight = svgHeight - padTop - padBottom;

        const ratings = history.map((h) => h.rating).filter((r) => typeof r === "number" && !isNaN(r));
        if (ratings.length === 0) return null;

        const minRating = Math.min(...ratings);
        const maxRating = Math.max(...ratings);
        const ratingDiff = maxRating - minRating;

        // Give vertical headroom for smooth curve peaks
        const yMin = Math.max(0, Math.floor(minRating - Math.max(20, ratingDiff * 0.18)));
        const yMax = Math.ceil(maxRating + Math.max(20, ratingDiff * 0.18));
        const yRange = Math.max(1, yMax - yMin);

        const timestamps = history.map((h) => h.timestamp);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const tsRange = Math.max(1, maxTs - minTs);

        // Map every contest to (x, y) coordinates
        const points = history.map((pt, idx) => {
            const xRatio = tsRange === 0 || history.length === 1 ? 0.5 : (pt.timestamp - minTs) / tsRange;
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

        // Generate smooth Bezier path
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

        // Generate 3 horizontal dashed guidelines
        const gridRatios = [0.15, 0.55, 0.95];
        const gridLines = gridRatios.map((ratio) => {
            const y = svgHeight - padBottom - ratio * plotHeight;
            return { y };
        });

        // Generate 4-5 evenly distributed month ticks along X-axis
        const dateTicks: Array<{ label: string; x: number }> = [];
        if (points.length > 0) {
            const targetCount = Math.min(5, points.length);
            const step = (points.length - 1) / Math.max(1, targetCount - 1);
            const pickedIndices = new Set<number>();
            for (let i = 0; i < targetCount; i++) {
                pickedIndices.add(Math.round(i * step));
            }
            const sortedIndices = Array.from(pickedIndices).sort((a, b) => a - b);
            for (const idx of sortedIndices) {
                const pt = points[idx];
                if (pt) {
                    dateTicks.push({
                        label: formatMonthTick(pt.point.timestamp),
                        x: pt.x,
                    });
                }
            }
        }

        return {
            svgWidth,
            svgHeight,
            padLeft,
            padRight,
            padTop,
            padBottom,
            points,
            pathD,
            areaD,
            gridLines,
            dateTicks,
        };
    }, [history, hasHistory]);

    // Crosshair mouse tracking
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!chartData || chartData.points.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const mouseX = ((e.clientX - rect.left) / rect.width) * chartData.svgWidth;

        // Find closest contest point by X distance
        let closest = chartData.points[0];
        let minDist = Infinity;
        for (const pt of chartData.points) {
            const dist = Math.abs(pt.x - mouseX);
            if (dist < minDist) {
                minDist = dist;
                closest = pt;
            }
        }
        if (closest) {
            setHoveredPoint(closest.point);
        }
    };

    const handleMouseLeave = () => {
        setHoveredPoint(null);
    };

    const currentRating = platform.currentRating;
    const peakRating = platform.peakRating;
    const change90d = platform.recentChange90d;
    const changeFormatted =
        typeof change90d === "number" && change90d !== 0
            ? change90d > 0
                ? `+${change90d}`
                : `${change90d}`
            : change90d === 0
                ? "0"
                : "—";

    return (
        <div className="w-full rounded-2xl bg-white border-2 border-black p-5 sm:p-6 text-black font-sans select-none flex flex-col justify-between shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all relative overflow-hidden group">
            {/* Top Card Header */}
            <div>
                <div className="flex items-center justify-between gap-3 pb-3">
                    {/* Platform Logo + Name */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center flex-shrink-0 text-black">
                            {getPortalIcon(platform.portal, "w-5 h-5")}
                        </div>
                        <div className="min-w-0 flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-black tracking-tight truncate">
                                {platform.portalName}
                            </h3>
                            {platform.profileUrl && (
                                <a
                                    href={platform.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded-md border border-black bg-white hover:bg-[#FFE566] text-black shadow-[1px_1px_0px_#000] transition-colors"
                                    title={`View ${platform.portalUsername} on ${platform.portalName}`}
                                >
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Total Contests Count (e.g. "2 contests") */}
                    <div className="flex-shrink-0 bg-[#FAF6EE] border-2 border-black px-3 py-1 rounded-lg shadow-[2px_2px_0px_#000]">
                        <span className="text-xs font-black text-black">
                            {platform.ratedContestsCount} {platform.ratedContestsCount === 1 ? "contest" : "contests"}
                        </span>
                    </div>
                </div>

                {/* Subheader: Now | Best | Last 90 days */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold text-neutral-600 pb-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        Now <strong className="text-black font-black font-mono ml-0.5">{currentRating !== null && currentRating !== undefined ? currentRating : "—"}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        Best <strong className="text-black font-black font-mono ml-0.5">{peakRating !== null && peakRating !== undefined ? peakRating : "—"}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FAF6EE] border border-black shadow-[1px_1px_0px_#000]">
                        Last 90 days
                        <span
                            className={`px-1.5 py-0.2 rounded border border-black text-[11px] font-black font-mono ${
                                typeof change90d === "number" && change90d > 0
                                    ? "bg-[#a2ff86] text-black"
                                    : typeof change90d === "number" && change90d < 0
                                    ? "bg-[#ff9494] text-black"
                                    : "bg-white text-neutral-800"
                            }`}
                        >
                            {changeFormatted}
                        </span>
                    </span>
                </div>

                {/* Active / Hover Contest Row */}
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b-2 border-black/10 min-h-[40px]">
                    {/* Left: Rating value */}
                    <div className="flex items-baseline gap-2 flex-shrink-0">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-500">Rating</span>
                        <span className="text-2xl sm:text-3xl font-black text-black tracking-tight font-mono">
                            {activePoint ? activePoint.rating : currentRating ?? "—"}
                        </span>
                    </div>

                    {/* Right: Date and Contest Name */}
                    {activePoint ? (
                        <div className="flex items-center gap-2 text-right min-w-0 truncate">
                            <span className="text-xs font-mono font-black text-neutral-600 flex-shrink-0">
                                {formatDate(activePoint.date || activePoint.timestamp)}
                            </span>
                            <span
                                className="text-xs sm:text-sm font-black text-black truncate max-w-[160px] sm:max-w-xs px-2.5 py-0.5 rounded-md bg-[#FFE566] border border-black shadow-[1px_1px_0px_#000]"
                                title={activePoint.contestName}
                            >
                                {activePoint.contestName}
                            </span>
                        </div>
                    ) : (
                        <div className="text-xs text-neutral-500 font-bold">
                            No contest data
                        </div>
                    )}
                </div>
            </div>

            {/* Sparkline / Area Curve Chart */}
            <div className="w-full pt-4 relative">
                {chartData && hasHistory ? (
                    <div className="w-full relative">
                        <svg
                            viewBox={`0 0 ${chartData.svgWidth} ${chartData.svgHeight}`}
                            className="w-full h-auto overflow-visible select-none cursor-crosshair"
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                        >
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#FFE566" stopOpacity="0.45" />
                                    <stop offset="85%" stopColor="#FAF6EE" stopOpacity="0.1" />
                                    <stop offset="100%" stopColor="#FAF6EE" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Background Horizontal Dashed Gridlines */}
                            {chartData.gridLines.map((grid, idx) => (
                                <line
                                    key={idx}
                                    x1={chartData.padLeft}
                                    y1={grid.y}
                                    x2={chartData.svgWidth - chartData.padRight}
                                    y2={grid.y}
                                    stroke="rgba(0,0,0,0.12)"
                                    strokeDasharray="4 4"
                                    strokeWidth="1.5"
                                />
                            ))}

                            {/* Area Fill beneath curve */}
                            {chartData.areaD && (
                                <path d={chartData.areaD} fill={`url(#${gradientId})`} />
                            )}

                            {/* Primary Rating Progression Line */}
                            {chartData.pathD && (
                                <path
                                    d={chartData.pathD}
                                    fill="none"
                                    stroke="#000000"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            )}

                            {/* Month Ticks along X-axis */}
                            {chartData.dateTicks.map((tick, idx) => (
                                <text
                                    key={idx}
                                    x={tick.x}
                                    y={chartData.svgHeight - 6}
                                    textAnchor="middle"
                                    fill="#000000"
                                    fontSize="10"
                                    fontFamily="monospace"
                                    fontWeight="800"
                                >
                                    {tick.label}
                                </text>
                            ))}

                            {/* Hover Crosshair & Indicator */}
                            {chartData.points.map((pt) => {
                                const isCurrent = activePoint?.contestId === pt.point.contestId;
                                if (!isCurrent) return null;
                                return (
                                    <g key={pt.index}>
                                        {/* Vertical Guideline */}
                                        <line
                                            x1={pt.x}
                                            y1={chartData.padTop}
                                            x2={pt.x}
                                            y2={chartData.svgHeight - chartData.padBottom}
                                            stroke="#000000"
                                            strokeDasharray="3 3"
                                            strokeWidth="1.5"
                                        />
                                        {/* Outer pulse aura */}
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r="8"
                                            fill="#FFE566"
                                            stroke="#000000"
                                            strokeWidth="2"
                                        />
                                        {/* Dot */}
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r="4.5"
                                            fill="#000000"
                                        />
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                ) : (
                    /* Clean empty state for connected platform with 0 contests */
                    <div className="w-full h-40 flex flex-col items-center justify-center text-center p-4 rounded-xl bg-[#FAF6EE] border-2 border-black border-dashed shadow-[2px_2px_0px_#000]">
                        <div className="w-10 h-10 rounded-lg bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center mb-2">
                            <Award className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <p className="text-xs font-black text-black">
                            No rated contests recorded yet on {platform.portalName}
                        </p>
                        <p className="text-[11px] font-bold text-neutral-600 mt-1 max-w-xs">
                            Compete in a rated contest to begin plotting your dynamic rating progression.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
