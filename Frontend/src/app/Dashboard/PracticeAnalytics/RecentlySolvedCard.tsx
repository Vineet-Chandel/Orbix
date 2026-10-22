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
            className="w-full text-neutral-900 select-none flex flex-col justify-between h-full"
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-neutral-300 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/[0.04] border border-neutral-300 flex items-center justify-center text-neutral-900 shadow-2xs">
                            <ListOrdered className="w-5 h-5 text-neutral-800" />
                        </div>
                        <h3 id="recently-solved-title" className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
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
                                        <div className="w-6 h-6 rounded-md bg-neutral-200" />
                                        <div className="w-56 sm:w-80 h-4 bg-neutral-200 rounded-full" />
                                    </div>
                                    <div className="w-14 h-4 bg-neutral-100 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : list.length === 0 ? (
                        <div className="py-16 text-center max-w-xs mx-auto space-y-2">
                            <p className="text-xs sm:text-sm text-neutral-500">
                                No recently solved problems found on connected accounts.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-200">
                            {list.slice(0, 8).map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleOpenProblem(item.url)}
                                    className="py-3 sm:py-3.5 px-2.5 -mx-2.5 rounded-xl group hover:bg-neutral-100/70 transition-all cursor-pointer flex items-center justify-between gap-3"
                                    title={`View problem on ${item.platformName}`}
                                >
                                    {/* Left: Platform Icon + Problem Title */}
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                            {getPortalIcon(item.portal, "w-5 h-5 object-contain")}
                                        </div>
                                        <span className="text-sm sm:text-base font-bold text-neutral-900 group-hover:text-black transition-colors truncate max-w-[240px] sm:max-w-[420px]">
                                            {item.title}
                                        </span>
                                    </div>

                                    {/* Right: Relative Time */}
                                    <span className="text-xs sm:text-sm text-neutral-500 flex-shrink-0 font-semibold font-mono">
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
