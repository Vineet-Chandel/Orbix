import React, { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, ExternalLink, ShieldCheck, Download } from "lucide-react";
import type { ResumeContent } from "../../../../../Backend/src/services/resume/resumeTypes";

interface ResumeDocumentPreviewProps {
    content: ResumeContent;
    templateId: string;
    onTemplateChange?: (newTemplate: string) => void;
    onTriggerExport?: () => void;
}

export const ResumeDocumentPreview: React.FC<ResumeDocumentPreviewProps> = ({
    content,
    templateId,
    onTemplateChange,
    onTriggerExport,
}) => {
    const [zoom, setZoom] = useState<number>(100);

    const contact = content.contact;
    const summary = content.summary;
    const education = content.education || [];
    const skills = content.skills || [];
    const projects = content.projects || [];
    const experience = content.experience || [];
    const codingProfiles = content.codingProfiles || [];
    const certifications = content.certifications || [];
    const visible = content.visibleSections || {};

    const contactParts: string[] = [];
    if (contact.includeEmail && contact.email) contactParts.push(contact.email);
    if (contact.includePhone && contact.phone) contactParts.push(contact.phone);
    if (contact.includeLocation && contact.location) contactParts.push(contact.location);
    if (contact.githubUrl) {
        contactParts.push(contact.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "github.com/"));
    }
    if (contact.linkedinUrl) {
        contactParts.push(contact.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "linkedin.com/in/"));
    }
    if (contact.portfolioUrl) {
        contactParts.push(contact.portfolioUrl.replace(/^https?:\/\/(www\.)?/i, ""));
    }

    return (
        <div className="flex flex-col h-full bg-[#E5E0D8] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-hidden">
            {/* Control Bar */}
            <div className="bg-[#FAF6EE] border-b-2 border-black p-2.5 sm:px-4 flex items-center justify-between gap-3 shrink-0 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-black">
                        Template:
                    </span>
                    <select
                        value={templateId}
                        onChange={(e) => onTemplateChange && onTemplateChange(e.target.value)}
                        className="text-xs font-bold bg-white border-2 border-black rounded-lg px-2.5 py-1 shadow-[2px_2px_0px_#000] outline-none cursor-pointer"
                    >
                        <option value="ats_clean_single">ATS Clean Single-Column (Recommended)</option>
                        <option value="modern_developer">Modern Developer (Neo-Brutalist)</option>
                        <option value="minimalist_executive">Minimalist Executive</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    {/* Zoom buttons */}
                    <div className="inline-flex items-center bg-white border-2 border-black rounded-lg p-0.5 shadow-[2px_2px_0px_#000]">
                        <button
                            type="button"
                            onClick={() => setZoom((prev) => Math.max(70, prev - 10))}
                            className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-3.5 h-3.5 text-black" />
                        </button>
                        <span className="px-2 text-[11px] font-mono font-bold text-black">{zoom}%</span>
                        <button
                            type="button"
                            onClick={() => setZoom((prev) => Math.min(130, prev + 10))}
                            className="p-1 hover:bg-neutral-100 rounded cursor-pointer"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-3.5 h-3.5 text-black" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setZoom(100)}
                            className="p-1 hover:bg-neutral-100 rounded cursor-pointer border-l border-black/20"
                            title="Reset Zoom"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-black" />
                        </button>
                    </div>

                    {onTriggerExport && (
                        <button
                            type="button"
                            onClick={onTriggerExport}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#8eed6f] cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Document Sheet Viewer Container */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center items-start">
                <div
                    style={{
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: "top center",
                        transition: "transform 0.15s ease",
                    }}
                    className={`w-[816px] min-h-[1056px] bg-white text-slate-900 border-2 border-black shadow-[10px_10px_0px_rgba(0,0,0,0.25)] p-10 sm:p-12 font-sans select-text shrink-0 leading-relaxed ${templateId === "minimalist_executive" ? "font-serif" : "font-sans"
                        }`}
                >
                    {/* Header */}
                    <div className="text-center pb-4 border-b border-black/40 space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            {contact.fullName || "Candidate Name"}
                        </h1>
                        {contact.headline && (
                            <p className="text-xs sm:text-sm font-semibold text-neutral-600">
                                {contact.headline}
                            </p>
                        )}
                        {contactParts.length > 0 && (
                            <p className="text-[11px] font-medium text-neutral-700 tracking-wide pt-1">
                                {contactParts.join("  |  ")}
                            </p>
                        )}
                    </div>

                    {/* Summary */}
                    {summary && visible.summary !== false && (
                        <div className="mt-4 space-y-1">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Professional Summary
                            </h2>
                            <p className="text-[11px] leading-relaxed text-neutral-800 font-normal">
                                {summary}
                            </p>
                        </div>
                    )}

                    {/* Education */}
                    {education.length > 0 && visible.education !== false && (
                        <div className="mt-4 space-y-2">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Education
                            </h2>
                            {education.map((edu, idx) => (
                                <div key={idx} className="space-y-0.5">
                                    <div className="flex items-baseline justify-between text-xs font-bold text-black">
                                        <span>{edu.institution}</span>
                                        <span className="text-[11px] font-medium text-neutral-600">{edu.location}</span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-[11px] italic text-neutral-700">
                                        <span>
                                            {edu.degree}
                                            {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}
                                            {edu.cgpa ? ` (CGPA: ${edu.cgpa})` : ""}
                                        </span>
                                        <span className="text-[10px] font-normal not-italic text-neutral-600">
                                            {edu.expectedGraduation ? `Expected: ${edu.expectedGraduation}` : edu.endDate}
                                        </span>
                                    </div>
                                    {edu.highlights && edu.highlights.length > 0 && (
                                        <ul className="list-disc list-inside text-[10.5px] text-neutral-700 pl-1 pt-0.5">
                                            {edu.highlights.map((h, hIdx) => (
                                                <li key={hIdx}>{h}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Technical Skills */}
                    {skills.length > 0 && visible.skills !== false && (
                        <div className="mt-4 space-y-1.5">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Technical Skills
                            </h2>
                            <div className="space-y-1 text-[11px]">
                                {skills.map((cat, idx) => (
                                    <div key={idx} className="flex items-baseline gap-1.5">
                                        <span className="font-bold text-black shrink-0">{cat.category}:</span>
                                        <span className="text-neutral-800">{cat.items.join(", ")}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Software Engineering Projects */}
                    {projects.length > 0 && visible.projects !== false && (
                        <div className="mt-4 space-y-2.5">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Software Engineering Projects
                            </h2>
                            {projects.map((proj, idx) => (
                                <div key={idx} className="space-y-0.5">
                                    <div className="flex items-baseline justify-between text-xs">
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-black">{proj.title}</span>
                                            {proj.technologies && proj.technologies.length > 0 && (
                                                <span className="text-[10.5px] italic text-neutral-600">
                                                    | {proj.technologies.join(", ")}
                                                </span>
                                            )}
                                        </div>
                                        {(proj.liveUrl || proj.githubUrl) && (
                                            <a
                                                href={proj.liveUrl || proj.githubUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[10.5px] text-blue-700 hover:underline inline-flex items-center gap-0.5"
                                            >
                                                <span>{(proj.liveUrl || proj.githubUrl)?.replace(/^https?:\/\//i, "")}</span>
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        )}
                                    </div>

                                    <ul className="list-disc list-inside text-[11px] text-neutral-800 pl-1 space-y-0.5">
                                        {(proj.bullets || []).map((b, bIdx) => (
                                            <li key={bIdx} className="leading-relaxed">
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Work Experience */}
                    {experience.length > 0 && visible.experience !== false && (
                        <div className="mt-4 space-y-2.5">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Work Experience & Internships
                            </h2>
                            {experience.map((exp, idx) => (
                                <div key={idx} className="space-y-0.5">
                                    <div className="flex items-baseline justify-between text-xs font-bold text-black">
                                        <span>{exp.company}</span>
                                        <span className="text-[11px] font-medium text-neutral-600">{exp.location}</span>
                                    </div>
                                    <div className="flex items-baseline justify-between text-[11px] italic text-neutral-700">
                                        <span>{exp.role}</span>
                                        <span className="text-[10px] font-normal not-italic text-neutral-600">
                                            {[exp.startDate, exp.isCurrent ? "Present" : exp.endDate].filter(Boolean).join(" - ")}
                                        </span>
                                    </div>
                                    <ul className="list-disc list-inside text-[11px] text-neutral-800 pl-1 space-y-0.5">
                                        {(exp.bullets || []).map((b, bIdx) => (
                                            <li key={bIdx} className="leading-relaxed">
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Verified Coding Profiles */}
                    {codingProfiles.length > 0 && visible.codingProfiles !== false && (
                        <div className="mt-4 space-y-1.5">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Verified Coding Profiles & Developer Activity
                            </h2>
                            <ul className="list-disc list-inside text-[11px] text-neutral-800 pl-1 space-y-1">
                                {codingProfiles.map((p, idx) => (
                                    <li key={idx}>
                                        <span className="font-bold text-black capitalize">{p.portal}</span> (@{p.username}):{" "}
                                        {p.totalSolved ? `${p.totalSolved.toLocaleString()} Solved` : ""}
                                        {p.contestRating ? `  |  Rating ${p.contestRating}` : ""}
                                        {p.globalRank ? `  |  Rank ${p.globalRank}` : ""}
                                        {p.verified && (
                                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold text-black bg-[#a2ff86] px-1 py-0.2 rounded border border-black">
                                                <ShieldCheck className="w-2.5 h-2.5 text-black" />
                                                Orbix Verified
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Certifications */}
                    {certifications.length > 0 && visible.certifications !== false && (
                        <div className="mt-4 space-y-1">
                            <h2 className="text-xs font-black tracking-wider uppercase text-black border-b border-black pb-0.5">
                                Certifications & Honors
                            </h2>
                            <ul className="list-disc list-inside text-[11px] text-neutral-800 pl-1 space-y-0.5">
                                {certifications.map((c, idx) => (
                                    <li key={idx}>
                                        <span className="font-bold">{c.title}</span>
                                        {c.issuer ? ` — ${c.issuer}` : ""}
                                        {c.date ? ` (${c.date})` : ""}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
