import React, { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import { ProfilePhotoViewerModal } from "../../app/Profile/ProfilePhotoViewerModal";

/**
 * Returns true only when the URL represents a real profile image
 * (non-empty and not the generic default placeholder avatar).
 */
export function isViewableAvatarUrl(url?: string | null): url is string {
    return Boolean(url && url.trim() && url !== DEFAULT_AVATAR_URL);
}

/**
 * Reusable hook to manage read-only enlarged avatar viewer state,
 * image-error fallback detection, and focus restoration.
 */
export function useAvatarViewer(imageUrl?: string | null) {
    const [isOpen, setIsOpen] = useState(false);
    const [imgLoadFailed, setImgLoadFailed] = useState(false);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    const hasViewablePhoto = isViewableAvatarUrl(imageUrl) && !imgLoadFailed;

    useEffect(() => {
        setImgLoadFailed(false);
    }, [imageUrl]);

    useEffect(() => {
        if (!hasViewablePhoto && isOpen) {
            setIsOpen(false);
        }
    }, [hasViewablePhoto, isOpen]);

    const openViewer = useCallback(
        (triggerEl?: HTMLElement | null) => {
            if (!hasViewablePhoto) return;
            returnFocusRef.current =
                triggerEl ||
                (document.activeElement instanceof HTMLElement ? document.activeElement : null);
            setIsOpen(true);
        },
        [hasViewablePhoto]
    );

    const closeViewer = useCallback(() => {
        setIsOpen(false);
    }, []);

    const markImageFailed = useCallback(() => {
        setImgLoadFailed(true);
    }, []);

    return {
        isViewerOpen: isOpen && hasViewablePhoto,
        hasViewablePhoto,
        openViewer,
        closeViewer,
        markImageFailed,
        returnFocusTo: returnFocusRef.current,
    };
}

interface EnlargeableAvatarProps {
    /** Canonical photo URL (custom, provider, or null/default). */
    src?: string | null;
    /** Accessible alt text for the avatar image. */
    alt: string;
    /** Visual classes applied to the avatar box (size, border, rounded, shadow, etc.). */
    className?: string;
    /** Optional classes applied to the inner <img> when rendered inside the button wrapper. */
    imgClassName?: string;
    /** Optional fallback image URL when src is empty or fails to load (defaults to DEFAULT_AVATAR_URL). Pass null to render fallbackNode instead. */
    fallbackSrc?: string | null;
    /** Optional fallback node (e.g. initials) rendered when src is absent/broken and fallbackSrc is null. */
    fallbackNode?: React.ReactNode;
    /** Optional display name shown below the photo in the enlarged viewer. */
    displayName?: string | null;
    /** Optional username/handle (without @) shown below the display name in the enlarged viewer. */
    username?: string | null;
    /** Accessible label for the enlarge trigger button. */
    ariaLabel?: string;
    /** Optional alt text for the enlarged viewer image. */
    viewerAlt?: string;
    /** Optional title attribute. */
    title?: string;
    /** Optional referrerPolicy for external provider avatars. */
    referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

/**
 * Shared standalone avatar component that opens ProfilePhotoViewerModal
 * on tap/click (and Enter/Space) when a real non-placeholder image exists.
 * Preserves the avatar's exact visual appearance (adding only cursor: zoom-in
 * and a keyboard focus ring). Never use inside an already interactive parent.
 */
export const EnlargeableAvatar: React.FC<EnlargeableAvatarProps> = ({
    src,
    alt,
    className = "",
    imgClassName = "w-full h-full object-cover object-center",
    fallbackSrc = DEFAULT_AVATAR_URL,
    fallbackNode,
    displayName,
    username,
    ariaLabel,
    viewerAlt,
    title,
    referrerPolicy = "no-referrer",
}) => {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const {
        isViewerOpen,
        hasViewablePhoto,
        openViewer,
        closeViewer,
        markImageFailed,
        returnFocusTo,
    } = useAvatarViewer(src);

    const displaySrc = hasViewablePhoto ? src : fallbackSrc;

    if (!hasViewablePhoto) {
        if (!displaySrc && fallbackNode !== undefined) {
            return <>{fallbackNode}</>;
        }
        return (
            <img
                src={displaySrc || DEFAULT_AVATAR_URL}
                alt={alt}
                title={title}
                referrerPolicy={referrerPolicy}
                className={className}
                onError={(e) => {
                    if (fallbackSrc) {
                        (e.currentTarget as HTMLImageElement).src = fallbackSrc;
                    }
                }}
            />
        );
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => openViewer(triggerRef.current)}
                aria-label={ariaLabel || `View ${alt || "profile"} photo`}
                title={title || "Click to view photo"}
                className={`orbix-avatar-trigger p-0 overflow-hidden cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${className}`}
            >
                <img
                    src={src!}
                    alt={alt}
                    referrerPolicy={referrerPolicy}
                    className={imgClassName}
                    onError={(e) => {
                        markImageFailed();
                        if (fallbackSrc) {
                            (e.currentTarget as HTMLImageElement).src = fallbackSrc;
                        }
                    }}
                />
            </button>

            {isViewerOpen && (
                <ProfilePhotoViewerModal
                    isOpen={isViewerOpen}
                    onClose={closeViewer}
                    imageUrl={src}
                    displayName={displayName}
                    username={username}
                    alt={viewerAlt || `${alt || "User"}'s profile photo`}
                    returnFocusTo={returnFocusTo}
                    onImageError={markImageFailed}
                />
            )}
        </>
    );
};
