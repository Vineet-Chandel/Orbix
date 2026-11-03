import React from "react";
import { AlertCircle, X, ArrowRight, ShieldAlert } from "lucide-react";
import { useModalDismiss } from "../../../hooks/useModalDismiss";

interface PublishValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    missingItems: string[];
    onGoToStep: (stepNumber: number) => void;
}

export const PublishValidationModal: React.FC<PublishValidationModalProps> = ({
    isOpen,
    onClose,
    missingItems,
    onGoToStep,
}) => {
    const { handleBackdropClick } = useModalDismiss({ isOpen, onClose });

    if (!isOpen) return null;

    const getItemTargetStep = (item: string): { step: number; label: string } => {
        const lower = item.toLowerCase();
        if (lower.includes("name") || lower.includes("category") || lower.includes("institution")) {
            return { step: 1, label: "Identity" };
        }
        if (lower.includes("about") || lower.includes("story") || lower.includes("logo") || lower.includes("banner")) {
            return { step: 2, label: "Brand & Story" };
        }
        if (lower.includes("coordinator") || lower.includes("contact")) {
            return { step: 3, label: "People & Contact" };
        }
        if (lower.includes("link") || lower.includes("achievement")) {
            return { step: 4, label: "Links & Achievements" };
        }
        return { step: 1, label: "Identity" };
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-md overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 bg-[#FFE566] border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-black" />
                        <h3 className="text-sm font-black text-black uppercase tracking-wider">
                            Profile Incomplete for Publishing
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg border border-black bg-white hover:bg-neutral-100 cursor-pointer"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                        To maintain chapter credibility in the Orbix Directory, please complete the essential required fields before publishing publicly:
                    </p>

                    <div className="space-y-2.5">
                        {missingItems.map((item, idx) => {
                            const target = getItemTargetStep(item);
                            return (
                                <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-[#FAF6EE] border border-black flex items-center justify-between gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span className="text-xs font-black text-black">{item}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onGoToStep(target.step);
                                        }}
                                        className="inline-flex items-center gap-1 text-[11px] font-black text-black hover:underline shrink-0 cursor-pointer"
                                    >
                                        <span>Go to {target.label}</span>
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
                        <strong>Draft Mode Available:</strong> You can save incomplete profiles as a Draft anytime without publishing.
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[#FAF6EE] border-t border-black/10 flex items-center justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        Got it, I'll update
                    </button>
                </div>
            </div>
        </div>
    );
};
