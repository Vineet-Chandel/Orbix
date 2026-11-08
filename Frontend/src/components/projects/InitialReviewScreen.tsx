import React from "react";
import {
    Sparkles,
    CheckCircle2,
    Sliders,
    Star,
    GitFork,
    Code,
    Layers,
    Eye,
    Save,
    Rocket,
} from "lucide-react";
import type { RepoAnalysisResult, ExtractionScorecard } from "../../types/project";

interface InitialReviewScreenProps {
    analysis: RepoAnalysisResult;
    scorecard?: ExtractionScorecard;
    onUseAsIs: () => void;
    onReviewAndEdit: () => void;
    onSaveDraft: () => void;
    onPublish: () => void;
    isSaving?: boolean;
}

export const InitialReviewScreen: React.FC<InitialReviewScreenProps> = ({
    analysis,
    scorecard,
    onUseAsIs,
    onReviewAndEdit,
    onSaveDraft,
    onPublish,
    isSaving = false,
}) => {
    const completeness = scorecard?.completenessScore ?? 85;
    const tier = scorecard?.qualityTier ?? "Complete";

    return (
        <div className="space-y-6">
            {/* Header Callout */}
            <div className="bg-[#a2ff86] border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-black text-[#a2ff86] border border-black shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider bg-black text-white px-2 py-0.5">
                                AI Extraction Complete
                            </span>
                            <span className="text-xs font-bold bg-white text-black border border-black px-2 py-0.5">
                                Score: {completeness}% ({tier})
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-black tracking-tight mt-1.5">
                            Your repository analysis is ready.
                        </h2>
                        <p className="text-sm font-semibold text-black/80 mt-1">
                            Do you want to use this information as is, or would you like to make some edits?
                        </p>
                    </div>
                </div>
            </div>

            {/* Two Primary Action Cards (Phase 4.1) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Use As Is */}
                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
                    <div>
                        <div className="w-10 h-10 bg-[#FAF6EE] border-2 border-black flex items-center justify-center font-black text-lg mb-3 shadow-[2px_2px_0px_#000]">
                            ⚡
                        </div>
                        <h3 className="text-base font-black text-black uppercase tracking-wide">
                            Option 1: Use As Is
                        </h3>
                        <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                            Accept all extracted repository intelligence directly. You can inspect the summary below and immediately save as draft or publish to your showcase.
                        </p>
                    </div>
                    <div className="pt-5 mt-4 border-t-2 border-black/10 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={onUseAsIs}
                            className="w-full py-2 px-3 bg-neutral-100 hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            Use As Is (Continue to Showcase Summary)
                        </button>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={onSaveDraft}
                                disabled={isSaving}
                                className="flex-1 py-2 px-3 bg-[#FAF6EE] hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 transition-all"
                            >
                                <Save className="w-3.5 h-3.5" />
                                Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={onPublish}
                                disabled={isSaving}
                                className="flex-1 py-2 px-3 bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 transition-all"
                            >
                                <Rocket className="w-3.5 h-3.5" />
                                Publish Live
                            </button>
                        </div>
                    </div>
                </div>

                {/* Option 2: Review and Edit */}
                <div className="bg-[#FAF6EE] border-2 border-black p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
                    <div>
                        <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center font-black text-lg mb-3 shadow-[2px_2px_0px_#000]">
                            🛠️
                        </div>
                        <h3 className="text-base font-black text-black uppercase tracking-wide">
                            Option 2: Review & Edit
                        </h3>
                        <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                            Open the full 8-section dynamic form. Fine-tune your project story, categorize technologies, reorder features, add custom links, and upload media.
                        </p>
                    </div>
                    <div className="pt-5 mt-4 border-t-2 border-black/10">
                        <button
                            type="button"
                            onClick={onReviewAndEdit}
                            className="w-full py-2.5 px-4 bg-black hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 transition-all"
                        >
                            <Sliders className="w-4 h-4 text-[#a2ff86]" />
                            Open Full Dynamic Editor
                        </button>
                    </div>
                </div>
            </div>

            {/* Extracted Intelligence Quick Summary */}
            <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-black" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                            Extracted Information Preview
                        </h4>
                    </div>
                    <span className="text-[11px] font-bold text-neutral-500">
                        {analysis.repoName}
                    </span>
                </div>

                <div className="space-y-3">
                    <div>
                        <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                            Title & Tagline
                        </span>
                        <h3 className="text-lg font-black text-black">
                            {analysis.title || analysis.repoName}
                        </h3>
                        {analysis.tagline && (
                            <p className="text-xs font-semibold text-neutral-700 mt-0.5">
                                {analysis.tagline}
                            </p>
                        )}
                    </div>

                    {analysis.description && (
                        <div>
                            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                                Overview
                            </span>
                            <p className="text-xs font-medium text-neutral-800 bg-[#FAF6EE] p-3 border border-black/30 mt-1 leading-relaxed">
                                {analysis.description}
                            </p>
                        </div>
                    )}

                    {/* Stats bar */}
                    <div className="flex items-center gap-3 flex-wrap pt-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF6EE] border border-black text-xs font-black">
                            <Star className="w-3.5 h-3.5 fill-black text-black" />
                            {(analysis.repoStars || analysis.stars || 0).toLocaleString()} Stars
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF6EE] border border-black text-xs font-black">
                            <GitFork className="w-3.5 h-3.5 text-black" />
                            {(analysis.repoForks || analysis.forks || 0).toLocaleString()} Forks
                        </span>
                        {(analysis.repoLanguage || analysis.primaryLanguage) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FAF6EE] border border-black text-xs font-black">
                                <Code className="w-3.5 h-3.5 text-black" />
                                {analysis.repoLanguage || analysis.primaryLanguage}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-black text-white text-xs font-black">
                            <Layers className="w-3.5 h-3.5 text-[#a2ff86]" />
                            {analysis.category || "Full-Stack"}
                        </span>
                    </div>

                    {/* Tech pills */}
                    {analysis.technologies && analysis.technologies.length > 0 && (
                        <div>
                            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block mb-1.5">
                                Discovered Technologies ({analysis.technologies.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.technologies.map((t) => (
                                    <span
                                        key={t}
                                        className="px-2 py-0.5 bg-white border border-black text-[11px] font-bold text-black"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Extracted Features */}
                    {analysis.features && analysis.features.length > 0 && (
                        <div>
                            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block mb-1.5">
                                Extracted Features ({analysis.features.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {analysis.features.slice(0, 4).map((f, i) => (
                                    <div
                                        key={i}
                                        className="p-2.5 bg-[#FAF6EE] border border-black text-xs font-semibold text-black flex items-start gap-2"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-black shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold">{f.title}</p>
                                            {f.description && (
                                                <p className="text-[11px] font-medium text-neutral-600 line-clamp-2 mt-0.5">
                                                    {f.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

