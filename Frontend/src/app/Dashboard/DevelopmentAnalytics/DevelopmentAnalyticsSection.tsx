import React, { useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../../store";
import {
    fetchDevelopmentAnalytics,
    clearDevelopmentAnalyticsCache,
} from "../../../store/developmentAnalyticsSlice";
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
            className="w-full rounded-3xl bg-black border border-neutral-800 text-white p-6 sm:p-8 shadow-2xl relative overflow-hidden select-none font-sans"
        >
            {/* Ambient Lighting Glows */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/[0.04] rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
                {/* Languages (left) & Top Repositories (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col justify-between">
                        <LanguagesCard languages={data?.languages} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between lg:border-l lg:border-white/[0.08] lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-white/[0.08]">
                        <DevelopmentHighlightsCard
                            repositories={data?.topRepositories}
                            githubHandle={data?.githubHandle || githubHandle}
                            isLoading={isLoading}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};
