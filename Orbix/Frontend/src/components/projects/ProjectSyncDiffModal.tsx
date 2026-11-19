import React, { useState, useEffect, useCallback } from "react";
import {
    X,
    RefreshCw,
    GitCompare,
    Shield,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    Star,
    GitFork,
    Code2,
    Check,
} from "lucide-react";
import type { ProjectItem, ProjectMergeAnalysis } from "../../types/project";
import { checkProjectSyncDiff, applyProjectSyncMerge } from "../../api/projectApi";
import { OrbixLoader } from "../ui/loader/OrbixLoader";
import { useToast } from "../../context/ToastContext";
import { useModalDismiss } from "../../hooks/useModalDismiss";

interface ProjectSyncDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    projectTitle: string;
    onMergeSuccess: (updatedProject: ProjectItem) => void;
}

export const ProjectSyncDiffModal: React.FC<ProjectSyncDiffModalProps> = ({
    isOpen,
    onClose,
    projectId,
    projectTitle,
    onMergeSuccess,
}) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<ProjectMergeAnalysis | null>(null);

    // Decision per field: "keep_user" | "accept_extracted"
    const [decisions, setDecisions] = useState<Record<string, "keep_user" | "accept_extracted">>({});

    const handleDismiss = useCallback(() => {
        if (!isApplying) {
            onClose();
        }
    }, [isApplying, onClose]);

    const { handleBackdropClick } = useModalDismiss({
        isOpen,
        onClose: handleDismiss,
        disableEscape: isApplying,
        disableBackdrop: isApplying,
    });

    const loadDiff = useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await checkProjectSyncDiff(projectId);
            setAnalysis(res.analysis);

            // Initialize default decisions:
            // If field is overridden by user, default to "keep_user" (preserving user authoritativeness)
            // If field is not overridden, default to "accept_extracted"
            const initialDecisions: Record<string, "keep_user" | "accept_extracted"> = {};
            if (res.analysis?.diffs) {
                Object.entries(res.analysis.diffs).forEach(([field, diff]) => {
                    if (diff.hasChanged) {
                        initialDecisions[field] = diff.isOverridden ? "keep_user" : "accept_extracted";
                    }
                });
            }
            setDecisions(initialDecisions);
        } catch (err: any) {
            console.error("Failed to load repo sync diff:", err);
            setError(err.message || "Failed to compare repository synchronization diffs.");
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (isOpen && projectId) {
            loadDiff();
        }
    }, [isOpen, projectId, loadDiff]);

    const handleDecisionChange = (field: string, decision: "keep_user" | "accept_extracted") => {
        setDecisions((prev) => ({
            ...prev,
            [field]: decision,
        }));
    };

    const handleApplyMerge = async (customDecisions?: Record<string, "keep_user" | "accept_extracted">) => {
        const toSubmit = customDecisions || decisions;
        setIsApplying(true);
        try {
            const res = await applyProjectSyncMerge(projectId, toSubmit);
            toast.success(res.message || "Project synchronized successfully!");
            onMergeSuccess(res.project);
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to apply repository merge.");
        } finally {
            setIsApplying(false);
        }
    };

    const handleAcceptSafeOnly = () => {
        // Enforce all overridden fields to keep_user, and all non-overridden to accept_extracted
        if (!analysis?.diffs) return;
        const safeDecisions: Record<string, "keep_user" | "accept_extracted"> = {};
        Object.entries(analysis.diffs).forEach(([field, diff]) => {
            if (diff.hasChanged) {
                safeDecisions[field] = diff.isOverridden ? "keep_user" : "accept_extracted";
            }
        });
        handleApplyMerge(safeDecisions);
    };

    if (!isOpen) return null;

    const changedDiffEntries = analysis?.diffs
        ? Object.entries(analysis.diffs).filter(([_, diff]) => diff.hasChanged)
        : [];

    const overriddenCount = changedDiffEntries.filter(([_, diff]) => diff.isOverridden).length;
    const safeCount = changedDiffEntries.filter(([_, diff]) => !diff.isOverridden).length;

    const renderValuePreview = (val: any) => {
        if (val === null || val === undefined || val === "") {
            return <span className="text-xs italic text-neutral-400 font-medium">None / Empty</span>;
        }
        if (Array.isArray(val)) {
            if (val.length === 0) {
                return <span className="text-xs italic text-neutral-400 font-medium">Empty List</span>;
            }
            if (typeof val[0] === "string") {
                return (
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {val.map((item, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 text-[11px] font-bold bg-neutral-100 text-neutral-800 rounded-md border border-neutral-300"
                            >
                                {item}
                            </span>
                        ))}
                    </div>
                );
            }
            // Features or objects
            return (
                <div className="space-y-1 max-h-28 overflow-y-auto text-xs">
                    {val.map((item, idx) => (
                        <div key={idx} className="p-1.5 bg-neutral-50 rounded border border-neutral-200">
                            <span className="font-bold text-black">{item.title || item.name || JSON.stringify(item)}</span>
                            {item.description && <p className="text-[11px] text-neutral-600 line-clamp-1">{item.description}</p>}
                        </div>
                    ))}
                </div>
            );
        }
        if (typeof val === "object") {
            return (
                <pre className="text-[11px] font-mono bg-neutral-50 p-2 rounded border border-neutral-200 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(val, null, 2)}
                </pre>
            );
        }
        return <p className="text-xs text-neutral-800 font-medium whitespace-pre-wrap line-clamp-4">{String(val)}</p>;
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
            onClick={handleBackdropClick}
        >
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#FAF6EE] border-[3px] border-black rounded-3xl shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 sm:p-6 bg-white border-b-2 border-black flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-black text-[#a2ff86] border border-black shadow-[2px_2px_0px_#000]">
                            <GitCompare className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                    Repository Sync & Merge Review
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    Phase 5 Non-Destructive
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 font-bold mt-0.5 line-clamp-1">
                                Project: <span className="text-black font-black">{projectTitle}</span>
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isApplying}
                        className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                        aria-label="Close sync modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center space-y-4">
                            <OrbixLoader size="lg" />
                            <p className="text-sm font-black text-black">
                                Analyzing latest repository commits, stats & README on GitHub...
                            </p>
                            <p className="text-xs text-neutral-500 font-bold">
                                Calculating field provenance and non-destructive diffs
                            </p>
                        </div>
                    ) : error ? (
                        <div className="p-5 rounded-2xl bg-[#FF6B6B]/15 border-2 border-[#FF6B6B] text-neutral-900 space-y-3">
                            <div className="flex items-center gap-2 font-black text-red-900">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <span>Failed to Sync Repository</span>
                            </div>
                            <p className="text-xs font-bold text-neutral-700 leading-relaxed">{error}</p>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={loadDiff}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-50 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Retry Check</span>
                                </button>
                            </div>
                        </div>
                    ) : analysis && !analysis.hasDifferences ? (
                        <div className="py-10 text-center space-y-4">
                            <div className="inline-flex p-4 rounded-3xl bg-[#a2ff86]/30 border-2 border-black shadow-[4px_4px_0px_#000]">
                                <CheckCircle2 className="w-10 h-10 text-emerald-800" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">Showcase is 100% In Sync!</h3>
                                <p className="text-xs text-neutral-600 font-bold max-w-md mx-auto">
                                    No upstream changes detected on GitHub. All extracted repository intelligence and manual edits match.
                                </p>
                            </div>

                            <div className="inline-flex items-center gap-4 p-3 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-800">
                                    <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                                    <span>{analysis.statisticsUpdated.stars.after} Stars</span>
                                </div>
                                <div className="h-4 w-px bg-black/20" />
                                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-800">
                                    <GitFork className="w-4 h-4 text-blue-600" />
                                    <span>{analysis.statisticsUpdated.forks.after} Forks</span>
                                </div>
                                {analysis.statisticsUpdated.language.after && (
                                    <>
                                        <div className="h-4 w-px bg-black/20" />
                                        <div className="flex items-center gap-1.5 text-xs font-black text-neutral-800">
                                            <Code2 className="w-4 h-4 text-purple-600" />
                                            <span>{analysis.statisticsUpdated.language.after}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Stats & Provenance Overview Banner */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-indigo-700" />
                                        <h3 className="text-sm font-black text-black uppercase tracking-wider">
                                            Provenance Engine Summary
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {overriddenCount > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                <Shield className="w-3 h-3 text-amber-900" />
                                                {overriddenCount} Custom Overrides Protected
                                            </span>
                                        )}
                                        {safeCount > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                <Sparkles className="w-3 h-3 text-emerald-900" />
                                                {safeCount} Safe Upstream Updates
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* GitHub Live Statistics Updates */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-black/10">
                                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-black/10 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> Stars
                                        </span>
                                        <span className="text-xs font-black text-black">
                                            {analysis?.statisticsUpdated.stars.before} →{" "}
                                            <span className="text-emerald-700 font-black">
                                                {analysis?.statisticsUpdated.stars.after}
                                            </span>
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-neutral-50 border border-black/10 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                                            <GitFork className="w-3.5 h-3.5 text-blue-600" /> Forks
                                        </span>
                                        <span className="text-xs font-black text-black">
                                            {analysis?.statisticsUpdated.forks.before} →{" "}
                                            <span className="text-emerald-700 font-black">
                                                {analysis?.statisticsUpdated.forks.after}
                                            </span>
                                        </span>
                                    </div>

                                    <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-neutral-50 border border-black/10 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-neutral-600 flex items-center gap-1">
                                            <Code2 className="w-3.5 h-3.5 text-purple-600" /> Language
                                        </span>
                                        <span className="text-xs font-black text-black truncate max-w-[100px]">
                                            {analysis?.statisticsUpdated.language.after || "Unchanged"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Field Diff Breakdown */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700">
                                    Detected Differences ({changedDiffEntries.length})
                                </h4>

                                <div className="space-y-3">
                                    {changedDiffEntries.map(([field, diff]) => {
                                        const currentDecision = decisions[field] || (diff.isOverridden ? "keep_user" : "accept_extracted");

                                        return (
                                            <div
                                                key={field}
                                                className={`rounded-2xl border-2 p-4 transition-all shadow-[3px_3px_0px_#000] ${
                                                    diff.isOverridden ? "bg-[#FFFDF8] border-black" : "bg-white border-black"
                                                }`}
                                            >
                                                {/* Field Header */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-black/10">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-sm text-black">{diff.label}</span>
                                                        {diff.isOverridden ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                                                <Shield className="w-2.5 h-2.5 text-amber-700" />
                                                                User Custom Override
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                                                <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
                                                                Auto-Update Recommended
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Choice Radio Pill */}
                                                    <div className="inline-flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-black/20 text-xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDecisionChange(field, "keep_user")}
                                                            className={`px-2.5 py-1 rounded-lg font-black transition-all cursor-pointer ${
                                                                currentDecision === "keep_user"
                                                                    ? "bg-black text-[#a2ff86] shadow-[1px_1px_0px_#000]"
                                                                    : "text-neutral-600 hover:text-black"
                                                            }`}
                                                        >
                                                            Keep My Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDecisionChange(field, "accept_extracted")}
                                                            className={`px-2.5 py-1 rounded-lg font-black transition-all cursor-pointer ${
                                                                currentDecision === "accept_extracted"
                                                                    ? "bg-black text-[#a2ff86] shadow-[1px_1px_0px_#000]"
                                                                    : "text-neutral-600 hover:text-black"
                                                            }`}
                                                        >
                                                            Accept GitHub
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Comparison Columns */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div
                                                        className={`p-3 rounded-xl border ${
                                                            currentDecision === "keep_user"
                                                                ? "border-black bg-amber-50/40 ring-1 ring-black"
                                                                : "border-neutral-200 bg-neutral-50/50 opacity-80"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-200">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                                Current Showcase Value
                                                            </span>
                                                            {currentDecision === "keep_user" && (
                                                                <span className="text-[10px] font-black text-black flex items-center gap-1">
                                                                    <Check className="w-3 h-3 text-emerald-700" /> Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                        {renderValuePreview(diff.currentValue)}
                                                    </div>

                                                    <div
                                                        className={`p-3 rounded-xl border ${
                                                            currentDecision === "accept_extracted"
                                                                ? "border-black bg-emerald-50/40 ring-1 ring-black"
                                                                : "border-neutral-200 bg-neutral-50/50 opacity-80"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-200">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                                Latest GitHub Extracted
                                                            </span>
                                                            {currentDecision === "accept_extracted" && (
                                                                <span className="text-[10px] font-black text-black flex items-center gap-1">
                                                                    <Check className="w-3 h-3 text-emerald-700" /> Selected
                                                                </span>
                                                            )}
                                                        </div>
                                                        {renderValuePreview(diff.extractedValue)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:p-5 bg-white border-t-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="text-[11px] font-bold text-neutral-500 flex items-center gap-1.5 order-2 sm:order-1">
                        <Shield className="w-3.5 h-3.5 text-neutral-700" />
                        <span>Manual edits are protected by default. You can change decisions per field.</span>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isApplying}
                            className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>

                        {changedDiffEntries.length > 0 && overriddenCount > 0 && (
                            <button
                                type="button"
                                onClick={handleAcceptSafeOnly}
                                disabled={isApplying}
                                className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-amber-300 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all cursor-pointer hidden md:inline-flex items-center gap-1.5"
                                title="Preserve all your custom edits and only update stats + non-overridden fields"
                            >
                                <Shield className="w-3.5 h-3.5" />
                                <span>Safe Merge (Keep My Edits)</span>
                            </button>
                        )}

                        {changedDiffEntries.length > 0 && (
                            <button
                                type="button"
                                onClick={() => handleApplyMerge()}
                                disabled={isApplying}
                                className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 text-xs font-black border-2 border-black shadow-[3px_3px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
                            >
                                {isApplying ? (
                                    <>
                                        <OrbixLoader size="sm" />
                                        <span>Merging...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 text-[#a2ff86]" />
                                        <span>Apply Selected Merge</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
