import React from "react";
import {
    X,
    ExternalLink,
    Globe,
    FileText,
    Video,
    Star,
    GitFork,
    CheckCircle2,
    Layers,
    Code2,
    Image as ImageIcon,
} from "lucide-react";
import type { ProjectItem } from "../../types/project";
import { useModalDismiss } from "../../hooks/useModalDismiss";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
);

interface ProjectDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: ProjectItem | null;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
    isOpen,
    onClose,
    project,
}) => {
    useModalDismiss({ isOpen, onClose });

    if (!isOpen || !project) return null;

    const coverImg = project.coverImageUrl || project.imageUrl;
    const problemText = project.problemStatement || project.story?.problemStatement;
    const audienceText = project.targetAudience || project.story?.targetAudience;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
        >
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#FAF6EE] border-[3px] border-black rounded-3xl shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden">
                {/* Header Bar */}
                <div className="flex items-start justify-between p-5 sm:p-6 bg-white border-b-2 border-black gap-4">
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000]">
                                {project.category || "Full-Stack"}
                            </span>
                            {project.isPublished ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#a2ff86]/30 text-emerald-900 border border-emerald-500 shadow-[1px_1px_0px_#000]">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                    Published
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFE566]/40 text-amber-900 border border-amber-500 shadow-[1px_1px_0px_#000]">
                                    Draft
                                </span>
                            )}
                            {project.isPinned && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    ★ Pinned
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                            {project.title}
                        </h2>
                        {project.tagline && (
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold leading-relaxed">
                                {project.tagline}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer flex-shrink-0"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5 text-black" />
                    </button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className="p-5 sm:p-7 overflow-y-auto space-y-6">
                    {/* Cover Hero Banner (if available) */}
                    {coverImg && (
                        <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000] bg-neutral-100 aspect-video w-full max-h-72">
                            <img
                                src={coverImg}
                                alt={project.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    {/* Repository & Live Action Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                        <div className="flex items-center gap-4 text-xs font-mono font-bold text-neutral-800">
                            {project.repoStars > 0 && (
                                <span className="flex items-center gap-1.5">
                                    <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                                    {project.repoStars.toLocaleString()} stars
                                </span>
                            )}
                            {project.repoForks > 0 && (
                                <span className="flex items-center gap-1.5">
                                    <GitFork className="w-4 h-4 text-neutral-600" />
                                    {project.repoForks.toLocaleString()} forks
                                </span>
                            )}
                            {project.repoLanguage && (
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                    {project.repoLanguage}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {project.liveUrl && (
                                <a
                                    href={project.liveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 text-xs font-black border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                                >
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>Live Preview</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                            {project.repoUrl && (
                                <a
                                    href={project.repoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-black border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                                >
                                    <GithubIcon className="w-3.5 h-3.5" />
                                    <span>Source Code</span>
                                </a>
                            )}
                            {project.documentationUrl && (
                                <a
                                    href={project.documentationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-bold border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Docs</span>
                                </a>
                            )}
                            {project.demoVideoUrl && (
                                <a
                                    href={project.demoVideoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-neutral-900 text-xs font-bold border border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all"
                                >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>Video Walkthrough</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Overview & Architecture Notes */}
                    <div className="space-y-3 rounded-2xl bg-white border-2 border-black p-5 shadow-[3px_3px_0px_#000]">
                        <h4 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-neutral-700" />
                            <span>System Architecture & Overview</span>
                        </h4>
                        <div className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed whitespace-pre-line">
                            {project.description || "No detailed overview provided."}
                        </div>

                        {project.architectureNotes && (
                            <div className="pt-3 border-t border-black/10">
                                <h5 className="text-xs font-black text-neutral-900 uppercase tracking-wide mb-1.5">
                                    Engineering Notes & Implementation Choices
                                </h5>
                                <div className="text-xs text-neutral-700 font-medium leading-relaxed bg-[#FAF6EE] p-3 rounded-xl border border-black/20 whitespace-pre-line font-mono">
                                    {project.architectureNotes}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Key Features Checklist */}
                    {project.features && project.features.length > 0 && (
                        <div className="space-y-3 rounded-2xl bg-white border-2 border-black p-5 shadow-[3px_3px_0px_#000]">
                            <h4 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Core Capabilities & Engineering Highlights</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {project.features.map((feat, idx) => {
                                    const title = typeof feat === "string" ? feat : feat.title;
                                    const desc = typeof feat === "object" ? feat.description : undefined;
                                    return (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1"
                                        >
                                            <div className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-black mt-1.5 flex-shrink-0" />
                                                <span className="text-xs font-black text-black">{title}</span>
                                            </div>
                                            {desc && (
                                                <p className="text-[11px] text-neutral-600 font-medium pl-3.5">
                                                    {desc}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Technology Stack */}
                    {project.technologies && project.technologies.length > 0 && (
                        <div className="space-y-3 rounded-2xl bg-white border-2 border-black p-5 shadow-[3px_3px_0px_#000]">
                            <h4 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-blue-600" />
                                <span>Technologies & Infrastructure</span>
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {project.technologies.map((tech, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 rounded-lg bg-[#FAF6EE] text-xs font-mono font-bold text-neutral-900 border-2 border-black shadow-[2px_2px_0px_#000]"
                                    >
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Problem Context & Target Audience (if provided) */}
                    {(problemText || audienceText) && (
                        <div className="space-y-3 rounded-2xl bg-white border-2 border-black p-5 shadow-[3px_3px_0px_#000]">
                            <h4 className="text-sm font-black text-black uppercase tracking-wider">
                                Project Context & Audience
                            </h4>
                            {problemText && (
                                <div className="space-y-1">
                                    <span className="text-[11px] font-black text-neutral-700 uppercase tracking-wide">
                                        Problem Statement
                                    </span>
                                    <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
                                        {problemText}
                                    </p>
                                </div>
                            )}
                            {audienceText && (
                                <div className="space-y-1 pt-1">
                                    <span className="text-[11px] font-black text-neutral-700 uppercase tracking-wide">
                                        Target Audience
                                    </span>
                                    <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
                                        {audienceText}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Screenshots & Visual Gallery (if available) */}
                    {project.galleryImages && project.galleryImages.length > 0 && (
                        <div className="space-y-3 rounded-2xl bg-white border-2 border-black p-5 shadow-[3px_3px_0px_#000]">
                            <h4 className="text-sm font-black text-black uppercase tracking-wider flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-purple-600" />
                                <span>Screenshots & Architecture Diagrams ({project.galleryImages.length})</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {project.galleryImages.map((imgItem, idx) => {
                                    const imgUrl = typeof imgItem === "string" ? imgItem : imgItem.url;
                                    const caption = typeof imgItem === "object" ? imgItem.caption : undefined;
                                    return (
                                        <div
                                            key={idx}
                                            className="rounded-xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000] bg-neutral-100 flex flex-col group"
                                        >
                                            <div className="aspect-video w-full overflow-hidden bg-neutral-200">
                                                <img
                                                    src={imgUrl}
                                                    alt={caption || `${project.title} screenshot ${idx + 1}`}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            </div>
                                            {caption && (
                                                <p className="p-2 text-[11px] font-medium text-neutral-700 bg-white border-t border-black">
                                                    {caption}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* External Links */}
                    {project.externalLinks && project.externalLinks.length > 0 && (
                        <div className="space-y-2 rounded-2xl bg-white border-2 border-black p-5 shadow-[3px_3px_0px_#000]">
                            <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider">
                                External Resources & References
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {project.externalLinks.map((link, idx) => (
                                    <a
                                        key={idx}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-neutral-900 text-xs font-bold border border-black shadow-[1px_1px_0px_#000] active:translate-y-0.5 transition-all"
                                    >
                                        <span>{link.label || "Resource"}</span>
                                        <ExternalLink className="w-3 h-3 text-neutral-600" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Bar */}
                <div className="p-4 sm:p-5 bg-white border-t-2 border-black flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-neutral-500">
                        Orbix Project Showcase
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
