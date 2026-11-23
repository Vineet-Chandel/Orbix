import { requestAuthJson } from "../../../api/authRequests";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, ArrowLeft, RefreshCw } from "lucide-react";
import { FormInput } from "../FormInput";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, setUser } from "../../../store";
import { getOrCreateDeviceId } from "../../../api/sessionActivityApi";
import { buildApiUrl } from "../../../api/apiClient";
import { OrbixInitialLoader, OrbixLoader } from "../../../components/ui/loader";

export interface ClubSigninFormProps {
    initialIdentifier?: string;
    onForgotPassword?: (identifier?: string) => void;
}

export default function ClubSigninForm({ initialIdentifier = "", onForgotPassword }: ClubSigninFormProps = {}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToast();
    const dispatch = useAppDispatch();

    const redirectParam = searchParams.get("redirect") || searchParams.get("returnUrl");
    const clubSignupHref = redirectParam
        ? `/auth/signup?tab=club&redirect=${encodeURIComponent(redirectParam)}`
        : "/auth/signup?tab=club";

    const [formData, setFormData] = useState({
        identity: initialIdentifier || "",
        password: "",
    });

    useEffect(() => {
        if (initialIdentifier && !formData.identity) {
            setFormData((prev) => ({ ...prev, identity: initialIdentifier }));
        }
    }, [initialIdentifier]);

    const [errors, setErrors] = useState<{ identity?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [redirectMeta, setRedirectMeta] = useState({
        message: "Opening Club Portal…",
        subMessage: "Your sign-in is complete. Loading your club workspace.",
    });
    const [slowConnection, setSlowConnection] = useState(false);
    const requestLock = useRef(false);
    const lifetime = useRef(new AbortController());
    useEffect(() => {
        lifetime.current = new AbortController();
        return () => lifetime.current.abort();
    }, []);

    // 2FA Challenge State
    const [step, setStep] = useState<"credentials" | "2fa">("credentials");
    const [challengeToken, setChallengeToken] = useState("");
    const [maskedEmail, setMaskedEmail] = useState("");
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [cooldownSeconds, setCooldownSeconds] = useState(60);
    const [isResending, setIsResending] = useState(false);
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);

    useEffect(() => {
        setSlowConnection(false);
        if (!loading && !isVerifying2FA) return;
        const timer = setTimeout(() => setSlowConnection(true), 6000);
        return () => clearTimeout(timer);
    }, [loading, isVerifying2FA]);

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
        if (lifetime.current.signal.aborted) return;
        if (!resultData?.user) throw new Error("The server returned an incomplete sign-in response. Please try again.");
        setRedirecting(true);
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
                accountType: "club",
            }));
        }

        // Route based on account type and club verification status
        if (resultData?.user?.clubStatus === "approved" || resultData?.user?.verifiedClub) {
            setRedirectMeta({
                message: "Opening Club Dashboard…",
                subMessage: "Welcome back! Connecting to your verified club workspace.",
            });
            toast.success("Welcome back! Redirecting to verified club dashboard...", { title: "Club Signed In" });
            navigate("/club/dashboard");
            return;
        }

        if (resultData?.user?.clubStatus && resultData?.user?.clubStatus !== "none") {
            setRedirectMeta({
                message: "Loading Club Status…",
                subMessage: "Opening your club application review status.",
            });
            toast.info("Welcome back! Loading your club verification status...", { title: "Application Under Review" });
            navigate("/club/status");
            return;
        }

        // Seamless onboarding: If account doesn't have an approved club or pending request yet
        setRedirectMeta({
            message: "Starting Club Setup…",
            subMessage: "Opening club verification registration.",
        });
        toast.info("Signed in! Let's get your club verified.", { title: "Club Setup" });
        navigate("/auth/signup?tab=club");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (requestLock.current) return;
        if (!validate()) return;
        requestLock.current = true;
        setLoading(true);

        try {
            // Safely resolve client device identifier without blocking club sign-in
            let deviceId = "";
            try {
                deviceId = getOrCreateDeviceId();
            } catch (didErr) {
                console.warn("[Orbix Auth] Non-fatal: Device ID skipped for club signin:", didErr);
            }

            const requestHeaders: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (deviceId) {
                requestHeaders["x-orbix-device-id"] = deviceId;
            }

            const requestBody = JSON.stringify({
                gmail: formData.identity.trim().toLowerCase(),
                password: formData.password,
                accountType: "club",
            });

            const endpoints = [buildApiUrl("/api/auth/signin")];

            let response: Response | null = null;
            let resultData: any = null;
            let lastNetworkError: Error | null = null;

            for (const url of endpoints) {
                try {
                    const { response: res, data } = await requestAuthJson(url, {
                        signal: lifetime.current.signal,
                        method: "POST",
                        headers: requestHeaders,
                        credentials: "include",
                        body: requestBody,
                    });
                    response = res;
                    resultData = data;
                    break;
                } catch (netErr: any) {
                    lastNetworkError = netErr;
                    console.warn("[Orbix Auth] Club sign-in endpoint attempt failed:", {
                        endpoint: url,
                        errorType: netErr?.name,
                        message: netErr?.message,
                    });
                    continue;
                }
            }

            if (!response) {
                console.error("[Orbix Auth] All club sign-in endpoints unreachable", {
                    errorType: lastNetworkError?.name,
                    message: lastNetworkError?.message,
                });
                throw lastNetworkError || new Error("Unable to connect to the authentication server. Please check your network connection.");
            }

            if (!response.ok) {
                toast.error(resultData?.code === "ACCOUNT_TYPE_MISMATCH"
                    ? "Use the Personal Account tab to sign in."
                    : response.status === 429
                        ? "Too many attempts. Wait a moment and try again."
                        : response.status >= 500 || response.status === 404
                            ? "Sign-in is temporarily unavailable. Try again shortly."
                            : "Check your club username or email and password.", { title: "Sign-in Failed" });
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
        } catch {
            if (lifetime.current.signal.aborted) return;
            toast.error("Could not connect to sign-in. Check your connection and try again.", { title: "Connection Error" });
        } finally {
            requestLock.current = false;
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

        if (requestLock.current) return;
        requestLock.current = true;
        setIsVerifying2FA(true);
        try {
            let deviceId = "";
            try {
                deviceId = getOrCreateDeviceId();
            } catch (didErr) {
                console.warn("[Orbix Auth] Non-fatal: Device ID skipped for club 2FA:", didErr);
            }

            const requestHeaders: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (deviceId) {
                requestHeaders["x-orbix-device-id"] = deviceId;
            }

            const requestBody = JSON.stringify({
                challengeToken,
                otp: code,
                accountType: "club",
            });

            const endpoints = [buildApiUrl("/api/auth/2fa/verify-login")];

            let response: Response | null = null;
            let resultData: any = null;
            let lastNetworkError: Error | null = null;

            for (const url of endpoints) {
                try {
                    const { response: res, data } = await requestAuthJson(url, {
                        signal: lifetime.current.signal,
                        method: "POST",
                        headers: requestHeaders,
                        credentials: "include",
                        body: requestBody,
                    });
                    response = res;
                    resultData = data;
                    break;
                } catch (netErr: any) {
                    lastNetworkError = netErr;
                    console.warn("[Orbix Auth] Club 2FA verify endpoint attempt failed:", {
                        endpoint: url,
                        errorType: netErr?.name,
                        message: netErr?.message,
                    });
                    continue;
                }
            }

            if (!response) {
                console.error("[Orbix Auth] Club 2FA verify unreachable:", {
                    errorType: lastNetworkError?.name,
                    message: lastNetworkError?.message,
                });
                throw new Error("Unable to connect to verification server. Please check your network connection.");
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
            if (lifetime.current.signal.aborted) return;
            await toast.handleError(err, "Failed to verify 2FA code.");
        } finally {
            requestLock.current = false;
            setIsVerifying2FA(false);
        }
    };

    const handleResend2FA = async () => {
        if (cooldownSeconds > 0 || isResending) return;
        setIsResending(true);
        try {
            let deviceId = "";
            try {
                deviceId = getOrCreateDeviceId();
            } catch (didErr) {
                console.warn("[Orbix Auth] Non-fatal: Device ID skipped for club 2FA resend:", didErr);
            }

            const requestHeaders: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (deviceId) {
                requestHeaders["x-orbix-device-id"] = deviceId;
            }

            const endpoints = [buildApiUrl("/api/auth/2fa/resend-login-otp")];
            let response: Response | null = null;
            let resultData: any = null;
            let lastNetworkError: Error | null = null;

            for (const url of endpoints) {
                try {
                    const { response: res, data } = await requestAuthJson(url, {
                        signal: lifetime.current.signal,
                        method: "POST",
                        headers: requestHeaders,
                        credentials: "include",
                        body: JSON.stringify({ challengeToken }),
                    });
                    response = res;
                    resultData = data;
                    break;
                } catch (netErr: any) {
                    lastNetworkError = netErr;
                    console.warn("[Orbix Auth] Club 2FA resend endpoint attempt failed:", {
                        endpoint: url,
                        errorType: netErr?.name,
                        message: netErr?.message,
                    });
                    continue;
                }
            }

            if (!response) {
                console.error("[Orbix Auth] Club 2FA resend unreachable:", {
                    errorType: lastNetworkError?.name,
                    message: lastNetworkError?.message,
                });
                throw new Error("Unable to connect to verification server. Please check your network connection.");
            }

            if (!response.ok) {
                await toast.handleError(response, "Unable to resend verification code.");
                return;
            }

            setCooldownSeconds(resultData?.cooldownSeconds || 60);
            toast.success("A new 6-digit code has been sent to your email.", { title: "Code Resent" });
        } catch (err: any) {
            if (lifetime.current.signal.aborted) return;
            await toast.handleError(err, "Failed to resend 2FA code.");
        } finally {
            setIsResending(false);
        }
    };

    if (redirecting) return <OrbixInitialLoader message={redirectMeta.message} subMessage={redirectMeta.subMessage} />;

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

                {slowConnection && <p role="status" className="text-xs font-bold text-amber-800">Your connection is slow. Still connecting securely… You can retry if this takes too long.</p>}
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
        <>
            {slowConnection && (
                <p role="status" className="text-xs font-bold text-amber-800">
                    Your connection is slow. Still connecting securely… You can retry if this takes too long.
                </p>
            )}
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
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        if (onForgotPassword) {
                            onForgotPassword(formData.identity);
                        } else {
                            toast.info("Password reset instructions will be sent to your registered club email.", { title: "Password Reset" });
                        }
                    }}
                    className="text-xs font-bold text-neutral-700 hover:text-black underline underline-offset-2 transition-colors cursor-pointer"
                >
                    Forgot password?
                </button>
            </div>

            {/* Neo-brutalist Submit Button */}
            <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-black text-white font-black text-sm tracking-wide uppercase border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
                {loading ? (
                    <OrbixLoader size="xs" variant="inline" />
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
                    <div className="p-2 rounded-xl bg-[#a2ff86] text-black border border-black shrink-0">
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
                            <Link
                                to={clubSignupHref}
                                className="text-xs font-black text-black underline underline-offset-2 hover:text-neutral-800 transition-colors"
                            >
                                Apply for Club Verification &rarr;
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </form>
        </>
    );
}
