import React from "react";
import type { DevelopmentAnalyticsData } from "../../../store/developmentAnalyticsSlice";

interface DevelopmentMetricCardsProps {
    data?: DevelopmentAnalyticsData | null;
    isLoading?: boolean;
}

export const DevelopmentMetricCards: React.FC<DevelopmentMetricCardsProps> = ({
    data,
    isLoading = false,
}) => {
    const contributions = data?.contributions ?? 219;
    const repos = data?.repos ?? 14;
    const stars = data?.stars ?? 45;
    const followers = data?.followers ?? 183;

    const metrics = [
        {
            value: contributions.toLocaleString(),
            label: "Contributions",
        },
        {
            value: repos.toLocaleString(),
            label: "Repos",
        },
        {
            value: stars.toLocaleString(),
            label: "Stars",
        },
        {
            value: followers.toLocaleString(),
            label: "Followers",
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.08] w-full">
            {metrics.map((metric, idx) => (
                <div
                    key={idx}
                    className="flex flex-col items-center justify-center text-center py-2 px-4 select-none"
                >
                    {isLoading && !data ? (
                        <div className="animate-pulse space-y-2 flex flex-col items-center w-full">
                            <div className="h-8 w-16 bg-white/[0.08] rounded-lg" />
                            <div className="h-3.5 w-20 bg-white/[0.06] rounded" />
                        </div>
                    ) : (
                        <>
                            <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight font-sans block leading-none">
                                {metric.value}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-neutral-400 mt-2 sm:mt-2.5 tracking-normal">
                                {metric.label}
                            </span>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};
