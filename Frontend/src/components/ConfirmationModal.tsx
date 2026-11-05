import React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, Info, X } from "lucide-react";
import { OrbixButton } from "./OrbixButton";
import { useModalDismiss } from "../hooks/useModalDismiss";

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
    requiredInputText?: string;
    inputLabel?: React.ReactNode;
    inputPlaceholder?: string;
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
    requiredInputText,
    inputLabel,
    inputPlaceholder,
}) => {
    const [typedText, setTypedText] = React.useState("");

    React.useEffect(() => {
        if (isOpen) {
            setTypedText("");
        }
    }, [isOpen]);

    const handleClose = () => {
        if (onClose) onClose();
        else if (onCancel) onCancel();
    };

    const finalDescription = description !== undefined ? description : message;
    const finalConfirmText = confirmLabel || confirmText;
    const finalCancelText = cancelLabel || cancelText;

    const isTypedMatch = requiredInputText
        ? typedText.trim().toLowerCase() === requiredInputText.trim().toLowerCase()
        : true;
    const isConfirmDisabled = isLoading || !isTypedMatch;

    const { handleBackdropClick } = useModalDismiss({
        isOpen,
        onClose: () => {
            if (!isLoading) handleClose();
        },
        disableEscape: isLoading,
        disableBackdrop: isLoading,
    });

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

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

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmModalTitle"
            onClick={handleBackdropClick}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
        >
            <div
                className="w-full max-w-md bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] text-black space-y-4 animate-scaleUp"
                onClick={(e) => e.stopPropagation()}
            >
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

                {/* Optional Typed Confirmation Input */}
                {requiredInputText && (
                    <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-black text-neutral-800 block">
                            {inputLabel || (
                                <>
                                    To confirm, please type{" "}
                                    <span className="font-mono text-black font-black bg-neutral-100 px-1.5 py-0.5 rounded border border-black selection:bg-[#a2ff86]">
                                        {requiredInputText}
                                    </span>{" "}
                                    below:
                                </>
                            )}
                        </label>
                        <input
                            type="text"
                            value={typedText}
                            onChange={(e) => setTypedText(e.target.value)}
                            placeholder={inputPlaceholder || `Type "${requiredInputText}" to confirm`}
                            disabled={isLoading}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && isTypedMatch && !isLoading) {
                                    e.preventDefault();
                                    onConfirm();
                                }
                            }}
                            className="w-full px-3 py-2 text-xs font-mono font-bold bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:outline-hidden focus:bg-white placeholder:text-neutral-400"
                            autoFocus
                        />
                    </div>
                )}

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
                    <OrbixButton
                        loading={isLoading}
                        disabled={isConfirmDisabled}
                        loadingLabel={finalConfirmText.endsWith("...") ? finalConfirmText : `${finalConfirmText}...`}
                        onClick={onConfirm}
                        variant={variant === "danger" ? "danger-solid" : variant === "warning" ? "yellow" : "black"}
                        uppercase
                    >
                        {finalConfirmText}
                    </OrbixButton>
                </div>
            </div>
        </div>,
        document.body
    );
};
