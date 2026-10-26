import React, { useState } from "react";
import {
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    Eye,
    EyeOff,
    Save,
    GraduationCap,
    Code2,
    Briefcase,
    FolderGit2,
    User,
    FileText,
} from "lucide-react";
import type {
    ResumeContent,
    EducationEntry,
    ProjectEntry,
    WorkExperienceEntry,
    SkillCategory,
} from "../../../../../Backend/src/services/resume/resumeTypes";

interface ResumeEditorProps {
    content: ResumeContent;
    onChange: (updated: ResumeContent) => void;
    onSave: () => void;
    isSaving: boolean;
    versions: { id: string; versionNumber: number; versionLabel: string; targetRole?: string }[];
    currentVersionNumber: number;
    onSelectVersion?: (versionNumber: number) => void;
    onCreateVersion?: (label: string, role: string) => void;
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({
    content,
    onChange,
    onSave,
    isSaving,
    versions,
    currentVersionNumber,
    onSelectVersion,
    onCreateVersion,
}) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        contact: true,
        summary: true,
        education: true,
        skills: true,
        projects: true,
        experience: false,
        codingProfiles: true,
        certifications: false,
    });

    const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
    const [newVersionLabel, setNewVersionLabel] = useState("");
    const [newVersionRole, setNewVersionRole] = useState("");

    const toggleSection = (sec: string) => {
        setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
    };

    const toggleVisibility = (sec: string) => {
        const nextVis = { ...(content.visibleSections || {}) };
        nextVis[sec] = nextVis[sec] === false ? true : false;
        onChange({ ...content, visibleSections: nextVis });
    };

    // Contact field change
    const updateContact = (field: string, val: any) => {
        onChange({
            ...content,
            contact: { ...content.contact, [field]: val },
        });
    };

    // Summary change
    const updateSummary = (val: string) => {
        onChange({ ...content, summary: val });
    };

    // Education helpers
    const addEducation = () => {
        const newEdu: EducationEntry = {
            id: `edu_${Date.now()}`,
            institution: "University / Institute Name",
            degree: "Bachelor of Technology",
            fieldOfStudy: "Computer Science & Engineering",
            expectedGraduation: "2026",
            cgpa: "8.5/10",
            location: "City, State",
            highlights: ["Relevant Coursework: Data Structures, Operating Systems, Database Management"],
        };
        onChange({ ...content, education: [...content.education, newEdu] });
        setOpenSections((prev) => ({ ...prev, education: true }));
    };

    const removeEducation = (index: number) => {
        const updated = content.education.filter((_, i) => i !== index);
        onChange({ ...content, education: updated });
    };

    const updateEducationField = (index: number, field: keyof EducationEntry, val: any) => {
        const updated = [...content.education];
        updated[index] = { ...updated[index]!, [field]: val };
        onChange({ ...content, education: updated });
    };

    // Projects helpers
    const addProject = () => {
        const newProj: ProjectEntry = {
            id: `proj_${Date.now()}`,
            title: "New Software Project",
            subtitle: "Full Stack Application",
            technologies: ["React", "TypeScript", "Node.js", "PostgreSQL"],
            liveUrl: "",
            githubUrl: "",
            bullets: [
                "Architected a scalable full-stack web service utilizing TypeScript, React, and PostgreSQL.",
                "Engineered responsive user interfaces and implemented secure JWT-based session handling.",
            ],
        };
        onChange({ ...content, projects: [...content.projects, newProj] });
        setOpenSections((prev) => ({ ...prev, projects: true }));
    };

    const removeProject = (index: number) => {
        const updated = content.projects.filter((_, i) => i !== index);
        onChange({ ...content, projects: updated });
    };

    const updateProjectField = (index: number, field: keyof ProjectEntry, val: any) => {
        const updated = [...content.projects];
        updated[index] = { ...updated[index]!, [field]: val };
        onChange({ ...content, projects: updated });
    };

    const updateProjectBullet = (projIndex: number, bulletIndex: number, val: string) => {
        const updated = [...content.projects];
        const bullets = [...(updated[projIndex]!.bullets || [])];
        bullets[bulletIndex] = val;
        updated[projIndex] = { ...updated[projIndex]!, bullets };
        onChange({ ...content, projects: updated });
    };

    const addProjectBullet = (projIndex: number) => {
        const updated = [...content.projects];
        const bullets = [...(updated[projIndex]!.bullets || []), "Implemented core architecture with measurable performance improvements."];
        updated[projIndex] = { ...updated[projIndex]!, bullets };
        onChange({ ...content, projects: updated });
    };

    const removeProjectBullet = (projIndex: number, bulletIndex: number) => {
        const updated = [...content.projects];
        const bullets = updated[projIndex]!.bullets.filter((_, bIdx) => bIdx !== bulletIndex);
        updated[projIndex] = { ...updated[projIndex]!, bullets };
        onChange({ ...content, projects: updated });
    };

    // Experience helpers
    const addExperience = () => {
        const newExp: WorkExperienceEntry = {
            id: `exp_${Date.now()}`,
            company: "Company / Organization Name",
            role: "Software Engineering Intern",
            location: "Bengaluru, India",
            startDate: "May 2025",
            endDate: "Aug 2025",
            isCurrent: false,
            bullets: [
                "Collaborated with senior engineers to design and implement client-facing microservices.",
                "Streamlined CI/CD build scripts and automated integration test suites.",
            ],
        };
        onChange({
            ...content,
            experience: [...content.experience, newExp],
            visibleSections: { ...content.visibleSections, experience: true },
        });
        setOpenSections((prev) => ({ ...prev, experience: true }));
    };

    const removeExperience = (index: number) => {
        const updated = content.experience.filter((_, i) => i !== index);
        onChange({ ...content, experience: updated });
    };

    const updateExperienceField = (index: number, field: keyof WorkExperienceEntry, val: any) => {
        const updated = [...content.experience];
        updated[index] = { ...updated[index]!, [field]: val };
        onChange({ ...content, experience: updated });
    };

    // Skills helpers
    const updateSkillCategoryItems = (catIndex: number, rawInput: string) => {
        const items = rawInput
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const updated = [...content.skills];
        updated[catIndex] = { ...updated[catIndex]!, items };
        onChange({ ...content, skills: updated });
    };

    const addSkillCategory = () => {
        const newCat: SkillCategory = { category: "New Category", items: ["Git", "Docker"] };
        onChange({ ...content, skills: [...content.skills, newCat] });
    };

    const removeSkillCategory = (catIndex: number) => {
        const updated = content.skills.filter((_, i) => i !== catIndex);
        onChange({ ...content, skills: updated });
    };

    return (
        <div className="space-y-4">
            {/* Action & Version Control Bar */}
            <div className="p-3 sm:p-4 rounded-xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase text-black">Active Version:</span>
                    {versions.length > 0 ? (
                        <select
                            value={currentVersionNumber}
                            onChange={(e) => onSelectVersion && onSelectVersion(Number(e.target.value))}
                            className="text-xs font-bold bg-[#FAF6EE] border-2 border-black rounded-lg px-2.5 py-1 shadow-[2px_2px_0px_#000] outline-none cursor-pointer"
                        >
                            {versions.map((v) => (
                                <option key={v.id} value={v.versionNumber}>
                                    v{v.versionNumber}: {v.versionLabel} {v.targetRole ? `(${v.targetRole})` : ""}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FAF6EE] border border-black">
                            v1: Master Draft
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsNewVersionModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        title="Create separate version for specific roles (e.g. Internships, Full-Stack, DSA)"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Version</span>
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{isSaving ? "Saving..." : "Save Draft"}</span>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* 1. CONTACT INFORMATION */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("contact")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Contact Information & Links
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {openSections.contact ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.contact && (
                    <div className="p-4 sm:p-5 space-y-3.5 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={content.contact.fullName}
                                    onChange={(e) => updateContact("fullName", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="Your Full Name"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Headline / Target Title
                                </label>
                                <input
                                    type="text"
                                    value={content.contact.headline || ""}
                                    onChange={(e) => updateContact("headline", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="e.g. Full Stack Engineer | Open Source Contributor"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
                                        Email Address *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => updateContact("includeEmail", !content.contact.includeEmail)}
                                        className="text-[10px] font-bold text-neutral-600 hover:text-black cursor-pointer inline-flex items-center gap-0.5"
                                    >
                                        {content.contact.includeEmail ? <Eye className="w-3 h-3 text-black" /> : <EyeOff className="w-3 h-3 text-neutral-400" />}
                                    </button>
                                </div>
                                <input
                                    type="email"
                                    value={content.contact.email}
                                    onChange={(e) => updateContact("email", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="developer@example.com"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
                                        Phone Number (Optional)
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => updateContact("includePhone", !content.contact.includePhone)}
                                        className="text-[10px] font-bold text-neutral-600 hover:text-black cursor-pointer inline-flex items-center gap-0.5"
                                    >
                                        {content.contact.includePhone ? <Eye className="w-3 h-3 text-black" /> : <EyeOff className="w-3 h-3 text-neutral-400" />}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={content.contact.phone || ""}
                                    onChange={(e) => updateContact("phone", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="+91 9876543210"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
                                        Location
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => updateContact("includeLocation", !content.contact.includeLocation)}
                                        className="text-[10px] font-bold text-neutral-600 hover:text-black cursor-pointer inline-flex items-center gap-0.5"
                                    >
                                        {content.contact.includeLocation ? <Eye className="w-3 h-3 text-black" /> : <EyeOff className="w-3 h-3 text-neutral-400" />}
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={content.contact.location || ""}
                                    onChange={(e) => updateContact("location", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="Bengaluru, India"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    GitHub Profile
                                </label>
                                <input
                                    type="text"
                                    value={content.contact.githubUrl || ""}
                                    onChange={(e) => updateContact("githubUrl", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="https://github.com/username"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    LinkedIn Profile
                                </label>
                                <input
                                    type="text"
                                    value={content.contact.linkedinUrl || ""}
                                    onChange={(e) => updateContact("linkedinUrl", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="https://linkedin.com/in/username"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Portfolio / Website
                                </label>
                                <input
                                    type="text"
                                    value={content.contact.portfolioUrl || ""}
                                    onChange={(e) => updateContact("portfolioUrl", e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-1.5 font-bold text-black text-xs outline-none focus:bg-white"
                                    placeholder="https://myportfolio.dev"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 2. PROFESSIONAL SUMMARY */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("summary")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Professional Summary
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility("summary");
                            }}
                            className="text-xs text-neutral-600 hover:text-black cursor-pointer p-1"
                            title="Toggle visibility on final resume"
                        >
                            {content.visibleSections?.summary !== false ? <Eye className="w-4 h-4 text-black" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
                        </button>
                        {openSections.summary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.summary && (
                    <div className="p-4 sm:p-5 space-y-2">
                        <textarea
                            rows={3}
                            value={content.summary}
                            onChange={(e) => updateSummary(e.target.value)}
                            className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg p-3 font-medium text-black text-xs outline-none focus:bg-white leading-relaxed"
                            placeholder="Write a concise 2-3 sentence overview of your technical background, core focus, and engineering strengths..."
                        />
                        <p className="text-[11px] text-neutral-600 font-medium">
                            Keep under 50 words for fast recruiter skimming. Highlight primary languages and domain focus.
                        </p>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 3. EDUCATION */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("education")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Education ({content.education.length})
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility("education");
                            }}
                            className="text-xs text-neutral-600 hover:text-black cursor-pointer p-1"
                        >
                            {content.visibleSections?.education !== false ? <Eye className="w-4 h-4 text-black" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
                        </button>
                        {openSections.education ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.education && (
                    <div className="p-4 sm:p-5 space-y-4 text-xs">
                        {content.education.map((edu, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3 relative">
                                <button
                                    type="button"
                                    onClick={() => removeEducation(idx)}
                                    className="absolute top-2.5 right-2.5 p-1 text-neutral-500 hover:text-rose-600 cursor-pointer"
                                    title="Delete education entry"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            College / Institution *
                                        </label>
                                        <input
                                            type="text"
                                            value={edu.institution}
                                            onChange={(e) => updateEducationField(idx, "institution", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="Institution Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Location
                                        </label>
                                        <input
                                            type="text"
                                            value={edu.location || ""}
                                            onChange={(e) => updateEducationField(idx, "location", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="City, State"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Degree
                                        </label>
                                        <input
                                            type="text"
                                            value={edu.degree}
                                            onChange={(e) => updateEducationField(idx, "degree", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="e.g. B.Tech"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Branch / Field
                                        </label>
                                        <input
                                            type="text"
                                            value={edu.fieldOfStudy}
                                            onChange={(e) => updateEducationField(idx, "fieldOfStudy", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="Computer Science"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Expected / Grad Year & CGPA
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={edu.expectedGraduation || ""}
                                                onChange={(e) => updateEducationField(idx, "expectedGraduation", e.target.value)}
                                                className="w-1/2 bg-white border border-black rounded-lg px-2 py-1.5 font-bold text-black text-xs outline-none"
                                                placeholder="2026"
                                            />
                                            <input
                                                type="text"
                                                value={edu.cgpa || ""}
                                                onChange={(e) => updateEducationField(idx, "cgpa", e.target.value)}
                                                className="w-1/2 bg-white border border-black rounded-lg px-2 py-1.5 font-bold text-black text-xs outline-none"
                                                placeholder="8.9/10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addEducation}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Education Entry</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 4. TECHNICAL SKILLS */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("skills")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Technical Skills & Categorization
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {openSections.skills ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.skills && (
                    <div className="p-4 sm:p-5 space-y-3.5 text-xs">
                        {content.skills.map((cat, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2 relative">
                                <div className="flex items-center justify-between gap-2">
                                    <input
                                        type="text"
                                        value={cat.category}
                                        onChange={(e) => {
                                            const updated = [...content.skills];
                                            updated[idx] = { ...updated[idx]!, category: e.target.value };
                                            onChange({ ...content, skills: updated });
                                        }}
                                        className="bg-white border border-black rounded px-2 py-0.5 font-black text-black text-xs outline-none"
                                        placeholder="Category Name"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeSkillCategory(idx)}
                                        className="text-neutral-500 hover:text-rose-600 p-1 cursor-pointer"
                                        title="Remove category"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div>
                                    <input
                                        type="text"
                                        value={cat.items.join(", ")}
                                        onChange={(e) => updateSkillCategoryItems(idx, e.target.value)}
                                        className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-medium text-black text-xs outline-none"
                                        placeholder="Comma-separated: TypeScript, Python, React, PostgreSQL"
                                    />
                                    <p className="text-[10px] text-neutral-600 mt-1">Separate skills with commas.</p>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addSkillCategory}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Skill Category</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 5. SOFTWARE ENGINEERING PROJECTS */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("projects")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Software Engineering Projects ({content.projects.length})
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility("projects");
                            }}
                            className="text-xs text-neutral-600 hover:text-black cursor-pointer p-1"
                        >
                            {content.visibleSections?.projects !== false ? <Eye className="w-4 h-4 text-black" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
                        </button>
                        {openSections.projects ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.projects && (
                    <div className="p-4 sm:p-5 space-y-4 text-xs">
                        {content.projects.map((proj, pIdx) => (
                            <div key={pIdx} className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3 relative">
                                <button
                                    type="button"
                                    onClick={() => removeProject(pIdx)}
                                    className="absolute top-2.5 right-2.5 p-1 text-neutral-500 hover:text-rose-600 cursor-pointer"
                                    title="Delete project"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Project Title *
                                        </label>
                                        <input
                                            type="text"
                                            value={proj.title}
                                            onChange={(e) => updateProjectField(pIdx, "title", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="e.g. DevPulse"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Technologies (comma-separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={proj.technologies.join(", ")}
                                            onChange={(e) =>
                                                updateProjectField(
                                                    pIdx,
                                                    "technologies",
                                                    e.target.value
                                                        .split(",")
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                )
                                            }
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="React, TypeScript, Node.js, PostgreSQL"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            Live Demo URL
                                        </label>
                                        <input
                                            type="text"
                                            value={proj.liveUrl || ""}
                                            onChange={(e) => updateProjectField(pIdx, "liveUrl", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="https://app.domain.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                            GitHub Repository
                                        </label>
                                        <input
                                            type="text"
                                            value={proj.githubUrl || ""}
                                            onChange={(e) => updateProjectField(pIdx, "githubUrl", e.target.value)}
                                            className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                            placeholder="https://github.com/user/repo"
                                        />
                                    </div>
                                </div>

                                {/* Project Bullets */}
                                <div className="space-y-2 pt-1">
                                    <label className="block text-[10px] font-black uppercase text-neutral-700">
                                        Impact & Action Bullets ({proj.bullets.length})
                                    </label>
                                    {proj.bullets.map((b, bIdx) => (
                                        <div key={bIdx} className="flex items-start gap-2">
                                            <span className="mt-2 text-neutral-500 font-bold">•</span>
                                            <textarea
                                                rows={2}
                                                value={b}
                                                onChange={(e) => updateProjectBullet(pIdx, bIdx, e.target.value)}
                                                className="flex-1 bg-white border border-black rounded-lg p-2 font-medium text-black text-xs outline-none"
                                                placeholder="Start with an active verb (Architected, Engineered, Built) and describe technical implementation..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeProjectBullet(pIdx, bIdx)}
                                                className="mt-2 p-1 text-neutral-400 hover:text-rose-600 cursor-pointer"
                                                title="Remove bullet"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => addProjectBullet(pIdx)}
                                        className="inline-flex items-center gap-1 text-[11px] font-black text-black hover:underline cursor-pointer pt-0.5"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>Add bullet point</span>
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addProject}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Software Project</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 6. WORK EXPERIENCE & INTERNSHIPS (Optional for Students) */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("experience")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Work Experience & Internships ({content.experience.length})
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility("experience");
                            }}
                            className="text-xs text-neutral-600 hover:text-black cursor-pointer p-1"
                        >
                            {content.visibleSections?.experience !== false ? <Eye className="w-4 h-4 text-black" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
                        </button>
                        {openSections.experience ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.experience && (
                    <div className="p-4 sm:p-5 space-y-4 text-xs">
                        {content.experience.length === 0 ? (
                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-center space-y-2">
                                <p className="text-xs font-bold text-neutral-800">
                                    No work experience added yet.
                                </p>
                                <p className="text-[11px] text-neutral-600">
                                    Freshers and students are NOT penalized for not having work experience. Highlight your projects and education instead.
                                </p>
                                <button
                                    type="button"
                                    onClick={addExperience}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Internship / Job</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                {content.experience.map((exp, idx) => (
                                    <div key={idx} className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3 relative">
                                        <button
                                            type="button"
                                            onClick={() => removeExperience(idx)}
                                            className="absolute top-2.5 right-2.5 p-1 text-neutral-500 hover:text-rose-600 cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-6">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                                    Company / Organization *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={exp.company}
                                                    onChange={(e) => updateExperienceField(idx, "company", e.target.value)}
                                                    className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                                    placeholder="Company Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                                    Role / Title *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={exp.role}
                                                    onChange={(e) => updateExperienceField(idx, "role", e.target.value)}
                                                    className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                                    placeholder="Software Engineer Intern"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                                    Location
                                                </label>
                                                <input
                                                    type="text"
                                                    value={exp.location || ""}
                                                    onChange={(e) => updateExperienceField(idx, "location", e.target.value)}
                                                    className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                                    placeholder="Bengaluru, India"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                                    Start Date
                                                </label>
                                                <input
                                                    type="text"
                                                    value={exp.startDate || ""}
                                                    onChange={(e) => updateExperienceField(idx, "startDate", e.target.value)}
                                                    className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                                    placeholder="Jan 2025"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase text-neutral-700 mb-1">
                                                    End Date
                                                </label>
                                                <input
                                                    type="text"
                                                    value={exp.endDate || ""}
                                                    onChange={(e) => updateExperienceField(idx, "endDate", e.target.value)}
                                                    className="w-full bg-white border border-black rounded-lg px-2.5 py-1.5 font-bold text-black text-xs outline-none"
                                                    placeholder="Present or Jun 2025"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addExperience}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Another Work Experience</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 7. VERIFIED CODING PROFILES (Orbix Authenticated) */}
            {/* ========================================================================= */}
            <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] overflow-hidden">
                <div
                    onClick={() => toggleSection("codingProfiles")}
                    className="p-3.5 sm:px-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-black" />
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                            Verified Coding Profiles ({content.codingProfiles.length})
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility("codingProfiles");
                            }}
                            className="text-xs text-neutral-600 hover:text-black cursor-pointer p-1"
                        >
                            {content.visibleSections?.codingProfiles !== false ? <Eye className="w-4 h-4 text-black" /> : <EyeOff className="w-4 h-4 text-neutral-400" />}
                        </button>
                        {openSections.codingProfiles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </div>

                {openSections.codingProfiles && (
                    <div className="p-4 sm:p-5 space-y-3 text-xs">
                        {content.codingProfiles.length === 0 ? (
                            <p className="text-neutral-600">
                                No coding profiles linked. Connect LeetCode, Codeforces, or GitHub in Orbix to display verified badges and solve counts.
                            </p>
                        ) : (
                            content.codingProfiles.map((p, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded bg-[#a2ff86] border border-black flex items-center justify-center font-black capitalize text-xs">
                                            {p.portal.slice(0, 2)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-black text-black capitalize">{p.portal}</span>
                                                <span className="text-neutral-600 font-bold">(@{p.username})</span>
                                                {p.verified && (
                                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase bg-black text-[#a2ff86] px-1.5 py-0.2 rounded">
                                                        Verified
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-neutral-600">
                                                {p.totalSolved ? `${p.totalSolved.toLocaleString()} solved` : ""}
                                                {p.contestRating ? ` · Rating ${p.contestRating}` : ""}
                                            </p>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        value={p.url}
                                        onChange={(e) => {
                                            const updated = [...content.codingProfiles];
                                            updated[idx] = { ...updated[idx]!, url: e.target.value };
                                            onChange({ ...content, codingProfiles: updated });
                                        }}
                                        className="bg-white border border-black rounded px-2 py-1 text-xs font-mono text-neutral-800 max-w-[200px] truncate"
                                    />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* New Version Modal */}
            {isNewVersionModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
                >
                    <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] space-y-4 text-black">
                        <h3 className="text-base font-black uppercase tracking-tight text-black">
                            Create New Role Version
                        </h3>
                        <p className="text-xs text-neutral-600 leading-relaxed">
                            Create a separate, independent version for a specific role without losing your original master resume.
                        </p>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Version Label *
                                </label>
                                <input
                                    type="text"
                                    value={newVersionLabel}
                                    onChange={(e) => setNewVersionLabel(e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-2 font-bold text-black text-xs outline-none"
                                    placeholder="e.g. Full Stack Role or Summer 2026 Internship"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Target Role (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newVersionRole}
                                    onChange={(e) => setNewVersionRole(e.target.value)}
                                    className="w-full bg-[#FAF6EE] border-2 border-black rounded-lg px-3 py-2 font-bold text-black text-xs outline-none"
                                    placeholder="e.g. Backend Engineer"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIsNewVersionModalOpen(false)}
                                className="px-4 py-2 rounded-lg bg-white border-2 border-black text-xs font-black uppercase cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!newVersionLabel.trim()}
                                onClick={() => {
                                    if (onCreateVersion && newVersionLabel.trim()) {
                                        onCreateVersion(newVersionLabel.trim(), newVersionRole.trim());
                                        setIsNewVersionModalOpen(false);
                                        setNewVersionLabel("");
                                        setNewVersionRole("");
                                    }
                                }}
                                className="px-4 py-2 rounded-lg bg-[#a2ff86] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                            >
                                Create Version
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
