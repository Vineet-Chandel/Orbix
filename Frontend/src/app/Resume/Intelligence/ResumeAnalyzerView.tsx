import React, { useState } from "react";
import {
    CheckCircle2,
    AlertCircle,
    XCircle,
    Sparkles,
    TrendingUp,
    Code2,
    Brain,
    HelpCircle,
    Lightbulb,
    Target,
    Calculator,
    ArrowRight,
    FileCheck2,
    Layers,
    ListChecks,
} from "lucide-react";
import type { ComprehensiveIntelligenceReport } from "../../../utils/resumeIntelligenceApi";
import { ExplainScoreModal } from "./ExplainScoreModal";
import { ProfileSyncModal } from "./ProfileSyncModal";

interface ResumeAnalyzerViewProps {
    report: ComprehensiveIntelligenceReport | null;
    isAnalyzing: boolean;
    onReAnalyze?: () => void;
    onUploadClick?: () => void;
    onProfileSyncSuccess?: () => void;
}

export const ResumeAnalyzerView: React.FC<ResumeAnalyzerViewProps> = ({
    report,
    isAnalyzing,
    onReAnalyze,
    onUploadClick: _onUploadClick,
    onProfileSyncSuccess,
}) => {
    const [activeTab, setActiveTab] = useState<"improvements" | "skills" | "checks">("improvements");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    if (isAnalyzing) {
        return (
            <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] text-center space-y-5 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                    <Sparkles className="w-8 h-8 text-black animate-spin" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-xl font-black text-black">Evaluating Resume Intelligence</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Running 7-dimension weighted scoring, ATS parseability audit, and structured fact extraction...
                    </p>
                </div>
            </div>
        );
    }

    if (!report) {
        return null;
    }

    const {
        overallScore,
        scoreGrade,
        summary,
        scoring,
        roleIntelligence,
        profileSyncProposal,
        detectedSkills,
        improvements,
        checks,
        missingKeywords,
        roleSpecificTips,
    } = report;

    // Dimensions
    const dims = scoring?.dimensions;
    const impactDim = dims?.impactAndMetrics;
    const techDim = dims?.technicalDepth;
    const roleDim = dims?.targetRoleAlignment;
    const atsDim = dims?.atsStructure;
    const clarityDim = dims?.clarityAndActionWriting;
    const verifiedDim = dims?.verifiedProfiles;
    const contactDim = dims?.contactAndCompleteness;

    const roleName = roleIntelligence?.primaryTargetRole || report.targetRoleDetected || "Software Engineer";
    const seniority = roleIntelligence?.seniorityLevel || report.experienceLevel || "Mid-Level";

    const filteredImprovements = (improvements || []).filter((item) => {
        if (selectedCategory === "all") return true;
        return item.category === selectedCategory;
    });

    const getScoreBadgeColor = (score: number) => {
        if (score >= 85) return "bg-[#a2ff86] text-black border-black";
        if (score >= 70) return "bg-[#FFE566] text-black border-black";
        if (score >= 55) return "bg-amber-200 text-black border-black";
        return "bg-rose-200 text-rose-950 border-black";
    };

    const getCheckIcon = (status: "pass" | "warn" | "fail" | string) => {
        switch (status) {
            case "pass":
                return <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-emerald-700" />;
            case "warn":
                return <AlertCircle className="w-4 h-4 stroke-[2.5] text-amber-700" />;
            case "fail":
                return <XCircle className="w-4 h-4 stroke-[2.5] text-rose-700" />;
            default:
                return <HelpCircle className="w-4 h-4 text-neutral-500" />;
        }
    };

    // Helper for dimension progress bar colors
    const getDimBarColor = (key: string) => {
        switch (key) {
            case "impactAndMetrics": return "bg-[#FFE566]";
            case "technicalDepth": return "bg-[#a2ff86]";
            case "targetRoleAlignment": return "bg-emerald-400";
            case "atsStructure": return "bg-blue-400";
            case "clarityAndActionWriting": return "bg-purple-400";
            case "verifiedProfiles": return "bg-indigo-400";
            case "contactAndCompleteness": return "bg-amber-400";
            default: return "bg-[#FFE566]";
        }
    };

    const dimensionCards = [
        { key: "impactAndMetrics", label: "Impact & Quantified Achievements", dim: impactDim, defaultWeight: 0.25 },
        { key: "technicalDepth", label: "Technical Depth & Evidence", dim: techDim, defaultWeight: 0.20 },
        { key: "targetRoleAlignment", label: "Target Role Alignment", dim: roleDim, defaultWeight: 0.20 },
        { key: "atsStructure", label: "ATS Structure & Parseability", dim: atsDim, defaultWeight: 0.10 },
        { key: "clarityAndActionWriting", label: "Clarity & Action Writing", dim: clarityDim, defaultWeight: 0.10 },
        { key: "verifiedProfiles", label: "Verified Profiles & Work Evidence", dim: verifiedDim, defaultWeight: 0.10 },
        { key: "contactAndCompleteness", label: "Contact & Resume Completeness", dim: contactDim, defaultWeight: 0.05 },
    ];

    const isDenominatorNormalized = scoring && scoring.totalAssessedWeight < 1.0;

    return (
        <div className="space-y-6">
            {/* ========================================================================= */}
            {/* 1. HERO SCORE & EXECUTIVE SUMMARY CARD                                    */}
            {/* ========================================================================= */}
            <div className="p-5 sm:p-6 lg:p-7 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b-2 border-black/10">
                    <div className="flex items-start sm:items-center gap-4 sm:gap-5 flex-1 min-w-0">
                        {/* Overall Score Circle */}
                        <div className="relative shrink-0">
                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-black flex flex-col items-center justify-center shadow-[4px_4px_0px_#000] ${getScoreBadgeColor(overallScore)}`}>
                                <span className="text-3xl sm:text-4xl font-black tracking-tight">{overallScore}</span>
                                <span className="text-[10px] font-black uppercase tracking-wider text-black/70">out of 100</span>
                            </div>
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border-2 shadow-[1px_1px_0px_#000] ${getScoreBadgeColor(overallScore)}`}>
                                    {scoreGrade}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                                    Model {scoring?.scoringVersion || "v3.0.0"}
                                </span>
                                {isDenominatorNormalized && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        Denominator Re-Weighted ({Math.round(scoring.totalAssessedWeight * 100)}%)
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-black truncate">
                                {roleName}
                            </h2>
                            <p className="text-xs sm:text-sm font-semibold text-neutral-600 flex items-center gap-2 flex-wrap">
                                <span>Seniority: <strong className="text-black">{seniority}</strong></span>
                                {roleIntelligence?.estimatedYearsExperience !== undefined && (
                                    <>
                                        <span>•</span>
                                        <span>Exp: <strong className="text-black">{roleIntelligence.estimatedYearsExperience} yr(s)</strong></span>
                                    </>
                                )}
                                {roleIntelligence?.secondaryTargetRole && (
                                    <>
                                        <span>•</span>
                                        <span className="text-neutral-500">Alt: {roleIntelligence.secondaryTargetRole}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="shrink-0 flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setIsExplainModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                        >
                            <Calculator className="w-3.5 h-3.5" />
                            <span>How Score Was Calculated</span>
                        </button>

                        {onReAnalyze && (
                            <button
                                type="button"
                                onClick={onReAnalyze}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                            >
                                <Brain className="w-3.5 h-3.5" />
                                <span>Re-Analyze</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Executive Summary Box */}
                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black/20 text-neutral-800 text-xs sm:text-sm leading-relaxed">
                    <div className="flex items-center gap-1.5 mb-1.5 font-black text-black uppercase tracking-wider text-[11px]">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                        <span>Executive Resume Intelligence Summary</span>
                    </div>
                    <p>{summary}</p>
                </div>

                {/* Profile Sync Banner (If missing fields detected) */}
                {profileSyncProposal && profileSyncProposal.hasMissingFields && (
                    <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#000]">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0">
                                <FileCheck2 className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-xs sm:text-sm font-black text-black">
                                    Sync Resume Facts to Orbix Profile
                                </h4>
                                <p className="text-[11px] text-neutral-700">
                                    Found <strong>{profileSyncProposal.totalEligibleFields} missing field(s)</strong> in your profile (e.g. {profileSyncProposal.proposedFields.map(f => f.label).slice(0, 3).join(", ")}).
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsSyncModalOpen(true)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition shrink-0 cursor-pointer"
                        >
                            <span>Review & Sync</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 2. SEVEN-DIMENSION SCORE BREAKDOWN BARS                                   */}
                {/* ========================================================================= */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                            <Layers className="w-4 h-4 text-black" />
                            <span>7-Dimension Authoritative Scoring Model (v3.0.0)</span>
                        </h4>
                        <span className="text-[11px] font-mono text-neutral-500">
                            {isDenominatorNormalized
                                ? `Dynamic Denominator: ${Math.round(scoring.totalAssessedWeight * 100)}% Assessed`
                                : "100% Normalized Weighting"}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dimensionCards.map((card, idx) => {
                            const isAssessed = card.dim?.assessed ?? true;
                            const score = isAssessed ? (card.dim?.score ?? 0) : 0;
                            const weightPct = Math.round((card.dim?.weight ?? card.defaultWeight) * 100);
                            const contr = isAssessed ? (score * (card.dim?.weight ?? card.defaultWeight)).toFixed(1) : "0.0";
                            const isLastSpan = idx === 6;

                            return (
                                <div
                                    key={card.key}
                                    className={`p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5 ${isLastSpan ? "sm:col-span-2 lg:col-span-3" : ""}`}
                                >
                                    <div className="flex items-center justify-between text-xs font-bold gap-2">
                                        <span className="text-neutral-800 truncate">{card.label}</span>
                                        {isAssessed ? (
                                            <span className="font-mono font-black shrink-0">{score}%</span>
                                        ) : (
                                            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-700 shrink-0">
                                                Unassessed
                                            </span>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                        {isAssessed ? (
                                            <div
                                                className={`h-full ${getDimBarColor(card.key)} transition-all duration-500`}
                                                style={{ width: `${score}%` }}
                                            />
                                        ) : (
                                            <div className="h-full bg-neutral-300 w-full opacity-40 [background-image:linear-gradient(45deg,rgba(0,0,0,0.1)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.1)_75%,transparent_75%,transparent)] [background-size:8px_8px]" />
                                        )}
                                    </div>

                                    <div className="text-[10px] text-neutral-600 font-mono flex justify-between gap-2">
                                        {isAssessed ? (
                                            <>
                                                <span>Weight: {weightPct}%</span>
                                                <span>Contr: {contr} pts</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-amber-700 font-semibold">Excluded from denominator</span>
                                                <span className="text-neutral-500">Weight re-normalized</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. DEVELOPER FOCUS WORKSPACE (MINIMAL, ZERO CLUTTER TABBED INTERFACE)     */}
            {/* ========================================================================= */}
            <div className="p-5 sm:p-6 lg:p-7 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-6">
                {/* Navigation Segmented Controller */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-black">
                            Actionable Resume Diagnostics
                        </h3>
                        <p className="text-xs text-neutral-600 font-medium">
                            Grounded analysis, verified technical competencies, and ATS compliance signals.
                        </p>
                    </div>

                    {/* Segmented Tab Buttons */}
                    <div className="inline-flex items-center p-1 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black uppercase tracking-wider shrink-0">
                        <button
                            type="button"
                            onClick={() => setActiveTab("improvements")}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "improvements"
                                    ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Actionable Fixes</span>
                            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-black text-white font-mono">
                                {(improvements || []).length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("skills")}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "skills"
                                    ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            <Code2 className="w-3.5 h-3.5" />
                            <span>Tech Stack & Gaps</span>
                            {missingKeywords && missingKeywords.length > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-mono">
                                    {missingKeywords.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("checks")}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "checks"
                                    ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:text-black"
                            }`}
                        >
                            <ListChecks className="w-3.5 h-3.5" />
                            <span>ATS Compliance</span>
                            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-200 text-black font-mono">
                                {(checks || []).length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: ACTIONABLE IMPROVEMENTS & GOOGLE XYZ REWRITES                      */}
                {/* ========================================================================= */}
                {activeTab === "improvements" && (
                    <div className="space-y-5 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                Grounded Bullet Rewrites ({filteredImprovements.length})
                            </span>

                            {/* Category Filter Pills */}
                            <div className="inline-flex items-center p-0.5 rounded-lg bg-neutral-100 border border-black/20 text-[11px] font-bold self-start sm:self-center">
                                {["all", "metrics", "action_verbs", "technical_depth", "role_alignment"].map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-2.5 py-1 rounded capitalize cursor-pointer transition ${
                                            selectedCategory === cat
                                                ? "bg-black text-white"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        {cat === "all" ? "All" : cat.replace("_", " ")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredImprovements.length === 0 ? (
                            <div className="p-8 rounded-xl bg-neutral-50 border border-black/10 text-center text-xs text-neutral-600 font-medium">
                                No improvements found for this category. Excellent formulation!
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {filteredImprovements.map((imp, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 sm:p-5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <h4 className="text-sm font-black text-black">
                                                {imp.title}
                                            </h4>
                                            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FFE566] text-black border border-black shrink-0">
                                                {imp.category?.replace("_", " ")}
                                            </span>
                                        </div>

                                        <p className="text-xs text-neutral-700">
                                            <strong className="text-neutral-900">Issue:</strong> {imp.issue}
                                        </p>
                                        <p className="text-xs text-neutral-700">
                                            <strong className="text-neutral-900">Recommendation:</strong> {imp.suggestion}
                                        </p>

                                        {/* Grounded Before vs After Rewrite Example */}
                                        {imp.exampleBefore && imp.exampleAfter && (
                                            <div className="mt-2 pt-2 border-t border-black/10 space-y-2 text-xs font-mono">
                                                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-950">
                                                    <span className="font-bold text-[10px] uppercase text-rose-800 block mb-0.5">
                                                        Original Resume Excerpt:
                                                    </span>
                                                    "{imp.exampleBefore}"
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950">
                                                    <span className="font-bold text-[10px] uppercase text-emerald-800 block mb-0.5">
                                                        Grounded XYZ Rewrite (Google Formula):
                                                    </span>
                                                    "{imp.exampleAfter}"
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Role-Specific Architecture Tips */}
                        {roleSpecificTips && roleSpecificTips.length > 0 && (
                            <div className="p-4 rounded-xl bg-white border border-black/20 space-y-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Engineering Architecture Recommendations for {roleName}</span>
                                </span>
                                <ul className="text-xs text-neutral-700 space-y-1.5 list-disc pl-5">
                                    {roleSpecificTips.map((tip, idx) => (
                                        <li key={idx}>{tip}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: TECHNICAL SKILLS & HIGH-DEMAND KEYWORD GAPS                        */}
                {/* ========================================================================= */}
                {activeTab === "skills" && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* High-demand Missing Keywords Warning Callout */}
                        {missingKeywords && missingKeywords.length > 0 && (
                            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-400 space-y-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                                        High-Demand Recruiter Keywords Missing for {roleName}
                                    </h4>
                                </div>
                                <p className="text-xs text-rose-900 leading-relaxed">
                                    Recruiters scanning for {roleName} positions look for these core technical competencies. Add them to your projects or skills section if you possess practical experience:
                                </p>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {missingKeywords.map((kw, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-rose-950 border border-rose-300 shadow-[1px_1px_0px_#f43f5e]"
                                        >
                                            + {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Extracted Skills Categorized */}
                        {detectedSkills ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Languages */}
                                {detectedSkills.languages && detectedSkills.languages.length > 0 && (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-2">
                                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-neutral-700">
                                            <span>Languages</span>
                                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-800">
                                                {detectedSkills.languages.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {detectedSkills.languages.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-black border border-black shadow-[1px_1px_0px_#000]"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Frameworks */}
                                {detectedSkills.frameworks && detectedSkills.frameworks.length > 0 && (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-2">
                                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-neutral-700">
                                            <span>Frameworks & Libraries</span>
                                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-800">
                                                {detectedSkills.frameworks.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {detectedSkills.frameworks.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Databases & Developer Tools */}
                                {detectedSkills.databasesAndTools && detectedSkills.databasesAndTools.length > 0 && (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-2 md:col-span-2">
                                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-neutral-700">
                                            <span>Databases, Cloud & Dev Tools</span>
                                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-800">
                                                {detectedSkills.databasesAndTools.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {detectedSkills.databasesAndTools.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-950 border border-blue-400 shadow-[1px_1px_0px_#3b82f6]"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Engineering Concepts */}
                                {detectedSkills.concepts && detectedSkills.concepts.length > 0 && (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-2 md:col-span-2">
                                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-neutral-700">
                                            <span>Systems Architecture & Engineering Concepts</span>
                                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-800">
                                                {detectedSkills.concepts.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {detectedSkills.concepts.map((item, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-950 border border-purple-400 shadow-[1px_1px_0px_#a855f7]"
                                                >
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl bg-neutral-50 border border-black/10 text-center text-xs text-neutral-600">
                                No technical skills explicitly extracted from the document.
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 3: ATS & RECRUITER COMPLIANCE CHECKS                                  */}
                {/* ========================================================================= */}
                {activeTab === "checks" && (
                    <div className="space-y-4 animate-fadeIn">
                        {checks && checks.length > 0 ? (
                            <div className="divide-y-2 divide-black/10">
                                {checks.map((c) => (
                                    <div
                                        key={c.id}
                                        className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                                    >
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="mt-0.5 shrink-0">
                                                {getCheckIcon(c.status)}
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-black text-black">{c.label}</span>
                                                    <span
                                                        className={`px-2 py-0.2 rounded text-[10px] font-black uppercase border ${
                                                            c.status === "pass"
                                                                ? "bg-[#a2ff86] border-black text-black"
                                                                : c.status === "warn"
                                                                    ? "bg-[#FFE566] border-black text-black"
                                                                    : "bg-rose-200 border-black text-rose-900"
                                                        }`}
                                                    >
                                                        {c.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-neutral-600">{c.description}</p>
                                                <p className="text-xs text-neutral-800 font-medium">
                                                    <span className="font-bold">Evidence:</span> {c.evidence}
                                                </p>
                                                {c.recommendation && c.status !== "pass" && (
                                                    <p className="text-xs text-amber-900 font-semibold">
                                                        <span className="font-bold">Fix:</span> {c.recommendation}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0 sm:text-right pl-7 sm:pl-0">
                                            <span className="font-mono text-sm font-black text-black">{c.score}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl bg-neutral-50 border border-black/10 text-center text-xs text-neutral-600">
                                No ATS compliance checks recorded.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Explain Score Modal */}
            <ExplainScoreModal
                isOpen={isExplainModalOpen}
                onClose={() => setIsExplainModalOpen(false)}
                scoring={scoring}
            />

            {/* Profile Sync Modal */}
            <ProfileSyncModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                proposal={profileSyncProposal || null}
                onSyncSuccess={() => {
                    if (onProfileSyncSuccess) onProfileSyncSuccess();
                }}
            />
        </div>
    );
};

export default ResumeAnalyzerView;