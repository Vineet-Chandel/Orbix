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
        <div className="w-full space-y-6">
            {/* Row 1: Problems solved (left) & Recently solved (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <ProblemsSolvedCard data={data} isLoading={isLoading} />
                <RecentlySolvedCard data={data} isLoading={isLoading} />
            </div>

            {/* Row 2: DSA topic analysis (~65%) & Topic strength radar (~35%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8">
                    <DsaTopicAnalysisCard data={data} isLoading={isLoading} />
                </div>
                <div className="lg:col-span-4">
                    <TopicStrengthCard data={data} isLoading={isLoading} />
                </div>
            </div>
        </div>
    );
};

export default PracticeAnalyticsSection;
