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
        const svgHeight = 170;
        const padLeft = 20;
        const padRight = 20;
        const padTop = 15;
        const padBottom = 28;
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

        // Generate 3 subtle horizontal dashed guidelines
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
        <div className="w-full rounded-3xl bg-black border border-neutral-800 p-5 sm:p-6 text-white font-sans select-none flex flex-col justify-between transition-all hover:border-neutral-700 shadow-xl relative overflow-hidden group">
            {/* Top Card Header */}
            <div>
                <div className="flex items-center justify-between gap-3 pb-2.5">
                    {/* Platform Logo + Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0 text-white">
                            {getPortalIcon(platform.portal, "w-4 h-4")}
                        </div>
                        <div className="min-w-0 flex items-center gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                                {platform.portalName}
                            </h3>
                            {platform.profileUrl && (
                                <a
                                    href={platform.profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-neutral-500 hover:text-white transition-colors p-0.5 rounded"
                                    title={`View ${platform.portalUsername} on ${platform.portalName}`}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Total Contests Count (e.g. "11 contests") */}
                    <div className="flex-shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-neutral-400">
                            {platform.ratedContestsCount} {platform.ratedContestsCount === 1 ? "contest" : "contests"}
                        </span>
                    </div>
                </div>

                {/* Subheader: Now | Best | Last 90 days */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-400 font-medium pb-5 flex-wrap">
                    <span>
                        Now <strong className="text-white font-bold ml-1">{currentRating !== null && currentRating !== undefined ? currentRating : "—"}</strong>
                    </span>
                    <span className="text-neutral-700 font-mono">•</span>
                    <span>
                        Best <strong className="text-white font-bold ml-1">{peakRating !== null && peakRating !== undefined ? peakRating : "—"}</strong>
                    </span>
                    <span className="text-neutral-700 font-mono">•</span>
                    <span>
                        Last 90 days{" "}
                        <strong
                            className={`ml-1 font-bold ${
                                typeof change90d === "number" && change90d > 0
                                    ? "text-emerald-400"
                                    : typeof change90d === "number" && change90d < 0
                                    ? "text-rose-400"
                                    : "text-neutral-300"
                            }`}
                        >
                            {changeFormatted}
                        </strong>
                    </span>
                </div>

                {/* Active / Hover Contest Row */}
                <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-neutral-900 min-h-[36px]">
                    {/* Left: Rating value */}
                    <div className="flex items-baseline gap-2 flex-shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-neutral-400">Rating</span>
                        <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                            {activePoint ? activePoint.rating : currentRating ?? "—"}
                        </span>
                    </div>

                    {/* Right: Date and Contest Name */}
                    {activePoint ? (
                        <div className="flex items-center gap-2 text-right min-w-0 truncate">
                            <span className="text-xs sm:text-sm text-neutral-400 flex-shrink-0 font-medium">
                                {formatDate(activePoint.date || activePoint.timestamp)}
                            </span>
                            <span
                                className="text-xs sm:text-sm text-white font-medium truncate max-w-[160px] sm:max-w-xs"
                                title={activePoint.contestName}
                            >
                                {activePoint.contestName}
                            </span>
                        </div>
                    ) : (
                        <div className="text-xs text-neutral-500 font-medium">
                            No contest data
                        </div>
                    )}
                </div>
            </div>

            {/* Sparkline / Area Curve Chart */}
            <div className="w-full pt-3 relative">
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
                                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.22" />
                                    <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.02" />
                                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
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
                                    stroke="#262626"
                                    strokeDasharray="4 4"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Area Fill beneath curve */}
                            {chartData.areaD && (
                                <path d={chartData.areaD} fill={`url(#${gradientId})`} />
                            )}

                            {/* Golden Amber Line */}
                            {chartData.pathD && (
                                <path
                                    d={chartData.pathD}
                                    fill="none"
                                    stroke="#F59E0B"
                                    strokeWidth="2.5"
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
                                    fill="#737373"
                                    fontSize="10"
                                    fontFamily="sans-serif"
                                    fontWeight="500"
                                >
                                    {tick.label}
                                </text>
                            ))}

                            {/* Hover Crosshair & Glowing Indicator */}
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
                                            stroke="#525252"
                                            strokeDasharray="3 3"
                                            strokeWidth="1"
                                        />
                                        {/* Outer pulse aura */}
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r="7"
                                            fill="#FACC15"
                                            fillOpacity="0.25"
                                        />
                                        {/* Glowing Yellow Dot matching screenshot */}
                                        <circle
                                            cx={pt.x}
                                            cy={pt.y}
                                            r="4.5"
                                            fill="#FACC15"
                                            stroke="#000000"
                                            strokeWidth="2"
                                        />
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                ) : (
                    /* Clean empty state for connected platform with 0 contests */
                    <div className="w-full h-36 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-neutral-950 border border-neutral-900 border-dashed">
                        <Award className="w-8 h-8 text-neutral-600 mb-2" />
                        <p className="text-xs font-semibold text-neutral-400">
                            No rated contests recorded yet on {platform.portalName}
                        </p>
                        <p className="text-[11px] text-neutral-600 mt-1 max-w-xs">
                            Compete in a rated contest to begin plotting your dynamic rating progression.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
