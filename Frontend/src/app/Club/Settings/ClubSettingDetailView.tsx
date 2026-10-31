import React, { useState, useEffect } from "react";
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
    // HELP CENTER STATE
    // -------------------------------------------------------------------------
    const [helpCategory, setHelpCategory] = useState<string>("college_verification");
    const [helpSubject, setHelpSubject] = useState("");
    const [helpDescription, setHelpDescription] = useState("");
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
    const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string | null>(null);

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
                    contactEmail: user?.gmail || club.public_email || "",
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to submit help ticket.");
            }
            setSubmittedTicketNumber(data?.ticket?.ticket_number || "ORB-2026");
            setHelpSubject("");
            setHelpDescription("");
            toast.success("Help ticket submitted to Orbix Collegiate Support team.", { title: "Ticket Created" });
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
                        {/* Submit Help Ticket Form Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Club Support & Ticket Resolution</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Direct communication channel to the Orbix Campus Operations & Collegiate Verification Team.
                                </p>
                            </div>

                            {submittedTicketNumber && (
                                <div className="p-4 rounded-xl bg-[#a2ff86]/30 border-2 border-black flex items-center justify-between gap-3 animate-fadeIn">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-black text-black">
                                            Ticket #{submittedTicketNumber} Created
                                        </p>
                                        <p className="text-[11px] text-neutral-700 font-medium">
                                            Our support team will respond to {user?.gmail || club.public_email} within 24 hours.
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

                            <form onSubmit={handleSubmitTicket} className="space-y-4 max-w-xl">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Inquiry Category
                                    </label>
                                    <select
                                        value={helpCategory}
                                        onChange={(e) => setHelpCategory(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                    >
                                        <option value="college_verification">Collegiate Accreditation & Verification</option>
                                        <option value="event_scheduling">Event Scheduling & Registrations</option>
                                        <option value="sync_issue">Member Sync & Team Workspace</option>
                                        <option value="bug_report">Platform Bug Report</option>
                                        <option value="general_inquiry">General Inquiry & Sponsor Support</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Subject
                                    </label>
                                    <input
                                        type="text"
                                        value={helpSubject}
                                        onChange={(e) => setHelpSubject(e.target.value)}
                                        placeholder="e.g. Updating Faculty Advisor details for annual symposium"
                                        className="w-full h-10 px-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                        Detailed Description
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={helpDescription}
                                        onChange={(e) => setHelpDescription(e.target.value)}
                                        placeholder="Explain your inquiry, including relevant event titles or coordinator names..."
                                        className="w-full p-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none resize-none"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmittingTicket}
                                    className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>{isSubmittingTicket ? "Submitting..." : "Submit Ticket"}</span>
                                </button>
                            </form>
                        </div>

                        {/* Frequently Asked Questions */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h3 className="text-lg font-black text-black">Club FAQ & Guidelines</h3>
                            <div className="divide-y-2 divide-black/10">
                                <div className="py-3 space-y-1">
                                    <p className="text-xs font-black text-black">How do we invite new coordinators or executive members?</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Navigate to the <strong>Team Workspace</strong> from the sidebar. You can generate one-click invitation links or dispatch email invites with customized roles (Lead, Coordinator, Core Member).
                                    </p>
                                </div>
                                <div className="py-3 space-y-1">
                                    <p className="text-xs font-black text-black">Are there attendance limits for campus events & workshops?</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Verified clubs enjoy unlimited event registrations and automatic attendee QR-code check-in scanning without subscription fees.
                                    </p>
                                </div>
                                <div className="py-3 space-y-1">
                                    <p className="text-xs font-black text-black">How does club showcase discoverability work?</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        When your Privacy setting is set to <strong>Public Mode</strong>, your organization is surfaced in campus search, explore feeds, and college directory rankings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 5. PRIVACY CENTER
            // -----------------------------------------------------------------
            case "privacy-center":
                return (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="space-y-1.5 border-b-2 border-black/15 pb-5">
                            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#a2ff86] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000]">
                                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Collegiate Data Governance</span>
                            </div>
                            <h3 className="text-2xl font-black text-black">Student Organization Privacy Policy</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                How Orbix protects campus club records, student rosters, and attendee privacy.
                            </p>
                        </div>

                        <div className="space-y-4 text-xs font-medium text-neutral-700 leading-relaxed">
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">1. FERPA & Collegiate Privacy Standards</h4>
                                <p>
                                    Orbix strictly complies with collegiate student privacy regulations. Student membership rosters and contact phone numbers are never shared with external commercial advertisers or third-party recruiters without explicit member consent.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">2. Event Attendee Data Protection</h4>
                                <p>
                                    Attendee registration lists collected during workshops or hackathons belong exclusively to your student organization. Event export files are encrypted and downloadable only by authenticated club administrators.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-black">3. Public vs. Private Showcase Isolation</h4>
                                <p>
                                    Toggling your club showcase to Private Mode immediately terminates public search indexing and prevents unverified external visitors from discovering your organization's roster and schedule.
                                </p>
                            </div>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 6. ACCOUNT STATUS
            // -----------------------------------------------------------------
            case "account-status":
                return (
                    <div className="space-y-6">
                        {/* Standing Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="text-xl font-black text-black">Good Standing</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Your club complies with Orbix community standards and collegiate institutional rules.
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-7 h-7 text-black stroke-[2.5]" />
                            </div>
                        </div>

                        {/* Quotas & Limits */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h3 className="text-lg font-black text-black">Organization Capabilities & Limits</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Event Scheduling</p>
                                    <p className="text-base font-black text-black">Unlimited Events</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Free workshop hosting & registration forms</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Team Workspace Seats</p>
                                    <p className="text-base font-black text-black">Unlimited Members</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Leads, coordinators & general student members</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Real-Time Club Inbox</p>
                                    <p className="text-base font-black text-black">Active</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Two-way messaging with prospective students</p>
                                </div>
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Public Showcase URL</p>
                                    <p className="text-base font-black text-black">Custom Slug Active</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">orbix.dev/clubs/{club.slug}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            // -----------------------------------------------------------------
            // 7. ABOUT
            // -----------------------------------------------------------------
            case "about":
                return (
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="flex items-center gap-3.5 border-b-2 border-black/15 pb-5">
                            <OrbixLogo className="w-9 h-9 sm:w-10 sm:h-10 text-black flex-shrink-0" />
                            <div className="space-y-0.5">
                                <h3 className="text-2xl sm:text-3xl font-black text-black tracking-tight leading-none">Orbix for Student Organizations</h3>
                                <p className="text-xs font-mono font-bold text-neutral-600 mt-1">Version 2.4.0 (Build 2026.10)</p>
                            </div>
                        </div>

                        <div className="space-y-4 text-xs font-medium text-neutral-700 leading-relaxed">
                            <p>
                                Orbix for Student Organizations empowers campus developer clubs, tech chapters, and hackathon organizers to schedule events, manage executive rosters, verify collegiate identity, and connect student builders with opportunities.
                            </p>
                            <p>
                                Built on open standards with zero subscription barriers for recognized university chapters.
                            </p>
                        </div>

                        <div className="pt-4 border-t-2 border-black/10 flex flex-wrap gap-4 text-xs font-bold text-neutral-600">
                            <Link to="/docs" className="hover:text-black underline">Documentation</Link>
                            <Link to="/blogs" className="hover:text-black underline">Community Blog</Link>
                            <span className="text-neutral-400">•</span>
                            <span>© 2026 Orbix Inc. All rights reserved.</span>
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
