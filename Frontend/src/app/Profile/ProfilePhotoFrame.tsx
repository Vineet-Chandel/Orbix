import React, { useState, useRef, useEffect } from "react";
import {
    Eye,
    Camera,
    MoreVertical,
    Image as ImageIcon,
    Crop,
    RotateCcw,
    Trash2,
    Loader2,
} from "lucide-react";
import { useAppDispatch } from "../../store";
import { updateUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import {
    requestPhotoUploadSignature,
    uploadPhotoToCloudinary,
    confirmPhotoUpload,
    restorePreviousPhoto,
    useDefaultAvatar,
} from "../../utils/profileApi";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import { AdaptiveImageEditorModal } from "../../components/media/AdaptiveImageEditorModal";
import { useAvatarViewer } from "../../components/media/EnlargeableAvatar";
import { ProfilePhotoViewerModal } from "./ProfilePhotoViewerModal";

interface ProfilePhotoFrameProps {
    currentPhotoUrl?: string | null;
    hasPreviousPhoto?: boolean;
    previousPhotoUrl?: string | null;
    displayName: string;
    username: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export const ProfilePhotoFrame: React.FC<ProfilePhotoFrameProps> = ({
    currentPhotoUrl,
    hasPreviousPhoto = false,
    previousPhotoUrl,
    displayName,
    username,
    className = "",
    size = "lg",
}) => {
    const dispatch = useAppDispatch();
    const toast = useToast();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const avatarButtonRef = useRef<HTMLButtonElement>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);

    // Component-level upload & action states
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [menuOpenDown, setMenuOpenDown] = useState(false);

    // Adaptive Image Editor state
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorSource, setEditorSource] = useState<File | string | null>(null);

    // Derived dimensions based on size prop
    const sizeClasses = {
        sm: "w-16 h-16 text-xs",
        md: "w-20 h-20 text-sm",
        lg: "w-24 h-24 sm:w-28 sm:h-28 text-base",
    }[size];

    // Fallback avatar URL (Cloudinary default avatar)
    const fallbackAvatar = DEFAULT_AVATAR_URL;

    const activePhotoSrc = currentPhotoUrl || fallbackAvatar;

    // Shared read-only enlarged photo viewer hook
    const {
        isViewerOpen,
        hasViewablePhoto,
        openViewer,
        closeViewer,
        markImageFailed,
        returnFocusTo,
    } = useAvatarViewer(currentPhotoUrl);

    const handleOpenViewer = (triggerEl?: HTMLElement | null) => {
        if (!hasViewablePhoto) return;
        setIsMenuOpen(false);
        openViewer(triggerEl || avatarButtonRef.current);
    };

    // Close mobile/accessible menu on outside click or Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isMenuOpen) {
                setIsMenuOpen(false);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isMenuOpen]);

    // Handle Client-Side File Selection: Opens Adaptive Image Editor
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Reset file input so re-selecting same file works
        e.target.value = "";

        if (!file) return;

        // 1. Client-Side Format Validation
        const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validMimeTypes.includes(file.type.toLowerCase())) {
            toast.error("Please select a valid image file (JPEG, PNG, or WebP).", {
                title: "Unsupported Format",
            });
            return;
        }

        // 2. Client-Side Size Validation (Max 5 MB)
        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
            toast.error("Image file size must be less than 5 MB.", {
                title: "File Too Large",
            });
            return;
        }

        setEditorSource(file);
        setIsEditorOpen(true);
        setIsMenuOpen(false);
    };

    // Upload framed high-resolution file produced by Adaptive Image Editor
    const handleUploadFramedFile = async (file: File) => {
        setIsUploading(true);
        setUploadProgress(0);
        setStatusMessage("Preparing...");
        setIsMenuOpen(false);

        try {
            // Step A: Request signature from server
            setStatusMessage("Signing...");
            const uploadConfig = await requestPhotoUploadSignature();

            // Step B: Direct Browser Upload to Cloudinary with progress
            setStatusMessage("Uploading...");
            const uploadResult = await uploadPhotoToCloudinary(
                uploadConfig,
                file,
                (percent) => {
                    setUploadProgress(percent);
                    setStatusMessage(`${percent}%`);
                }
            );

            // Step C: Confirm and persist atomically in database
            setStatusMessage("Saving...");
            const confirmResult = await confirmPhotoUpload(
                uploadResult.publicId,
                uploadResult.version
            );

            // 4. Update Redux store on success
            dispatch(
                updateUserProfile({
                    photoUrl: confirmResult.photoUrl,
                    avatarUrl: confirmResult.photoUrl,
                    hasPreviousPhoto: confirmResult.hasPreviousPhoto,
                    previousPhotoUrl: confirmResult.previousPhotoUrl,
                })
            );

            toast.success("Profile photo updated successfully!", {
                title: "Photo Updated",
            });
        } catch (err: any) {
            console.error("Profile photo upload failed:", err);
            toast.error(err?.message || "Failed to update profile photo. Please try again.", {
                title: "Upload Failed",
            });
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
            setStatusMessage("");
        }
    };

    // Action: Restore Previous Photo
    const handleRestore = async () => {
        if (!hasPreviousPhoto || isRestoring || isUploading || isResetting) return;
        setIsRestoring(true);
        setStatusMessage("Restoring...");
        setIsMenuOpen(false);

        try {
            const result = await restorePreviousPhoto();

            dispatch(
                updateUserProfile({
                    photoUrl: result.photoUrl,
                    avatarUrl: result.photoUrl,
                    hasPreviousPhoto: result.hasPreviousPhoto,
                    previousPhotoUrl: result.previousPhotoUrl,
                })
            );

            toast.success("Previous profile photo restored!", {
                title: "Photo Restored",
            });
        } catch (err: any) {
            console.error("Restore photo failed:", err);
            toast.error(err?.message || "Failed to restore previous photo.", {
                title: "Restore Failed",
            });
        } finally {
            setIsRestoring(false);
            setStatusMessage("");
        }
    };

    // Action: Use Default Avatar
    const handleResetToDefault = async () => {
        if (!currentPhotoUrl || isResetting || isUploading || isRestoring) return;
        setIsResetting(true);
        setStatusMessage("Resetting...");
        setIsMenuOpen(false);

        try {
            const result = await useDefaultAvatar();

            dispatch(
                updateUserProfile({
                    photoUrl: null,
                    avatarUrl: null,
                    hasPreviousPhoto: result.hasPreviousPhoto,
                    previousPhotoUrl: result.previousPhotoUrl,
                })
            );

            toast.info("Profile photo reset to default avatar.", {
                title: "Default Avatar Applied",
            });
        } catch (err: any) {
            console.error("Reset avatar failed:", err);
            toast.error(err?.message || "Failed to apply default avatar.", {
                title: "Reset Failed",
            });
        } finally {
            setIsResetting(false);
            setStatusMessage("");
        }
    };

    const isBusy = isUploading || isRestoring || isResetting;

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            {/* Hidden native file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={isBusy}
                aria-label="Upload profile photo"
            />

            {/* Avatar Frame Container */}
            <div
                className={`group relative ${sizeClasses} rounded-full overflow-hidden border-2 border-black shadow-[3px_3px_0px_#000] bg-neutral-100 flex-shrink-0 select-none transition-transform hover:scale-[1.02] focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2`}
                aria-busy={isBusy}
            >
                {/* 1. Interactive Profile Avatar Trigger (Tap/Click to View; Placeholder taps to Upload) */}
                <button
                    ref={avatarButtonRef}
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                        if (hasViewablePhoto) {
                            handleOpenViewer(avatarButtonRef.current);
                        } else {
                            fileInputRef.current?.click();
                        }
                    }}
                    aria-label={hasViewablePhoto ? "View profile photo" : "Upload profile photo"}
                    title={hasViewablePhoto ? "View profile photo" : "Click to change photo"}
                    className={`orbix-avatar-trigger block w-full h-full rounded-full overflow-hidden p-0 border-0 bg-transparent focus-visible:outline-none ${
                        hasViewablePhoto ? "cursor-zoom-in" : "cursor-pointer"
                    }`}
                >
                    <img
                        src={activePhotoSrc}
                        alt={`${displayName || username}'s profile`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackAvatar;
                            markImageFailed();
                        }}
                    />
                </button>

                {/* 2. Desktop Hover Overlay for Default Placeholder (Hidden during busy state; non-intercepting on touch devices) */}
                {!isBusy && !hasViewablePhoto && (
                    <div
                        className="orbix-avatar-hover-overlay absolute inset-0 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col items-center justify-center text-white"
                        aria-hidden="true"
                    >
                        <Camera className="w-5 h-5 mb-0.5 text-white/90 stroke-[2.2]" />
                        <span className="text-[10px] font-bold tracking-tight text-white/95">Upload</span>
                    </div>
                )}

                {/* 3. CRITICAL REQUIREMENT: In-Frame Preloader (Exclusively within avatar frame!) */}
                {isBusy && (
                    <div
                        className="absolute inset-0 rounded-full bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2 text-center animate-fadeIn"
                        role="status"
                        aria-live="polite"
                    >
                        <Loader2 className="w-6 h-6 animate-spin text-white mb-1" />
                        <span className="text-[10px] font-extrabold tracking-tight leading-none text-white truncate max-w-full">
                            {statusMessage || "Working..."}
                        </span>
                        {uploadProgress !== null && uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="w-10 bg-white/20 rounded-full h-1 mt-1.5 overflow-hidden">
                                <div
                                    className="bg-white h-full rounded-full transition-all duration-200"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Touch & Accessible Options Menu Trigger Button */}
            <div className="absolute -bottom-1 -right-1 z-10">
                <button
                    ref={menuTriggerRef}
                    type="button"
                    onClick={() => {
                        setIsMenuOpen((prev) => {
                            if (!prev && menuTriggerRef.current) {
                                const rect = menuTriggerRef.current.getBoundingClientRect();
                                setMenuOpenDown(rect.top < 220);
                            }
                            return !prev;
                        });
                    }}
                    disabled={isBusy}
                    className="w-7 h-7 rounded-full bg-neutral-900 hover:bg-black text-white border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    aria-label="Profile photo options"
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen}
                    title="Profile photo actions"
                >
                    <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                {/* Dropdown Menu for Touch, Keyboard & Explicit Actions */}
                {isMenuOpen && (
                    <div
                        className={`absolute right-0 ${menuOpenDown ? "top-9" : "bottom-9"} w-48 bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] py-1.5 z-50 animate-fadeIn text-xs font-bold text-black`}
                        role="menu"
                    >
                        {/* Action 0: View Photo (read-only enlarged viewer, hidden when placeholder only) */}
                        {hasViewablePhoto && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleOpenViewer(menuTriggerRef.current)}
                                className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2.5 transition-colors cursor-pointer text-neutral-900"
                            >
                                <Eye className="w-4 h-4 text-neutral-600 stroke-[2]" />
                                <span>View Photo</span>
                            </button>
                        )}

                        {/* Action 1: Change photo */}
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setIsMenuOpen(false);
                                fileInputRef.current?.click();
                            }}
                            className={`w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2.5 transition-colors cursor-pointer text-neutral-900 ${
                                hasViewablePhoto ? "border-t border-neutral-100" : ""
                            }`}
                        >
                            <ImageIcon className="w-4 h-4 text-neutral-600 stroke-[2]" />
                            <span>Change photo</span>
                        </button>

                        {/* Action 1.5: Adjust / Reposition Frame */}
                        {Boolean(currentPhotoUrl) && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    setEditorSource(currentPhotoUrl!);
                                    setIsEditorOpen(true);
                                }}
                                className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2.5 transition-colors cursor-pointer text-neutral-900 border-t border-neutral-100"
                            >
                                <Crop className="w-4 h-4 text-neutral-600 stroke-[2]" />
                                <span>Adjust / Reposition</span>
                            </button>
                        )}

                        {/* Action 2: Restore previous photo (conditionally rendered) */}
                        {hasPreviousPhoto && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleRestore}
                                className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center justify-between gap-2.5 transition-colors cursor-pointer text-neutral-900 border-t border-neutral-100"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <RotateCcw className="w-4 h-4 text-neutral-600 flex-shrink-0 stroke-[2]" />
                                    <span className="truncate">Restore previous</span>
                                </div>
                                {previousPhotoUrl && (
                                    <img
                                        src={previousPhotoUrl}
                                        alt="Previous avatar preview"
                                        className="w-5 h-5 rounded-full object-cover border border-neutral-300 flex-shrink-0"
                                    />
                                )}
                            </button>
                        )}

                        {/* Action 3: Use default avatar (conditionally rendered when custom photo is active) */}
                        {Boolean(currentPhotoUrl) && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleResetToDefault}
                                className="w-full px-3.5 py-2 text-left hover:bg-rose-50 text-rose-700 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-neutral-100"
                            >
                                <Trash2 className="w-4 h-4 text-rose-500 stroke-[2]" />
                                <span>Use default avatar</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Read-Only Profile Photo Viewer Modal */}
            {isViewerOpen && (
                <ProfilePhotoViewerModal
                    isOpen={isViewerOpen}
                    onClose={closeViewer}
                    imageUrl={currentPhotoUrl}
                    displayName={displayName}
                    username={username}
                    alt="Your profile photo"
                    returnFocusTo={returnFocusTo}
                    onImageError={markImageFailed}
                />
            )}

            {/* Adaptive Image Editor Modal */}
            {isEditorOpen && editorSource && (
                <AdaptiveImageEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => {
                        setIsEditorOpen(false);
                        setEditorSource(null);
                    }}
                    imageSource={editorSource}
                    placementId="user_avatar"
                    onConfirm={(result) => handleUploadFramedFile(result.file)}
                />
            )}
        </div>
    );
};
