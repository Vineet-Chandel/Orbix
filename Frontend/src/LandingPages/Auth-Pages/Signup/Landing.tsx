import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Users } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { AuthLayout } from "../AuthLayout";
import SignupForm from "./Form";
import ClubSignupForm from "./ClubSignupForm";
import { ClubRegistrationModal } from "./ClubRegistrationModal";

export default function SignUpPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const errorParam = searchParams.get("error");
    const redirectParam = searchParams.get("redirect") || searchParams.get("returnUrl");
    const toast = useToast();
    const hasConfirmedClubModalRef = useRef(false);
    const [isClubModalOpen, setIsClubModalOpen] = useState(() => tabParam === "club");
    const [registrationMode, setRegistrationMode] = useState<"personal" | "club">("personal");

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
            if (!hasConfirmedClubModalRef.current) {
                setIsClubModalOpen(true);
                setRegistrationMode("personal");
            } else {
                setRegistrationMode("club");
            }
        } else {
            hasConfirmedClubModalRef.current = false;
            setIsClubModalOpen(false);
            setRegistrationMode("personal");
        }
    }, [tabParam]);

    const handleSelectClub = () => {
        if (registrationMode === "club") return;
        // Mandatory: immediately open the explanatory modal before showing club form
        setIsClubModalOpen(true);
    };

    const handleConfirmClubModal = () => {
        hasConfirmedClubModalRef.current = true;
        setIsClubModalOpen(false);
        setRegistrationMode("club");
        const nextParams: Record<string, string> = { tab: "club" };
        if (redirectParam) nextParams.redirect = redirectParam;
        setSearchParams(nextParams);
    };

    const handleCancelClubModal = () => {
        hasConfirmedClubModalRef.current = false;
        setIsClubModalOpen(false);
        setRegistrationMode("personal");
        const nextParams: Record<string, string> = { tab: "personal" };
        if (redirectParam) nextParams.redirect = redirectParam;
        setSearchParams(nextParams);
    };

    const handleSwitchToPersonal = () => {
        hasConfirmedClubModalRef.current = false;
        setIsClubModalOpen(false);
        setRegistrationMode("personal");
        const nextParams: Record<string, string> = { tab: "personal" };
        if (redirectParam) nextParams.redirect = redirectParam;
        setSearchParams(nextParams);
    };

    return (
        <>
            <AuthLayout
                title={registrationMode === "personal" ? "Create an account" : "Register your club"}
                subtitle={
                    registrationMode === "personal"
                        ? "Simplify your workflow and boost your productivity with Orbix. Get started for free."
                        : "Join the verified Orbix ecosystem for collegiate clubs, student developer communities, and tech teams."
                }
                trigger={false}
                switchText={registrationMode === "personal" ? "Already a member?" : "Already registered your club?"}
                switchLinkText="Log in"
                switchLinkHref={
                    registrationMode === "personal"
                        ? (redirectParam ? `/auth/signin?redirect=${encodeURIComponent(redirectParam)}` : "/auth/signin")
                        : (redirectParam ? `/auth/signin?tab=club&redirect=${encodeURIComponent(redirectParam)}` : "/auth/signin?tab=club")
                }
                showSocialAuth={registrationMode === "personal"}
                wide={registrationMode === "club"}
            >
                {/* Segmented Control / Registration-Type Selector */}
                <div className="w-full p-1 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_#000] flex items-center mb-5 select-none">
                    <button
                        type="button"
                        onClick={handleSwitchToPersonal}
                        className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            registrationMode === "personal"
                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        aria-pressed={registrationMode === "personal"}
                    >
                        <User className="w-3.5 h-3.5" />
                        <span>Personal Account</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSelectClub}
                        className={`flex-1 py-2 px-3 rounded-full text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            registrationMode === "club"
                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        aria-pressed={registrationMode === "club"}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Club Registration</span>
                    </button>
                </div>

                {/* Form rendered based on selected mode */}
                {registrationMode === "personal" ? (
                    <SignupForm />
                ) : (
                    <ClubSignupForm onSwitchToPersonal={handleSwitchToPersonal} />
                )}
            </AuthLayout>

            {/* Mandatory Explanatory Modal */}
            <ClubRegistrationModal
                isOpen={isClubModalOpen}
                onContinue={handleConfirmClubModal}
                onCancel={handleCancelClubModal}
            />
        </>
    );
}
