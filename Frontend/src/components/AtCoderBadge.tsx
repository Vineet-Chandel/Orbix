import React from "react";
import {
    resolveAtCoderRank,
    type AtCoderRankDefinition,
} from "../utils/atcoderRanks";

export interface AtCoderBadgeProps {
    tier?: string | null;
    rating?: number | null;
    size?: "xs" | "sm" | "md" | "lg";
    showRatingRange?: boolean;
    className?: string;
    style?: React.CSSProperties;
    fallbackLabel?: string;
}

/**
 * Pixel-accurate AtCoder Contest Rating Tag Badge
 * Uses the exact colors, rounded boxes, and white typography from official rating tags reference:
 * - Gray (< 400): #808080
 * - Brown (400-799): #804000
 * - Green (800-1199): #008001
 * - Cyan (1200-1599): #01A0A0
 * - Blue (1600-1999): #1500FF
 * - Yellow (2000-2399): #B9A000
 * - Orange (2400-2799): #FF8001
 * - Red (>= 2800): #FF0200
 */
export const AtCoderBadge: React.FC<AtCoderBadgeProps> = ({
    tier,
    rating,
    size = "sm",
    showRatingRange = false,
    className = "",
    style = {},
    fallbackLabel,
}) => {
    const rank: AtCoderRankDefinition | null = resolveAtCoderRank(tier, rating);

    if (!rank) {
        const displayLabel = fallbackLabel || tier || (typeof rating === "number" ? `AC ${rating}` : "AtCoder");
        return (
            <span
                style={{ backgroundColor: "#808080", color: "#FFFFFF", ...style }}
                className={`inline-flex items-center justify-center font-bold text-white rounded-lg shadow-xs select-none tracking-tight ${
                    size === "xs"
                        ? "px-2 py-0.5 text-[10px]"
                        : size === "md"
                        ? "px-3.5 py-1.5 text-sm"
                        : size === "lg"
                        ? "px-4 py-2 text-base"
                        : "px-2.5 py-1 text-xs"
                } ${className}`}
            >
                {displayLabel}
            </span>
        );
    }

    const sizeClasses = {
        xs: "px-2 py-0.5 text-[10px] rounded-md leading-tight min-w-[34px]",
        sm: "px-2.5 py-1 text-xs rounded-lg leading-tight min-w-[42px]",
        md: "px-3.5 py-1.5 text-sm rounded-lg leading-snug min-w-[48px]",
        lg: "px-4 py-2 text-base rounded-xl leading-normal min-w-[56px]",
    }[size];

    return (
        <span
            style={{
                backgroundColor: rank.bgColor,
                color: rank.textColor,
                ...style,
            }}
            title={`AtCoder: ${rank.name} (${rank.ratingRangeLabel})`}
            className={`inline-flex items-center justify-center font-bold text-white shadow-xs select-none tracking-tight transition-transform duration-150 ${sizeClasses} ${className}`}
        >
            <span>{rank.name}</span>
            {showRatingRange && (
                <span className="ml-1.5 opacity-90 text-[0.85em] font-normal">
                    ({rank.ratingRangeLabel})
                </span>
            )}
        </span>
    );
};

export default AtCoderBadge;
