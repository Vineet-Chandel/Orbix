import React, { useState, useEffect, useRef } from "react";
import {
    ShieldCheck,
    Mail,
    Send,
    CheckCircle2,
    Clock,
    AlertCircle,
    RefreshCw,
    KeyRound,
    Check,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch } from "../../store";
import { setEmailVerified } from "../../store/userSlice";
import {
    fetchVerificationStatus,
    sendVerificationOtp,
    verifyEmailOtp,
} from "../../api/verificationApi";

interface EmailVerificationSectionProps {
    user: any;
}

export const EmailVerificationSection: React.FC<EmailVerificationSectionProps> = ({ user }) => {
    const toast = useToast();
    const dispatch = useAppDispatch();
    const registeredEmail = user?.gmail || user?.email || "";

    const [isEmailVerified, setIsEmailVerified] = useState<boolean>(
        Boolean(user?.isEmailVerified)
    );
    const [verifiedAt, setVerifiedAt] = useState<string | null>(
        user?.emailVerifiedAt || null
    );

    // Flow states
    const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
    const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
    const [isVerifying, setIsVerifying] = useState<boolean>(false);
    const [hasSentOtp, setHasSentOtp] = useState<boolean>(false);
    const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSimulated, setIsSimulated] = useState<boolean>(false);
    const [devOtp, setDevOtp] = useState<string | null>(null);

    // 6-digit OTP code state
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Load initial verification status from server on mount
    useEffect(() => {
        let isMounted = true;

        const loadStatus = async () => {
            try {
                const data = await fetchVerificationStatus();
                if (!isMounted) return;

                if (data.isEmailVerified) {
                    setIsEmailVerified(true);
                    setVerifiedAt(data.emailVerifiedAt);
                }
                if (data.cooldownRemainingSeconds > 0) {
                    setCooldownSeconds(data.cooldownRemainingSeconds);
                    setHasSentOtp(true);
                } else if (data.hasPendingOtp) {
                    setHasSentOtp(true);
                }
                if (data.simulated) {
                    setIsSimulated(true);
                }
                if (data.devOtp) {
                    setDevOtp(data.devOtp);
                }
            } catch {
                // If API is loading or fails, fallback to user object from Redux
                if (isMounted && user?.isEmailVerified) {
                    setIsEmailVerified(true);
                    setVerifiedAt(user.emailVerifiedAt || null);
                }
            } finally {
                if (isMounted) setIsLoadingStatus(false);
            }
        };

        loadStatus();
        return () => {
            isMounted = false;
        };
    }, [user?.isEmailVerified, user?.emailVerifiedAt]);

    // Live countdown timer for OTP resend cooldown
    useEffect(() => {
        if (cooldownSeconds <= 0) return;
        const interval = setInterval(() => {
            setCooldownSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [cooldownSeconds]);

    // Handle single-digit input change with automatic jump to next box
    const handleDigitChange = (index: number, value: string) => {
        const sanitized = value.replace(/\D/g, "");
        if (!sanitized) {
            const next = [...otpDigits];
            next[index] = "";
            setOtpDigits(next);
            setErrorMessage(null);
            return;
        }

        // Single digit input
        const digit = sanitized[sanitized.length - 1];
        const next = [...otpDigits];
        next[index] = digit;
        setOtpDigits(next);
        setErrorMessage(null);

        // Auto-advance to next input box
        if (index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle backspace navigation
    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Handle paste across all 6 inputs
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;

        const next = [...otpDigits];
        for (let i = 0; i < 6; i++) {
            next[i] = pasted[i] || "";
        }
        setOtpDigits(next);
        setErrorMessage(null);

        // Focus the appropriate input after paste
        const focusIndex = Math.min(pasted.length, 5);
        inputRefs.current[focusIndex]?.focus();
    };

    // Action: Send OTP via Resend
    const handleSendOtp = async () => {
        if (!registeredEmail) {
            toast.error("No registered email found on account.");
            return;
        }
        if (cooldownSeconds > 0) return;

        setIsSendingOtp(true);
        setErrorMessage(null);

        try {
            const res = await sendVerificationOtp(registeredEmail);
            setHasSentOtp(true);
            setCooldownSeconds(res.cooldownSeconds || 60);
            setOtpDigits(["", "", "", "", "", ""]);
            if (res.simulated) {
                setIsSimulated(true);
            }
            if (res.devOtp) {
                setDevOtp(res.devOtp);
            }

            toast.success(`Verification code sent to ${registeredEmail}!`, {
                title: "Code Dispatched",
            });

            // Auto-focus first input box after send
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
        } catch (err: any) {
            const msg = err.message || "Failed to send verification code.";
            setErrorMessage(msg);
            toast.error(msg);
            if (err.cooldownRemainingSeconds) {
                setCooldownSeconds(err.cooldownRemainingSeconds);
            }
        } finally {
            setIsSendingOtp(false);
        }
    };

    // Auto-fill dev simulation OTP
    const handleAutofillDevOtp = (code: string) => {
        const digits = code.split("").slice(0, 6);
        while (digits.length < 6) digits.push("");
        setOtpDigits(digits);
        setErrorMessage(null);
        inputRefs.current[5]?.focus();
    };

    // Action: Verify OTP Code
    const handleVerifyOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = otpDigits.join("");
        if (code.length !== 6) {
            setErrorMessage("Please enter all 6 digits of your verification code.");
            return;
        }

        setIsVerifying(true);
        setErrorMessage(null);

        try {
            const res = await verifyEmailOtp(code);
            setIsEmailVerified(true);
            setVerifiedAt(res.emailVerifiedAt || new Date().toISOString());

            // Optimistically update Redux so the entire app reflects the verified state
            dispatch(
                setEmailVerified({
                    isEmailVerified: true,
                    emailVerifiedAt: res.emailVerifiedAt,
                    email: res.email,
                })
            );

            toast.success("✓ Your email has been successfully verified!", {
                title: "Account Verified",
            });
        } catch (err: any) {
            const msg = err.message || "Invalid or expired verification code.";
            setErrorMessage(msg);
            toast.error(msg);
        } finally {
            setIsVerifying(false);
        }
    };

    const isCodeComplete = otpDigits.every((d) => d.length === 1);

    return (
        <section
            aria-label="Email Verification Section"
            className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5"
        >
            {/* Header with Status Pill */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b-2 border-black/10">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000]">
                        <Mail className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Email Verification</span>
                    </div>
                    <h3 className="text-xl font-black text-black">
                        Primary Account Security
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Verify your registered email address via single-use OTP to safeguard account recovery, unlock verified coder perks, and rep your university.
                    </p>
                </div>

                <div className="shrink-0">
                    {isLoadingStatus ? (
                        <div className="px-3.5 py-1.5 rounded-xl bg-neutral-100 border-2 border-black text-xs font-bold flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking...</span>
                        </div>
                    ) : isEmailVerified ? (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] bg-[#a2ff86] text-black">
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>Verified</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] bg-amber-100 text-amber-900 border-amber-300">
                            <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                            <span>Unverified</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Email Address Display Box */}
            <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600">
                            Registered Email Address
                        </span>
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-black stroke-[2.5]" />
                            <span className="text-sm font-mono font-black text-black break-all">
                                {registeredEmail || "No email associated"}
                            </span>
                        </div>
                    </div>

                    {isEmailVerified && verifiedAt && (
                        <div className="text-[11px] font-mono font-bold text-neutral-600 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 stroke-[2]" />
                            <span>
                                Verified on{" "}
                                {new Date(verifiedAt).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                })}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Case 1: ALREADY VERIFIED */}
            {isEmailVerified ? (
                <div className="p-4 rounded-xl bg-emerald-50 border-2 border-black shadow-[2px_2px_0px_#000] space-y-2">
                    <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                        <ShieldCheck className="w-5 h-5 stroke-[2.5] text-emerald-700" />
                        <span>Your email address is cryptographically verified!</span>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">
                        Your account is protected against unauthorized recovery attempts, and your verified badge is now active on your public profile and leaderboard cards.
                    </p>
                </div>
            ) : (
                /* Case 2: UNVERIFIED - INTERACTIVE OTP VERIFICATION PIPELINE */
                <div className="space-y-4">
                    {!hasSentOtp ? (
                        /* Step 1: Initial Trigger */
                        <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-md">
                                <h4 className="text-sm font-black text-black flex items-center gap-2">
                                    <KeyRound className="w-4 h-4 stroke-[2.5]" />
                                    <span>Send 6-Digit Verification Code</span>
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    We will dispatch a secure single-use 6-digit code via Resend to{" "}
                                    <strong className="text-black font-bold">{registeredEmail}</strong>.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleSendOtp}
                                disabled={isSendingOtp || !registeredEmail}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
                            >
                                {isSendingOtp ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin stroke-[2.5]" />
                                        <span>Dispatching...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 stroke-[2.5]" />
                                        <span>Send Verification OTP</span>
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        /* Step 2: Active OTP Input Form */
                        <form
                            onSubmit={handleVerifyOtp}
                            className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                    <h4 className="text-sm font-black text-black flex items-center gap-2">
                                        <KeyRound className="w-4 h-4 stroke-[2.5]" />
                                        <span>Enter 6-Digit Code</span>
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Check your inbox at <span className="font-bold text-black">{registeredEmail}</span> (expires in 10 minutes).
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSendOtp}
                                    disabled={cooldownSeconds > 0 || isSendingOtp}
                                    className="text-xs font-black text-black hover:text-neutral-700 underline underline-offset-4 disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                                >
                                    {isSendingOtp ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                    )}
                                    <span>
                                        {cooldownSeconds > 0
                                            ? `Resend in ${cooldownSeconds}s`
                                            : "Resend Code"}
                                    </span>
                                </button>
                            </div>

                            {/* Dev Simulation Notice & Auto-Fill Banner */}
                            {(isSimulated || devOtp) && (
                                <div className="p-3.5 rounded-xl bg-[#FFF9E6] border-2 border-amber-500 text-amber-950 text-xs shadow-[2px_2px_0px_#b45309] space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-black text-amber-900 block">
                                                    Development Simulation Mode
                                                </span>
                                                <span className="text-[11px] text-amber-800">
                                                    <code className="bg-amber-200/80 px-1 py-0.5 rounded font-mono font-bold">RESEND_API_KEY</code> is not yet configured in <code className="bg-amber-200/80 px-1 py-0.5 rounded font-mono font-bold">Backend/.env</code>. Real emails require your Resend API key.
                                                </span>
                                            </div>
                                        </div>
                                        {devOtp && (
                                            <button
                                                type="button"
                                                onClick={() => handleAutofillDevOtp(devOtp)}
                                                className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-black text-[#a2ff86] border border-black font-black text-xs shadow-[1px_1px_0px_#000] hover:bg-neutral-800 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                                            >
                                                <span>Auto-Fill Code</span>
                                                <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded text-white">{devOtp}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 6 Digit Neo-Brutalist Box Inputs */}
                            <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
                                {otpDigits.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={(el) => {
                                            inputRefs.current[idx] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        onPaste={handlePaste}
                                        aria-label={`Digit ${idx + 1}`}
                                        className="w-11 h-14 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-mono font-black rounded-xl bg-[#FAF6EE] border-2 border-black text-black shadow-[2px_2px_0px_#000] focus:bg-white focus:shadow-[3px_3px_0px_#000] focus:outline-none transition-all"
                                    />
                                ))}
                            </div>

                            {/* Error Alert Message */}
                            {errorMessage && (
                                <div className="p-3 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 stroke-[2.5] shrink-0 text-rose-600" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            {/* Verify Action Button */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                <span className="text-[11px] text-neutral-500 font-medium">
                                    Tip: Didn't receive the email? Check your spam or promotions folder.
                                </span>

                                <button
                                    type="submit"
                                    disabled={!isCodeComplete || isVerifying}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isVerifying ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin stroke-[2.5]" />
                                            <span>Verifying Code...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 stroke-[3]" />
                                            <span>Verify Code</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </section>
    );
};
