import React from "react";
import { CODEFORCES_RANKS, type CodeforcesRankDefinition } from "../utils/codeforcesRanks";
import { CodeforcesBadge } from "./CodeforcesBadge";

export interface CodeforcesRatingLadderProps {
    currentRating?: number | null;
    currentTier?: string | null;
    className?: string;
}

/**
 * Renders the full 10-tier Codeforces Contest Rating Badges Ladder
 * Matching the exact colors, typography, and badges from the official reference.
 */
export const CodeforcesRatingLadder: React.FC<CodeforcesRatingLadderProps> = ({
    currentRating,
    currentTier,
    className = "",
}) => {
    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center justify-between pb-1 border-b border-black/[0.08]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Rank Badge
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    Contest Rating
                </span>
            </div>

            <div className="divide-y divide-black/[0.04] space-y-1">
                {CODEFORCES_RANKS.map((rank: CodeforcesRankDefinition) => {
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
                                <CodeforcesBadge
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
                            <span className="text-xs font-semibold text-neutral-700">
                                {rank.ratingRangeLabel}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CodeforcesRatingLadder;
