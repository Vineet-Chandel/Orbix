import React, { useEffect } from "react";
import { useAppDispatch, useAppSelector, fetchPracticeAnalytics } from "../../../store";
import { ProblemsSolvedCard } from "./ProblemsSolvedCard";
import { RecentlySolvedCard } from "./RecentlySolvedCard";
import { DsaTopicAnalysisCard } from "./DsaTopicAnalysisCard";
import { TopicStrengthCard } from "./TopicStrengthCard";
import { BadgesCard } from "../BadgesCard";
import { isDemoProfileUsername, demoPracticeAnalytics } from "../../../data/demoProfileData";

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
    const isDemo = isDemoProfileUsername(effectiveUser);
    const dispatch = useAppDispatch();

    const reduxData = useAppSelector((state) => (effectiveUser ? state.practiceAnalytics.dataByUser[effectiveUser] : undefined));
    const reduxLoading = useAppSelector((state) => (effectiveUser ? (state.practiceAnalytics.loadingByUser[effectiveUser] && !state.practiceAnalytics.dataByUser[effectiveUser]) || false : false));

    const data = isDemo ? demoPracticeAnalytics : reduxData;
    const isLoading = isDemo ? false : reduxLoading;

    useEffect(() => {
        if (!effectiveUser || isDemo) return;
        if (!data && !isLoading) {
            dispatch(fetchPracticeAnalytics({ username: effectiveUser, portals: connectedPortals }));
        }
    }, [effectiveUser, connectedPortals, data, isLoading, dispatch, isDemo]);

    return (
        <section
            aria-label="Practice Analytics Section"
            className="w-full rounded-2xl bg-white border-2 border-black text-neutral-900 p-4 sm:p-8 shadow-[4px_4px_0px_#000] relative overflow-hidden select-none font-sans"
        >
            <div className="relative z-10 space-y-6 sm:space-y-8">
                {/* Row 1: Topic strength (left) & Recently solved (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
                    <div className="flex flex-col justify-between h-full">
                        <TopicStrengthCard data={data} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between h-full lg:border-l-2 lg:border-black/15 lg:pl-8 pt-6 lg:pt-0 border-t-2 lg:border-t-0 border-black/15">
                        <RecentlySolvedCard data={data} isLoading={isLoading} />
                    </div>
                </div>

                {/* Horizontal divider between Row 1 and Row 2 */}
                <div className="w-full h-[2px] bg-black/15" />

                {/* Row 2: DSA topic analysis (left) & Problems solved (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
                    <div className="flex flex-col justify-between h-full">
                        <DsaTopicAnalysisCard data={data} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between h-full lg:border-l-2 lg:border-black/15 lg:pl-8 pt-6 lg:pt-0 border-t-2 lg:border-t-0 border-black/15">
                        <ProblemsSolvedCard data={data} isLoading={isLoading} />
                    </div>
                </div>

                {/* Horizontal divider between Row 2 and Row 3 (Badges) */}
                <div className="w-full h-[2px] bg-black/15" />

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
