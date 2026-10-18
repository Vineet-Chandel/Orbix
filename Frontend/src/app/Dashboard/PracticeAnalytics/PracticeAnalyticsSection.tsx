import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector, fetchPracticeAnalytics } from "../../../store";
import { ProblemsSolvedCard } from "./ProblemsSolvedCard";
import { RecentlySolvedCard } from "./RecentlySolvedCard";
import { DsaTopicAnalysisCard } from "./DsaTopicAnalysisCard";
import { TopicStrengthCard } from "./TopicStrengthCard";

interface PracticeAnalyticsSectionProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

export const PracticeAnalyticsSection: React.FC<PracticeAnalyticsSectionProps> = ({
    connectedPortals,
    username = "vineet_chandel",
}) => {
    const effectiveUser = (username || "vineet_chandel").trim();
    const dispatch = useAppDispatch();

    const data = useAppSelector((state) => state.practiceAnalytics.dataByUser[effectiveUser]);
    const isLoading = useAppSelector((state) => state.practiceAnalytics.loadingByUser[effectiveUser] || false);

    useEffect(() => {
        if (!data && !isLoading) {
            dispatch(fetchPracticeAnalytics({ username: effectiveUser, portals: connectedPortals }));
        }
    }, [effectiveUser, connectedPortals, data, isLoading, dispatch]);

    return (
        <section
            aria-label="Practice Analytics Section"
            className="w-full rounded-3xl bg-black border border-neutral-800 text-white p-6 sm:p-8 shadow-2xl relative overflow-hidden select-none font-sans"
        >
            {/* Ambient Lighting Glows */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/[0.04] rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-8">
                {/* Row 1: Problems solved (left) & Recently solved (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col justify-between">
                        <ProblemsSolvedCard data={data} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between lg:border-l lg:border-white/[0.08] lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-white/[0.08]">
                        <RecentlySolvedCard data={data} isLoading={isLoading} />
                    </div>
                </div>

                {/* Horizontal divider between Row 1 and Row 2 */}
                <div className="w-full h-px bg-white/[0.08]" />

                {/* Row 2: DSA topic analysis (~65%) & Topic strength radar (~35%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    <div className="lg:col-span-8 flex flex-col justify-between">
                        <DsaTopicAnalysisCard data={data} isLoading={isLoading} />
                    </div>
                    <div className="lg:col-span-4 flex flex-col justify-between lg:border-l lg:border-white/[0.08] lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-white/[0.08]">
                        <TopicStrengthCard data={data} isLoading={isLoading} />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PracticeAnalyticsSection;
