import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Bookmark,
    UserX,
    MessageSquare,
    CheckCircle2,
    ExternalLink,
    Copy,
    Lock,
    Laptop,
    Search,
    Loader2,
    UserCheck,
    UserMinus,
    MoreVertical,
    ShieldCheck,
    GraduationCap,
    MapPin,
    X,
    RefreshCw,
    FileText,
    Check,
    Globe,
} from "lucide-react";
import type { SettingsViewKey } from "./types";
import { useToast } from "../../context/ToastContext";
import { NeoToggle } from "../../components/NeoToggle";
import { useAppDispatch, useAppSelector, setUser } from "../../store";
import {
    fetchBlockedUsersThunk,
    unblockUserThunk,
    fetchConnectionsThunk,
    removeConnectionThunk,
    blockUserThunk,
} from "../../store/networkSlice";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { OrbixLogo } from "../../components/OrbixLogo";
import type { ConnectedUserItem } from "../../api/relationshipApi";
import { HelpCenterView } from "./HelpCenterView";
import { ManageAccountView } from "./ManageAccountView";
import { YourActivityView } from "./YourActivityView";
import {
    fetchAccountGovernanceStatus,
    fetchPrivacyPreferences,
    updatePrivacyPreferences,
    fetchPlatformAboutMetadata,
    type GovernanceStatusResponse,
    type PlatformAboutMetadata,
    type PrivacyPreferences,
} from "../../api/settingsGovernanceApi";

interface SettingDetailViewProps {
    viewKey: SettingsViewKey;
    user: any;
    onBack: () => void;
    onSelectView: (view: SettingsViewKey) => void;
}

export const SettingDetailView: React.FC<SettingDetailViewProps> = ({
    viewKey,
    user,
    onBack,
    onSelectView,
}) => {
    const toast = useToast();
    const dispatch = useAppDispatch();
    const { blocked, connections } = useAppSelector((state) => state.network);

    const [unblockingId, setUnblockingId] = useState<string | null>(null);
    const [disconnectTarget, setDisconnectTarget] = useState<ConnectedUserItem | null>(null);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
    const [connectionsQuery, setConnectionsQuery] = useState("");
    const [connMenuId, setConnMenuId] = useState<string | null>(null);
    const [blockTarget, setBlockTarget] = useState<ConnectedUserItem | null>(null);
    const [isBlocking, setIsBlocking] = useState(false);

    useEffect(() => {
        if (viewKey === "blocked") {
            dispatch(fetchBlockedUsersThunk({ isInitial: true }));
        } else if (viewKey === "connections") {
            dispatch(fetchConnectionsThunk({ limit: 50, isInitial: true }));
        }
    }, [viewKey, dispatch]);

    // Local toggles for notification & security settings
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.isTwoFactorEnabled));

    useEffect(() => {
        setTwoFactorEnabled(Boolean(user?.isTwoFactorEnabled));
    }, [user?.isTwoFactorEnabled]);

    // 2FA Setup & Disable Modals State
    const [showTwoFactorSetupModal, setShowTwoFactorSetupModal] = useState(false);
    const [isSendingSetupOtp, setIsSendingSetupOtp] = useState(false);
    const [isVerifyingSetupOtp, setIsVerifyingSetupOtp] = useState(false);
    const [setupOtpDigits, setSetupOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [setupCooldownSeconds, setSetupCooldownSeconds] = useState(60);
    const [setupMaskedEmail, setSetupMaskedEmail] = useState("");
    const setupOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [showTwoFactorDisableModal, setShowTwoFactorDisableModal] = useState(false);
    const [disablePassword, setDisablePassword] = useState("");
    const [isDisabling2FA, setIsDisabling2FA] = useState(false);

    // Setup timer
    useEffect(() => {
        let timer: any = null;
        if (showTwoFactorSetupModal && setupCooldownSeconds > 0) {
            timer = setInterval(() => {
                setSetupCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [showTwoFactorSetupModal, setupCooldownSeconds]);

    const handleToggleTwoFactor = async (nextVal: boolean) => {
        if (nextVal) {
            setIsSendingSetupOtp(true);
            setShowTwoFactorSetupModal(true);
            setSetupOtpDigits(["", "", "", "", "", ""]);
            setSetupCooldownSeconds(60);
            try {
                const endpoints = ["http://localhost:3000/api/auth/2fa/setup/send-otp", "/api/auth/2fa/setup/send-otp"];
                let response: Response | null = null;
                let resultData: any = null;

                for (const url of endpoints) {
                    try {
                        const res = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                        });
                        response = res;
                        resultData = await res.json().catch(() => null);
                        break;
                    } catch {
                        continue;
                    }
                }

                if (!response || !response.ok) {
                    await toast.handleError(response, "Failed to send 2FA verification code.");
                    setShowTwoFactorSetupModal(false);
                    return;
                }

                setSetupMaskedEmail(resultData?.maskedEmail || user?.gmail || "your email");
                setSetupCooldownSeconds(resultData?.cooldownSeconds || 60);
                toast.info(`A 6-digit verification code has been sent to ${resultData?.maskedEmail || user?.gmail} via Resend.`, {
                    title: "2FA Verification Code",
                });
                setTimeout(() => {
                    setupOtpRefs.current[0]?.focus();
                }, 100);
            } catch (err: any) {
                await toast.handleError(err, "Failed to send 2FA setup verification code.");
                setShowTwoFactorSetupModal(false);
            } finally {
                setIsSendingSetupOtp(false);
            }
        } else {
            setDisablePassword("");
            setShowTwoFactorDisableModal(true);
        }
    };

    const handleResendSetupOtp = async () => {
        if (setupCooldownSeconds > 0 || isSendingSetupOtp) return;
        setIsSendingSetupOtp(true);
        try {
            const endpoints = ["http://localhost:3000/api/auth/2fa/setup/send-otp", "/api/auth/2fa/setup/send-otp"];
            let response: Response | null = null;
            let resultData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response || !response.ok) {
                await toast.handleError(response, "Failed to resend 2FA verification code.");
                return;
            }

            setSetupCooldownSeconds(resultData?.cooldownSeconds || 60);
            toast.success("A new verification code was sent to your email.", { title: "Code Resent" });
        } catch (err: any) {
            await toast.handleError(err, "Failed to resend 2FA code.");
        } finally {
            setIsSendingSetupOtp(false);
        }
    };

    const handleSetupOtpChange = (index: number, value: string) => {
        const cleanVal = value.replace(/\D/g, "");
        if (!cleanVal) {
            const updated = [...setupOtpDigits];
            updated[index] = "";
            setSetupOtpDigits(updated);
            return;
        }

        const digit = cleanVal.slice(-1);
        const updated = [...setupOtpDigits];
        updated[index] = digit;
        setSetupOtpDigits(updated);

        if (index < 5) {
            setupOtpRefs.current[index + 1]?.focus();
        }
    };

    const handleSetupOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !setupOtpDigits[index] && index > 0) {
            setupOtpRefs.current[index - 1]?.focus();
        }
    };

    const handleSetupOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;

        const updated = [...setupOtpDigits];
        for (let i = 0; i < 6; i++) {
            updated[i] = pasted[i] || "";
        }
        setSetupOtpDigits(updated);

        const nextFocusIndex = Math.min(pasted.length, 5);
        setupOtpRefs.current[nextFocusIndex]?.focus();
    };

    const handleConfirmEnable2FA = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = setupOtpDigits.join("");
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit verification code.", { title: "Incomplete Code" });
            return;
        }

        setIsVerifyingSetupOtp(true);
        try {
            const endpoints = ["http://localhost:3000/api/auth/2fa/setup/verify-otp", "/api/auth/2fa/setup/verify-otp"];
            let response: Response | null = null;
            let resultData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ otp: code }),
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response || !response.ok) {
                await toast.handleError(response, "Invalid or expired verification code.");
                return;
            }

            setTwoFactorEnabled(true);
            if (user) {
                dispatch(setUser({
                    ...user,
                    isTwoFactorEnabled: true,
                    twoFactorEnabledAt: resultData?.twoFactorEnabledAt || new Date().toISOString(),
                }));
            }
            setShowTwoFactorSetupModal(false);
            toast.success("Two-Factor Authentication is now enabled on your account!", {
                title: "2FA Activated",
            });
        } catch (err: any) {
            await toast.handleError(err, "Failed to activate Two-Factor Authentication.");
        } finally {
            setIsVerifyingSetupOtp(false);
        }
    };

    const handleConfirmDisable2FA = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsDisabling2FA(true);
        try {
            const endpoints = ["http://localhost:3000/api/auth/2fa/disable", "/api/auth/2fa/disable"];
            let response: Response | null = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ password: disablePassword }),
                    });
                    response = res;
                    break;
                } catch {
                    continue;
                }
            }

            if (!response || !response.ok) {
                await toast.handleError(response, "Incorrect password or unable to disable 2FA.");
                return;
            }

            setTwoFactorEnabled(false);
            if (user) {
                dispatch(setUser({
                    ...user,
                    isTwoFactorEnabled: false,
                    twoFactorEnabledAt: null,
                }));
            }
            setShowTwoFactorDisableModal(false);
            setDisablePassword("");
            toast.success("Two-Factor Authentication has been disabled.", {
                title: "2FA Disabled",
            });
        } catch (err: any) {
            await toast.handleError(err, "Failed to disable Two-Factor Authentication.");
        } finally {
            setIsDisabling2FA(false);
        }
    };
    const [pushNotifications, setPushNotifications] = useState(true);
    const [emailContestAlerts, setEmailContestAlerts] = useState(true);
    const [recruiterMessages, setRecruiterMessages] = useState(true);
    const [weeklyDigest, setWeeklyDigest] = useState(false);
    const [telemetryEnabled, setTelemetryEnabled] = useState(false);
    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

    // Dynamic settings governance & platform metadata
    const [governanceData, setGovernanceData] = useState<GovernanceStatusResponse | null>(null);
    const [isLoadingGovernance, setIsLoadingGovernance] = useState(false);
    const [, setPrivacyPrefs] = useState<PrivacyPreferences | null>(null);
    const [platformMetadata, setPlatformMetadata] = useState<PlatformAboutMetadata | null>(null);

    useEffect(() => {
        if (viewKey === "account-status") {
            setIsLoadingGovernance(true);
            fetchAccountGovernanceStatus()
                .then((data) => setGovernanceData(data))
                .catch((err) => console.warn("[Governance] Fetch status warning:", err?.message))
                .finally(() => setIsLoadingGovernance(false));
        } else if (viewKey === "privacy-center") {
            fetchPrivacyPreferences()
                .then((data) => {
                    setPrivacyPrefs(data.preferences);
                    if (typeof data.preferences.anonymousTelemetry === "boolean") {
                        setTelemetryEnabled(data.preferences.anonymousTelemetry);
                    }
                })
                .catch((err) => console.warn("[Privacy] Fetch prefs warning:", err?.message));
        } else if (viewKey === "about") {
            fetchPlatformAboutMetadata()
                .then((data) => setPlatformMetadata(data))
                .catch((err) => console.warn("[Platform] Fetch metadata warning:", err?.message));
        }
    }, [viewKey]);

    const handleToggleTelemetry = async (val: boolean) => {
        setTelemetryEnabled(val);
        setIsUpdatingPrivacy(true);
        try {
            await updatePrivacyPreferences({ anonymousTelemetry: val });
            toast.info(val ? "Anonymous telemetry enabled. Thank you!" : "Anonymous telemetry disabled.");
        } catch (err: any) {
            setTelemetryEnabled(!val); // revert on error
            toast.error(err.message || "Failed to save privacy preference.");
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

    // Password fields
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword) {
            toast.error("Please fill in both current and new password.", { title: "Password Error" });
            return;
        }
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.", { title: "Weak Password" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("New passwords do not match.", { title: "Mismatch" });
            return;
        }
        setIsSavingPassword(true);
        try {
            const res = await fetch("/api/settings/manage-account/password/change", {
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
                throw new Error(data?.message || "Failed to update password.");
            }
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success(data?.message || "Password updated successfully.", { title: "Security Updated" });
        } catch (err: any) {
            toast.error(err?.message || "Failed to update password. Please check your current password.", { title: "Update Failed" });
        } finally {
            setIsSavingPassword(false);
        }
    };

    const handleCopyInviteLink = () => {
        const link = `${window.location.origin}/signup?ref=${encodeURIComponent(user?.username || "dev")}`;
        navigator.clipboard.writeText(link);
        toast.success("Referral & invite link copied to clipboard!", { title: "Copied" });
    };

    // Render individual view based on viewKey
    const renderContent = () => {
        switch (viewKey) {
            case "verify-account":
                return (
                    <div className="space-y-6">
                        {/* Primary Email Verification Centralized Hub Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000]">
                                        <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Account Email Security</span>
                                    </div>
                                    <h3 className="text-xl font-black text-black">
                                        Primary Email Verification & Management
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Primary email verification, cryptographic OTP challenges, and 2-step email changes are centrally managed in Manage Accounts.
                                    </p>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded-xl text-xs font-black uppercase border-2 border-black shrink-0 shadow-[2px_2px_0px_#000] ${
                                        user?.isEmailVerified
                                            ? "bg-[#a2ff86] text-black"
                                            : "bg-amber-100 text-amber-900 border-amber-300"
                                    }`}
                                >
                                    {user?.isEmailVerified ? "Verified" : "Unverified"}
                                </span>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <p className="text-[11px] font-black uppercase text-neutral-500 font-bold">Registered Primary Email</p>
                                    <p className="text-sm font-mono font-bold text-black">{user?.gmail || user?.email || "No email on record"}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSelectView("manage-account")}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
                                >
                                    <span>Manage Email in Account Center</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case "password-security":
                return (
                    <div className="space-y-6">
                        {/* Change Password Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">Change Password</h3>
                                <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                    Ensure your password uses at least 8 characters with a mix of numbers and letters.
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
                                    Protect your Orbix account with verified email OTP. Whenever you sign in, a single-use 6-digit code will be sent to your registered email (<span className="font-mono font-bold text-black">{user?.gmail || "account email"}</span>) via Resend.
                                </p>
                            </div>

                            <NeoToggle
                                checked={twoFactorEnabled}
                                onChange={handleToggleTwoFactor}
                                onStatusText="2FA: Enabled"
                                offStatusText="2FA: Disabled"
                                ariaLabel="Toggle two-factor authentication"
                            />
                        </div>

                        {/* Active Sessions & Your Activity Portal Card */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
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
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black text-[10px] font-black border border-black self-start sm:self-auto">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse" />
                                    <span>Real-Time Tracking</span>
                                </span>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-xs font-black text-black">Active Device Authentication Pipeline</p>
                                        <span className="px-2 py-0.5 rounded-md bg-white border border-black text-[10px] font-bold text-neutral-800">
                                            Canonical SSO & 2FA
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Monitor authenticated hardware fingerprints, review security alerts, or log out of all other devices remotely with zero latency.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onSelectView("your-activity")}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-0.5 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer shrink-0"
                                >
                                    <span>Manage All Devices</span>
                                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case "manage-account":
                return <ManageAccountView user={user} onBack={onBack} />;

            case "saved":
                return (
                    <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <Bookmark className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>
                        <div className="space-y-1.5 max-w-md mx-auto">
                            <h3 className="text-xl font-black text-black">Saved Bookmarks</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Save challenging algorithmic problems, starred repositories, and bookmarked articles to review them here anytime.
                            </p>
                        </div>
                        <Link
                            to="/leaderboard"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer"
                        >
                            <span>Explore Leaderboard Coders</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                );

            case "your-activity":
                return <YourActivityView />;

            case "notifications":
                return (
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-black">Notification Preferences</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Choose which alerts, platform updates, and contest reminders you want to receive.
                            </p>
                        </div>

                        <div className="space-y-4 pt-1">
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Push Notifications</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Receive real-time in-browser alerts for submissions and rank updates.</p>
                                </div>
                                <NeoToggle
                                    checked={pushNotifications}
                                    onChange={(v) => {
                                        setPushNotifications(v);
                                        toast.info(`Push notifications ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle push notifications"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Upcoming Contest Reminders</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Get reminders 2 hours before registered competitive programming contests.</p>
                                </div>
                                <NeoToggle
                                    checked={emailContestAlerts}
                                    onChange={(v) => {
                                        setEmailContestAlerts(v);
                                        toast.info(`Contest reminders ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle contest reminders"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Recruiter Inquiries & Messages</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Notifications when a verified recruiter contacts you through your profile.</p>
                                </div>
                                <NeoToggle
                                    checked={recruiterMessages}
                                    onChange={(v) => {
                                        setRecruiterMessages(v);
                                        toast.info(`Recruiter alerts ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle recruiter messages"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-black text-black">Weekly Developer Digest</p>
                                    <p className="text-[11px] text-neutral-600 font-medium">Summary of top campus coders, trending technologies, and leaderboard shifts.</p>
                                </div>
                                <NeoToggle
                                    checked={weeklyDigest}
                                    onChange={(v) => {
                                        setWeeklyDigest(v);
                                        toast.info(`Weekly digest ${v ? "enabled" : "disabled"}.`);
                                    }}
                                    ariaLabel="Toggle weekly digest"
                                />
                            </div>
                        </div>
                    </div>
                );

            case "blocked": {
                const handleUnblock = async (blockedId: string, username: string) => {
                    setUnblockingId(blockedId);
                    try {
                        const action = await dispatch(unblockUserThunk(blockedId));
                        if (unblockUserThunk.fulfilled.match(action)) {
                            toast.success(`User @${username} unblocked successfully.`);
                        } else {
                            toast.error((action.payload as string) || "Could not unblock user.");
                        }
                    } catch (err: any) {
                        toast.error(err.message || "Failed to unblock user.");
                    } finally {
                        setUnblockingId(null);
                    }
                };

                return (
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-rose-100 border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <UserX className="w-5 h-5 text-rose-700 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-black">Blocked Accounts</h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Blocked users cannot view your full analytics, send recruiter messages, or connect with your profile.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {blocked.isLoading ? (
                            <div className="py-16 text-center space-y-3">
                                <Loader2 className="w-7 h-7 text-black animate-spin mx-auto" />
                                <p className="text-xs font-bold text-neutral-500">Loading blocked accounts...</p>
                            </div>
                        ) : blocked.items.length === 0 ? (
                            <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                                <div className="w-14 h-14 rounded-2xl bg-rose-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                    <UserX className="w-7 h-7 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1.5 max-w-md mx-auto">
                                    <h3 className="text-xl font-black text-black">No Blocked Accounts</h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        You have not blocked any accounts. Any users you block from Explore or messages will appear here.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {blocked.items.map((b) => (
                                    <div
                                        key={b.id}
                                        className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img
                                                src={b.avatarUrl || DEFAULT_AVATAR_URL}
                                                alt={b.displayName}
                                                className="w-11 h-11 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <h4 className="font-black text-sm text-black truncate">{b.displayName}</h4>
                                                <p className="text-xs font-mono font-bold text-neutral-500 truncate">@{b.username}</p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleUnblock(b.blockedId, b.username)}
                                            disabled={unblockingId === b.blockedId}
                                            className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                                        >
                                            {unblockingId === b.blockedId ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <UserCheck className="w-3.5 h-3.5" />
                                            )}
                                            <span>Unblock</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            case "connections": {
                const filteredConn = connections.items.filter((c) => {
                    if (!connectionsQuery.trim()) return true;
                    const q = connectionsQuery.trim().toLowerCase();
                    return (
                        c.username.toLowerCase().includes(q) ||
                        c.displayName.toLowerCase().includes(q) ||
                        (c.college && c.college.toLowerCase().includes(q))
                    );
                });

                const handleConfirmDisconnect = async () => {
                    if (!disconnectTarget) return;
                    const target = disconnectTarget;
                    setDisconnectTarget(null);
                    setDisconnectingId(target.relationshipId);
                    try {
                        const action = await dispatch(
                            removeConnectionThunk({
                                relationshipId: target.relationshipId,
                                targetUserId: target.connectedUserId,
                            })
                        );
                        if (removeConnectionThunk.fulfilled.match(action)) {
                            toast.info(`Disconnected from @${target.username}.`);
                        } else {
                            toast.error((action.payload as string) || "Failed to remove connection.");
                        }
                    } catch (err: any) {
                        toast.error(err.message || "Failed to remove connection.");
                    } finally {
                        setDisconnectingId(null);
                    }
                };

                const handleConfirmBlock = async () => {
                    if (!blockTarget) return;
                    const target = blockTarget;
                    setIsBlocking(true);
                    try {
                        const action = await dispatch(
                            blockUserThunk({
                                targetUserId: target.connectedUserId || target.username,
                                reason: "Blocked from settings connections card menu",
                                userPreview: {
                                    username: target.username,
                                    displayName: target.displayName,
                                    avatarUrl: target.avatarUrl,
                                    headline: target.headline,
                                },
                            })
                        );
                        if (blockUserThunk.fulfilled.match(action)) {
                            toast.success(`User @${target.username} has been blocked.`);
                            setBlockTarget(null);
                        } else {
                            toast.error((action.payload as string) || "Could not block user.");
                        }
                    } catch (err: any) {
                        toast.error(err.message || "Failed to block user.");
                    } finally {
                        setIsBlocking(false);
                    }
                };

                return (
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-black text-black">Developer Connections</h3>
                                        <span className="px-2.5 py-0.5 rounded-full bg-[#FFE566] text-black font-mono font-bold text-xs border border-black shadow-[1px_1px_0px_#000]">
                                            {connections.totalCount} Active
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Connect with coding peers, campus teammates, and mentors across institutions.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopyInviteLink}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer shrink-0"
                                >
                                    <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Copy Invite Link</span>
                                </button>
                            </div>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <p className="text-xs font-black text-black uppercase tracking-wider">Campus Directory</p>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    {user?.college?.officialName
                                        ? `Coders from ${user.college.officialName} automatically connect in the College League.`
                                        : "Link your verified college to automatically discover fellow student developers."}
                                </p>
                            </div>
                        </div>

                        {/* Connections Search & List */}
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 stroke-[2.5]" />
                                <input
                                    type="text"
                                    value={connectionsQuery}
                                    onChange={(e) => setConnectionsQuery(e.target.value)}
                                    placeholder="Search your connections by name, @handle, or college..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none shadow-[2px_2px_0px_#000]"
                                />
                            </div>

                            {connections.isLoading ? (
                                <div className="py-16 text-center space-y-3">
                                    <Loader2 className="w-7 h-7 text-black animate-spin mx-auto" />
                                    <p className="text-xs font-bold text-neutral-500">Loading connections...</p>
                                </div>
                            ) : filteredConn.length === 0 ? (
                                <div className="p-8 text-center rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                    <p className="text-sm font-black text-black">
                                        {connectionsQuery ? "No matching connections found." : "No active connections yet."}
                                    </p>
                                    <p className="text-xs text-neutral-500 font-medium">
                                        Browse the Explore section to send connection requests to verified peers.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredConn.map((c) => (
                                        <div
                                            key={c.relationshipId}
                                            className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <img
                                                    src={c.avatarUrl || DEFAULT_AVATAR_URL}
                                                    alt={c.displayName}
                                                    className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="font-black text-sm text-black truncate">{c.displayName}</h4>
                                                        {c.isVerifiedCoder && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                                    </div>
                                                    <p className="text-xs font-mono font-bold text-neutral-500 truncate">@{c.username}</p>
                                                    {c.headline && (
                                                        <p className="text-xs font-bold text-neutral-700 truncate mt-0.5">{c.headline}</p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] font-bold text-neutral-600">
                                                        {c.college && (
                                                            <span className="truncate flex items-center gap-1">
                                                                <GraduationCap className="w-3 h-3 text-black shrink-0" />
                                                                {c.college}
                                                            </span>
                                                        )}
                                                        {c.location && (
                                                            <span className="truncate flex items-center gap-1">
                                                                <MapPin className="w-3 h-3 text-black shrink-0" />
                                                                {c.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {c.skills && c.skills.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {c.skills.slice(0, 3).map((s, idx) => (
                                                                <span key={idx} className="px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black/30 text-[9px] font-mono font-bold text-neutral-800">
                                                                    {s}
                                                                </span>
                                                            ))}
                                                            {c.skills.length > 3 && (
                                                                <span className="px-1 py-0.5 rounded bg-neutral-100 text-[9px] font-mono font-bold text-neutral-500">
                                                                    +{c.skills.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setDisconnectTarget(c)}
                                                    disabled={disconnectingId === c.relationshipId}
                                                    className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-rose-50 text-neutral-800 hover:text-rose-700 font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                                                    title="Disconnect"
                                                >
                                                    {disconnectingId === c.relationshipId ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <UserMinus className="w-3.5 h-3.5 stroke-[2]" />
                                                    )}
                                                    <span>Disconnect</span>
                                                </button>

                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setConnMenuId(connMenuId === c.relationshipId ? null : c.relationshipId)}
                                                        className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-all flex items-center justify-center"
                                                        title="More actions"
                                                        aria-label="More actions"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    </button>

                                                    {connMenuId === c.relationshipId && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-30 cursor-default"
                                                                onClick={() => setConnMenuId(null)}
                                                            />
                                                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] p-1.5 z-40 text-left">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setConnMenuId(null);
                                                                        setBlockTarget(c);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-left cursor-pointer"
                                                                >
                                                                    <UserX className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                    <span>Block Account</span>
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal: Confirm Disconnect */}
                        <ConfirmationModal
                            isOpen={!!disconnectTarget}
                            title="Disconnect with Developer"
                            message={`Are you sure you want to remove @${disconnectTarget?.username || "this developer"} from your connections?`}
                            confirmLabel="Disconnect"
                            variant="danger"
                            onConfirm={handleConfirmDisconnect}
                            onCancel={() => setDisconnectTarget(null)}
                        />

                        {/* Modal: Confirm Block */}
                        <ConfirmationModal
                            isOpen={!!blockTarget}
                            title={`Block @${blockTarget?.username || "Developer"}`}
                            message={`Are you sure you want to block @${blockTarget?.username || "this developer"}? They will be removed from your connections and will not be able to interact with you.`}
                            confirmLabel="Block Account"
                            variant="danger"
                            isLoading={isBlocking}
                            onConfirm={handleConfirmBlock}
                            onCancel={() => !isBlocking && setBlockTarget(null)}
                        />
                    </div>
                );
            }

            case "comments":
                return (
                    <div className="p-8 sm:p-12 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <MessageSquare className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>
                        <div className="space-y-1.5 max-w-md mx-auto">
                            <h3 className="text-xl font-black text-black">Discussions & Comments</h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Review your comments, question responses, and technical discussion replies across blogs and events.
                            </p>
                        </div>
                        <p className="text-xs font-mono font-bold text-neutral-500">
                            Zero active moderation flags on your discussions.
                        </p>
                    </div>
                );

            case "help":
                return <HelpCenterView user={user} onBack={onBack} />;

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
                                                Orbix Privacy Center
                                            </h3>
                                            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-black text-[#a2ff86] text-[10px] font-black uppercase font-mono tracking-wider">
                                                Developer First
                                            </span>
                                        </div>
                                        <p className="text-xs font-mono font-bold text-neutral-600 mt-1">
                                            Zero telemetry selling • Complete data ownership • Encrypted transmission
                                        </p>
                                    </div>
                                </div>
                                <Link
                                    to="/docs/public-vs-private-profile"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] self-start sm:self-auto cursor-pointer"
                                >
                                    <span>Privacy Architecture Docs</span>
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                </Link>
                            </div>

                            <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                At Orbix, we believe developer data belongs strictly to developers. Your competitive metrics, problem solutions, open-source repositories, and resume documents are used exclusively to build your verified engineering identity and power community leaderboards. We never monetize, package, or sell your personal data.
                            </p>
                        </div>

                        {/* Four Core Privacy Pillars */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <Lock className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Zero Commercial Reselling</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Orbix will never sell your contact credentials, profile analytics, or coding activity to third-party advertisers, data aggregators, or unsolicited recruiter lists.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-sky-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <Globe className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Public vs. Private Gating</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Switching your account to Private immediately de-indexes your public showcase, masks leaderboard rankings, and blocks direct recruiter inquiries with zero latency.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Resume Fact Confidentiality</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Resumes uploaded for ATS audit are processed securely with deterministic fact provenance. Extracted details remain private until you explicitly choose to publish them.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-purple-200 border-2 border-black flex items-center justify-center shrink-0">
                                        <RefreshCw className="w-4 h-4 text-black stroke-[2.5]" />
                                    </div>
                                    <h4 className="text-sm font-black text-black">Data Portability & Erasure</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    You retain total ownership over your data. Request an export of all synced achievements, or initiate complete, permanent account deletion from Manage Account.
                                </p>
                            </div>
                        </div>

                        {/* Interactive Privacy Preferences & Quick Navigation */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h4 className="text-sm font-black uppercase tracking-wider text-black">
                                Privacy Preferences & Profile Controls
                            </h4>

                            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-black text-black">Anonymous Diagnostics & Performance Telemetry</p>
                                        {isUpdatingPrivacy && <Loader2 className="w-3.5 h-3.5 text-neutral-500 animate-spin" />}
                                    </div>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Help optimize Orbix by sharing anonymous latency and client crash logs. No personal data, handles, or source code are ever recorded.
                                    </p>
                                </div>
                                <NeoToggle
                                    checked={telemetryEnabled}
                                    onChange={handleToggleTelemetry}
                                    ariaLabel="Toggle telemetry"
                                />
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t-2 border-black/10">
                                <p className="text-xs text-neutral-600 font-medium">
                                    Looking to hide your profile, manage visibility flags, or adjust recruiter contact permissions?
                                </p>
                                <button
                                    type="button"
                                    onClick={() => onSelectView("account-privacy")}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
                                >
                                    <span>Profile Privacy Controls</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                );

            case "account-status": {
                const standing = governanceData?.standing;
                const statusType = standing?.status || "good";
                const activeStrikes = standing?.conduct?.activeStrikes ?? 0;
                const connectedPortals = standing?.syncHealth?.connectedPlatformsCount ?? 16;
                const safeguard = standing?.collegiateSafeguard;
                const activeRestrictions = governanceData?.activeRestrictions || [];

                return (
                    <div className="space-y-6">
                        {/* Active Restrictions Banner if any */}
                        {activeRestrictions.length > 0 && (
                            <div className="p-5 rounded-2xl bg-rose-50 border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2 text-rose-700">
                                    <UserX className="w-5 h-5 stroke-[2.5]" />
                                    <h4 className="text-sm font-black uppercase tracking-wider">
                                        Active Account Restriction
                                    </h4>
                                </div>
                                {activeRestrictions.map((r, idx) => (
                                    <div key={idx} className="text-xs text-neutral-700 space-y-1">
                                        <p className="font-bold">
                                            Restriction: <span className="font-mono text-black">{r.restrictionType}</span>
                                        </p>
                                        <p className="font-medium">{r.reason}</p>
                                        {r.expiresAt && (
                                            <p className="text-[11px] font-mono text-neutral-500">
                                                Expires: {new Date(r.expiresAt).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Standing Hero */}
                        <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-5">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                            Account Standing
                                        </h3>
                                        {isLoadingGovernance ? (
                                            <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
                                        ) : statusType === "good" ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Good Standing</span>
                                            </span>
                                        ) : statusType === "cooldown" ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Cooldown Active</span>
                                            </span>
                                        ) : statusType === "warning" || statusType === "probation" ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <span>Under Review</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-200 text-rose-900 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                                                <span>Restricted</span>
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Overall platform health, security status, and developer privileges.
                                    </p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500 block">
                                        Developer ID
                                    </span>
                                    <span className="text-xs font-black text-black font-mono">
                                        @{user?.username || "developer"}
                                    </span>
                                </div>
                            </div>

                            {/* Trust & Health Indicators */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Community Conduct
                                    </span>
                                    <p className={`text-sm font-black flex items-center gap-1.5 ${activeStrikes === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                                        <Check className="w-4 h-4 stroke-[3]" />
                                        {activeStrikes === 0 ? "100% Compliant" : `${activeStrikes} Active Strike${activeStrikes > 1 ? "s" : ""}`}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {activeStrikes === 0 ? "Zero active moderation warnings or strikes" : "Conduct under administrative review"}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Platform Sync Status
                                    </span>
                                    <p className="text-sm font-black text-black flex items-center gap-1.5">
                                        <RefreshCw className="w-4 h-4 stroke-[2.5] text-sky-600" />
                                        {standing?.syncHealth?.status === "healthy" || !standing ? "Active & Healthy" : "Partial Sync"}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        Automatic daily sync across {connectedPortals} supported portal{connectedPortals !== 1 ? "s" : ""}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Account Security
                                    </span>
                                    <p className="text-sm font-black text-black flex items-center gap-1.5">
                                        <ShieldCheck className="w-4 h-4 stroke-[2.5] text-emerald-600" />
                                        {standing?.securityLevel?.level || (twoFactorEnabled ? "2FA Enabled" : "Standard Protection")}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {standing?.securityLevel?.twoFactorActive || twoFactorEnabled
                                            ? "Two-factor authentication active"
                                            : "Verified email credential"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Entitlements & Capabilities */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h4 className="text-sm font-black uppercase tracking-wider text-black">
                                Platform Capabilities & Quotas
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Global & College Leaderboards
                                    </p>
                                    <p className="text-base font-black text-black">
                                        {governanceData?.capabilities?.leaderboards?.label || "Eligible & Ranked"}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {governanceData?.capabilities?.leaderboards?.description ||
                                            "Real-time percentile ranking, tier badges, and college standings"}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Developer Showcase & Card Studio
                                    </p>
                                    <p className="text-base font-black text-black">
                                        {governanceData?.capabilities?.cardStudio?.label || "Full Access"}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {governanceData?.capabilities?.cardStudio?.description ||
                                            "Custom public URL, interactive 3D card export, and SVG profile embeds"}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Resume Intelligence Engine
                                    </p>
                                    <p className="text-base font-black text-black">
                                        {governanceData?.capabilities?.resumeIntelligence?.label || "Unlimited Audits"}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {governanceData?.capabilities?.resumeIntelligence?.description ||
                                            "7-dimension deterministic ATS scoring & fact provenance extraction"}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider font-mono text-neutral-500">
                                        Platform Sync Rate
                                    </p>
                                    <p className="text-base font-black text-black">
                                        {governanceData?.capabilities?.syncCadence?.label || "Automated + Live Refresh"}
                                    </p>
                                    <p className="text-[11px] text-neutral-600 font-medium">
                                        {governanceData?.capabilities?.syncCadence?.description ||
                                            "Daily background updates plus manual on-demand synchronization"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard Integrity Safeguard Notice */}
                        <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-start gap-3">
                            <GraduationCap className="w-5 h-5 text-black shrink-0 mt-0.5" />
                            <div className="space-y-0.5 text-xs">
                                <p className="font-black text-black">
                                    {safeguard?.isOnCooldown ? "Collegiate Verification Cooldown Active" : "Collegiate Fair-Play Safeguard"}
                                </p>
                                <p className="text-neutral-600 font-medium leading-relaxed">
                                    {safeguard?.isOnCooldown
                                        ? `Your college affiliation change is subject to a 72-hour integrity cooldown. Approximately ${safeguard.remainingCooldownHours} hour(s) remaining. Anti-cheat algorithmic bounding ensures all contest milestones remain genuine.`
                                        : "To protect seasonal leaderboard integrity and university rankings, college affiliation changes are subject to a 3-day verification cooldown. Anti-cheat algorithmic bounding ensures all contest milestones remain genuine."}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            }

            case "about": {
                const p = platformMetadata?.platform;
                const versionString = p
                    ? `Version ${p.version} (${p.edition} • Build ${p.buildNumber})`
                    : "Version 2.4.0 (Titan Edition • Build 2026.10)";
                const channelLabel = p?.channel ? `${p.channel.toUpperCase()} RELEASE` : "OFFICIAL RELEASE";
                const supportedPortalsCount = platformMetadata?.ecosystemStats?.supportedPortals || 16;

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
                                            Orbix Platform
                                        </h3>
                                        <p className="text-xs font-mono font-bold text-neutral-600 mt-1">
                                            {versionString}
                                        </p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#a2ff86] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] self-start sm:self-auto">
                                    {channelLabel}
                                </span>
                            </div>

                            <div className="space-y-3 text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                <p>
                                    Orbix is the unified developer identity and competitive analytics ecosystem designed for software engineers, student clubs, and tech hiring teams worldwide.
                                </p>
                                <p>
                                    In an era where developer talent is fragmented across dozens of coding portals, contest hubs, and code repositories, Orbix provides a single, mathematically verified proof of work. Through deterministic benchmarking, transparent skill provenance, and collegiate community infrastructure, Orbix transforms individual practice into tangible engineering credibility.
                                </p>
                            </div>
                        </div>

                        {/* Four Canonical Pillars */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Deterministic Scoring Engine</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    A calibrated 0 to 10,000 Orbix Score evaluating algorithmic problem solving, contest ratings, active streaks, and verified open-source contributions with anti-cheat bounding.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFE566] border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">{supportedPortalsCount} Connected Developer Portals</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Native multi-platform synchronization across LeetCode, Codeforces, GitHub, CodeChef, AtCoder, HackerRank, GeeksforGeeks, Kaggle, and other genuine engineering portals.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-300 border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Collegiate Leaderboard Network</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Inter-university rankings and dedicated governance infrastructure for student chapters, coding societies, and campus hackathons nationwide.
                                </p>
                            </div>

                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-300 border border-black inline-block" />
                                    <h4 className="text-sm font-black text-black">Resume Intelligence & Fact Provenance</h4>
                                </div>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    Multi-stage AST parsing, deterministic 7-dimension ATS scoring, and explicit skill verification connecting resume claims with verified coding data.
                                </p>
                            </div>
                        </div>

                        {/* Documentation, Legal & Credits */}
                        <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <h4 className="text-sm font-black uppercase tracking-wider text-black">
                                Platform Architecture & Documentation
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold">
                                <Link
                                    to="/docs/orbix-score-algorithm"
                                    className="p-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000] text-black"
                                >
                                    <span>Scoring Algorithm</span>
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
                                    to="/docs/public-vs-private-profile"
                                    className="p-3 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_#000] text-black"
                                >
                                    <span>Privacy Controls</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            <div className="pt-4 border-t-2 border-black/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-neutral-600 font-medium">
                                <div className="flex flex-wrap items-center gap-3 font-bold text-black">
                                    <Link to="/docs" className="hover:underline">Documentation</Link>
                                    <span>•</span>
                                    <Link to="/events" className="hover:underline">Events Calendar</Link>
                                    <span>•</span>
                                    <Link to="/leaderboard" className="hover:underline">Leaderboard</Link>
                                    <span>•</span>
                                    <Link to="/blogs" className="hover:underline">Engineering Blog</Link>
                                </div>
                                <span className="font-mono text-[11px] text-neutral-500">
                                    Proprietary © {new Date().getFullYear()} Orbix Inc. All rights reserved.
                                </span>
                            </div>
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    const getViewTitle = () => {
        switch (viewKey) {
            case "verify-account": return "Verify Account";
            case "password-security": return "Password and Security";
            case "manage-account": return "Manage Account";
            case "saved": return "Saved";
            case "your-activity": return "Your Activity";
            case "notifications": return "Notifications";
            case "blocked": return "Blocked Accounts";
            case "connections": return "Connections";
            case "comments": return "Comments";
            case "help": return "Help Center";
            case "privacy-center": return "Privacy Center";
            case "account-status": return "Account Status";
            case "about": return "About";
            default: return "Setting";
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
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

            {renderContent()}

            {/* Two-Factor Authentication Setup Modal */}
            {showTwoFactorSetupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-6 space-y-5 animate-scaleUp">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                    <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Enable Two-Factor Auth
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Email OTP via Resend
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTwoFactorSetupModal(false)}
                                className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        {/* Notice & Masked Email */}
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1">
                            <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                                We sent a 6-digit confirmation code to:
                            </p>
                            <p className="font-mono font-black text-sm text-black">
                                {setupMaskedEmail || user?.gmail || "your email"}
                            </p>
                            <p className="text-[11px] text-neutral-500 font-medium pt-1">
                                Enter the code below within 10 minutes to verify and activate 2FA.
                            </p>
                        </div>

                        {/* 6-digit OTP Inputs */}
                        <form onSubmit={handleConfirmEnable2FA} className="space-y-4">
                            <div className="flex justify-between items-center gap-1.5 sm:gap-2">
                                {setupOtpDigits.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => {
                                            setupOtpRefs.current[idx] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleSetupOtpChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleSetupOtpKeyDown(idx, e)}
                                        onPaste={handleSetupOtpPaste}
                                        className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono font-black text-xl sm:text-2xl rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-all select-all"
                                        autoFocus={idx === 0}
                                    />
                                ))}
                            </div>

                            {/* Resend Cooldown */}
                            <div className="flex items-center justify-end text-xs">
                                <button
                                    type="button"
                                    onClick={handleResendSetupOtp}
                                    disabled={setupCooldownSeconds > 0 || isSendingSetupOtp}
                                    className="inline-flex items-center gap-1 font-black text-black hover:text-neutral-800 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isSendingSetupOtp ? "animate-spin" : ""}`} />
                                    <span>
                                        {setupCooldownSeconds > 0
                                            ? `Resend code in ${setupCooldownSeconds}s`
                                            : "Resend Code"}
                                    </span>
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowTwoFactorSetupModal(false)}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-white border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isVerifyingSetupOtp || setupOtpDigits.join("").length !== 6}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-black border-2 border-black text-[#a2ff86] font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isVerifyingSetupOtp ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                        <span>Activate 2FA</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Two-Factor Authentication Disable Confirmation Modal */}
            {showTwoFactorDisableModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-6 space-y-5 animate-scaleUp">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#ff8686] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                    <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Disable Two-Factor Auth
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Account Security Check
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowTwoFactorDisableModal(false);
                                    setDisablePassword("");
                                }}
                                className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1.5">
                            <p className="text-xs text-neutral-800 font-bold leading-relaxed">
                                Are you sure you want to turn off Two-Factor Authentication?
                            </p>
                            <p className="text-[11px] text-neutral-600 font-medium">
                                Your account will no longer require a 6-digit email OTP during sign-in, which may reduce account security.
                            </p>
                        </div>

                        {/* Password confirmation form */}
                        <form onSubmit={handleConfirmDisable2FA} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-wider text-black">
                                    Confirm Account Password
                                </label>
                                <input
                                    type="password"
                                    value={disablePassword}
                                    onChange={(e) => setDisablePassword(e.target.value)}
                                    placeholder="Enter your current password"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000]"
                                    autoFocus
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowTwoFactorDisableModal(false);
                                        setDisablePassword("");
                                    }}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-white border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isDisabling2FA}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#ff8686] border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-[#ff7070] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isDisabling2FA ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Disabling...</span>
                                        </>
                                    ) : (
                                        <span>Turn Off 2FA</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
