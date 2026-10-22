import React from "react";
import {
    CODECHEF_RANKS,
    CODECHEF_DIVISIONS,
    type CodeChefRankDefinition,
} from "../utils/codechefRanks";
import { CodeChefBadge } from "./CodeChefBadge";

export interface CodeChefRatingLadderProps {
    currentRating?: number | null;
    currentTier?: string | null;
    className?: string;
}

/**
 * Renders the full 7-tier CodeChef Contest Rating Badges Ladder with Division breakdown
 * Matching the exact colors, typography, and badges from the official reference:
 * 1★ (< 1400): #666666
 * 2★ (1400-1599): #1D7D22
 * 3★ (1600-1799): #3466CC
 * 4★ (1800-1999): #674273
 * 5★ (2000-2199): #E0A800
 * 6★ (2200-2499): #FF7F00
 * 7★ (>= 2500): #D0021C
 */
export const CodeChefRatingLadder: React.FC<CodeChefRatingLadderProps> = ({
    currentRating,
    currentTier,
    className = "",
}) => {
    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.08]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
                    RANK
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
                    RATING
                </span>
            </div>

            <div className="divide-y divide-black/[0.04] space-y-1">
                {CODECHEF_RANKS.map((rank: CodeChefRankDefinition) => {
                    const isCurrent =
                        (typeof currentRating === "number" &&
                            currentRating >= rank.minRating &&
                            currentRating <= rank.maxRating) ||
                        (Boolean(currentTier) &&
                            (currentTier?.includes(String(rank.stars)) ||
                                rank.name === currentTier));

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
                                <CodeChefBadge
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

            {/* Official Divisions Breakdown */}
            <div className="pt-2 border-t border-black/[0.06] space-y-1.5 text-xs">
                <div className="font-bold text-neutral-900 mb-1">Divisions</div>
                <div className="space-y-1 text-neutral-600 font-mono text-[11px]">
                    {CODECHEF_DIVISIONS.map((div) => (
                        <div key={div.division} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                            <strong className="font-semibold text-neutral-900">{div.division}:</strong>
                            <span>{div.range}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CodeChefRatingLadder;
