import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Users } from "lucide-react";
import { AuthLayout } from "../AuthLayout";
import SigninForm from "./Form";
import ClubSigninForm from "./ClubSigninForm";

export default function SignInPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [loginMode, setLoginMode] = useState<"personal" | "club">(
        tabParam === "club" ? "club" : "personal"
    );

    useEffect(() => {
        if (tabParam === "club") {
            setLoginMode("club");
        } else if (tabParam === "personal") {
            setLoginMode("personal");
        }
    }, [tabParam]);

    const handleSwitchToPersonal = () => {
        setLoginMode("personal");
        setSearchParams({ tab: "personal" });
    };

    const handleSwitchToClub = () => {
        setLoginMode("club");
        setSearchParams({ tab: "club" });
    };

    return (
        <AuthLayout
            title={loginMode === "personal" ? "Welcome back!" : "Club Portal Login"}
            subtitle={
                loginMode === "personal"
                    ? "Simplify your workflow and boost your productivity with Orbix. Get started for free."
                    : "Access your verified club dashboard, track review status, and manage campus events."
            }
            trigger={true}
            switchText={loginMode === "personal" ? "Not a member?" : ""}
            switchLinkText={loginMode === "personal" ? "Register now" : ""}
            switchLinkHref={loginMode === "personal" ? "/auth/signup" : ""}
            showSocialAuth={loginMode === "personal"}
            wide={false}
        >
            {/* Segmented Control / Signin-Type Selector */}
            <div className="w-full p-1 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_#000] flex items-center mb-5 select-none">
                <button
                    type="button"
                    onClick={handleSwitchToPersonal}
                    className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${loginMode === "personal"
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
                    className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${loginMode === "club"
                        ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                        : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                    aria-pressed={loginMode === "club"}
                >
                    <Users className="w-3.5 h-3.5" />
                    <span>Club Login</span>
                </button>
            </div>

            {/* Form rendered based on selected mode */}
            {loginMode === "personal" ? (
                <SigninForm />
            ) : (
                <ClubSigninForm />
            )}
        </AuthLayout>
    );
}
