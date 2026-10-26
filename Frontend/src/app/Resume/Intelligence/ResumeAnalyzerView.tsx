import React, { useState } from "react";
import {
    CheckCircle2,
    AlertCircle,
    XCircle,
    Sparkles,
    ShieldCheck,
    TrendingUp,
    Code2,
    FileText,
    Brain,
    HelpCircle,
    Check,
    Lightbulb,
    Target,
} from "lucide-react";
import type { GeminiAnalysisReport } from "../../../utils/resumeIntelligenceApi";

interface ResumeAnalyzerViewProps {
    report: GeminiAnalysisReport | null;
    isAnalyzing: boolean;
    onReAnalyze?: () => void;
    onUploadClick?: () => void;
}

export const ResumeAnalyzerView: React.FC<ResumeAnalyzerViewProps> = ({
    report,
    isAnalyzing,
    onReAnalyze,
    onUploadClick,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    if (isAnalyzing) {
        return (
            <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] text-center space-y-5 animate-pulse">
                <div className="w-16 h-16 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                    <Sparkles className="w-8 h-8 text-black animate-spin" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-xl font-black text-black">Analyzing Your Resume</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Evaluating ATS linear structure, quantifiable metrics density, technical keywords, and recruiter impact...
                    </p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                    <FileText className="w-7 h-7 text-black stroke-[2.5]" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-lg font-black text-black">No Resume Analysis Available</h3>
                    <p className="text-xs sm:text-sm text-neutral-600">
                        Upload your PDF or DOCX resume to trigger instant evaluation and attach it to your public profile.
                    </p>
                </div>
                {onUploadClick && (
                    <button
                        type="button"
                        onClick={onUploadClick}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                    >
                        <Sparkles className="w-4 h-4 stroke-[2.5]" />
                        <span>Upload Resume Now</span>
                    </button>
                )}
            </div>
        );
    }

    const {
        overallScore,
        scoreGrade,
        targetRoleDetected,
        experienceLevel,
        summary,
        scoreBreakdown,
        detectedSkills,
        strengths,
        improvements,
        checks,
        missingKeywords,
        roleSpecificTips,
    } = report;

    const filteredImprovements = improvements.filter((item) => {
        if (selectedCategory === "all") return true;
        return item.category === selectedCategory;
    });

    const getScoreBadgeColor = (score: number) => {
        if (score >= 85) return "bg-[#a2ff86] text-black border-black";
        if (score >= 70) return "bg-[#FFE566] text-black border-black";
        if (score >= 55) return "bg-amber-200 text-black border-black";
        return "bg-rose-200 text-rose-950 border-black";
    };

    const getCheckIcon = (status: "pass" | "warn" | "fail") => {
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
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-black truncate">
                                {targetRoleDetected}
                            </h2>
                            <p className="text-xs sm:text-sm font-semibold text-neutral-600">
                                Detected Seniority: <span className="text-black font-black">{experienceLevel}</span>
                            </p>
                        </div>
                    </div>

                    {/* Quick Re-Analyze Action */}
                    {onReAnalyze && (
                        <div className="shrink-0 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onReAnalyze}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                            >
                                <Brain className="w-3.5 h-3.5" />
                                <span>Re-Analyze Resume</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Executive Summary Box */}
                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black/20 text-neutral-800 text-xs sm:text-sm leading-relaxed">
                    <div className="flex items-center gap-1.5 mb-1.5 font-black text-black uppercase tracking-wider text-[11px]">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                        <span>Executive Recruiter Summary</span>
                    </div>
                    <p>{summary}</p>
                </div>

                {/* ========================================================================= */}
                {/* 2. FIVE-DIMENSION SCORE BREAKDOWN BARS */}
                {/* ========================================================================= */}
                <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                        Score Dimension Breakdown
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Impact & Metrics</span>
                                <span className="font-mono font-black">{scoreBreakdown.impactAndMetrics}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-[#FFE566]" style={{ width: `${scoreBreakdown.impactAndMetrics}%` }} />
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Technical Depth</span>
                                <span className="font-mono font-black">{scoreBreakdown.technicalDepth}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-[#a2ff86]" style={{ width: `${scoreBreakdown.technicalDepth}%` }} />
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">ATS Linear Structure</span>
                                <span className="font-mono font-black">{scoreBreakdown.atsParsability}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-blue-400" style={{ width: `${scoreBreakdown.atsParsability}%` }} />
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Clarity & Verbs</span>
                                <span className="font-mono font-black">{scoreBreakdown.clarityAndStructure}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-purple-400" style={{ width: `${scoreBreakdown.clarityAndStructure}%` }} />
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-1.5 md:col-span-2 lg:col-span-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-neutral-700">Verified Profiles & Live Handles</span>
                                <span className="font-mono font-black">{scoreBreakdown.verifiedProfiles}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-black/20">
                                <div className="h-full bg-emerald-400" style={{ width: `${scoreBreakdown.verifiedProfiles}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. EXTRACTED TECHNICAL SKILLS PILLS */}
            {/* ========================================================================= */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                <div className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-black stroke-[2.5]" />
                    <h3 className="text-base sm:text-lg font-black text-black">
                        Extracted Technical Skills & Competencies
                    </h3>
                </div>

                <div className="space-y-3">
                    {detectedSkills.languages.length > 0 && (
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

                    {detectedSkills.frameworks.length > 0 && (
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

                    {detectedSkills.databasesAndTools.length > 0 && (
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

                    {missingKeywords.length > 0 && (
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

            {/* ========================================================================= */}
            {/* 4. KEY STRENGTHS & ACTIONABLE GEMINI RECOMMENDATIONS */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Strengths */}
                <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 stroke-[2.5]" />
                        <h3 className="text-base sm:text-lg font-black text-black">
                            Profile Strengths ({strengths.length})
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {strengths.map((s, idx) => (
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

                    {roleSpecificTips.length > 0 && (
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
                                Actionable Improvements ({improvements.length})
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
                                        {imp.category.replace("_", " ")}
                                    </span>
                                </div>

                                <p className="text-xs text-neutral-700">
                                    <span className="font-bold text-neutral-900">Issue:</span> {imp.issue}
                                </p>
                                <p className="text-xs text-neutral-700">
                                    <span className="font-bold text-neutral-900">Recommendation:</span> {imp.suggestion}
                                </p>

                                {/* Before vs After Rewrite Example if present */}
                                {imp.exampleBefore && imp.exampleAfter && (
                                    <div className="mt-2 pt-2 border-t border-black/10 space-y-1.5 text-xs font-mono">
                                        <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                                            <span className="font-bold text-[10px] uppercase text-rose-700 block mb-0.5">Before:</span>
                                            "{imp.exampleBefore}"
                                        </div>
                                        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-950">
                                            <span className="font-bold text-[10px] uppercase text-emerald-700 block mb-0.5">Recommended Rewrite:</span>
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
            {/* 5. EIGHT-POINT RECRUITER ATS CHECK LIST */}
            {/* ========================================================================= */}
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
        </div>
    );
};
export default ResumeAnalyzerView;
