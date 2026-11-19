import React from "react";

interface CardBannerSVGProps {
    idPrefix?: string;
    color?: string;
    className?: string;
    preserveAspectRatio?: string;
    style?: React.CSSProperties;
}

const COLUMNS = [13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, 49, 52];
const ROWS = [0.5, 2.5, 4.5, 6.5, 8.5, 10.5];

/**
 * CardBannerSVG
 * Reusable full-width vector circuit & dot-matrix banner pattern
 * Colors sampled precisely from the reference:
 * - Banner background: #ffc629
 * - Pattern elements (dots, strokes, fills): #f0b100
 */
export const CardBannerSVG: React.FC<CardBannerSVGProps> = ({
    idPrefix = "card-banner",
    color = "#f0b100",
    className = "w-full h-full",
    preserveAspectRatio = "none",
    style,
}) => {
    const clipId = `clip0_${idPrefix}`;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            viewBox="0 0 66 12"
            fill="none"
            preserveAspectRatio={preserveAspectRatio}
            style={{
                overflow: "hidden",
                overflowY: "hidden",
                ...style,
            }}
        >
            {/* Right-side circuit motif with clipPath */}
            <g clipPath={`url(#${clipId})`}>
                <path
                    d="M57.2 5.95L61.7 1.45L63.5 1L63.05 2.8L58.55 7.3L57.425 7.075L57.2 5.95Z"
                    fill={color}
                    fillOpacity={0.4}
                />
                <path
                    d="M54.5 9.1L55.4 10M55.85 6.4L56.3 8.2M56.3 8.2L58.1 8.65M56.3 8.2L54.95 9.55M61.7 1.45L57.2 5.95L57.425 7.075L58.55 7.3L63.05 2.8L63.5 1L61.7 1.45Z"
                    stroke={color}
                    strokeWidth={0.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M64.5 9.1L63.6 10M63.15 6.4L62.7 8.2M62.7 8.2L64.05 9.55M62.7 8.2L61.8 8.425L60.9 8.65M58.15 5L55.95 2.8L55.5 1L57.3 1.45L59.5 3.65M59.55 6.4L60.45 7.3L61.575 7.075L61.8 5.95L60.9 5.05"
                    stroke={color}
                    strokeWidth={0.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* Left-side circuit motif */}
            <path
                d="M3.2 5.95L7.7 1.45L9.5 1L9.05 2.8L4.55 7.3L3.425 7.075L3.2 5.95Z"
                fill={color}
                fillOpacity={0.4}
            />
            <path
                d="M0.5 9.1L1.4 10M1.85 6.4L2.3 8.2M2.3 8.2L4.1 8.65M2.3 8.2L0.95 9.55M7.7 1.45L3.2 5.95L3.425 7.075L4.55 7.3L9.05 2.8L9.5 1L7.7 1.45Z"
                stroke={color}
                strokeWidth={0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10.5 9.1L9.6 10M9.15 6.4L8.7 8.2M8.7 8.2L10.05 9.55M8.7 8.2L7.8 8.425L6.9 8.65M4.15 5L1.95 2.8L1.5 1L3.3 1.45L5.5 3.65M5.55 6.4L6.45 7.3L7.575 7.075L7.8 5.95L6.9 5.05"
                stroke={color}
                strokeWidth={0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Complete 14x6 Dot Grid Matrix */}
            {COLUMNS.map((cx) =>
                ROWS.map((cy) => (
                    <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.5} fill={color} />
                ))
            )}

            <defs>
                <clipPath id={clipId}>
                    <rect width="12" height="12" fill="white" transform="translate(53.5)" />
                </clipPath>
            </defs>
        </svg>
    );
};

export default CardBannerSVG;
