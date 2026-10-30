import React, { useState, useEffect, useRef } from "react";
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
    TrendingUp,
    Check,
    Lightbulb,
    AlertTriangle,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch, updateUserProfile } from "../../store";
import {
    fetchResumeDetailsApi,
    reAnalyzeResumeApi,
    toggleResumeVisibilityApi,
    deleteResumeApi,
    uploadResumeApi,
    type ResumeProfileData,
    type GeminiAnalysisReport,
} from "../../utils/resumeIntelligenceApi";
import { ResumeAnalyzerView } from "./Intelligence/ResumeAnalyzerView";
import { ResumeUploadModal } from "./Intelligence/ResumeUploadModal";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { NeoToggle } from "../../components/NeoToggle";

interface ResumeManagerProps {
    onOpenMobileSidebar?: () => void;
    className?: string;
}

export const ResumeManager: React.FC<ResumeManagerProps> = ({
    onOpenMobileSidebar,
    className = "",
}) => {
    const toast = useToast();
    const dispatch = useAppDispatch();

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
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadResumeDetails = React.useCallback(async () => {
        try {
            const data = await fetchResumeDetailsApi();
            setResumeData(data);
            if (data.metadata?.analysisReport) {
                setAnalysisReport(data.metadata.analysisReport);
            }
        } catch (err: any) {
            console.warn("Failed to fetch resume details:", err?.message);
        }
    }, []);

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
            toast.success("Resume re-analyzed successfully!", {
                title: "Analysis Complete",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to re-analyze resume", {
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
            dispatch(updateUserProfile({ isResumePublic: newStatus }));
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
        if (!resumeData?.hasResume) return;
        setIsDeleting(true);
        try {
            await deleteResumeApi();
            setResumeData(null);
            setAnalysisReport(null);
            setIsDeleteModalOpen(false);
            toast.success("Resume removed from profile successfully.", {
                title: "Resume Removed",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to remove resume", {
                title: "Error",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // Upload Success Handler
    const handleUploadSuccess = (newResume: ResumeProfileData, newReport: GeminiAnalysisReport | null) => {
        setResumeData(newResume);
        if (newReport) {
            setAnalysisReport(newReport);
        }
        toast.success("Resume uploaded and analyzed successfully!", {
            title: "Attached to Profile",
        });
    };

    // Unified Resume Input Block States
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploadingInput, setIsUploadingInput] = useState(false);
    const [inputError, setInputError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateAndSelectFile = (file: File) => {
        setInputError(null);
        const name = file.name.toLowerCase();
        if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
            setInputError("Only .pdf and .docx documents are supported.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setInputError(`File size ${(file.size / (1024 * 1024)).toFixed(2)} MB exceeds the 5 MB limit.`);
            return;
        }
        setSelectedFile(file);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) validateAndSelectFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) validateAndSelectFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDirectUpload = async () => {
        if (!selectedFile) return;
        setIsUploadingInput(true);
        setInputError(null);
        try {
            const data = await uploadResumeApi(selectedFile);
            setResumeData(data.resume);
            if (data.report) {
                setAnalysisReport(data.report);
            }
            setSelectedFile(null);
            toast.success("Resume uploaded and analyzed successfully!", {
                title: "Attached to Profile",
            });
        } catch (err: any) {
            setInputError(err?.message || "Failed to upload and analyze resume.");
            toast.error(err?.message || "Failed to upload resume.");
        } finally {
            setIsUploadingInput(false);
        }
    };

    return (
        <section
            aria-label="Orbix Resume Intelligence & Profile Resume"
            className={`flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between ${className}`}
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
                                </div>
                                <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed max-w-2xl">
                                    Upload your resume for deep recruiter evaluation. Your resume is automatically linked to your public developer profile.
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
                                <div className="flex items-center gap-3.5 flex-wrap">
                                    <NeoToggle
                                        checked={resumeData.isResumePublic !== false}
                                        onChange={handleToggleVisibility}
                                        disabled={isTogglingVisibility}
                                        onIcon={<Globe className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                        offIcon={<Lock className="w-3.5 h-3.5 text-neutral-700 stroke-[3]" />}
                                        onStatusText="Status: Public"
                                        offStatusText="Status: Private"
                                        ariaLabel="Toggle resume visibility on profile"
                                    />
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
                                        <span>{isReAnalyzing ? "Re-Analyzing..." : "Re-Analyze Resume"}</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform hover:scale-105 active:scale-95"
                                    title="Remove resume from profile"
                                >
                                    <Trash2 className="w-4 h-4 stroke-[2]" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Unified Resume Input Dropzone Block */
                        <div className="mb-6 p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                        <UploadCloud className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-black text-black">
                                            Upload Your Developer Resume
                                        </h3>
                                        <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                            Upload your PDF or DOCX file to generate an intelligent evaluation and attach it to your public profile.
                                        </p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-[#FAF6EE] text-neutral-800 border-2 border-black shadow-[1.5px_1.5px_0px_#000] self-start sm:self-center">
                                    Max 5 MB
                                </span>
                            </div>

                            {inputError && (
                                <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-black text-rose-900 text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span className="flex-1">{inputError}</span>
                                    <button
                                        type="button"
                                        onClick={() => setInputError(null)}
                                        className="text-rose-700 hover:text-rose-900 font-black cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Drag & Drop Area */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onClick={() => !isUploadingInput && fileInputRef.current?.click()}
                                className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center space-y-4 cursor-pointer transition-all ${
                                    isDragging
                                        ? "bg-[#a2ff86]/20 border-black ring-2 ring-black scale-[0.99]"
                                        : selectedFile
                                        ? "bg-[#FAF6EE] border-black"
                                        : "bg-[#FAF6EE]/60 border-black/35 hover:border-black hover:bg-[#FAF6EE]"
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={handleFileInputChange}
                                    disabled={isUploadingInput}
                                    className="hidden"
                                />

                                {selectedFile ? (
                                    /* Selected File State */
                                    <div className="space-y-3">
                                        <div className="w-14 h-14 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                            <FileText className="w-7 h-7 text-black stroke-[2.5]" />
                                        </div>
                                        <div className="space-y-1 max-w-md mx-auto">
                                            <p className="text-base font-black text-black truncate">
                                                {selectedFile.name}
                                            </p>
                                            <p className="text-xs text-neutral-600 font-mono font-bold">
                                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.name.endsWith(".docx") ? "DOCX Document" : "PDF Document"}
                                            </p>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-black text-xs font-bold text-neutral-800 shadow-[1px_1px_0px_#000]">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>File selected & validated — ready to analyze</span>
                                        </div>
                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFile(null);
                                                }}
                                                className="text-xs text-neutral-600 hover:text-black underline font-bold cursor-pointer"
                                            >
                                                Choose a different file
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Empty Dropzone State */
                                    <div className="space-y-3">
                                        <div className="w-14 h-14 rounded-2xl bg-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000] hover:scale-105 transition-transform">
                                            <UploadCloud className="w-7 h-7 text-black stroke-[2.5]" />
                                        </div>
                                        <div className="space-y-1 max-w-md mx-auto">
                                            <p className="text-sm sm:text-base font-black text-black">
                                                Drag and drop your resume file here
                                            </p>
                                            <p className="text-xs text-neutral-600 font-medium">
                                                or click anywhere in this block to browse your device
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-neutral-600">
                                            <span className="px-2 py-0.5 rounded bg-white border border-black/20">.PDF</span>
                                            <span className="px-2 py-0.5 rounded bg-white border border-black/20">.DOCX</span>
                                            <span>• Up to 5 MB</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Bar */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                <p className="text-xs text-neutral-600 font-medium flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Securely processed and evaluated with privacy protection</span>
                                </p>

                                <button
                                    type="button"
                                    onClick={selectedFile ? handleDirectUpload : () => fileInputRef.current?.click()}
                                    disabled={isUploadingInput}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs sm:text-sm font-black uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUploadingInput ? (
                                        <>
                                            <Sparkles className="w-4 h-4 animate-spin" />
                                            <span>Uploading & Evaluating...</span>
                                        </>
                                    ) : selectedFile ? (
                                        <>
                                            <Sparkles className="w-4 h-4 stroke-[2.5]" />
                                            <span>Upload & Analyze Resume</span>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                                            <span>Browse & Upload Resume</span>
                                        </>
                                    )}
                                </button>
                            </div>
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
                        onProfileSyncSuccess={loadResumeDetails}
                    />

                    {/* ========================================================================= */}
                    {/* PROCEDURE: HOW TO MOVE FORWARD */}
                    {/* ========================================================================= */}
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-xl sm:text-2xl font-black text-black">
                                        Procedure: How to Move Forward
                                    </h3>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                        4-Step Roadmap
                                    </span>
                                </div>
                                <p className="mt-1 text-xs sm:text-sm text-neutral-600 font-medium">
                                    Follow this simple workflow to evaluate, optimize, and showcase your resume to top tech recruiters.
                                </p>
                            </div>
                        </div>

                        {/* Step Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Step 1 */}
                            <div className="p-5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-3 relative group hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000] transition-all">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <UploadCloud className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-black text-white">
                                            Step 01
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-black">Upload Resume</h4>
                                        <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                                            Drop your current PDF or DOCX file (up to 5 MB). The system validates layout linearity, standard formatting, and ATS parsability.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center gap-1.5 text-[11px] font-bold text-neutral-800">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    <span>PDF & DOCX supported</span>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="p-5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-3 relative group hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000] transition-all">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <Sparkles className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-black text-white">
                                            Step 02
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-black">Deep Evaluation</h4>
                                        <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                                            Orbix benchmarks technical depth, impact metrics, action verbs, and cross-references your connected coding profiles.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center gap-1.5 text-[11px] font-bold text-neutral-800">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    <span>Verified profile cross-check</span>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="p-5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-3 relative group hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000] transition-all">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <TrendingUp className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-black text-white">
                                            Step 03
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-black">Review & Optimize</h4>
                                        <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                                            Inspect your score grade (0–100), key strengths, role-specific missing keywords, and recommended bullet rewrites to maximize callback rates.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center gap-1.5 text-[11px] font-bold text-neutral-800">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    <span>Actionable recruiter tips</span>
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="p-5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-3 relative group hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000] transition-all">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                            <Globe className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-black text-white">
                                            Step 04
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-black">Share with Recruiters</h4>
                                        <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                                            Your resume attaches directly to your public Orbix profile with one-click recruiter viewing and downloads.
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-black/10 flex items-center gap-1.5 text-[11px] font-bold text-neutral-800">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    <span>Public profile integration</span>
                                </div>
                            </div>
                        </div>

                        {/* Pro-Tip Callout Banner */}
                        <div className="p-4 rounded-xl bg-[#FFE566]/25 border-2 border-black text-black flex items-start gap-3 shadow-[2px_2px_0px_#000]">
                            <div className="w-8 h-8 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                <Lightbulb className="w-4 h-4 text-black stroke-[2.5]" />
                            </div>
                            <div className="text-xs space-y-0.5 min-w-0">
                                <span className="font-black text-black uppercase tracking-wider block">
                                    Pro Tip for Higher Scores
                                </span>
                                <p className="text-neutral-700 font-medium leading-relaxed">
                                    Ensure your external coding portals (GitHub, LeetCode, Codeforces) are connected in Orbix before analyzing. Verified contest ratings and active repositories give your resume higher credibility in recruiter rankings.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Illustration */}
            <SectionBottomIllustration alt="Orbix resume workspace illustration" />

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

            {/* ========================================================================= */}
            {/* DELETE RESUME CONFIRMATION MODAL */}
            {/* ========================================================================= */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteResume}
                isLoading={isDeleting}
                title="Remove Resume from Profile?"
                description={
                    <span>
                        Are you sure you want to remove{" "}
                        <strong className="text-black font-black">
                            {resumeData?.resumeFilename || "your resume"}
                        </strong>
                        ? This will detach the file from your public developer profile and clear the analysis report.
                    </span>
                }
                confirmText={isDeleting ? "Removing..." : "Remove Resume"}
                cancelText="Cancel"
                variant="danger"
            />
        </section>
    );
};

export default ResumeManager;
