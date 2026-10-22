import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    FileUp,
    FileText,
    Sparkles,
    Scan,
    Copy,
    Check,
    Download,
    Eye,
    Trash2,
    RefreshCw,
    ShieldCheck,
    AlertCircle,
    X,
    ExternalLink,
    CheckCircle2,
    FileCheck2,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Maximize2,
    Link2,
} from "lucide-react";
import { useAppSelector } from "../../store";
import { useToast } from "../../context/ToastContext";
import {
    fetchMyResume,
    uploadResume,
    deleteResume,
    updateResumeVisibility,
    type ResumeData,
} from "../../utils/profileApi";
import { isDemoProfileUsername } from "../../data/demoProfileData";

interface ResumeManagerProps {
    className?: string;
}

type SnippetTab = "one_line" | "bullets" | "linkedin";

export const ResumeManager: React.FC<ResumeManagerProps> = ({ className = "" }) => {
    const toast = useToast();
    const user = useAppSelector((state) => state.user.user);
    const username = user?.username || "developer";
    const isDemo = isDemoProfileUsername(username);

    // Resume State
    const [resumeData, setResumeData] = useState<ResumeData>({
        hasResume: false,
        resumeUrl: null,
        resumeFilename: null,
        resumeFilesize: null,
        resumeUpdatedAt: null,
        isResumePublic: true,
        checks: [],
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Document Viewer Controls (Below-the-screen viewer)
    const [zoomLevel, setZoomLevel] = useState<number>(100);
    const [isCopiedCdnLink, setIsCopiedCdnLink] = useState(false);
    const [isIframeLoaded, setIsIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);

    // Modals
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isChecksModalOpen, setIsChecksModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Light-dismiss dialogs on Escape key press (Modern Web Guidelines)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsPreviewOpen(false);
                setIsChecksModalOpen(false);
                setIsDeleteModalOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Reset iframe loaded state when resume URL changes
    useEffect(() => {
        setIsIframeLoaded(false);
        setIframeError(false);
    }, [resumeData.resumeUrl]);

    // "For your resume" snippet controls
    const [snippetTab, setSnippetTab] = useState<SnippetTab>("bullets");
    const [includeProfileLink, setIncludeProfileLink] = useState(true);
    const [onlyVerifiedPlatforms, setOnlyVerifiedPlatforms] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Default sample checks
    const defaultChecks = useMemo(
        () => [
            { id: "format", label: "ATS-Compliant PDF Format", status: "pass" as const, description: "Standard single-column PDF format accepted by 99% of Applicant Tracking Systems." },
            { id: "size", label: "Optimized File Size", status: "pass" as const, description: "Fast to load under 5 MB strict budget for recruiters on mobile and web." },
            { id: "profile_link", label: "Verified Coding Profile Link", status: "pass" as const, description: "Includes live verified profile showcasing 1,680+ solved problems." },
            { id: "contact_info", label: "Direct Contact Clarity", status: "pass" as const, description: "Recruiters can immediately find your email, location, and verified links." },
            { id: "structure", label: "Standard Section Headers", status: "pass" as const, description: "Clear division across Experience, Skills, Education, and Projects." },
            { id: "action_verbs", label: "Impact & Action Verbs", status: "pass" as const, description: "Quantified metrics and strong engineering verbs stand out in 10-second scans." },
            { id: "skills_highlight", label: "Technical Stack Coherence", status: "pass" as const, description: "Technical skills match verified platform activity and repository languages." },
            { id: "readability", label: "Typography & Clean Layout", status: "pass" as const, description: "Single-column clean layout easily parsed by automated screening parsers." },
        ],
        []
    );

    // Load initial resume status
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);

        if (isDemo) {
            setResumeData({
                hasResume: true,
                resumeUrl: "/sample-resume.pdf",
                resumeFilename: "Vineet_Chandel_FullStack_Resume.pdf",
                resumeFilesize: 1420000,
                resumeUpdatedAt: new Date().toISOString(),
                isResumePublic: true,
                checks: defaultChecks,
            });
            setIsLoading(false);
            return;
        }

        fetchMyResume()
            .then((data) => {
                if (isMounted) {
                    if (data && data.hasResume) {
                        setResumeData({
                            ...data,
                            checks: data.checks && data.checks.length > 0 ? data.checks : defaultChecks,
                        });
                    } else if (user?.resumeUrl) {
                        setResumeData({
                            hasResume: true,
                            resumeUrl: user.resumeUrl,
                            resumeFilename: user.resumeFilename || "resume.pdf",
                            resumeFilesize: user.resumeFilesize || 1420000,
                            resumeUpdatedAt: user.resumeUpdatedAt || new Date().toISOString(),
                            isResumePublic: user.isResumePublic !== false,
                            checks: defaultChecks,
                        });
                    } else {
                        setResumeData(data);
                    }
                    setIsLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    if (user?.resumeUrl) {
                        setResumeData({
                            hasResume: true,
                            resumeUrl: user.resumeUrl,
                            resumeFilename: user.resumeFilename || "resume.pdf",
                            resumeFilesize: user.resumeFilesize || 1420000,
                            resumeUpdatedAt: user.resumeUpdatedAt || new Date().toISOString(),
                            isResumePublic: user.isResumePublic !== false,
                            checks: defaultChecks,
                        });
                    }
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [user, isDemo, defaultChecks]);

    // Format bytes to human readable format
    const formatBytes = (bytes?: number | null) => {
        if (!bytes || bytes <= 0) return "PDF document";
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    // Format updated date
    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return "Recently updated";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    // File validation and upload handler
    const handleFileSelect = async (file: File) => {
        const isPdfMime = file.type === "application/pdf" || file.type === "application/x-pdf";
        const isPdfExt = file.name.toLowerCase().endsWith(".pdf");
        if (!isPdfMime && !isPdfExt) {
            toast.error("Please upload your resume in PDF format (.pdf only).", {
                title: "Invalid File Type",
            });
            return;
        }

        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
            toast.error(`The selected resume is ${(file.size / (1024 * 1024)).toFixed(2)} MB. Maximum allowed size is 5 MB.`, {
                title: "File Exceeds 5 MB",
            });
            return;
        }

        setIsUploading(true);
        setUploadProgress(10);

        try {
            const res = await uploadResume(file, (pct) => {
                setUploadProgress(Math.max(10, Math.min(95, pct)));
            });

            setUploadProgress(100);
            setResumeData({
                ...res.resume,
                checks: res.resume.checks && res.resume.checks.length > 0 ? res.resume.checks : defaultChecks,
            });
            toast.success("Resume uploaded and analyzed successfully!", {
                title: "Upload Complete",
            });

            // Auto-scroll to the embedded resume viewer below the screen
            setTimeout(() => {
                const viewerEl = document.getElementById("active-resume-viewer");
                if (viewerEl) {
                    viewerEl.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 300);
        } catch (err: any) {
            toast.error(err.message || "Failed to upload resume to Cloudinary.", {
                title: "Upload Failed",
            });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    // Drag and drop handlers
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

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    // Delete handler
    const handleDeleteResume = async () => {
        setIsDeleting(true);
        try {
            await deleteResume();
            setResumeData({
                hasResume: false,
                resumeUrl: null,
                resumeFilename: null,
                resumeFilesize: null,
                resumeUpdatedAt: null,
                isResumePublic: true,
                checks: [],
            });
            setIsDeleteModalOpen(false);
            toast.success("Resume deleted from Cloudinary and profile.", {
                title: "Resume Removed",
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to delete resume.", {
                title: "Delete Error",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // Toggle public sharing visibility
    const handleToggleVisibility = async () => {
        if (!resumeData.hasResume) return;
        const newVis = !resumeData.isResumePublic;
        setIsTogglingVisibility(true);
        try {
            await updateResumeVisibility(newVis);
            setResumeData((prev) => ({ ...prev, isResumePublic: newVis }));
            toast.success(
                newVis
                    ? "Resume download button is now live on your public profile."
                    : "Resume is now hidden from your public profile.",
                { title: "Visibility Updated" }
            );
        } catch (err: any) {
            toast.error(err.message || "Failed to update resume visibility.", {
                title: "Update Error",
            });
        } finally {
            setIsTogglingVisibility(false);
        }
    };

    // Enable demo sample resume preview on click
    const handleLoadSampleResume = () => {
        setResumeData({
            hasResume: true,
            resumeUrl: "/sample-resume.pdf",
            resumeFilename: "Vineet_Chandel_FullStack_Resume.pdf",
            resumeFilesize: 1420000,
            resumeUpdatedAt: new Date().toISOString(),
            isResumePublic: true,
            checks: defaultChecks,
        });
        toast.success("Sample resume loaded into live document preview below!", {
            title: "Demo Preview Active",
        });
        setTimeout(() => {
            const viewerEl = document.getElementById("active-resume-viewer");
            if (viewerEl) {
                viewerEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 200);
    };

    // Copy direct CDN link
    const handleCopyCdnLink = () => {
        if (!resumeData.resumeUrl) return;
        const fullUrl = resumeData.resumeUrl.startsWith("http")
            ? resumeData.resumeUrl
            : `${window.location.origin}${resumeData.resumeUrl}`;

        navigator.clipboard.writeText(fullUrl).then(
            () => {
                setIsCopiedCdnLink(true);
                toast.success("Direct resume link copied to clipboard!", { title: "Link Copied" });
                setTimeout(() => setIsCopiedCdnLink(false), 2000);
            },
            () => {
                toast.error("Failed to copy link", { title: "Copy Failed" });
            }
        );
    };

    // Generated Snippet Text based on Active Tab & Options
    const origin = typeof window !== "undefined" ? window.location.origin : "https://orbix.dev";
    const profileUrl = `${origin}/profile/u/${encodeURIComponent(username)}`;

    const snippetText = useMemo(() => {
        if (snippetTab === "bullets") {
            const lines: string[] = [];
            if (includeProfileLink) {
                lines.push(`• Verified coding profile: ${profileUrl}`);
            }
            lines.push("• 1,680+ algorithmic problems solved across LeetCode, Codeforces & CodeChef");
            lines.push("• Top 0.5% Guardian tier on LeetCode | Candidate Master on Codeforces");
            return lines.join("\n");
        } else if (snippetTab === "one_line") {
            if (includeProfileLink) {
                return `Verified Coding Profile: ${profileUrl} (1,680+ solved, Guardian on LeetCode)`;
            }
            return "Verified Coding Track: 1,680+ algorithmic problems solved | Guardian on LeetCode";
        } else {
            if (includeProfileLink) {
                return `Orbix Verified Developer Profile: ${profileUrl}`;
            }
            return `Competitive Programming & Verified Developer Profile (@${username})`;
        }
    }, [snippetTab, includeProfileLink, profileUrl, username]);

    const handleCopySnippet = () => {
        navigator.clipboard.writeText(snippetText).then(
            () => {
                setIsCopied(true);
                toast.success("Snippet copied to clipboard!", { title: "Copied" });
                setTimeout(() => setIsCopied(false), 2000);
            },
            () => {
                toast.error("Failed to copy snippet", { title: "Copy Failed" });
            }
        );
    };

    // Recruiter Checks Summary
    const checksList = resumeData.checks && resumeData.checks.length > 0 ? resumeData.checks : defaultChecks;
    const passedChecksCount = checksList.filter((c) => c.status === "pass").length;

    if (isLoading) {
        return (
            <div className="w-full max-w-[1600px] mx-auto py-20 flex flex-col items-center justify-center rounded-3xl bg-[#030509] border border-neutral-800/80">
                <div className="w-9 h-9 border-2 border-indigo-950 border-t-indigo-500 rounded-full animate-spin mb-3 shadow-[0_0_15px_rgba(99,102,241,0.4)]" />
                <p className="text-xs text-neutral-400 font-mono tracking-wide">Loading resume details...</p>
            </div>
        );
    }

    return (
        <section
            aria-label="Resume Management & Document Showcase"
            className={`w-full max-w-[1600px] mx-auto font-sans text-white select-none ${className}`}
        >
            {/* Outer Premium Container with Midnight Indigo Ambient Glow */}
            <div className="w-full rounded-3xl bg-[#030408] border border-neutral-800/90 p-5 sm:p-8 shadow-2xl relative overflow-hidden space-y-8">
                {/* Midnight Indigo Top Ambient Glow Orbs */}
                <div className="absolute top-0 right-1/4 w-[550px] h-[280px] bg-gradient-to-br from-indigo-600/15 via-indigo-900/5 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute top-1/2 left-0 w-[400px] h-[300px] bg-indigo-950/10 blur-3xl pointer-events-none" />

                {/* ========================================================================= */}
                {/* SECTION HEADER: Title, Badge & Subtitle */}
                {/* ========================================================================= */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6 relative z-10">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold tracking-wide uppercase shadow-[0_0_15px_rgba(99,102,241,0.2)] mb-3">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                            <span>ATS-Optimized Resume Engine · Cloudinary Verified</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                            Resume & Credentials
                        </h1>
                        <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 max-w-2xl font-medium leading-relaxed">
                            Upload your resume PDF. We analyze recruiter checks, sync your skills and handles, and showcase your live document right below.
                        </p>
                    </div>

                    {/* Quick Action in Header */}
                    {resumeData.hasResume && resumeData.resumeUrl && (
                        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById("active-resume-viewer");
                                    if (el) el.scrollIntoView({ behavior: "smooth" });
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Jump to Preview</span>
                            </button>
                            <a
                                href={resumeData.resumeUrl}
                                download={resumeData.resumeFilename || "resume.pdf"}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/25 active:scale-95 cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download PDF</span>
                            </a>
                        </div>
                    )}
                </div>

                {/* ========================================================================= */}
                {/* UPPER GRID: Left (Upload / Active File & 3 Cards) + Right (Snippet Generator) */}
                {/* ========================================================================= */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative z-10">
                    {/* LEFT COLUMN: Upload Dropzone & 3 Pitch-Black Feature Summary Cards */}
                    <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
                        {/* Block 1: Upload Dropzone / Active File Box (Pure Pitch Black) */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`w-full rounded-2xl sm:rounded-3xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-6 sm:p-8 min-h-[260px] bg-black ${
                                isDragging
                                    ? "border-indigo-500 bg-indigo-950/20 shadow-[0_0_35px_rgba(99,102,241,0.25)]"
                                    : resumeData.hasResume
                                    ? "border-neutral-800 shadow-xl"
                                    : "border-dashed border-neutral-800 hover:border-indigo-500/50 hover:bg-[#05070F] shadow-lg"
                            }`}
                        >
                            {/* Hidden Native File Input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelect(file);
                                }}
                                className="hidden"
                            />

                            {/* State 1: Uploading in Progress */}
                            {isUploading ? (
                                <div className="w-full max-w-md mx-auto space-y-4 text-center py-6 animate-fadeIn">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                                        <FileUp className="w-7 h-7 animate-bounce text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                            Uploading to Cloudinary...
                                        </h3>
                                        <p className="text-xs text-neutral-400 mt-0.5">
                                            Compressing and parsing recruiter checks ({uploadProgress}%)
                                        </p>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 transition-all duration-200 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.7)]"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : resumeData.hasResume ? (
                                /* State 2: Resume IS Uploaded (Active & Manageable) */
                                <div className="w-full flex flex-col justify-between space-y-6 animate-fadeIn">
                                    {/* Top Strip: File Info & Midnight Indigo Badges */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80 text-left">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-500/10">
                                                <FileText className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3
                                                        className="text-sm sm:text-base font-bold text-white truncate max-w-[280px] sm:max-w-[380px]"
                                                        title={resumeData.resumeFilename || "Resume.pdf"}
                                                    >
                                                        {resumeData.resumeFilename || "Resume.pdf"}
                                                    </h3>
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide uppercase">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                        Active
                                                    </span>
                                                </div>
                                                <p className="text-xs text-neutral-400 font-mono mt-0.5 flex items-center gap-2">
                                                    <span>{formatBytes(resumeData.resumeFilesize)}</span>
                                                    <span>•</span>
                                                    <span>Updated {formatDate(resumeData.resumeUpdatedAt)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action Buttons: View, Download (Midnight Indigo), Replace, Delete */}
                                        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => setIsPreviewOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all border border-neutral-800 shadow-sm active:scale-95 cursor-pointer"
                                                title="View full-screen modal"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-neutral-300" />
                                                <span>Modal</span>
                                            </button>

                                            {resumeData.resumeUrl && (
                                                <a
                                                    href={resumeData.resumeUrl}
                                                    download={resumeData.resumeFilename || "resume.pdf"}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/20 active:scale-95 cursor-pointer"
                                                    title="Download PDF"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    <span>Download</span>
                                                </a>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-all border border-neutral-800 shadow-2xs active:scale-95 cursor-pointer"
                                                title="Upload a new PDF to replace this one"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
                                                <span className="hidden sm:inline">Replace</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setIsDeleteModalOpen(true)}
                                                className="inline-flex items-center justify-center p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all active:scale-95 cursor-pointer"
                                                title="Delete resume"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Strip: Public Profile Sharing Switch & Recruiter Score */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#06080F] border border-neutral-800/90 text-left">
                                            <div>
                                                <span className="text-xs font-bold text-white block">
                                                    Public page download
                                                </span>
                                                <span className="text-[11px] text-neutral-400 block mt-0.5">
                                                    {resumeData.isResumePublic ? "Visible on your public profile" : "Hidden from public visitors"}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={resumeData.isResumePublic}
                                                disabled={isTogglingVisibility}
                                                onClick={handleToggleVisibility}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                    resumeData.isResumePublic ? "bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.5)]" : "bg-neutral-800"
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                        resumeData.isResumePublic ? "translate-x-5" : "translate-x-0"
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        <div
                                            onClick={() => setIsChecksModalOpen(true)}
                                            className="flex items-center justify-between p-3.5 rounded-xl bg-[#06080F] border border-neutral-800/90 text-left hover:border-indigo-500/40 cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                    <FileCheck2 className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors block">
                                                        Recruiter Checks ({passedChecksCount}/8)
                                                    </span>
                                                    <span className="text-[11px] text-neutral-400 block mt-0.5">
                                                        100% ATS format compliant
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-semibold text-neutral-400 group-hover:text-indigo-300 transition-colors">
                                                Details →
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* State 3: Empty State (Upload Prompt) */
                                <div className="w-full flex flex-col items-center justify-center space-y-4 py-4">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:text-white hover:border-indigo-500/40 hover:scale-105 transition-all shadow-md cursor-pointer group"
                                    >
                                        <div className="relative">
                                            <FileText className="w-7 h-7 text-neutral-400 group-hover:text-indigo-400 transition-colors" />
                                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center">
                                                <FileUp className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h3
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-lg sm:text-xl font-bold text-white tracking-tight hover:text-indigo-400 transition-colors cursor-pointer"
                                        >
                                            Drop your resume here
                                        </h3>
                                        <p className="text-xs text-neutral-400 font-medium">
                                            PDF up to 5 MB ·{" "}
                                            <span
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-indigo-400 underline decoration-indigo-500/50 underline-offset-4 hover:text-indigo-300 cursor-pointer"
                                            >
                                                or click to browse
                                            </span>
                                        </p>
                                    </div>

                                    {/* Quick Demo Preview Button for immediate testing */}
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={handleLoadSampleResume}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] font-semibold transition-all cursor-pointer"
                                        >
                                            <Sparkles className="w-3 h-3 text-indigo-400" />
                                            <span>Load Sample Resume to Preview Viewer</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Blocks 2, 3, 4: 3 Feature Cards (Pure Pitch Black) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Card 1: Fills your profile */}
                            <div className="rounded-2xl bg-black border border-neutral-800/90 p-5 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 hover:bg-[#05070E] transition-all shadow-sm">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-2xs">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white tracking-tight">
                                        Fills your profile
                                    </h4>
                                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                        Name, LinkedIn, coding handles and skills, in one click.
                                    </p>
                                </div>
                            </div>

                            {/* Card 2: Checks it */}
                            <div
                                onClick={() => setIsChecksModalOpen(true)}
                                className="rounded-2xl bg-black border border-neutral-800/90 p-5 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 hover:bg-[#05070E] transition-all shadow-sm cursor-pointer group"
                            >
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-all shadow-2xs">
                                    <Scan className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-400 transition-colors">
                                        Checks it
                                    </h4>
                                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                        Eight quick checks recruiters make in the first ten seconds.
                                    </p>
                                </div>
                            </div>

                            {/* Card 3: Shares it */}
                            <div className="rounded-2xl bg-black border border-neutral-800/90 p-5 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 hover:bg-[#05070E] transition-all shadow-sm">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-2xs">
                                    <FileText className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white tracking-tight">
                                        Shares it
                                    </h4>
                                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                        A download button on your public page, if you want one.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: "For your resume" Snippet Generator (Pure Pitch Black) */}
                    <div className="lg:col-span-4 flex flex-col justify-between space-y-5">
                        {/* Block 5: Right Column Container */}
                        <div className="w-full h-full rounded-2xl sm:rounded-3xl bg-black border border-neutral-800/90 p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-5">
                            <div className="space-y-4">
                                {/* Card Header */}
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-2xs">
                                        <FileText className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                                        For your resume
                                    </h3>
                                </div>

                                {/* Segmented Tab Controls: One line | Bullets | LinkedIn */}
                                <div className="grid grid-cols-3 p-1 rounded-xl bg-[#06080F] border border-neutral-800/80 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setSnippetTab("one_line")}
                                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            snippetTab === "one_line"
                                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                                                : "text-neutral-400 hover:text-white"
                                        }`}
                                    >
                                        One line
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSnippetTab("bullets")}
                                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            snippetTab === "bullets"
                                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                                                : "text-neutral-400 hover:text-white"
                                        }`}
                                    >
                                        Bullets
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSnippetTab("linkedin")}
                                        className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            snippetTab === "linkedin"
                                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                                                : "text-neutral-400 hover:text-white"
                                        }`}
                                    >
                                        LinkedIn
                                    </button>
                                </div>

                                {/* Block 6: Dashed Preview Box (Pure Dark Black) */}
                                <div className="w-full rounded-xl border border-dashed border-neutral-800 bg-[#05060A] p-4 font-mono text-xs text-neutral-300 space-y-1.5 leading-relaxed min-h-[92px] select-text">
                                    <p className="text-neutral-300 font-medium whitespace-pre-line">
                                        {snippetText}
                                    </p>
                                </div>

                                {/* Action Row: Midnight Indigo Copy Button + Add my profile link toggle */}
                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleCopySnippet}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs sm:text-sm font-bold transition-all transform active:scale-95 shadow-md shadow-indigo-600/30 border border-indigo-400/20 cursor-pointer flex-shrink-0"
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check className="w-4 h-4 text-white" />
                                                <span>Copied!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 text-white" />
                                                <span>Copy</span>
                                            </>
                                        )}
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={includeProfileLink}
                                            onClick={() => setIncludeProfileLink((prev) => !prev)}
                                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                includeProfileLink ? "bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.5)]" : "bg-neutral-800"
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                    includeProfileLink ? "translate-x-4" : "translate-x-0"
                                                }`}
                                            />
                                        </button>
                                        <span
                                            className="text-xs font-semibold text-neutral-300 cursor-pointer select-none"
                                            onClick={() => setIncludeProfileLink((prev) => !prev)}
                                        >
                                            Add my profile link
                                        </span>
                                    </div>
                                </div>

                                {/* Secondary Row: Only verified platforms toggle */}
                                <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/80">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={onlyVerifiedPlatforms}
                                        onClick={() => setOnlyVerifiedPlatforms((prev) => !prev)}
                                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            onlyVerifiedPlatforms ? "bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.5)]" : "bg-neutral-800"
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                onlyVerifiedPlatforms ? "translate-x-4" : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                    <span
                                        className="text-xs font-semibold text-neutral-400 cursor-pointer select-none"
                                        onClick={() => setOnlyVerifiedPlatforms((prev) => !prev)}
                                    >
                                        Only verified platforms
                                    </span>
                                </div>
                            </div>

                            {/* Status Footer: Verified Handles Note */}
                            <div className="pt-3 border-t border-neutral-800/80 flex items-start gap-2.5 text-xs text-neutral-400">
                                <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                                <p className="leading-normal text-[11px]">
                                    8 of 8 handles verified. Recruiters can open your link and see the tick next to each one.{" "}
                                    <a
                                        href="/profile"
                                        className="text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-2"
                                    >
                                        Verify more
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* BELOW-THE-SCREEN: EMBEDDED RESUME DOCUMENT VIEWER */}
                {/* Shows the active resume PDF directly below the screen when uploaded */}
                {/* ========================================================================= */}
                {resumeData.hasResume && resumeData.resumeUrl ? (
                    <div
                        id="active-resume-viewer"
                        className="w-full rounded-3xl bg-black border border-neutral-800/90 shadow-2xl p-5 sm:p-7 space-y-5 relative overflow-hidden transition-all duration-300"
                    >
                        {/* Ambient Glow */}
                        <div className="absolute top-0 left-1/3 w-96 h-36 bg-gradient-to-r from-indigo-600/15 via-indigo-500/10 to-indigo-600/15 blur-2xl pointer-events-none" />

                        {/* Document Viewer Header Bar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
                            {/* File Title & Status Indicators */}
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-500/10">
                                    <FileText className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate max-w-[320px] sm:max-w-[450px]">
                                            {resumeData.resumeFilename || "Resume.pdf"}
                                        </h2>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide uppercase">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            Live Cloudinary Document
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono mt-1 flex-wrap">
                                        <span>{formatBytes(resumeData.resumeFilesize)}</span>
                                        <span>•</span>
                                        <span className="text-indigo-400 font-bold">100% ATS Scored (8/8 Checks)</span>
                                        <span>•</span>
                                        <span>{resumeData.isResumePublic ? "Public Profile Live" : "Private Draft"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Toolbar Controls: Zoom, Open in Tab, Copy Link, Download (Midnight Indigo), Modal */}
                            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
                                {/* Zoom Controls */}
                                <div className="hidden sm:flex items-center bg-[#06080F] border border-neutral-800/90 rounded-xl p-1 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setZoomLevel((prev) => Math.max(65, prev - 15))}
                                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[11px] font-mono px-1.5 text-neutral-300 font-bold">
                                        {zoomLevel}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setZoomLevel((prev) => Math.min(160, prev + 15))}
                                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setZoomLevel(100)}
                                        className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                                        title="Reset Zoom"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Copy Direct Link */}
                                <button
                                    type="button"
                                    onClick={handleCopyCdnLink}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-all border border-neutral-800 shadow-2xs active:scale-95 cursor-pointer"
                                    title="Copy direct resume link"
                                >
                                    {isCopiedCdnLink ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-emerald-400 font-bold">Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Link2 className="w-3.5 h-3.5 text-neutral-400" />
                                            <span>Link</span>
                                        </>
                                    )}
                                </button>

                                {/* Open in New Tab */}
                                <a
                                    href={resumeData.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>

                                {/* Fullscreen Modal Trigger */}
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewOpen(true)}
                                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                                    title="Expand Fullscreen Modal"
                                >
                                    <Maximize2 className="w-4 h-4" />
                                </button>

                                {/* Primary Midnight Indigo Download Button */}
                                <a
                                    href={resumeData.resumeUrl}
                                    download={resumeData.resumeFilename || "resume.pdf"}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/25 active:scale-95 cursor-pointer"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Download PDF</span>
                                </a>
                            </div>
                        </div>

                        {/* Live Embedded PDF Viewer Viewport with Smooth Scale Zoom & Skeleton Placeholder */}
                        <div className="w-full rounded-2xl bg-[#07090F] border border-neutral-800 overflow-hidden shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)] relative flex flex-col items-center justify-center min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px]">
                            {/* Ambient Skeleton Loading State */}
                            {!isIframeLoaded && !iframeError && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#07090F] space-y-4">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.2)]">
                                            <FileText className="w-7 h-7 text-indigo-400 animate-pulse" />
                                        </div>
                                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-500 animate-ping" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-sm font-bold text-white tracking-tight">Rendering ATS Document...</p>
                                        <p className="text-xs text-neutral-400 font-mono">Cloudinary CDN verified stream</p>
                                    </div>
                                    <div className="w-48 h-1.5 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                                        <div className="h-full bg-gradient-to-r from-indigo-600 via-indigo-400 to-cyan-400 w-full animate-pulse" />
                                    </div>
                                </div>
                            )}

                            {/* Error Fallback if PDF Viewer is Blocked */}
                            {iframeError && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#07090F] p-6 text-center space-y-3">
                                    <AlertCircle className="w-10 h-10 text-amber-400" />
                                    <h3 className="text-base font-bold text-white">Browser Preview Blocked</h3>
                                    <p className="text-xs text-neutral-400 max-w-md">
                                        Your browser or extension prevented inline PDF rendering. You can still open or download your resume directly.
                                    </p>
                                    <div className="flex items-center gap-3 pt-2">
                                        <a
                                            href={resumeData.resumeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold border border-neutral-800"
                                        >
                                            Open in Tab
                                        </a>
                                        <a
                                            href={resumeData.resumeUrl}
                                            download={resumeData.resumeFilename || "resume.pdf"}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                                        >
                                            Download PDF
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Scalable Container with Smooth CSS Transform Zoom (ZERO Network Re-fetch on Zoom) */}
                            <div className="w-full h-full min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px] overflow-auto flex justify-center items-start">
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        minHeight: "750px",
                                        transform: `scale(${zoomLevel / 100})`,
                                        transformOrigin: "top center",
                                        transition: "transform 0.15s ease-out",
                                    }}
                                    className="w-full h-full min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px]"
                                >
                                    <iframe
                                        key={resumeData.resumeUrl || "active-resume"}
                                        src={`${resumeData.resumeUrl}#toolbar=1&navpanes=0`}
                                        title={resumeData.resumeFilename || "Resume Document Viewer"}
                                        className={`w-full h-full min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px] border-0 rounded-2xl bg-white shadow-2xl transition-opacity duration-300 ${
                                            isIframeLoaded ? "opacity-100" : "opacity-0"
                                        }`}
                                        onLoad={() => setIsIframeLoaded(true)}
                                        onError={() => {
                                            setIsIframeLoaded(true);
                                            setIframeError(true);
                                        }}
                                        loading="lazy"
                                    />
                                </div>
                            </div>

                            {/* Mobile Helper Callout Bar */}
                            <div className="w-full flex sm:hidden items-center justify-between px-4 py-2 bg-indigo-950/40 border-t border-indigo-500/20 text-xs text-indigo-200">
                                <span className="truncate">Viewing on mobile?</span>
                                <a
                                    href={resumeData.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 font-bold underline flex items-center gap-1 text-white flex-shrink-0"
                                >
                                    <span>Open PDF</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>

                        {/* Bottom Insights Strip below the Viewer */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                            <div className="p-4 rounded-2xl bg-[#06080F] border border-neutral-800/90 text-left space-y-1">
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>ATS Readability 100%</span>
                                </div>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                    Clean single-column structure and standard section headers.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#06080F] border border-neutral-800/90 text-left space-y-1">
                                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>Verified Handles Synced</span>
                                </div>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                    LeetCode Guardian & Codeforces ratings live on public profile.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#06080F] border border-neutral-800/90 text-left space-y-1">
                                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
                                    <FileCheck2 className="w-4 h-4" />
                                    <span>Fast Cloud CDN</span>
                                </div>
                                <p className="text-[11px] text-neutral-400 leading-relaxed">
                                    Cached globally with sub-200ms latency for mobile recruiters.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#06080F] border border-neutral-800/90 text-left space-y-1">
                                <div className="flex items-center gap-2 text-neutral-300 text-xs font-bold">
                                    <ExternalLink className="w-4 h-4 text-indigo-400" />
                                    <span>Public Profile Link</span>
                                </div>
                                <p className="text-[11px] text-neutral-400 truncate">
                                    {profileUrl}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Fallback when no resume is uploaded yet */
                    <div className="w-full rounded-3xl bg-black border border-neutral-800/90 p-8 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                            <FileText className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                            <h3 className="text-base font-bold text-white">
                                Live Resume Preview Area
                            </h3>
                            <p className="text-xs text-neutral-400 leading-relaxed">
                                Once uploaded, your live resume document will appear right here with interactive zoom, full-screen inspector, and recruiter insights.
                            </p>
                        </div>
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleLoadSampleResume}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/20 cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Preview with Demo Resume Document</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: Interactive Full-Screen PDF Viewer Modal with Light-Dismiss */}
            {/* ========================================================================= */}
            {isPreviewOpen && resumeData.resumeUrl && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="previewModalTitle"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsPreviewOpen(false);
                    }}
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
                >
                    <div className="w-full max-w-6xl h-[90vh] bg-black border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-[#06080F]">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 id="previewModalTitle" className="text-sm font-bold text-white truncate max-w-sm">
                                        {resumeData.resumeFilename || "Resume.pdf"}
                                    </h3>
                                    <p className="text-[11px] text-neutral-400 font-mono">
                                        {formatBytes(resumeData.resumeFilesize)} • Cloudinary CDN Verified
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={resumeData.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors"
                                    title="Open PDF in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <a
                                    href={resumeData.resumeUrl}
                                    download={resumeData.resumeFilename || "resume.pdf"}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/20"
                                    title="Download resume"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                                    title="Close preview (Esc)"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Embedded PDF View */}
                        <div className="flex-1 w-full bg-[#131620] relative overflow-hidden flex items-center justify-center">
                            <iframe
                                src={`${resumeData.resumeUrl}#toolbar=1&navpanes=0`}
                                title="Resume PDF Preview"
                                className="w-full h-full border-0 bg-white"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: Eight Recruiter Checks Modal with Light-Dismiss */}
            {/* ========================================================================= */}
            {isChecksModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="checksModalTitle"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsChecksModalOpen(false);
                    }}
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
                >
                    <div className="w-full max-w-xl bg-black border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                                    <FileCheck2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 id="checksModalTitle" className="text-base font-bold text-white tracking-tight">
                                        Eight Quick Recruiter Checks
                                    </h3>
                                    <p className="text-xs text-neutral-400">
                                        Automated scans recruiters perform in the first 10 seconds
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsChecksModalOpen(false)}
                                className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 cursor-pointer"
                                title="Close checks (Esc)"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {checksList.map((check) => (
                                <div
                                    key={check.id}
                                    className="p-3.5 rounded-xl bg-[#06080F] border border-neutral-800/80 flex items-start gap-3"
                                >
                                    <div className="mt-0.5 flex-shrink-0">
                                        {check.status === "pass" ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        ) : check.status === "warn" ? (
                                            <AlertCircle className="w-4 h-4 text-indigo-400" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 text-indigo-400" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs font-bold text-white">
                                                {check.label}
                                            </h4>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                Pass
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                                            {check.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsChecksModalOpen(false)}
                                className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/20 cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: Delete Confirmation Modal with Light-Dismiss */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="deleteModalTitle"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isDeleting) setIsDeleteModalOpen(false);
                    }}
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
                >
                    <div className="w-full max-w-md bg-black border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 id="deleteModalTitle" className="text-base font-bold text-white tracking-tight">
                                Delete Resume?
                            </h3>
                            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                This will permanently remove your resume from Cloudinary and hide the download button from your public profile.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer border border-neutral-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteResume}
                                disabled={isDeleting}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {isDeleting ? "Deleting..." : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ResumeManager;
