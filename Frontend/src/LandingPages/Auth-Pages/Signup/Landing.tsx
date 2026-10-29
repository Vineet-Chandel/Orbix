import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Users } from "lucide-react";
import { AuthLayout } from "../AuthLayout";
import SignupForm from "./Form";
import ClubSignupForm from "./ClubSignupForm";
import { ClubRegistrationModal } from "./ClubRegistrationModal";

export default function SignUpPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [registrationMode, setRegistrationMode] = useState<"personal" | "club">(
        tabParam === "club" ? "club" : "personal"
    );
    const [isClubModalOpen, setIsClubModalOpen] = useState(false);

    useEffect(() => {
        if (tabParam === "club") {
            setRegistrationMode("club");
        } else if (tabParam === "personal") {
            setRegistrationMode("personal");
        }
    }, [tabParam]);

    const handleSelectClub = () => {
        // Mandatory: immediately open the explanatory modal before showing club form
        setIsClubModalOpen(true);
    };

    const handleConfirmClubModal = () => {
        setIsClubModalOpen(false);
        setRegistrationMode("club");
        setSearchParams({ tab: "club" });
    };

    const handleCancelClubModal = () => {
        setIsClubModalOpen(false);
        setRegistrationMode("personal");
        setSearchParams({ tab: "personal" });
    };

    const handleSwitchToPersonal = () => {
        setRegistrationMode("personal");
        setSearchParams({ tab: "personal" });
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
                switchLinkHref={registrationMode === "personal" ? "/auth/signin" : "/auth/signin?tab=club"}
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
