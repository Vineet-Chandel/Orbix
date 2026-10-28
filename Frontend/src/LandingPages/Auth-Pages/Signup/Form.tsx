import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Mail,
    RotateCcw,
    X,
    ArrowLeft,
    CheckCircle2,
    Sparkles,
} from "lucide-react";
import { FormInput } from "../FormInput";
import { PasswordStrengthIndicator } from "../PasswordStrengthIndicator";
import { UsernameRulesIndicator } from "../UsernameRulesIndicator";
import { evaluatePassword } from "../passwordValidator";
import OtpSegmentedInput from "../OtpSegmentedInput";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, setUser } from "../../../store";

export default function SignupForm() {
    const navigate = useNavigate();
    const toast = useToast();
    const dispatch = useAppDispatch();

    const [formData, setFormData] = useState({
        username: "",
        firstName: "",
        middleName: "",
        lastName: "",
        gmail: "",
        password: "",
        termsAccepted: true,
    });

    const [errors, setErrors] = useState<{
        username?: string;
        firstName?: string;
        lastName?: string;
        gmail?: string;
        password?: string;
        termsAccepted?: string;
    }>({});

    const [loading, setLoading] = useState(false);
    const [usernameFocused, setUsernameFocused] = useState(false);

    // Email OTP Verification Modal State
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [emailCooldown, setEmailCooldown] = useState(0);
    const [devEmailOtp, setDevEmailOtp] = useState<string | null>(null);
    const [resendingOtp, setResendingOtp] = useState(false);
    const [verifyingAndRegistering, setVerifyingAndRegistering] = useState(false);

    const passwordStrength = evaluatePassword(formData.password);

    // Cooldown countdown timer
    useEffect(() => {
        if (emailCooldown <= 0) return;
        const timer = setInterval(() => {
            setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [emailCooldown]);

    const validate = () => {
        const newErrors: typeof errors = {};

        const normalizedUsername = formData.username.trim().toLowerCase();
        if (!normalizedUsername) {
            newErrors.username = "Username is required";
        } else if (!/^[a-z0-9._-]{3,20}$/.test(normalizedUsername)) {
            newErrors.username = "Must be 3-20 chars: lowercase, numbers, dot, _, or -";
        }

        if (!formData.firstName.trim()) {
            newErrors.firstName = "First name is required";
        } else if (formData.firstName.trim().length < 2) {
            newErrors.firstName = "Must be at least 2 characters";
        }

        if (!formData.lastName.trim()) {
            newErrors.lastName = "Last name is required";
        } else if (formData.lastName.trim().length < 2) {
            newErrors.lastName = "Must be at least 2 characters";
        }

        const normalizedGmail = formData.gmail.trim().toLowerCase();
        if (!normalizedGmail) {
            newErrors.gmail = "Email address is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedGmail)) {
            newErrors.gmail = "Please enter a valid email address";
        }

        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (!passwordStrength.isValid) {
            newErrors.password = "Please satisfy all password conditions below";
        }

        if (!formData.termsAccepted) {
            newErrors.termsAccepted = "You must accept the terms to continue";
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

    /**
     * Dispatches verification OTP code to the entered email address and opens verification modal.
     */
    const handleInitiateSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);

        const email = formData.gmail.trim().toLowerCase();
        const username = formData.username.trim().toLowerCase();
        const firstName = formData.firstName.trim();
        const lastName = formData.lastName.trim();

        try {
            const endpoints = [
                "http://localhost:3000/api/signup/send-email-otp",
                "/api/signup/send-email-otp"
            ];

            let response: Response | null = null;
            let resData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            email,
                            username,
                            firstName,
                            lastName,
                        }),
                    });
                    response = res;
                    resData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response) {
                throw new Error("Unable to connect to the authentication server. Please check your connection.");
            }

            if (!response.ok) {
                const errorMessage = resData?.message || "Failed to dispatch verification email. Please check your information.";
                toast.error(errorMessage, { title: "Verification Error" });
                return;
            }

            setEmailCooldown(resData?.cooldownSeconds || 60);
            if (resData?.devOtp) {
                setDevEmailOtp(resData.devOtp);
            } else {
                setDevEmailOtp(null);
            }

            setOtpCode("");
            setShowOtpModal(true);
            toast.success(`Verification code sent to ${email}`, { title: "Code Dispatched" });
        } catch (err: any) {
            console.error("Initiate signup error:", err);
            await toast.handleError(err, "An unexpected error occurred while sending verification code.");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Resends OTP to the email address.
     */
    const handleResendOtp = async () => {
        if (emailCooldown > 0 || resendingOtp) return;

        const email = formData.gmail.trim().toLowerCase();
        const username = formData.username.trim().toLowerCase();
        const firstName = formData.firstName.trim();
        const lastName = formData.lastName.trim();

        setResendingOtp(true);
        try {
            const endpoints = [
                "http://localhost:3000/api/signup/send-email-otp",
                "/api/signup/send-email-otp"
            ];

            let response: Response | null = null;
            let resData: any = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            email,
                            username,
                            firstName,
                            lastName,
                        }),
                    });
                    response = res;
                    resData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!response || !response.ok) {
                throw new Error(resData?.message || "Failed to resend verification code.");
            }

            setEmailCooldown(resData?.cooldownSeconds || 60);
            if (resData?.devOtp) setDevEmailOtp(resData.devOtp);
            toast.success(`New verification code sent to ${email}`, { title: "Code Resent" });
        } catch (err: any) {
            toast.error(err.message || "Failed to resend verification code");
        } finally {
            setResendingOtp(false);
        }
    };

    /**
     * Verifies the 6-digit OTP code and finalizes registration.
     */
    const handleVerifyAndRegister = async (codeToVerify?: string) => {
        const code = (codeToVerify || otpCode).trim();
        if (code.length !== 6) {
            toast.error("Please enter the complete 6-digit verification code.", { title: "Invalid Code" });
            return;
        }

        const email = formData.gmail.trim().toLowerCase();
        setVerifyingAndRegistering(true);

        try {
            // Step 1: Verify OTP and acquire cryptographic proof token
            const verifyEndpoints = [
                "http://localhost:3000/api/signup/verify-email-otp",
                "/api/signup/verify-email-otp"
            ];

            let verifyResponse: Response | null = null;
            let verifyData: any = null;

            for (const url of verifyEndpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ email, otp: code }),
                    });
                    verifyResponse = res;
                    verifyData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!verifyResponse || !verifyResponse.ok) {
                throw new Error(verifyData?.message || "Invalid or expired verification code.");
            }

            const verificationToken = verifyData?.token;
            if (!verificationToken) {
                throw new Error("Verification proof could not be verified. Please try again.");
            }

            // Step 2: Finalize Registration with verified token
            const registrationPayload = {
                username: formData.username.trim().toLowerCase(),
                firstName: formData.firstName.trim(),
                middleName: formData.middleName.trim() || undefined,
                lastName: formData.lastName.trim(),
                gmail: email,
                password: formData.password,
                termsAccepted: formData.termsAccepted,
                verificationToken,
            };

            const signupEndpoints = [
                "http://localhost:3000/api/signup",
                "/api/signup"
            ];

            let signupResponse: Response | null = null;
            let signupData: any = null;

            for (const url of signupEndpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(registrationPayload),
                    });
                    signupResponse = res;
                    signupData = await res.json().catch(() => null);
                    break;
                } catch {
                    continue;
                }
            }

            if (!signupResponse || !signupResponse.ok) {
                throw new Error(signupData?.message || "Registration failed. Please check your details.");
            }

            if (signupData?.token) {
                try {
                    localStorage.setItem("orbix_token", signupData.token);
                } catch {
                    // Ignore quota errors
                }
            }

            const fullUser = signupData?.user || {
                username: registrationPayload.username,
                firstName: registrationPayload.firstName,
                middleName: registrationPayload.middleName,
                lastName: registrationPayload.lastName,
                gmail: registrationPayload.gmail,
                isEmailVerified: true,
                isVerifiedCoder: true,
                isVerified: true,
            };

            dispatch(setUser(fullUser));
            setShowOtpModal(false);

            toast.success("Account registered and email verified! Welcome to Orbix.", {
                title: "Welcome to Orbix! ✓",
            });
            navigate("/onboarding");

        } catch (err: any) {
            console.error("Verification and signup error:", err);
            toast.error(err.message || "Email verification failed", { title: "Verification Failed" });
        } finally {
            setVerifyingAndRegistering(false);
        }
    };

    return (
        <>
            <form onSubmit={handleInitiateSignup} className="space-y-3.5" noValidate>

                {/* Names Row: First Name, Middle Name, Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <FormInput
                        name="firstName"
                        type="text"
                        placeholder="First Name"
                        hideLabel
                        value={formData.firstName}
                        onChange={(e) => {
                            setFormData({ ...formData, firstName: e.target.value });
                            if (errors.firstName) setErrors({ ...errors, firstName: undefined });
                        }}
                        error={errors.firstName}
                        autoComplete="given-name"
                    />

                    <FormInput
                        name="middleName"
                        type="text"
                        placeholder="Middle (optional)"
                        hideLabel
                        value={formData.middleName}
                        onChange={(e) => {
                            setFormData({ ...formData, middleName: e.target.value });
                        }}
                        autoComplete="additional-name"
                    />

                    <FormInput
                        name="lastName"
                        type="text"
                        placeholder="Last Name"
                        hideLabel
                        value={formData.lastName}
                        onChange={(e) => {
                            setFormData({ ...formData, lastName: e.target.value });
                            if (errors.lastName) setErrors({ ...errors, lastName: undefined });
                        }}
                        error={errors.lastName}
                        autoComplete="family-name"
                    />
                </div>

                {/* Username Input with Live Rules Display */}
                <div>
                    <FormInput
                        name="username"
                        type="text"
                        placeholder="Username"
                        hideLabel
                        value={formData.username}
                        onChange={(e) => {
                            setFormData({ ...formData, username: e.target.value.toLowerCase() });
                            if (errors.username) setErrors({ ...errors, username: undefined });
                        }}
                        onFocus={() => setUsernameFocused(true)}
                        onBlur={() => setUsernameFocused(false)}
                        error={errors.username}
                        autoComplete="username"
                    />

                    <UsernameRulesIndicator
                        username={formData.username}
                        hasInput={formData.username.length > 0}
                        isFocused={usernameFocused}
                    />
                </div>

                {/* Email Input */}
                <FormInput
                    name="gmail"
                    type="email"
                    placeholder="Email address"
                    hideLabel
                    value={formData.gmail}
                    onChange={(e) => {
                        setFormData({ ...formData, gmail: e.target.value });
                        if (errors.gmail) setErrors({ ...errors, gmail: undefined });
                    }}
                    error={errors.gmail}
                    autoComplete="email"
                />

                {/* Password Input */}
                <div>
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
                        autoComplete="new-password"
                    />

                    {/* Interactive Password Strength Progress Bar & Conditions List */}
                    <PasswordStrengthIndicator
                        result={passwordStrength}
                        hasInput={formData.password.length > 0}
                    />
                </div>

                {/* Terms & Conditions Checkbox */}
                <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-neutral-700">
                        <input
                            type="checkbox"
                            checked={formData.termsAccepted}
                            onChange={(e) => {
                                setFormData({ ...formData, termsAccepted: e.target.checked });
                                if (errors.termsAccepted) setErrors({ ...errors, termsAccepted: undefined });
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-2 border-black text-black cursor-pointer accent-black shadow-[1px_1px_0px_#000] focus:ring-0"
                        />
                        <span className="leading-snug font-medium">
                            I accept the{" "}
                            <a href="#terms" className="font-bold text-black underline underline-offset-2 hover:text-emerald-700">
                                Terms of Service
                            </a>{" "}
                            and{" "}
                            <a href="#privacy" className="font-bold text-black underline underline-offset-2 hover:text-emerald-700">
                                Privacy Policy
                            </a>
                            .
                        </span>
                    </label>
                    {errors.termsAccepted && (
                        <p className="text-xs font-bold text-rose-600 mt-1 px-1">{errors.termsAccepted}</p>
                    )}
                </div>

                {/* Neo-brutalist Capsule Button */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading || !formData.termsAccepted}
                        className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm sm:text-base font-black text-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:bg-neutral-900 hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                <span>Sending verification code...</span>
                            </div>
                        ) : (
                            <span className="inline-flex items-center gap-2">
                                <span>Verify Email & Register</span>
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

            {/* Neo-Brutalist Email Verification Modal */}
            {showOtpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="relative w-full max-w-md bg-[#FAF6EE] border-3 sm:border-4 border-black rounded-3xl p-6 sm:p-7 shadow-[8px_8px_0px_#000] text-black space-y-5"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="otp-dialog-title"
                    >
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] flex-shrink-0">
                                    <Mail className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 id="otp-dialog-title" className="text-lg font-black text-black leading-tight">
                                        Verify Your Email
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-bold mt-0.5">
                                        Enter the 6-digit code sent to your inbox
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowOtpModal(false)}
                                className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all"
                                aria-label="Close verification dialog"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Recipient Email Chip */}
                        <div className="p-3 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                    Code sent to
                                </span>
                                <span className="text-xs sm:text-sm font-black text-black truncate block font-mono">
                                    {formData.gmail}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowOtpModal(false)}
                                className="text-xs font-black text-neutral-600 hover:text-black underline underline-offset-2 flex-shrink-0 cursor-pointer"
                            >
                                Change
                            </button>
                        </div>

                        {/* 6-Digit Segmented OTP Input */}
                        <div className="space-y-3 pt-1">
                            <OtpSegmentedInput
                                value={otpCode}
                                onChange={setOtpCode}
                                disabled={verifyingAndRegistering}
                                onComplete={(code) => handleVerifyAndRegister(code)}
                                autoFocus
                            />

                            {/* Dev Mode OTP Auto-fill helper */}
                            {devEmailOtp && (
                                <div className="text-center pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpCode(devEmailOtp);
                                            handleVerifyAndRegister(devEmailOtp);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] hover:bg-yellow-300 border-2 border-black text-xs font-mono font-black text-black shadow-[2px_2px_0px_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px] transition-all"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-black" />
                                        <span>Dev Auto-Fill: <strong>{devEmailOtp}</strong></span>
                                    </button>
                                </div>
                            )}

                            {/* Resend Cooldown Counter & Action */}
                            <div className="flex items-center justify-between pt-2 px-1 text-xs font-black">
                                <button
                                    type="button"
                                    disabled={emailCooldown > 0 || resendingOtp || verifyingAndRegistering}
                                    onClick={handleResendOtp}
                                    className="text-black underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                >
                                    <RotateCcw className={`w-3.5 h-3.5 stroke-[2.5] ${resendingOtp ? "animate-spin" : ""}`} />
                                    <span>
                                        {emailCooldown > 0
                                            ? `Resend code (${emailCooldown}s)`
                                            : "Resend Code"}
                                    </span>
                                </button>

                                <span className="text-[11px] text-neutral-500 font-bold">
                                    Expires in 10 mins
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 pt-2">
                            <button
                                type="button"
                                disabled={otpCode.length !== 6 || verifyingAndRegistering}
                                onClick={() => handleVerifyAndRegister(otpCode)}
                                className="group relative flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-black text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {verifyingAndRegistering ? (
                                    <div className="flex items-center gap-2">
                                        <svg className="h-4 w-4 animate-spin text-[#a2ff86]" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        <span>Verifying & creating account...</span>
                                    </div>
                                ) : (
                                    <span className="inline-flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                        <span>Verify & Complete Registration</span>
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={verifyingAndRegistering}
                                onClick={() => setShowOtpModal(false)}
                                className="w-full py-2.5 rounded-full bg-transparent hover:bg-black/5 text-xs font-black text-neutral-700 hover:text-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Edit Signup Information</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
