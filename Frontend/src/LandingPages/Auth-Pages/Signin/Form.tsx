import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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

    const validate = () => {
        const newErrors: { gmail?: string; password?: string } = {};

        if (!formData.gmail.trim()) {
            newErrors.gmail = "Email address is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.gmail.trim())) {
            newErrors.gmail = "Please enter a valid email address";
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
                await toast.handleError(response, "Invalid credentials.");
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

            toast.success("Welcome back! Redirecting to workspace...", { title: "Signed In" });
            navigate("/dashboard");
        } catch (err: any) {
            console.error("Sign in error:", err);
            await toast.handleError(err, "An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Email / Username Input matching pill design */}
            <FormInput
                name="gmail"
                type="email"
                placeholder="Username or email"
                hideLabel
                value={formData.gmail}
                onChange={(e) => {
                    setFormData({ ...formData, gmail: e.target.value });
                    if (errors.gmail) setErrors({ ...errors, gmail: undefined });
                }}
                error={errors.gmail}
                autoComplete="email"
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
                        alert("Password reset instructions will be sent to your registered email.");
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