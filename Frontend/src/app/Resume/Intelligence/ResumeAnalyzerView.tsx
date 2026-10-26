import React, { useState } from "react";
import {
    CheckCircle2,
    AlertCircle,
    XCircle,
    Sparkles,
    ShieldCheck,
    TrendingUp,
    Code2,
    Brain,
    HelpCircle,
    Check,
    Lightbulb,
    Target,
    Calculator,
    ArrowRight,
    Briefcase,
    FileCheck2
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
        strengths,
        improvements,
        checks,
        missingKeywords,
        roleSpecificTips,
    } = report;

    // Use 7 dimensions if scoring object exists, else fallback to scoreBreakdown
    const dims = scoring?.dimensions;
    const impactScore = dims?.impactAndMetrics?.score ?? report.scoreBreakdown?.impactAndMetrics ?? 0;
    const technicalScore = dims?.technicalDepth?.score ?? report.scoreBreakdown?.technicalDepth ?? 0;
    const roleScore = dims?.targetRoleAlignment?.score ?? report.scoreBreakdown?.targetRoleAlignment ?? 0;
    const atsScore = dims?.atsStructure?.score ?? report.scoreBreakdown?.atsParsability ?? 0;
    const clarityScore = dims?.clarityAndActionWriting?.score ?? report.scoreBreakdown?.clarityAndStructure ?? 0;
    const verifiedScore = dims?.verifiedProfiles?.score ?? report.scoreBreakdown?.verifiedProfiles ?? 0;
    const contactScore = dims?.contactAndCompleteness?.score ?? report.scoreBreakdown?.contactCompleteness ?? 100;

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

    return (
        <div className="space-y-6">
            {/* ========================================================================= */}
            {/* 1. HERO SCORE & EXECUTIVE SUMMARY CARD */}
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
                                {scoring && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                                        Model {scoring.scoringVersion}
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

                {/* ========================================================================= */}
                {/* 2. PROFILE SYNC CALLOUT BANNER (If missing fields detected) */}
                {/* ========================================================================= */}
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
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition shrink-0"
                        >
                            <span>Review & Sync</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 3. SEVEN-DIMENSION SCORE BREAKDOWN BARS */}
                {/* ========================================================================= */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                            7-Dimension Weighted Scoring Model
                        </h4>
                        <span className="text-[11px] font-mono text-neutral-500">
                            Strict 100% Normalized Weighting
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Dim 1: Impact (25%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Impact & Quantified Achievements</span>
                                <span className="font-mono font-black">{impactScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-[#FFE566]" style={{ width: `${impactScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 25%</span>
                                <span>Contr: {(impactScore * 0.25).toFixed(1)} pts</span>
                            </div>
                        </div>

                        {/* Dim 2: Technical Depth (20%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Technical Depth & Evidence</span>
                                <span className="font-mono font-black">{technicalScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-[#a2ff86]" style={{ width: `${technicalScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 20%</span>
                                <span>Contr: {(technicalScore * 0.20).toFixed(1)} pts</span>
                            </div>
                        </div>

                        {/* Dim 3: Target Role Alignment (20%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Target Role Alignment</span>
                                <span className="font-mono font-black">{roleScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-emerald-400" style={{ width: `${roleScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 20%</span>
                                <span>Contr: {(roleScore * 0.20).toFixed(1)} pts</span>
                            </div>
                        </div>

                        {/* Dim 4: ATS Structure (10%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">ATS Structure & Parseability</span>
                                <span className="font-mono font-black">{atsScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-blue-400" style={{ width: `${atsScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 10%</span>
                                <span>Contr: {(atsScore * 0.10).toFixed(1)} pts</span>
                            </div>
                        </div>

                        {/* Dim 5: Clarity & Action-Oriented (10%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Clarity & Action Writing</span>
                                <span className="font-mono font-black">{clarityScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-purple-400" style={{ width: `${clarityScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 10%</span>
                                <span>Contr: {(clarityScore * 0.10).toFixed(1)} pts</span>
                            </div>
                        </div>

                        {/* Dim 6: Verified Profiles (10%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Verified Profiles & Evidence</span>
                                <span className="font-mono font-black">{verifiedScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-indigo-400" style={{ width: `${verifiedScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 10%</span>
                                <span>Contr: {(verifiedScore * 0.10).toFixed(1)} pts</span>
                            </div>
                        </div>

                        {/* Dim 7: Contact & Completeness (5%) */}
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5 sm:col-span-2 lg:col-span-3">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Contact & Metadata Completeness</span>
                                <span className="font-mono font-black">{contactScore}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-amber-400" style={{ width: `${contactScore}%` }} />
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono flex justify-between">
                                <span>Weight: 5%</span>
                                <span>Contr: {(contactScore * 0.05).toFixed(1)} pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. ROLE & SENIORITY INTELLIGENCE CARD */}
            {/* ========================================================================= */}
            {roleIntelligence && (
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-3">
                    <div className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-black stroke-[2.5]" />
                        <h3 className="text-base sm:text-lg font-black text-black">
                            Role & Seniority Intelligence
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-xl bg-neutral-50 border border-black/10 space-y-1">
                            <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                                Primary Role Target
                            </div>
                            <div className="text-sm font-black text-black">
                                {roleIntelligence.primaryTargetRole}
                            </div>
                            {roleIntelligence.secondaryTargetRole && (
                                <div className="text-xs text-neutral-600">
                                    Secondary: {roleIntelligence.secondaryTargetRole}
                                </div>
                            )}
                        </div>

                        <div className="p-3.5 rounded-xl bg-neutral-50 border border-black/10 space-y-1">
                            <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                                Seniority Assessment
                            </div>
                            <div className="text-sm font-black text-black">
                                {roleIntelligence.seniorityLevel}
                            </div>
                            <div className="text-xs text-neutral-600">
                                Estimated Practical Experience: {roleIntelligence.estimatedYearsExperience} yr(s)
                            </div>
                        </div>
                    </div>

                    {roleIntelligence.evidenceHighlights && roleIntelligence.evidenceHighlights.length > 0 && (
                        <div className="pt-2 text-xs space-y-1 text-neutral-700">
                            <div className="font-bold text-black text-[11px] uppercase tracking-wider">
                                Supporting Evidence Highlights:
                            </div>
                            <ul className="list-disc pl-5 space-y-0.5">
                                {roleIntelligence.evidenceHighlights.map((e, idx) => (
                                    <li key={idx}>{e}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 5. EXTRACTED TECHNICAL SKILLS PILLS */}
            {/* ========================================================================= */}
            {detectedSkills && (
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-5 h-5 text-black stroke-[2.5]" />
                        <h3 className="text-base sm:text-lg font-black text-black">
                            Extracted Technical Skills & Competencies
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {detectedSkills.languages && detectedSkills.languages.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                                    Languages ({detectedSkills.languages.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {detectedSkills.languages.map((item, idx) => (
                                        <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FAF6EE] text-black border border-black shadow-[1px_1px_0px_#000]">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {detectedSkills.frameworks && detectedSkills.frameworks.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                                    Frameworks & Libraries ({detectedSkills.frameworks.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {detectedSkills.frameworks.map((item, idx) => (
                                        <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-black border border-black shadow-[1px_1px_0px_#000]">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {detectedSkills.databasesAndTools && detectedSkills.databasesAndTools.length > 0 && (
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                                    Databases & Developer Tools ({detectedSkills.databasesAndTools.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {detectedSkills.databasesAndTools.map((item, idx) => (
                                        <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-black border border-black shadow-[1px_1px_0px_#000]">
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {missingKeywords && missingKeywords.length > 0 && (
                            <div className="pt-2 border-t border-black/10">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block mb-1.5">
                                    Recommended High-Demand Keywords to Add
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {missingKeywords.map((kw, idx) => (
                                        <span key={idx} className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-900 border border-rose-300">
                                            + {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. KEY STRENGTHS & ACTIONABLE RECOMMENDATIONS */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Strengths */}
                <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 stroke-[2.5]" />
                        <h3 className="text-base sm:text-lg font-black text-black">
                            Profile Strengths ({(strengths || []).length})
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {(strengths || []).map((s, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-400 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                                    <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />
                                    <span>{s.title}</span>
                                </div>
                                <p className="text-xs text-neutral-700 leading-relaxed pl-5">
                                    {s.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    {roleSpecificTips && roleSpecificTips.length > 0 && (
                        <div className="pt-3 border-t border-black/10 space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1">
                                <Target className="w-3.5 h-3.5" />
                                <span>Role-Specific Architecture Tips</span>
                            </span>
                            <ul className="text-xs text-neutral-600 space-y-1.5 list-disc pl-4">
                                {roleSpecificTips.map((tip, idx) => (
                                    <li key={idx}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Right: Actionable Improvements & Rewrites */}
                <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-black stroke-[2.5]" />
                            <h3 className="text-base sm:text-lg font-black text-black">
                                Grounded Improvements ({filteredImprovements.length})
                            </h3>
                        </div>

                        {/* Category Filter */}
                        <div className="inline-flex items-center p-0.5 rounded-lg bg-neutral-100 border border-black/20 text-[11px] font-bold">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("all")}
                                className={`px-2 py-0.5 rounded ${selectedCategory === "all" ? "bg-black text-white" : "text-neutral-700"}`}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("metrics")}
                                className={`px-2 py-0.5 rounded ${selectedCategory === "metrics" ? "bg-black text-white" : "text-neutral-700"}`}
                            >
                                Metrics
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("action_verbs")}
                                className={`px-2 py-0.5 rounded ${selectedCategory === "action_verbs" ? "bg-black text-white" : "text-neutral-700"}`}
                            >
                                Verbs
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedCategory("technical_depth")}
                                className={`px-2 py-0.5 rounded ${selectedCategory === "technical_depth" ? "bg-black text-white" : "text-neutral-700"}`}
                            >
                                Tech
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {filteredImprovements.map((imp, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-sm font-black text-black">
                                        {imp.title}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FFE566] text-black border border-black shrink-0">
                                        {imp.category?.replace("_", " ")}
                                    </span>
                                </div>

                                <p className="text-xs text-neutral-700">
                                    <strong className="text-neutral-900">Issue:</strong> {imp.issue}
                                </p>
                                <p className="text-xs text-neutral-700">
                                    <strong className="text-neutral-900">Recommendation:</strong> {imp.suggestion}
                                </p>

                                {/* Grounded Before vs After Rewrite Example if present */}
                                {imp.exampleBefore && imp.exampleAfter && (
                                    <div className="mt-2 pt-2 border-t border-black/10 space-y-1.5 text-xs font-mono">
                                        <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                                            <span className="font-bold text-[10px] uppercase text-rose-700 block mb-0.5">Original Excerpt:</span>
                                            "{imp.exampleBefore}"
                                        </div>
                                        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-950">
                                            <span className="font-bold text-[10px] uppercase text-emerald-700 block mb-0.5">Grounded Recommended Rewrite:</span>
                                            "{imp.exampleAfter}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 7. ATS & RECRUITER COMPLIANCE CHECKS */}
            {/* ========================================================================= */}
            {checks && checks.length > 0 && (
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                        <h3 className="text-base sm:text-lg font-black text-black">
                            ATS & Recruiter Compliance Checks
                        </h3>
                    </div>

                    <div className="divide-y-2 divide-black/10">
                        {checks.map((c) => (
                            <div key={c.id} className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    <div className="mt-0.5 shrink-0">
                                        {getCheckIcon(c.status)}
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-black">{c.label}</span>
                                            <span className={`px-2 py-0.2 rounded text-[10px] font-black uppercase border ${c.status === "pass" ? "bg-[#a2ff86] border-black text-black" : c.status === "warn" ? "bg-[#FFE566] border-black text-black" : "bg-rose-200 border-black text-rose-900"}`}>
                                                {c.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-600">{c.description}</p>
                                        <p className="text-xs text-neutral-800 font-medium">
                                            <span className="font-bold">Evidence:</span> {c.evidence}
                                        </p>
                                        {c.recommendation && c.status !== "pass" && (
                                            <p className="text-xs text-amber-800 font-medium">
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
                </div>
            )}

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
