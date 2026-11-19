import React from "react";
import {
    ATCODER_RANKS,
    type AtCoderRankDefinition,
} from "../utils/atcoderRanks";
import { AtCoderBadge } from "./AtCoderBadge";

export interface AtCoderRatingLadderProps {
    currentRating?: number | null;
    currentTier?: string | null;
    className?: string;
}

/**
 * Renders the full 8-tier AtCoder Contest Rating Badges Ladder
 * Matching the exact colors, typography, and badges from the official reference:
 * - Gray (< 400): #808080
 * - Brown (400-799): #804000
 * - Green (800-1199): #008001
 * - Cyan (1200-1599): #01A0A0
 * - Blue (1600-1999): #1500FF
 * - Yellow (2000-2399): #B9A000
 * - Orange (2400-2799): #FF8001
 * - Red (>= 2800): #FF0200
 */
export const AtCoderRatingLadder: React.FC<AtCoderRatingLadderProps> = ({
    currentRating,
    currentTier,
    className = "",
}) => {
    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.08]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
                    RANK
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
                    RATING
                </span>
            </div>

            <div className="divide-y divide-black/[0.04] space-y-1">
                {ATCODER_RANKS.map((rank: AtCoderRankDefinition) => {
                    const isCurrent =
                        (typeof currentRating === "number" &&
                            currentRating >= rank.minRating &&
                            currentRating <= rank.maxRating) ||
                        (Boolean(currentTier) &&
                            rank.name.toLowerCase() === currentTier?.toLowerCase());

                    return (
                        <div
                            key={rank.id}
                            className={`flex items-center justify-between py-2 px-2.5 rounded-xl transition-colors ${
                                isCurrent
                                    ? "bg-black/[0.05] ring-1 ring-black/10 font-bold"
                                    : "hover:bg-black/[0.02]"
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <AtCoderBadge
                                    tier={rank.name}
                                    size="sm"
                                    className="shadow-xs"
                                />
                                {isCurrent && (
                                    <span className="text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded bg-black text-white">
                                        Current
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-mono font-medium text-neutral-700">
                                {rank.ratingRangeLabel}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AtCoderRatingLadder;
