import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    ShieldCheck,
    CheckCircle2,
    Laptop,
    Mail,
    Send,
    AlertCircle,
    ExternalLink,
    Check,
    Download,
    LifeBuoy,
    HelpCircle,
    Lock,
    Globe,
    FileText,
    Users,
    Award,
    GraduationCap,
    ChevronDown,
    ChevronUp,
    Search,
    Plus,
} from "lucide-react";
import type { ClubSettingsViewKey } from "./types";
import { useToast } from "../../../context/ToastContext";
import { NeoToggle } from "../../../components/NeoToggle";
import OtpSegmentedInput from "../../../LandingPages/Auth-Pages/OtpSegmentedInput";
import { OrbixLogo } from "../../../components/OrbixLogo";
import {
    changeClubPassword,
    sendClubEmailVerificationOtp,
    confirmClubEmailVerificationOtp,
} from "../../../api/clubSettingsApi";
import {
    fetchManageAccountsStatus,
    startEmailChange,
    authorizeOldEmail,
    verifyNewEmail,
    checkUsernameAvailability,
    confirmUsernameChange,
    type ManageAccountsStatus,
} from "../../../api/manageAccountApi";

interface ClubSettingDetailViewProps {
    viewKey: ClubSettingsViewKey;
    club: {
        id: string;
        name: string;
        slug: string;
        college_name: string;
        college_city?: string;
        college_state?: string;
        logo_url: string | null;
        public_email?: string | null;
        verified_at?: string;
        is_active?: boolean;
    };
    user: any;
    onBack: () => void;
    onSelectView: (view: ClubSettingsViewKey) => void;
    onRefreshStatus?: () => void;
}

export const ClubSettingDetailView: React.FC<ClubSettingDetailViewProps> = ({
    viewKey,
    club,
    user,
    onBack,
    onSelectView,
    onRefreshStatus,
}) => {
    const toast = useToast();

    // -------------------------------------------------------------------------
    // PASSWORD AND SECURITY STATE
    // -------------------------------------------------------------------------
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.isTwoFactorEnabled));

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword) {
            toast.error("Please fill in both current and new password.", { title: "Password Error" });
            return;
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters long.", { title: "Weak Password" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.", { title: "Mismatch" });
            return;
        }

        setIsSavingPassword(true);
        try {
            const res = await changeClubPassword({
                currentPassword,
                newPassword,
                confirmPassword,
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success(res?.message || "Password updated successfully.", { title: "Credentials Updated" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to update password. Please check your current password.", { title: "Update Failed" });
        } finally {
            setIsSavingPassword(false);
        }
    };

    // -------------------------------------------------------------------------
    // EMAIL VERIFICATION STATE (VERIFY ACCOUNT)
    // -------------------------------------------------------------------------
    const isEmailVerified = Boolean(user?.isEmailVerified);
    const [isSendingVerifyOtp, setIsSendingVerifyOtp] = useState(false);
    const [isConfirmingVerifyOtp, setIsConfirmingVerifyOtp] = useState(false);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [otpDigits, setOtpDigits] = useState("");
    const [verifyCooldown, setVerifyCooldown] = useState(0);

    useEffect(() => {
        let timer: any = null;
        if (verifyCooldown > 0) {
            timer = setInterval(() => {
                setVerifyCooldown((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [verifyCooldown]);

    const handleSendVerificationCode = async () => {
        setIsSendingVerifyOtp(true);
        try {
            const email = user?.gmail || club.public_email || "";
            const res = await sendClubEmailVerificationOtp(email);
            setShowOtpInput(true);
            setVerifyCooldown(res?.cooldownSeconds || 60);
            toast.info(`A 6-digit verification code was sent to ${email} via Resend.`, {
                title: "Code Dispatched",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to send verification code.", { title: "Verification Failed" });
        } finally {
            setIsSendingVerifyOtp(false);
        }
    };

    const handleConfirmVerificationCode = async () => {
        const fullOtp = otpDigits.trim();
        if (fullOtp.length !== 6) {
            toast.error("Please enter the complete 6-digit code.", { title: "Invalid Code" });
            return;
        }

        setIsConfirmingVerifyOtp(true);
        try {
            const res = await confirmClubEmailVerificationOtp(fullOtp);
            toast.success(res?.message || "Club primary email verified successfully!", { title: "Email Verified" });
            setShowOtpInput(false);
            if (onRefreshStatus) onRefreshStatus();
        } catch (err: any) {
            toast.error(err?.message || "Invalid or expired verification code.", { title: "Verification Failed" });
        } finally {
            setIsConfirmingVerifyOtp(false);
        }
    };

    // -------------------------------------------------------------------------
    // MANAGE ACCOUNT (EMAIL & SLUG / HANDLE WORKFLOW)
    // -------------------------------------------------------------------------
    const [manageStatus, setManageStatus] = useState<ManageAccountsStatus | null>(null);

    // Email change state
    const [isEmailChangeModalOpen, setIsEmailChangeModalOpen] = useState(false);
    const [newEmailInput, setNewEmailInput] = useState("");
    const [emailChangeStage, setEmailChangeStage] = useState<"input" | "old_otp" | "new_otp">("input");
    const [emailChangeOpId, setEmailChangeOpId] = useState("");
    const [emailChangeOtpDigits, setEmailChangeOtpDigits] = useState("");
    const [isEmailChangeSubmitting, setIsEmailChangeSubmitting] = useState(false);

    // Slug / Handle change state
    const [isSlugModalOpen, setIsSlugModalOpen] = useState(false);
    const [newSlugInput, setNewSlugInput] = useState("");
    const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
    const [slugCheckMessage, setSlugCheckMessage] = useState("");
    const [slugPassword, setSlugPassword] = useState("");
    const [isSubmittingSlug, setIsSubmittingSlug] = useState(false);

    const loadManageStatus = async () => {
        try {
            const data = await fetchManageAccountsStatus();
            setManageStatus(data);
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        if (viewKey === "manage-account") {
            loadManageStatus();
        }
    }, [viewKey]);

    // Handle check slug debounce
    useEffect(() => {
        if (!newSlugInput.trim()) {
            setSlugAvailable(null);
            setSlugCheckMessage("");
            return;
        }

        const normalized = newSlugInput.trim().toLowerCase();
        if (normalized === club.slug.toLowerCase()) {
            setSlugAvailable(false);
            setSlugCheckMessage("This is already your current organization handle.");
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await checkUsernameAvailability(normalized);
                setSlugAvailable(res.available);
                setSlugCheckMessage(res.reason || (res.available ? "Handle is available!" : "Handle is unavailable."));
            } catch {
                setSlugAvailable(false);
                setSlugCheckMessage("Failed to check handle availability.");
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [newSlugInput, club.slug]);

    const handleStartEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmailInput.trim()) {
            toast.error("Please enter a new email address.", { title: "Email Required" });
            return;
        }

        setIsEmailChangeSubmitting(true);
        try {
            const res = await startEmailChange(newEmailInput.trim());
            setEmailChangeOpId(res.operationId || "");
            setEmailChangeStage("old_otp");
            setEmailChangeOtpDigits("");
            toast.info(`Authorization code sent to your current email (${user?.gmail || club.public_email}).`, {
                title: "Step 1: Authorize Current Email",
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to start email change.", { title: "Error" });
        } finally {
            setIsEmailChangeSubmitting(false);
        }
    };

    const handleAuthorizeOldEmail = async () => {
        const otp = emailChangeOtpDigits.trim();
        if (otp.length !== 6) {
            toast.error("Please enter the complete 6-digit code.", { title: "Code Required" });
            return;
        }

        setIsEmailChangeSubmitting(true);
        try {
            await authorizeOldEmail(emailChangeOpId, otp);
            setEmailChangeStage("new_otp");
            setEmailChangeOtpDigits("");
            toast.success(`Current email authorized! Verification code sent to ${newEmailInput}.`, {
                title: "Step 2: Verify New Email",
            });
        } catch (err: any) {
            toast.error(err?.message || "Invalid authorization code.", { title: "Authorization Failed" });
        } finally {
            setIsEmailChangeSubmitting(false);
        }
    };

    const handleVerifyNewEmail = async () => {
        const otp = emailChangeOtpDigits.trim();
        if (otp.length !== 6) {
            toast.error("Please enter the complete 6-digit code.", { title: "Code Required" });
            return;
        }

        setIsEmailChangeSubmitting(true);
        try {
            const res = await verifyNewEmail(emailChangeOpId, otp);
            toast.success(res?.message || "Club primary email updated successfully!", { title: "Email Changed" });
            setIsEmailChangeModalOpen(false);
            setNewEmailInput("");
            setEmailChangeStage("input");
            loadManageStatus();
            if (onRefreshStatus) onRefreshStatus();
        } catch (err: any) {
            toast.error(err?.message || "Failed to verify new email.", { title: "Verification Failed" });
        } finally {
            setIsEmailChangeSubmitting(false);
        }
    };

    const handleConfirmSlugChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSlugInput.trim() || !slugAvailable) {
            toast.error("Please enter a valid, available club handle.", { title: "Invalid Handle" });
            return;
        }
        if (!slugPassword) {
            toast.error("Please enter your current administrative password to confirm.", { title: "Password Required" });
            return;
        }

        setIsSubmittingSlug(true);
        try {
            const res = await confirmUsernameChange({
                newUsername: newSlugInput.trim().toLowerCase(),
                currentPassword: slugPassword,
            });
            toast.success(res?.message || "Club handle updated successfully!", { title: "Handle Changed" });
            setIsSlugModalOpen(false);
            setNewSlugInput("");
            setSlugPassword("");
            loadManageStatus();
            if (onRefreshStatus) onRefreshStatus();
        } catch (err: any) {
            toast.error(err?.message || "Failed to update club handle.", { title: "Update Failed" });
        } finally {
            setIsSubmittingSlug(false);
        }
    };

    // -------------------------------------------------------------------------
    // HELP CENTER STATE & FAQ DATA
    // -------------------------------------------------------------------------
    const [clubHelpTab, setClubHelpTab] = useState<"new" | "faqs" | "channels">("new");
    const [helpCategory, setHelpCategory] = useState<string>("college_verification");
    const [helpSubject, setHelpSubject] = useState("");
    const [helpDescription, setHelpDescription] = useState("");
    const [helpPriority, setHelpPriority] = useState<"normal" | "urgent" | "event_day">("normal");
    const [helpContactEmail, setHelpContactEmail] = useState(user?.gmail || club.public_email || "");
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
    const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string | null>(null);
    const [clubFaqSearch, setClubFaqSearch] = useState("");
    const [expandedClubFaqId, setExpandedClubFaqId] = useState<string | null>("advisor-change");

    const CLUB_FAQS = [
        {
            id: "advisor-change",
            category: "Accreditation",
            question: "How do we update our Faculty Advisor or official campus point of contact?",
            answer:
                "Submit a ticket under 'Collegiate Accreditation & Verification' with the faculty advisor's institutional email (.edu / official college domain) and department title. Our verification team reviews staff listings and updates your official record within 24 hours.",
        },
        {
            id: "member-invites",
            category: "Workspace & Team",
            question: "How do we invite new executive coordinators or core student members?",
            answer:
                "Navigate to the Team Workspace from your dashboard sidebar. You can generate one-click invitation links or dispatch email invites with assigned roles (Lead Organizer, Event Coordinator, Core Member). Members log in with their canonical Orbix accounts.",
        },
        {
            id: "event-limits",
            category: "Event Hosting",
            question: "Are there attendance or registration limits for campus workshops & hackathons?",
            answer:
                "Verified collegiate chapters receive 100% free unlimited event hosting with zero attendee registration caps. You can collect RSVPs, attach registration form links, configure venue details, and download encrypted attendee rosters.",
        },
        {
            id: "checkin-qr",
            category: "Event Check-In",
            question: "How does the attendee QR ticket check-in scanner operate?",
            answer:
                "Every student who registers for your event receives a verifiable digital pass. During the event, chapter leads can open the built-in Orbix Check-In Scanner on their smartphone or laptop camera to scan and mark attendance in real time.",
        },
        {
            id: "showcase-directory",
            category: "Campus Discovery",
            question: "How does campus explore discoverability and search ranking work?",
            answer:
                "When your organization is set to Public Mode, your chapter is prominently indexed in campus directories, explore feeds, and inter-college rankings. The ranking highlights active published events and verified member participation.",
        },
        {
            id: "leadership-transition",
            category: "Governance",
            question: "What should our executive board do during annual leadership transitions?",
            answer:
                "To maintain chapter continuity and preserve event archives, the outgoing lead organizer simply promotes the incoming president to Lead status in the Team Workspace and updates the primary contact email in Club Settings. Your verified badge, custom URL slug, and historical metrics remain completely uninterrupted.",
        },
    ];

    const filteredClubFaqs = useMemo(() => {
        if (!clubFaqSearch.trim()) return CLUB_FAQS;
        const q = clubFaqSearch.toLowerCase();
        return CLUB_FAQS.filter(
            (f) =>
                f.question.toLowerCase().includes(q) ||
                f.answer.toLowerCase().includes(q) ||
                f.category.toLowerCase().includes(q)
        );
    }, [clubFaqSearch]);

    const handleSubmitTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!helpSubject.trim() || !helpDescription.trim()) {
            toast.error("Please provide both a subject and detailed description.", { title: "Ticket Error" });
            return;
        }

        setIsSubmittingTicket(true);
        try {
            const res = await fetch("/api/help/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    category: helpCategory,
                    subject: helpSubject.trim(),
                    description: helpDescription.trim(),
                    priority: helpPriority === "event_day" ? "urgent" : helpPriority,
                    contactEmail: helpContactEmail.trim() || user?.gmail || club.public_email || "",
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to submit help ticket.");
            }
            setSubmittedTicketNumber(data?.ticket?.ticketNumber || data?.ticket?.ticket_number || "ORB-2026");
            setHelpSubject("");
            setHelpDescription("");
            toast.success("Help ticket submitted to Orbix Collegiate Operations team.", { title: "Ticket Created" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to submit ticket. Please try again.", { title: "Error" });
        } finally {
            setIsSubmittingTicket(false);
        }
    };

    // -------------------------------------------------------------------------
    // RENDER SUBVIEWS
    // -------------------------------------------------------------------------
    const renderContent = () => {
        switch (viewKey) {
            // -----------------------------------------------------------------
            // 1. VERIFY ACCOUNT
            // -----------------------------------------------------------------
            case "verify-account":
                return (
                    <div className="space-y-6">
                        {/* Club Institutional Verification Standing Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000]">
                                        <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Collegiate Accreditation</span>
                                    </div>
                                    <h3 className="text-xl font-black text-black">
                                        Verified Student Organization
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Your organization is officially recognized under{" "}
                                        <strong className="text-black">{club.college_name}</strong>.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border border-black shadow-[2px_2px_0px_#000] shrink-0">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Verified</span>
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                        Affiliated Institution
                                    </p>
                                    <p className="text-xs font-black text-black truncate">{club.college_name}</p>
                                    <p className="text-[10px] text-neutral-600 font-bold">{club.college_city || "Campus"}, {club.college_state || "India"}</p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                        Verification Tier
                                    </p>
                                    <p className="text-xs font-black text-black">Collegiate Verified</p>
                                    <p className="text-[10px] text-emerald-600 font-black">Official Badge Active</p>
                                </div>
                                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                        Verified Since
                                    </p>
                                    <p className="text-xs font-black text-black">
                                        {club.verified_at ? new Date(club.verified_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Active"}
                                    </p>
                                    <p className="text-[10px] text-neutral-600 font-bold">Orbix Campus Board</p>
                                </div>
                            </div>
                        </div>

                        {/* Primary Registered Email Verification Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-sky-200 text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000]">
                                        <Mail className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Primary Organization Email</span>
                                    </div>
                                    <h3 className="text-xl font-black text-black">
                                        Email Verification
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Official communications, event attendee confirmations, and administrative notices are delivered to this address.
                                    </p>
                                </div>

                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border border-black shadow-[2px_2px_0px_#000] shrink-0 ${
                                    isEmailVerified ? "bg-[#a2ff86] text-black" : "bg-[#FFE566] text-black"
                                }`}>
                                    {isEmailVerified ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                            <span>Email Verified</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Unverified</span>
                                        </>
                                    )}
                                </span>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-xs font-black text-black">Registered Address</p>
                                    <p className="text-sm font-mono font-bold text-neutral-700 truncate">
                                        {user?.gmail || club.public_email || "Not configured"}
                                    </p>
                                </div>

                                {!isEmailVerified && !showOtpInput && (
                                    <button
                                        type="button"
                                        disabled={isSendingVerifyOtp || verifyCooldown > 0}
                                        onClick={handleSendVerificationCode}
                                        className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                                    >
                                        {isSendingVerifyOtp ? "Sending Code..." : verifyCooldown > 0 ? `Resend in ${verifyCooldown}s` : "Verify Now"}
                                    </button>
                                )}
                            </div>

                            {/* OTP Entry Card if dispatching verification */}
                            {showOtpInput && !isEmailVerified && (
                                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4 animate-fadeIn">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-black">
                                            Enter 6-Digit Verification Code
                                        </h4>
                                        <p className="text-xs text-neutral-600 font-medium">
                                            A confirmation code was sent to <strong className="text-black">{user?.gmail || club.public_email}</strong>.
                                        </p>
                                    </div>

                                    <div className="py-2">
                                        <OtpSegmentedInput
                                            value={otpDigits}
                                            onChange={setOtpDigits}
                                            disabled={isConfirmingVerifyOtp}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            disabled={isConfirmingVerifyOtp || otpDigits.trim().length !== 6}
                                            onClick={handleConfirmVerificationCode}
                                            className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {isConfirmingVerifyOtp ? "Verifying..." : "Confirm & Verify"}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={verifyCooldown > 0 || isSendingVerifyOtp}
                                            onClick={handleSendVerificationCode}
                                            className="text-xs font-bold text-neutral-600 hover:text-black underline cursor-pointer disabled:opacity-50"
                                        >
                                            {verifyCooldown > 0 ? `Resend code in ${verifyCooldown}s` : "Resend code"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 2. PASSWORD AND SECURITY
            // -----------------------------------------------------------------
            case "password-security":
                return (
                    <div className="space-y-6">
                        {/* Change Password Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">Change Organization Password</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Ensure your club password uses at least 8 characters with a combination of letters and numbers.
                                </p>
                            </div>

                            <form onSubmit={handleSavePassword} className="space-y-3.5 max-w-md">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Current Password
                                    </label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Confirm New Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSavingPassword}
                                    className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingPassword ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </div>

                        {/* Two-Factor Authentication Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                                    <h3 className="text-base font-black text-black">Two-Factor Authentication (2FA)</h3>
                                    {twoFactorEnabled && (
                                        <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black uppercase tracking-wider">
                                            Active
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-neutral-600 font-medium max-w-xl leading-relaxed">
                                    Protect your club administrative access with verified email OTP. Whenever logging in from new devices, a single-use 6-digit code will be delivered to your registered organization email (<span className="font-mono font-bold text-black">{user?.gmail || club.public_email || "club email"}</span>).
                                </p>
                            </div>

                            <NeoToggle
                                checked={twoFactorEnabled}
                                onChange={(val) => {
                                    setTwoFactorEnabled(val);
                                    toast.info("2FA settings updated for organization account.", { title: "2FA" });
                                }}
                                onStatusText="2FA: Enabled"
                                offStatusText="2FA: Disabled"
                                ariaLabel="Toggle two-factor authentication"
                            />
                        </div>

                        {/* Active Sessions Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                            <div className="flex items-center gap-2">
                                <Laptop className="w-4 h-4 text-black stroke-[2.5]" />
                                <h3 className="text-base font-black text-black">Active Administrative Sessions</h3>
                            </div>
                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">This Device (Current Session)</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Browser administrative session • Active now</p>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black">
                                    Active
                                </span>
                            </div>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 3. MANAGE ACCOUNT
            // -----------------------------------------------------------------
            case "manage-account":
                return (
                    <div className="space-y-6">
                        {/* Club Email Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-black">Primary Club Email</h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Used for account sign-in, security alerts, and event administration.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEmailChangeModalOpen(true);
                                        setEmailChangeStage("input");
                                        setNewEmailInput("");
                                    }}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer shrink-0"
                                >
                                    Change Email
                                </button>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between gap-4">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-xs font-mono font-bold text-black truncate">
                                        {user?.gmail || club.public_email || "No email configured"}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Monthly changes remaining: {manageStatus?.monthlyLimits?.email?.remaining ?? 2} / 2
                                    </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border border-black ${
                                    isEmailVerified ? "bg-[#a2ff86] text-black" : "bg-amber-100 text-amber-900"
                                }`}>
                                    {isEmailVerified ? "Verified" : "Unverified"}
                                </span>
                            </div>
                        </div>

                        {/* Club Handle / Slug Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-black">Club Handle & Public Slug</h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Your public URL will be: <code className="bg-neutral-100 px-1 py-0.5 rounded text-black font-mono font-bold">orbix.dev/clubs/{club.slug}</code>
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSlugModalOpen(true);
                                        setNewSlugInput(club.slug);
                                        setSlugPassword("");
                                    }}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer shrink-0"
                                >
                                    Change Handle
                                </button>
                            </div>

                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between gap-4">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-xs font-mono font-bold text-black">
                                        @{club.slug}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Monthly changes remaining: {manageStatus?.monthlyLimits?.username?.remaining ?? 2} / 2
                                    </p>
                                </div>
                                <Link
                                    to={`/clubs/${club.slug}`}
                                    target="_blank"
                                    className="text-xs font-black text-black hover:underline flex items-center gap-1"
                                >
                                    <span>Preview URL</span>
                                    <ExternalLink className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>

                        {/* Club Data Archive Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-black text-black">Download Organization Archive</h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Export all organization records including coordinators, achievements, events, and member rosters in JSON format.
                                    </p>
                                </div>

                                <a
                                    href="/api/club/settings/data-archive"
                                    download
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
                                >
                                    <Download className="w-4 h-4 stroke-[2.5]" />
                                    <span>Export JSON</span>
                                </a>
                            </div>
                        </div>

                        {/* EMAIL CHANGE MODAL */}
                        {isEmailChangeModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                                <div className="w-full max-w-md bg-[#FAF6EE] border-2 sm:border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] space-y-5">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/15">
                                        <h3 className="text-lg font-black text-black">Change Club Email</h3>
                                        <button
                                            type="button"
                                            onClick={() => setIsEmailChangeModalOpen(false)}
                                            className="text-neutral-500 hover:text-black font-black text-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {emailChangeStage === "input" && (
                                        <form onSubmit={handleStartEmailChange} className="space-y-4">
                                            <p className="text-xs text-neutral-600 font-medium">
                                                A single-use 6-digit authorization code will first be sent to your current address (<strong>{user?.gmail || club.public_email}</strong>) to confirm this request.
                                            </p>
                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                                    New Primary Email Address
                                                </label>
                                                <input
                                                    type="email"
                                                    value={newEmailInput}
                                                    onChange={(e) => setNewEmailInput(e.target.value)}
                                                    placeholder="club.new@university.edu"
                                                    className="w-full h-10 px-3 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                                                    required
                                                />
                                            </div>
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEmailChangeModalOpen(false)}
                                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isEmailChangeSubmitting || !newEmailInput.trim()}
                                                    className="px-5 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
                                                >
                                                    {isEmailChangeSubmitting ? "Sending Code..." : "Continue"}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {emailChangeStage === "old_otp" && (
                                        <div className="space-y-4">
                                            <p className="text-xs text-neutral-600 font-medium">
                                                Step 1 of 2: Enter the 6-digit code sent to your current email (<strong>{user?.gmail || club.public_email}</strong>).
                                            </p>
                                            <OtpSegmentedInput
                                                value={emailChangeOtpDigits}
                                                onChange={setEmailChangeOtpDigits}
                                                disabled={isEmailChangeSubmitting}
                                            />
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEmailChangeStage("input")}
                                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black"
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isEmailChangeSubmitting || emailChangeOtpDigits.trim().length !== 6}
                                                    onClick={handleAuthorizeOldEmail}
                                                    className="px-5 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
                                                >
                                                    {isEmailChangeSubmitting ? "Authorizing..." : "Authorize Old Email"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {emailChangeStage === "new_otp" && (
                                        <div className="space-y-4">
                                            <p className="text-xs text-neutral-600 font-medium">
                                                Step 2 of 2: Enter the 6-digit code sent to your NEW email (<strong>{newEmailInput}</strong>) to commit the change.
                                            </p>
                                            <OtpSegmentedInput
                                                value={emailChangeOtpDigits}
                                                onChange={setEmailChangeOtpDigits}
                                                disabled={isEmailChangeSubmitting}
                                            />
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    type="button"
                                                    disabled={isEmailChangeSubmitting || emailChangeOtpDigits.trim().length !== 6}
                                                    onClick={handleVerifyNewEmail}
                                                    className="px-5 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
                                                >
                                                    {isEmailChangeSubmitting ? "Committing..." : "Verify & Commit"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SLUG / HANDLE CHANGE MODAL */}
                        {isSlugModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
                                <div className="w-full max-w-md bg-[#FAF6EE] border-2 sm:border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_#000] space-y-5">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/15">
                                        <h3 className="text-lg font-black text-black">Change Club Handle</h3>
                                        <button
                                            type="button"
                                            onClick={() => setIsSlugModalOpen(false)}
                                            className="text-neutral-500 hover:text-black font-black text-sm"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <form onSubmit={handleConfirmSlugChange} className="space-y-4">
                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                                New Organization Slug
                                            </label>
                                            <input
                                                type="text"
                                                value={newSlugInput}
                                                onChange={(e) => setNewSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                                placeholder="aws-student-chapter"
                                                className="w-full h-10 px-3 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none font-mono"
                                                required
                                            />
                                            {slugCheckMessage && (
                                                <p className={`text-[11px] font-bold mt-1.5 ${slugAvailable ? "text-emerald-700" : "text-rose-700"}`}>
                                                    {slugCheckMessage}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                                Current Administrative Password
                                            </label>
                                            <input
                                                type="password"
                                                value={slugPassword}
                                                onChange={(e) => setSlugPassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                className="w-full h-10 px-3 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                                                required
                                            />
                                        </div>

                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsSlugModalOpen(false)}
                                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border-2 border-black"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmittingSlug || !slugAvailable || !slugPassword}
                                                className="px-5 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-50"
                                            >
                                                {isSubmittingSlug ? "Updating..." : "Confirm Change"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                );

            // -----------------------------------------------------------------
            // 4. HELP
            // -----------------------------------------------------------------
            case "help":
                return (
                    <div className="space-y-6">
                        {/* Unified Container */}
                        <div className="bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] overflow-hidden">
                            {/* Header with Mode Switcher */}
                            <div className="p-4 sm:p-6 border-b-2 border-black bg-[#FAF6EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-sky-200 border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center shrink-0">
                                        <LifeBuoy className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                                Club Help Center
                                            </h3>
                                            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-black uppercase font-mono bg-black text-[#a2ff86] rounded-md">
                                                Collegiate Support
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-600 font-semibold mt-0.5">
                                            Dedicated operational guidance for university developer chapters.
                                        </p>
                                    </div>
                                </div>

                                {/* Mode Switcher Tabs */}
                                <div className="inline-flex p-1 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] shrink-0 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => setClubHelpTab("new")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                            clubHelpTab === "new"
                                                ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] border border-black"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Submit Ticket</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setClubHelpTab("faqs")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                            clubHelpTab === "faqs"
                                                ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] border border-black"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Club FAQs</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setClubHelpTab("channels")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                            clubHelpTab === "channels"
                                                ? "bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] border border-black"
                                                : "text-neutral-700 hover:text-black"
                                        }`}
                                    >
                                        <Mail className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Channels</span>
                                    </button>
                                </div>
                            </div>

                            {/* Body Content */}
                            <div className="p-4 sm:p-6 lg:p-7">
                                {clubHelpTab === "new" && (
                                    <div className="space-y-5">
                                        <div className="space-y-1">
                                            <h4 className="text-base font-black text-black">
                                                Collegiate Ticket Resolution
                                            </h4>
                                            <p className="text-xs text-neutral-600 font-medium">
                                                Direct communication channel to the Orbix Campus Operations and Collegiate Verification Team.
                                            </p>
                                        </div>

                                        {submittedTicketNumber && (
                                            <div className="p-4 rounded-xl bg-[#a2ff86]/30 border-2 border-black flex items-center justify-between gap-3 animate-fadeIn">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-black text-black">
                                                        Ticket #{submittedTicketNumber} Created
                                                    </p>
                                                    <p className="text-[11px] text-neutral-700 font-medium">
                                                        Our campus operations desk will respond to {helpContactEmail || user?.gmail || club.public_email} within 24 business hours.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setSubmittedTicketNumber(null)}
                                                    className="text-xs font-black text-black underline cursor-pointer"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        )}

                                        <form onSubmit={handleSubmitTicket} className="space-y-4 max-w-2xl">
                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                    Inquiry Category
                                                </label>
                                                <select
                                                    value={helpCategory}
                                                    onChange={(e) => setHelpCategory(e.target.value)}
                                                    className="w-full h-11 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                                >
                                                    <option value="college_verification">Collegiate Accreditation & Verification</option>
                                                    <option value="event_scheduling">Event Scheduling & Registrations</option>
                                                    <option value="sync_issue">Team Workspace & Member Roster</option>
                                                    <option value="bug_report">Platform Bug Report</option>
                                                    <option value="general_inquiry">General Inquiry & Sponsor Support</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1.5 flex items-center justify-between">
                                                    <span>Subject / Topic</span>
                                                    <span className="text-[10px] font-mono text-neutral-500">{helpSubject.length}/200</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={helpSubject}
                                                    maxLength={200}
                                                    onChange={(e) => setHelpSubject(e.target.value)}
                                                    placeholder="e.g. Updating Faculty Advisor details for annual symposium"
                                                    className="w-full h-11 px-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1.5 flex items-center justify-between">
                                                    <span>Detailed Description</span>
                                                    <span className="text-[10px] font-mono text-neutral-500">{helpDescription.length}/5000</span>
                                                </label>
                                                <textarea
                                                    rows={4}
                                                    maxLength={5000}
                                                    value={helpDescription}
                                                    onChange={(e) => setHelpDescription(e.target.value)}
                                                    placeholder="Explain your inquiry, including relevant event titles, dates, or coordinator names..."
                                                    className="w-full p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none resize-none leading-relaxed"
                                                    required
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                        Urgency Level
                                                    </label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {(["normal", "urgent", "event_day"] as const).map((p) => {
                                                            const isP = helpPriority === p;
                                                            const labels = {
                                                                normal: "Normal",
                                                                urgent: "Urgent",
                                                                event_day: "Event Day",
                                                            };
                                                            return (
                                                                <button
                                                                    key={p}
                                                                    type="button"
                                                                    onClick={() => setHelpPriority(p)}
                                                                    className={`py-2 px-2 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                                                                        isP
                                                                            ? "bg-[#FFE566] border-black shadow-[2px_2px_0px_#000]"
                                                                            : "bg-white border-black/20 hover:border-black text-neutral-700"
                                                                    }`}
                                                                >
                                                                    {labels[p]}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1.5">
                                                        Reply-To Email
                                                    </label>
                                                    <input
                                                        type="email"
                                                        value={helpContactEmail}
                                                        onChange={(e) => setHelpContactEmail(e.target.value)}
                                                        placeholder="club-lead@institution.edu"
                                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {/* Auto-Attached Context Info */}
                                            <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                                <div className="flex items-center gap-2 text-neutral-700">
                                                    <GraduationCap className="w-4 h-4 text-black shrink-0" />
                                                    <span className="font-bold text-black">Attached Chapter Context:</span>
                                                    <span className="font-mono text-neutral-600 truncate">
                                                        {club.name} • {club.college_name}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                                                    Verified Chapter
                                                </span>
                                            </div>

                                            <div className="pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={isSubmittingTicket}
                                                    className="px-6 py-3 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>{isSubmittingTicket ? "Transmitting..." : "Submit Club Ticket"}</span>
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {clubHelpTab === "faqs" && (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={clubFaqSearch}
                                                onChange={(e) => setClubFaqSearch(e.target.value)}
                                                placeholder="Search collegiate FAQs (e.g. advisor, invite members, attendance limits)..."
                                                className="w-full h-11 pl-10 pr-4 bg-[#FAF6EE] text-black text-xs font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black placeholder:font-normal placeholder:text-neutral-500"
                                            />
                                        </div>

                                        <div className="space-y-2.5">
                                            {filteredClubFaqs.map((faq) => {
                                                const isExpanded = expandedClubFaqId === faq.id;
                                                return (
                                                    <div
                                                        key={faq.id}
                                                        className="rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_#000] overflow-hidden"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedClubFaqId(isExpanded ? null : faq.id)
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
                                    </div>
                                )}

                                {clubHelpTab === "channels" && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-xl bg-sky-200 border-2 border-black flex items-center justify-center shrink-0">
                                                        <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                                                    </div>
                                                    <h4 className="text-sm font-black text-black">Campus Operations Desk</h4>
                                                </div>
                                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                                    For sponsorship coordination, chapter re-verification, or administrative questions.
                                                </p>
                                                <p className="text-xs font-mono font-black text-black pt-1">
                                                    campus-support@orbix.dev
                                                </p>
                                            </div>

                                            <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0">
                                                        <ShieldCheck className="w-4 h-4 text-black stroke-[2.5]" />
                                                    </div>
                                                    <h4 className="text-sm font-black text-black">Verification Documentation</h4>
                                                </div>
                                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                                    Learn about the 5-stage verification standard and the 4-pillar reviewer evaluation framework.
                                                </p>
                                                <Link
                                                    to="/docs/club-verification-protocol"
                                                    className="inline-flex items-center gap-1.5 text-xs font-black text-black underline pt-1"
                                                >
                                                    <span>Open Protocol Docs</span>
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 5. PRIVACY CENTER
            // -----------------------------------------------------------------
            case "privacy-center":
                return (
                    <div className="space-y-6">
                        {/* Hero Header */}
                        <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-5">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight">
                                                Collegiate Privacy Center
                                            </h3>
                                            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-black text-[#a2ff86] text-[10px] font-black uppercase font-mono tracking-wider">
                                                FERPA Aligned
                                            </span>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-neutral-600 mt-1">
                                            Student roster confidentiality • Event attendee data protection • Zero data selling
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    to="/docs/club-verification-protocol"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] self-start sm:self-auto cursor-pointer"
                                >
                                    <span>Collegiate Governance Docs</span>
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                </Link>
                            </div>

                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                Orbix for Student Organizations is built to support campus developer chapters, executive boards, and event attendees. We treat collegiate student records and event attendee registrations with strict confidentiality, ensuring zero unauthorized commercial data sharing or external advertising monetization.
                            </p>
                        </div>

                        {/* Four Core Collegiate Privacy Pillars */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <Lock className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Student Roster Protection</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Member rosters, coordinator contact emails, and representative phone numbers are shielded. Orbix never discloses student contact records to external commercial sponsors or third-party recruiters without explicit member authorization.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Attendee Data Sovereignty</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Registration rosters collected for workshops, bootcamps, and hackathons belong exclusively to your campus organization. Event export files are encrypted and downloadable only by authenticated chapter officers.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-sky-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <Globe className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Showcase & Directory Gating</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    In Public Mode, your organization is prominently surfaced in campus directories and explore feeds. Toggling to Private Mode immediately terminates public indexing and conceals internal rosters.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-purple-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <Users className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Secure Leadership Handoff</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Role-governed delegation enables outgoing student officers to transfer chapter leadership securely without ever sharing personal login credentials or compromising account ownership.
                                </p>
                            </div>
                        </div>

                        {/* Navigation Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">
                                    Organization Showcase Privacy Settings
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Configure public visibility, campus directory discoverability, and inquiry intake.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onSelectView("account-privacy")}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
                            >
                                <span>Manage Showcase Privacy</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 6. ACCOUNT STATUS
            // -----------------------------------------------------------------
            case "account-status":
                return (
                    <div className="space-y-6">
                        {/* Standing Hero */}
                        <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-5">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                            Institutional Standing
                                        </h3>
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Good Standing • Verified Chapter</span>
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Your organization is officially accredited and active in the campus developer directory.
                                    </p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500 block">
                                        Public Identifier
                                    </span>
                                    <span className="text-xs font-black text-black font-mono">
                                        orbix.dev/clubs/{club.slug}
                                    </span>
                                </div>
                            </div>

                            {/* Trust & Verification Indicators */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Verification Standard
                                    </span>
                                    <p className="text-sm font-black text-emerald-700 flex items-center gap-1.5">
                                        <Check className="w-4 h-4 stroke-[3]" />
                                        5-Stage Review Passed
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Campus existence & faculty authorization confirmed
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Collegiate Conduct
                                    </span>
                                    <p className="text-sm font-black text-black flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 stroke-[2.5] text-emerald-600" />
                                        100% Compliant
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Zero community or event safety flags
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        University Affiliation
                                    </span>
                                    <p className="text-sm font-black text-black truncate flex items-center gap-1.5">
                                        <GraduationCap className="w-4 h-4 stroke-[2.5] text-sky-600 shrink-0" />
                                        {club.college_name}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Recognized campus technical society
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Quotas & Limits */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h4 className="text-sm font-black uppercase tracking-wider text-black">
                                Organization Capabilities & Platform Entitlements
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">Campus Event Scheduling</p>
                                    <p className="text-base font-black text-black">Unlimited Events</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Host workshops, hackathons, and guest talks with custom RSVP forms</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">Team Workspace Seats</p>
                                    <p className="text-base font-black text-black">Unlimited Members</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Leads, coordinators, faculty advisors, and general student builders</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">Attendee QR Check-In Scanner</p>
                                    <p className="text-base font-black text-black">Enabled</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Real-time attendance validation via device camera during events</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">Real-Time Club Inbox</p>
                                    <p className="text-base font-black text-black">Active</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Direct two-way messaging channel with prospective students</p>
                                </div>
                            </div>
                        </div>

                        {/* Chapter Health Guidance */}
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-start gap-3">
                            <Award className="w-5 h-5 text-black shrink-0 mt-0.5" />
                            <div className="space-y-0.5 text-xs">
                                <p className="font-black text-black">Annual Accreditation Continuity</p>
                                <p className="text-neutral-600 font-medium leading-relaxed">
                                    Verified status remains continuously active throughout the academic year. During annual officer turnover, verify that your new lead organizer's email is updated in settings to ensure uninterrupted chapter management.
                                </p>
                            </div>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 7. ABOUT
            // -----------------------------------------------------------------
            case "about":
                return (
                    <div className="space-y-6">
                        {/* Hero Card */}
                        <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-5">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                        <OrbixLogo className="w-7 h-7 text-black" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-none">
                                            Orbix for Student Organizations
                                        </h3>
                                        <p className="text-xs font-mono font-bold text-neutral-600 mt-1">
                                            Version 2.4.0 (Campus Edition • Build 2026.10)
                                        </p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] self-start sm:self-auto">
                                    Collegiate Chapter Tier
                                </span>
                            </div>

                            <div className="space-y-3 text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                <p>
                                    Orbix for Student Organizations is the dedicated operating system built to empower campus developer clubs, ACM student chapters, IEEE branches, Google Developer Student Clubs, and independent coding societies.
                                </p>
                                <p>
                                    By providing turnkey event management, verified institutional badging, student talent aggregation, and inter-college hackathon infrastructure, Orbix frees student leaders from administrative friction so they can focus on teaching, organizing, and building vibrant engineering communities.
                                </p>
                            </div>
                        </div>

                        {/* Four Core Pillars for Organizations */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Turnkey Event & Workshop Infrastructure</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Publish campus technical sessions, collect RSVPs, distribute digital event passes, and scan attendance using built-in QR technology with zero platform subscription fees.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFE566] border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Verified Collegiate Legitimacy</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    An official institutional badge backed by our 5-stage verification standard and 4-pillar reviewer audit, establishing immediate trust with prospective members and corporate sponsors.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-300 border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Student Talent & Leaderboard Impact</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Aggregate your chapter's problem-solving accomplishments, celebrate contest winners, and elevate your university's position on national collegiate rankings.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-300 border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Seamless Leadership Continuity</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Structured role delegations ensure each new executive board inherits event records, attendee analytics, and verified organization credentials without interruption.
                                </p>
                            </div>
                        </div>

                        {/* Documentation, Legal & Transparency */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h4 className="text-sm font-black uppercase tracking-wider text-black">
                                Chapter Standards & Governance
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                                <Link
                                    to="/docs/club-verification-protocol"
                                    className="p-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000] text-black"
                                >
                                    <span>Verification Protocol</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                    to="/docs/supported-platform-registry"
                                    className="p-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000] text-black"
                                >
                                    <span>Platform Registry</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                                <Link
                                    to="/leaderboard"
                                    className="p-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000] text-black"
                                >
                                    <span>Collegiate Leaderboard</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            <div className="pt-4 border-t-2 border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-600 font-medium">
                                <div className="flex flex-wrap items-center gap-3 font-bold text-black">
                                    <Link to="/docs" className="hover:underline">Documentation</Link>
                                    <span>•</span>
                                    <Link to="/events" className="hover:underline">Campus Events</Link>
                                    <span>•</span>
                                    <Link to="/leaderboard" className="hover:underline">University Rankings</Link>
                                    <span>•</span>
                                    <Link to="/blogs" className="hover:underline">Community Blog</Link>
                                </div>
                                <span className="font-mono text-[11px] text-neutral-500">
                                    Proprietary © {new Date().getFullYear()} Orbix Inc. All rights reserved.
                                </span>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const getViewTitle = () => {
        switch (viewKey) {
            case "verify-account": return "Verify Account";
            case "password-security": return "Password and Security";
            case "manage-account": return "Manage Account";
            case "help": return "Help";
            case "privacy-center": return "Privacy Center";
            case "account-status": return "Account Status";
            case "about": return "About";
            default: return "Settings";
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Breadcrumb Header */}
            <div className="flex items-center gap-3 pb-4 border-b-2 border-black/15">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer shrink-0"
                    aria-label={["verify-account", "password-security", "manage-account"].includes(viewKey) ? "Back to Account Center" : "Back to Settings Hub"}
                    title={["verify-account", "password-security", "manage-account"].includes(viewKey) ? "Back to Account Center" : "Back to Settings"}
                >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <div className="space-y-0.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                        {["verify-account", "password-security", "manage-account"].includes(viewKey)
                            ? "Settings • Account Center"
                            : "Settings"}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        {getViewTitle()}
                    </h2>
                </div>
            </div>

            {/* Dynamic View Body */}
            {renderContent()}
        </div>
    );
};
