import React, { useState } from "react";
import {
    CheckCircle2,
    AlertCircle,
    XCircle,
    HelpCircle,
    UploadCloud,
    FileCheck2,
    ArrowRight,
    RefreshCw,
    Sparkles,
    Info,
} from "lucide-react";
import type {
    AnalysisReport,
    CheckStatus,
} from "../../../../../Backend/src/services/resume/resumeTypes";

interface ResumeAnalyzerViewProps {
    report: AnalysisReport | null;
    isAnalyzing: boolean;
    onReAnalyze: () => void;
    onOpenUploadModal: () => void;
    onNavigateSection?: (sectionId: string) => void;
}

export const ResumeAnalyzerView: React.FC<ResumeAnalyzerViewProps> = ({
    report,
    isAnalyzing,
    onReAnalyze,
    onOpenUploadModal,
    onNavigateSection,
}) => {
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const checks = report?.checks || [];
    const findings = report?.findings || [];
    const score = report?.overallScore || 0;
    const breakdown = report?.scoreBreakdown;

    const filteredFindings = findings.filter((f) => {
        if (filterStatus === "all") return true;
        return f.status === filterStatus;
    });

    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;
    const failCount = checks.filter((c) => c.status === "fail").length;

    const getStatusBadge = (status: CheckStatus) => {
        switch (status) {
            case "pass":
                return {
                    label: "PASS",
                    bg: "bg-[#a2ff86]",
                    border: "border-black",
                    text: "text-black",
                    icon: <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-black" />,
                };
            case "warn":
                return {
                    label: "WARNING",
                    bg: "bg-[#FFE566]",
                    border: "border-black",
                    text: "text-black",
                    icon: <AlertCircle className="w-4 h-4 stroke-[2.5] text-amber-700" />,
                };
            case "fail":
                return {
                    label: "FAIL",
                    bg: "bg-rose-200",
                    border: "border-black",
                    text: "text-rose-950",
                    icon: <XCircle className="w-4 h-4 stroke-[2.5] text-rose-700" />,
                };
            default:
                return {
                    label: "NOT CHECKED",
                    bg: "bg-neutral-200",
                    border: "border-neutral-400",
                    text: "text-neutral-700",
                    icon: <HelpCircle className="w-4 h-4 stroke-[2] text-neutral-500" />,
                };
        }
    };

    return (
        <div className="space-y-6">
            {/* Disclaimer & Notice Banner */}
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                <div className="text-xs text-neutral-800 space-y-1">
                    <p className="font-bold">
                        Notice on Applicant Tracking Systems (ATS) Compatibility:
                    </p>
                    <p className="leading-relaxed">
                        Recruiting platforms like Greenhouse, Workday, and Lever process resumes differently. Greenhouse explicitly notes parsing difficulties with complex multi-column layouts, tables, headers, footers, and text boxes. Orbix Resume Intelligence evaluates files against common technical recruiting practices and verifies actual generated outputs, while clearly acknowledging that no universal 100% ATS pass can be guaranteed by any software.
                    </p>
                </div>
            </div>

            {/* Score & Quick Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Score Gauge Card */}
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                            Orbix Quality Score
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-black">{score}</span>
                            <span className="text-sm font-bold text-neutral-500">/ 100</span>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] font-bold text-neutral-700 pt-2 border-t border-black/15">
                        <div className="flex justify-between">
                            <span>Structure:</span>
                            <span className="font-mono text-black">{breakdown?.documentStructure || 0}/25</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Completeness:</span>
                            <span className="font-mono text-black">{breakdown?.contentCompleteness || 0}/25</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Readability & Impact:</span>
                            <span className="font-mono text-black">{breakdown?.readabilityAndImpact || 0}/25</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Verification & Links:</span>
                            <span className="font-mono text-black">{breakdown?.verificationAndLinks || 0}/25</span>
                        </div>
                    </div>
                </div>

                {/* Recruiter Scan Breakdown Card */}
                <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-3 md:col-span-2">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                            Eight Recruiter Checks Summary
                        </span>
                        <h4 className="text-base font-black text-black">
                            {passCount} of 8 Checks Passed
                        </h4>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Automated validations recruiters perform during 10-second initial screenings.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="p-2.5 rounded-xl bg-white border-2 border-black text-center shadow-[2px_2px_0px_#000]">
                            <div className="text-xl font-black text-black">{passCount}</div>
                            <div className="text-[10px] font-black uppercase text-emerald-800">Pass</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border-2 border-black text-center shadow-[2px_2px_0px_#000]">
                            <div className="text-xl font-black text-black">{warnCount}</div>
                            <div className="text-[10px] font-black uppercase text-amber-800">Warnings</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border-2 border-black text-center shadow-[2px_2px_0px_#000]">
                            <div className="text-xl font-black text-black">{failCount}</div>
                            <div className="text-[10px] font-black uppercase text-rose-800">Needs Fix</div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Card */}
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                            Actions & Input
                        </span>
                        <h4 className="text-sm font-black text-black">
                            Re-scan or Upload
                        </h4>
                        <p className="text-xs text-neutral-600">
                            Analyze your active draft or upload an existing PDF/DOCX.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={onReAnalyze}
                            disabled={isAnalyzing}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#8cee6d] cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                            <span>{isAnalyzing ? "Analyzing..." : "Re-Run Checks"}</span>
                        </button>

                        <button
                            type="button"
                            onClick={onOpenUploadModal}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Upload Existing Resume</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Checks & Findings Breakdown */}
            <div className="bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden">
                <div className="p-4 sm:px-6 bg-[#FAF6EE] border-b-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <FileCheck2 className="w-5 h-5 text-black" />
                        <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-black">
                            Actionable Analysis Findings
                        </h3>
                    </div>

                    {/* Filter buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {["all", "fail", "warn", "pass"].map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setFilterStatus(st)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${filterStatus === st
                                    ? "bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-neutral-700 hover:text-black border-2 border-transparent"
                                    }`}
                            >
                                {st} {st !== "all" && `(${findings.filter((f) => f.status === st).length})`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                    {filteredFindings.length === 0 ? (
                        <div className="py-12 text-center text-neutral-500 font-bold text-xs">
                            No findings matching this filter.
                        </div>
                    ) : (
                        filteredFindings.map((finding) => {
                            const badgeInfo = getStatusBadge(finding.status);
                            return (
                                <div
                                    key={finding.id}
                                    className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-black/15">
                                        <div className="flex items-center gap-2">
                                            {badgeInfo.icon}
                                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-black">
                                                {finding.title}
                                            </h4>
                                        </div>

                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border shadow-[1px_1px_0px_#000] ${badgeInfo.bg} ${badgeInfo.border} ${badgeInfo.text} self-start sm:self-auto`}>
                                            {badgeInfo.label}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 text-xs">
                                        <p className="text-neutral-800 font-medium leading-relaxed">
                                            {finding.explanation}
                                        </p>

                                        {finding.evidence && (
                                            <div className="p-2.5 rounded-lg bg-white border border-black/30 font-mono text-[11px] text-neutral-800">
                                                <span className="font-bold text-neutral-500 uppercase text-[9px] block">
                                                    Evidence
                                                </span>
                                                {finding.evidence}
                                            </div>
                                        )}

                                        <div className="p-2.5 rounded-lg bg-[#a2ff86]/20 border border-black/40 text-[11px] text-black flex items-start gap-2">
                                            <Sparkles className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-black uppercase text-[10px] text-emerald-950 block">
                                                    Recommended Fix
                                                </span>
                                                <span className="font-medium text-neutral-900">{finding.recommendedFix}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {finding.targetSection && onNavigateSection && (
                                        <div className="pt-1 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => onNavigateSection(finding.targetSection!)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                            >
                                                <span>Fix in {finding.targetSection}</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
