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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 w-full">
            {metrics.map((metric, idx) => (
                <div
                    key={idx}
                    className="relative group rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 p-5 sm:p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.5)] select-none"
                >
                    {/* Subtle top surface highlight */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />

                    {isLoading && !data ? (
                        <div className="animate-pulse space-y-2 flex flex-col items-center w-full">
                            <div className="h-8 w-16 bg-[#161b22] rounded-lg" />
                            <div className="h-3.5 w-20 bg-[#161b22] rounded" />
                        </div>
                    ) : (
                        <>
                            <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight font-sans block leading-none">
                                {metric.value}
                            </span>
                            <span className="text-xs sm:text-sm font-medium text-neutral-400 mt-2 sm:mt-2.5 tracking-normal">
                                {metric.label}
                            </span>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};
