import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { FormInput } from "../FormInput";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, setUser } from "../../../store";

export default function SigninForm() {
    const navigate = useNavigate();
    const toast = useToast();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState({
        gmail: "",
        password: "",
    });

    const [errors, setErrors] = useState<{ gmail?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);

    // 2FA Challenge State
    const [step, setStep] = useState<"credentials" | "2fa">("credentials");
    const [challengeToken, setChallengeToken] = useState("");
    const [maskedEmail, setMaskedEmail] = useState("");
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [cooldownSeconds, setCooldownSeconds] = useState(60);
    const [isResending, setIsResending] = useState(false);
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);

    const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for 2FA resend cooldown
    useEffect(() => {
        let timer: any = null;
        if (step === "2fa" && cooldownSeconds > 0) {
            timer = setInterval(() => {
                setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [step, cooldownSeconds]);

    // Focus first OTP digit on step transition
    useEffect(() => {
        if (step === "2fa") {
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 100);
        }
    }, [step]);

    const validate = () => {
        const newErrors: { gmail?: string; password?: string } = {};

        const identifier = formData.gmail.trim();
        if (!identifier) {
            newErrors.gmail = "Email address or username is required";
        } else {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
            const isUsername = /^[a-zA-Z0-9._-]{2,30}$/.test(identifier);
            if (!isEmail && !isUsername) {
                newErrors.gmail = "Please enter a valid email address or username";
            }
        }

        if (!formData.password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        if (!isValid) {
            const firstMsg = Object.values(newErrors)[0];
            if (firstMsg) {
                toast.error(firstMsg, { title: "Validation Error" });
            }
        }
        return isValid;
    };

    const handleLoginSuccess = (resultData: any) => {
        if (resultData?.token) {
            try {
                localStorage.setItem("orbix_token", resultData.token);
            } catch {
                // ignore quota errors
            }
        }

        if (resultData?.user) {
            dispatch(setUser({
                ...resultData.user,
                accountType: "personal",
            }));
        }

        toast.success("Welcome back! Redirecting to workspace...", { title: "Signed In" });
        navigate("/dashboard");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);

        try {
            const endpoints = ["http://localhost:3000/api/signin", "/api/signin"];
            let response: Response | null = null;
            let resultData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            gmail: formData.gmail.trim().toLowerCase(),
                            password: formData.password,
                            accountType: "personal",
                        }),
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response) {
                throw new Error("Unable to connect to the authentication server. Please check backend status.");
            }

            if (!response.ok) {
                const message = resultData?.message || "Invalid credentials.";
                toast.error(message, {
                    title: resultData?.code === "ACCOUNT_TYPE_MISMATCH" ? "Club Account Detected" : "Sign In Failed",
                });
                return;
            }

            // Two-Factor Authentication Intercept
            if (resultData?.requires2FA && resultData?.twoFactorChallengeToken) {
                setChallengeToken(resultData.twoFactorChallengeToken);
                setMaskedEmail(resultData.maskedEmail || "your email");
                setCooldownSeconds(resultData.cooldownSeconds || 60);
                setOtpDigits(["", "", "", "", "", ""]);
                setStep("2fa");
                toast.info(`A 6-digit verification code has been sent to ${resultData.maskedEmail || "your email"}.`, {
                    title: "Two-Factor Authentication",
                });
                return;
            }

            handleLoginSuccess(resultData);
        } catch (err: any) {
            console.error("Sign in error:", err);
            await toast.handleError(err, "An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // OTP Handlers
    const handleOtpChange = (index: number, value: string) => {
        const cleanVal = value.replace(/\D/g, "");
        if (!cleanVal) {
            const updated = [...otpDigits];
            updated[index] = "";
            setOtpDigits(updated);
            return;
        }

        // Handle single digit entry
        const digit = cleanVal.slice(-1);
        const updated = [...otpDigits];
        updated[index] = digit;
        setOtpDigits(updated);

        // Move to next input if available
        if (index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;

        const updated = [...otpDigits];
        for (let i = 0; i < 6; i++) {
            updated[i] = pasted[i] || "";
        }
        setOtpDigits(updated);

        const nextFocusIndex = Math.min(pasted.length, 5);
        otpInputRefs.current[nextFocusIndex]?.focus();
    };

    const handleVerify2FA = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = otpDigits.join("");
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit verification code.", { title: "Incomplete Code" });
            return;
        }

        setIsVerifying2FA(true);
        try {
            const endpoints = ["http://localhost:3000/api/auth/2fa/verify-login", "/api/auth/2fa/verify-login"];
            let response: Response | null = null;
            let resultData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            challengeToken,
                            otp: code,
                            accountType: "personal",
                        }),
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response) {
                throw new Error("Unable to connect to verification server.");
            }

            if (!response.ok) {
                const message = resultData?.message || "Invalid or expired verification code.";
                toast.error(message, {
                    title: resultData?.code === "ACCOUNT_TYPE_MISMATCH" ? "Club Account Detected" : "Verification Failed",
                });
                return;
            }

            handleLoginSuccess(resultData);
        } catch (err: any) {
            console.error("2FA verify error:", err);
            await toast.handleError(err, "Failed to verify 2FA code.");
        } finally {
            setIsVerifying2FA(false);
        }
    };

    const handleResend2FA = async () => {
        if (cooldownSeconds > 0 || isResending) return;
        setIsResending(true);
        try {
            const endpoints = ["http://localhost:3000/api/auth/2fa/resend-login-otp", "/api/auth/2fa/resend-login-otp"];
            let response: Response | null = null;
            let resultData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ challengeToken }),
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response || !response.ok) {
                await toast.handleError(response, "Unable to resend verification code.");
                return;
            }

            setCooldownSeconds(resultData?.cooldownSeconds || 60);
            toast.success("A new 6-digit code has been sent to your email.", { title: "Code Resent" });
        } catch (err: any) {
            await toast.handleError(err, "Failed to resend 2FA code.");
        } finally {
            setIsResending(false);
        }
    };

    // If in 2FA Mode, render 2FA verification card
    if (step === "2fa") {
        return (
            <div className="space-y-5">
                {/* 2FA Header Badge */}
                <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#a2ff86] border-2 border-black flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                Two-Factor Authentication
                            </span>
                            <p className="text-[11px] text-neutral-600 font-medium">
                                Extra account security enabled
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                        We sent a 6-digit verification code to <span className="font-bold text-black font-mono">{maskedEmail}</span>. Enter the code below to complete sign-in.
                    </p>
                </div>

                {/* Segmented 6-digit OTP Inputs */}
                <form onSubmit={handleVerify2FA} className="space-y-4">
                    <div className="flex justify-between items-center gap-1.5 sm:gap-2">
                        {otpDigits.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={(el) => {
                                    otpInputRefs.current[idx] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                onPaste={handleOtpPaste}
                                className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono font-black text-xl sm:text-2xl rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] focus:shadow-[4px_4px_0px_#000] focus:bg-[#FAF6EE] focus:outline-none transition-all select-all"
                                autoFocus={idx === 0}
                            />
                        ))}
                    </div>

                    {/* Resend OTP Cooldown */}
                    <div className="flex items-center justify-between text-xs pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setStep("credentials");
                                setOtpDigits(["", "", "", "", "", ""]);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-neutral-600 hover:text-black underline underline-offset-2 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back to Login</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleResend2FA}
                            disabled={cooldownSeconds > 0 || isResending}
                            className="inline-flex items-center gap-1 font-black text-black hover:text-neutral-800 disabled:text-neutral-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                            <span>
                                {cooldownSeconds > 0
                                    ? `Resend in ${cooldownSeconds}s`
                                    : "Resend Code"}
                            </span>
                        </button>
                    </div>

                    {/* Verify & Sign In Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isVerifying2FA || otpDigits.join("").length !== 6}
                            className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm sm:text-base font-black text-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isVerifying2FA ? (
                                <div className="flex items-center gap-2">
                                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span>Verifying Code...</span>
                                </div>
                            ) : (
                                <span className="inline-flex items-center gap-2">
                                    <span>Verify & Sign In</span>
                                    <ShieldCheck className="w-4 h-4 text-[#a2ff86] stroke-[2.5]" />
                                </span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Email / Username Input matching pill design */}
            <FormInput
                name="gmail"
                type="text"
                placeholder="Username or email"
                hideLabel
                value={formData.gmail}
                onChange={(e) => {
                    setFormData({ ...formData, gmail: e.target.value });
                    if (errors.gmail) setErrors({ ...errors, gmail: undefined });
                }}
                error={errors.gmail}
                autoComplete="username"
            />

            {/* Password Input matching pill design */}
            <FormInput
                name="password"
                isPassword
                placeholder="Password"
                hideLabel
                value={formData.password}
                onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                error={errors.password}
                autoComplete="current-password"
            />

            {/* Forgot Password Link right-aligned matching user screenshot */}
            <div className="flex justify-end pt-0.5">
                <a
                    href="#forgot-password"
                    onClick={(e) => {
                        e.preventDefault();
                        toast.info("Password reset instructions will be sent to your registered email.", { title: "Password Reset" });
                    }}
                    className="text-xs font-bold text-neutral-700 hover:text-black underline underline-offset-2 transition-colors cursor-pointer"
                >
                    Forgot Password?
                </a>
            </div>

            {/* Neo-brutalist Capsule Button matching landing page theme */}
            <div className="pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm sm:text-base font-black text-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Logging in...</span>
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-2">
                            <span>Login</span>
                            <svg
                                className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform stroke-[2.5]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </span>
                    )}
                </button>
            </div>
        </form>
    );
}
