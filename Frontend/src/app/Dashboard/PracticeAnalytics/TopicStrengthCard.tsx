import React, { useMemo } from "react";
import { Compass } from "lucide-react";
import { type PracticeAnalyticsData } from "../../../store";

interface TopicStrengthCardProps {
    data?: PracticeAnalyticsData | null;
    isLoading?: boolean;
}

export const TopicStrengthCard: React.FC<TopicStrengthCardProps> = ({ data, isLoading }) => {
    const rawAxes = data?.topicStrength || [
        { topic: "Array", axisLabel: "Array", score: 92, count: 1145 },
        { topic: "String", axisLabel: "String", score: 45, count: 462 },
        { topic: "Hash Table", axisLabel: "Hash Table", score: 40, count: 433 },
        { topic: "Math", axisLabel: "Math", score: 33, count: 368 },
        { topic: "Dynamic Programming", axisLabel: "DP", score: 30, count: 327 },
        { topic: "Sorting", axisLabel: "Sorting", score: 26, count: 294 },
    ];

    const radar = useMemo(() => {
        const cx = 160;
        const cy = 150;
        const r = 90;
        const totalAxes = 6;

        // Concentric hexagon levels
        const levels = [0.25, 0.5, 0.75, 1.0];
        const gridPolygons = levels.map((lvl) => {
            const currentR = r * lvl;
            const pts = [];
            for (let i = 0; i < totalAxes; i++) {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
                const x = cx + currentR * Math.cos(angle);
                const y = cy + currentR * Math.sin(angle);
                pts.push(`${x},${y}`);
            }
            return pts.join(" ");
        });

        // Axis spokes
        const spokes = [];
        for (let i = 0; i < totalAxes; i++) {
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            spokes.push({ x1: cx, y1: cy, x2: x, y2: y });
        }

        // Data Polygon points
        const dataPoints: Array<{ x: number; y: number; label: string; score: number }> = [];
        for (let i = 0; i < totalAxes; i++) {
            const axis = rawAxes[i] || { axisLabel: "", score: 50 };
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
            const val = Math.max(0.12, Math.min(1, axis.score / 100));
            const ptR = r * val;
            const x = cx + ptR * Math.cos(angle);
            const y = cy + ptR * Math.sin(angle);
            dataPoints.push({ x, y, label: axis.axisLabel, score: axis.score });
        }
        const dataPolygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

        // Label positions (placed neatly around the perimeter)
        const labelPositions = [
            { text: "Array", x: 160, y: 38 },
            { text: "String", x: 266, y: 98 },
            { text: "Hash Table", x: 266, y: 218 },
            { text: "Math", x: 160, y: 272 },
            { text: "DP", x: 54, y: 218 },
            { text: "Sorting", x: 54, y: 98 },
        ];

        return {
            cx,
            cy,
            gridPolygons,
            spokes,
            dataPoints,
            dataPolygonPoints,
            labelPositions,
        };
    }, [rawAxes]);

    return (
        <section
            aria-labelledby="topic-strength-title"
            className="w-full rounded-3xl bg-[#0c1017] text-white p-6 sm:p-7 border border-neutral-800 shadow-2xl relative overflow-hidden select-none flex flex-col justify-between"
        >
            {/* Ambient glow */}
            <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-400 shadow-sm">
                            <Compass className="w-4 h-4 text-amber-400" />
                        </div>
                        <h3 id="topic-strength-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                            Topic strength
                        </h3>
                    </div>
                </div>

                {/* Body: SVG Radar Chart */}
                <div className="pt-2 relative z-10 flex items-center justify-center min-h-[300px]">
                    {isLoading && !data ? (
                        <div className="w-44 h-44 rounded-full border border-white/[0.05] animate-pulse" />
                    ) : (
                        <div className="w-full max-w-[320px] aspect-square flex items-center justify-center">
                            <svg
                                viewBox="0 0 320 300"
                                className="w-full h-full overflow-visible select-none"
                            >
                                {/* Concentric Hexagons */}
                                {radar.gridPolygons.map((pts, idx) => (
                                    <polygon
                                        key={idx}
                                        points={pts}
                                        fill="none"
                                        stroke="rgba(255, 255, 255, 0.08)"
                                        strokeWidth="1"
                                    />
                                ))}

                                {/* Axis Spoke Lines */}
                                {radar.spokes.map((spoke, idx) => (
                                    <line
                                        key={idx}
                                        x1={spoke.x1}
                                        y1={spoke.y1}
                                        x2={spoke.x2}
                                        y2={spoke.y2}
                                        stroke="rgba(255, 255, 255, 0.08)"
                                        strokeWidth="1"
                                    />
                                ))}

                                {/* Filled Radar Data Area */}
                                <polygon
                                    points={radar.dataPolygonPoints}
                                    fill="rgba(250, 204, 21, 0.18)"
                                    stroke="#facc15"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    className="transition-all duration-700"
                                />

                                {/* Vertex Markers / Dots */}
                                {radar.dataPoints.map((pt, idx) => (
                                    <circle
                                        key={idx}
                                        cx={pt.x}
                                        cy={pt.y}
                                        r="3.5"
                                        fill="#facc15"
                                        stroke="#0c1017"
                                        strokeWidth="1.5"
                                        className="transition-all duration-700"
                                    />
                                ))}

                                {/* Perimeter Axis Labels */}
                                {radar.labelPositions.map((lbl, idx) => (
                                    <text
                                        key={idx}
                                        x={lbl.x}
                                        y={lbl.y}
                                        textAnchor="middle"
                                        className="text-[11px] sm:text-xs font-semibold fill-neutral-400 select-none"
                                    >
                                        {lbl.text}
                                    </text>
                                ))}
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default TopicStrengthCard;
