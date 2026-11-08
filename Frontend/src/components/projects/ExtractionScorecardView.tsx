import React, { useState } from "react";
import {
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Image as ImageIcon,
    Code2,
} from "lucide-react";
import type {
    ExtractionScorecard,
    ExtractedScreenshot,
    FieldScorecardEntry,
} from "../../types/project";

interface ExtractionScorecardViewProps {
    scorecard: ExtractionScorecard;
    screenshots?: ExtractedScreenshot[];
    selectedImageUrl?: string;
    onSelectCoverImage: (url: string) => void;
    technicalFacts?: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        packageManagers: string[];
        devTools: string[];
        manifestFound: string | null;
    };
}

export const ExtractionScorecardView: React.FC<ExtractionScorecardViewProps> = ({
    scorecard,
    screenshots = [],
    selectedImageUrl,
    onSelectCoverImage,
    technicalFacts,
}) => {
    const [isTableExpanded, setIsTableExpanded] = useState(false);

    // Color by tier
    const tierColors: Record<ExtractionScorecard["qualityTier"], { bg: string; text: string; border: string }> = {
        Complete: { bg: "bg-[#a2ff86]", text: "text-black", border: "border-black" },
        "High Quality": { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-600" },
        Moderate: { bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-600" },
        Basic: { bg: "bg-neutral-100", text: "text-neutral-800", border: "border-neutral-500" },
    };

    const currentTier = tierColors[scorecard.qualityTier] || tierColors.Basic;
    const entries = Object.values(scorecard.fields || {});

    const renderStatusBadge = (status: FieldScorecardEntry["status"]) => {
        switch (status) {
            case "extracted":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Extracted
                    </span>
                );
            case "inferred":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-400">
                        <Sparkles className="w-2.5 h-2.5" />
                        Inferred
                    </span>
                );
            case "incomplete":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-400">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Partial
                    </span>
                );
            case "not_found":
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-200 text-neutral-600 border border-neutral-400">
                        <HelpCircle className="w-2.5 h-2.5" />
                        Not Found
                    </span>
                );
        }
    };

    const formatSource = (source: FieldScorecardEntry["source"]) => {
        switch (source) {
            case "github_metadata":
                return "GitHub REST API";
            case "languages_api":
                return "Languages API (Byte counts)";
            case "dependency_manifest":
                return "Dependency Manifest";
            case "readme_markdown":
                return "README Markdown AST";
            case "readme_images":
                return "README Image Assets";
            case "user_input":
                return "User Entry";
            default:
                return "Inferred / Fallback";
        }
    };

    return (
        <div className="space-y-4">
            {/* Header Scorecard Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black text-[#a2ff86] flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_#000]">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-black">
                                    Extraction Quality Scorecard
                                </h4>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${currentTier.bg} ${currentTier.text} ${currentTier.border}`}
                                >
                                    {scorecard.qualityTier}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 font-bold">
                                Automated intelligence verified against official GitHub REST API and repository files.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <span className="text-lg font-black text-black font-mono">
                                {scorecard.completenessScore}%
                            </span>
                            <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                Completeness
                            </span>
                        </div>
                        <div className="w-16 h-2 rounded-full bg-neutral-200 border border-black overflow-hidden">
                            <div
                                className="h-full bg-[#a2ff86]"
                                style={{ width: `${scorecard.completenessScore}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Technical Facts Summary (Distinguishing facts vs inferences) */}
                {technicalFacts && (
                    <div className="pt-3 border-t border-black/10 flex items-center gap-2 flex-wrap text-xs font-bold text-neutral-700">
                        <span className="inline-flex items-center gap-1 text-black font-black">
                            <Code2 className="w-3.5 h-3.5" />
                            Repository Facts:
                        </span>
                        {technicalFacts.manifestFound && (
                            <span className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[11px] font-mono">
                                Manifest: {technicalFacts.manifestFound}
                            </span>
                        )}
                        {technicalFacts.frameworks.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-300 text-[11px]">
                                Frameworks: {technicalFacts.frameworks.join(", ")}
                            </span>
                        )}
                        {technicalFacts.databases.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-300 text-[11px]">
                                Databases: {technicalFacts.databases.join(", ")}
                            </span>
                        )}
                        {technicalFacts.devTools.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 text-[11px]">
                                Tools: {technicalFacts.devTools.join(", ")}
                            </span>
                        )}
                    </div>
                )}

                {/* Missing Info Warning */}
                {scorecard.missingInformation.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-bold flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                        <div>
                            <span className="font-black">Notice: </span>
                            <span>{scorecard.missingInformation.slice(0, 2).join(". ")}. You can manually enter missing details below.</span>
                        </div>
                    </div>
                )}

                {/* Accordion Toggle for Detailed Provenance Table */}
                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => setIsTableExpanded(!isTableExpanded)}
                        className="text-xs font-black text-black hover:text-neutral-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                        <span>{isTableExpanded ? "Hide Field Provenance Table" : "View Field Provenance & Audit Table"}</span>
                        {isTableExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isTableExpanded && (
                        <div className="mt-3 overflow-x-auto border-2 border-black rounded-xl bg-[#FAF6EE] shadow-[2px_2px_0px_#000]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-white border-b-2 border-black font-black uppercase text-[10px] tracking-wider text-neutral-600">
                                        <th className="p-2.5">Showcase Field</th>
                                        <th className="p-2.5">Status</th>
                                        <th className="p-2.5">Source</th>
                                        <th className="p-2.5">Confidence</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/10 font-bold">
                                    {entries.map((entry) => (
                                        <tr key={entry.field} className="hover:bg-white/60 transition-colors">
                                            <td className="p-2.5 text-black font-black">
                                                {entry.label}
                                                {entry.notes && (
                                                    <span className="block text-[10px] font-normal text-neutral-500">
                                                        {entry.notes}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2.5">{renderStatusBadge(entry.status)}</td>
                                            <td className="p-2.5 font-mono text-[11px] text-neutral-700">
                                                {formatSource(entry.source)}
                                            </td>
                                            <td className="p-2.5 font-mono text-neutral-900">
                                                {Math.round(entry.confidence * 100)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Screenshots Gallery Picker */}
            {screenshots.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-black" />
                            <h4 className="text-xs font-black text-black uppercase tracking-wider">
                                Discovered README Screenshots ({screenshots.length})
                            </h4>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-bold">
                            Click any image to select as your Showcase Cover
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {screenshots.map((s, idx) => {
                            const isSelected = selectedImageUrl === s.url;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => onSelectCoverImage(s.url)}
                                    className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all aspect-video bg-[#FAF6EE] flex items-center justify-center ${
                                        isSelected
                                            ? "border-black shadow-[3px_3px_0px_#000] ring-2 ring-[#a2ff86]"
                                            : "border-black/30 hover:border-black hover:shadow-[2px_2px_0px_#000]"
                                    }`}
                                >
                                    <img
                                        src={s.url}
                                        alt={s.alt || `Screenshot ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        onError={(e) => {
                                            // Handle broken raw github image link gracefully
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                    />
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black text-[#a2ff86] text-[10px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                            Selected Cover
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
