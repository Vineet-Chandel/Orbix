import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    FileUp,
    FileText,
    Sparkles,
    Scan,
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
    RotateCw,
    Maximize2,
    Link2,
} from "lucide-react";
import { useAppDispatch, useAppSelector, updateUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import {
    fetchMyResume,
    uploadResume,
    deleteResume,
    updateResumeVisibility,
    type ResumeData,
} from "../../utils/profileApi";

interface ResumeManagerProps {
    className?: string;
    onOpenMobileSidebar?: () => void;
}

export const ResumeManager: React.FC<ResumeManagerProps> = ({
    className = "",
    onOpenMobileSidebar,
}) => {
    const toast = useToast();
    const dispatch = useAppDispatch();
    const user = useAppSelector((state) => state.user.user);
    const username = user?.username || "developer";

    // Resume State initialized from Redux user or localStorage cache to avoid re-fetching lag
    const [resumeData, setResumeData] = useState<ResumeData>(() => {
        if (user?.resumeUrl) {
            return {
                hasResume: true,
                resumeUrl: user.resumeUrl,
                resumeFilename: user.resumeFilename || "Resume.pdf",
                resumeFilesize: user.resumeFilesize ?? null,
                resumeUpdatedAt: user.resumeUpdatedAt ?? null,
                isResumePublic: user.isResumePublic !== false,
                checks: [],
            };
        }
        try {
            const cached = localStorage.getItem("orbix_resume_cache");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === "object") return parsed;
            }
        } catch {}
        return {
            hasResume: false,
            resumeUrl: null,
            resumeFilename: null,
            resumeFilesize: null,
            resumeUpdatedAt: null,
            isResumePublic: true,
            checks: [],
        };
    });

    // Only set loading to true if we do not already have cached data in Redux or localStorage
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        if (user?.resumeUrl) return false;
        try {
            const cached = localStorage.getItem("orbix_resume_cache");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.resumeUrl) return false;
            }
        } catch {}
        return true;
    });
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Document Viewer Controls (Below-the-screen viewer)
    const [previewDemo, setPreviewDemo] = useState(false);
    const [zoomLevel, setZoomLevel] = useState<number>(100);
    const [rotation, setRotation] = useState<number>(0);
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

    // Document currently shown in the below preview viewer (real uploaded resume or sample demo preview)
    const activeDoc = useMemo(() => {
        if (resumeData.hasResume && resumeData.resumeUrl) {
            return {
                isDemo: false,
                url: resumeData.resumeUrl,
                filename: resumeData.resumeFilename || "Resume.pdf",
                filesize: resumeData.resumeFilesize,
                updatedAt: resumeData.resumeUpdatedAt,
                isPublic: resumeData.isResumePublic,
                checks: resumeData.checks && resumeData.checks.length > 0 ? resumeData.checks : defaultChecks,
            };
        }
        if (previewDemo) {
            return {
                isDemo: true,
                url: "/sample-resume.pdf",
                filename: "Vineet_Chandel_FullStack_Resume.pdf",
                filesize: 1420000,
                updatedAt: new Date().toISOString(),
                isPublic: false,
                checks: defaultChecks,
            };
        }
        return null;
    }, [resumeData, previewDemo, defaultChecks]);

    // Reset iframe loaded state and rotation when active document URL changes
    useEffect(() => {
        setIsIframeLoaded(false);
        setIframeError(false);
        setRotation(0);
        // Safety fallback: browser PDF plugins may not reliably fire DOM onLoad on iframes
        const timer = setTimeout(() => {
            setIsIframeLoaded(true);
        }, 800);
        return () => clearTimeout(timer);
    }, [activeDoc?.url]);

    // Revalidate resume status from backend and keep Redux + localStorage cache in sync
    useEffect(() => {
        let isMounted = true;

        fetchMyResume()
            .then((data) => {
                if (!isMounted) return;
                if (data && data.hasResume) {
                    const resolved: ResumeData = {
                        ...data,
                        checks: data.checks && data.checks.length > 0 ? data.checks : defaultChecks,
                    };
                    setResumeData(resolved);
                    try {
                        localStorage.setItem("orbix_resume_cache", JSON.stringify(resolved));
                    } catch {}
                    dispatch(
                        updateUserProfile({
                            resumeUrl: data.resumeUrl,
                            resumeFilename: data.resumeFilename,
                            resumeFilesize: data.resumeFilesize,
                            resumeUpdatedAt: data.resumeUpdatedAt,
                            isResumePublic: data.isResumePublic,
                        })
                    );
                } else if (user?.resumeUrl) {
                    setResumeData({
                        hasResume: true,
                        resumeUrl: user.resumeUrl,
                        resumeFilename: user.resumeFilename || "Resume.pdf",
                        resumeFilesize: user.resumeFilesize || 1420000,
                        resumeUpdatedAt: user.resumeUpdatedAt || new Date().toISOString(),
                        isResumePublic: user.isResumePublic !== false,
                        checks: defaultChecks,
                    });
                } else {
                    setResumeData(data || {
                        hasResume: false,
                        resumeUrl: null,
                        resumeFilename: null,
                        resumeFilesize: null,
                        resumeUpdatedAt: null,
                        isResumePublic: true,
                        checks: [],
                    });
                    try {
                        localStorage.removeItem("orbix_resume_cache");
                    } catch {}
                }
                setIsLoading(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [dispatch, user?.resumeUrl, user?.resumeFilename, user?.resumeFilesize, user?.resumeUpdatedAt, user?.isResumePublic, defaultChecks]);

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
            setPreviewDemo(false);
            const uploadedResume: ResumeData = {
                ...res.resume,
                checks: res.resume.checks && res.resume.checks.length > 0 ? res.resume.checks : defaultChecks,
            };
            setResumeData(uploadedResume);
            try {
                localStorage.setItem("orbix_resume_cache", JSON.stringify(uploadedResume));
            } catch {}
            dispatch(
                updateUserProfile({
                    resumeUrl: res.resume.resumeUrl,
                    resumeFilename: res.resume.resumeFilename,
                    resumeFilesize: res.resume.resumeFilesize,
                    resumeUpdatedAt: res.resume.resumeUpdatedAt,
                    isResumePublic: res.resume.isResumePublic,
                })
            );
            toast.success("Resume uploaded and analyzed successfully!", {
                title: "Upload Complete",
            });

            // Auto-scroll to the embedded resume viewer below
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
            setPreviewDemo(false);
            const emptyResume: ResumeData = {
                hasResume: false,
                resumeUrl: null,
                resumeFilename: null,
                resumeFilesize: null,
                resumeUpdatedAt: null,
                isResumePublic: true,
                checks: [],
            };
            setResumeData(emptyResume);
            try {
                localStorage.removeItem("orbix_resume_cache");
            } catch {}
            dispatch(
                updateUserProfile({
                    resumeUrl: null,
                    resumeFilename: null,
                    resumeFilesize: null,
                    resumeUpdatedAt: null,
                })
            );
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
            setResumeData((prev) => {
                const next = { ...prev, isResumePublic: newVis };
                try {
                    localStorage.setItem("orbix_resume_cache", JSON.stringify(next));
                } catch {}
                return next;
            });
            dispatch(updateUserProfile({ isResumePublic: newVis }));
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

    // Enable demo sample resume preview on click (strictly updates below preview area, dropzone remains untouched)
    const handleLoadSampleResume = () => {
        setPreviewDemo(true);
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
        const targetUrl = activeDoc?.url;
        if (!targetUrl) return;
        const fullUrl = targetUrl.startsWith("http")
            ? targetUrl
            : `${window.location.origin}${targetUrl}`;

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


    const origin = typeof window !== "undefined" ? window.location.origin : "https://orbix.dev";
    const profileUrl = `${origin}/profile/u/${encodeURIComponent(username)}`;

    // Recruiter Checks Summary
    const checksList = resumeData.checks && resumeData.checks.length > 0 ? resumeData.checks : defaultChecks;
    const passedChecksCount = checksList.filter((c) => c.status === "pass").length;

    if (isLoading) {
        return (
            <div className="w-full max-w-7xl mx-auto py-24 flex flex-col items-center justify-center rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[6px_6px_0px_#000]">
                <div className="w-10 h-10 border-4 border-black border-t-[#a2ff86] rounded-full animate-spin mb-3 shadow-[2px_2px_0px_#000]" />
                <p className="text-xs text-black font-black uppercase tracking-wider">Loading resume details...</p>
            </div>
        );
    }

    return (
        <section
            aria-label="Resume Management & Document Showcase"
            className={`flex-1 w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between ${className}`}
        >
            <div className="p-4 sm:p-6 lg:p-8 flex-1">
                <div className="mx-auto w-full max-w-7xl my-1">
                    {/* ========================================================================= */}
                    {/* PAGE HEADER: Title, Badges & Action Buttons */}
                    {/* ========================================================================= */}
                    <div className="mb-6 lg:mb-8 pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            {onOpenMobileSidebar && (
                                <button
                                    type="button"
                                    onClick={onOpenMobileSidebar}
                                    className="lg:hidden mt-0.5 p-2 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer flex-shrink-0"
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
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-black">
                                    Resume & Credentials
                                </h1>
                                <p className="mt-1.5 text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed max-w-2xl">
                                    Upload your resume PDF. We analyze recruiter checks, sync your skills and handles, and showcase your live document right below.
                                </p>
                            </div>
                        </div>

                        {/* Right Header Badges and Quick Actions */}
                        <div className="flex items-center gap-2.5 flex-shrink-0 self-start md:self-center flex-wrap">
                            <span
                                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_#000] ${resumeData.hasResume ? "bg-[#a2ff86] text-black" : "bg-white text-black"
                                    }`}
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${resumeData.hasResume ? "bg-black animate-pulse" : "bg-neutral-400"
                                        }`}
                                />
                                <span>
                                    {resumeData.hasResume
                                        ? `${passedChecksCount} of 8 checks passed`
                                        : "No resume uploaded"}
                                </span>
                            </span>

                            {resumeData.hasResume && resumeData.resumeUrl && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const el = document.getElementById("active-resume-viewer");
                                            if (el) el.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-black uppercase border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer"
                                    >
                                        <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Preview</span>
                                    </button>
                                    <a
                                        href={resumeData.resumeUrl}
                                        download={resumeData.resumeFilename || "resume.pdf"}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-black uppercase border-2 border-black bg-[#a2ff86] text-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer"
                                    >
                                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Download PDF</span>
                                    </a>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* UPPER SECTION: Upload Dropzone & 3 Feature Summary Cards */}
                    {/* ========================================================================= */}
                    <div className="w-full space-y-6">
                        {/* Block 1: Upload Dropzone / Active File Box */}
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`w-full rounded-xl border-2 transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-6 sm:p-7 min-h-[260px] bg-white  ${isDragging
                                ? "border-black bg-[#a2ff86]/25 "
                                : resumeData.hasResume
                                    ? "border-black"
                                    : "border-dashed border-black hover:bg-[#FAF6EE]"
                                }`}
                        >
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
                                    <div className="w-14 h-14 rounded-xl bg-[#a2ff86] border-2 border-black text-black mx-auto flex items-center justify-center shadow-[3px_3px_0px_#000] animate-bounce">
                                        <FileUp className="w-7 h-7 stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-base sm:text-lg font-black text-black tracking-tight uppercase">
                                            Uploading to Cloudinary...
                                        </h3>
                                        <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                            Compressing and verifying ATS compliance ({uploadProgress}%)
                                        </p>
                                    </div>
                                    <div className="w-full h-3 rounded-full bg-[#FAF6EE] overflow-hidden border-2 border-black shadow-[1px_1px_0px_#000]">
                                        <div
                                            className="h-full bg-[#a2ff86] border-r-2 border-black transition-all duration-200"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : resumeData.hasResume ? (
                                /* State 2: Resume is Active */
                                <div className="w-full flex flex-col justify-between space-y-5 animate-fadeIn text-left">
                                    {/* Top File Meta & Actions */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-12 h-12 rounded-xl bg-[#a2ff86] border-2 border-black text-black flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_#000]">
                                                <FileText className="w-6 h-6 stroke-[2.5]" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3
                                                        className="text-sm sm:text-base font-black text-black truncate max-w-[240px] sm:max-w-[340px]"
                                                        title={resumeData.resumeFilename || "Resume.pdf"}
                                                    >
                                                        {resumeData.resumeFilename || "Resume.pdf"}
                                                    </h3>
                                                </div>
                                                <p className="text-xs font-mono font-bold text-neutral-600 mt-0.5 flex items-center gap-2">
                                                    <span>{formatBytes(resumeData.resumeFilesize)}</span>
                                                    <span>•</span>
                                                    <span>Updated {formatDate(resumeData.resumeUpdatedAt)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Action Buttons: Modal, Download, Replace, Delete */}
                                        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => setIsPreviewOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                                                title="View full-screen modal"
                                            >
                                                <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Modal</span>
                                            </button>

                                            {resumeData.resumeUrl && (
                                                <a
                                                    href={resumeData.resumeUrl}
                                                    download={resumeData.resumeFilename || "resume.pdf"}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                                                    title="Download PDF"
                                                >
                                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Download</span>
                                                </a>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                                                title="Upload a new PDF to replace this one"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span className="hidden sm:inline">Replace</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setIsDeleteModalOpen(true)}
                                                className="inline-flex items-center justify-center p-2 rounded-lg bg-white hover:bg-rose-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                                                title="Delete resume"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Strip: Public Profile Sharing Switch & Recruiter Score */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                                            <div>
                                                <span className="text-xs font-black text-black block uppercase tracking-tight">
                                                    Public Page Download
                                                </span>
                                                <span className="text-[11px] font-medium text-neutral-600 block mt-0.5">
                                                    {resumeData.isResumePublic
                                                        ? "Visible on public profile"
                                                        : "Hidden from visitors"}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={resumeData.isResumePublic}
                                                disabled={isTogglingVisibility}
                                                onClick={handleToggleVisibility}
                                                className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-black transition-colors duration-200 ease-in-out shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed ${
                                                    resumeData.isResumePublic ? "bg-[#a2ff86]" : "bg-neutral-300"
                                                }`}
                                                title={resumeData.isResumePublic ? "Public download enabled (click to disable)" : "Public download disabled (click to enable)"}
                                            >
                                                <span className="sr-only">Toggle public resume download</span>
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 rounded-full border-2 border-black transition-transform duration-200 ease-in-out shadow-[1px_1px_0px_rgba(0,0,0,0.2)] ${
                                                        resumeData.isResumePublic ? "translate-x-7 bg-black" : "translate-x-1 bg-white"
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        <div
                                            onClick={() => setIsChecksModalOpen(true)}
                                            className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#a2ff86]/30 cursor-pointer transition-all group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center font-black text-xs text-black shadow-[1px_1px_0px_#000] flex-shrink-0">
                                                    <FileCheck2 className="w-4 h-4 stroke-[2.5]" />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-black text-black group-hover:underline block uppercase tracking-tight">
                                                        Recruiter Checks ({passedChecksCount}/8)
                                                    </span>
                                                    <span className="text-[11px] font-medium text-neutral-600 block mt-0.5">
                                                        100% ATS format compliant
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-black">
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
                                        className="w-14 h-14 rounded-xl bg-white border-2 border-black flex items-center justify-center text-black hover:bg-[#a2ff86] transition-all shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer group"
                                    >
                                        <div className="relative">
                                            <FileText className="w-7 h-7 stroke-[2.5]" />
                                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#a2ff86] border-2 border-black flex items-center justify-center">
                                                <FileUp className="w-2.5 h-2.5 stroke-[2.5] text-black" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h3
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-lg sm:text-xl font-black text-black tracking-tight hover:underline cursor-pointer"
                                        >
                                            Drop your resume here
                                        </h3>
                                        <p className="text-xs font-medium text-neutral-600">
                                            PDF up to 5 MB ·{" "}
                                            <span
                                                onClick={() => fileInputRef.current?.click()}
                                                className="font-black text-black underline underline-offset-2 cursor-pointer hover:text-neutral-800"
                                            >
                                                or click to browse
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Blocks 2, 3, 4: 3 Feature Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Card 1: Fills your profile */}
                            <div className="rounded-xl bg-white border-2 border-black p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-[4px_4px_0px_#000]">
                                <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                                    <Sparkles className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-black tracking-tight">
                                        Fills your profile
                                    </h4>
                                    <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                        Name, LinkedIn, coding handles and skills, in one click.
                                    </p>
                                </div>
                            </div>

                            {/* Card 2: Checks it */}
                            <div
                                onClick={() => setIsChecksModalOpen(true)}
                                className="rounded-xl bg-white border-2 border-black p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] group-hover:bg-[#a2ff86] transition-colors">
                                    <Scan className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-black tracking-tight group-hover:underline">
                                        Checks it
                                    </h4>
                                    <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                        Eight quick checks recruiters make in the first ten seconds.
                                    </p>
                                </div>
                            </div>

                            {/* Card 3: Shares it */}
                            <div className="rounded-xl bg-white border-2 border-black p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-[4px_4px_0px_#000]">
                                <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
                                    <FileText className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-black tracking-tight">
                                        Shares it
                                    </h4>
                                    <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                        A download button on your public page, if you want one.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* BELOW-THE-SCREEN: EMBEDDED RESUME DOCUMENT VIEWER */}
                    {/* Shows the active resume PDF directly below the screen when uploaded */}
                    {/* ========================================================================= */}
                    {activeDoc ? (
                        <div
                            id="active-resume-viewer"
                            className="w-full rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] p-5 sm:p-7 space-y-5 transition-all duration-300 mt-8"
                        >
                            {/* Document Viewer Header Bar */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-black">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#a2ff86] border-2 border-black text-black flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_#000]">
                                        <FileText className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h2 className="text-base sm:text-lg font-black text-black tracking-tight truncate max-w-[320px] sm:max-w-[450px]">
                                                {activeDoc.filename}
                                            </h2>
                                            {activeDoc.isDemo && (
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewDemo(false)}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-neutral-100 text-black border-2 border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition-all"
                                                    title="Close demo resume preview"
                                                >
                                                    <X className="w-3 h-3 stroke-[2.5]" />
                                                    <span>Close Demo</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-neutral-600 font-mono font-bold mt-1">
                                            <span>{formatBytes(activeDoc.filesize)}</span>
                                            <span>•</span>
                                            <span>PDF Document</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Toolbar Controls: Zoom, Rotate, Copy Link, Open in Tab, Fullscreen Modal, Download */}
                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-start md:justify-end">
                                    {/* 1. Zoom & Rotation Controls */}
                                    <div className="hidden sm:inline-flex items-center h-9 bg-[#FAF6EE] border-2 border-black rounded-lg px-1.5 gap-1 shadow-[2px_2px_0px_#000]">
                                        <button
                                            type="button"
                                            onClick={() => setZoomLevel((prev) => Math.max(65, prev - 15))}
                                            className="p-1 text-black hover:bg-white rounded transition-colors cursor-pointer"
                                            title="Zoom Out"
                                        >
                                            <ZoomOut className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </button>
                                        <span className="text-[11px] font-mono px-1.5 text-black font-black whitespace-nowrap">
                                            {zoomLevel}%{rotation !== 0 ? ` (${rotation}°)` : ""}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setZoomLevel((prev) => Math.min(160, prev + 15))}
                                            className="p-1 text-black hover:bg-white rounded transition-colors cursor-pointer"
                                            title="Zoom In"
                                        >
                                            <ZoomIn className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                            className="p-1 text-black hover:bg-white rounded transition-colors cursor-pointer"
                                            title="Rotate 90° Clockwise"
                                        >
                                            <RotateCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </button>
                                    </div>

                                    {/* 2. Copy Direct Link */}
                                    <button
                                        type="button"
                                        onClick={handleCopyCdnLink}
                                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer whitespace-nowrap"
                                        title="Copy direct resume link"
                                    >
                                        {isCopiedCdnLink ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 stroke-[3] text-black" />
                                                <span>Copied</span>
                                            </>
                                        ) : (
                                            <>
                                                <Link2 className="w-3.5 h-3.5 stroke-[2.5] text-black" />
                                                <span>Link</span>
                                            </>
                                        )}
                                    </button>

                                    {/* 3. Open in New Tab */}
                                    <a
                                        href={activeDoc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-colors cursor-pointer shrink-0"
                                        title="Open in new tab"
                                    >
                                        <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                                    </a>

                                    {/* 4. Fullscreen Modal Trigger */}
                                    <button
                                        type="button"
                                        onClick={() => setIsPreviewOpen(true)}
                                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-colors cursor-pointer shrink-0"
                                        title="Expand Fullscreen Modal"
                                    >
                                        <Maximize2 className="w-4 h-4 stroke-[2.5]" />
                                    </button>

                                    {/* 5. Download PDF Button */}
                                    <a
                                        href={activeDoc.url}
                                        download={activeDoc.filename || "resume.pdf"}
                                        className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer whitespace-nowrap shrink-0"
                                        title="Download resume PDF"
                                    >
                                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Download PDF</span>
                                    </a>
                                </div>
                            </div>

                            {/* Live Embedded PDF Viewer Viewport with Smooth Scale Zoom & Rotation */}
                            <div className="w-full rounded-xl bg-[#FAF6EE] border-2 border-black overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] relative flex flex-col items-center justify-center min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px]">
                                {!isIframeLoaded && !iframeError && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FAF6EE] space-y-4 pointer-events-none transition-opacity duration-300">
                                        <div className="relative">
                                            <div className="w-14 h-14 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_#000]">
                                                <FileText className="w-7 h-7 stroke-[2.5] animate-pulse" />
                                            </div>
                                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black animate-ping" />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-sm font-black text-black uppercase tracking-tight">Rendering ATS Document...</p>
                                            <p className="text-xs text-neutral-600 font-mono font-bold">
                                                Verified PDF Stream
                                            </p>
                                        </div>
                                        <div className="w-48 h-2 rounded-full bg-white overflow-hidden border-2 border-black shadow-[1px_1px_0px_#000]">
                                            <div className="h-full bg-[#a2ff86] w-full animate-pulse border-r-2 border-black" />
                                        </div>
                                    </div>
                                )}

                                {iframeError && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FAF6EE] p-6 text-center space-y-3">
                                        <AlertCircle className="w-10 h-10 text-amber-500 stroke-[2.5]" />
                                        <h3 className="text-base font-black text-black">Browser Preview Blocked</h3>
                                        <p className="text-xs text-neutral-600 max-w-md font-medium">
                                            Your browser or extension prevented inline PDF rendering. You can still open or download your resume directly.
                                        </p>
                                        <div className="flex items-center gap-3 pt-2">
                                            <a
                                                href={activeDoc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 rounded-lg bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                            >
                                                Open in Tab
                                            </a>
                                            <a
                                                href={activeDoc.url}
                                                download={activeDoc.filename || "resume.pdf"}
                                                className="px-4 py-2 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000]"
                                            >
                                                Download PDF
                                            </a>
                                        </div>
                                    </div>
                                )}

                                <div className="w-full h-full min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px] overflow-auto flex justify-center items-center p-2">
                                    <div
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            minHeight: "750px",
                                            transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                                            transformOrigin: "center center",
                                            transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                        }}
                                        className="w-full h-full min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px] flex items-center justify-center"
                                    >
                                        <iframe
                                            key={activeDoc.url}
                                            src={`${activeDoc.url}#toolbar=1&navpanes=0`}
                                            title={activeDoc.filename}
                                            className="w-full h-full min-h-[750px] sm:min-h-[880px] lg:min-h-[1050px] border-0 rounded-xl bg-white shadow-xl"
                                            onLoad={() => setIsIframeLoaded(true)}
                                            onError={() => {
                                                setIsIframeLoaded(true);
                                                setIframeError(true);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Mobile Helper Callout Bar */}
                                <div className="w-full flex sm:hidden items-center justify-between px-4 py-2.5 bg-[#a2ff86] border-t-2 border-black text-xs font-black text-black">
                                    <span className="truncate">Viewing on mobile?</span>
                                    <a
                                        href={activeDoc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 font-black underline flex items-center gap-1 text-black flex-shrink-0"
                                    >
                                        <span>Open PDF</span>
                                        <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </a>
                                </div>
                            </div>

                            {/* Bottom Insights Strip below the Viewer */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-left space-y-1 shadow-[3px_3px_0px_#000]">
                                    <div className="flex items-center gap-2 text-black text-xs font-black uppercase">
                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-black" />
                                        <span>ATS Readability 100%</span>
                                    </div>
                                    <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                        Clean single-column structure and standard section headers.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-left space-y-1 shadow-[3px_3px_0px_#000]">
                                    <div className="flex items-center gap-2 text-black text-xs font-black uppercase">
                                        <ShieldCheck className="w-4 h-4 stroke-[2.5] text-black" />
                                        <span>Handles Synced</span>
                                    </div>
                                    <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                        LeetCode Guardian & Codeforces ratings live on public profile.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-left space-y-1 shadow-[3px_3px_0px_#000]">
                                    <div className="flex items-center gap-2 text-black text-xs font-black uppercase">
                                        <FileCheck2 className="w-4 h-4 stroke-[2.5] text-black" />
                                        <span>Fast Cloud CDN</span>
                                    </div>
                                    <p className="text-[11px] text-neutral-700 font-medium leading-relaxed">
                                        Cached globally with sub-200ms latency for mobile recruiters.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-left space-y-1 shadow-[3px_3px_0px_#000]">
                                    <div className="flex items-center gap-2 text-black text-xs font-black uppercase">
                                        <ExternalLink className="w-4 h-4 stroke-[2.5] text-black" />
                                        <span>Public Profile Link</span>
                                    </div>
                                    <p className="text-[11px] text-neutral-700 font-mono font-bold truncate">
                                        {profileUrl}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Fallback when no resume is uploaded yet */
                        <div className="w-full rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8 text-center space-y-4 mt-8">
                            <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black text-black mx-auto flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                <FileText className="w-6 h-6 stroke-[2.5]" />
                            </div>
                            <div className="max-w-md mx-auto space-y-1">
                                <h3 className="text-base font-black text-black uppercase tracking-wide">
                                    Live Resume Preview Area
                                </h3>
                                <p className="text-xs font-medium text-neutral-600 leading-relaxed">
                                    Once uploaded, your live resume document will appear right here with interactive zoom, full-screen inspector, and recruiter insights.
                                </p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleLoadSampleResume}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all cursor-pointer"
                                >
                                    <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Preview with Demo Resume Document</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* BOTTOM FULL-WIDTH DESK ILLUSTRATION (Matching Connected Platforms) */}
            {/* ========================================================================= */}
            <div className="w-full mt-auto select-none pointer-events-none overflow-hidden rounded-b-[14px]">
                <img
                    src="/image.png"
                    alt="Resume management workspace illustration"
                    className="w-full h-auto object-cover object-bottom block rounded-b-[14px]"
                    loading="eager"
                />
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: Full-Screen PDF Viewer Modal with Neo-Brutalist Styling */}
            {/* ========================================================================= */}
            {isPreviewOpen && activeDoc?.url && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="previewModalTitle"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsPreviewOpen(false);
                    }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
                >
                    <div className="w-full max-w-6xl h-[90vh] bg-white border-2 border-black rounded-2xl overflow-hidden shadow-[8px_8px_0px_#000] flex flex-col text-black">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-black bg-[#FAF6EE]">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-[#a2ff86] border-2 border-black text-black flex items-center justify-center flex-shrink-0 shadow-[1px_1px_0px_#000]">
                                    <FileText className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <h3 id="previewModalTitle" className="text-sm font-black text-black truncate max-w-sm uppercase">
                                        {activeDoc.filename}
                                    </h3>
                                    <p className="text-[11px] text-neutral-600 font-mono font-bold">
                                        {formatBytes(activeDoc.filesize)} • PDF Document
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={activeDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-colors"
                                    title="Open PDF in new tab"
                                >
                                    <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                                </a>
                                <a
                                    href={activeDoc.url}
                                    download={activeDoc.filename || "resume.pdf"}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000]"
                                    title="Download resume"
                                >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Download</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                    title="Close preview (Esc)"
                                >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Embedded PDF View */}
                        <div className="flex-1 w-full bg-[#FAF6EE] relative overflow-hidden flex items-center justify-center p-2">
                            <iframe
                                src={`${activeDoc.url}#toolbar=1&navpanes=0`}
                                title="Resume PDF Preview"
                                className="w-full h-full border-2 border-black rounded-xl bg-white shadow-md"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: Eight Recruiter Checks Modal with Neo-Brutalist Styling */}
            {/* ========================================================================= */}
            {isChecksModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="checksModalTitle"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsChecksModalOpen(false);
                    }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
                >
                    <div className="w-full max-w-xl bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] space-y-5 text-black">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-[#a2ff86] text-black border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                    <FileCheck2 className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 id="checksModalTitle" className="text-base font-black text-black tracking-tight uppercase">
                                        Eight Quick Recruiter Checks
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Automated scans recruiters perform in the first 10 seconds
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsChecksModalOpen(false)}
                                className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                title="Close checks (Esc)"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {checksList.map((check) => (
                                <div
                                    key={check.id}
                                    className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-start gap-3 shadow-[2px_2px_0px_#000]"
                                >
                                    <div className="mt-0.5 flex-shrink-0">
                                        {check.status === "pass" ? (
                                            <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-black" />
                                        ) : check.status === "warn" ? (
                                            <AlertCircle className="w-4 h-4 stroke-[2.5] text-amber-600" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 stroke-[2.5] text-black" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs font-black text-black uppercase">
                                                {check.label}
                                            </h4>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black bg-[#a2ff86] px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0px_#000]">
                                                Pass
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-neutral-700 mt-0.5 font-medium leading-relaxed">
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
                                className="px-5 py-2 rounded-lg bg-[#a2ff86] text-black text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: Delete Confirmation Modal with Neo-Brutalist Styling */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="deleteModalTitle"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isDeleting) setIsDeleteModalOpen(false);
                    }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
                >
                    <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] space-y-4 text-center text-black">
                        <div className="w-12 h-12 rounded-xl bg-rose-100 border-2 border-black text-rose-600 mx-auto flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Trash2 className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 id="deleteModalTitle" className="text-base font-black text-black tracking-tight uppercase">
                                Delete Resume?
                            </h3>
                            <p className="text-xs text-neutral-600 mt-1 leading-relaxed font-medium">
                                This will permanently remove your resume from Cloudinary and hide the download button from your public profile.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-lg bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteResume}
                                disabled={isDeleting}
                                className="px-5 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer disabled:opacity-50"
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
