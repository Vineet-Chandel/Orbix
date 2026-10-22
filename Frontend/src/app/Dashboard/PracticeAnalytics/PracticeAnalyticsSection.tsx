import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector, fetchPracticeAnalytics } from "../../../store";
import { ProblemsSolvedCard } from "./ProblemsSolvedCard";
import { RecentlySolvedCard } from "./RecentlySolvedCard";
import { DsaTopicAnalysisCard } from "./DsaTopicAnalysisCard";
import { TopicStrengthCard } from "./TopicStrengthCard";
import { BadgesCard } from "../BadgesCard";

interface PracticeAnalyticsSectionProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

export const PracticeAnalyticsSection: React.FC<PracticeAnalyticsSectionProps> = ({
    connectedPortals,
    username,
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();
    const dispatch = useAppDispatch();

    const data = useAppSelector((state) => (effectiveUser ? state.practiceAnalytics.dataByUser[effectiveUser] : undefined));
    const isLoading = useAppSelector((state) => (effectiveUser ? state.practiceAnalytics.loadingByUser[effectiveUser] || false : false));

    useEffect(() => {
        if (!effectiveUser) return;
        if (!data && !isLoading) {
            dispatch(fetchPracticeAnalytics({ username: effectiveUser, portals: connectedPortals }));
        }
    }, [effectiveUser, connectedPortals, data, isLoading, dispatch]);

    return (
        <section
            aria-label="Practice Analytics Section"
            className="w-full rounded-3xl bg-white border border-neutral-300 text-neutral-900 p-6 sm:p-8 shadow-sm relative overflow-hidden select-none font-sans"
        >
            <div className="relative z-10 space-y-8">
                {/* Row 1: Topic strength (left) & Recently solved (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col justify-between h-full">
                        <TopicStrengthCard data={data} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between h-full lg:border-l lg:border-neutral-300 lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-neutral-300">
                        <RecentlySolvedCard data={data} isLoading={isLoading} />
                    </div>
                </div>

                {/* Horizontal divider between Row 1 and Row 2 */}
                <div className="w-full h-px bg-neutral-200" />

                {/* Row 2: DSA topic analysis (left) & Problems solved (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col justify-between h-full">
                        <DsaTopicAnalysisCard data={data} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between h-full lg:border-l lg:border-neutral-300 lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-neutral-300">
                        <ProblemsSolvedCard data={data} isLoading={isLoading} />
                    </div>
                </div>

                {/* Horizontal divider between Row 2 and Row 3 (Badges) */}
                <div className="w-full h-px bg-neutral-200" />

                {/* Row 3: Badges Trophy Grid */}
                <div className="w-full pt-1">
                    <BadgesCard
                        connectedPortals={connectedPortals}
                        username={effectiveUser}
                        embedded={true}
                    />
                </div>
            </div>
        </section>
    );
};

export default PracticeAnalyticsSection;
