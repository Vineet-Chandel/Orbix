import React, { useEffect } from "react";
import { AlertTriangle, Trash2, Info, X, Loader2 } from "lucide-react";

export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onCancel?: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description?: React.ReactNode;
    message?: React.ReactNode;
    confirmText?: string;
    confirmLabel?: string;
    cancelText?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "primary" | "neutral";
    icon?: React.ReactNode;
    isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onCancel,
    onConfirm,
    title,
    description,
    message,
    confirmText = "Confirm",
    confirmLabel,
    cancelText = "Cancel",
    cancelLabel,
    variant = "danger",
    icon,
    isLoading = false,
}) => {
    const handleClose = () => {
        if (onClose) onClose();
        else if (onCancel) onCancel();
    };

    const finalDescription = description !== undefined ? description : message;
    const finalConfirmText = confirmLabel || confirmText;
    const finalCancelText = cancelLabel || cancelText;

    // ESC key closes modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isLoading) {
                handleClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isLoading, onClose, onCancel]);

    if (!isOpen) return null;

    const getIcon = () => {
        if (icon) return icon;
        if (variant === "danger") {
            return <Trash2 className="w-5 h-5 text-rose-600 stroke-[2.5]" />;
        }
        if (variant === "warning") {
            return <AlertTriangle className="w-5 h-5 text-amber-600 stroke-[2.5]" />;
        }
        return <Info className="w-5 h-5 text-blue-600 stroke-[2.5]" />;
    };

    const getIconContainerColor = () => {
        if (variant === "danger") return "bg-rose-100 border-black";
        if (variant === "warning") return "bg-[#FFE566] border-black";
        return "bg-blue-100 border-black";
    };

    const getConfirmButtonStyles = () => {
        if (variant === "danger") {
            return "bg-rose-600 hover:bg-rose-700 text-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000]";
        }
        if (variant === "warning") {
            return "bg-[#FFE566] hover:bg-[#ffe043] text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000]";
        }
        return "bg-black hover:bg-neutral-800 text-white border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000]";
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmModalTitle"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isLoading) {
                    handleClose();
                }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
        >
            <div className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] text-black space-y-4 animate-scaleUp">
                {/* Header with Icon and Close Button */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0 ${getIconContainerColor()}`}
                        >
                            {getIcon()}
                        </div>
                        <h3
                            id="confirmModalTitle"
                            className="text-base sm:text-lg font-black tracking-tight text-black"
                        >
                            {title}
                        </h3>
                    </div>
                    {!isLoading && (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-1 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer shrink-0 transition-transform hover:scale-105 active:scale-95"
                            aria-label="Close dialog"
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    )}
                </div>

                {/* Description Body */}
                <div className="text-xs sm:text-sm font-medium text-neutral-600 leading-relaxed pl-0.5">
                    {typeof finalDescription === "string" ? <p>{finalDescription}</p> : finalDescription}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-black/10">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] cursor-pointer disabled:opacity-50 transition-all"
                    >
                        {finalCancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonStyles()}`}
                    >
                        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{finalConfirmText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
