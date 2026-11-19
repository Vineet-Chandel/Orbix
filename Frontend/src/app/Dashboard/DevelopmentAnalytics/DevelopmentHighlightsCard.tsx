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
        <div className="w-full text-black select-none flex flex-col justify-between h-full">
            {/* Top Header */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                        <GitBranch className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-black tracking-tight leading-none">
                            Top Repositories
                        </h3>
                        <p className="text-xs text-neutral-600 font-medium mt-0.5">
                            Public projects & starred codebases
                        </p>
                    </div>
                </div>

                {githubHandle && (
                    <a
                        href={`https://github.com/${githubHandle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6EE] border-2 border-black hover:bg-[#FFE566] text-xs font-mono font-black text-black transition-all shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5"
                    >
                        <span>@{githubHandle}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-black" />
                    </a>
                )}
            </div>

            {/* Repositories List / Loading / Empty State */}
            {isLoading && repos.length === 0 ? (
                <div className="space-y-3 mt-4">
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 animate-pulse p-3 bg-[#FAF6EE] border-2 border-black/20 rounded-xl">
                            <div className="space-y-1.5 flex-1">
                                <div className="w-36 h-4 bg-neutral-200 rounded-md" />
                                <div className="w-52 h-3 bg-neutral-100 rounded-md" />
                            </div>
                            <div className="w-12 h-3.5 bg-neutral-200 rounded-md" />
                        </div>
                    ))}
                </div>
            ) : repos.length === 0 ? (
                <div className="py-10 text-center max-w-xs mx-auto space-y-2">
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        {githubHandle
                            ? `No public repositories found for @${githubHandle}.`
                            : "Connect GitHub in Developer Profile to showcase your repositories."}
                    </p>
                </div>
            ) : (
                <div className="mt-4 space-y-2.5">
                    {repos.map((repo, idx) => (
                        <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-white transition-all flex items-center justify-between gap-3 group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <a
                                        href={repo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-black text-black hover:underline transition-colors truncate"
                                    >
                                        {repo.name}
                                    </a>
                                    <span className="inline-flex items-center gap-1 text-[11px] text-black font-bold">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full border border-black"
                                            style={{ backgroundColor: repo.languageColor }}
                                        />
                                        <span>{repo.language}</span>
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium truncate mt-0.5">
                                    {repo.description || "No description provided"}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0 text-xs font-mono">
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFE566] border border-black font-black text-black">
                                    <Star className="w-3 h-3 fill-black text-black" />
                                    <span>{repo.stars}</span>
                                </span>
                                {repo.forks > 0 && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-black font-black text-black">
                                        <GitFork className="w-3 h-3 text-black" />
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
