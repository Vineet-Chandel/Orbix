import { useEffect } from "react";

interface UseModalDismissOptions {
    isOpen?: boolean;
    onClose: () => void;
    disableEscape?: boolean;
    disableBackdrop?: boolean;
}

/**
 * Reusable hook to handle dismissing any modal via:
 * 1. Pressing the "Escape" key on the keyboard
 * 2. Clicking outside on the modal's backdrop overlay
 */
export function useModalDismiss({
    isOpen = true,
    onClose,
    disableEscape = false,
    disableBackdrop = false,
}: UseModalDismissOptions) {
    useEffect(() => {
        if (!isOpen || disableEscape) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" || e.code === "Escape") {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, disableEscape]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (disableBackdrop) return;
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return { handleBackdropClick };
}
