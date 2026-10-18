import React, { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../../store";
import {
    fetchDevelopmentAnalytics,
    clearDevelopmentAnalyticsCache,
} from "../../../store/developmentAnalyticsSlice";
import { DevelopmentMetricCards } from "./DevelopmentMetricCards";
import { LanguagesCard } from "./LanguagesCard";
import { DevelopmentHighlightsCard } from "./DevelopmentHighlightsCard";

interface DevelopmentAnalyticsSectionProps {
    connectedPortals?: Record<string, any>;
    username?: string;
}

export const DevelopmentAnalyticsSection: React.FC<DevelopmentAnalyticsSectionProps> = ({
    connectedPortals,
    username = "vineet_chandel",
}) => {
    const effectiveUser = (username || "vineet_chandel").trim();
    const dispatch = useAppDispatch();

    const gh = connectedPortals?.github || connectedPortals?.GitHub || connectedPortals?.Github;
    const githubHandle = useMemo(() => {
        if (typeof gh === "object" && gh) {
            return (gh.username || gh.portal_username || gh.handle || "").trim();
        }
        if (typeof gh === "string") {
            return gh.trim();
        }
        return "Vineet-Chandel";
    }, [gh]);

    const data = useAppSelector((state) => state.developmentAnalytics.dataByUser[effectiveUser]);
    const isLoading = useAppSelector(
        (state) => state.developmentAnalytics.loadingByUser[effectiveUser] || false
    );

    const prevHandleRef = useRef<string | null>(null);

    useEffect(() => {
        if (!effectiveUser) return;

        if (prevHandleRef.current === null) {
            prevHandleRef.current = githubHandle;
            dispatch(
                fetchDevelopmentAnalytics({
                    username: effectiveUser,
                    githubHandle,
                    portals: connectedPortals,
                })
            );
        } else if (prevHandleRef.current !== githubHandle) {
            prevHandleRef.current = githubHandle;
            dispatch(clearDevelopmentAnalyticsCache(effectiveUser));
            dispatch(
                fetchDevelopmentAnalytics({
                    username: effectiveUser,
                    githubHandle,
                    force: true,
                    portals: connectedPortals,
                })
            );
        }
    }, [effectiveUser, githubHandle, connectedPortals, dispatch]);

    return (
        <section
            aria-label="Development Analytics"
            className="w-full space-y-4 sm:space-y-6 font-sans select-none"
        >
            {/* Top Stat Blocks: Contributions, Repos, Stars, Followers */}
            <DevelopmentMetricCards data={data} isLoading={isLoading} />

            {/* Bottom Row: Languages by Code Size & Top Repositories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                <LanguagesCard languages={data?.languages} isLoading={isLoading} />
                <DevelopmentHighlightsCard
                    repositories={data?.topRepositories}
                    githubHandle={data?.githubHandle || githubHandle}
                    isLoading={isLoading}
                />
            </div>
        </section>
    );
};
