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

    return (
        <div
            aria-labelledby="problems-solved-title"
            className="w-full text-white select-none flex flex-col justify-between h-full"
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-400 shadow-sm">
                            <Target className="w-4 h-4 text-cyan-400" />
                        </div>
                        <h3 id="problems-solved-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                            Problems solved
                        </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-400">
                            {totalSolved > 0 ? `${totalSolved.toLocaleString()} total` : "0 total"}
                        </span>
                    </div>
                </div>

                {/* Body: Donut Chart & Difficulty Distribution */}
                <div className="pt-6 pb-4 relative z-10">
                    {isLoading && !data ? (
                        <div className="flex items-center justify-center py-10 animate-pulse">
                            <div className="w-32 h-32 rounded-full border-4 border-white/[0.05]" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-around sm:justify-start sm:gap-12">
                            {/* Circular Multi-Color Donut */}
                            <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
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
                                        stroke="rgba(255, 255, 255, 0.05)"
                                        strokeWidth="10"
                                    />

                                    {/* Easy Segment (Cyan) */}
                                    {easy > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#06b6d4"
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.easyStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetEasy}
                                            className="transition-all duration-700"
                                        />
                                    )}

                                    {/* Medium Segment (Yellow/Amber) */}
                                    {medium > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#eab308"
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.mediumStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetMedium}
                                            className="transition-all duration-700"
                                        />
                                    )}

                                    {/* Hard Segment (Rose/Pink) */}
                                    {hard > 0 && (
                                        <circle
                                            cx="70"
                                            cy="70"
                                            r={donutSegments.radius}
                                            fill="none"
                                            stroke="#f43f5e"
                                            strokeWidth="10"
                                            strokeLinecap="round"
                                            strokeDasharray={`${donutSegments.hardStroke} ${donutSegments.circumference}`}
                                            strokeDashoffset={donutSegments.offsetHard}
                                            className="transition-all duration-700"
                                        />
                                    )}
                                </svg>

                                {/* Center Count */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                    <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                        {donutTotal > 0 ? donutTotal.toLocaleString() : totalSolved.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Difficulty Stats List */}
                            <div className="space-y-3 min-w-[130px]">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs sm:text-sm font-bold text-[#06b6d4]">Easy</span>
                                    <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
                                        {easy.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs sm:text-sm font-bold text-[#eab308]">Medium</span>
                                    <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
                                        {medium.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs sm:text-sm font-bold text-[#f43f5e]">Hard</span>
                                    <span className="text-xs sm:text-sm font-extrabold text-white font-mono">
                                        {hard.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Platform Breakdown Rows with Progress Bars */}
                <div className="pt-4 border-t border-white/[0.06] space-y-3.5 relative z-10">
                    {platforms.map((p) => {
                        return (
                            <div key={p.portal} className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            {getPortalIcon(p.portal, "w-4 h-4 object-contain")}
                                        </div>
                                        <span className="font-semibold text-neutral-200">
                                            {p.platformName}
                                        </span>
                                    </div>
                                    <span className="font-bold text-white font-mono">
                                        {p.count.toLocaleString()}
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white rounded-full transition-all duration-700"
                                        style={{ width: `${Math.max(p.percentage, 3)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ProblemsSolvedCard;
