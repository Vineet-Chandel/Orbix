import { useEffect, useRef, type FC } from "react";
import {
    ShieldCheck,
    FileText,
    Search,
    PhoneCall,
    CheckCircle,
    Lock,
    X,
    ArrowRight,
} from "lucide-react";

interface ClubRegistrationModalProps {
    isOpen: boolean;
    onContinue: () => void;
    onCancel: () => void;
}

export const ClubRegistrationModal: FC<ClubRegistrationModalProps> = ({
    isOpen,
    onContinue,
    onCancel,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const continueBtnRef = useRef<HTMLButtonElement>(null);

    // Keyboard accessibility: Escape key to cancel & auto-focus continue button
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onCancel();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        continueBtnRef.current?.focus();

        // Lock background body scroll while modal is active
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const steps = [
        {
            number: "Step 1",
            title: "Submit your application",
            description:
                "Provide your club name, college details, and information about the person representing the club.",
            icon: FileText,
            badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
        },
        {
            number: "Step 2",
            title: "Orbix reviews the information",
            description:
                "The Orbix team will check the application for completeness and assess whether the college and the claimed club can be identified.",
            icon: Search,
            badgeColor: "bg-sky-100 text-sky-900 border-sky-300",
        },
        {
            number: "Step 3",
            title: "College verification",
            description:
                "The Orbix team may contact the college or an appropriate college representative to confirm that the club exists, that it is associated with the stated institution, and that the applicant is authorized to represent it.",
            icon: PhoneCall,
            badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300",
        },
        {
            number: "Step 4",
            title: "Verification decision",
            description:
                "The request may be approved for the next onboarding stage, placed on hold while further information is collected, or rejected if the details cannot be verified.",
            icon: CheckCircle,
            badgeColor: "bg-purple-100 text-purple-900 border-purple-300",
        },
        {
            number: "Step 5",
            title: "Access to Orbix",
            description:
                "Only clubs that pass the verification process can proceed toward the future club-specific Orbix experience. Registration alone does not provide access to the existing personal-user dashboard or other user features.",
            icon: Lock,
            badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
        },
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-modal-heading"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div
                ref={modalRef}
                className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#FAF6EE] text-neutral-900 border-3 border-black shadow-[8px_8px_0px_#000] overflow-hidden select-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="flex items-start justify-between p-5 sm:p-7 border-b-2 border-black bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-6 h-6 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-white mb-1">
                                Verification Required
                            </div>
                            <h2
                                id="club-modal-heading"
                                className="text-xl sm:text-2xl font-black text-black tracking-tight"
                            >
                                Before You Register Your Club
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center text-black cursor-pointer transition-all"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-5 sm:p-7 overflow-y-auto space-y-5 text-sm font-sans">
                    {/* Introductory Note */}
                    <div className="p-4 rounded-2xl bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] text-neutral-800 leading-relaxed">
                        <p className="font-bold text-black mb-1.5">
                            Orbix welcomes college clubs that can be verified by their respective institutions.
                        </p>
                        <p className="text-xs sm:text-sm text-neutral-700">
                            To maintain a trustworthy developer ecosystem, every club registration request must undergo verification by the Orbix team. Submitting this application does not automatically approve your club or provide access to club features.
                        </p>
                    </div>

                    {/* Step-by-Step Procedure */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-3 px-1">
                            Application & Verification Procedure:
                        </h3>

                        <div className="space-y-3">
                            {steps.map((step, idx) => {
                                const Icon = step.icon;
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-xl bg-neutral-100 border-2 border-black flex items-center justify-center shrink-0 mt-0.5 shadow-[1px_1px_0px_#000]">
                                            <Icon className="w-4 h-4 text-black" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${step.badgeColor}`}
                                                >
                                                    {step.number}
                                                </span>
                                                <h4 className="font-black text-black text-xs sm:text-sm">
                                                    {step.title}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                                                {step.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Final Authority Disclosure */}
                    <div className="p-3.5 rounded-2xl bg-white/80 border-2 border-black/30 text-xs text-neutral-600 font-medium">
                        <p>
                            <strong className="text-black font-black">Notice: </strong>
                            Orbix makes the final verification decision. Submissions with incomplete information or unconfirmed authorization may be placed on hold or rejected.
                        </p>
                    </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="p-4 sm:p-6 border-t-2 border-black bg-white flex flex-col-reverse sm:flex-row items-center justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#FAF6EE] hover:bg-[#ede5d6] text-black text-xs sm:text-sm font-bold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                    >
                        Cancel
                    </button>

                    <button
                        ref={continueBtnRef}
                        type="button"
                        onClick={onContinue}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-black text-white text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                    >
                        <span>Continue to Club Registration</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>
            </div>
        </div>
    );
};
