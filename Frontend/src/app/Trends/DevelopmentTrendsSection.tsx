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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06]">
                <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl" role="img" aria-label="Rocket">
                        🚀
                    </span>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
                            Development & Engineering Trends
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Repository impact, multi-language codebase distribution, and open-source velocity
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                    {/* GitHub Handle Pill */}
                    {data?.githubHandle && (
                        <a
                            href={`https://github.com/${data.githubHandle}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] border border-black/10 text-xs font-semibold text-neutral-800 hover:text-black transition-all shadow-2xs"
                        >
                            <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
                            <span>@{data.githubHandle}</span>
                            <ExternalLink className="w-3 h-3 text-neutral-400" />
                        </a>
                    )}

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                        title="Sync real-time GitHub metrics"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-white" : ""}`} />
                        <span>{isLoading ? "Syncing..." : "Sync"}</span>
                    </button>
                </div>
            </div>

            {/* Development Metrics Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Total Contributions
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {data?.contributions !== undefined ? data.contributions.toLocaleString() : "—"}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">commits & PRs</span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Public Repositories
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {data?.repos !== undefined ? data.repos : "—"}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">active projects</span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Stars Earned
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {data?.stars !== undefined ? data.stars : "—"}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">stargazers</span>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        Followers
                    </span>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                            {data?.followers !== undefined ? data.followers : "—"}
                        </span>
                        <span className="text-xs text-neutral-500 font-medium">developers</span>
                    </div>
                </div>
            </div>

            {/* Highlights: Most Starred & Latest Work */}
            {(data?.mostStarred || data?.latestWork) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.mostStarred && (
                        <div className="p-5 rounded-3xl bg-black/[0.02] border border-black/[0.06] hover:border-black/10 transition-all flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800 bg-black/[0.04] px-2.5 py-1 rounded-full border border-black/10">
                                    <Star className="w-3.5 h-3.5 fill-neutral-700 text-neutral-700" />
                                    <span>Most Starred Project</span>
                                </span>
                                <span className="text-xs font-mono text-neutral-500">★ {data.mostStarred.stars} stars</span>
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-neutral-900 tracking-tight">{data.mostStarred.name}</h4>
                            </div>
                            <a
                                href={data.mostStarred.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-black transition-colors"
                            >
                                <span>Inspect repository</span>
                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </a>
                        </div>
                    )}

                    {data.latestWork && (
                        <div className="p-5 rounded-3xl bg-black/[0.02] border border-black/[0.06] hover:border-black/10 transition-all flex flex-col justify-between space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800 bg-black/[0.04] px-2.5 py-1 rounded-full border border-black/10">
                                    <Clock className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Latest Commit & Push</span>
                                </span>
                                <span className="text-xs font-mono text-neutral-500">{data.latestWork.relativeTime}</span>
                            </div>
                            <div>
                                <h4 className="text-base font-bold text-neutral-900 tracking-tight">{data.latestWork.name}</h4>
                            </div>
                            <a
                                href={data.latestWork.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-black transition-colors"
                            >
                                <span>View latest commit</span>
                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Language Breakdown */}
            {languages.length > 0 && (
                <div className="p-6 rounded-3xl bg-white border border-black/[0.06] text-neutral-900 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-neutral-800" />
                            <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight">
                                Language Distribution & Codebase Breakdown
                            </h3>
                        </div>
                        <span className="text-xs text-neutral-500 font-mono">by source size</span>
                    </div>

                    {/* Multi-segment progress bar */}
                    <div className="w-full h-3 rounded-full bg-black/[0.06] flex overflow-hidden p-0.5 gap-0.5">
                        {languages.map((l, idx) => (
                            <div
                                key={idx}
                                style={{
                                    width: `${l.percentage}%`,
                                    backgroundColor: l.color || "#737373",
                                }}
                                className="h-full rounded-sm transition-all hover:opacity-80"
                                title={`${l.name}: ${l.percentage}%`}
                            />
                        ))}
                    </div>

                    {/* Language chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                        {languages.map((l, idx) => (
                            <div
                                key={idx}
                                className="p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.06] flex flex-col justify-between"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-2xs"
                                        style={{ backgroundColor: l.color || "#737373" }}
                                    />
                                    <span className="text-xs font-bold text-neutral-900 truncate">{l.name}</span>
                                </div>
                                <div className="mt-1 flex items-baseline justify-between text-[11px] text-neutral-500 font-mono">
                                    <span>{l.percentage}%</span>
                                    <span className="text-[10px] text-neutral-400">{l.formattedSize || `${Math.round(l.bytes / 1024)} KB`}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Repositories Grid */}
            {repos.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight">
                            Key Open-Source Repositories
                        </h3>
                        <span className="text-xs text-neutral-500">{repos.length} highlighted</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {repos.map((repo, idx) => (
                            <div
                                key={idx}
                                className="p-5 rounded-3xl bg-white border border-black/[0.06] hover:border-black/10 transition-all flex flex-col justify-between space-y-3 shadow-xs"
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <a
                                            href={repo.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm font-bold text-neutral-900 hover:text-black transition-colors inline-flex items-center gap-1.5"
                                        >
                                            <span>{repo.name}</span>
                                            <ExternalLink className="w-3 h-3 text-neutral-400" />
                                        </a>
                                        <span className="text-xs font-mono text-neutral-500">★ {repo.stars}</span>
                                    </div>
                                    <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                                        {repo.description || "Public repository and developer tools"}
                                    </p>
                                </div>

                                <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 border-t border-black/[0.06]">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: repo.languageColor || "#737373" }}
                                        />
                                        <span className="font-semibold text-neutral-800">{repo.language}</span>
                                    </div>
                                    <span className="text-neutral-400 text-[11px] font-mono">{repo.forks} forks</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
