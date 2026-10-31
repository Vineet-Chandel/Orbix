// Frontend/src/app/Settings/HelpCenterView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
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
    Loader2,
    Paperclip,
    Plus,
    Check,
    MessageSquare,
    Laptop,
} from "lucide-react";
import {
    createHelpTicket,
    fetchUserHelpTickets,
    fetchHelpTicketDetail,
    sendTicketReply,
    fetchHelpFAQs,
    extractClientSystemInfo,
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

const DEFAULT_FAQS: FAQItem[] = [
    {
        id: "sync-frequency",
        category: "Platform Sync",
        question: "How often does Orbix refresh my platform stats (LeetCode, Codeforces, GitHub)?",
        answer:
            "Orbix triggers automatic daily syncs for all connected profiles. You can also trigger an instant live refresh at any time by visiting your Developer Profile or Onboarding hub and clicking 'Sync'.",
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

export const HelpCenterView: React.FC<HelpCenterViewProps> = ({ user }) => {
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
    const [showAttachmentInput, setShowAttachmentInput] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedTicket, setSubmittedTicket] = useState<HelpTicketItem | null>(null);

    // Auto-diagnostics summary
    const sysInfo = useMemo(() => extractClientSystemInfo(), []);

    // Ticket list states
    const [tickets, setTickets] = useState<HelpTicketItem[]>([]);
    const [isLoadingTickets, setIsLoadingTickets] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<HelpTicketDetail | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);

    // FAQs state (initialized with rich default answers)
    const [faqs, setFaqs] = useState<FAQItem[]>(DEFAULT_FAQS);
    const [expandedFaqId, setExpandedFaqId] = useState<string | null>("sync-frequency");
    const [faqSearch, setFaqSearch] = useState("");

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
            // Silently handled or toast on user action
        } finally {
            setIsLoadingTickets(false);
        }
    }, []);

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
                `Your ticket #${result.ticket.ticketNumber} was submitted. Our team will review it.`,
                { title: "Ticket created" }
            );

            setSubmittedTicket(result.ticket);
            setSubject("");
            setDescription("");
            setAttachmentUrl("");
            setShowAttachmentInput(false);
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

    // Filter FAQs by search
    const filteredFaqs = useMemo(() => {
        if (!faqSearch.trim()) return faqs;
        const q = faqSearch.toLowerCase();
        return faqs.filter(
            (f) =>
                f.question.toLowerCase().includes(q) ||
                f.answer.toLowerCase().includes(q) ||
                f.category.toLowerCase().includes(q)
        );
    }, [faqs, faqSearch]);

    // Status badge style helper
    const renderStatusBadge = (status: HelpTicketStatus) => {
        switch (status) {
            case "open":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-sky-100 text-sky-800 border border-black shadow-[1px_1px_0px_#000]">
                        <Clock className="w-3 h-3" />
                        Open
                    </span>
                );
            case "investigating":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-amber-100 text-amber-800 border border-black shadow-[1px_1px_0px_#000]">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Investigating
                    </span>
                );
            case "waiting_on_user":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-purple-100 text-purple-800 border border-black shadow-[1px_1px_0px_#000]">
                        <MessageSquare className="w-3 h-3" />
                        Action Needed
                    </span>
                );
            case "resolved":
            case "closed":
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono tracking-wider bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                        Resolved
                    </span>
                );
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-4">
            {/* Unified Clean Container (No multiple fragmented blocks) */}
            <div className="bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden">
                {/* Header with Mode Switcher */}
                <div className="p-4 sm:p-6 border-b-2 border-black bg-[#FAF6EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-sky-200 border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center shrink-0">
                            <LifeBuoy className="w-6 h-6 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                    Help Center
                                </h2>
                                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-black uppercase font-mono bg-black text-white rounded-md">
                                    Production Support
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 font-semibold mt-0.5">
                                Instant diagnostics, issue resolution, and developer inquiries.
                            </p>
                        </div>
                    </div>

                    {/* Mode Switcher Tabs */}
                    <div className="inline-flex p-1 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] shrink-0 self-start sm:self-auto">
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

                {/* Body Content by Mode */}
                <div className="p-4 sm:p-6 lg:p-7">
                    {/* TAB 1: CREATE NEW TICKET */}
                    {activeTab === "new" && (
                        <div>
                            {submittedTicket ? (
                                /* Success Feedback State */
                                <div className="py-8 text-center space-y-4 max-w-lg mx-auto">
                                    <div className="w-16 h-16 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center mx-auto">
                                        <Check className="w-8 h-8 text-black stroke-[3]" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-black text-black">
                                            Ticket #{submittedTicket.ticketNumber} Received
                                        </h3>
                                        <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                            We logged your request regarding{" "}
                                            <span className="font-bold text-black">
                                                "{submittedTicket.subject}"
                                            </span>
                                            . Diagnostics were automatically attached. We'll reach out to{" "}
                                            <span className="font-bold text-black font-mono">
                                                {submittedTicket.contactEmail}
                                            </span>
                                            .
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setSubmittedTicket(null)}
                                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-50 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            Submit Another
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSubmittedTicket(null);
                                                setActiveTab("history");
                                            }}
                                            className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            View in My Tickets
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Clean, Wise Form */
                                <form onSubmit={handleSubmitTicket} className="space-y-5">
                                    {/* 1. Category Pill Row */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center justify-between">
                                            <span>1. What do you need help with?</span>
                                            <span className="text-[11px] font-mono text-neutral-500 lowercase">
                                                required
                                            </span>
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                            {CATEGORIES.map((cat) => {
                                                const isSelected = category === cat.id;
                                                return (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => setCategory(cat.id)}
                                                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                                                            isSelected
                                                                ? `${cat.accentColor} shadow-[2.5px_2.5px_0px_#000] -translate-y-0.5`
                                                                : "bg-white border-black/20 hover:border-black hover:bg-neutral-50 text-neutral-800"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="w-6 h-6 rounded-lg bg-white/80 border border-black flex items-center justify-center">
                                                                {cat.icon}
                                                            </div>
                                                            {isSelected && (
                                                                <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
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
                                            className="w-full px-3.5 py-2.5 bg-[#FAF6EE] text-black text-sm font-bold placeholder:text-neutral-500 placeholder:font-normal rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black transition-all"
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
                                            className="w-full p-3.5 bg-[#FAF6EE] text-black text-sm font-medium placeholder:text-neutral-500 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black resize-y transition-all leading-relaxed"
                                            required
                                        />
                                    </div>

                                    {/* 4. Priority & Email Compact Row */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        {/* Severity / Urgency */}
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

                                        {/* Contact Email */}
                                        <div className="space-y-1.5">
                                            <label
                                                htmlFor="help-email"
                                                className="text-xs font-black uppercase tracking-wider text-neutral-700"
                                            >
                                                Reply-To Email
                                            </label>
                                            <input
                                                id="help-email"
                                                type="email"
                                                value={contactEmail}
                                                onChange={(e) => setContactEmail(e.target.value)}
                                                placeholder="your-email@domain.com"
                                                className="w-full px-3.5 py-2 bg-[#FAF6EE] text-black text-sm font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Optional Attachment Link Toggle */}
                                    <div className="pt-1">
                                        {!showAttachmentInput ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowAttachmentInput(true)}
                                                className="text-xs font-bold text-neutral-600 hover:text-black inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-4"
                                            >
                                                <Paperclip className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Attach screenshot URL or link (optional)</span>
                                            </button>
                                        ) : (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <label
                                                        htmlFor="help-attachment"
                                                        className="text-xs font-black uppercase tracking-wider text-neutral-700"
                                                    >
                                                        Screenshot / Attachment URL
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAttachmentUrl("");
                                                            setShowAttachmentInput(false);
                                                        }}
                                                        className="text-[11px] text-neutral-500 hover:text-black font-bold cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                                <input
                                                    id="help-attachment"
                                                    type="url"
                                                    value={attachmentUrl}
                                                    onChange={(e) => setAttachmentUrl(e.target.value)}
                                                    placeholder="https://imgur.com/... or Google Drive link"
                                                    className="w-full px-3.5 py-2 bg-[#FAF6EE] text-black text-xs font-mono rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Reassuring Auto-Diagnostics Indicator */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2 text-neutral-700">
                                            <Laptop className="w-4 h-4 text-black shrink-0" />
                                            <span className="font-bold text-black">Auto-Attached Diagnostics:</span>
                                            <span className="font-mono text-neutral-600 truncate">
                                                {sysInfo.browser} on {sysInfo.os} ({sysInfo.viewport})
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                                            Zero extra effort needed
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Transmitting Request...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4 stroke-[2.5]" />
                                                    <span>Submit Help Request</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {/* TAB 2: MY TICKETS & HISTORY */}
                    {activeTab === "history" && (
                        <div>
                            {isLoadingDetail ? (
                                <div className="py-12 text-center space-y-2">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-black" />
                                    <p className="text-xs font-bold text-neutral-600">
                                        Loading ticket details...
                                    </p>
                                </div>
                            ) : selectedTicket ? (
                                /* Selected Ticket Detail View */
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-black/10">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTicket(null)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-50 text-black text-xs font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                                        >
                                            ← Back to Tickets
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-neutral-600">
                                                #{selectedTicket.ticketNumber}
                                            </span>
                                            {renderStatusBadge(selectedTicket.status)}
                                        </div>
                                    </div>

                                    {/* Ticket Subject & Initial Description */}
                                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <h3 className="text-base font-black text-black">
                                                {selectedTicket.subject}
                                            </h3>
                                            <span className="text-[11px] font-mono text-neutral-500">
                                                {new Date(selectedTicket.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-700 font-medium whitespace-pre-wrap leading-relaxed">
                                            {selectedTicket.description}
                                        </p>
                                        {selectedTicket.attachmentUrl && (
                                            <div className="pt-2">
                                                <a
                                                    href={selectedTicket.attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 hover:underline"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    <span>View Attached Document / Screenshot</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Discussion Messages */}
                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            <span>Discussion Thread</span>
                                        </h4>

                                        {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                            <div className="space-y-2.5">
                                                {selectedTicket.messages.map((m) => {
                                                    const isSupport = m.senderType === "support";
                                                    return (
                                                        <div
                                                            key={m.id}
                                                            className={`p-3.5 rounded-xl border-2 border-black text-xs space-y-1 ${
                                                                isSupport
                                                                    ? "bg-sky-50 shadow-[2px_2px_0px_#000] ml-4 sm:ml-8"
                                                                    : "bg-white shadow-[2px_2px_0px_#000] mr-4 sm:mr-8"
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-black text-black">
                                                                    {isSupport ? "Orbix Support Team" : m.senderName}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-neutral-500">
                                                                    {new Date(m.createdAt).toLocaleTimeString([], {
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })}
                                                                </span>
                                                            </div>
                                                            <p className="text-neutral-800 whitespace-pre-wrap leading-relaxed font-medium">
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
                                                rows={2}
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Add extra context or answer questions here..."
                                                className="w-full p-3 bg-[#FAF6EE] text-black text-xs font-medium rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    type="submit"
                                                    disabled={isSendingReply || !replyText.trim()}
                                                    className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-[#a2ff86] text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                >
                                                    {isSendingReply ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Send className="w-3.5 h-3.5" />
                                                    )}
                                                    <span>Send Reply</span>
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                /* Ticket List */
                                <div className="space-y-4">
                                    {isLoadingTickets ? (
                                        <div className="py-12 text-center space-y-2">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-black" />
                                            <p className="text-xs font-bold text-neutral-600">
                                                Loading your tickets...
                                            </p>
                                        </div>
                                    ) : tickets.length === 0 ? (
                                        <div className="py-12 text-center space-y-3">
                                            <div className="w-12 h-12 rounded-xl bg-neutral-100 border-2 border-black/20 flex items-center justify-center mx-auto text-neutral-400">
                                                <Clock className="w-6 h-6" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <h4 className="text-sm font-black text-black">
                                                    No Tickets Filed
                                                </h4>
                                                <p className="text-xs text-neutral-500 font-medium">
                                                    You haven't submitted any support or bug requests yet.
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
                                        <div className="divide-y-2 divide-black/10 border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0px_#000]">
                                            {tickets.map((t) => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => handleSelectTicket(t.id)}
                                                    className="p-4 bg-white hover:bg-[#FAF6EE]/60 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                >
                                                    <div className="space-y-1 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs font-black text-neutral-900 bg-[#FAF6EE] px-2 py-0.5 rounded border border-black/30">
                                                                #{t.ticketNumber}
                                                            </span>
                                                            <span className="text-xs font-black text-black truncate">
                                                                {t.subject}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-neutral-600 line-clamp-1 font-medium">
                                                            {t.description}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        {renderStatusBadge(t.status)}
                                                        <span className="text-[11px] font-mono text-neutral-500">
                                                            {new Date(t.createdAt).toLocaleDateString([], {
                                                                month: "short",
                                                                day: "numeric",
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: INSTANT FAQS & SOLUTIONS */}
                    {activeTab === "faqs" && (
                        <div className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={faqSearch}
                                    onChange={(e) => setFaqSearch(e.target.value)}
                                    placeholder="Search answers (e.g. sync, college cooldown, score)..."
                                    className="w-full px-4 py-2.5 bg-[#FAF6EE] text-black text-xs font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black placeholder:font-normal placeholder:text-neutral-500"
                                />
                            </div>

                            {/* Accordion Questions */}
                            <div className="space-y-2.5">
                                {filteredFaqs.map((faq) => {
                                    const isExpanded = expandedFaqId === faq.id;
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
                                                className="w-full p-3.5 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF6EE]/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
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
                                                <div className="p-3.5 pt-0 text-xs text-neutral-700 font-medium leading-relaxed border-t border-black/10 bg-[#FAF6EE]/20">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Contact Support Footer in FAQs */}
                            <div className="pt-2 text-center">
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
            </div>
        </div>
    );
};
