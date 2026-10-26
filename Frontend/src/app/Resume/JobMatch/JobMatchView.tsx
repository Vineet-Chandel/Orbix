import React, { useState } from "react";
import {
    Target,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    Layers,
} from "lucide-react";
import { runJobMatchApi } from "../../../utils/resumeIntelligenceApi";
import type { ResumeContent, JobMatchReport } from "../../../../../Backend/src/services/resume/resumeTypes";

interface JobMatchViewProps {
    content: ResumeContent;
    onApplyTailoredVersion: (tailoredContent: ResumeContent, label: string, role: string) => void;
}

export const JobMatchView: React.FC<JobMatchViewProps> = ({
    content,
    onApplyTailoredVersion,
}) => {
    const [targetRole, setTargetRole] = useState("Full Stack Engineer");
    const [companyName, setCompanyName] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [isMatching, setIsMatching] = useState(false);
    const [matchReport, setMatchReport] = useState<JobMatchReport | null>(null);
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [acceptedImprovements, setAcceptedImprovements] = useState<Record<number, boolean>>({});

    const handleRunMatch = async () => {
        if (!targetRole.trim() || !jobDescription.trim()) return;
        setIsMatching(true);
        try {
            const report = await runJobMatchApi({
                content,
                targetRole: targetRole.trim(),
                companyName: companyName.trim(),
                jobDescription: jobDescription.trim(),
            });
            setMatchReport(report);
            const initialAccepted: Record<number, boolean> = {};
            report.suggestedBulletImprovements.forEach((_, idx) => {
                initialAccepted[idx] = true;
            });
            setAcceptedImprovements(initialAccepted);
        } catch (err: any) {
            console.error("Job match error:", err);
        } finally {
            setIsMatching(false);
        }
    };

    const handleCreateTailored = () => {
        if (!matchReport) return;

        // Clone content to create independent tailored version
        const tailoredContent: ResumeContent = JSON.parse(JSON.stringify(content));

        // Apply tailored summary if available
        if (matchReport.suggestedSummaryRewrite) {
            tailoredContent.summary = matchReport.suggestedSummaryRewrite;
        }

        // Apply accepted bullet improvements
        matchReport.suggestedBulletImprovements.forEach((imp, idx) => {
            if (acceptedImprovements[idx]) {
                if (imp.sectionId === "projects") {
                    const proj = tailoredContent.projects.find((p, pIdx) => p.id === imp.entryId || `proj_${pIdx}` === imp.entryId);
                    if (proj && proj.bullets[imp.bulletIndex] !== undefined) {
                        proj.bullets[imp.bulletIndex] = imp.improvedBullet;
                    }
                }
            }
        });

        const label = companyName ? `${companyName} - ${targetRole}` : `Tailored: ${targetRole}`;
        onApplyTailoredVersion(tailoredContent, label, targetRole);
    };

    return (
        <div className="space-y-6">
            {/* Input Form Header */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black">
                    <div className="w-9 h-9 rounded-xl bg-[#FFE566] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                        <Target className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h3 className="text-base font-black uppercase tracking-tight text-black">
                            Job Match & Role-Specific Tailoring
                        </h3>
                        <p className="text-xs text-neutral-600 font-medium">
                            Paste a job description to uncover keyword gaps and create a tailored resume version without inventing qualifications
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                            Target Job Title *
                        </label>
                        <input
                            type="text"
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-2 font-bold text-black text-xs outline-none focus:bg-white"
                            placeholder="e.g. Software Engineer, Backend Developer, Full Stack Intern"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                            Company Name (Optional)
                        </label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-2 font-bold text-black text-xs outline-none focus:bg-white"
                            placeholder="e.g. Stripe, Swiggy, Google, Razorpay"
                        />
                    </div>
                </div>

                <div className="space-y-1 text-xs">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700">
                        Full Job Description *
                    </label>
                    <textarea
                        rows={5}
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg p-3 font-medium text-black text-xs outline-none focus:bg-white leading-relaxed"
                        placeholder="Paste the full job requirements, responsibilities, and required technical qualifications here..."
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        disabled={isMatching || !targetRole.trim() || !jobDescription.trim()}
                        onClick={handleRunMatch}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Sparkles className="w-4 h-4 stroke-[2.5]" />
                        <span>{isMatching ? "Comparing Skills & Context..." : "Run Job Match"}</span>
                    </button>
                </div>
            </div>

            {/* Match Report Output */}
            {matchReport && (
                <div className="space-y-5 animate-fadeIn">
                    {/* Score & Skill Summary Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between">
                            <span className="text-[10px] font-black uppercase text-neutral-600">
                                Target Role Match
                            </span>
                            <div className="my-2">
                                <div className="text-3xl font-black text-black">
                                    {matchReport.matchScore}%
                                </div>
                                <div className="text-xs font-bold text-neutral-700 mt-1">
                                    {matchReport.matchScore >= 75 ? "Strong Alignment" : "Partial Overlap"}
                                </div>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium">
                                Based on deterministic keywords and project corroboration.
                            </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-black shadow-[5px_5px_0px_#000] space-y-2 md:col-span-2">
                            <span className="text-[10px] font-black uppercase text-emerald-950 font-black">
                                Matched Skills in Your Resume ({matchReport.matchedSkills.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {matchReport.matchedSkills.map((s, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2.5 py-1 rounded bg-[#a2ff86] border border-black text-xs font-black text-black inline-flex items-center gap-1 shadow-[1px_1px_0px_#000]"
                                    >
                                        <CheckCircle2 className="w-3 h-3 text-black" />
                                        {s.name}
                                    </span>
                                ))}
                            </div>
                            {matchReport.missingSkills.length > 0 && (
                                <div className="pt-2">
                                    <span className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                                        Skills from Job Description Missing from Your Resume ({matchReport.missingSkills.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {matchReport.missingSkills.map((s, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-0.5 rounded bg-amber-100 border border-black text-[11px] font-bold text-amber-950 inline-flex items-center gap-1"
                                            >
                                                <AlertCircle className="w-3 h-3 text-amber-700" />
                                                {s.name}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-neutral-600 mt-1.5">
                                        If you know any of these tools, add them in the Skills section or mention their usage in project bullets.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grounded Summary Rewrite */}
                    {matchReport.suggestedSummaryRewrite && (
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[5px_5px_0px_#000] space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-emerald-800" />
                                    <span>Suggested Grounded Summary for {targetRole}</span>
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(matchReport.suggestedSummaryRewrite!);
                                        setCopiedSummary(true);
                                        setTimeout(() => setCopiedSummary(false), 2000);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-white border border-black rounded shadow-[1px_1px_0px_#000] cursor-pointer"
                                >
                                    {copiedSummary ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedSummary ? "Copied" : "Copy"}</span>
                                </button>
                            </div>
                            <p className="text-xs text-neutral-800 leading-relaxed font-medium bg-white p-3 rounded-xl border border-black/30">
                                {matchReport.suggestedSummaryRewrite}
                            </p>
                        </div>
                    )}

                    {/* Bullet Improvements */}
                    {matchReport.suggestedBulletImprovements.length > 0 && (
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] space-y-3">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Refined Action Bullets for {targetRole}
                            </h4>
                            <p className="text-xs text-neutral-600">
                                Select improvements you would like included in your tailored version:
                            </p>

                            <div className="space-y-3 pt-1">
                                {matchReport.suggestedBulletImprovements.map((imp, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() =>
                                            setAcceptedImprovements((prev) => ({
                                                ...prev,
                                                [idx]: !prev[idx],
                                            }))
                                        }
                                        className={`p-3 rounded-xl border-2 border-black cursor-pointer transition-all space-y-1.5 ${acceptedImprovements[idx]
                                            ? "bg-[#a2ff86]/20 shadow-[3px_3px_0px_#000]"
                                            : "bg-[#FAF6EE] opacity-60"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-neutral-700">
                                                {acceptedImprovements[idx] ? "✓ Included in Tailored Version" : "Excluded"}
                                            </span>
                                            <span className="text-[10px] font-mono text-neutral-500">
                                                {imp.rationale}
                                            </span>
                                        </div>

                                        <div className="text-xs space-y-1">
                                            <div className="line-through text-neutral-500 text-[11px]">
                                                {imp.originalBullet}
                                            </div>
                                            <div className="font-bold text-black text-xs">
                                                {imp.improvedBullet}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* One-Click Action to Create Version */}
                    <div className="p-5 rounded-2xl bg-black text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[6px_6px_0px_#FFE566]">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black uppercase tracking-wider text-white">
                                Ready to save your tailored resume?
                            </h4>
                            <p className="text-xs text-neutral-300">
                                This will generate a separate role version (e.g. "{companyName ? `${companyName} - ` : ""}{targetRole}") while preserving your master resume.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleCreateTailored}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-white shadow-[3px_3px_0px_#fff] hover:bg-[#8fee71] cursor-pointer shrink-0"
                        >
                            <Layers className="w-4 h-4 stroke-[2.5]" />
                            <span>Create Tailored Version</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
