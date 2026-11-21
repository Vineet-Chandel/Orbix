import React from "react";
import { motion } from "framer-motion";
import { ListFilter } from "lucide-react";
import { type PracticeAnalyticsData } from "../../../store";

interface DsaTopicAnalysisCardProps {
    data?: PracticeAnalyticsData | null;
    isLoading?: boolean;
}

export const DsaTopicAnalysisCard: React.FC<DsaTopicAnalysisCardProps> = ({ data, isLoading }) => {
    const topics = data?.dsaTopics || [];
    const maxCount = topics.length > 0 ? Math.max(...topics.map((t) => t.count)) : 1;

    return (
        <div
            aria-labelledby="dsa-topic-analysis-title"
            className="w-full text-neutral-900 select-none flex flex-col justify-between h-full"
        >
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                            <ListFilter className="w-5 h-5 text-black" />
                        </div>
                        <h3 id="dsa-topic-analysis-title" className="text-lg sm:text-xl font-black text-black tracking-tight">
                            DSA topic analysis
                        </h3>
                    </div>
                </div>

                {/* Body: Horizontal Topic Bars */}
                <div className="pt-5 relative z-10 space-y-3.5 sm:space-y-4">
                    {isLoading && topics.length === 0 ? (
                        <div className="space-y-3 pt-2">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="flex items-center gap-3.5 animate-pulse">
                                    <div className="w-32 sm:w-44 h-5 bg-neutral-200 rounded-full" />
                                    <div className="flex-1 h-10 sm:h-11 bg-neutral-100 rounded-xl border border-black/20" />
                                </div>
                            ))}
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="py-12 text-center max-w-xs mx-auto space-y-2">
                            <p className="text-sm sm:text-base text-neutral-600 font-bold">
                                No topic data available yet on connected accounts.
                            </p>
                        </div>
                    ) : (
                        topics.slice(0, 10).map((item) => {
                            const barPercent = Math.max(12, Math.round((item.count / maxCount) * 100));

                            return (
                                <div key={item.topic} className="flex items-center gap-2.5 sm:gap-3.5">
                                    {/* Responsive Topic Label: fits down to 280px without squeezing the bar */}
                                    <span className="w-24 xs:w-32 sm:w-44 text-[11px] sm:text-xs md:text-sm font-black text-black text-right truncate shrink-0">
                                        {item.topic}
                                    </span>

                                    {/* Bar Track */}
                                    <div className="flex-1 min-w-[90px] h-9 sm:h-11 bg-[#FAF6EE] border-2 border-black rounded-xl overflow-hidden relative flex items-center shadow-[2px_2px_0px_#000]">
                                        {/* Filled Bar with Smooth Width Transition */}
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${barPercent}%` }}
                                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                            className="h-full bg-black rounded-lg flex items-center justify-end px-2.5 sm:px-3.5 select-none shadow-xs"
                                        >
                                            <span className="text-[11px] sm:text-xs md:text-sm font-black text-[#a2ff86] font-mono leading-none tracking-tight">
                                                {item.count.toLocaleString()}
                                            </span>
                                        </motion.div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default DsaTopicAnalysisCard;
