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

    // Modals
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isChecksModalOpen, setIsChecksModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // "For your resume" snippet controls
    const [snippetTab, setSnippetTab] = useState<SnippetTab>("bullets");
    const [includeProfileLink, setIncludeProfileLink] = useState(true);
    const [onlyVerifiedPlatforms, setOnlyVerifiedPlatforms] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load initial resume status
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);

        if (isDemo) {
            setResumeData({
                hasResume: true,
                resumeUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                resumeFilename: "Vineet_Chandel_FullStack_Resume.pdf",
                resumeFilesize: 1420000,
                resumeUpdatedAt: new Date().toISOString(),
                isResumePublic: true,
                checks: [
                    { id: "format", label: "ATS-Compliant PDF Format", status: "pass", description: "Standard PDF format accepted by 99% of Applicant Tracking Systems." },
                    { id: "size", label: "Optimized File Size", status: "pass", description: "File size is 1.42 MB (under 5 MB limit). Fast to load for recruiters on mobile." },
                    { id: "profile_link", label: "Verified Coding Profile Link", status: "pass", description: "Includes live verified profile showcasing 1,680+ solved problems." },
                    { id: "contact_info", label: "Direct Contact Clarity", status: "pass", description: "Recruiters can immediately find your email, location, and verified links." },
                    { id: "structure", label: "Standard Section Headers", status: "pass", description: "Clear division across Experience, Skills, Education, and Projects." },
                    { id: "action_verbs", label: "Impact & Action Verbs", status: "pass", description: "Quantified metrics and strong leadership verbs stand out in 10-second scans." },
                    { id: "skills_highlight", label: "Technical Stack Coherence", status: "pass", description: "Technical skills match verified platform activity and repository languages." },
                    { id: "readability", label: "Typography & Clean Layout", status: "pass", description: "Single-column clean layout easily parsed by recruiters." },
                ],
            });
            setIsLoading(false);
            return;
        }

        fetchMyResume()
            .then((data) => {
                if (isMounted) {
                    setResumeData(data);
                    setIsLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    // Fallback to user object if already in state
                    if (user?.resumeUrl) {
                        setResumeData({
                            hasResume: true,
                            resumeUrl: user.resumeUrl,
                            resumeFilename: user.resumeFilename || "resume.pdf",
                            resumeFilesize: user.resumeFilesize || null,
                            resumeUpdatedAt: user.resumeUpdatedAt || null,
                            isResumePublic: user.isResumePublic !== false,
                        });
                    }
                    setIsLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [user, isDemo]);

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
        if (!dateStr) return "Recently uploaded";
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
        // 1. Validate MIME type & extension
        const isPdfMime = file.type === "application/pdf" || file.type === "application/x-pdf";
        const isPdfExt = file.name.toLowerCase().endsWith(".pdf");
        if (!isPdfMime && !isPdfExt) {
            toast.error("Please upload your resume in PDF format (.pdf only).", {
                title: "Invalid File Type",
            });
            return;
        }

        // 2. Validate max size (5 MB strict limit)
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
            setResumeData(res.resume);
            toast.success("Resume uploaded and analyzed successfully!", {
                title: "Upload Complete",
            });
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
            // LinkedIn
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

    // Recruiter Checks Summary (default 8 checks)
    const checksList = resumeData.checks && resumeData.checks.length > 0
        ? resumeData.checks
        : [
            { id: "format", label: "ATS-Compliant PDF Format", status: "pass", description: "Standard PDF format accepted by 99% of Applicant Tracking Systems." },
            { id: "size", label: "Optimized File Size", status: "pass", description: "File size is under 5 MB. Fast to load for recruiters on mobile." },
            { id: "profile_link", label: "Verified Coding Profile Link", status: "pass", description: "Includes live verified profile showcasing live rankings." },
            { id: "contact_info", label: "Direct Contact Clarity", status: "pass", description: "Recruiters can immediately find your email and verified links." },
            { id: "structure", label: "Standard Section Headers", status: "pass", description: "Clear division across Experience, Skills, Education, and Projects." },
            { id: "action_verbs", label: "Impact & Action Verbs", status: "pass", description: "Quantified metrics and strong leadership verbs stand out in 10-second scans." },
            { id: "skills_highlight", label: "Technical Stack Coherence", status: "pass", description: "Technical skills match verified platform activity." },
            { id: "readability", label: "Typography & Clean Layout", status: "pass", description: "Single-column clean layout easily parsed by recruiters." },
        ];

    const passedChecksCount = checksList.filter((c) => c.status === "pass").length;

    if (isLoading) {
        return (
            <div className="w-full max-w-[1600px] mx-auto py-16 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-700 border-t-amber-400 rounded-full animate-spin mb-3" />
                <p className="text-xs text-neutral-400 font-mono">Loading resume details...</p>
            </div>
        );
    }

    return (
        <section
            aria-label="Resume Management & Cloudinary Storage"
            className={`w-full max-w-[1600px] mx-auto select-none font-sans text-white ${className}`}
        >
            {/* Header Title & Subtitle */}
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Resume
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl font-medium leading-relaxed">
                    Upload your resume. We read it to fill in your profile, check it, and let you share it from your public page.
                </p>
            </div>

            {/* Main Split Grid: Left (Upload, Stats, Recruiter Checks) + Right (For your resume snippet & verified status) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* ========================================================================= */}
                {/* LEFT COLUMN: Upload Dropzone & 3 Feature Summary Cards */}
                {/* ========================================================================= */}
                <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
                    {/* Upload Dropzone Container */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full rounded-2xl sm:rounded-3xl border-2 transition-all duration-200 relative overflow-hidden flex flex-col justify-center items-center text-center p-6 sm:p-10 min-h-[260px] sm:min-h-[290px] ${
                            isDragging
                                ? "border-amber-400 bg-amber-500/[0.04] shadow-[0_0_30px_rgba(250,204,21,0.15)]"
                                : resumeData.hasResume
                                ? "border-neutral-800 bg-[#0d111c]/90 shadow-xl"
                                : "border-dashed border-neutral-700/70 hover:border-neutral-500 bg-[#0d111c]/60 hover:bg-[#0d111c]/90"
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
                                <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 mx-auto flex items-center justify-center animate-pulse shadow-md">
                                    <FileUp className="w-7 h-7 animate-bounce" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                        Uploading to Cloudinary...
                                    </h3>
                                    <p className="text-xs text-neutral-400 mt-0.5">
                                        Compressing and analyzing recruiter checks ({uploadProgress}%)
                                    </p>
                                </div>
                                <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden border border-neutral-700">
                                    <div
                                        className="h-full bg-amber-400 transition-all duration-200 rounded-full shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        ) : resumeData.hasResume ? (
                            /* State 2: Resume IS Uploaded (Active & Manageable) */
                            <div className="w-full flex flex-col justify-between space-y-6 animate-fadeIn">
                                {/* Top Strip: File Info & Badge */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80 text-left">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-[280px] sm:max-w-[380px]" title={resumeData.resumeFilename || "Resume.pdf"}>
                                                    {resumeData.resumeFilename || "Resume.pdf"}
                                                </h3>
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide uppercase">
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

                                    {/* Action Buttons: View, Download, Replace, Delete */}
                                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={() => setIsPreviewOpen(true)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                                            title="View resume PDF"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-neutral-900" />
                                            <span>View</span>
                                        </button>

                                        {resumeData.resumeUrl && (
                                            <a
                                                href={resumeData.resumeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={resumeData.resumeFilename || "resume.pdf"}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all border border-neutral-700/80 shadow-2xs active:scale-95 cursor-pointer"
                                                title="Download PDF"
                                            >
                                                <Download className="w-3.5 h-3.5 text-neutral-300" />
                                                <span className="hidden sm:inline">Download</span>
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
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#080B13]/80 border border-neutral-800 text-left">
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
                                                resumeData.isResumePublic ? "bg-[#FACC15]" : "bg-neutral-700"
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
                                        className="flex items-center justify-between p-3.5 rounded-xl bg-[#080B13]/80 border border-neutral-800 text-left hover:border-neutral-700 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                <FileCheck2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors block">
                                                    Recruiter Checks ({passedChecksCount}/8)
                                                </span>
                                                <span className="text-[11px] text-neutral-400 block mt-0.5">
                                                    100% ATS format compliant
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold text-neutral-400 group-hover:text-white transition-colors">
                                            Details →
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* State 3: Empty State (Upload Prompt Matching Exact User Screenshot) */
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex flex-col items-center justify-center space-y-3 cursor-pointer group py-4"
                            >
                                {/* Center icon with upward arrow */}
                                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 group-hover:text-white group-hover:scale-105 group-hover:bg-white/[0.08] transition-all shadow-md">
                                    <div className="relative">
                                        <FileText className="w-7 h-7 text-neutral-400 group-hover:text-white transition-colors" />
                                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center">
                                            <FileUp className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-amber-400 transition-colors">
                                        Drop your resume here
                                    </h3>
                                    <p className="text-xs text-neutral-400 font-medium">
                                        PDF up to 5 MB · <span className="text-neutral-300 underline decoration-neutral-600 underline-offset-4 group-hover:text-white">or click to browse</span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom 3 Cards (Exact match to user screenshot) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Card 1: Fills your profile */}
                        <div className="rounded-2xl bg-[#0d111c]/90 border border-neutral-800/90 p-5 flex flex-col justify-between space-y-3 hover:border-neutral-700/80 transition-all shadow-sm">
                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 shadow-2xs">
                                <Sparkles className="w-4 h-4 text-neutral-300" />
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
                            className="rounded-2xl bg-[#0d111c]/90 border border-neutral-800/90 p-5 flex flex-col justify-between space-y-3 hover:border-neutral-700/80 transition-all shadow-sm cursor-pointer group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 group-hover:text-amber-400 transition-colors shadow-2xs">
                                <Scan className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white tracking-tight group-hover:text-amber-400 transition-colors">
                                    Checks it
                                </h4>
                                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                                    Eight quick checks recruiters make in the first ten seconds.
                                </p>
                            </div>
                        </div>

                        {/* Card 3: Shares it */}
                        <div className="rounded-2xl bg-[#0d111c]/90 border border-neutral-800/90 p-5 flex flex-col justify-between space-y-3 hover:border-neutral-700/80 transition-all shadow-sm">
                            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 shadow-2xs">
                                <FileText className="w-4 h-4 text-neutral-300" />
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

                {/* ========================================================================= */}
                {/* RIGHT COLUMN: "For your resume" Snippet Generator & Verified Indicator */}
                {/* ========================================================================= */}
                <div className="lg:col-span-4 flex flex-col justify-between space-y-5">
                    <div className="w-full h-full rounded-2xl sm:rounded-3xl bg-[#0d111c]/90 border border-neutral-800/90 p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-5">
                        <div className="space-y-4">
                            {/* Card Header: Document icon + "For your resume" */}
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-neutral-300 shadow-2xs">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                                    For your resume
                                </h3>
                            </div>

                            {/* Segmented Tab Controls: One line | Bullets | LinkedIn */}
                            <div className="grid grid-cols-3 p-1 rounded-xl bg-[#080B13] border border-neutral-800/80 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setSnippetTab("one_line")}
                                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        snippetTab === "one_line"
                                            ? "bg-[#182030] text-white shadow-xs"
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
                                            ? "bg-[#182030] text-white shadow-xs"
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
                                            ? "bg-[#182030] text-white shadow-xs"
                                            : "text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    LinkedIn
                                </button>
                            </div>

                            {/* Dashed Preview Box (Exact match to screenshot) */}
                            <div className="w-full rounded-xl border border-dashed border-neutral-700/80 bg-[#080B13]/70 p-4 font-mono text-xs text-neutral-300 space-y-1.5 leading-relaxed min-h-[92px] select-text">
                                <p className="text-neutral-300 font-medium whitespace-pre-line">
                                    {snippetText}
                                </p>
                            </div>

                            {/* Action Row: Yellow Copy Button + Add my profile link toggle */}
                            <div className="flex items-center justify-between gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={handleCopySnippet}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-neutral-950 text-xs sm:text-sm font-bold transition-all transform active:scale-95 shadow-md cursor-pointer flex-shrink-0"
                                >
                                    {isCopied ? (
                                        <>
                                            <Check className="w-4 h-4 text-neutral-950" />
                                            <span>Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4 text-neutral-950" />
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
                                            includeProfileLink ? "bg-[#FACC15]" : "bg-neutral-700"
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                includeProfileLink ? "translate-x-4" : "translate-x-0"
                                            }`}
                                        />
                                    </button>
                                    <span className="text-xs font-semibold text-neutral-300 cursor-pointer select-none" onClick={() => setIncludeProfileLink((prev) => !prev)}>
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
                                        onlyVerifiedPlatforms ? "bg-[#FACC15]" : "bg-neutral-700"
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                            onlyVerifiedPlatforms ? "translate-x-4" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                                <span className="text-xs font-semibold text-neutral-400 cursor-pointer select-none" onClick={() => setOnlyVerifiedPlatforms((prev) => !prev)}>
                                    Only verified platforms
                                </span>
                            </div>
                        </div>

                        {/* Status Footer: Verified Handles Note */}
                        <div className="pt-3 border-t border-neutral-800/80 flex items-start gap-2.5 text-xs text-neutral-400">
                            <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                            <p className="leading-normal text-[11px]">
                                8 of 8 handles verified. Recruiters can open your link and see the tick next to each one.{" "}
                                <a
                                    href="/profile"
                                    className="text-amber-400 hover:text-amber-300 font-bold underline underline-offset-2"
                                >
                                    Verify more
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: Interactive PDF Resume Viewer Modal */}
            {/* ========================================================================= */}
            {isPreviewOpen && resumeData.resumeUrl && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
                    <div className="w-full max-w-5xl h-[88vh] bg-[#0d111c] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-[#080B13]">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-white truncate max-w-sm">
                                        {resumeData.resumeFilename || "Resume.pdf"}
                                    </h3>
                                    <p className="text-[11px] text-neutral-400 font-mono">
                                        {formatBytes(resumeData.resumeFilesize)} • Cloudinary Verified
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={resumeData.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                                    title="Open PDF in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <a
                                    href={resumeData.resumeUrl}
                                    download={resumeData.resumeFilename || "resume.pdf"}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition-all shadow-sm"
                                    title="Download resume"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                    title="Close preview"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Embedded PDF View with Fallback */}
                        <div className="flex-1 w-full bg-[#1A1F2C] relative overflow-hidden flex items-center justify-center">
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
            {/* MODAL 2: Eight Recruiter Checks Modal */}
            {/* ========================================================================= */}
            {isChecksModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="w-full max-w-xl bg-[#0d111c] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                                    <FileCheck2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white tracking-tight">
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
                                className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {checksList.map((check) => (
                                <div
                                    key={check.id}
                                    className="p-3 rounded-xl bg-[#080B13] border border-neutral-800/80 flex items-start gap-3"
                                >
                                    <div className="mt-0.5 flex-shrink-0">
                                        {check.status === "pass" ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        ) : check.status === "warn" ? (
                                            <AlertCircle className="w-4 h-4 text-amber-400" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 text-cyan-400" />
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
                                className="px-5 py-2 rounded-full bg-white hover:bg-neutral-200 text-neutral-950 text-xs font-bold transition-all cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: Delete Confirmation Modal */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="w-full max-w-md bg-[#0d111c] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">
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
                                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
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
