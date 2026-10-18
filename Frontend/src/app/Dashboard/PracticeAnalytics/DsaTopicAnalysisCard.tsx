import React from "react";
import { ListFilter } from "lucide-react";
import { type PracticeAnalyticsData } from "../../../store";

interface DsaTopicAnalysisCardProps {
    data?: PracticeAnalyticsData | null;
    isLoading?: boolean;
}

export const DsaTopicAnalysisCard: React.FC<DsaTopicAnalysisCardProps> = ({ data, isLoading }) => {
    const topics = data?.dsaTopics || [];
    const maxCount = topics.length > 0 ? Math.max(...topics.map((t) => t.count)) : 1145;

    return (
        <section
            aria-labelledby="dsa-topic-analysis-title"
            className="w-full rounded-3xl bg-[#0c1017] text-white p-6 sm:p-7 border border-neutral-800 shadow-2xl relative overflow-hidden select-none flex flex-col justify-between"
        >
            {/* Ambient glow */}
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-amber-400 shadow-sm">
                            <ListFilter className="w-4 h-4 text-amber-400" />
                        </div>
                        <h3 id="dsa-topic-analysis-title" className="text-base sm:text-lg font-black text-white tracking-tight">
                            DSA topic analysis
                        </h3>
                    </div>
                </div>

                {/* Body: Horizontal Topic Bars */}
                <div className="pt-4 relative z-10 space-y-2.5">
                    {isLoading && topics.length === 0 ? (
                        <div className="space-y-3 pt-2">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="flex items-center gap-3 animate-pulse">
                                    <div className="w-28 h-3 bg-white/[0.08] rounded-full" />
                                    <div className="flex-1 h-5 bg-white/[0.04] rounded-md" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        topics.slice(0, 10).map((item) => {
                            const barPercent = Math.max(12, Math.round((item.count / maxCount) * 100));

                            return (
                                <div key={item.topic} className="flex items-center gap-3">
                                    {/* Topic Label */}
                                    <span className="w-32 sm:w-36 text-xs sm:text-sm font-semibold text-neutral-300 text-right truncate flex-shrink-0">
                                        {item.topic}
                                    </span>

                                    {/* Bar Track */}
                                    <div className="flex-1 h-5 sm:h-5.5 bg-[#141b25] border border-white/[0.04] rounded-md overflow-hidden relative flex items-center">
                                        {/* Yellow Filled Bar */}
                                        <div
                                            className="h-full bg-[#facc15] rounded-md flex items-center justify-end px-2 transition-all duration-700 select-none shadow-xs"
                                            style={{ width: `${barPercent}%` }}
                                        >
                                            <span className="text-[10px] sm:text-[11px] font-black text-black font-mono leading-none">
                                                {item.count.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </section>
    );
};

export default DsaTopicAnalysisCard;
