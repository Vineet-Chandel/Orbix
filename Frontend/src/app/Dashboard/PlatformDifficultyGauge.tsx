import React from "react";

export interface DifficultyBreakdown {
    easy: number;
    medium: number;
    hard: number;
    total: number;
    easyTotal?: number;
    mediumTotal?: number;
    hardTotal?: number;
    totalQuestions?: number;
    attempting?: number;
}

interface PlatformDifficultyGaugeProps {
    difficulty: DifficultyBreakdown;
    platformName?: string;
    brandColor?: string;
    theme?: "light" | "dark";
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
        x: cx + r * Math.cos(angleInRadians),
        y: cy + r * Math.sin(angleInRadians),
    };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const delta = (endAngle - startAngle + 360) % 360;
    const largeArcFlag = delta > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const PlatformDifficultyGauge: React.FC<PlatformDifficultyGaugeProps> = ({
    difficulty,
    platformName,
    brandColor,
    theme = "light",
}) => {
    const {
        easy = 0,
        medium = 0,
        hard = 0,
        total = 0,
        easyTotal = Math.max(1, easy),
        mediumTotal = Math.max(1, medium),
        hardTotal = Math.max(1, hard),
        totalQuestions = Math.max(total, (easyTotal + mediumTotal + hardTotal) || 100),
        attempting = total > 0 ? 1 : 0,
    } = difficulty;

    const isDark = theme === "dark";

    // SVG geometry
    const cx = 120;
    const cy = 95;
    const r = 70;
    const strokeWidth = 7.5;

    // The 3 sectors covering 280° with 8° gaps between them
    // Sector 1: Easy (Cyan) -> 130° to 218° (88° span)
    // Sector 2: Medium (Yellow) -> 226° to 314° (88° span)
    // Sector 3: Hard (Red) -> 322° to 50° (88° span)
    const easySpan = 88;
    const medSpan = 88;
    const hardSpan = 88;

    // Calculate progress angles (with minimum cap so 1 solved problem is visually distinct with a dot)
    const calcProgressAngle = (count: number, maxCount: number, maxSpan: number) => {
        if (!count || count <= 0) return 0;
        const ratio = Math.min(1, count / Math.max(1, maxCount));
        // Non-linear scaling so small counts are clearly visible on the gauge
        const scaled = Math.pow(ratio, 0.62);
        return Math.min(maxSpan, 7 + (maxSpan - 7) * scaled);
    };

    const easyProgressAngle = calcProgressAngle(easy, easyTotal, easySpan);
    const medProgressAngle = calcProgressAngle(medium, mediumTotal, medSpan);
    const hardProgressAngle = calcProgressAngle(hard, hardTotal, hardSpan);

    // End dots coordinates
    const easyEndAngle = 130 + easyProgressAngle;
    const medEndAngle = 226 + medProgressAngle;
    const hardEndAngle = (322 + hardProgressAngle) % 360;

    const easyDot = easyProgressAngle > 0 ? polarToCartesian(cx, cy, r, easyEndAngle) : null;
    const medDot = medProgressAngle > 0 ? polarToCartesian(cx, cy, r, medEndAngle) : null;
    const hardDot = hardProgressAngle > 0 ? polarToCartesian(cx, cy, r, hardEndAngle) : null;

    // Percentages
    const easyPct = Math.min(100, Math.round((easy / Math.max(1, easyTotal)) * 100));
    const medPct = Math.min(100, Math.round((medium / Math.max(1, mediumTotal)) * 100));
    const hardPct = Math.min(100, Math.round((hard / Math.max(1, hardTotal)) * 100));

    if (isDark) {
        return (
            <div className="rounded-2xl border border-white/10 bg-[#121214] p-4 text-white shadow-xl animate-fadeIn space-y-3">
                {/* Header: Title and Legend */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        {brandColor && (
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0 bg-white"
                            />
                        )}
                        <span className="text-xs font-bold text-neutral-300">
                            {platformName ? `${platformName} Progress` : "Problem Solving Progress"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5 text-[10px] font-semibold">
                        <span className="flex items-center gap-1 text-neutral-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                            <span>Easy</span>
                        </span>
                        <span className="flex items-center gap-1 text-neutral-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                            <span>Med.</span>
                        </span>
                        <span className="flex items-center gap-1 text-white">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            <span>Hard</span>
                        </span>
                    </div>
                </div>

                {/* SVG Gauge */}
                <div className="flex justify-center items-center py-1">
                    <svg viewBox="0 0 240 185" className="w-56 sm:w-60 h-auto overflow-visible select-none drop-shadow-md">
                        <path d={describeArc(cx, cy, r, 130, 218)} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />
                        <path d={describeArc(cx, cy, r, 226, 314)} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />
                        <path d={describeArc(cx, cy, r, 322, 50)} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />

                        {easyProgressAngle > 0 && <path d={describeArc(cx, cy, r, 130, easyEndAngle)} fill="none" stroke="#3B82F6" strokeWidth={strokeWidth} strokeLinecap="round" />}
                        {medProgressAngle > 0 && <path d={describeArc(cx, cy, r, 226, medEndAngle)} fill="none" stroke="#F59E0B" strokeWidth={strokeWidth} strokeLinecap="round" />}
                        {hardProgressAngle > 0 && <path d={describeArc(cx, cy, r, 322, hardEndAngle)} fill="none" stroke="#EF4444" strokeWidth={strokeWidth} strokeLinecap="round" />}

                        {easyDot && <circle cx={easyDot.x} cy={easyDot.y} r={strokeWidth / 2} fill="#3B82F6" />}
                        {medDot && <circle cx={medDot.x} cy={medDot.y} r={strokeWidth / 2} fill="#F59E0B" />}
                        {hardDot && <circle cx={hardDot.x} cy={hardDot.y} r={strokeWidth / 2} fill="#EF4444" />}

                        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle">
                            <tspan className="text-3xl font-black fill-white tracking-tight">{total}</tspan>
                            <tspan className="text-base font-semibold fill-neutral-400">/{totalQuestions}</tspan>
                        </text>

                        <g transform={`translate(${cx - 30}, ${cy + 13})`}>
                            <path d="M2 7l3 3 6-6" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            <text x="16" y="9" fill="#f3f4f6" fontSize="13" fontWeight="700" dominantBaseline="middle">Solved</text>
                        </g>

                        <text x={cx} y={cy + 68} textAnchor="middle" fill="#9ca3af" fontSize="12" fontWeight="600">{attempting} Attempting</text>
                    </svg>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10">
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3B82F6]" /><span className="text-[11px] font-bold text-neutral-300">Easy</span></div>
                        <p className="text-xs font-black text-white">{easy} <span className="text-[10px] text-neutral-400 font-normal">/{easyTotal}</span></p>
                        <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mt-1"><div className="bg-[#3B82F6] h-full rounded-full" style={{ width: `${easyPct}%` }} /></div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /><span className="text-[11px] font-bold text-neutral-300">Medium</span></div>
                        <p className="text-xs font-black text-white">{medium} <span className="text-[10px] text-neutral-400 font-normal">/{mediumTotal}</span></p>
                        <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mt-1"><div className="bg-[#F59E0B] h-full rounded-full" style={{ width: `${medPct}%` }} /></div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#EF4444]" /><span className="text-[11px] font-bold text-neutral-300">Hard</span></div>
                        <p className="text-xs font-black text-white">{hard} <span className="text-[10px] text-neutral-400 font-normal">/{hardTotal}</span></p>
                        <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden mt-1"><div className="bg-[#EF4444] h-full rounded-full" style={{ width: `${hardPct}%` }} /></div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Elegant Modern Light Theme Box matching the modal
    return (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 text-neutral-900 shadow-xs animate-fadeIn space-y-3.5">
            {/* Header: Title and Legend */}
            <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                    {brandColor && (
                        <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-neutral-900"
                        />
                    )}
                    <span className="text-xs font-extrabold text-neutral-900 tracking-tight">
                        {platformName ? `${platformName} Progress` : "Problem Solving Progress"}
                    </span>
                </div>

                {/* Color Legend (Monochrome: Easy, Medium, Hard) */}
                <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] font-bold">
                    <span className="flex items-center gap-1.5 text-neutral-500">
                        <span className="w-2 h-2 rounded-full bg-neutral-300" />
                        <span>Easy</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-600">
                        <span className="w-2 h-2 rounded-full bg-neutral-500" />
                        <span>Med.</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-900">
                        <span className="w-2 h-2 rounded-full bg-black" />
                        <span>Hard</span>
                    </span>
                </div>
            </div>

            {/* Main Circular Radial Gauge (Light Theme) */}
            <div className="flex justify-center items-center py-1">
                <svg
                    viewBox="0 0 240 185"
                    className="w-56 sm:w-60 h-auto overflow-visible select-none"
                >
                    {/* 1. Background Inactive Tracks (Light Theme Neutral Tracks) */}
                    <path
                        d={describeArc(cx, cy, r, 130, 218)}
                        fill="none"
                        stroke="rgba(0, 0, 0, 0.06)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    <path
                        d={describeArc(cx, cy, r, 226, 314)}
                        fill="none"
                        stroke="rgba(0, 0, 0, 0.06)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    <path
                        d={describeArc(cx, cy, r, 322, 50)}
                        fill="none"
                        stroke="rgba(0, 0, 0, 0.06)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* 2. Active Progress Arcs */}
                    {/* Easy Progress (Blue) */}
                    {easyProgressAngle > 0 && (
                        <path
                            d={describeArc(cx, cy, r, 130, easyEndAngle)}
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                        />
                    )}
                    {/* Medium Progress (Yellow) */}
                    {medProgressAngle > 0 && (
                        <path
                            d={describeArc(cx, cy, r, 226, medEndAngle)}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                        />
                    )}
                    {/* Hard Progress (Red) */}
                    {hardProgressAngle > 0 && (
                        <path
                            d={describeArc(cx, cy, r, 322, hardEndAngle)}
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                        />
                    )}

                    {/* 3. Progress Head Indicator Dots */}
                    {easyDot && (
                        <circle
                            cx={easyDot.x}
                            cy={easyDot.y}
                            r={strokeWidth / 2}
                            fill="#3B82F6"
                            className="transition-all duration-300"
                        />
                    )}
                    {medDot && (
                        <circle
                            cx={medDot.x}
                            cy={medDot.y}
                            r={strokeWidth / 2}
                            fill="#F59E0B"
                            className="transition-all duration-300"
                        />
                    )}
                    {hardDot && (
                        <circle
                            cx={hardDot.x}
                            cy={hardDot.y}
                            r={strokeWidth / 2}
                            fill="#EF4444"
                            className="transition-all duration-300"
                        />
                    )}

                    {/* 4. Center Typography (Light Theme) */}
                    <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle">
                        <tspan className="text-3xl font-black fill-neutral-900 tracking-tight">
                            {total}
                        </tspan>
                        <tspan className="text-base font-semibold fill-neutral-400">
                            /{totalQuestions}
                        </tspan>
                    </text>

                    {/* Checkmark icon + Solved */}
                    <g transform={`translate(${cx - 30}, ${cy + 13})`}>
                        <path
                            d="M2 7l3 3 6-6"
                            fill="none"
                            stroke="#171717"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <text
                            x="16"
                            y="9"
                            fill="#171717"
                            fontSize="13"
                            fontWeight="700"
                            dominantBaseline="middle"
                        >
                            Solved
                        </text>
                    </g>

                    {/* Attempting counter in the bottom opening */}
                    <text
                        x={cx}
                        y={cy + 68}
                        textAnchor="middle"
                        fill="#737373"
                        fontSize="12"
                        fontWeight="600"
                    >
                        {attempting} Attempting
                    </text>
                </svg>
            </div>

            {/* 5. Difficulty Breakdown Cards (Light Theme Cards) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-2 border-t border-neutral-200">
                {/* Easy Box */}
                <div className="p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200 text-center space-y-1 shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                        <span className="text-[11px] font-bold text-neutral-700">Easy</span>
                    </div>
                    <p className="text-xs font-black text-neutral-900">
                        {easy}{" "}
                        <span className="text-[10px] text-neutral-400 font-semibold">
                            /{easyTotal}
                        </span>
                    </p>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden mt-1">
                        <div
                            className="bg-[#3B82F6] h-full rounded-full transition-all duration-500"
                            style={{ width: `${easyPct}%` }}
                        />
                    </div>
                </div>

                {/* Medium Box */}
                <div className="p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200 text-center space-y-1 shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                        <span className="text-[11px] font-bold text-neutral-700">Medium</span>
                    </div>
                    <p className="text-xs font-black text-neutral-900">
                        {medium}{" "}
                        <span className="text-[10px] text-neutral-400 font-semibold">
                            /{mediumTotal}
                        </span>
                    </p>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden mt-1">
                        <div
                            className="bg-[#F59E0B] h-full rounded-full transition-all duration-500"
                            style={{ width: `${medPct}%` }}
                        />
                    </div>
                </div>

                {/* Hard Box */}
                <div className="p-2.5 rounded-xl bg-neutral-50/80 border border-neutral-200 text-center space-y-1 shadow-2xs">
                    <div className="flex items-center justify-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                        <span className="text-[11px] font-bold text-neutral-700">Hard</span>
                    </div>
                    <p className="text-xs font-black text-neutral-900">
                        {hard}{" "}
                        <span className="text-[10px] text-neutral-400 font-semibold">
                            /{hardTotal}
                        </span>
                    </p>
                    <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden mt-1">
                        <div
                            className="bg-[#EF4444] h-full rounded-full transition-all duration-500"
                            style={{ width: `${hardPct}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
