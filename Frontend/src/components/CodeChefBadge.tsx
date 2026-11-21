import React from "react";
import {
    resolveCodeChefRank,
    type CodeChefRankDefinition,
} from "../utils/codechefRanks";

export interface CodeChefBadgeProps {
    tier?: string | null;
    rating?: number | null;
    size?: "xs" | "sm" | "md" | "lg";
    showRatingRange?: boolean;
    className?: string;
    style?: React.CSSProperties;
    fallbackLabel?: string;
}

/**
 * Pixel-accurate CodeChef Contest Rating Tag Badge
 * Uses the exact colors, rounded boxes, and typography from official rating tags reference:
 * - 1★ (< 1400): #666666, White text
 * - 2★ (1400-1599): #1D7D22, White text
 * - 3★ (1600-1799): #3466CC, White text
 * - 4★ (1800-1999): #674273, White text
 * - 5★ (2000-2199): #E0A800, Dark text (#14161D)
 * - 6★ (2200-2499): #FF7F00, White text
 * - 7★ (>= 2500): #D0021C, White text
 */
export const CodeChefBadge: React.FC<CodeChefBadgeProps> = ({
    tier,
    rating,
    size = "sm",
    showRatingRange = false,
    className = "",
    style = {},
    fallbackLabel,
}) => {
    const rank: CodeChefRankDefinition | null = resolveCodeChefRank(tier, rating);

    if (!rank) {
        const displayLabel = fallbackLabel || tier || (typeof rating === "number" ? `CC ${rating}` : "CodeChef");
        return (
            <span
                style={{ backgroundColor: "#666666", color: "#FFFFFF", ...style }}
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
            title={`CodeChef: ${rank.name} (${rank.ratingRangeLabel} • ${rank.division})`}
            className={`inline-flex items-center justify-center font-bold shadow-xs select-none tracking-tight transition-transform duration-150 ${sizeClasses} ${className}`}
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

export default CodeChefBadge;
