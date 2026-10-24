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
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <ListOrdered className="w-5 h-5 text-black" />
                        </div>
                        <h3 id="recently-solved-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
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
                                        <div className="w-6 h-6 rounded-md bg-neutral-200 border border-black/20" />
                                        <div className="w-56 sm:w-80 h-4 bg-neutral-200 rounded-full" />
                                    </div>
                                    <div className="w-14 h-4 bg-neutral-100 rounded-full" />
                                </div>
                            ))}
                        </div>
                    ) : list.length === 0 ? (
                        <div className="py-16 text-center max-w-xs mx-auto space-y-2">
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                No recently solved problems found on connected accounts.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-black/10">
                            {list.slice(0, 8).map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => handleOpenProblem(item.url)}
                                    className="py-3 px-3 -mx-2 rounded-xl group hover:bg-[#FAF6EE] border-2 border-transparent hover:border-black transition-all cursor-pointer flex items-center justify-between gap-3 hover:shadow-[2px_2px_0px_#000]"
                                    title={`View problem on ${item.platformName}`}
                                >
                                    {/* Left: Platform Icon + Problem Title */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-white border-2 border-black shadow-[1px_1px_0px_#000] p-1 flex items-center justify-center flex-shrink-0">
                                            {getPortalIcon(item.portal, "w-full h-full object-contain")}
                                        </div>
                                        <span className="text-sm sm:text-base font-black text-black group-hover:underline transition-colors truncate max-w-[240px] sm:max-w-[420px]">
                                            {item.title}
                                        </span>
                                    </div>

                                    {/* Right: Relative Time */}
                                    <span className="text-xs sm:text-sm text-black flex-shrink-0 font-bold font-mono bg-[#FAF6EE] border border-black px-2 py-0.5 rounded shadow-[1px_1px_0px_#000]">
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
