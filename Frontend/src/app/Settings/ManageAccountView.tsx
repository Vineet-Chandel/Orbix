import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
    Mail,
    UserCog,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    X,
    KeyRound,
    ShieldCheck,
    Download,
    Clock,
    AtSign,
    Code2,
    FileText,
    Shield,
    HelpCircle,
    Users,
    Check,
    Copy,
    Lock,
    Database,
    Eye,
    RefreshCw,
    FileCheck,
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
    fetchDataArchiveInfo,
    requestDataArchiveOtp,
    generateDataArchive,
    type ManageAccountsStatus,
    type ArchiveCategoryKey,
    type ArchiveStatusInfo,
    type GenerateArchiveResult,
} from "../../api/manageAccountApi";

interface ManageAccountViewProps {
    user: any;
    onBack?: () => void;
    onRefreshStatus?: () => void;
}

export const ManageAccountView: React.FC<ManageAccountViewProps> = ({ user, onBack: _onBack, onRefreshStatus }) => {
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

    const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
    const [isResendingOtp, setIsResendingOtp] = useState(false);

    // Primary Email Verification Dialog (for unverified accounts)
    const [isPrimaryVerifyModalOpen, setIsPrimaryVerifyModalOpen] = useState(false);
    const [primaryOtpCode, setPrimaryOtpCode] = useState("");
    const [primaryCooldown, setPrimaryCooldown] = useState(0);

    const [isSubmittingPrimaryOtp, setIsSubmittingPrimaryOtp] = useState(false);

    // Username Change Flow Modals & State
    const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
    const [newUsernameInput, setNewUsernameInput] = useState("");
    const [usernameAvailability, setUsernameAvailability] = useState<{
        checking: boolean;
        available?: boolean;
        isCurrent?: boolean;
        reason?: string;
    }>({ checking: false });
    const [isSubmittingUsernameRequest, setIsSubmittingUsernameRequest] = useState(false);
    const [usernameStepUpType, setUsernameStepUpType] = useState<"email_otp" | "password" | null>(null);
    const [usernameOperationId, setUsernameOperationId] = useState<string | null>(null);
    const [usernameOtpCode, setUsernameOtpCode] = useState("");
    const [usernamePasswordInput, setUsernamePasswordInput] = useState("");
    const [usernameCooldown, setUsernameCooldown] = useState(0);

    const [isSubmittingUsernameConfirm, setIsSubmittingUsernameConfirm] = useState(false);

    const availabilityCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

    // ============================================================================
    // DATA ARCHIVE & PORTABILITY STATE (GDPR Article 20 / CCPA Compliance)
    // ============================================================================
    const [archiveInfo, setArchiveInfo] = useState<ArchiveStatusInfo | null>(null);
    const [isLoadingArchiveInfo, setIsLoadingArchiveInfo] = useState(false);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [archiveScopeMode, setArchiveScopeMode] = useState<"full" | "custom">("full");
    const [selectedCategories, setSelectedCategories] = useState<ArchiveCategoryKey[]>([
        "identity",
        "platforms",
        "resumes",
        "security",
        "support",
        "network",
    ]);
    const [archiveStepUpType, setArchiveStepUpType] = useState<"password" | "email_otp">("password");
    const [archivePassword, setArchivePassword] = useState("");
    const [archiveOtp, setArchiveOtp] = useState("");
    const [isRequestingArchiveOtp, setIsRequestingArchiveOtp] = useState(false);
    const [archiveOtpCooldown, setArchiveOtpCooldown] = useState(0);
    const [archiveDevOtp, setArchiveDevOtp] = useState<string | null>(null);
    const [isGeneratingArchive, setIsGeneratingArchive] = useState(false);
    const [generationStage, setGenerationStage] = useState<string>("");
    const [generatedResult, setGeneratedResult] = useState<GenerateArchiveResult | null>(null);
    const [isPreviewJsonOpen, setIsPreviewJsonOpen] = useState(false);
    const [isCopiedChecksum, setIsCopiedChecksum] = useState(false);
    const [previewPayload, setPreviewPayload] = useState<any | null>(null);

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

    const loadArchiveInfo = async () => {
        setIsLoadingArchiveInfo(true);
        try {
            const info = await fetchDataArchiveInfo();
            setArchiveInfo(info);
            if (!info.hasPasswordAuth) {
                setArchiveStepUpType("email_otp");
            }
        } catch (e: any) {
            console.error("Failed to load archive status:", e);
        } finally {
            setIsLoadingArchiveInfo(false);
        }
    };

    useEffect(() => {
        loadStatus(true);
        loadArchiveInfo();
    }, []);

    const handleOpenArchiveModal = (mode: "full" | "custom") => {
        setArchiveScopeMode(mode);
        setArchivePassword("");
        setArchiveOtp("");
        setGeneratedResult(null);
        setGenerationStage("");
        if (archiveInfo && !archiveInfo.hasPasswordAuth) {
            setArchiveStepUpType("email_otp");
        } else {
            setArchiveStepUpType("password");
        }
        setIsArchiveModalOpen(true);
    };

    const handleToggleCategory = (catKey: ArchiveCategoryKey) => {
        setSelectedCategories((prev) => {
            if (prev.includes(catKey)) {
                if (prev.length === 1) {
                    toast.error("At least one data category must be selected.");
                    return prev;
                }
                return prev.filter((k) => k !== catKey);
            } else {
                return [...prev, catKey];
            }
        });
    };

    const handleRequestArchiveOtp = async () => {
        if (archiveOtpCooldown > 0 || isRequestingArchiveOtp) return;
        setIsRequestingArchiveOtp(true);
        try {
            const res = await requestDataArchiveOtp();
            setArchiveOtpCooldown(res.cooldownSeconds || 60);
            if (res.devOtp) {
                setArchiveDevOtp(res.devOtp);
            }
            toast.success(res.message || "Archive authorization code sent to your email! ✓", {
                title: "Code Sent",
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to send verification code.");
        } finally {
            setIsRequestingArchiveOtp(false);
        }
    };

    const triggerDownload = (payload: any, filename: string) => {
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleGenerateArchive = async () => {
        if (archiveStepUpType === "password" && !archivePassword) {
            toast.error("Please enter your account password to authorize export.");
            return;
        }
        if (archiveStepUpType === "email_otp" && archiveOtp.trim().length !== 6) {
            toast.error("Please enter the 6-digit verification code sent to your email.");
            return;
        }

        setIsGeneratingArchive(true);
        setGenerationStage("Authenticating step-up security credentials...");

        try {
            await new Promise((r) => setTimeout(r, 350));
            setGenerationStage("Querying PostgreSQL across all user data domains...");

            const result = await generateDataArchive({
                categories: archiveScopeMode === "full" ? "all" : selectedCategories,
                stepUpPassword: archiveStepUpType === "password" ? archivePassword : undefined,
                stepUpOtp: archiveStepUpType === "email_otp" ? archiveOtp.trim() : undefined,
            });

            setGenerationStage("Sealing payload with SHA-256 cryptographic checksum...");
            await new Promise((r) => setTimeout(r, 350));

            setGeneratedResult(result);
            setGenerationStage("Archive generated and verified successfully! ✓");

            // Automatically trigger file download
            triggerDownload(result.archivePayload, result.filename);

            toast.success(`Export ready! ${result.filename} (${(result.fileSizeBytes / 1024).toFixed(1)} KB) downloaded.`, {
                title: "Data Archive Sealed",
            });

            // Refresh recent exports list
            await loadArchiveInfo();
        } catch (err: any) {
            toast.error(err.message || "Failed to generate data archive.");
            setGenerationStage("");
        } finally {
            setIsGeneratingArchive(false);
        }
    };

    const handleCopyChecksum = (checksum: string) => {
        navigator.clipboard.writeText(checksum);
        setIsCopiedChecksum(true);
        toast.success("SHA-256 Checksum copied to clipboard! ✓", { title: "Copied" });
        setTimeout(() => setIsCopiedChecksum(false), 2000);
    };

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

    useEffect(() => {
        if (archiveOtpCooldown <= 0) return;
        const timer = setInterval(() => {
            setArchiveOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [archiveOtpCooldown]);

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
                    isCurrent: res.isCurrent,
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

    // Lock background scrolling when any modal is open
    const isAnyModalOpen = Boolean(
        isEmailChangeModalOpen ||
        isPrimaryVerifyModalOpen ||
        isUsernameModalOpen ||
        isArchiveModalOpen ||
        isPreviewJsonOpen
    );

    useEffect(() => {
        if (!isAnyModalOpen || typeof document === "undefined") return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isAnyModalOpen]);

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
                if (onRefreshStatus) onRefreshStatus();
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
            if (onRefreshStatus) onRefreshStatus();
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
            if (onRefreshStatus) onRefreshStatus();
        } catch (err: any) {
            toast.error(err.message || "Failed to update username.");
        } finally {
            setIsSubmittingUsernameConfirm(false);
        }
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

            {/* SECTION 3: DATA ARCHIVE & PORTABILITY (GDPR ART. 20 & CCPA COMPLIANCE) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                {/* Header & Badges */}
                <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b-2 border-black/10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                            <Database className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-black text-black">
                                    Data Archive & Portability
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                    GDPR Art. 20
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-sky-100 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                    CCPA Standard
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 font-medium">
                                Export a dynamic, cryptographically sealed copy of your personal identity, platform submissions, career facts, and security history.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-mono font-bold text-neutral-700 shadow-[2px_2px_0px_#000]">
                            {isLoadingArchiveInfo ? (
                                <RefreshCw className="w-3.5 h-3.5 text-neutral-500 animate-spin" />
                            ) : (
                                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                            <span>
                                {isLoadingArchiveInfo
                                    ? "Syncing status..."
                                    : archiveInfo
                                    ? `${archiveInfo.dailyExportsRemaining} of ${archiveInfo.dailyLimit} remaining today`
                                    : "5 of 5 daily"}
                            </span>
                        </span>
                    </div>
                </div>

                {/* Included Real Data Categories Breakdown Grid */}
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-black">
                            Dynamic Data Domains Included in Archive:
                        </span>
                        <span className="text-[11px] font-mono font-bold text-neutral-500">
                            Live PostgreSQL Aggregation
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-base">👤</span>
                                <h4 className="text-xs font-black text-black">Identity & Academics</h4>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                Full profile, bio, campus enrollment, verified coder badge, and timestamps.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                            <div className="flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-black stroke-[2.5]" />
                                <h4 className="text-xs font-black text-black">Coding Platforms</h4>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                Synced LeetCode, Codeforces, GitHub, CodeChef handles, solved counts, & ratings.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-black stroke-[2.5]" />
                                <h4 className="text-xs font-black text-black">Career & Resumes</h4>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                Uploaded resume versions, ATS analysis reports, skill facts & role fit matrices.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-black stroke-[2.5]" />
                                <h4 className="text-xs font-black text-black">Security Audit Trail</h4>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                History of account email & username changes, challenges, and security events.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-black stroke-[2.5]" />
                                <h4 className="text-xs font-black text-black">Help Center Inquiries</h4>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                Support tickets, reported issues, priority flags & official resolution notes.
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-black stroke-[2.5]" />
                                <h4 className="text-xs font-black text-black">Network & Community</h4>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                Mutual connections counts, relationship requests & community settings.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Most Recent Generated Export Snapshot (if available) */}
                {archiveInfo?.recentExports && archiveInfo.recentExports.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center text-black shadow-[1px_1px_0px_#000] shrink-0">
                                    <FileCheck className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-black">
                                        Last Generated Archive Snapshot
                                    </h4>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {new Date(archiveInfo.recentExports[0].createdAt).toLocaleString()} •{" "}
                                        {(archiveInfo.recentExports[0].fileSizeBytes / 1024).toFixed(1)} KB •{" "}
                                        {archiveInfo.recentExports[0].categories.length} categories
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={`/api/settings/manage-account/data-archive/download/${archiveInfo.recentExports[0].exportId}`}
                                    download
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs border border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                                >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Download Snapshot</span>
                                </a>
                            </div>
                        </div>

                        {/* SHA-256 Hash Display */}
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-black text-xs font-mono">
                            <div className="truncate text-neutral-700">
                                <span className="font-black text-black">SHA-256: </span>
                                <span className="text-[11px]">{archiveInfo.recentExports[0].sha256Checksum}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopyChecksum(archiveInfo.recentExports[0].sha256Checksum)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF6EE] hover:bg-[#FFE566] text-black font-sans font-black text-[11px] border border-black transition-all cursor-pointer shrink-0"
                            >
                                {isCopiedChecksum ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopiedChecksum ? "Copied" : "Copy Hash"}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                    <button
                        type="button"
                        disabled={archiveInfo ? !archiveInfo.canExport : false}
                        onClick={() => handleOpenArchiveModal("full")}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <Download className="w-4 h-4 stroke-[2.5]" />
                        <span>Request Complete Archive (.JSON)</span>
                    </button>

                    <button
                        type="button"
                        disabled={archiveInfo ? !archiveInfo.canExport : false}
                        onClick={() => handleOpenArchiveModal("custom")}
                        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-neutral-50 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <UserCog className="w-4 h-4 stroke-[2.5]" />
                        <span>Customize Categories & Security</span>
                    </button>
                </div>
            </div>

            {/* UNIFIED MODAL 1: CHANGE EMAIL REQUEST & 2-STEP OTP VERIFICATION (SEAMLESS SINGLE DIALOG) */}
            {isEmailChangeModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmittingStartEmail && !isSubmittingOtp) {
                            if (emailChangeStep === "input_email") {
                                setIsEmailChangeModalOpen(false);
                            }
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto my-auto"
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
                </div>,
                document.body
            )}

            {/* MODAL 2: PRIMARY EMAIL VERIFICATION (FOR UNVERIFIED ACCOUNTS) */}
            {isPrimaryVerifyModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmittingPrimaryOtp) {
                            setIsPrimaryVerifyModalOpen(false);
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto my-auto"
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
                </div>,
                document.body
            )}

            {/* MODAL 3: USERNAME CHANGE FLOW */}
            {isUsernameModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmittingUsernameRequest && !isSubmittingUsernameConfirm) {
                            setIsUsernameModalOpen(false);
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto my-auto"
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
                                            ) : usernameAvailability.isCurrent ? (
                                                <span className="text-amber-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>This is already your current username</span>
                                                </span>
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
                </div>,
                document.body
            )}

            {/* UNIFIED MODAL 4: DATA ARCHIVE & PORTABILITY STEP-UP GENERATOR */}
            {isArchiveModalOpen && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isGeneratingArchive) {
                            setIsArchiveModalOpen(false);
                        }
                    }}
                >
                    <div
                        className="relative w-full max-w-lg bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto my-auto"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] shrink-0">
                                    <Database className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-black leading-tight">
                                        {generatedResult ? "Archive Sealed & Ready" : "Export Personal Data Archive"}
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        GDPR Article 20 & CCPA Cryptographic Portability
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                disabled={isGeneratingArchive}
                                onClick={() => setIsArchiveModalOpen(false)}
                                className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50"
                                aria-label="Close dialog"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {!generatedResult ? (
                            /* State 1: Scope Selection & Step-up Authentication Form */
                            <div className="space-y-4">
                                {/* Scope Mode Tabs */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black uppercase tracking-wider text-neutral-600 block">
                                        Archive Scope
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-white border-2 border-black rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setArchiveScopeMode("full")}
                                            className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                archiveScopeMode === "full"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                    : "text-neutral-600 hover:text-black"
                                            }`}
                                        >
                                            Full Archive (All 6 Domains)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setArchiveScopeMode("custom")}
                                            className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                                archiveScopeMode === "custom"
                                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                    : "text-neutral-600 hover:text-black"
                                            }`}
                                        >
                                            Customize Categories
                                        </button>
                                    </div>
                                </div>

                                {/* Custom Categories Checkboxes (Shown if Custom Scope selected) */}
                                {archiveScopeMode === "custom" && (
                                    <div className="p-3.5 bg-white border-2 border-black rounded-xl space-y-2.5">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
                                            Select Domains to Include:
                                        </span>
                                        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-black">
                                            {[
                                                { key: "identity" as ArchiveCategoryKey, label: "Identity & Profile" },
                                                { key: "platforms" as ArchiveCategoryKey, label: "Coding Platforms" },
                                                { key: "resumes" as ArchiveCategoryKey, label: "Resumes & Career" },
                                                { key: "security" as ArchiveCategoryKey, label: "Security & Audits" },
                                                { key: "support" as ArchiveCategoryKey, label: "Support Tickets" },
                                                { key: "network" as ArchiveCategoryKey, label: "Network & Social" },
                                            ].map((cat) => {
                                                const checked = selectedCategories.includes(cat.key);
                                                return (
                                                    <button
                                                        key={cat.key}
                                                        type="button"
                                                        onClick={() => handleToggleCategory(cat.key)}
                                                        className={`flex items-center gap-2 p-2 rounded-lg border-2 text-left transition-all cursor-pointer ${
                                                            checked
                                                                ? "bg-[#FAF6EE] border-black shadow-[2px_2px_0px_#000]"
                                                                : "bg-white border-neutral-200 text-neutral-400"
                                                        }`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-black text-[#a2ff86] border-black" : "border-neutral-300"}`}>
                                                            {checked && <Check className="w-3 h-3 stroke-[3]" />}
                                                        </div>
                                                        <span className="truncate">{cat.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Step-Up Security Card */}
                                <div className="p-4 bg-white border-2 border-black rounded-xl space-y-3.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Lock className="w-4 h-4 text-black stroke-[2.5]" />
                                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                                Security Step-Up Verification
                                            </span>
                                        </div>
                                        {archiveInfo?.hasPasswordAuth && (
                                            <div className="flex items-center gap-1 bg-[#FAF6EE] p-0.5 rounded-lg border border-black">
                                                <button
                                                    type="button"
                                                    onClick={() => setArchiveStepUpType("password")}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                                                        archiveStepUpType === "password" ? "bg-black text-white" : "text-neutral-600"
                                                    }`}
                                                >
                                                    Password
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setArchiveStepUpType("email_otp")}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all cursor-pointer ${
                                                        archiveStepUpType === "email_otp" ? "bg-black text-white" : "text-neutral-600"
                                                    }`}
                                                >
                                                    Email Code
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {archiveStepUpType === "password" ? (
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-neutral-600 block">
                                                Enter Account Password
                                            </label>
                                            <input
                                                type="password"
                                                value={archivePassword}
                                                onChange={(e) => setArchivePassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-sm font-mono font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-none"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-xs font-medium text-neutral-700">
                                                <span>Code to: <strong className="font-mono text-black">{archiveInfo?.primaryEmail || user?.email}</strong></span>
                                                <button
                                                    type="button"
                                                    disabled={archiveOtpCooldown > 0 || isRequestingArchiveOtp}
                                                    onClick={handleRequestArchiveOtp}
                                                    className="inline-flex items-center gap-1 text-black hover:underline font-black text-xs disabled:opacity-50 cursor-pointer"
                                                >
                                                    <RefreshCw className={`w-3 h-3 ${isRequestingArchiveOtp ? "animate-spin" : ""}`} />
                                                    <span>{archiveOtpCooldown > 0 ? `Resend (${archiveOtpCooldown}s)` : "Send Verification Code"}</span>
                                                </button>
                                            </div>

                                            <OtpSegmentedInput
                                                value={archiveOtp}
                                                onChange={setArchiveOtp}
                                                disabled={isGeneratingArchive}
                                                autoFocus
                                            />

                                            {archiveDevOtp && (
                                                <div className="text-center pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setArchiveOtp(archiveDevOtp)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] hover:bg-yellow-300 border-2 border-black text-xs font-mono font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                                    >
                                                        <span>Quick-Fill Dev Code: {archiveDevOtp}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Active Generation Pipeline Status */}
                                {isGeneratingArchive && (
                                    <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-black space-y-2 animate-in fade-in">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                                            <span className="text-xs font-black text-black">
                                                {generationStage || "Generating Sealed Archive..."}
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden border border-black">
                                            <div className="h-full bg-black animate-pulse" style={{ width: "85%" }} />
                                        </div>
                                    </div>
                                )}

                                {/* Submit Generate Button */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        disabled={
                                            isGeneratingArchive ||
                                            (archiveStepUpType === "password" && !archivePassword) ||
                                            (archiveStepUpType === "email_otp" && archiveOtp.trim().length !== 6)
                                        }
                                        onClick={handleGenerateArchive}
                                        className="w-full py-3.5 rounded-full bg-black text-sm font-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4 stroke-[2.5]" />
                                        <span>
                                            {isGeneratingArchive ? "Generating Archive..." : "Authorize & Generate Archive (.JSON)"}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* State 2: Generation Complete Celebration & Verification Screen */
                            <div className="space-y-4">
                                <div className="p-5 rounded-2xl bg-[#a2ff86]/30 border-2 border-black text-center space-y-2">
                                    <div className="w-12 h-12 rounded-full bg-[#a2ff86] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                        <CheckCircle2 className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-base font-black text-black">
                                        Data Archive Successfully Generated & Sealed
                                    </h4>
                                    <p className="text-xs text-neutral-700 font-medium max-w-sm mx-auto">
                                        Your complete personal record snapshot has been dynamically extracted from PostgreSQL and downloaded to your device.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-white border-2 border-black space-y-2.5 text-xs font-mono">
                                    <div className="flex items-center justify-between">
                                        <span className="font-sans font-bold text-neutral-500">Archive File:</span>
                                        <span className="font-bold text-black">{generatedResult.filename}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-sans font-bold text-neutral-500">File Size:</span>
                                        <span className="font-bold text-black">{(generatedResult.fileSizeBytes / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-sans font-bold text-neutral-500">SHA-256 Seal:</span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyChecksum(generatedResult.sha256Checksum)}
                                            className="inline-flex items-center gap-1 text-[11px] font-sans font-bold text-black hover:underline cursor-pointer"
                                        >
                                            <span className="truncate max-w-[180px] font-mono">{generatedResult.sha256Checksum}</span>
                                            <Copy className="w-3 h-3 shrink-0" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => triggerDownload(generatedResult.archivePayload, generatedResult.filename)}
                                        className="py-2.5 px-4 rounded-xl bg-black text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Download Again</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPreviewPayload(generatedResult.archivePayload);
                                            setIsPreviewJsonOpen(true);
                                        }}
                                        className="py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-50 text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Preview Data JSON</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setGeneratedResult(null);
                                        setIsArchiveModalOpen(false);
                                    }}
                                    className="w-full py-2.5 rounded-full bg-transparent hover:bg-black/5 text-xs font-black text-neutral-600 hover:text-black transition-all cursor-pointer"
                                >
                                    Close Window
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* UNIFIED MODAL 5: JSON DATA INSPECTION PREVIEW MODAL */}
            {isPreviewJsonOpen && previewPayload && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
                    onClick={() => setIsPreviewJsonOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-4 animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col my-auto"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <Code2 className="w-5 h-5 text-black stroke-[2.5]" />
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Inspect Data Archive JSON
                                    </h3>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Cryptographically Sealed GDPR / CCPA Machine-Readable Payload
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(previewPayload, null, 2));
                                        toast.success("Complete JSON copied to clipboard! ✓");
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs border border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy JSON</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPreviewJsonOpen(false)}
                                    className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-neutral-900 border-2 border-black rounded-xl p-4 text-[#a2ff86] font-mono text-xs shadow-inner">
                            <pre className="whitespace-pre-wrap break-all leading-relaxed">
                                {JSON.stringify(previewPayload, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
