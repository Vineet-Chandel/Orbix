import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalDismiss } from "../../hooks/useModalDismiss";

interface ProfilePhotoViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null | undefined;
    displayName?: string | null;
    username?: string | null;
    alt?: string;
    returnFocusTo?: HTMLElement | null;
    onImageError?: () => void;
}

const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ProfilePhotoViewerModal: React.FC<ProfilePhotoViewerModalProps> = ({
    isOpen,
    onClose,
    imageUrl,
    displayName,
    username,
    alt,
    returnFocusTo,
    onImageError,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const savedReturnFocusRef = useRef<HTMLElement | null>(null);
    const [isImageLoaded, setIsImageLoaded] = useState(false);

    const normalizedHandle =
        username && username.trim() && username.trim().toLowerCase() !== "undefined"
            ? username.trim().replace(/^@+/, "")
            : "";
    const resolvedName =
        (displayName && displayName.trim() && displayName.trim().toLowerCase() !== "undefined"
            ? displayName.trim()
            : "") || normalizedHandle;
    const showMeta = Boolean(resolvedName || normalizedHandle);

    const accessibleLabel = resolvedName ? `Profile photo of ${resolvedName}` : "Profile photo";
    const resolvedAlt = alt || (resolvedName ? `Profile photo of ${resolvedName}` : "Your profile photo");

    const { handleBackdropClick } = useModalDismiss({
        isOpen: isOpen && Boolean(imageUrl),
        onClose,
    });

    // Reset loaded state when imageUrl changes or modal reopens
    useEffect(() => {
        if (!isOpen || !imageUrl) {
            setIsImageLoaded(false);
            return;
        }
        if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
            setIsImageLoaded(true);
        } else {
            setIsImageLoaded(false);
        }
    }, [isOpen, imageUrl]);

    // Lock background scroll & manage focus trap / focus restoration while open
    useEffect(() => {
        if (!isOpen || !imageUrl) return;

        savedReturnFocusRef.current =
            returnFocusTo || (document.activeElement instanceof HTMLElement ? document.activeElement : null);

        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";

        const rafId = window.requestAnimationFrame(() => {
            closeButtonRef.current?.focus();
        });

        const handleTrapKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "Tab") return;
            const dialog = dialogRef.current;
            if (!dialog) return;

            const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (e.shiftKey) {
                if (active === first || !dialog.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last || !dialog.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleTrapKeyDown);

        return () => {
            window.cancelAnimationFrame(rafId);
            document.removeEventListener("keydown", handleTrapKeyDown);
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;

            const target = savedReturnFocusRef.current;
            savedReturnFocusRef.current = null;
            if (target && document.contains(target)) {
                target.focus();
            }
        };
    }, [isOpen, imageUrl, returnFocusTo]);

    if (!isOpen || !imageUrl) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={accessibleLabel}
            onClick={handleBackdropClick}
            className="orbix-photo-viewer-backdrop fixed inset-0 z-[120] flex items-center justify-center"
        >
            {/* Minimal translucent circular close button in top-right safe area */}
            <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="orbix-photo-viewer-close"
                aria-label="Close photo viewer"
            >
                <X className="w-5 h-5 stroke-[2.25]" />
            </button>

            {/* Centered circular photo + optional user name & handle group */}
            <div
                onClick={(e) => e.stopPropagation()}
                className="orbix-photo-viewer-dialog"
            >
                <div className="orbix-photo-viewer-circle">
                    <img
                        ref={imgRef}
                        src={imageUrl}
                        alt={resolvedAlt}
                        referrerPolicy="no-referrer"
                        onLoad={() => setIsImageLoaded(true)}
                        onError={() => {
                            onImageError?.();
                            onClose();
                        }}
                        className={`orbix-photo-viewer-img select-none ${
                            isImageLoaded ? "is-loaded" : ""
                        }`}
                    />
                </div>

                {showMeta && (
                    <div className="orbix-photo-viewer-meta">
                        {resolvedName && (
                            <p className="orbix-photo-viewer-name font-sans">
                                {resolvedName}
                            </p>
                        )}
                        {normalizedHandle && (
                            <p className="orbix-photo-viewer-handle font-mono">
                                @{normalizedHandle}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
