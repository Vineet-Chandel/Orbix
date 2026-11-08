import React from "react";
import {
    Star,
    GitFork,
    ExternalLink,
    Eye,
    Edit3,
    Trash2,
    ArrowUp,
    ArrowDown,
    Globe,
    CheckCircle2,
    Clock,
    Lock,
    RefreshCw,
    FileText,
} from "lucide-react";
import type { ProjectItem } from "../../types/project";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
);

interface ProjectCardProps {
    project: ProjectItem;
    isManageMode?: boolean;
    onViewDetails?: (project: ProjectItem) => void;
    onEdit?: (project: ProjectItem) => void;
    onDelete?: (project: ProjectItem) => void;
    onTogglePublish?: (project: ProjectItem) => void;
    onMoveUp?: (project: ProjectItem) => void;
    onMoveDown?: (project: ProjectItem) => void;
    onSync?: (project: ProjectItem) => void;
    isFirst?: boolean;
    isLast?: boolean;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
    project,
    isManageMode = false,
    onViewDetails,
    onEdit,
    onDelete,
    onTogglePublish,
    onMoveUp,
    onMoveDown,
    onSync,
    isFirst = false,
    isLast = false,
}) => {
    return (
        <div className="group relative rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all flex flex-col justify-between overflow-hidden">
            {/* Top Bar: Category, Publication Status & Quick Reorder */}
            <div>
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b-2 border-black/10">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                            {project.category || "Full-Stack"}
                        </span>

                        {isManageMode && (
                            <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-[1px_1px_0px_#000] ${
                                    project.isPublished
                                        ? "bg-[#a2ff86]/30 text-emerald-900 border-emerald-500"
                                        : "bg-[#FFE566]/40 text-amber-900 border-amber-500"
                                }`}
                            >
                                {project.isPublished ? (
                                    <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                        Published
                                    </>
                                ) : (
                                    <>
                                        <Clock className="w-3 h-3 text-amber-700" />
                                        Draft
                                    </>
                                )}
                            </span>
                        )}

                        {project.isPinned && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                ★ Pinned
                            </span>
                        )}
                    </div>

                    {/* Reorder Buttons (in Manage Mode) */}
                    {isManageMode && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => onMoveUp && onMoveUp(project)}
                                title="Move Up"
                                aria-label="Move project up"
                                className={`p-1 rounded-lg border border-black text-black transition-all ${
                                    isFirst
                                        ? "opacity-30 cursor-not-allowed bg-neutral-100"
                                        : "bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[1px_1px_0px_#000] cursor-pointer"
                                }`}
                            >
                                <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                disabled={isLast}
                                onClick={() => onMoveDown && onMoveDown(project)}
                                title="Move Down"
                                aria-label="Move project down"
                                className={`p-1 rounded-lg border border-black text-black transition-all ${
                                    isLast
                                        ? "opacity-30 cursor-not-allowed bg-neutral-100"
                                        : "bg-white hover:bg-neutral-100 active:translate-y-0.5 shadow-[1px_1px_0px_#000] cursor-pointer"
                                }`}
                            >
                                <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Cover Image Thumbnail (if available) */}
                {(project.coverImageUrl || project.imageUrl) && (
                    <div className="mb-3.5 rounded-xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000] bg-neutral-100 aspect-video w-full max-h-44">
                        <img
                            src={project.coverImageUrl || project.imageUrl}
                            alt={project.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    </div>
                )}

                {/* Project Title & Tagline */}
                <div className="space-y-1.5">
                    <h3 className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight leading-snug">
                        {project.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium line-clamp-2 leading-relaxed">
                        {project.tagline || project.shortDescription || project.description || "Production-ready engineering showcase."}
                    </p>
                </div>

                {/* Selected Features Highlights */}
                {project.features && project.features.length > 0 && (
                    <div className="pt-2 space-y-1">
                        {project.features.slice(0, 2).map((feat, idx) => {
                            const title = typeof feat === "string" ? feat : feat.title;
                            return (
                                <div key={idx} className="flex items-start gap-1.5 text-xs text-neutral-700 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86] border border-black mt-1.5 flex-shrink-0" />
                                    <span className="line-clamp-1">{title}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Technology Tags */}
                {project.technologies && project.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-3">
                        {project.technologies.slice(0, 6).map((tech, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-[#FAF6EE] text-[11px] font-mono font-bold text-neutral-800 border border-black/30 shadow-[1px_1px_0px_rgba(0,0,0,0.15)]"
                            >
                                {tech}
                            </span>
                        ))}
                        {project.technologies.length > 6 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-[10px] font-mono font-bold text-neutral-600 border border-black/20">
                                +{project.technologies.length - 6} more
                            </span>
                        )}
                    </div>
                )}

                {/* Repository Metrics (Stars, Forks, Language) */}
                <div className="flex items-center gap-4 pt-4 text-xs font-mono font-bold text-neutral-700">
                    {project.repoStars > 0 && (
                        <div className="flex items-center gap-1.5" title={`${project.repoStars} GitHub Stars`}>
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span>{project.repoStars.toLocaleString()}</span>
                        </div>
                    )}
                    {project.repoForks > 0 && (
                        <div className="flex items-center gap-1.5" title={`${project.repoForks} GitHub Forks`}>
                            <GitFork className="w-3.5 h-3.5 text-neutral-600" />
                            <span>{project.repoForks.toLocaleString()}</span>
                        </div>
                    )}
                    {project.repoLanguage && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>{project.repoLanguage}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-5 mt-4 border-t-2 border-black/10 flex items-center justify-between gap-2 flex-wrap">
                {/* External Links (Live Demo & GitHub Repo) */}
                <div className="flex items-center gap-2">
                    {project.liveUrl && (
                        <a
                            href={project.liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 text-xs font-black border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                        >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Live Demo</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}

                    {project.repoUrl ? (
                        <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-black border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                            title="View GitHub Repository"
                        >
                            <GithubIcon className="w-3.5 h-3.5" />
                            <span>Code</span>
                        </a>
                    ) : (project.hideRepoUrl || project.isRepoPrivate) ? (
                        <span
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold border border-neutral-300"
                            title="Repository link is private and protected"
                        >
                            <Lock className="w-3 h-3 text-neutral-500" />
                            <span>Private Codebase</span>
                        </span>
                    ) : null}

                    {project.documentationUrl && (
                        <a
                            href={project.documentationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-black border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                            title="View Project Documentation"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Docs</span>
                        </a>
                    )}

                    {/* Inspect Architecture / View Details */}
                    {onViewDetails && (
                        <button
                            type="button"
                            onClick={() => onViewDetails(project)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-neutral-700 hover:text-black hover:bg-neutral-100 text-xs font-bold transition-colors cursor-pointer"
                            title="Inspect Architecture & Features"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                        </button>
                    )}
                </div>

                {/* Management Action Buttons */}
                {isManageMode && (
                    <div className="flex items-center gap-1.5">
                        {onTogglePublish && (
                            <button
                                type="button"
                                onClick={() => onTogglePublish(project)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer ${
                                    project.isPublished
                                        ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                                        : "bg-[#a2ff86] text-black hover:bg-emerald-300"
                                }`}
                                title={project.isPublished ? "Unpublish to draft" : "Publish to showcase"}
                            >
                                {project.isPublished ? "Unpublish" : "Publish"}
                            </button>
                        )}

                        {onSync && project.repoUrl && (
                            <button
                                type="button"
                                onClick={() => onSync(project)}
                                className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border border-black shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                                title="Check & Sync GitHub Repository Updates"
                                aria-label="Sync with GitHub"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {onEdit && (
                            <button
                                type="button"
                                onClick={() => onEdit(project)}
                                className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border border-black shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                                title="Edit Project Information"
                                aria-label="Edit project"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(project)}
                                className="p-1.5 rounded-lg bg-[#FF6B6B]/20 hover:bg-[#FF6B6B] text-neutral-900 hover:text-white border border-black shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                                title="Delete Project & Free Slot"
                                aria-label="Delete project"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
