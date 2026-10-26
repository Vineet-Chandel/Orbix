import React from "react";
import {
    X,
    Calculator,
    CheckCircle2,
    Layers,
    Award
} from "lucide-react";
import type { ComprehensiveScoringResult } from "../../../utils/resumeIntelligenceApi";

interface ExplainScoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    scoring: ComprehensiveScoringResult | null | undefined;
}

export const ExplainScoreModal: React.FC<ExplainScoreModalProps> = ({
    isOpen,
    onClose,
    scoring
}) => {
    if (!isOpen || !scoring) return null;

    const dimensionsList = Object.values(scoring.dimensions || {});

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border-2 border-black rounded-2xl shadow-[8px_8px_0px_#000] overflow-hidden">
                {/* Header */}
                <div className="p-5 sm:p-6 bg-[#FFE566] border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Calculator className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-black text-black">
                                Transparent Scoring Algorithm
                            </h2>
                            <p className="text-xs text-neutral-800 font-medium">
                                Version {scoring.scoringVersion} • Deterministic 7-Dimension Mathematical Model
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 transition shadow-[2px_2px_0px_#000]"
                    >
                        <X className="w-5 h-5 text-black" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {/* Formula Callout */}
                    <div className="p-4 sm:p-5 rounded-xl bg-neutral-900 text-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#FFE566]">
                            <Calculator className="w-4 h-4" />
                            <span>Authoritative Calculation Formula</span>
                        </div>
                        <p className="font-mono text-xs sm:text-sm text-neutral-200 break-words">
                            Resume Score = Σ (Dimension Score × Dimension Weight) / Σ Assessed Dimension Weights
                        </p>
                        <div className="pt-2 border-t border-neutral-700 text-[11px] font-mono text-neutral-400">
                            {scoring.formula}
                        </div>
                    </div>

                    {/* 3 Distinct Confidence Indicators */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl border-2 border-black bg-emerald-50">
                            <div className="text-[11px] font-bold text-neutral-600">Resume Readiness</div>
                            <div className="text-2xl font-black text-black mt-1">
                                {scoring.resumeReadinessScore}<span className="text-sm font-normal text-neutral-500">/100</span>
                            </div>
                            <p className="text-[10px] text-neutral-600 mt-1 leading-tight">
                                {scoring.confidenceDefinitions?.readiness || "Competitive recruiter readiness level."}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl border-2 border-black bg-blue-50">
                            <div className="text-[11px] font-bold text-neutral-600">Extraction Confidence</div>
                            <div className="text-2xl font-black text-black mt-1">
                                {scoring.extractionConfidence}%
                            </div>
                            <p className="text-[10px] text-neutral-600 mt-1 leading-tight">
                                {scoring.confidenceDefinitions?.extraction || "Machine text & entity extraction certainty."}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl border-2 border-black bg-amber-50">
                            <div className="text-[11px] font-bold text-neutral-600">Analysis Confidence</div>
                            <div className="text-2xl font-black text-black mt-1">
                                {scoring.analysisConfidence}%
                            </div>
                            <p className="text-[10px] text-neutral-600 mt-1 leading-tight">
                                {scoring.confidenceDefinitions?.analysis || "Completeness of assessed dimensions."}
                            </p>
                        </div>
                    </div>

                    {/* 7 Dimensions Breakdown Table */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                            <Layers className="w-4 h-4 text-black" />
                            <span>Dimension Weights & Subcriteria</span>
                        </h3>

                        <div className="border-2 border-black rounded-xl overflow-hidden divide-y-2 divide-black">
                            {dimensionsList.map(dim => (
                                <div key={dim.dimensionKey} className="p-4 bg-white space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-black">{dim.label}</span>
                                                <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-neutral-100 border border-neutral-300">
                                                    Weight: {Math.round(dim.weight * 100)}%
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-600 mt-0.5">{dim.explanation}</p>
                                        </div>

                                        <div className="flex items-center gap-2 self-start sm:self-center">
                                            <span className="text-xs font-mono font-bold text-neutral-500">
                                                Contribution: {(dim.score * dim.weight).toFixed(1)} pts
                                            </span>
                                            <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-[#FFE566] text-black border border-black">
                                                {dim.score}/100
                                            </span>
                                        </div>
                                    </div>

                                    {/* Subcriteria List */}
                                    {dim.subcriteria && dim.subcriteria.length > 0 && (
                                        <div className="p-3 rounded-lg bg-neutral-50 border border-black/10 space-y-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                                Subcriteria Evidence
                                            </div>
                                            <div className="space-y-1.5">
                                                {dim.subcriteria.map(sub => (
                                                    <div key={sub.id} className="text-xs flex items-start gap-2">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-black flex items-center justify-between">
                                                                <span>{sub.label}</span>
                                                                <span className="font-mono text-neutral-600 text-[11px]">
                                                                    {sub.score}/100 ({Math.round(sub.weight * 100)}% of dim)
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-neutral-600 mt-0.5">
                                                                {sub.evidence}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 bg-neutral-50 border-t-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <Award className="w-4 h-4 text-black" />
                        <span>Scores are mathematically audited and never hallucinated.</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#FDD835] font-black text-xs text-black transition shadow-[2px_2px_0px_#000]"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
