import React, { useState, useEffect, useCallback } from "react";
import {
    Sparkles,
    FileText,
    Target,
    Download,
    UploadCloud,
    ShieldCheck,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import {
    fetchProfileDataForResume,
    fetchResumeDocuments,
    createResumeDocument,
    updateResumeDocument,
    createResumeVersion,
    analyzeResumeApi,
} from "../../utils/resumeIntelligenceApi";
import type {
    ResumeContent,
    ResumeDocument,
    ResumeVersion,
    AnalysisReport,
    ProfileImportSummary,
} from "../../../../Backend/src/services/resume/resumeTypes";
import { ResumeEditor } from "./Studio/ResumeEditor";
import { ResumeDocumentPreview } from "./Studio/ResumeDocumentPreview";
import { ProfileImportModal } from "./Studio/ProfileImportModal";
import { ResumeAnalyzerView } from "./Intelligence/ResumeAnalyzerView";
import { ResumeUploadModal } from "./Intelligence/ResumeUploadModal";
import { JobMatchView } from "./JobMatch/JobMatchView";
import { ExportModal } from "./Export/ExportModal";

interface ResumeManagerProps {
    onOpenMobileSidebar?: () => void;
    className?: string;
}

export const ResumeManager: React.FC<ResumeManagerProps> = ({
    onOpenMobileSidebar,
    className = "",
}) => {
    const toast = useToast();
    const user = useAppSelector((state) => state.user.user);

    // Top-level Navigation: "studio" | "intelligence" | "jobmatch"
    const [activeTab, setActiveTab] = useState<"studio" | "intelligence" | "jobmatch">("studio");

    // Studio View Mode on Mobile: "editor" | "preview"
    const [studioMobileView, setStudioMobileView] = useState<"editor" | "preview">("editor");

    // State for Documents, Versions & Content
    const [documents, setDocuments] = useState<ResumeDocument[]>([]);
    const [activeDocId, setActiveDocId] = useState<string | null>(null);
    const [versions, setVersions] = useState<ResumeVersion[]>([]);
    const [currentVersionNumber, setCurrentVersionNumber] = useState<number>(1);
    const [templateId, setTemplateId] = useState<string>("ats_clean_single");
    const [targetRole, setTargetRole] = useState<string>("Full Stack Engineer");

    // Primary Editable Content Draft
    const [resumeContent, setResumeContent] = useState<ResumeContent>(() => ({
        contact: {
            fullName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "Developer",
            headline: user?.headline || "Software Engineer",
            email: user?.gmail || "developer@example.com",
            phone: "",
            location: user?.location || "",
            githubUrl: user?.github || "",
            linkedinUrl: user?.linkedin || "",
            portfolioUrl: user?.website || "",
            includeEmail: true,
            includePhone: true,
            includeLocation: Boolean(user?.location),
        },
        summary: user?.bio || "Analytical software engineer with hands-on experience building scalable applications, designing clean APIs, and solving complex algorithmic challenges.",
        education: [
            {
                id: "edu_default",
                institution: user?.college?.officialName || "Indian Institute of Technology",
                degree: "Bachelor of Technology",
                fieldOfStudy: "Computer Science & Engineering",
                expectedGraduation: "2026",
                cgpa: "8.5/10",
                location: user?.location || "Bengaluru, India",
                highlights: ["Relevant Coursework: Data Structures & Algorithms, Operating Systems, Database Management Systems"],
            },
        ],
        skills: [
            { category: "Languages", items: ["TypeScript", "JavaScript", "Python", "SQL"] },
            { category: "Frameworks & Libraries", items: ["React", "Node.js", "Express", "Tailwind CSS"] },
            { category: "Databases & Tools", items: ["PostgreSQL", "Redis", "Docker", "Git"] },
        ],
        projects: [
            {
                id: "proj_default",
                title: "DevPulse - Real-Time Code Collaboration",
                subtitle: "Full Stack Application",
                technologies: ["React", "TypeScript", "Node.js", "PostgreSQL"],
                liveUrl: "https://devpulse.dev",
                githubUrl: "https://github.com/developer/devpulse",
                bullets: [
                    "Architected a scalable real-time collaborative workspace supporting concurrent editing sessions using WebSockets.",
                    "Engineered clean RESTful endpoints and optimized database indexing, decreasing query execution latency by 35%.",
                ],
            },
        ],
        experience: [],
        codingProfiles: [],
        certifications: [],
        sectionOrder: ["contact", "summary", "education", "skills", "projects", "codingProfiles", "experience", "certifications"],
        visibleSections: {
            contact: true,
            summary: true,
            education: true,
            skills: true,
            projects: true,
            codingProfiles: true,
            experience: false,
            certifications: false,
        },
    }));

    // Loading & Async States
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isImportLoading, setIsImportLoading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Modals
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    // Profile Import Summary & Analysis Report
    const [importSummary, setImportSummary] = useState<ProfileImportSummary | null>(null);
    const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);

    // Load initial documents and pre-fetch profile import summary
    useEffect(() => {
        let isMounted = true;

        Promise.all([
            fetchResumeDocuments().catch(() => []),
            fetchProfileDataForResume().catch(() => null),
        ]).then(([docs, profileSummary]) => {
            if (!isMounted) return;

            if (profileSummary) {
                setImportSummary(profileSummary);
            }

            if (docs.length > 0) {
                setDocuments(docs);
                const primaryDoc = docs.find((d) => d.isPrimary) || docs[0];
                if (primaryDoc) {
                    setActiveDocId(primaryDoc.id);
                    setResumeContent(primaryDoc.content);
                    setTemplateId(primaryDoc.templateId || "ats_clean_single");
                    setTargetRole(primaryDoc.targetRole || "Full Stack Engineer");
                }
            } else if (profileSummary) {
                // If user has no saved resume documents, initialize content directly from profile!
                setResumeContent(profileSummary.profileData);
            }

            setIsLoadingInitial(false);
        });

        return () => {
            isMounted = false;
        };
    }, []);

    // Run real analysis whenever content changes (debounced)
    const runAnalysis = useCallback(async (contentToAnalyze: ResumeContent) => {
        setIsAnalyzing(true);
        try {
            const report = await analyzeResumeApi({
                resumeId: activeDocId || undefined,
                content: contentToAnalyze,
            });
            setAnalysisReport(report);
        } catch (err: any) {
            console.warn("Analysis run warning:", err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [activeDocId]);

    // Initial analysis when loading finishes
    useEffect(() => {
        if (!isLoadingInitial && resumeContent) {
            runAnalysis(resumeContent);
        }
    }, [isLoadingInitial]);

    // Handle Content Edits
    const handleContentChange = (updated: ResumeContent) => {
        setResumeContent(updated);
        setHasUnsavedChanges(true);
    };

    // Save Draft
    const handleSaveDraft = async () => {
        setIsSaving(true);
        try {
            if (activeDocId) {
                const updated = await updateResumeDocument(activeDocId, {
                    content: resumeContent,
                    templateId,
                    targetRole,
                    completenessScore: importSummary?.completenessMap.score || 75,
                });
                setDocuments((prev) => prev.map((d) => (d.id === activeDocId ? updated : d)));
            } else {
                const created = await createResumeDocument({
                    title: `${(resumeContent.contact.fullName || "Developer").split(" ")[0]}'s Resume`,
                    targetRole,
                    templateId,
                    content: resumeContent,
                    completenessScore: importSummary?.completenessMap.score || 75,
                    isPrimary: true,
                });
                setActiveDocId(created.id);
                setDocuments([created]);
            }

            setHasUnsavedChanges(false);
            toast.success("Resume draft saved successfully!", { title: "Draft Saved" });
            runAnalysis(resumeContent);
        } catch (err: any) {
            toast.error(err?.message || "Failed to save draft", { title: "Save Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    // Apply Profile Import
    const handleApplyImport = (importedContent: ResumeContent) => {
        setResumeContent(importedContent);
        setHasUnsavedChanges(true);
        toast.success("Profile details imported! Review missing fields and edit below.", {
            title: "Profile Imported",
        });
        runAnalysis(importedContent);
    };

    // Create New Version
    const handleCreateVersion = async (versionLabel: string, role: string) => {
        if (!activeDocId) {
            await handleSaveDraft();
        }

        if (activeDocId) {
            try {
                const newVer = await createResumeVersion(activeDocId, {
                    versionLabel,
                    targetRole: role || targetRole,
                    content: resumeContent,
                });
                setVersions((prev) => [newVer, ...prev]);
                setCurrentVersionNumber(newVer.versionNumber);
                toast.success(`Created independent version: ${versionLabel}`, { title: "Version Created" });
            } catch (err: any) {
                toast.error(err?.message || "Failed to create version");
            }
        }
    };

    // Apply Tailored Version from Job Match
    const handleApplyTailoredVersion = async (tailoredContent: ResumeContent, label: string, role: string) => {
        setResumeContent(tailoredContent);
        setTargetRole(role);
        setActiveTab("studio");
        setHasUnsavedChanges(true);
        toast.success(`Tailored version created for ${role}! Review in Studio.`, {
            title: "Tailored Version Ready",
        });

        if (activeDocId) {
            await createResumeVersion(activeDocId, {
                versionLabel: label,
                targetRole: role,
                content: tailoredContent,
            });
        }
        runAnalysis(tailoredContent);
    };

    // Import Uploaded Resume Draft
    const handleImportUploadedDraft = (draft: ResumeContent, report: AnalysisReport) => {
        setResumeContent(draft);
        setAnalysisReport(report);
        setHasUnsavedChanges(true);
        setActiveTab("studio");
        toast.success("Uploaded resume converted into an editable draft!", {
            title: "Document Imported",
        });
    };

    // Navigate to a specific section from Analysis findings
    const handleNavigateSection = (sectionId: string) => {
        setActiveTab("studio");
        setStudioMobileView("editor");
        setTimeout(() => {
            const el = document.getElementById(`section_${sectionId}`);
            if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 150);
    };

    return (
        <section
            aria-label="Orbix Resume Intelligence & Studio"
            className={`flex-1 w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between ${className}`}
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                <div className="mx-auto w-full max-w-7xl my-1">
                    {/* ========================================================================= */}
                    {/* PAGE HEADER: Product Title, Value Promise & Top-Level Action Buttons */}
                    {/* ========================================================================= */}
                    <div className="mb-6 pb-5 border-b-2 border-black/55 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            {onOpenMobileSidebar && (
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="lg:hidden mt-0.5 p-2 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer shrink-0"
                                    aria-label="Open sidebar"
                                >
                                    <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <line x1="3" y1="12" x2="21" y2="12" />
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="18" x2="21" y2="18" />
                                    </svg>
                                </button>
                            )}
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-black">
                                        Resume Intelligence
                                    </h1>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-[#a2ff86] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Verified System
                                    </span>
                                    {hasUnsavedChanges && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFE566] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                            Unsaved draft
                                        </span>
                                    )}
                                    {documents.length > 1 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-200 text-black border-2 border-black">
                                            {documents.length} Drafts
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed max-w-2xl">
                                    Your developer profile, transformed into a verified, professional, job-ready resume in minutes.
                                </p>
                            </div>
                        </div>

                        {/* Top Header Actions */}
                        <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start lg:self-center">
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Build from My Profile</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                            >
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Upload Existing</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsExportModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800 cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Export</span>
                            </button>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* THREE CONNECTED EXPERIENCES: Segmented Navigation Pill */}
                    {/* ========================================================================= */}
                    <div className="mb-6 flex items-center justify-between gap-4 flex-wrap pb-1">
                        <div className="inline-flex items-center p-1 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab("studio")}
                                className={`inline-flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeTab === "studio"
                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                <span>Resume Studio — Build</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("intelligence")}
                                className={`inline-flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeTab === "intelligence"
                                    ? "bg-black text-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                    }`}
                            >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Resume Intelligence — Analyze</span>
                                {analysisReport && (
                                    <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] bg-[#FFE566] text-black border border-black font-mono">
                                        {analysisReport.overallScore}%
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab("jobmatch")}
                                className={`inline-flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeTab === "jobmatch"
                                    ? "bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                    }`}
                            >
                                <Target className="w-4 h-4" />
                                <span>Job Match — Tailor</span>
                            </button>
                        </div>

                        {/* Mobile Toggle for Studio (Editor vs Preview) */}
                        {activeTab === "studio" && (
                            <div className="lg:hidden inline-flex items-center p-1 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                                <button
                                    type="button"
                                    onClick={() => setStudioMobileView("editor")}
                                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${studioMobileView === "editor" ? "bg-black text-white" : "text-neutral-700"
                                        }`}
                                >
                                    Editor
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStudioMobileView("preview")}
                                    className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${studioMobileView === "preview" ? "bg-black text-white" : "text-neutral-700"
                                        }`}
                                >
                                    Preview
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ========================================================================= */}
                    {/* TAB 1: RESUME STUDIO — BUILD (Split View: Editor + Live Document Preview) */}
                    {/* ========================================================================= */}
                    {activeTab === "studio" && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Column: Responsive Section Editor */}
                            <div
                                className={`lg:col-span-6 space-y-4 ${studioMobileView === "preview" ? "hidden lg:block" : "block"
                                    }`}
                            >
                                <ResumeEditor
                                    content={resumeContent}
                                    onChange={handleContentChange}
                                    onSave={handleSaveDraft}
                                    isSaving={isSaving}
                                    versions={versions}
                                    currentVersionNumber={currentVersionNumber}
                                    onSelectVersion={(vNum) => {
                                        const found = versions.find((v) => v.versionNumber === vNum);
                                        if (found) {
                                            setResumeContent(found.content);
                                            setCurrentVersionNumber(vNum);
                                            toast.info(`Switched to version ${vNum}: ${found.versionLabel}`);
                                        }
                                    }}
                                    onCreateVersion={handleCreateVersion}
                                />
                            </div>

                            {/* Right Column: Live Document Preview with Vector Typography */}
                            <div
                                className={`lg:col-span-6 sticky top-4 h-[calc(100vh-180px)] ${studioMobileView === "editor" ? "hidden lg:block" : "block"
                                    }`}
                            >
                                <ResumeDocumentPreview
                                    content={resumeContent}
                                    templateId={templateId}
                                    onTemplateChange={setTemplateId}
                                    onTriggerExport={() => setIsExportModalOpen(true)}
                                />
                            </div>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 2: RESUME INTELLIGENCE — ANALYZE (8 Real Recruiter/ATS Checks) */}
                    {/* ========================================================================= */}
                    {activeTab === "intelligence" && (
                        <div className="animate-fadeIn">
                            <ResumeAnalyzerView
                                report={analysisReport}
                                isAnalyzing={isAnalyzing}
                                onReAnalyze={() => runAnalysis(resumeContent)}
                                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                                onNavigateSection={handleNavigateSection}
                            />
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* TAB 3: JOB MATCH — TAILOR (Keyword & Skills Match, Role Tailoring) */}
                    {/* ========================================================================= */}
                    {activeTab === "jobmatch" && (
                        <div className="animate-fadeIn">
                            <JobMatchView
                                content={resumeContent}
                                onApplyTailoredVersion={handleApplyTailoredVersion}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Illustration */}
            <div className="w-full mt-auto select-none pointer-events-none overflow-hidden rounded-b-[14px]">
                <img
                    src="/image.png"
                    alt="Orbix illustration"
                    className="w-full h-auto object-cover object-bottom block rounded-b-[14px]"
                    loading="eager"
                />
            </div>

            {/* ========================================================================= */}
            {/* MODALS */}
            {/* ========================================================================= */}
            <ProfileImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                summary={importSummary}
                isLoading={isImportLoading}
                onApplyImport={handleApplyImport}
                onRefresh={async () => {
                    setIsImportLoading(true);
                    try {
                        const fresh = await fetchProfileDataForResume();
                        setImportSummary(fresh);
                        toast.success("Profile sync updated!");
                    } finally {
                        setIsImportLoading(false);
                    }
                }}
            />

            <ResumeUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onImportDraft={handleImportUploadedDraft}
            />

            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                content={resumeContent}
                templateId={templateId}
            />
        </section>
    );
};

export default ResumeManager;
