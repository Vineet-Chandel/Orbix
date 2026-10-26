import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormInput } from "../FormInput";
import { PasswordStrengthIndicator } from "../PasswordStrengthIndicator";
import { UsernameRulesIndicator } from "../UsernameRulesIndicator";
import { evaluatePassword } from "../passwordValidator";
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

    const passwordStrength = evaluatePassword(formData.password);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setLoading(true);

        const payload = {
            username: formData.username.trim().toLowerCase(),
            firstName: formData.firstName.trim(),
            middleName: formData.middleName.trim() || undefined,
            lastName: formData.lastName.trim(),
            gmail: formData.gmail.trim().toLowerCase(),
            password: formData.password,
            termsAccepted: formData.termsAccepted,
        };

        try {
            const endpoints = ["http://localhost:3000/api/signup", "/api/signup"];
            let response: Response | null = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                        body: JSON.stringify(payload),
                    });
                    response = res;
                    break;
                } catch {
                    continue;
                }
            }

            if (!response) {
                throw new Error("Unable to connect to the authentication server. Please check backend status.");
            }

            if (!response.ok) {
                await toast.handleError(response, "Registration failed. Please check your information.");
                return;
            }

            const resData = await response.json().catch(() => null);
            if (resData?.token) {
                try {
                    localStorage.setItem("orbix_token", resData.token);
                } catch {
                    // ignore quota errors
                }
            }

            const fullUser = resData?.user || {
                username: payload.username,
                firstName: payload.firstName,
                middleName: payload.middleName,
                lastName: payload.lastName,
                gmail: payload.gmail,
            };

            dispatch(setUser(fullUser));

            toast.success("Account registered successfully! Welcome to Orbix.", { title: "Welcome!" });
            navigate("/onboarding");
        } catch (err: any) {
            console.error("Sign up error:", err);
            await toast.handleError(err, "An unexpected error occurred during registration.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>

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

            {/* Neo-brutalist Capsule Button matching landing page theme */}
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
                            <span>Creating account...</span>
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-2">
                            <span>Register now</span>
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
