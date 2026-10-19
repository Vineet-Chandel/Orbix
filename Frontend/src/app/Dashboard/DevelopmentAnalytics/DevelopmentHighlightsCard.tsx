import React from "react";
import { GitBranch, Star, GitFork, ExternalLink } from "lucide-react";
import type { DevelopmentRepoItem } from "../../../store/developmentAnalyticsSlice";

interface DevelopmentHighlightsCardProps {
    repositories?: DevelopmentRepoItem[];
    githubHandle?: string;
    isLoading?: boolean;
}

export const DevelopmentHighlightsCard: React.FC<DevelopmentHighlightsCardProps> = ({
    repositories,
    githubHandle = "",
    isLoading = false,
}) => {
    const repos = repositories && repositories.length > 0 ? repositories.slice(0, 3) : [];

    return (
        <div className="w-full text-white select-none flex flex-col justify-between h-full">
            {/* Top Header */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-indigo-400 shadow-sm flex-shrink-0">
                        <GitBranch className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight leading-none">
                            Top Repositories
                        </h3>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                            Public projects & starred codebases
                        </p>
                    </div>
                </div>

                {githubHandle && (
                    <a
                        href={`https://github.com/${githubHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161b22] border border-[#30363d] hover:border-neutral-600 text-xs font-mono font-medium text-neutral-300 hover:text-white transition-all"
                    >
                        <span>@{githubHandle}</span>
                        <ExternalLink className="w-3 h-3 text-neutral-400" />
                    </a>
                )}
            </div>

            {/* Repositories List / Loading / Empty State */}
            {isLoading && repos.length === 0 ? (
                <div className="space-y-3 mt-4">
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 animate-pulse py-2">
                            <div className="space-y-1.5 flex-1">
                                <div className="w-36 h-3.5 bg-white/[0.08] rounded-md" />
                                <div className="w-52 h-2.5 bg-white/[0.04] rounded-md" />
                            </div>
                            <div className="w-12 h-3 bg-white/[0.06] rounded-md" />
                        </div>
                    ))}
                </div>
            ) : repos.length === 0 ? (
                <div className="py-10 text-center max-w-xs mx-auto space-y-2">
                    <p className="text-xs text-neutral-400">
                        {githubHandle
                            ? `No public repositories found for @${githubHandle}.`
                            : "Connect GitHub in Developer Profile to showcase your repositories."}
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-white/[0.06] mt-4 space-y-2">
                    {repos.map((repo, idx) => (
                        <div
                            key={idx}
                            className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <a
                                        href={repo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-bold text-white hover:text-indigo-300 transition-colors truncate"
                                    >
                                        {repo.name}
                                    </a>
                                    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 font-medium">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: repo.languageColor }}
                                        />
                                        <span>{repo.language}</span>
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-400 truncate mt-0.5">
                                    {repo.description || "No description provided"}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0 text-xs font-mono text-neutral-400">
                                <span className="flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{repo.stars}</span>
                                </span>
                                {repo.forks > 0 && (
                                    <span className="flex items-center gap-1">
                                        <GitFork className="w-3.5 h-3.5 text-neutral-500" />
                                        <span>{repo.forks}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
