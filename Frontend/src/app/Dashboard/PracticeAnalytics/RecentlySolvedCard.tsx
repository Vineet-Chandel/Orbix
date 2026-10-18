import React from "react";
import { ListOrdered } from "lucide-react";
import { type PracticeAnalyticsData } from "../../../store";
import { getPortalIcon } from "../../../utils/portalIcons";

interface RecentlySolvedCardProps {
    data?: PracticeAnalyticsData | null;
    isLoading?: boolean;
}

export const RecentlySolvedCard: React.FC<RecentlySolvedCardProps> = ({ data, isLoading }) => {
    const list = data?.recentlySolved || [];

    const handleOpenProblem = (url?: string) => {
        if (url && typeof window !== "undefined") {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    return (
        <div
            aria-labelledby="recently-solved-title"
            className="w-full text-white select-none flex flex-col justify-between h-full"
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-400 shadow-sm">
                            <ListOrdered className="w-4 h-4 text-amber-400" />
                        </div>
                        <h3 id="recently-solved-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                            Recently solved
                        </h3>
                    </div>
                </div>

                {/* Content: List of solved problems */}
                <div className="pt-3 relative z-10 min-h-[320px]">
                    {isLoading && list.length === 0 ? (
                        <div className="space-y-4 pt-2">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="flex items-center justify-between animate-pulse py-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-md bg-white/[0.08]" />
                                        <div className="w-48 sm:w-64 h-3 bg-white/[0.08] rounded-full" />
                                    </div>
                                    <div className="w-10 h-3 bg-white/[0.06] rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : list.length === 0 ? (
                        <div className="py-16 text-center max-w-xs mx-auto space-y-2">
                            <p className="text-xs text-neutral-400">
                                No recently solved problems found on connected accounts.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {list.slice(0, 8).map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleOpenProblem(item.url)}
                                    className="py-2.5 px-2 -mx-2 rounded-xl group hover:bg-white/[0.03] transition-all cursor-pointer flex items-center justify-between gap-3"
                                    title={`View problem on ${item.platformName}`}
                                >
                                    {/* Left: Platform Icon + Problem Title */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getPortalIcon(item.portal, "w-4 h-4 object-contain")}
                                        </div>
                                        <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-amber-400 transition-colors truncate max-w-[220px] sm:max-w-[340px]">
                                            {item.title}
                                        </span>
                                    </div>

                                    {/* Right: Relative Time */}
                                    <span className="text-[11px] sm:text-xs text-neutral-400 flex-shrink-0 font-medium font-mono">
                                        {item.relativeTime}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecentlySolvedCard;
