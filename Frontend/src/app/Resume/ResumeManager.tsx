import React, { useState, useEffect } from "react";
import {
    Sparkles,
    FileText,
    Download,
    UploadCloud,
    ShieldCheck,
    Eye,
    RefreshCw,
    ExternalLink,
    Trash2,
    CheckCircle2,
    Globe,
    Lock,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppSelector } from "../../store";
import {
    fetchResumeDetailsApi,
    reAnalyzeResumeApi,
    toggleResumeVisibilityApi,
    deleteResumeApi,
    type ResumeProfileData,
    type GeminiAnalysisReport,
} from "../../utils/resumeIntelligenceApi";
import { ResumeAnalyzerView } from "./Intelligence/ResumeAnalyzerView";
import { ResumeUploadModal } from "./Intelligence/ResumeUploadModal";

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

    // Resume Profile Data & Gemini Analysis Report
    const [resumeData, setResumeData] = useState<ResumeProfileData | null>(null);
    const [analysisReport, setAnalysisReport] = useState<GeminiAnalysisReport | null>(null);

    // Loading & Async states
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isReAnalyzing, setIsReAnalyzing] = useState(false);
    const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

    // Modals
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // Initial load: Fetch current profile resume and its Gemini analysis report
    useEffect(() => {
        let isMounted = true;

        fetchResumeDetailsApi()
            .then((data: ResumeProfileData) => {
                if (!isMounted) return;
                setResumeData(data);
                if (data.metadata?.analysisReport) {
                    setAnalysisReport(data.metadata.analysisReport);
                }
            })
            .catch((err: any) => {
                console.warn("Failed to fetch initial resume details:", err?.message);
            })
            .finally(() => {
                if (isMounted) setIsLoadingInitial(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Re-analyze existing resume with Gemini AI models
    const handleReAnalyze = async () => {
        if (!resumeData?.hasResume) return;
        setIsReAnalyzing(true);
        try {
            const data = await reAnalyzeResumeApi();
            setAnalysisReport(data.report);
            toast.success("Resume re-analyzed with Gemini AI!", {
                title: "Gemini Analysis Complete",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to re-analyze resume with Gemini AI", {
                title: "Analysis Failed",
            });
        } finally {
            setIsReAnalyzing(false);
        }
    };

    // Toggle public visibility on profile
    const handleToggleVisibility = async () => {
        if (!resumeData) return;
        setIsTogglingVisibility(true);
        const newStatus = !resumeData.isResumePublic;
        try {
            await toggleResumeVisibilityApi(newStatus);
            setResumeData((prev: ResumeProfileData | null) => (prev ? { ...prev, isResumePublic: newStatus } : prev));
            toast.success(
                newStatus
                    ? "Resume is now publicly visible on your profile"
                    : "Resume is now private and hidden from your public profile",
                { title: "Visibility Updated" }
            );
        } catch (err: any) {
            toast.error(err?.message || "Failed to update resume visibility");
        } finally {
            setIsTogglingVisibility(false);
        }
    };

    // Delete current resume
    const handleDeleteResume = async () => {
        if (!window.confirm("Are you sure you want to remove your resume from your profile?")) return;
        try {
            await deleteResumeApi();
            setResumeData(null);
            setAnalysisReport(null);
            toast.success("Resume removed from profile successfully.");
        } catch (err: any) {
            toast.error(err?.message || "Failed to remove resume");
        }
    };

    // Upload Success Handler
    const handleUploadSuccess = (newResume: ResumeProfileData, newReport: GeminiAnalysisReport | null) => {
        setResumeData(newResume);
        if (newReport) {
            setAnalysisReport(newReport);
        }
        toast.success("Resume uploaded and analyzed with Gemini AI successfully!", {
            title: "Attached to Profile",
        });
    };

    return (
        <section
            aria-label="Orbix Resume Intelligence & Profile Resume"
            className={`flex-1 w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between ${className}`}
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                <div className="mx-auto w-full max-w-7xl my-1">
                    {/* ========================================================================= */}
                    {/* PAGE HEADER: Product Title, Value Promise & Top Action Buttons */}
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
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-[#FFE566] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Gemini AI Powered
                                    </span>
                                </div>
                                <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed max-w-2xl">
                                    Upload your resume for deep Gemini AI recruiter evaluation. Your resume is automatically linked to your public developer profile.
                                </p>
                            </div>
                        </div>

                        {/* Top Header Actions */}
                        <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start lg:self-center">
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                            >
                                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                                <span>{resumeData?.hasResume ? "Upload New Resume" : "Upload Resume"}</span>
                            </button>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* CURRENT PROFILE RESUME STATUS CARD */}
                    {/* ========================================================================= */}
                    {isLoadingInitial ? (
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] animate-pulse flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-neutral-200" />
                            <div className="space-y-2 flex-1">
                                <div className="h-4 w-48 bg-neutral-200 rounded" />
                                <div className="h-3 w-32 bg-neutral-100 rounded" />
                            </div>
                        </div>
                    ) : resumeData?.hasResume ? (
                        <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black/10">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                        <FileText className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base sm:text-lg font-black text-black truncate max-w-sm">
                                                {resumeData.resumeFilename || "Developer Resume.pdf"}
                                            </h3>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                                Attached to Your Profile
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-600 font-mono mt-0.5">
                                            {resumeData.resumeFilesize ? `${(resumeData.resumeFilesize / (1024 * 1024)).toFixed(2)} MB` : "PDF Document"} •{" "}
                                            {resumeData.resumeUpdatedAt ? `Updated ${new Date(resumeData.resumeUpdatedAt).toLocaleDateString()}` : "Active"}
                                        </p>
                                    </div>
                                </div>

                                {/* Visibility Toggle & Profile Shortcut */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={handleToggleVisibility}
                                        disabled={isTogglingVisibility}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer ${
                                            resumeData.isResumePublic
                                                ? "bg-[#a2ff86] text-black hover:bg-[#8ee872]"
                                                : "bg-neutral-200 text-neutral-800 hover:bg-neutral-300"
                                        }`}
                                        title={resumeData.isResumePublic ? "Resume is visible on your public profile" : "Resume is hidden from your public profile"}
                                    >
                                        {resumeData.isResumePublic ? (
                                            <>
                                                <Globe className="w-3.5 h-3.5" />
                                                <span>Public on Profile</span>
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-3.5 h-3.5" />
                                                <span>Private (Hidden)</span>
                                            </>
                                        )}
                                    </button>

                                    {user?.username && (
                                        <a
                                            href={`/${user.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-[#f3ebd9] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] transition-all"
                                            title="View your public developer profile"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">View Profile</span>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Resume Actions Bar */}
                            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {resumeData.resumeUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setIsPreviewModalOpen(true)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>View Resume PDF</span>
                                        </button>
                                    )}

                                    {resumeData.resumeUrl && (
                                        <a
                                            href={resumeData.resumeUrl}
                                            download={resumeData.resumeFilename || "resume.pdf"}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Download</span>
                                        </a>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleReAnalyze}
                                        disabled={isReAnalyzing}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isReAnalyzing ? "animate-spin" : ""}`} />
                                        <span>{isReAnalyzing ? "Re-Analyzing..." : "Re-Analyze with Gemini"}</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleDeleteResume}
                                    className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                    title="Remove resume from profile"
                                >
                                    <Trash2 className="w-4 h-4 stroke-[2]" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Empty State: Dropzone to Upload */
                        <div className="mb-6 p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                                <UploadCloud className="w-8 h-8 text-black stroke-[2.5]" />
                            </div>
                            <div className="space-y-1.5 max-w-lg mx-auto">
                                <h3 className="text-xl font-black text-black">Upload Your Developer Resume</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Upload your resume (PDF or DOCX). Our Gemini AI models will analyze your technical depth, ATS compliance, and quantifiable metrics, automatically preparing an in-depth recruiter report while attaching your resume to your public Orbix profile.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs sm:text-sm font-black uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                            >
                                <Sparkles className="w-4 h-4 stroke-[2.5]" />
                                <span>Upload & Analyze with Gemini</span>
                            </button>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* GEMINI AI ANALYSIS REPORT VIEW */}
                    {/* ========================================================================= */}
                    <ResumeAnalyzerView
                        report={analysisReport}
                        isAnalyzing={isReAnalyzing}
                        onReAnalyze={handleReAnalyze}
                        onUploadClick={() => setIsUploadModalOpen(true)}
                    />
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
            {/* UPLOAD MODAL */}
            {/* ========================================================================= */}
            <ResumeUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />

            {/* ========================================================================= */}
            {/* INTERACTIVE PDF PREVIEW MODAL */}
            {/* ========================================================================= */}
            {isPreviewModalOpen && resumeData?.resumeUrl && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsPreviewModalOpen(false);
                    }}
                >
                    <div className="w-full max-w-5xl h-[88vh] bg-[#FAF6EE] border-2 border-black rounded-3xl overflow-hidden shadow-[8px_8px_0px_#000] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black bg-white">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black text-black flex items-center justify-center shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <FileText className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-black truncate max-w-sm">
                                        {resumeData.resumeFilename || "Resume.pdf"}
                                    </h3>
                                    <p className="text-[11px] text-neutral-600 font-mono font-bold">
                                        Active Profile Resume
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={resumeData.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                    title="Open PDF in new tab"
                                >
                                    <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                                </a>
                                <a
                                    href={resumeData.resumeUrl}
                                    download={resumeData.resumeFilename || "resume.pdf"}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                    title="Download resume"
                                >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Download</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewModalOpen(false)}
                                    className="px-3 py-1.5 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 w-full bg-white relative overflow-hidden flex items-center justify-center">
                            <iframe
                                src={`${resumeData.resumeUrl}#toolbar=1&navpanes=0`}
                                title="Resume PDF Preview"
                                className="w-full h-full border-0"
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ResumeManager;
