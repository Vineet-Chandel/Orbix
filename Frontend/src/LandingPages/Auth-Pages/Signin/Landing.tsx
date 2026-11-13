import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Users } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { AuthLayout } from "../AuthLayout";
import SigninForm from "./Form";
import ClubSigninForm from "./ClubSigninForm";
import ForgotPasswordFlow from "./ForgotPasswordFlow";

export default function SignInPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const viewParam = searchParams.get("view");
    const errorParam = searchParams.get("error");
    const toast = useToast();

    const [loginMode, setLoginMode] = useState<"personal" | "club">(
        tabParam === "club" ? "club" : "personal"
    );

    const [authView, setAuthView] = useState<"signin" | "forgot_password">(
        viewParam === "forgot_password" || viewParam === "forgot-password"
            ? "forgot_password"
            : "signin"
    );

    const [activeIdentifier, setActiveIdentifier] = useState("");

    useEffect(() => {
        if (errorParam) {
            toast.error(decodeURIComponent(errorParam), { title: "Authentication Notice" });
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("error");
            setSearchParams(nextParams, { replace: true });
        }
    }, [errorParam]);

    useEffect(() => {
        if (tabParam === "club") {
            setLoginMode("club");
        } else if (tabParam === "personal") {
            setLoginMode("personal");
        }
    }, [tabParam]);

    useEffect(() => {
        if (viewParam === "forgot_password" || viewParam === "forgot-password") {
            setAuthView("forgot_password");
        } else if (!viewParam && authView === "forgot_password") {
            // Keep current view unless explicit
        }
    }, [viewParam]);

    const handleSwitchToPersonal = () => {
        setLoginMode("personal");
        const nextParams: Record<string, string> = { tab: "personal" };
        if (authView === "forgot_password") {
            nextParams.view = "forgot-password";
        }
        setSearchParams(nextParams);
    };

    const handleSwitchToClub = () => {
        setLoginMode("club");
        const nextParams: Record<string, string> = { tab: "club" };
        if (authView === "forgot_password") {
            nextParams.view = "forgot-password";
        }
        setSearchParams(nextParams);
    };

    const handleOpenForgotPassword = (identifier?: string) => {
        if (identifier) {
            setActiveIdentifier(identifier);
        }
        setAuthView("forgot_password");
        setSearchParams({ tab: loginMode, view: "forgot-password" });
    };

    const handleBackToLogin = () => {
        setAuthView("signin");
        setSearchParams({ tab: loginMode });
    };

    const handleResetSuccess = (identifier: string) => {
        if (identifier) {
            setActiveIdentifier(identifier);
        }
        setAuthView("signin");
        setSearchParams({ tab: loginMode });
        toast.success("Password reset complete! Please log in with your new password.", {
            title: "Signed Out All Sessions",
        });
    };

    // Dynamic Title & Subtitle based on active view and login mode
    const getLayoutTitle = () => {
        if (authView === "forgot_password") {
            return loginMode === "personal"
                ? "Find Your Account"
                : "Club Account Recovery";
        }
        return loginMode === "personal"
            ? "Welcome back!"
            : "Club Portal Login";
    };

    const getLayoutSubtitle = () => {
        if (authView === "forgot_password") {
            return loginMode === "personal"
                ? "Enter your username or email to verify ownership and reset your password."
                : "Search by registered club username, slug, or representative email to recover access.";
        }
        return loginMode === "personal"
            ? "Simplify your workflow and boost your productivity with Orbix. Get started for free."
            : "Access your verified club dashboard, track review status, and manage campus events.";
    };

    return (
        <AuthLayout
            title={getLayoutTitle()}
            subtitle={getLayoutSubtitle()}
            trigger={authView === "signin"}
            switchText={
                authView === "forgot_password"
                    ? "Remember your password?"
                    : loginMode === "personal"
                    ? "Not a member?"
                    : ""
            }
            switchLinkText={
                authView === "forgot_password"
                    ? "Back to Sign In"
                    : loginMode === "personal"
                    ? "Register now"
                    : ""
            }
            switchLinkHref={
                authView === "forgot_password"
                    ? "/auth/signin"
                    : loginMode === "personal"
                    ? "/auth/signup"
                    : ""
            }
            showSocialAuth={loginMode === "personal" && authView === "signin"}
            wide={false}
        >
            {/* Segmented Control / Signin-Type Selector */}
            <div className="w-full p-1 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_#000] flex items-center mb-5 select-none">
                <button
                    type="button"
                    onClick={handleSwitchToPersonal}
                    className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        loginMode === "personal"
                            ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                            : "bg-transparent text-neutral-600 hover:text-black"
                    }`}
                    aria-pressed={loginMode === "personal"}
                >
                    <User className="w-3.5 h-3.5" />
                    <span>Personal Account</span>
                </button>

                <button
                    type="button"
                    onClick={handleSwitchToClub}
                    className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        loginMode === "club"
                            ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                            : "bg-transparent text-neutral-600 hover:text-black"
                    }`}
                    aria-pressed={loginMode === "club"}
                >
                    <Users className="w-3.5 h-3.5" />
                    <span>Club Login</span>
                </button>
            </div>

            {/* View Switching: Forgot Password Flow or Standard Signin Forms */}
            {authView === "forgot_password" ? (
                <ForgotPasswordFlow
                    accountType={loginMode}
                    initialIdentifier={activeIdentifier}
                    onBackToLogin={handleBackToLogin}
                    onResetSuccess={handleResetSuccess}
                    onSwitchAccountType={(mode) => {
                        if (mode === "club") handleSwitchToClub();
                        else handleSwitchToPersonal();
                    }}
                />
            ) : loginMode === "personal" ? (
                <SigninForm
                    initialIdentifier={activeIdentifier}
                    onForgotPassword={handleOpenForgotPassword}
                />
            ) : (
                <ClubSigninForm
                    initialIdentifier={activeIdentifier}
                    onForgotPassword={handleOpenForgotPassword}
                />
            )}
        </AuthLayout>
    );
}
