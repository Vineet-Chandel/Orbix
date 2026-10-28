import React, { useState, useEffect, useRef } from "react";
import {
    Mail,
    UserCog,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    X,
    KeyRound,
    Sparkles,
    ShieldCheck,
    Download,
    Clock,
    AtSign,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch } from "../../store";
import { updateUserProfile, setEmailVerified } from "../../store/userSlice";
import OtpSegmentedInput from "../../LandingPages/Auth-Pages/OtpSegmentedInput";
import {
    fetchManageAccountsStatus,
    startEmailChange,
    authorizeOldEmail,
    verifyNewEmail,
    resendEmailCode,
    cancelEmailChange,
    sendPrimaryEmailVerification,
    confirmPrimaryEmailVerification,
    checkUsernameAvailability,
    requestUsernameChange,
    confirmUsernameChange,
    type ManageAccountsStatus,
} from "../../api/manageAccountApi";

interface ManageAccountViewProps {
    user: any;
    onBack?: () => void;
}

export const ManageAccountView: React.FC<ManageAccountViewProps> = ({ user, onBack: _onBack }) => {
    const toast = useToast();
    const dispatch = useAppDispatch();

    const [statusData, setStatusData] = useState<ManageAccountsStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Unified Email Change Flow Modal & State
    const [isEmailChangeModalOpen, setIsEmailChangeModalOpen] = useState(false);
    const [emailChangeStep, setEmailChangeStep] = useState<"input_email" | "verify_old_email" | "verify_new_email">("input_email");
    const [activeEmailOp, setActiveEmailOp] = useState<{
        operationId: string;
        stage: string;
        requestedEmail: string;
        currentEmail: string;
    } | null>(null);
    const [newEmailInput, setNewEmailInput] = useState("");
    const [isSubmittingStartEmail, setIsSubmittingStartEmail] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [otpCooldown, setOtpCooldown] = useState(0);
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
    const [isResendingOtp, setIsResendingOtp] = useState(false);

    // Primary Email Verification Dialog (for unverified accounts)
    const [isPrimaryVerifyModalOpen, setIsPrimaryVerifyModalOpen] = useState(false);
    const [primaryOtpCode, setPrimaryOtpCode] = useState("");
    const [primaryCooldown, setPrimaryCooldown] = useState(0);
    const [primaryDevOtp, setPrimaryDevOtp] = useState<string | null>(null);
    const [isSubmittingPrimaryOtp, setIsSubmittingPrimaryOtp] = useState(false);

    // Username Change Flow Modals & State
    const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
    const [newUsernameInput, setNewUsernameInput] = useState("");
    const [usernameAvailability, setUsernameAvailability] = useState<{
        checking: boolean;
        available?: boolean;
        reason?: string;
    }>({ checking: false });
    const [isSubmittingUsernameRequest, setIsSubmittingUsernameRequest] = useState(false);
    const [usernameStepUpType, setUsernameStepUpType] = useState<"email_otp" | "password" | null>(null);
    const [usernameOperationId, setUsernameOperationId] = useState<string | null>(null);
    const [usernameOtpCode, setUsernameOtpCode] = useState("");
    const [usernamePasswordInput, setUsernamePasswordInput] = useState("");
    const [usernameCooldown, setUsernameCooldown] = useState(0);
    const [usernameDevOtp, setUsernameDevOtp] = useState<string | null>(null);
    const [isSubmittingUsernameConfirm, setIsSubmittingUsernameConfirm] = useState(false);

    const availabilityCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch authoritative status
    const loadStatus = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const data = await fetchManageAccountsStatus();
            setStatusData(data);

            // Sync user verification state with Redux
            if (data.isEmailVerified !== user?.isEmailVerified) {
                dispatch(setEmailVerified({
                    isEmailVerified: data.isEmailVerified,
                    emailVerifiedAt: data.emailVerifiedAt,
                    email: data.primaryEmail,
                }));
            }
        } catch (err: any) {
            console.error("Failed to load manage account status:", err);
            toast.error(err.message || "Failed to load account status.");
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStatus(true);
    }, []);

    // Cooldown timers
    useEffect(() => {
        if (otpCooldown <= 0) return;
        const timer = setInterval(() => {
            setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [otpCooldown]);

    useEffect(() => {
        if (primaryCooldown <= 0) return;
        const timer = setInterval(() => {
            setPrimaryCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [primaryCooldown]);

    useEffect(() => {
        if (usernameCooldown <= 0) return;
        const timer = setInterval(() => {
            setUsernameCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [usernameCooldown]);

    // Live Debounced Username Availability Check
    useEffect(() => {
        if (!isUsernameModalOpen) return;
        const trimmed = newUsernameInput.trim().toLowerCase();

        if (availabilityCheckTimerRef.current) {
            clearTimeout(availabilityCheckTimerRef.current);
        }

        if (!trimmed) {
            setUsernameAvailability({ checking: false });
            return;
        }

        if (trimmed.length < 3) {
            setUsernameAvailability({ checking: false, available: false, reason: "Minimum 3 characters required" });
            return;
        }

        if (trimmed.length > 20) {
            setUsernameAvailability({ checking: false, available: false, reason: "Maximum 20 characters allowed" });
            return;
        }

        if (!/^[a-z0-9._-]+$/.test(trimmed)) {
            setUsernameAvailability({ checking: false, available: false, reason: "Allowed: lowercase letters, numbers, dot, _, -" });
            return;
        }

        setUsernameAvailability({ checking: true });

        availabilityCheckTimerRef.current = setTimeout(async () => {
            try {
                const res = await checkUsernameAvailability(trimmed);
                setUsernameAvailability({
                    checking: false,
                    available: res.available,
                    reason: res.reason,
                });
            } catch {
                setUsernameAvailability({ checking: false });
            }
        }, 350);

        return () => {
            if (availabilityCheckTimerRef.current) {
                clearTimeout(availabilityCheckTimerRef.current);
            }
        };
    }, [newUsernameInput, isUsernameModalOpen]);

    // Handle Start Email Change (Continuous transition inside same modal)
    const handleStartEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newEmailInput.trim().toLowerCase();
        if (!trimmed) {
            toast.error("Please enter a valid new email address.");
            return;
        }

        setIsSubmittingStartEmail(true);
        try {
            const result = await startEmailChange(trimmed);
            // Seamlessly transition to Step 1 OTP inside the exact same modal window
            setActiveEmailOp({
                operationId: result.operationId || "",
                stage: result.stage || "old_email_authorization_pending",
                requestedEmail: trimmed,
                currentEmail: statusData?.primaryEmail || user?.email || "",
            });
            setEmailChangeStep("verify_old_email");
            setOtpCode("");
            setOtpCooldown(result.cooldownSeconds || 60);
            if (result.devOtp) setDevOtp(result.devOtp);
            toast.success("Authorization code sent to your current primary email.", { title: "Step 1 of 2" });
            loadStatus(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to start email change.");
        } finally {
            setIsSubmittingStartEmail(false);
        }
    };

    // Handle Submitting Email Change OTP (handles both Step 1: old email auth, and Step 2: new email verify)
    const handleVerifyEmailChangeOtp = async (codeToSubmit?: string) => {
        const code = (codeToSubmit || otpCode).trim();
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit code.");
            return;
        }

        const opId = activeEmailOp?.operationId || statusData?.pendingOperation?.id;
        const currentStage = activeEmailOp?.stage || statusData?.pendingOperation?.stage || (emailChangeStep === "verify_old_email" ? "old_email_authorization_pending" : "new_email_verification_pending");

        if (!opId) {
            toast.error("No active email change operation found.");
            setIsEmailChangeModalOpen(false);
            return;
        }

        setIsSubmittingOtp(true);
        try {
            if (currentStage === "old_email_authorization_pending" || emailChangeStep === "verify_old_email") {
                // Submit Authorization for Old Email
                const result = await authorizeOldEmail(opId, code);
                setActiveEmailOp((prev) => ({
                    operationId: result.operationId || opId,
                    stage: "new_email_verification_pending",
                    requestedEmail: prev?.requestedEmail || statusData?.pendingOperation?.requestedValue || newEmailInput,
                    currentEmail: prev?.currentEmail || statusData?.primaryEmail || user?.email || "",
                }));
                setEmailChangeStep("verify_new_email");
                setOtpCode("");
                setOtpCooldown(result.cooldownSeconds || 60);
                if (result.devOtp) setDevOtp(result.devOtp);
                toast.success("Current email authorized! Verification code sent to your new email.", { title: "Step 2 of 2" });
                loadStatus(false);
            } else {
                // Submit Verification for New Email & Commit
                const result = await verifyNewEmail(opId, code);
                setIsEmailChangeModalOpen(false);
                setActiveEmailOp(null);
                setNewEmailInput("");
                setOtpCode("");
                if (result.token) {
                    try {
                        localStorage.setItem("orbix_token", result.token);
                    } catch {}
                }
                if (result.user) {
                    dispatch(updateUserProfile(result.user));
                }
                toast.success("Email address updated and verified successfully! ✓", { title: "Email Changed" });
                await loadStatus(false);
            }
        } catch (err: any) {
            toast.error(err.message || "Code verification failed.");
            loadStatus(false);
        } finally {
            setIsSubmittingOtp(false);
        }
    };

    // Resend Email Change OTP
    const handleResendEmailChangeOtp = async () => {
        const opId = activeEmailOp?.operationId || statusData?.pendingOperation?.id;
        const currentStage = activeEmailOp?.stage || statusData?.pendingOperation?.stage || (emailChangeStep === "verify_old_email" ? "old_email_authorization_pending" : "new_email_verification_pending");
        if (!opId || otpCooldown > 0 || isResendingOtp) return;

        const step = currentStage === "old_email_authorization_pending" ? "old" : "new";
        setIsResendingOtp(true);
        try {
            const result = await resendEmailCode(opId, step);
            setOtpCooldown(result.cooldownSeconds || 60);
            if (result.devOtp) setDevOtp(result.devOtp);
            toast.success("Verification code resent successfully.", { title: "Code Resent" });
        } catch (err: any) {
            toast.error(err.message || "Failed to resend code.");
        } finally {
            setIsResendingOtp(false);
        }
    };

    // Cancel Active Email Change
    const handleCancelEmailChange = async () => {
        const opId = activeEmailOp?.operationId || statusData?.pendingOperation?.id;
        if (opId) {
            try {
                await cancelEmailChange(opId);
                toast.info("Email change cancelled. Primary email remains unchanged.", { title: "Cancelled" });
            } catch (err: any) {
                toast.error(err.message || "Failed to cancel email change.");
            }
        }
        setIsEmailChangeModalOpen(false);
        setActiveEmailOp(null);
        setNewEmailInput("");
        setOtpCode("");
        await loadStatus(false);
    };

    // Open Modal for New Email Change
    const handleOpenNewEmailChangeModal = () => {
        setActiveEmailOp(null);
        setEmailChangeStep("input_email");
        setNewEmailInput("");
        setOtpCode("");
        setIsEmailChangeModalOpen(true);
    };

    // Open Modal for In-Progress Pending Email Change
    const handleOpenPendingEmailChangeModal = () => {
        const pendingOp = statusData?.pendingOperation;
        if (!pendingOp) return;
        setActiveEmailOp({
            operationId: pendingOp.id,
            stage: pendingOp.stage,
            requestedEmail: pendingOp.requestedValue,
            currentEmail: pendingOp.currentValue,
        });
        setEmailChangeStep(
            pendingOp.stage === "old_email_authorization_pending" ? "verify_old_email" : "verify_new_email"
        );
        setOtpCode("");
        setIsEmailChangeModalOpen(true);
    };

    // Primary Email Verification for Unverified Accounts
    const handleSendPrimaryVerification = async () => {
        try {
            const result = await sendPrimaryEmailVerification();
            setPrimaryOtpCode("");
            setPrimaryCooldown(result.cooldownSeconds || 60);
            if (result.devOtp) setPrimaryDevOtp(result.devOtp);
            setIsPrimaryVerifyModalOpen(true);
            toast.success("Verification code sent to your email.", { title: "Code Dispatched" });
        } catch (err: any) {
            toast.error(err.message || "Failed to dispatch verification code.");
        }
    };

    const handleConfirmPrimaryVerification = async (codeToSubmit?: string) => {
        const code = (codeToSubmit || primaryOtpCode).trim();
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit code.");
            return;
        }

        setIsSubmittingPrimaryOtp(true);
        try {
            await confirmPrimaryEmailVerification(code);
            setIsPrimaryVerifyModalOpen(false);
            setPrimaryOtpCode("");
            dispatch(setEmailVerified({
                isEmailVerified: true,
                emailVerifiedAt: new Date().toISOString(),
                email: statusData?.primaryEmail || user?.email,
            }));
            toast.success("Your primary email has been cryptographically verified! ✓", { title: "Email Verified" });
            await loadStatus(false);
        } catch (err: any) {
            toast.error(err.message || "Email verification failed.");
        } finally {
            setIsSubmittingPrimaryOtp(false);
        }
    };

    // Username Change Handlers
    const handleRequestUsernameChange = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newUsernameInput.trim().toLowerCase();
        if (!trimmed || !usernameAvailability.available) {
            toast.error("Please enter an available username.");
            return;
        }

        setIsSubmittingUsernameRequest(true);
        try {
            const result = await requestUsernameChange(trimmed);
            setUsernameStepUpType(result.stepUpType || "password");
            setUsernameOperationId(result.operationId || null);
            setUsernameOtpCode("");
            setUsernamePasswordInput("");
            if (result.devOtp) setUsernameDevOtp(result.devOtp);
            if (result.cooldownSeconds) setUsernameCooldown(result.cooldownSeconds);
            toast.info(result.message || "Step-up authorization required.", { title: "Security Step-Up" });
        } catch (err: any) {
            toast.error(err.message || "Failed to request username change.");
        } finally {
            setIsSubmittingUsernameRequest(false);
        }
    };

    const handleConfirmUsernameChange = async (otpOverride?: string) => {
        const trimmed = newUsernameInput.trim().toLowerCase();
        const otpVal = (otpOverride || usernameOtpCode).trim();

        if (usernameStepUpType === "email_otp" && otpVal.length !== 6) {
            toast.error("Please enter the complete 6-digit verification code.");
            return;
        }

        if (usernameStepUpType === "password" && !usernamePasswordInput) {
            toast.error("Please enter your account password.");
            return;
        }

        setIsSubmittingUsernameConfirm(true);
        try {
            const payload: any = {
                newUsername: trimmed,
                operationId: usernameOperationId || undefined,
            };
            if (usernameStepUpType === "email_otp") {
                payload.otp = otpVal;
            } else {
                payload.currentPassword = usernamePasswordInput;
            }

            const result = await confirmUsernameChange(payload);
            setIsUsernameModalOpen(false);
            setNewUsernameInput("");
            setUsernameStepUpType(null);
            setUsernameOperationId(null);
            setUsernameOtpCode("");
            setUsernamePasswordInput("");

            if (result.token) {
                try {
                    localStorage.setItem("orbix_token", result.token);
                } catch {}
            }
            if (result.user) {
                dispatch(updateUserProfile(result.user));
            }

            toast.success(`Username updated to @${result.username}! All public routes updated. ✓`, {
                title: "Username Changed",
            });
            await loadStatus(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to update username.");
        } finally {
            setIsSubmittingUsernameConfirm(false);
        }
    };

    // Account Data Export
    const handleExportData = () => {
        const exportData = {
            user: {
                username: statusData?.username || user?.username,
                email: statusData?.primaryEmail || user?.email,
                isEmailVerified: statusData?.isEmailVerified || false,
                emailVerifiedAt: statusData?.emailVerifiedAt || null,
                exportedAt: new Date().toISOString(),
            },
            monthlyLimits: statusData?.monthlyLimits,
            auditVersion: "2.0.0",
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orbix-account-${statusData?.username || "export"}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Account data archive downloaded.", { title: "Export Complete" });
    };

    if (isLoading) {
        return (
            <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-3">
                <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
                    Loading Account Management...
                </p>
            </div>
        );
    }

    const emailQuota = statusData?.monthlyLimits.email;
    const usernameQuota = statusData?.monthlyLimits.username;
    const pendingOp = statusData?.pendingOperation;
    const isChangePending = Boolean(pendingOp);

    return (
        <div className="relative space-y-6">
            {/* SECTION 1: PRIMARY EMAIL MANAGEMENT */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                            <Mail className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">
                                Primary Email Address
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Used for account login, cryptographic authentication & security recovery.
                            </p>
                        </div>
                    </div>

                    {/* Monthly Limit Badge */}
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-neutral-100 border-2 border-black text-xs font-black text-neutral-800 shadow-[1px_1px_0px_#000]">
                            {emailQuota ? `${emailQuota.remaining}/${emailQuota.limit} changes left this month` : "2/2 changes left"}
                        </span>
                    </div>
                </div>

                {/* Email Address & Verification Pill */}
                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Current Active Email
                            </span>
                            <div className="font-mono text-sm sm:text-base font-black text-black break-all">
                                {statusData?.primaryEmail || user?.email}
                            </div>
                        </div>

                        {/* Verified / Unverified Pill */}
                        <div>
                            {isChangePending ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 border-2 border-black text-xs font-black text-amber-900 shadow-[2px_2px_0px_#000]">
                                    <Clock className="w-3.5 h-3.5 stroke-[2.5] animate-pulse" />
                                    <span>Pending Email Verification</span>
                                </span>
                            ) : statusData?.isEmailVerified ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Email Verified</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border-2 border-black text-xs font-black text-rose-900 shadow-[2px_2px_0px_#000]">
                                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Unverified</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Pending Email Change In-Progress Banner */}
                    {isChangePending && pendingOp && (
                        <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                                    <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                                        Email Change in Progress
                                    </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-neutral-500">
                                    Expires: {new Date(pendingOp.expiresAt).toLocaleTimeString()}
                                </span>
                            </div>

                            <p className="text-xs font-medium text-neutral-700">
                                Proposed new address: <strong className="font-mono text-black">{pendingOp.requestedValue}</strong>.
                                {pendingOp.stage === "old_email_authorization_pending"
                                    ? " Stage 1 of 2: Awaiting authorization code from your current primary email."
                                    : " Stage 2 of 2: Current email authorized! Awaiting verification code from your new email."}
                            </p>

                            <div className="flex items-center gap-2 flex-wrap pt-1">
                                <button
                                    type="button"
                                    onClick={handleOpenPendingEmailChangeModal}
                                    className="px-3.5 py-1.5 rounded-lg bg-black text-[#a2ff86] border-2 border-black text-xs font-black hover:bg-neutral-900 shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Enter Code
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelEmailChange}
                                    className="px-3.5 py-1.5 rounded-lg bg-white text-rose-700 border-2 border-black text-xs font-black hover:bg-rose-50 shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Cancel Change
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                    {!isChangePending && (
                        <button
                            type="button"
                            disabled={!emailQuota?.canChange}
                            onClick={handleOpenNewEmailChangeModal}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-900 border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Mail className="w-4 h-4 stroke-[2.5]" />
                            <span>Change Email Address</span>
                        </button>
                    )}

                    {!statusData?.isEmailVerified && !isChangePending && (
                        <button
                            type="button"
                            onClick={handleSendPrimaryVerification}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-emerald-300 text-black border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        >
                            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                            <span>Verify Email Now</span>
                        </button>
                    )}
                </div>
            </div>

            {/* SECTION 2: USERNAME MANAGEMENT */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-sky-200 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                            <AtSign className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-black">
                                Username Management
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Unique platform identifier used for public profile URL, mentions, and leaderboards.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-neutral-100 border-2 border-black text-xs font-black text-neutral-800 shadow-[1px_1px_0px_#000]">
                            {usernameQuota ? `${usernameQuota.remaining}/${usernameQuota.limit} changes left this month` : "2/2 changes left"}
                        </span>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Registered Username
                        </span>
                        <div className="font-mono text-sm sm:text-base font-black text-black">
                            @{statusData?.username || user?.username}
                        </div>
                    </div>

                    {statusData?.usernameUpdatedAt && (
                        <span className="text-[11px] font-medium text-neutral-500">
                            Updated: {new Date(statusData.usernameUpdatedAt).toLocaleDateString()}
                        </span>
                    )}
                </div>

                <div>
                    <button
                        type="button"
                        disabled={!usernameQuota?.canChange}
                        onClick={() => {
                            setNewUsernameInput("");
                            setUsernameStepUpType(null);
                            setUsernameOperationId(null);
                            setIsUsernameModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-900 border-2 border-black text-xs sm:text-sm font-black uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <UserCog className="w-4 h-4 stroke-[2.5]" />
                        <span>Change Username</span>
                    </button>
                </div>
            </div>

            {/* SECTION 3: DATA ARCHIVE & DANGER ZONE */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-black text-black">
                        Data Archive & Portability
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Download a cryptographically verified copy of your account profile, coding credentials, and security history.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleExportData}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Download Account Data (.JSON)</span>
                </button>
            </div>

            {/* UNIFIED MODAL 1: CHANGE EMAIL REQUEST & 2-STEP OTP VERIFICATION (SEAMLESS SINGLE DIALOG) */}
            {isEmailChangeModalOpen && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmittingStartEmail && !isSubmittingOtp) {
                            if (emailChangeStep === "input_email") {
                                setIsEmailChangeModalOpen(false);
                            }
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                                    {emailChangeStep === "input_email" ? (
                                        <Mail className="w-5 h-5 stroke-[2.5]" />
                                    ) : (
                                        <KeyRound className="w-5 h-5 stroke-[2.5]" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black leading-tight">
                                        {emailChangeStep === "input_email"
                                            ? "Change Primary Email"
                                            : emailChangeStep === "verify_old_email"
                                            ? "Authorize Current Email"
                                            : "Verify New Email"}
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        {emailChangeStep === "input_email"
                                            ? "Step 1: Enter your new address"
                                            : emailChangeStep === "verify_old_email"
                                            ? "Step 1 of 2: Authorizing old address"
                                            : "Step 2 of 2: Confirming new address"}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsEmailChangeModalOpen(false);
                                    if (emailChangeStep === "input_email") {
                                        setNewEmailInput("");
                                    }
                                }}
                                className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                aria-label="Close dialog"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {emailChangeStep === "input_email" ? (
                            /* Step 1: Input New Email Form */
                            <form onSubmit={handleStartEmailChange} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                        New Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={newEmailInput}
                                        onChange={(e) => setNewEmailInput(e.target.value)}
                                        placeholder="new.email@example.com"
                                        className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black font-mono text-sm font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all"
                                        autoFocus
                                    />
                                </div>

                                <div className="p-3 rounded-xl bg-white border-2 border-black text-xs font-medium text-neutral-700 leading-relaxed">
                                    <strong>Security Notice:</strong> A 6-digit authorization code will first be sent to your current email (<strong>{statusData?.primaryEmail || user?.email}</strong>) to authorize this change.
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmittingStartEmail || !newEmailInput.trim()}
                                        className="w-full py-3 rounded-full bg-black text-sm font-black text-white hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingStartEmail ? "Sending Code..." : "Authorize Change →"}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Steps 2 & 3: Continuous OTP Verification Inside Same Modal */
                            <div className="space-y-4">
                                <div className="p-3 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Verification code sent to
                                    </span>
                                    <span className="text-xs sm:text-sm font-black text-black font-mono break-all block">
                                        {emailChangeStep === "verify_old_email"
                                            ? activeEmailOp?.currentEmail || statusData?.pendingOperation?.currentValue || user?.email
                                            : activeEmailOp?.requestedEmail || statusData?.pendingOperation?.requestedValue || newEmailInput}
                                    </span>
                                </div>

                                <div className="space-y-3 pt-1">
                                    <OtpSegmentedInput
                                        value={otpCode}
                                        onChange={setOtpCode}
                                        disabled={isSubmittingOtp}
                                        onComplete={(code: string) => handleVerifyEmailChangeOtp(code)}
                                        autoFocus
                                    />

                                    {devOtp && (
                                        <div className="text-center pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOtpCode(devOtp);
                                                    handleVerifyEmailChangeOtp(devOtp);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] hover:bg-yellow-300 border-2 border-black text-xs font-mono font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                                <span>Dev Auto-Fill: <strong>{devOtp}</strong></span>
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 px-1 text-xs font-black">
                                        <button
                                            type="button"
                                            disabled={otpCooldown > 0 || isResendingOtp || isSubmittingOtp}
                                            onClick={handleResendEmailChangeOtp}
                                            className="text-black underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                        >
                                            <RotateCcw className={`w-3.5 h-3.5 stroke-[2.5] ${isResendingOtp ? "animate-spin" : ""}`} />
                                            <span>{otpCooldown > 0 ? `Resend (${otpCooldown}s)` : "Resend Code"}</span>
                                        </button>

                                        <span className="text-[11px] text-neutral-500 font-bold">
                                            Expires in 10 mins
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2">
                                    <button
                                        type="button"
                                        disabled={otpCode.length !== 6 || isSubmittingOtp}
                                        onClick={() => handleVerifyEmailChangeOtp(otpCode)}
                                        className="w-full h-12 rounded-full bg-black text-sm font-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingOtp ? (
                                            <span>Verifying code...</span>
                                        ) : (
                                            <span>
                                                {emailChangeStep === "verify_old_email"
                                                    ? "Confirm & Continue →"
                                                    : "Verify & Complete Change ✓"}
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleCancelEmailChange}
                                        className="w-full py-2 rounded-full bg-transparent hover:bg-black/5 text-xs font-black text-neutral-600 hover:text-black transition-all cursor-pointer"
                                    >
                                        Cancel Email Change
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 2: PRIMARY EMAIL VERIFICATION (FOR UNVERIFIED ACCOUNTS) */}
            {isPrimaryVerifyModalOpen && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmittingPrimaryOtp) {
                            setIsPrimaryVerifyModalOpen(false);
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                                    <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black leading-tight">
                                        Verify Primary Email
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        Enter 6-digit confirmation code
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsPrimaryVerifyModalOpen(false)}
                                className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                aria-label="Close dialog"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="p-3 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Code dispatched to
                            </span>
                            <span className="text-xs sm:text-sm font-black text-black font-mono break-all block">
                                {statusData?.primaryEmail || user?.email}
                            </span>
                        </div>

                        <div className="space-y-3 pt-1">
                            <OtpSegmentedInput
                                value={primaryOtpCode}
                                onChange={setPrimaryOtpCode}
                                disabled={isSubmittingPrimaryOtp}
                                onComplete={(code: string) => handleConfirmPrimaryVerification(code)}
                                autoFocus
                            />

                            {primaryDevOtp && (
                                <div className="text-center pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPrimaryOtpCode(primaryDevOtp);
                                            handleConfirmPrimaryVerification(primaryDevOtp);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] hover:bg-yellow-300 border-2 border-black text-xs font-mono font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-black" />
                                        <span>Dev Auto-Fill: <strong>{primaryDevOtp}</strong></span>
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 px-1 text-xs font-black">
                                <button
                                    type="button"
                                    disabled={primaryCooldown > 0 || isSubmittingPrimaryOtp}
                                    onClick={handleSendPrimaryVerification}
                                    className="text-black underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>{primaryCooldown > 0 ? `Resend (${primaryCooldown}s)` : "Resend Code"}</span>
                                </button>
                                <span className="text-[11px] text-neutral-500 font-bold">Expires in 10 mins</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                disabled={primaryOtpCode.length !== 6 || isSubmittingPrimaryOtp}
                                onClick={() => handleConfirmPrimaryVerification(primaryOtpCode)}
                                className="w-full h-12 rounded-full bg-black text-sm font-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                            >
                                {isSubmittingPrimaryOtp ? "Verifying..." : "Confirm & Verify Email ✓"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: USERNAME CHANGE FLOW */}
            {isUsernameModalOpen && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmittingUsernameRequest && !isSubmittingUsernameConfirm) {
                            setIsUsernameModalOpen(false);
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-sky-200 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                                    <AtSign className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black leading-tight">
                                        Change Username
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        {usernameStepUpType ? "Step 2: Security step-up" : "Step 1: Choose username"}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsUsernameModalOpen(false)}
                                className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                aria-label="Close dialog"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {!usernameStepUpType ? (
                            /* Step 1: Input and Availability Check */
                            <form onSubmit={handleRequestUsernameChange} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                        Proposed Username
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-neutral-400">
                                            @
                                        </span>
                                        <input
                                            type="text"
                                            required
                                            value={newUsernameInput}
                                            onChange={(e) => setNewUsernameInput(e.target.value.toLowerCase())}
                                            placeholder="new_username"
                                            className="w-full pl-9 pr-4 py-3 rounded-xl bg-white border-2 border-black font-mono text-sm font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all"
                                        />
                                    </div>

                                    {/* Availability Feedback */}
                                    {newUsernameInput.trim() && (
                                        <div className="pt-1 text-xs font-bold">
                                            {usernameAvailability.checking ? (
                                                <span className="text-neutral-500">Checking availability...</span>
                                            ) : usernameAvailability.available ? (
                                                <span className="text-emerald-700 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Username @{newUsernameInput.trim()} is available!</span>
                                                </span>
                                            ) : (
                                                <span className="text-rose-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>{usernameAvailability.reason || "Username unavailable"}</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 rounded-xl bg-white border-2 border-black text-xs font-medium text-neutral-700 space-y-1">
                                    <p>• 3 to 20 characters (letters, numbers, dot, _, -)</p>
                                    <p>• Profile links will immediately update to your new handle</p>
                                    <p>• Limited to 2 successful changes per calendar month</p>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmittingUsernameRequest || !usernameAvailability.available}
                                        className="w-full py-3 rounded-full bg-black text-sm font-black text-white hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingUsernameRequest ? "Validating..." : "Continue to Step-Up →"}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* Step 2: Step-up Verification (Email OTP or Password) */
                            <div className="space-y-4">
                                <div className="p-3 rounded-xl bg-white border-2 border-black text-xs font-medium text-neutral-700">
                                    Changing username to: <strong className="font-mono text-black">@{newUsernameInput.trim()}</strong>
                                </div>

                                {usernameStepUpType === "email_otp" ? (
                                    <div className="space-y-3">
                                        <p className="text-xs text-neutral-600 font-semibold text-center">
                                            Enter the 6-digit confirmation code sent to <strong className="text-black">{statusData?.primaryEmail}</strong>
                                        </p>

                                        <OtpSegmentedInput
                                            value={usernameOtpCode}
                                            onChange={setUsernameOtpCode}
                                            disabled={isSubmittingUsernameConfirm}
                                            onComplete={(code: string) => handleConfirmUsernameChange(code)}
                                            autoFocus
                                        />

                                        {usernameDevOtp && (
                                            <div className="text-center pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUsernameOtpCode(usernameDevOtp);
                                                        handleConfirmUsernameChange(usernameDevOtp);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] hover:bg-yellow-300 border-2 border-black text-xs font-mono font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5 text-black" />
                                                    <span>Dev Auto-Fill: <strong>{usernameDevOtp}</strong></span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                            Account Password
                                        </label>
                                        <input
                                            type="password"
                                            value={usernamePasswordInput}
                                            onChange={(e) => setUsernamePasswordInput(e.target.value)}
                                            placeholder="Enter your password"
                                            className="w-full px-4 py-3 rounded-xl bg-white border-2 border-black font-mono text-sm font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2 pt-2">
                                    <button
                                        type="button"
                                        disabled={
                                            isSubmittingUsernameConfirm ||
                                            (usernameStepUpType === "email_otp" && usernameOtpCode.length !== 6) ||
                                            (usernameStepUpType === "password" && !usernamePasswordInput)
                                        }
                                        onClick={() => handleConfirmUsernameChange()}
                                        className="w-full h-12 rounded-full bg-black text-sm font-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        {isSubmittingUsernameConfirm ? "Committing update..." : "Confirm Username Change ✓"}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setUsernameStepUpType(null)}
                                        className="w-full py-2 rounded-full bg-transparent hover:bg-black/5 text-xs font-black text-neutral-600 hover:text-black transition-all cursor-pointer"
                                    >
                                        Back to Edit Username
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
