import React, { useMemo } from "react";
import {
    GitBranch,
    Star,
    Code2,
    ExternalLink,
    RefreshCw,
    Clock,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../store";
import {
    fetchDevelopmentAnalytics,
    clearDevelopmentAnalyticsCache,
} from "../../store/developmentAnalyticsSlice";

interface DevelopmentTrendsSectionProps {
    connectedPortals: Record<string, any>;
    username?: string;
}

export const DevelopmentTrendsSection: React.FC<DevelopmentTrendsSectionProps> = ({
    connectedPortals,
    username = "",
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
                const cleaned = authUser.github
                    .replace(/https?:\/\/(www\.)?github\.com\//i, "")
                    .replace(/\/.*$/, "")
                    .trim();
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

    const handleRefresh = () => {
        if (!effectiveUser) return;
        dispatch(clearDevelopmentAnalyticsCache(effectiveUser));
        dispatch(
            fetchDevelopmentAnalytics({
                username: effectiveUser,
                githubHandle,
                force: true,
                portals: connectedPortals,
            })
        );
    };

    const languages = data?.languages || [];
    const repos = data?.topRepositories || [];

    return (
        <div className="space-y-6">
            {/* Top Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="text-xl leading-none" role="img" aria-label="Rocket">
                            🚀
                        </span>
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                            Development & Engineering Trends
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-0.5">
                            Repository impact, multi-language codebase distribution, and open-source velocity
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                    {/* GitHub Handle Pill */}
                    {data?.githubHandle && (
                        <a
                            href={`https://github.com/${data.githubHandle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#FFE566] border-2 border-black text-xs font-black text-black transition-all shadow-[2px_2px_0px_#000]"
                        >
                            <GitBranch className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>@{data.githubHandle}</span>
                            <ExternalLink className="w-3 h-3 stroke-[2.5] text-neutral-600" />
                        </a>
                    )}

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black transition-all cursor-pointer disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5"
                        title="Sync real-time GitHub metrics"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isLoading ? "animate-spin text-[#a2ff86]" : ""}`} />
                        <span>{isLoading ? "Syncing..." : "Sync"}</span>
                    </button>
                </div>
            </div>

            {/* Development Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                    <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                        Total Contributions
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {data?.contributions !== undefined ? data.contributions.toLocaleString() : "—"}
                        </span>
                        <span className="text-xs text-neutral-600 font-bold">commits & PRs</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                    <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                        Public Repositories
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {data?.repos !== undefined ? data.repos : "—"}
                        </span>
                        <span className="text-xs text-neutral-600 font-bold">active projects</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                    <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                        Stars Earned
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {data?.stars !== undefined ? data.stars : "—"}
                        </span>
                        <span className="text-xs text-neutral-600 font-bold">stargazers</span>
                    </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-2">
                    <span className="text-xs font-black text-neutral-600 uppercase tracking-wider">
                        Followers
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-black font-mono">
                            {data?.followers !== undefined ? data.followers : "—"}
                        </span>
                        <span className="text-xs text-neutral-600 font-bold">developers</span>
                    </div>
                </div>
            </div>

            {/* Highlights: Most Starred & Latest Work */}
            {(data?.mostStarred || data?.latestWork) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.mostStarred && (
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-black bg-[#FFE566] px-3 py-1 rounded-md border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Star className="w-3.5 h-3.5 fill-black text-black stroke-[2.5]" />
                                    <span>Most Starred Project</span>
                                </span>
                                <span className="text-xs font-mono font-black text-black bg-[#FAF6EE] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                                    ★ {data.mostStarred.stars} stars
                                </span>
                            </div>
                            <div>
                                <h4 className="text-base font-black text-black tracking-tight">{data.mostStarred.name}</h4>
                            </div>
                            <a
                                href={data.mostStarred.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-black text-black px-3 py-1.5 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-[#a2ff86] transition-all self-start"
                            >
                                <span>Inspect repository</span>
                                <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                            </a>
                        </div>
                    )}

                    {data.latestWork && (
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-black text-black bg-[#a2ff86] px-3 py-1 rounded-md border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Latest Commit & Push</span>
                                </span>
                                <span className="text-xs font-mono font-black text-black bg-[#FAF6EE] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                                    {data.latestWork.relativeTime}
                                </span>
                            </div>
                            <div>
                                <h4 className="text-base font-black text-black tracking-tight">{data.latestWork.name}</h4>
                            </div>
                            <a
                                href={data.latestWork.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-black text-black px-3 py-1.5 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-[#a2ff86] transition-all self-start"
                            >
                                <span>View latest commit</span>
                                <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Language Breakdown */}
            {languages.length > 0 && (
                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]">
                                <Code2 className="w-4 h-4 text-black stroke-[2.5]" />
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                Language Distribution & Codebase Breakdown
                            </h3>
                        </div>
                        <span className="text-xs text-black font-mono font-black bg-[#FAF6EE] px-2.5 py-1 rounded-md border border-black shadow-[1px_1px_0px_#000]">
                            by source size
                        </span>
                    </div>

                    {/* Multi-segment progress bar */}
                    <div className="w-full h-4 rounded-lg bg-[#FAF6EE] border-2 border-black flex overflow-hidden p-0.5 gap-0.5 shadow-[2px_2px_0px_#000]">
                        {languages.map((l, idx) => (
                            <div
                                key={idx}
                                style={{
                                    width: `${l.percentage}%`,
                                    backgroundColor: l.color || "#737373",
                                }}
                                className="h-full rounded-xs transition-all hover:opacity-80"
                                title={`${l.name}: ${l.percentage}%`}
                            />
                        ))}
                    </div>

                    {/* Language chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                        {languages.map((l, idx) => (
                            <div
                                key={idx}
                                className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-3 h-3 rounded-full flex-shrink-0 border border-black"
                                        style={{ backgroundColor: l.color || "#737373" }}
                                    />
                                    <span className="text-xs font-black text-black truncate">{l.name}</span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between text-xs text-black font-mono font-black">
                                    <span>{l.percentage}%</span>
                                    <span className="text-[10px] text-neutral-600 font-bold">{l.formattedSize || `${Math.round(l.bytes / 1024)} KB`}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Repositories Grid */}
            {repos.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                            Key Open-Source Repositories
                        </h3>
                        <span className="text-xs font-mono font-black bg-[#FAF6EE] px-2.5 py-1 rounded-md border border-black shadow-[1px_1px_0px_#000]">
                            {repos.length} highlighted
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {repos.map((repo, idx) => (
                            <div
                                key={idx}
                                className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between space-y-3"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-black text-black hover:text-neutral-700 transition-colors inline-flex items-center gap-1.5"
                                        >
                                            <span>{repo.name}</span>
                                            <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </a>
                                        <span className="text-xs font-mono font-black text-black bg-[#FFE566] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                                            ★ {repo.stars}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-neutral-700 leading-relaxed line-clamp-2">
                                        {repo.description || "Public repository and developer tools"}
                                    </p>
                                </div>

                                <div className="pt-2 flex items-center justify-between text-xs text-neutral-700 border-t-2 border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full border border-black"
                                            style={{ backgroundColor: repo.languageColor || "#737373" }}
                                        />
                                        <span className="font-black text-black">{repo.language}</span>
                                    </div>
                                    <span className="text-neutral-600 text-xs font-mono font-black">{repo.forks} forks</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
