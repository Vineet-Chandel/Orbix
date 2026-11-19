import React, { useMemo } from "react";
import { Compass } from "lucide-react";
import { type PracticeAnalyticsData } from "../../../store";

interface TopicStrengthCardProps {
    data?: PracticeAnalyticsData | null;
    isLoading?: boolean;
}

const DEFAULT_EMPTY_AXES = [
    { topic: "Array", axisLabel: "Array", score: 0, count: 0 },
    { topic: "String", axisLabel: "String", score: 0, count: 0 },
    { topic: "Hash Table", axisLabel: "Hash Table", score: 0, count: 0 },
    { topic: "Math", axisLabel: "Math", score: 0, count: 0 },
    { topic: "Dynamic Programming", axisLabel: "DP", score: 0, count: 0 },
    { topic: "Sorting", axisLabel: "Sorting", score: 0, count: 0 },
];

export const TopicStrengthCard: React.FC<TopicStrengthCardProps> = ({ data, isLoading }) => {
    const rawAxes = data?.topicStrength && data.topicStrength.length > 0 ? data.topicStrength : DEFAULT_EMPTY_AXES;
    const hasScores = rawAxes.some((a) => a.score > 0);

    const radar = useMemo(() => {
        const cx = 230;
        const cy = 210;
        const r = 138;
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
            const axis = rawAxes[i] || { axisLabel: "", score: 0 };
            const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
            const val = hasScores ? Math.max(0.12, Math.min(1, axis.score / 100)) : 0;
            const ptR = r * val;
            const x = cx + ptR * Math.cos(angle);
            const y = cy + ptR * Math.sin(angle);
            dataPoints.push({ x, y, label: axis.axisLabel, score: axis.score });
        }
        const dataPolygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

        // Label positions placed neatly around the perimeter with custom text anchors
        const labelPositions: Array<{ text: string; x: number; y: number; textAnchor: "middle" | "start" | "end" }> = [
            { text: "Array", x: 230, y: 44, textAnchor: "middle" },
            { text: "String", x: 362, y: 146, textAnchor: "start" },
            { text: "Hash Table", x: 362, y: 284, textAnchor: "start" },
            { text: "Math", x: 230, y: 384, textAnchor: "middle" },
            { text: "DP", x: 98, y: 284, textAnchor: "end" },
            { text: "Sorting", x: 98, y: 146, textAnchor: "end" },
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
    }, [rawAxes, hasScores]);

    return (
        <div
            aria-labelledby="topic-strength-title"
            className="w-full text-neutral-900 select-none flex flex-col justify-between h-full"
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <Compass className="w-5 h-5 text-black" />
                        </div>
                        <h3 id="topic-strength-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
                            Topic strength
                        </h3>
                    </div>
                </div>

                {/* Body: SVG Radar Chart */}
                <div className="pt-4 pb-2 relative z-10 flex-1 flex items-center justify-center min-h-[360px] sm:min-h-[400px]">
                    {isLoading && !data ? (
                        <div className="w-56 h-56 rounded-full border-2 border-dashed border-black/30 animate-pulse" />
                    ) : (
                        <div className="w-full max-w-[420px] sm:max-w-[460px] aspect-square flex items-center justify-center">
                            <svg
                                viewBox="0 0 460 420"
                                className="w-full h-full overflow-visible select-none"
                            >
                                {/* Concentric Hexagons */}
                                {radar.gridPolygons.map((pts, idx) => (
                                    <polygon
                                        key={idx}
                                        points={pts}
                                        fill="none"
                                        stroke="rgba(0, 0, 0, 0.22)"
                                        strokeWidth="1.5"
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
                                        stroke="rgba(0, 0, 0, 0.22)"
                                        strokeWidth="1.5"
                                    />
                                ))}

                                {/* Filled Radar Data Area (Neo-Brutalist Green & Black Outline) */}
                                <polygon
                                    points={radar.dataPolygonPoints}
                                    fill="rgba(162, 255, 134, 0.35)"
                                    stroke="#000000"
                                    strokeWidth="2.8"
                                    strokeLinejoin="round"
                                    className="transition-all duration-700"
                                />

                                {/* Vertex Markers / Dots */}
                                {radar.dataPoints.map((pt, idx) => (
                                    <circle
                                        key={idx}
                                        cx={pt.x}
                                        cy={pt.y}
                                        r="5"
                                        fill="#000000"
                                        stroke="#ffffff"
                                        strokeWidth="2.5"
                                        className="transition-all duration-700"
                                    />
                                ))}

                                {/* Perimeter Axis Labels */}
                                {radar.labelPositions.map((lbl, idx) => (
                                    <text
                                        key={idx}
                                        x={lbl.x}
                                        y={lbl.y}
                                        textAnchor={lbl.textAnchor}
                                        dominantBaseline="middle"
                                        className="text-sm sm:text-base font-black fill-black select-none tracking-tight"
                                    >
                                        {lbl.text}
                                    </text>
                                ))}
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopicStrengthCard;
