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
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <Target className="w-5 h-5 text-black" />
                        </div>
                        <h3 id="problems-solved-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Problems solved
                        </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black font-black text-xs text-black shadow-[1px_1px_0px_#000]">
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
                            {/* Circular Donut */}
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
                                        stroke="rgba(0, 0, 0, 0.08)"
                                        strokeWidth="12"
                                    />

                                    {/* Easy Segment (Blue) */}
                                    {easy > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#38BDF8"
                                            strokeWidth="12"
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
                                            strokeWidth="12"
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
                                            strokeWidth="12"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.hardStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetHard}
                                            className="transition-all duration-700"
                                        />
                                    )}
                                </svg>

                                {/* Center Count */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                    <span className="text-3xl sm:text-4xl font-black text-black tracking-tight font-sans">
                                        {donutTotal > 0 ? donutTotal.toLocaleString() : totalSolved.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Difficulty Stats List */}
                            <div className="space-y-4 min-w-[160px]">
                                <div className="flex items-center justify-between gap-5">
                                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-black text-black">
                                        <span className="w-3.5 h-3.5 rounded-full bg-[#38BDF8] border border-black shadow-[1px_1px_0px_#000]" />
                                        <span>Easy</span>
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-black font-mono">
                                        {easy.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-5">
                                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-black text-black">
                                        <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] border border-black shadow-[1px_1px_0px_#000]" />
                                        <span>Medium</span>
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-black font-mono">
                                        {medium.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-5">
                                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-black text-black">
                                        <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444] border border-black shadow-[1px_1px_0px_#000]" />
                                        <span>Hard</span>
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-black font-mono">
                                        {hard.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Platform Breakdown: Vertical Bar Chart */}
                <div className="pt-6 mt-3 border-t-2 border-black/15 relative z-10">
                    {platforms.length === 0 ? (
                        <div className="py-8 text-center text-xs text-neutral-500 font-bold">
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
                                        <span className="text-xs sm:text-sm font-black text-black font-mono text-center mb-1.5 transition-transform group-hover:scale-110">
                                            {p.count.toLocaleString()}
                                        </span>

                                        {/* Bar Pillar */}
                                        <div className="w-full flex items-end justify-center h-28 sm:h-32">
                                            <div
                                                style={{ height: `${heightPct}%` }}
                                                className={`w-full max-w-[34px] sm:max-w-[44px] rounded-t-xl border-2 border-black shadow-[2px_2px_0px_#000] transition-all duration-500 ease-out ${
                                                    isMax
                                                        ? "bg-[#a2ff86]"
                                                        : "bg-white group-hover:bg-[#FAF6EE]"
                                                }`}
                                            />
                                        </div>

                                        {/* Platform Icon & Label Below */}
                                        <div className="flex flex-col items-center mt-2.5 gap-1 w-full">
                                            <div className="w-7 h-7 rounded-lg bg-white border-2 border-black shadow-[1px_1px_0px_#000] p-1 flex items-center justify-center flex-shrink-0">
                                                {getPortalIcon(p.portal, "w-full h-full object-contain")}
                                            </div>
                                            <span className="text-xs font-black text-black text-center truncate w-full">
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
