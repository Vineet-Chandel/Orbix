import React, { useMemo } from "react";
import { Target } from "lucide-react";
import { type PracticeAnalyticsData } from "../../../store";
import { getPortalIcon } from "../../../utils/portalIcons";

interface ProblemsSolvedCardProps {
    data?: PracticeAnalyticsData | null;
    isLoading?: boolean;
}

export const ProblemsSolvedCard: React.FC<ProblemsSolvedCardProps> = ({ data, isLoading }) => {
    const totalSolved = data?.totalSolved || 0;
    const donutTotal = data?.donutTotal || 0;
    const easy = data?.difficulty?.easy || 0;
    const medium = data?.difficulty?.medium || 0;
    const hard = data?.difficulty?.hard || 0;

    // Donut chart calculations
    const donutSegments = useMemo(() => {
        const sum = (easy + medium + hard) || 1;
        const radius = 54;
        const circumference = 2 * Math.PI * radius; // ~339.29

        const easyRatio = easy / sum;
        const mediumRatio = medium / sum;
        const hardRatio = hard / sum;

        const easyLength = easyRatio * circumference;
        const mediumLength = mediumRatio * circumference;
        const hardLength = hardRatio * circumference;

        // Gap spacing between segments
        const gap = 4;
        const easyStroke = Math.max(0, easyLength - gap);
        const mediumStroke = Math.max(0, mediumLength - gap);
        const hardStroke = Math.max(0, hardLength - gap);

        // Offsets (starting from top, i.e., -90 deg)
        const offsetEasy = 0;
        const offsetMedium = -(easyLength);
        const offsetHard = -(easyLength + mediumLength);

        return {
            radius,
            circumference,
            easyStroke,
            mediumStroke,
            hardStroke,
            offsetEasy,
            offsetMedium,
            offsetHard,
        };
    }, [easy, medium, hard]);

    const platforms = useMemo(() => {
        return data?.platformBreakdown || [];
    }, [data]);

    const maxPlatformCount = useMemo(() => {
        if (!platforms || platforms.length === 0) return 1;
        return Math.max(...platforms.map((p) => p.count), 1);
    }, [platforms]);

    return (
        <div
            aria-labelledby="problems-solved-title"
            className="w-full text-neutral-900 select-none flex flex-col justify-between h-full"
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-neutral-300 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/[0.04] border border-neutral-300 flex items-center justify-center text-neutral-900 shadow-2xs">
                            <Target className="w-5 h-5 text-neutral-800" />
                        </div>
                        <h3 id="problems-solved-title" className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
                            Problems solved
                        </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-sm sm:text-base font-bold text-neutral-600">
                            {totalSolved > 0 ? `${totalSolved.toLocaleString()} total` : "0 total"}
                        </span>
                    </div>
                </div>

                {/* Body: Donut Chart & Difficulty Distribution */}
                <div className="pt-6 pb-4 relative z-10">
                    {isLoading && !data ? (
                        <div className="flex items-center justify-center py-10 animate-pulse">
                            <div className="w-36 h-36 rounded-full border-4 border-neutral-200" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-around sm:justify-start sm:gap-14">
                            {/* Circular Monochrome Donut */}
                            <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex-shrink-0 flex items-center justify-center">
                                <svg
                                    className="w-full h-full -rotate-90 transform"
                                    viewBox="0 0 140 140"
                                >
                                    {/* Track */}
                                    <circle
                                        cx="70"
                                        cy="70"
                                        r={donutSegments.radius}
                                        fill="none"
                                        stroke="rgba(0, 0, 0, 0.06)"
                                        strokeWidth="11"
                                    />

                                    {/* Easy Segment (Blue) */}
                                    {easy > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#3B82F6"
                                            strokeWidth="11"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.easyStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetEasy}
                                            className="transition-all duration-700"
                                        />
                                    )}

                                    {/* Medium Segment (Yellow) */}
                                    {medium > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#F59E0B"
                                            strokeWidth="11"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.mediumStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetMedium}
                                            className="transition-all duration-700"
                                        />
                                    )}

                                    {/* Hard Segment (Red) */}
                                    {hard > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#EF4444"
                                            strokeWidth="11"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.hardStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetHard}
                                            className="transition-all duration-700"
                                        />
                                    )}
                                </svg>

                                {/* Center Count */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                    <span className="text-3xl sm:text-4xl font-black text-neutral-900 tracking-tight font-sans">
                                        {donutTotal > 0 ? donutTotal.toLocaleString() : totalSolved.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Difficulty Stats List */}
                            <div className="space-y-4 min-w-[160px]">
                                <div className="flex items-center justify-between gap-5">
                                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-neutral-700">
                                        <span className="w-3 h-3 rounded-full bg-[#3B82F6] shadow-2xs" />
                                        <span>Easy</span>
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-neutral-900 font-mono">
                                        {easy.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-5">
                                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-neutral-800">
                                        <span className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-2xs" />
                                        <span>Medium</span>
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-neutral-900 font-mono">
                                        {medium.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-5">
                                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-black text-neutral-950">
                                        <span className="w-3 h-3 rounded-full bg-[#EF4444] shadow-2xs" />
                                        <span>Hard</span>
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-neutral-900 font-mono">
                                        {hard.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Platform Breakdown: Vertical Bar Chart (Matching Image 2) */}
                <div className="pt-6 mt-3 border-t border-neutral-200 relative z-10">
                    {platforms.length === 0 ? (
                        <div className="py-8 text-center text-xs text-neutral-400 font-medium">
                            No platform problem data available
                        </div>
                    ) : (
                        <div className="flex items-end justify-around gap-2 sm:gap-4 h-48 sm:h-52 pt-6 pb-2">
                            {platforms.map((p) => {
                                const heightPct =
                                    p.count === 0
                                        ? 6
                                        : Math.max(Math.round((p.count / maxPlatformCount) * 100), 10);
                                const isMax = p.count === maxPlatformCount && p.count > 0;

                                return (
                                    <div
                                        key={p.portal}
                                        className="flex-1 flex flex-col items-center justify-end h-full group relative max-w-[110px]"
                                        title={`${p.platformName}: ${p.count.toLocaleString()} problems solved`}
                                    >
                                        {/* Value directly above bar */}
                                        <span className="text-xs sm:text-sm font-black text-neutral-900 font-mono text-center mb-1.5 transition-transform group-hover:scale-110">
                                            {p.count.toLocaleString()}
                                        </span>

                                        {/* Bar Pillar */}
                                        <div className="w-full flex items-end justify-center h-28 sm:h-32">
                                            <div
                                                style={{ height: `${heightPct}%` }}
                                                className={`w-full max-w-[34px] sm:max-w-[44px] rounded-t-xl sm:rounded-t-2xl transition-all duration-500 ease-out ${
                                                    isMax
                                                        ? "bg-black shadow-xs"
                                                        : "bg-neutral-200 group-hover:bg-neutral-300"
                                                }`}
                                            />
                                        </div>

                                        {/* Platform Icon & Label Below */}
                                        <div className="flex flex-col items-center mt-2.5 gap-1 w-full">
                                            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                                {getPortalIcon(p.portal, "w-full h-full object-contain")}
                                            </div>
                                            <span className="text-xs sm:text-sm font-bold text-neutral-800 text-center truncate w-full">
                                                {p.platformName}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProblemsSolvedCard;
