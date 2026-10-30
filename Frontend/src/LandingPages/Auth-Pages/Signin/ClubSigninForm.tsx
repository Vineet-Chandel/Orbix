import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { FormInput } from "../FormInput";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, setUser } from "../../../store";

export default function ClubSigninForm() {
    const navigate = useNavigate();
    const toast = useToast();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState({
        identity: "",
        password: "",
    });

    const [errors, setErrors] = useState<{ identity?: string; password?: string }>({});
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

    useEffect(() => {
        if (step === "2fa") {
            setTimeout(() => {
                otpInputRefs.current[0]?.focus();
            }, 100);
        }
    }, [step]);

    const validate = () => {
        const newErrors: { identity?: string; password?: string } = {};

        const cleanIdentity = formData.identity.trim();
        if (!cleanIdentity) {
            newErrors.identity = "Club username or registered email is required";
        } else if (cleanIdentity.length < 2) {
            newErrors.identity = "Identity must be at least 2 characters";
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
        // Strict Account Isolation: Reject personal accounts trying to use club login
        const isClub =
            resultData?.user?.accountType === "club" ||
            Boolean(resultData?.user?.verifiedClub) ||
            (resultData?.user?.clubStatus && resultData?.user?.clubStatus !== "none");

        if (!isClub) {
            toast.error("This account is a Personal account. Please use the Personal Account tab.", {
                title: "Personal Account Detected",
            });
            return;
        }

        if (resultData?.token) {
            try {
                localStorage.setItem("orbix_token", resultData.token);
            } catch {
                // ignore quota errors
            }
        }

        if (resultData?.user) {
            dispatch(setUser(resultData.user));
        }

        // Route based on account type and club verification status
        if (resultData?.user?.clubStatus === "approved" || resultData?.user?.verifiedClub) {
            toast.success("Welcome back! Redirecting to verified club dashboard...", { title: "Club Signed In" });
            navigate("/club/dashboard");
            return;
        }

        toast.info("Welcome back! Loading your club verification status...", { title: "Application Under Review" });
        navigate("/club/status");
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
                            gmail: formData.identity.trim().toLowerCase(),
                            password: formData.password,
                            accountType: "club",
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
                const message = resultData?.message || "Invalid club username/email or password.";
                toast.error(message, {
                    title: resultData?.code === "ACCOUNT_TYPE_MISMATCH" ? "Personal Account Detected" : "Club Login Failed",
                });
                return;
            }

            // 2FA Challenge Intercept
            if (resultData?.requires2FA && resultData?.twoFactorChallengeToken) {
                setChallengeToken(resultData.twoFactorChallengeToken);
                setMaskedEmail(resultData.maskedEmail || "your registered email");
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
            console.error("Club sign in error:", err);
            await toast.handleError(err, "An unexpected error occurred during club sign in.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        const cleanVal = value.replace(/\D/g, "");
        if (!cleanVal) {
            const updated = [...otpDigits];
            updated[index] = "";
            setOtpDigits(updated);
            return;
        }

        const digit = cleanVal.slice(-1);
        const updated = [...otpDigits];
        updated[index] = digit;
        setOtpDigits(updated);

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
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            challengeToken,
                            otp: code,
                            accountType: "club",
                        }),
                    });
                    response = res;
                    resultData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response || !response.ok) {
                const message = resultData?.message || "Invalid or expired verification code.";
                toast.error(message, {
                    title: resultData?.code === "ACCOUNT_TYPE_MISMATCH" ? "Personal Account Detected" : "Verification Failed",
                });
                return;
            }

            handleLoginSuccess(resultData);
        } catch (err: any) {
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

    if (step === "2fa") {
        return (
            <div className="space-y-5">
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
            {/* Club Username or Registered Email */}
            <div>
                <FormInput
                    name="identity"
                    type="text"
                    placeholder="Club username or registered email"
                    hideLabel
                    value={formData.identity}
                    onChange={(e) => {
                        setFormData({ ...formData, identity: e.target.value });
                        if (errors.identity) setErrors({ ...errors, identity: undefined });
                    }}
                    error={errors.identity}
                    autoComplete="username"
                />
                <p className="mt-1 px-3 text-[11px] font-medium text-neutral-600">
                    Use your registered club username (e.g. <span className="font-mono font-bold text-black">gdsc_cu</span>) or the representative email.
                </p>
            </div>

            {/* Password Input matching pill design */}
            <FormInput
                name="password"
                isPassword
                placeholder="Club account password"
                hideLabel
                value={formData.password}
                onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                error={errors.password}
                autoComplete="current-password"
            />

            {/* Forgot Password Link right-aligned */}
            <div className="flex justify-end pt-0.5">
                <a
                    href="#forgot-password"
                    onClick={(e) => {
                        e.preventDefault();
                        toast.info("Password reset instructions will be sent to your registered club email.", { title: "Password Reset" });
                    }}
                    className="text-xs font-bold text-neutral-700 hover:text-black underline underline-offset-2 transition-colors cursor-pointer"
                >
                    Forgot password?
                </a>
            </div>

            {/* Neo-brutalist Submit Button */}
            <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-black text-white font-black text-sm tracking-wide uppercase border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
                {loading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Signing into Club Portal...</span>
                    </>
                ) : (
                    <>
                        <span>Sign In to Club Portal</span>
                        <ArrowRight className="w-4 h-4 stroke-[3]" />
                    </>
                )}
            </button>

            {/* Club Information & Status Tracker Callout Box */}
            <div className="mt-6 p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000]">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-black text-[#a2ff86] border border-black shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                            <span>Club Verification Portal</span>
                        </h4>
                        <p className="mt-1 text-xs text-neutral-600 leading-relaxed">
                            Sign in to review your 5-stage college verification status, update chapter details, or manage published campus events.
                        </p>
                        <div className="mt-3 pt-2.5 border-t border-neutral-200 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-neutral-600">
                                New student club or community?
                            </span>
                            <a
                                href="/auth/signup?tab=club"
                                className="text-xs font-black text-black underline underline-offset-2 hover:text-neutral-800 transition-colors"
                            >
                                Apply for Club Verification &rarr;
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
