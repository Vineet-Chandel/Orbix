// Frontend/src/app/Settings/HelpCenterView.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    LifeBuoy,
    Bug,
    RefreshCw,
    GraduationCap,
    Lightbulb,
    HelpCircle,
    Send,
    CheckCircle2,
    Clock,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Paperclip,
    Plus,
    Check,
    MessageSquare,
    Laptop,
    ArrowLeft,
    UploadCloud,
    Image as ImageIcon,
    X,
    FileCheck,
    Sparkles,
} from "lucide-react";
import { OrbixLoader, OrbixButton } from "../../components/ui/loader";
import {
    createHelpTicket,
    fetchUserHelpTickets,
    fetchHelpTicketDetail,
    sendTicketReply,
    fetchHelpFAQs,
    submitFAQFeedback,
    extractClientSystemInfo,
    uploadHelpScreenshot,
    type HelpTicketCategory,
    type HelpTicketPriority,
    type HelpTicketStatus,
    type HelpTicketItem,
    type HelpTicketDetail,
    type FAQItem,
} from "../../api/helpApi";
import { useToast } from "../../context/ToastContext";

interface HelpCenterViewProps {
    user: any;
    onBack?: () => void;
}

type TabMode = "new" | "history" | "faqs";

interface CategoryOption {
    id: HelpTicketCategory;
    label: string;
    icon: React.ReactNode;
    placeholderSubject: string;
    placeholderDetails: string;
    accentColor: string;
}

const CATEGORIES: CategoryOption[] = [
    {
        id: "bug_report",
        label: "Bug Report",
        icon: <Bug className="w-3.5 h-3.5 stroke-[2.5]" />,
        placeholderSubject: "e.g., Contest rating graph not rendering on mobile",
        placeholderDetails: "Describe the bug, what you clicked, and what happened vs what you expected...",
        accentColor: "bg-rose-100 hover:bg-rose-200 border-black",
    },
    {
        id: "sync_issue",
        label: "Sync & Stats",
        icon: <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />,
        placeholderSubject: "e.g., LeetCode solved count hasn't synced in 24 hours",
        placeholderDetails: "Which platform is affected? What are your expected numbers vs what Orbix shows?",
        accentColor: "bg-amber-100 hover:bg-amber-200 border-black",
    },
    {
        id: "college_verification",
        label: "College & Club",
        icon: <GraduationCap className="w-3.5 h-3.5 stroke-[2.5]" />,
        placeholderSubject: "e.g., Inquiry regarding club verification status",
        placeholderDetails: "State your college or club name, representative details, or verification query...",
        accentColor: "bg-emerald-100 hover:bg-emerald-200 border-black",
    },
    {
        id: "feature_request",
        label: "Feature Request",
        icon: <Lightbulb className="w-3.5 h-3.5 stroke-[2.5]" />,
        placeholderSubject: "e.g., Add CodeChef contest reminder widget",
        placeholderDetails: "What capability would improve your workflow on Orbix? Why would it help?",
        accentColor: "bg-[#FFE566] hover:bg-[#ffe043] border-black",
    },
    {
        id: "general_inquiry",
        label: "General Help",
        icon: <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />,
        placeholderSubject: "e.g., Question about Orbix Score calculation",
        placeholderDetails: "How can our team help you today?",
        accentColor: "bg-sky-100 hover:bg-sky-200 border-black",
    },
];

interface ResolutionStage {
    step: number;
    key: "open" | "investigating" | "waiting_on_user" | "resolved" | "closed";
    title: string;
    shortTitle: string;
    subtitle: string;
    description: string;
    badge: string;
    accentColor: string;
}

const RESOLUTION_STAGES: ResolutionStage[] = [
    {
        step: 1,
        key: "open",
        title: "Ticket Received",
        shortTitle: "Received",
        subtitle: "Logged & Queued",
        description: "Your inquiry has been logged with system diagnostics. It is queued for review by an engineer.",
        badge: "Stage 1/5 • Queued",
        accentColor: "bg-amber-100 text-amber-900 border-black",
    },
    {
        step: 2,
        key: "investigating",
        title: "Triaging & Analysis",
        shortTitle: "Triaging",
        subtitle: "Engineer Investigating",
        description: "An engineer has been assigned and is analyzing logs, inspecting screenshots, and reproducing the behavior.",
        badge: "Stage 2/5 • In Triaging",
        accentColor: "bg-sky-100 text-sky-900 border-black",
    },
    {
        step: 3,
        key: "waiting_on_user",
        title: "Dev & In Progress",
        shortTitle: "In Progress",
        subtitle: "Fix Underway / Feedback",
        description: "Root cause isolated. Fix is actively in development, or we may follow up with reproduction questions.",
        badge: "Stage 3/5 • In Progress",
        accentColor: "bg-purple-100 text-purple-900 border-black",
    },
    {
        step: 4,
        key: "resolved",
        title: "Fix Verified",
        shortTitle: "Verified",
        subtitle: "Tested in Production",
        description: "Solution deployed and tested. Official resolution details and notes published by our staff.",
        badge: "Stage 4/5 • Fix Verified",
        accentColor: "bg-emerald-100 text-emerald-900 border-black",
    },
    {
        step: 5,
        key: "closed",
        title: "Resolved & Closed",
        shortTitle: "Closed",
        subtitle: "Archived & Nominal",
        description: "Ticket successfully concluded and archived. All systems nominal.",
        badge: "Stage 5/5 • Closed",
        accentColor: "bg-neutral-100 text-neutral-800 border-black",
    },
];

function getStageStep(status: HelpTicketStatus): number {
    switch (status) {
        case "open": return 1;
        case "investigating": return 2;
        case "waiting_on_user": return 3;
        case "resolved": return 4;
        case "closed": return 5;
        default: return 1;
    }
}

const DEFAULT_FAQS: FAQItem[] = [
    {
        id: "sync-frequency",
        category: "Platform Sync",
        question: "How often does Orbix refresh my platform stats (LeetCode, Codeforces, GitHub)?",
        answer:
            "Orbix triggers automatic daily syncs for all connected profiles. You can also trigger an instant live refresh at any time by visiting your Profile or Onboarding hub and clicking 'Sync'.",
    },
    {
        id: "college-update-rule",
        category: "College & Identity",
        question: "Why is my College Name locked or on cooldown?",
        answer:
            "To ensure leaderboard integrity and prevent gaming college standings during contest seasons, college identity updates have a 3-day verification cooldown. You can change your college once every 3 days.",
    },
    {
        id: "orbix-score",
        category: "Orbix Score",
        question: "How is the Orbix Score calculated across competitive platforms?",
        answer:
            "Orbix Score is a calibrated 0 to 10,000 composite algorithm that mathematically weights algorithmic problem counts across platforms (40%), rated contest performance (35%), active weekly streak consistency (15%), and verified open-source GitHub contributions (10%). Diminishing returns curves ensure fair benchmarking across all coding platforms.",
    },
    {
        id: "private-profile",
        category: "Privacy",
        question: "What happens when I toggle my profile to Private?",
        answer:
            "A private profile immediately de-indexes your stats, contest rating history, and resume from public URLs and global explore searches. Only essential identity information (name and handle) remains visible to confirmed connections.",
    },
    {
        id: "resume-audit",
        category: "Resume Intelligence",
        question: "How does the Resume Intelligence engine evaluate my resume?",
        answer:
            "The Orbix Resume Intelligence engine uses deterministic multi-stage AST parsing to evaluate resumes across 7 distinct dimensions: ATS Compatibility, Quantification & Metrics, Technical Depth, Action-Oriented Language, Brevity, Section Architecture, and Verifiable Project Provenance.",
    },
    {
        id: "club-verification",
        category: "Clubs & Chapters",
        question: "What is required to verify a student developer club?",
        answer:
            "Clubs submit collegiate proof (such as an official college portal link or faculty advisor contact). Once submitted, the Orbix verification queue reviews the request under the 4-Pillar Reviewer Standard within 24 to 48 business hours.",
    },
    {
        id: "card-studio",
        category: "Developer Card",
        question: "How can I export my verified developer card or embed my live badge?",
        answer:
            "Visit the Card Studio on your profile page to customize themes, download high-resolution PNG/SVG assets, or copy the auto-updating Markdown badge snippet for your GitHub README.",
    },
];

export const HelpCenterView: React.FC<HelpCenterViewProps> = ({ user, onBack }) => {
    const toast = useToast();

    // Mode: "new" (form), "history" (tickets list), "faqs" (knowledge base)
    const [activeTab, setActiveTab] = useState<TabMode>("new");

    // Form inputs (wise, minimal, clear)
    const [category, setCategory] = useState<HelpTicketCategory>("bug_report");
    const [subject, setSubject] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<HelpTicketPriority>("normal");
    const [contactEmail, setContactEmail] = useState(user?.email || user?.gmail || "");
    const [attachmentUrl, setAttachmentUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedTicket, setSubmittedTicket] = useState<HelpTicketItem | null>(null);

    // Cloudinary Drag & Drop Upload State
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadedFileName, setUploadedFileName] = useState("");
    const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
    const [showManualUrlInput, setShowManualUrlInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-diagnostics summary
    const sysInfo = useMemo(() => extractClientSystemInfo(), []);

    // Ticket list states
    const [tickets, setTickets] = useState<HelpTicketItem[]>([]);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<HelpTicketDetail | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isSyncingLiveStatus, setIsSyncingLiveStatus] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);

    // FAQs state (initialized with rich default answers)
    const [faqs, setFaqs] = useState<FAQItem[]>(DEFAULT_FAQS);
    const [expandedFaqId, setExpandedFaqId] = useState<string | null>("sync-frequency");
    const [faqSearch, setFaqSearch] = useState("");
    const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>("all");
    const [votedFaqs, setVotedFaqs] = useState<Record<string, boolean>>({});

    const handleFaqFeedback = async (faqId: string, isHelpful: boolean) => {
        setVotedFaqs((prev) => ({ ...prev, [faqId]: isHelpful }));
        try {
            await submitFAQFeedback(faqId, isHelpful);
            toast.info("Thank you for your feedback!", { title: "Documentation Rating" });
        } catch {
            // non-blocking
        }
    };

    // Active category metadata
    const activeCatConfig = useMemo(
        () => CATEGORIES.find((c) => c.id === category) || CATEGORIES[0],
        [category]
    );

    // Fetch user tickets when switching to history tab
    const loadTickets = useCallback(async () => {
        setIsLoadingTickets(true);
        try {
            const data = await fetchUserHelpTickets();
            setTickets(data.tickets || []);
        } catch {
            // Silently handled
        } finally {
            setIsLoadingTickets(false);
        }
    }, []);

    // Refresh live ticket status on demand
    const handleRefreshTicket = async (ticketId: string) => {
        setIsSyncingLiveStatus(true);
        try {
            const data = await fetchHelpTicketDetail(ticketId);
            setSelectedTicket(data.ticket);
            // Also refresh tickets list in background
            loadTickets();
            toast.success("Live progress synced from database.", { title: "Status Updated" });
        } catch (err: any) {
            toast.error(err.message || "Could not refresh live status.", { title: "Sync Failed" });
        } finally {
            setIsSyncingLiveStatus(false);
        }
    };

    // Fetch FAQs from API with fallback to DEFAULT_FAQS
    useEffect(() => {
        fetchHelpFAQs()
            .then((data) => {
                if (data?.faqs && data.faqs.length > 0) {
                    setFaqs(data.faqs);
                }
            })
            .catch(() => {
                // Preserves DEFAULT_FAQS smoothly
            });
    }, []);

    useEffect(() => {
        if (activeTab === "history") {
            loadTickets();
        }
    }, [activeTab, loadTickets]);

    // Handle Cloudinary File Selection / Drop
    const handleProcessImageFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please drop or select a valid image file (PNG, JPG, WEBP, GIF, AVIF).", {
                title: "Invalid File Type",
            });
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Image file size exceeds the 10 MB limit. Please select a smaller screenshot.", {
                title: "File Too Large",
            });
            return;
        }

        const localPreview = URL.createObjectURL(file);
        setUploadedPreview(localPreview);
        setUploadedFileName(file.name);
        setIsUploadingImage(true);
        setUploadProgress(10);

        try {
            const result = await uploadHelpScreenshot(file, (percent) => {
                setUploadProgress(percent);
            });
            setAttachmentUrl(result.secureUrl);
            setUploadProgress(100);
            toast.success("Screenshot uploaded to Cloudinary successfully!", {
                title: "Attachment Ready",
            });
        } catch (uploadErr: any) {
            toast.error(uploadErr?.message || "Failed to upload image to Cloudinary. Please try again.", {
                title: "Upload Failed",
            });
            setUploadedPreview(null);
            setUploadedFileName("");
            setAttachmentUrl("");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            handleProcessImageFile(file);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            handleProcessImageFile(file);
        }
    };

    const handleClearAttachment = () => {
        setUploadedPreview(null);
        setUploadedFileName("");
        setAttachmentUrl("");
        setUploadProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Handle ticket submission
    const handleSubmitTicket = async (e: React.FormEvent) => {
        e.preventDefault();

        if (subject.trim().length < 5) {
            toast.error("Subject is too short. Please provide at least 5 characters.", {
                title: "Subject required",
            });
            return;
        }

        if (description.trim().length < 10) {
            toast.error("Please provide at least 10 characters describing the issue.", {
                title: "Details required",
            });
            return;
        }

        if (!contactEmail.trim() || !contactEmail.includes("@")) {
            toast.error("Please provide a valid contact email so we can update you.", {
                title: "Email required",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await createHelpTicket({
                category,
                subject: subject.trim(),
                description: description.trim(),
                priority,
                contactEmail: contactEmail.trim(),
                attachmentUrl: attachmentUrl.trim() || undefined,
                systemInfo: sysInfo,
            });

            toast.success(
                `Your ticket #${result.ticket.ticketNumber} was submitted. Confirmation email dispatched to ${contactEmail.trim()}.`,
                { title: "Ticket Created" }
            );

            setSubmittedTicket(result.ticket);
            setSubject("");
            setDescription("");
            handleClearAttachment();
            loadTickets();
        } catch (err: any) {
            toast.error(err.message || "Failed to submit help ticket. Please try again.", {
                title: "Submission failed",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open single ticket detail
    const handleSelectTicket = async (ticketId: string) => {
        setIsLoadingDetail(true);
        try {
            const data = await fetchHelpTicketDetail(ticketId);
            setSelectedTicket(data.ticket);
        } catch (err: any) {
            toast.error(err.message || "Failed to load ticket details.", {
                title: "Error loading ticket",
            });
        } finally {
            setIsLoadingDetail(false);
        }
    };

    // Send follow-up reply to ticket
    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket || !replyText.trim()) return;

        setIsSendingReply(true);
        try {
            const res = await sendTicketReply(selectedTicket.id, replyText.trim());
            setSelectedTicket({
                ...selectedTicket,
                messages: [...selectedTicket.messages, res.reply],
            });
            setReplyText("");
            toast.success("Follow-up reply recorded.", { title: "Reply sent" });
        } catch (err: any) {
            toast.error(err.message || "Could not post message.", { title: "Reply failed" });
        } finally {
            setIsSendingReply(false);
        }
    };

    // Filter FAQs by search and category
    const filteredFaqs = useMemo(() => {
        let list = faqs;
        if (faqCategoryFilter !== "all") {
            list = list.filter((f) => f.category.toLowerCase().includes(faqCategoryFilter.toLowerCase()));
        }
        if (!faqSearch.trim()) return list;
        const q = faqSearch.toLowerCase();
        return list.filter(
            (f) =>
                f.question.toLowerCase().includes(q) ||
                f.answer.toLowerCase().includes(q) ||
                f.category.toLowerCase().includes(q)
        );
    }, [faqs, faqSearch, faqCategoryFilter]);

    // Status badge style helper
    const renderStatusBadge = (status: HelpTicketStatus) => {
        switch (status) {
            case "open":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-amber-100 text-amber-900 border border-black shadow-[1px_1px_0px_#000]">
                        <Clock className="w-3 h-3 text-amber-800" />
                        Received
                    </span>
                );
            case "investigating":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-sky-100 text-sky-900 border border-black shadow-[1px_1px_0px_#000]">
                        <RefreshCw className="w-3 h-3 animate-spin text-sky-800" />
                        Investigating
                    </span>
                );
            case "waiting_on_user":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-purple-100 text-purple-900 border border-black shadow-[1px_1px_0px_#000]">
                        <MessageSquare className="w-3 h-3 text-purple-800" />
                        Action Needed
                    </span>
                );
            case "resolved":
            case "closed":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                        {status === "resolved" ? "Fix Verified" : "Closed"}
                    </span>
                );
        }
    };

    return (
        <div className="w-full space-y-6">
            {/* Unified Full-Width Header Bar */}
            <div className="w-full p-4 sm:p-6 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
                            aria-label="Back to Settings Hub"
                            title="Back to Settings Hub"
                        >
                            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    )}
                    <div className="w-11 h-11 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center shrink-0">
                        <LifeBuoy className="w-6 h-6 text-black stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                Help Center
                            </h1>
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase font-mono bg-black text-[#a2ff86] rounded-md border border-black">
                                Production Support
                            </span>
                        </div>
                        <p className="text-xs text-neutral-600 font-semibold mt-0.5">
                            Instant diagnostics, issue resolution, and developer inquiries.
                        </p>
                    </div>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="inline-flex p-1 bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] shrink-0 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("new");
                            setSelectedTicket(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === "new"
                                ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] border border-black"
                                : "text-neutral-700 hover:text-black"
                        }`}
                    >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>New Request</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("history");
                            setSelectedTicket(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === "history"
                                ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] border border-black"
                                : "text-neutral-700 hover:text-black"
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>My Tickets</span>
                        {tickets.length > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black text-white">
                                {tickets.length}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab("faqs");
                            setSelectedTicket(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === "faqs"
                                ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] border border-black"
                                : "text-neutral-700 hover:text-black"
                        }`}
                    >
                        <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>FAQs</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: CREATE NEW TICKET */}
            {activeTab === "new" && (
                <div className="w-full bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] p-5 sm:p-7 lg:p-8">
                    {submittedTicket ? (
                        /* Success Feedback State */
                        <div className="py-8 text-center space-y-5 max-w-xl mx-auto">
                            <div className="w-16 h-16 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center mx-auto">
                                <Check className="w-8 h-8 text-black stroke-[3]" />
                            </div>
                            <div className="space-y-2">
                                <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase font-mono bg-black text-[#a2ff86]">
                                    Confirmation Email Sent
                                </span>
                                <h3 className="text-xl sm:text-2xl font-black text-black">
                                    Ticket #{submittedTicket.ticketNumber} Filed Successfully
                                </h3>
                                <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                    We received your inquiry regarding{" "}
                                    <span className="font-bold text-black">
                                        "{submittedTicket.subject}"
                                    </span>
                                    . All diagnostic details and your Cloudinary attachments were logged. We've dispatched an acknowledgment email to{" "}
                                    <span className="font-bold text-black font-mono">
                                        {submittedTicket.contactEmail}
                                    </span>
                                    .
                                </p>
                            </div>

                            {/* 5-Stage Live Preview in Success Screen */}
                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black text-left space-y-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 block">
                                    Ticket Resolution Pipeline
                                </span>
                                <div className="grid grid-cols-5 gap-1 pt-1 text-center font-black text-[10px]">
                                    <div className="p-1.5 rounded bg-[#a2ff86] border border-black text-black">
                                        1. Logged ✓
                                    </div>
                                    <div className="p-1.5 rounded bg-sky-100 border border-black text-sky-900">
                                        2. Triaging
                                    </div>
                                    <div className="p-1.5 rounded bg-white border border-black/30 text-neutral-500">
                                        3. In Dev
                                    </div>
                                    <div className="p-1.5 rounded bg-white border border-black/30 text-neutral-500">
                                        4. Verified
                                    </div>
                                    <div className="p-1.5 rounded bg-white border border-black/30 text-neutral-500">
                                        5. Closed
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setSubmittedTicket(null)}
                                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-50 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Submit Another Request
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSubmittedTicket(null);
                                        setActiveTab("history");
                                    }}
                                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Track Live Progress
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Clean, Wise Ticket Submission Form */
                        <form onSubmit={handleSubmitTicket} className="space-y-6">
                            {/* 1. Category Selection Row */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center justify-between">
                                    <span>1. What do you need help with?</span>
                                    <span className="text-[11px] font-mono text-neutral-500 lowercase">
                                        required
                                    </span>
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                    {CATEGORIES.map((cat) => {
                                        const isSelected = category === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategory(cat.id)}
                                                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col gap-2 ${
                                                    isSelected
                                                        ? `${cat.accentColor} shadow-[3px_3px_0px_#000] -translate-y-0.5`
                                                        : "bg-white border-black/25 hover:border-black hover:bg-neutral-50 text-neutral-800"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="w-7 h-7 rounded-lg bg-white/90 border border-black flex items-center justify-center">
                                                        {cat.icon}
                                                    </div>
                                                    {isSelected && (
                                                        <Check className="w-4 h-4 text-black stroke-[3]" />
                                                    )}
                                                </div>
                                                <span className="text-xs font-black text-black leading-tight">
                                                    {cat.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. Subject Input */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="help-subject"
                                    className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center justify-between"
                                >
                                    <span>2. Subject / Short Summary</span>
                                    <span className="text-[11px] font-mono text-neutral-500">
                                        {subject.length}/200
                                    </span>
                                </label>
                                <input
                                    id="help-subject"
                                    type="text"
                                    value={subject}
                                    maxLength={200}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder={activeCatConfig.placeholderSubject}
                                    className="w-full px-4 py-2.5 bg-[#FAF6EE] text-black text-sm font-bold placeholder:text-neutral-500 placeholder:font-normal rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black transition-all"
                                    required
                                />
                            </div>

                            {/* 3. Details Textarea */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="help-details"
                                    className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center justify-between"
                                >
                                    <span>3. Details & Context</span>
                                    <span className="text-[11px] font-mono text-neutral-500">
                                        {description.length}/5000
                                    </span>
                                </label>
                                <textarea
                                    id="help-details"
                                    rows={4}
                                    value={description}
                                    maxLength={5000}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={activeCatConfig.placeholderDetails}
                                    className="w-full p-4 bg-[#FAF6EE] text-black text-sm font-medium placeholder:text-neutral-500 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black resize-y transition-all leading-relaxed"
                                    required
                                />
                            </div>

                            {/* 4. Priority & Reply-To Email Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-neutral-700">
                                        Priority / Urgency
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(["low", "normal", "high"] as const).map((p) => {
                                            const isP = priority === p;
                                            const labels = {
                                                low: "Low",
                                                normal: "Normal",
                                                high: "Urgent",
                                            };
                                            const colors = {
                                                low: "bg-emerald-100",
                                                normal: "bg-sky-100",
                                                high: "bg-rose-100",
                                            };
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setPriority(p)}
                                                    className={`py-2 px-2.5 rounded-xl border-2 text-xs font-black capitalize transition-all cursor-pointer ${
                                                        isP
                                                            ? `${colors[p]} border-black shadow-[2px_2px_0px_#000] -translate-y-0.5`
                                                            : "bg-white border-black/20 hover:border-black text-neutral-700"
                                                    }`}
                                                >
                                                    {labels[p]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="help-email"
                                        className="text-xs font-black uppercase tracking-wider text-neutral-700"
                                    >
                                        Reply-To Email (For Ticket Updates)
                                    </label>
                                    <input
                                        id="help-email"
                                        type="email"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        placeholder="your-email@domain.com"
                                        className="w-full px-4 py-2.5 bg-[#FAF6EE] text-black text-sm font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black"
                                        required
                                    />
                                </div>
                            </div>

                            {/* 5. Cloudinary Drag & Drop / Tap-To-Upload Zone */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                                        <Paperclip className="w-3.5 h-3.5" />
                                        <span>Screenshot / Attachment</span>
                                        <span className="text-[10px] font-mono font-bold bg-[#FFE566] text-black px-1.5 py-0.2 rounded border border-black">
                                            Cloudinary Auto-Upload
                                        </span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setShowManualUrlInput(!showManualUrlInput)}
                                        className="text-[11px] font-bold text-neutral-600 hover:text-black underline underline-offset-2 cursor-pointer"
                                    >
                                        {showManualUrlInput ? "Hide URL Option" : "Or enter external link"}
                                    </button>
                                </div>

                                {/* Hidden native file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileInputChange}
                                />

                                {/* Uploading Progress State */}
                                {isUploadingImage && (
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                                        <div className="flex items-center justify-between text-xs font-black">
                                            <span className="flex items-center gap-2">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                                                Uploading screenshot to Cloudinary...
                                            </span>
                                            <span className="font-mono">{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-white rounded-full border border-black overflow-hidden p-0.5">
                                            <div
                                                className="h-full bg-[#a2ff86] rounded-full transition-all duration-300 border border-black"
                                                style={{ width: `${Math.max(10, uploadProgress)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Attached Image Preview Card */}
                                {attachmentUrl && !isUploadingImage && (
                                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {uploadedPreview ? (
                                                <img
                                                    src={uploadedPreview}
                                                    alt="Screenshot preview"
                                                    className="w-14 h-14 object-cover rounded-lg border-2 border-black shadow-[1px_1px_0px_#000] shrink-0"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 bg-white rounded-lg border-2 border-black flex items-center justify-center shrink-0">
                                                    <ImageIcon className="w-6 h-6 text-black" />
                                                </div>
                                            )}
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black text-black truncate max-w-[220px]">
                                                        {uploadedFileName || "Screenshot Attached"}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-[#a2ff86] text-black px-1.5 py-0.2 rounded border border-black">
                                                        <FileCheck className="w-3 h-3 text-emerald-800" />
                                                        Cloudinary Verified
                                                    </span>
                                                </div>
                                                <a
                                                    href={attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] text-sky-700 hover:underline font-mono truncate block max-w-xs sm:max-w-md"
                                                >
                                                    {attachmentUrl}
                                                </a>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-neutral-100 text-black border border-black rounded-lg cursor-pointer"
                                            >
                                                Replace
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearAttachment}
                                                className="p-1.5 bg-rose-100 hover:bg-rose-200 text-black border border-black rounded-lg cursor-pointer"
                                                title="Remove Attachment"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Interactive Drag & Drop Box */}
                                {!attachmentUrl && !isUploadingImage && (
                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`p-6 sm:p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                                            isDragOver
                                                ? "bg-[#FFE566]/30 border-black scale-[0.99] shadow-[3px_3px_0px_#000]"
                                                : "bg-[#FAF6EE]/50 hover:bg-[#FAF6EE] border-black/40 hover:border-black"
                                        }`}
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                            <UploadCloud className="w-6 h-6 text-black" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs sm:text-sm font-black text-black">
                                                Drag & drop your screenshot here, or{" "}
                                                <span className="text-sky-700 underline underline-offset-2">
                                                    browse files
                                                </span>
                                            </p>
                                            <p className="text-[11px] text-neutral-500 font-medium">
                                                Supports PNG, JPG, WEBP, GIF up to 10 MB. Automatically saved to Cloudinary.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Optional Direct URL Input */}
                                {showManualUrlInput && (
                                    <div className="pt-2">
                                        <input
                                            type="url"
                                            value={attachmentUrl}
                                            onChange={(e) => setAttachmentUrl(e.target.value)}
                                            placeholder="https://res.cloudinary.com/... or image link"
                                            className="w-full px-3.5 py-2 bg-[#FAF6EE] text-black text-xs font-mono rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Auto-Attached Diagnostics Banner */}
                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-neutral-700">
                                    <Laptop className="w-4 h-4 text-black shrink-0" />
                                    <span className="font-bold text-black">Auto-Attached Diagnostics:</span>
                                    <span className="font-mono text-neutral-700 truncate">
                                        {sysInfo.browser} on {sysInfo.os} ({sysInfo.viewport})
                                    </span>
                                </div>
                                <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                                    Zero extra effort needed
                                </span>
                            </div>

                            {/* Submit Button */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <OrbixButton
                                    type="submit"
                                    loading={isSubmitting}
                                    loadingLabel="Transmitting Request..."
                                    variant="black"
                                    size="lg"
                                    icon={<Send className="w-4 h-4 stroke-[2.5]" />}
                                    uppercase
                                >
                                    Submit Help Request
                                </OrbixButton>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* TAB 2: MY TICKETS & 4-5 RESOLUTION PROGRESS FLOW */}
            {activeTab === "history" && (
                <div className="w-full bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] p-5 sm:p-7 lg:p-8">
                    {isLoadingDetail ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-black">
                            <OrbixLoader size="md" />
                            <p className="text-xs font-bold text-neutral-500">Loading ticket details & discussion...</p>
                        </div>
                    ) : selectedTicket ? (
                        /* Selected Ticket Detail View with 5-Stage Live Stepper */
                        <div className="space-y-6">
                            {/* Navigation Bar */}
                            <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-black/10 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setSelectedTicket(null)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-50 text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                                >
                                    ← Back to All Tickets
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRefreshTicket(selectedTicket.id)}
                                        disabled={isSyncingLiveStatus}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF6EE] hover:bg-[#FFE566] text-black text-xs font-bold border border-black cursor-pointer transition-colors"
                                        title="Poll latest updates from database"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isSyncingLiveStatus ? "animate-spin" : ""}`} />
                                        <span>Sync Live Status</span>
                                    </button>
                                    <span className="text-xs font-mono font-bold text-neutral-600 bg-[#FAF6EE] px-2 py-0.5 rounded border border-black/20">
                                        #{selectedTicket.ticketNumber}
                                    </span>
                                    {renderStatusBadge(selectedTicket.status)}
                                </div>
                            </div>

                            {/* 5-STAGE LIVE RESOLUTION STEPPER */}
                            <div className="p-4 sm:p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div>
                                        <span className="text-[10px] font-black uppercase font-mono tracking-wider text-neutral-500 block">
                                            Live Resolution Pipeline
                                        </span>
                                        <h3 className="text-base sm:text-lg font-black text-black">
                                            Current Status: Stage {getStageStep(selectedTicket.status)} of 5 (
                                            {RESOLUTION_STAGES[getStageStep(selectedTicket.status) - 1].title})
                                        </h3>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-neutral-600">
                                        Last Updated: {new Date(selectedTicket.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>

                                {/* Stepper Visual Track */}
                                <div className="relative pt-2 pb-1">
                                    {/* Connecting Track Line */}
                                    <div className="hidden md:block absolute top-[28px] left-6 right-6 h-1 bg-black/20 z-0">
                                        <div
                                            className="h-full bg-black transition-all duration-500"
                                            style={{
                                                width: `${((getStageStep(selectedTicket.status) - 1) / 4) * 100}%`,
                                            }}
                                        />
                                    </div>

                                    {/* Stages Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-2 relative z-10">
                                        {RESOLUTION_STAGES.map((stage) => {
                                            const currentStep = getStageStep(selectedTicket.status);
                                            const isDone = stage.step < currentStep;
                                            const isCurrent = stage.step === currentStep;

                                            return (
                                                <div
                                                    key={stage.step}
                                                    className={`p-3 rounded-xl border-2 transition-all flex md:flex-col items-center md:items-center md:text-center gap-3 ${
                                                        isCurrent
                                                            ? "bg-[#FFE566] border-black shadow-[2.5px_2.5px_0px_#000] scale-[1.02]"
                                                            : isDone
                                                            ? "bg-[#a2ff86]/40 border-black"
                                                            : "bg-white/80 border-black/25 opacity-70"
                                                    }`}
                                                >
                                                    {/* Node Circle */}
                                                    <div
                                                        className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center shrink-0 font-black text-xs shadow-[1.5px_1.5px_0px_#000] ${
                                                            isDone
                                                                ? "bg-[#a2ff86] text-black"
                                                                : isCurrent
                                                                ? "bg-black text-[#FFE566] animate-pulse"
                                                                : "bg-white text-neutral-500"
                                                        }`}
                                                    >
                                                        {isDone ? (
                                                            <Check className="w-4 h-4 stroke-[3]" />
                                                        ) : isCurrent ? (
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            stage.step
                                                        )}
                                                    </div>

                                                    {/* Stage Text */}
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black text-black leading-tight">
                                                            {stage.title}
                                                        </div>
                                                        <div className="text-[10px] text-neutral-600 font-semibold truncate">
                                                            {stage.subtitle}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Stage Information Callout */}
                                <div className="p-3.5 rounded-xl bg-white border-2 border-black text-xs space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-black" />
                                        <span className="font-black text-black uppercase tracking-wider text-[11px]">
                                            What is happening right now?
                                        </span>
                                    </div>
                                    <p className="text-neutral-700 leading-relaxed font-medium">
                                        {RESOLUTION_STAGES[getStageStep(selectedTicket.status) - 1].description}
                                    </p>
                                </div>

                                {/* Resolution Note (if staff documented one) */}
                                {selectedTicket.resolutionNote && (
                                    <div className="p-3.5 rounded-xl bg-[#a2ff86]/30 border-2 border-black text-xs space-y-1">
                                        <div className="flex items-center gap-2 text-emerald-950 font-black">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                                            <span>Resolution Note from Support Team</span>
                                        </div>
                                        <p className="text-neutral-900 font-medium whitespace-pre-wrap leading-relaxed">
                                            {selectedTicket.resolutionNote}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Ticket Subject & Initial Description */}
                            <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h3 className="text-base sm:text-lg font-black text-black">
                                        {selectedTicket.subject}
                                    </h3>
                                    <span className="text-[11px] font-mono text-neutral-500">
                                        Filed on {new Date(selectedTicket.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm text-neutral-800 font-medium whitespace-pre-wrap leading-relaxed">
                                    {selectedTicket.description}
                                </p>
                                {selectedTicket.attachmentUrl && (
                                    <div className="pt-2 border-t border-black/10">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 block mb-1.5">
                                            Attached Screenshot
                                        </span>
                                        <a
                                            href={selectedTicket.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 p-2 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-50 text-xs font-bold text-black"
                                        >
                                            <Paperclip className="w-3.5 h-3.5 text-black" />
                                            <span>View Full Attachment</span>
                                            <ExternalLink className="w-3.5 h-3.5 text-neutral-600" />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Discussion Thread */}
                            <div className="space-y-4 pt-1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    <span>Discussion & Activity Thread</span>
                                </h4>

                                {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedTicket.messages.map((m) => {
                                            const isSupport = m.senderType === "support";
                                            return (
                                                <div
                                                    key={m.id}
                                                    className={`p-4 rounded-xl border-2 border-black text-xs space-y-1.5 ${
                                                        isSupport
                                                            ? "bg-sky-50 shadow-[2.5px_2.5px_0px_#000] ml-3 sm:ml-8"
                                                            : "bg-white shadow-[2.5px_2.5px_0px_#000] mr-3 sm:mr-8"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-black text-black flex items-center gap-1.5">
                                                            {isSupport ? "Orbix Support Team" : m.senderName}
                                                            {isSupport && (
                                                                <span className="text-[9px] font-mono bg-black text-white px-1.5 py-0.2 rounded">
                                                                    STAFF
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-neutral-500">
                                                            {new Date(m.createdAt).toLocaleTimeString([], {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed font-medium text-xs sm:text-[13px]">
                                                        {m.message}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-neutral-500 italic">
                                        No follow-up messages yet. Our team will review your diagnostic payload.
                                    </p>
                                )}

                                {/* Reply Box */}
                                <form onSubmit={handleSendReply} className="pt-2 space-y-2">
                                    <textarea
                                        rows={3}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Add extra details, answer questions, or update context here..."
                                        className="w-full p-3.5 bg-[#FAF6EE] text-black text-xs font-medium rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black leading-relaxed"
                                    />
                                    <div className="flex justify-end">
                                        <OrbixButton
                                            type="submit"
                                            disabled={!replyText.trim()}
                                            loading={isSendingReply}
                                            loadingLabel="Sending Reply..."
                                            variant="black"
                                            size="sm"
                                            icon={<Send className="w-3.5 h-3.5" />}
                                            uppercase
                                        >
                                            Send Reply
                                        </OrbixButton>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        /* Ticket List View */
                        <div className="space-y-4">
                            {isLoadingTickets ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-3 text-black">
                                    <OrbixLoader size="md" />
                                    <p className="text-xs font-bold text-neutral-500">Fetching your tickets...</p>
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="py-14 text-center space-y-3">
                                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 border-2 border-black/20 flex items-center justify-center mx-auto text-neutral-400">
                                        <Clock className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-base font-black text-black">
                                            No Tickets Filed Yet
                                        </h4>
                                        <p className="text-xs text-neutral-500 font-medium max-w-sm mx-auto">
                                            You haven't submitted any support or bug requests. If you notice any anomalies, let us know!
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("new")}
                                        className="px-4 py-2 rounded-xl bg-[#FFE566] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#ffe043] cursor-pointer"
                                    >
                                        Create First Request
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-1">
                                        <span className="text-xs font-black uppercase tracking-wider text-neutral-700">
                                            Your Support Requests ({tickets.length})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={loadTickets}
                                            className="text-xs font-bold text-neutral-600 hover:text-black flex items-center gap-1 cursor-pointer"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Refresh</span>
                                        </button>
                                    </div>

                                    <div className="divide-y-2 divide-black/10 border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_#000] bg-white">
                                        {tickets.map((t) => {
                                            const step = getStageStep(t.status);
                                            const stageInfo = RESOLUTION_STAGES[step - 1];

                                            return (
                                                <div
                                                    key={t.id}
                                                    onClick={() => handleSelectTicket(t.id)}
                                                    className="p-4 sm:p-5 bg-white hover:bg-[#FAF6EE] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                                                >
                                                    <div className="space-y-1.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-black text-neutral-900 bg-[#FAF6EE] px-2 py-0.5 rounded border border-black/30">
                                                                #{t.ticketNumber}
                                                            </span>
                                                            <span className="text-sm font-black text-black truncate">
                                                                {t.subject}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-neutral-600 line-clamp-1 font-medium">
                                                            {t.description}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                                        {/* Stage Pill */}
                                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${stageInfo.accentColor} shadow-[1px_1px_0px_#000]`}>
                                                            {stageInfo.badge}
                                                        </span>

                                                        <span className="text-[11px] font-mono text-neutral-500">
                                                            {new Date(t.createdAt).toLocaleDateString([], {
                                                                month: "short",
                                                                day: "numeric",
                                                            })}
                                                        </span>

                                                        <span className="text-xs font-black text-black">
                                                            →
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: INSTANT FAQS & SOLUTIONS */}
            {activeTab === "faqs" && (
                <div className="w-full bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] p-5 sm:p-7 lg:p-8 space-y-5">
                    {/* Search and Category Filter */}
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={faqSearch}
                            onChange={(e) => setFaqSearch(e.target.value)}
                            placeholder="Search answers (e.g. sync, college cooldown, score, resume, clubs)..."
                            className="w-full px-4 py-2.5 bg-[#FAF6EE] text-black text-xs font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black placeholder:font-normal placeholder:text-neutral-500"
                        />

                        <div className="flex flex-wrap items-center gap-1.5">
                            {["all", "Platform Sync", "College", "Score", "Privacy", "Clubs"].map((cat) => {
                                const isSel = faqCategoryFilter === cat;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setFaqCategoryFilter(cat)}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                            isSel
                                                ? "bg-[#FFE566] text-black border-black shadow-[1.5px_1.5px_0px_#000]"
                                                : "bg-white text-neutral-600 border-black/20 hover:border-black"
                                        }`}
                                    >
                                        {cat === "all" ? "All Topics" : cat}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Accordion Questions */}
                    <div className="space-y-2.5">
                        {filteredFaqs.length === 0 ? (
                            <div className="p-8 text-center rounded-xl bg-white border-2 border-black space-y-2">
                                <p className="text-xs font-black text-black">No matching documentation found</p>
                                <p className="text-[11px] text-neutral-500">
                                    Try searching with another keyword, or submit a direct ticket to our team.
                                </p>
                            </div>
                        ) : (
                            filteredFaqs.map((faq) => {
                                const isExpanded = expandedFaqId === faq.id;
                                const hasVoted = votedFaqs[faq.id] !== undefined;

                                return (
                                    <div
                                        key={faq.id}
                                        className="rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_#000] overflow-hidden"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedFaqId(isExpanded ? null : faq.id)
                                            }
                                            className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF6EE]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#FAF6EE] border border-black/30 text-neutral-700 shrink-0">
                                                    {faq.category}
                                                </span>
                                                <span className="text-xs sm:text-sm font-black text-black">
                                                    {faq.question}
                                                </span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-black shrink-0 stroke-[2.5]" />
                                            )}
                                        </button>

                                        {isExpanded && (
                                            <div className="p-4 pt-0 text-xs text-neutral-700 font-medium leading-relaxed border-t border-black/10 bg-[#FAF6EE]/20 space-y-3">
                                                <p className="pt-3 leading-relaxed">{faq.answer}</p>

                                                {/* Helpful Voting */}
                                                <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] text-neutral-600">
                                                    <span>Was this answer helpful?</span>
                                                    <div className="flex items-center gap-2">
                                                        {hasVoted ? (
                                                            <span className="font-bold text-black flex items-center gap-1">
                                                                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                                                Thanks for your feedback!
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleFaqFeedback(faq.id, true)}
                                                                    className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-[#a2ff86] text-black font-bold cursor-pointer transition-colors"
                                                                >
                                                                    Yes
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleFaqFeedback(faq.id, false)}
                                                                    className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-rose-100 text-black font-bold cursor-pointer transition-colors"
                                                                >
                                                                    No
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Contact Support Footer in FAQs */}
                    <div className="pt-3 text-center">
                        <p className="text-xs text-neutral-600 font-medium">
                            Still need assistance?{" "}
                            <button
                                type="button"
                                onClick={() => setActiveTab("new")}
                                className="font-black text-black underline underline-offset-4 cursor-pointer"
                            >
                                Create a direct ticket with our team →
                            </button>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
