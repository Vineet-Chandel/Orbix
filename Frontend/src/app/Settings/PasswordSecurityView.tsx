import React, { useState, useEffect, useCallback } from "react";
import {
    KeyRound,
    Mail,
    ShieldCheck,
    Laptop,
    Smartphone,
    Tablet,
    Monitor,
    MapPin,
    Clock,
    RefreshCw,
    LogOut,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff,
    Check,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { motion } from "framer-motion";
import { NeoToggle } from "../../components/NeoToggle";
import { PasswordStrengthIndicator } from "../../LandingPages/Auth-Pages/PasswordStrengthIndicator";
import { evaluatePassword } from "../../LandingPages/Auth-Pages/passwordValidator";
import OtpSegmentedInput from "../../LandingPages/Auth-Pages/OtpSegmentedInput";
import { buildApiUrl } from "../../api/apiClient";
import { OrbixLoader } from "../../components/ui/loader";
import {
    fetchSessionOverview,
    terminateSession,
    terminateOtherSessions,
    type SessionOverviewData,
} from "../../api/sessionActivityApi";

export interface PasswordSecurityViewProps {
    accountType?: "personal" | "club";
    user: any;
    club?: any;
    twoFactorEnabled: boolean;
    onToggleTwoFactor: (val: boolean) => void;
}

function maskEmailAddress(email?: string): string {
    if (!email || !email.includes("@")) return email || "";
    const [localPart, domain] = email.split("@");
    if (!localPart) return email;
    if (localPart.length <= 2) {
        return `${localPart[0]}***@${domain}`;
    }
    const visibleStart = localPart.slice(0, 2);
    const visibleEnd = localPart.slice(-1);
    return `${visibleStart}***${visibleEnd}@${domain}`;
}

export const PasswordSecurityView: React.FC<PasswordSecurityViewProps> = ({
    accountType = "personal",
    user,
    club,
    twoFactorEnabled,
    onToggleTwoFactor,
}) => {
    const toast = useToast();

    // Mode: "current-password" | "email-otp"
    const [changePasswordMode, setChangePasswordMode] = useState<"current-password" | "email-otp">("current-password");

    // -------------------------------------------------------------------------
    // SEGMENT 1: REMEMBERS CURRENT PASSWORD
    // -------------------------------------------------------------------------
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    // Live strength evaluation (6 criteria matching signup page block)
    const currentModePasswordStrength = evaluatePassword(newPassword);

    const handleSaveWithCurrentPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!currentPassword) {
            toast.error("Please enter your current password.", { title: "Required Field" });
            return;
        }

        if (!newPassword) {
            toast.error("Please enter your new password.", { title: "Required Field" });
            return;
        }

        if (!currentModePasswordStrength.isValid) {
            toast.error("Please satisfy all password security criteria below.", { title: "Weak Password" });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.", { title: "Mismatch" });
            return;
        }

        if (currentPassword === newPassword) {
            toast.error("New password cannot be identical to your current password.", { title: "Invalid Password" });
            return;
        }

        setIsSavingPassword(true);
        try {
            const endpoint = accountType === "club"
                ? buildApiUrl("/api/club/settings/password/change")
                : buildApiUrl("/api/settings/manage-account/password/change");

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    confirmPassword,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.message || "Failed to update password. Please check your current password.");
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Password updated successfully! Other sessions have been logged out.", {
                title: "Password Changed",
            });
            await loadSessionData();
        } catch (err: any) {
            toast.error(err?.message || "Failed to update password.", { title: "Update Failed" });
        } finally {
            setIsSavingPassword(false);
        }
    };

    // -------------------------------------------------------------------------
    // SEGMENT 2: RESET VIA EMAIL OTP (ACCOUNT IS ALREADY FOUNDED)
    // -------------------------------------------------------------------------
    type OtpFlowStep = "send" | "verify" | "set_password" | "done";
    const [otpStep, setOtpStep] = useState<OtpFlowStep>("send");
    const [otpCode, setOtpCode] = useState("");
    const [resetSessionToken, setResetSessionToken] = useState("");
    const [resetProofToken, setResetProofToken] = useState("");
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isResettingViaOtp, setIsResettingViaOtp] = useState(false);

    // New password via OTP flow
    const [otpNewPassword, setOtpNewPassword] = useState("");
    const [otpConfirmPassword, setOtpConfirmPassword] = useState("");
    const [showOtpNewPassword, setShowOtpNewPassword] = useState(false);
    const [showOtpConfirmPassword, setShowOtpConfirmPassword] = useState(false);

    const otpModePasswordStrength = evaluatePassword(otpNewPassword);

    const registeredEmail = user?.gmail || user?.email || club?.public_email || "";
    const maskedRegisteredEmail = maskEmailAddress(registeredEmail);

    // Cooldown timer
    useEffect(() => {
        if (cooldownSeconds <= 0) return;
        const timer = setInterval(() => {
            setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldownSeconds]);

    const handleSendResetOtp = async () => {
        if (!registeredEmail) {
            toast.error("No registered email address found for this account.", { title: "Email Missing" });
            return;
        }

        setIsSendingOtp(true);
        try {
            const res = await fetch(buildApiUrl("/api/auth/forgot-password/find-account"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    identifier: registeredEmail,
                    accountType,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || "Failed to dispatch verification code.");
            }

            setResetSessionToken(data.resetSessionToken);
            setCooldownSeconds(data.cooldownSeconds || 60);
            setOtpCode("");
            setOtpStep("verify");
            toast.success(`Verification code dispatched to ${maskedRegisteredEmail}`, { title: "OTP Sent" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to send verification code.", { title: "Dispatch Failed" });
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleResendResetOtp = async () => {
        if (cooldownSeconds > 0 || isSendingOtp) return;
        setIsSendingOtp(true);
        try {
            const res = await fetch(buildApiUrl("/api/auth/forgot-password/resend-otp"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ resetSessionToken }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || "Failed to resend code.");
            }
            setCooldownSeconds(data.cooldownSeconds || 60);
            toast.success(`A fresh 6-digit code has been sent to ${maskedRegisteredEmail}`, { title: "Code Resent" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to resend code.");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyResetOtp = async (codeToVerify?: string) => {
        const code = (codeToVerify || otpCode).trim();
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit verification code.", { title: "Incomplete Code" });
            return;
        }

        setIsVerifyingOtp(true);
        try {
            const res = await fetch(buildApiUrl("/api/auth/forgot-password/verify-otp"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    resetSessionToken,
                    otp: code,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || "Invalid or expired verification code.");
            }

            setResetProofToken(data.resetProofToken);
            setOtpStep("set_password");
            toast.success("Identity verified! Set your new password below.", { title: "Code Verified" });
        } catch (err: any) {
            toast.error(err?.message || "Verification failed.", { title: "Invalid Code" });
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const handleSavePasswordViaOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!otpNewPassword) {
            toast.error("Please enter your new password.", { title: "Required Field" });
            return;
        }

        if (!otpModePasswordStrength.isValid) {
            toast.error("Please satisfy all password security criteria below.", { title: "Weak Password" });
            return;
        }

        if (otpNewPassword !== otpConfirmPassword) {
            toast.error("New passwords do not match.", { title: "Mismatch" });
            return;
        }

        setIsResettingViaOtp(true);
        try {
            const res = await fetch(buildApiUrl("/api/auth/forgot-password/reset"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    resetProofToken,
                    newPassword: otpNewPassword,
                    confirmPassword: otpConfirmPassword,
                }),
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || "Failed to reset password.");
            }

            setOtpStep("done");
            setOtpNewPassword("");
            setOtpConfirmPassword("");
            toast.success("Password reset complete! All other active sessions have been revoked.", {
                title: "Password Updated",
            });
            await loadSessionData();
        } catch (err: any) {
            toast.error(err?.message || "Failed to update password.");
        } finally {
            setIsResettingViaOtp(false);
        }
    };

    // -------------------------------------------------------------------------
    // SECTION 3: WHERE YOU'RE LOGGED IN (INLINE REAL SESSIONS - NO REDIRECTION)
    // -------------------------------------------------------------------------
    const [overview, setOverview] = useState<SessionOverviewData | null>(null);
    const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(true);
    const [isRefreshingSessions, setIsRefreshingSessions] = useState<boolean>(false);
    const [terminatingSessionId, setTerminatingSessionId] = useState<string | null>(null);
    const [isTerminatingOthers, setIsTerminatingOthers] = useState<boolean>(false);

    const loadSessionData = useCallback(async (showToast = false) => {
        try {
            if (showToast) setIsRefreshingSessions(true);
            else setIsLoadingSessions(true);

            const res = await fetchSessionOverview();
            setOverview(res.overview || null);

            if (showToast) {
                toast.success("Device sessions and login locations refreshed.");
            }
        } catch (err: any) {
            console.warn("[PasswordSecurityView] Failed to load session overview:", err.message);
        } finally {
            setIsLoadingSessions(false);
            setIsRefreshingSessions(false);
        }
    }, [toast]);

    useEffect(() => {
        loadSessionData();
    }, [loadSessionData]);

    const handleTerminateSingleSession = async (sessionId: string, deviceName: string) => {
        setTerminatingSessionId(sessionId);
        try {
            await terminateSession(sessionId);
            toast.success(`Logged out of ${deviceName || "remote device"} successfully.`);
            await loadSessionData();
        } catch (err: any) {
            toast.error(err?.message || "Failed to terminate device session.");
        } finally {
            setTerminatingSessionId(null);
        }
    };

    const handleTerminateOtherDevices = async () => {
        setIsTerminatingOthers(true);
        try {
            const res = await terminateOtherSessions();
            toast.success(`Logged out of ${res.revokedCount} other device(s) successfully.`, { title: "Devices Terminated" });
            await loadSessionData();
        } catch (err: any) {
            toast.error(err?.message || "Failed to terminate other sessions.");
        } finally {
            setIsTerminatingOthers(false);
        }
    };

    const getDeviceIcon = (deviceType?: string) => {
        const type = (deviceType || "").toLowerCase();
        if (type === "mobile" || type === "smartphone") return <Smartphone className="w-5 h-5 text-black" />;
        if (type === "tablet") return <Tablet className="w-5 h-5 text-black" />;
        if (type === "desktop") return <Monitor className="w-5 h-5 text-black" />;
        return <Laptop className="w-5 h-5 text-black" />;
    };

    const otherSessions = (overview?.activeSessions || []).filter((s) => !s.isCurrentSession);

    return (
        <div className="space-y-6">
            {/* ================================================================= */}
            {/* 1. CHANGE PASSWORD CARD (PARALLEL ON LAPTOP, SLIDER ON MOBILE)   */}
            {/* ================================================================= */}
            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-black text-black">
                            {accountType === "club" ? "Change Organization Password" : "Change Password"}
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                            Choose between updating with your current password or resetting via verified email OTP.
                        </p>
                    </div>

                    {/* Slide Toggler - Only visible on mobile/tablet (< lg) */}
                    <div className="lg:hidden relative p-1 bg-[#FAF6EE] border-2 border-black rounded-full shadow-[2px_2px_0px_#000] grid grid-cols-2 select-none w-full sm:w-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setChangePasswordMode("current-password")}
                            className={`relative z-10 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                changePasswordMode === "current-password"
                                    ? "text-[#a2ff86]"
                                    : "text-neutral-600 hover:text-black"
                            }`}
                        >
                            {changePasswordMode === "current-password" && (
                                <motion.div
                                    layoutId="password-mode-pill"
                                    className="absolute inset-0 bg-black rounded-full shadow-[1px_1px_0px_#000] -z-10"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Current Password</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setChangePasswordMode("email-otp")}
                            className={`relative z-10 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                changePasswordMode === "email-otp"
                                    ? "text-[#a2ff86]"
                                    : "text-neutral-600 hover:text-black"
                            }`}
                        >
                            {changePasswordMode === "email-otp" && (
                                <motion.div
                                    layoutId="password-mode-pill"
                                    className="absolute inset-0 bg-black rounded-full shadow-[1px_1px_0px_#000] -z-10"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <Mail className="w-3.5 h-3.5" />
                            <span>Reset with OTP</span>
                        </button>
                    </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* PARALLEL GRID ON LAPTOP (LG+), SLIDE-TOGGLED ON MOBILE        */}
                {/* ------------------------------------------------------------- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
                    {/* SECTION 1: I REMEMBER CURRENT PASSWORD */}
                    <form
                        onSubmit={handleSaveWithCurrentPassword}
                        className={`${
                            changePasswordMode === "current-password" ? "flex" : "hidden lg:flex"
                        } flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#FCFAF6] border-2 border-black shadow-[3px_3px_0px_#000] space-y-5`}
                        noValidate
                    >
                        <div className="space-y-4">
                            {/* Column Header */}
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-black text-[#a2ff86] border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                        <KeyRound className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-black">Current Password</h4>
                                        <p className="text-[11px] font-medium text-neutral-600">
                                            Update with your known credentials
                                        </p>
                                    </div>
                                </div>
                                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-white text-neutral-800 text-[10px] font-black border border-black uppercase tracking-wider">
                                    Direct
                                </span>
                            </div>

                            {/* Current Password Field */}
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-11 px-3.5 pr-10 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-colors"
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black p-1 cursor-pointer"
                                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                                    >
                                        {showCurrentPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password Field */}
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-11 px-3.5 pr-10 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-colors"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black p-1 cursor-pointer"
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                    >
                                        {showNewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* EXACT Password Strength Block from Signup Page */}
                                <PasswordStrengthIndicator
                                    result={currentModePasswordStrength}
                                    hasInput={newPassword.length > 0}
                                />
                            </div>

                            {/* Confirm New Password Field */}
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••••••"
                                        className="w-full h-11 px-3.5 pr-10 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-colors"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black p-1 cursor-pointer"
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    >
                                        {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                                {confirmPassword && newPassword && (
                                    <div className="mt-1 px-1 flex items-center gap-1.5 text-xs">
                                        {newPassword === confirmPassword ? (
                                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Passwords match</span>
                                            </span>
                                        ) : (
                                            <span className="text-rose-600 font-bold flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                <span>Passwords do not match</span>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={
                                    isSavingPassword ||
                                    !currentPassword ||
                                    !currentModePasswordStrength.isValid ||
                                    newPassword !== confirmPassword
                                }
                                className="w-full sm:w-auto px-6 py-3 rounded-full bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSavingPassword ? (
                                    <>
                                        <OrbixLoader size="xs" variant="inline" />
                                        <span>Updating Password...</span>
                                    </>
                                ) : (
                                    <span>Update Password</span>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* SECTION 2: RESET WITH EMAIL OTP */}
                    <div
                        className={`${
                            changePasswordMode === "email-otp" ? "flex" : "hidden lg:flex"
                        } flex-col justify-between p-5 sm:p-6 rounded-2xl bg-[#FCFAF6] border-2 border-black shadow-[3px_3px_0px_#000] space-y-5`}
                    >
                        <div className="space-y-4">
                            {/* Column Header */}
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-[#a2ff86] text-black border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-black">Reset with Email OTP</h4>
                                        <p className="text-[11px] font-medium text-neutral-600">
                                            Verify identity via registered email
                                        </p>
                                    </div>
                                </div>
                                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black uppercase tracking-wider">
                                    OTP Flow
                                </span>
                            </div>

                            {/* Account Found Callout Banner */}
                            <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-2 shadow-[2px_2px_0px_#000]">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#a2ff86] border border-black flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-black uppercase text-black">
                                            Account Verified & Identified
                                        </span>
                                        <p className="text-[11px] text-neutral-600 font-medium">
                                            No current password required. Code is sent to your registered email.
                                        </p>
                                    </div>
                                </div>
                                <div className="py-1.5 px-3 bg-[#FAF6EE] border border-black rounded-lg flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-neutral-600">Registered Email:</span>
                                    <span className="font-mono font-black text-[11px] text-black">{maskedRegisteredEmail}</span>
                                </div>
                            </div>

                            {/* Step 2A: Send Verification Code */}
                            {otpStep === "send" && (
                                <div className="space-y-3 pt-1">
                                    <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                                        Click below to send a single-use 6-digit confirmation code to your email.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleSendResetOtp}
                                        disabled={isSendingOtp}
                                        className="w-full sm:w-auto px-6 py-3 rounded-full bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isSendingOtp ? (
                                            <>
                                                <OrbixLoader size="xs" variant="inline" />
                                                <span>Sending Code...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Mail className="w-4 h-4" />
                                                <span>Send Verification Code</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Step 2B: Verify 6-Digit OTP */}
                            {otpStep === "verify" && (
                                <div className="space-y-4 pt-1">
                                    <div>
                                        <label className="block text-center text-xs font-black uppercase tracking-wider text-neutral-700 mb-2">
                                            Enter 6-Digit Verification Code
                                        </label>
                                        <OtpSegmentedInput
                                            value={otpCode}
                                            onChange={(code) => setOtpCode(code)}
                                            onComplete={(code) => handleVerifyResetOtp(code)}
                                            autoFocus
                                            disabled={isVerifyingOtp}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setOtpStep("send")}
                                            className="text-xs font-bold text-neutral-600 hover:text-black underline cursor-pointer"
                                        >
                                            Change method
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleResendResetOtp}
                                            disabled={cooldownSeconds > 0 || isSendingOtp}
                                            className="inline-flex items-center gap-1 font-black text-black hover:text-neutral-800 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? "animate-spin" : ""}`} />
                                            <span>
                                                {cooldownSeconds > 0
                                                    ? `Resend in ${cooldownSeconds}s`
                                                    : "Resend Code"}
                                            </span>
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleVerifyResetOtp()}
                                        disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                                        className="w-full py-3 rounded-full bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isVerifyingOtp ? (
                                            <>
                                                <OrbixLoader size="xs" variant="inline" />
                                                <span>Verifying Code...</span>
                                            </>
                                        ) : (
                                            <span>Confirm Code & Proceed</span>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Step 2C: Set New Password via Verified OTP Proof */}
                            {otpStep === "set_password" && (
                                <form onSubmit={handleSavePasswordViaOtp} className="space-y-4 pt-1" noValidate>
                                    <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>Identity verified! Choose your new password below.</span>
                                    </div>

                                    {/* New Password */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showOtpNewPassword ? "text" : "password"}
                                                value={otpNewPassword}
                                                onChange={(e) => setOtpNewPassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                className="w-full h-11 px-3.5 pr-10 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-colors"
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowOtpNewPassword(!showOtpNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black p-1 cursor-pointer"
                                                aria-label={showOtpNewPassword ? "Hide password" : "Show password"}
                                            >
                                                {showOtpNewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {/* EXACT Password Strength Block from Signup Page */}
                                        <PasswordStrengthIndicator
                                            result={otpModePasswordStrength}
                                            hasInput={otpNewPassword.length > 0}
                                        />
                                    </div>

                                    {/* Confirm New Password */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-700 mb-1">
                                            Confirm New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showOtpConfirmPassword ? "text" : "password"}
                                                value={otpConfirmPassword}
                                                onChange={(e) => setOtpConfirmPassword(e.target.value)}
                                                placeholder="••••••••••••"
                                                className="w-full h-11 px-3.5 pr-10 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-colors"
                                                autoComplete="new-password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowOtpConfirmPassword(!showOtpConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black p-1 cursor-pointer"
                                                aria-label={showOtpConfirmPassword ? "Hide password" : "Show password"}
                                            >
                                                {showOtpConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {otpConfirmPassword && otpNewPassword && (
                                            <div className="mt-1 px-1 flex items-center gap-1.5 text-xs">
                                                {otpNewPassword === otpConfirmPassword ? (
                                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Passwords match</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-rose-600 font-bold flex items-center gap-1">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        <span>Passwords do not match</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={
                                                isResettingViaOtp ||
                                                !otpModePasswordStrength.isValid ||
                                                otpNewPassword !== otpConfirmPassword
                                            }
                                            className="w-full sm:w-auto px-6 py-3 rounded-full bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isResettingViaOtp ? (
                                                <>
                                                    <OrbixLoader size="xs" variant="inline" />
                                                    <span>Saving New Password...</span>
                                                </>
                                            ) : (
                                                <span>Save New Password</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Step 2D: Done */}
                            {otpStep === "done" && (
                                <div className="p-4 bg-white border-2 border-black rounded-xl text-center space-y-2 shadow-[2px_2px_0px_#000]">
                                    <div className="w-10 h-10 rounded-full bg-[#a2ff86] border-2 border-black mx-auto flex items-center justify-center">
                                        <CheckCircle2 className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Password Reset Successfully!</h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Your account password was renewed. You can now use your new password.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpStep("send");
                                            setChangePasswordMode("current-password");
                                        }}
                                        className="mt-2 text-xs font-bold text-black underline cursor-pointer"
                                    >
                                        Reset Form
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 2. TWO-FACTOR AUTHENTICATION (2FA) CARD                          */}
            {/* ================================================================= */}
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
                        Protect your Orbix account with verified email OTP. Whenever you sign in, a single-use 6-digit code will be sent to your registered email (<span className="font-mono font-bold text-black">{maskedRegisteredEmail || "account email"}</span>) via Resend.
                    </p>
                </div>

                <NeoToggle
                    checked={twoFactorEnabled}
                    onChange={onToggleTwoFactor}
                    onStatusText="2FA: Enabled"
                    offStatusText="2FA: Disabled"
                    showStatusText={true}
                    ariaLabel="Toggle two-factor authentication"
                />
            </div>

            {/* ================================================================= */}
            {/* 3. WHERE YOU'RE LOGGED IN (INLINE REAL SESSIONS - NO REDIRECTION) */}
            {/* ================================================================= */}
            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_#000]">
                            <Laptop className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-black">Where You're Logged In</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Active device sessions, login locations, and remote termination
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => loadSessionData(true)}
                            disabled={isRefreshingSessions || isLoadingSessions}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FAF6EE] hover:bg-white text-black text-[11px] font-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                            title="Refresh active login sessions"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSessions ? "animate-spin" : ""}`} />
                            <span>Refresh</span>
                        </button>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse" />
                            <span>Real-Time Tracking</span>
                        </span>
                    </div>
                </div>

                {/* SESSIONS CONTENT: Real device sessions rendered inline without any redirection */}
                {isLoadingSessions ? (
                    <div className="p-6 bg-[#FAF6EE] border-2 border-black rounded-xl text-center space-y-2">
                        <OrbixLoader size="sm" variant="inline" />
                        <p className="text-xs font-bold text-neutral-600">Loading active sessions & hardware fingerprints...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* THIS DEVICE (CURRENT SESSION) */}
                        {overview?.currentSession ? (
                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-2.5">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                            {getDeviceIcon(overview.currentSession.deviceType)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-sm font-black text-black">
                                                    {overview.currentSession.deviceName || "Desktop / Browser"}
                                                </h4>
                                                <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black uppercase tracking-wider flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                                                    <span>This Device</span>
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium text-neutral-600">
                                                {overview.currentSession.browser || "Browser"} on {overview.currentSession.operatingSystem || "OS"}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 bg-white border border-black rounded-lg text-[10px] font-mono font-bold text-neutral-700">
                                        IP: {overview.currentSession.ipAddressMasked || "Masked"}
                                    </span>
                                </div>

                                <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] text-neutral-600 font-medium flex-wrap gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                        <span>{overview.currentSession.locationSummary || "Approximate Location Verified"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                        <span>Active now</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center gap-3">
                                <Laptop className="w-5 h-5 text-black" />
                                <div>
                                    <h4 className="text-xs font-black text-black">Current Device Active</h4>
                                    <p className="text-[11px] text-neutral-600">Logged in via authenticated HTTPS token session</p>
                                </div>
                            </div>
                        )}

                        {/* OTHER LOGGED IN DEVICES */}
                        {otherSessions.length > 0 ? (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700">
                                        Other Logged In Devices ({otherSessions.length})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={handleTerminateOtherDevices}
                                        disabled={isTerminatingOthers}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs border border-rose-300 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>{isTerminatingOthers ? "Logging Out Others..." : "Log Out of All Other Devices"}</span>
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {otherSessions.map((session) => (
                                        <div
                                            key={session.id || session.sessionId}
                                            className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3 flex-wrap"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] border border-black flex items-center justify-center shrink-0">
                                                    {getDeviceIcon(session.deviceType)}
                                                </div>
                                                <div>
                                                    <h5 className="text-xs font-black text-black">
                                                        {session.deviceName || "Remote Device"}
                                                    </h5>
                                                    <p className="text-[11px] text-neutral-600">
                                                        {session.browser} on {session.operatingSystem} • {session.locationSummary || "Verified Location"}
                                                    </p>
                                                    <p className="text-[10px] text-neutral-500 font-mono">
                                                        IP: {session.ipAddressMasked}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleTerminateSingleSession(session.sessionId, session.deviceName)}
                                                disabled={terminatingSessionId === session.sessionId}
                                                className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-neutral-800 font-black text-xs border border-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                                            >
                                                {terminatingSessionId === session.sessionId ? "Terminating..." : "Log Out Device"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-xl bg-white border-2 border-black flex items-center gap-2.5 text-xs font-bold text-neutral-700">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>No other devices currently active. Your account is only signed in on this current device.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PasswordSecurityView;
