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
    username,
}) => {
    const authUser = useAppSelector((state) => state.user.user);
    const effectiveUser = (username || authUser?.username || "").trim();
    const dispatch = useAppDispatch();

    const gh = connectedPortals?.github || connectedPortals?.GitHub || connectedPortals?.Github;
    const githubHandle = useMemo(() => {
        if (typeof gh === "object" && gh) {
            const h = (gh.username || gh.portal_username || gh.handle || "").trim();
            if (h) return h;
        }
        if (typeof gh === "string" && gh.trim()) {
            return gh.trim();
        }
        if (effectiveUser && effectiveUser === authUser?.username) {
            if (authUser?.github) {
                const cleaned = authUser.github.replace(/https?:\/\/(www\.)?github\.com\//i, "").replace(/\/.*$/, "").trim();
                if (cleaned) return cleaned;
            }
            if (authUser?.portals?.github?.username) {
                return authUser.portals.github.username.trim();
            }
        }
        return "";
    }, [gh, effectiveUser, authUser]);

    const data = useAppSelector((state) => (effectiveUser ? state.developmentAnalytics.dataByUser[effectiveUser] : undefined));
    const isLoading = useAppSelector(
        (state) => (effectiveUser ? state.developmentAnalytics.loadingByUser[effectiveUser] || false : false)
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
            className="w-full rounded-3xl bg-white border border-neutral-300 text-neutral-900 p-6 sm:p-8 shadow-sm relative overflow-hidden select-none font-sans"
        >
            <div className="relative z-10">
                {/* Languages (left) & Top Repositories (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                    <div className="flex flex-col justify-between h-full">
                        <LanguagesCard languages={data?.languages} isLoading={isLoading} />
                    </div>
                    <div className="flex flex-col justify-between h-full lg:border-l lg:border-neutral-300 lg:pl-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-neutral-300">
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
