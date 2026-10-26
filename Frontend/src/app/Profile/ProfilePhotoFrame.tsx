import React, { useState, useRef, useEffect } from "react";
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

    // Component-level upload & action states
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Derived dimensions based on size prop
    const sizeClasses = {
        sm: "w-16 h-16 text-xs",
        md: "w-20 h-20 text-sm",
        lg: "w-24 h-24 sm:w-28 sm:h-28 text-base",
    }[size];

    // Fallback avatar URL (Cloudinary default avatar)
    const fallbackAvatar = DEFAULT_AVATAR_URL;

    const activePhotoSrc = currentPhotoUrl || fallbackAvatar;

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

    // Handle Client-Side File Selection & Direct Upload Workflow
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // 3. Start In-Frame Loading Workflow (NO Full-Page Loader!)
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
                {/* 1. Profile Image Display */}
                <img
                    src={activePhotoSrc}
                    alt={`${displayName || username}'s profile`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackAvatar;
                    }}
                />

                {/* 2. Desktop Hover Overlay (Hidden during busy state) */}
                {!isBusy && (
                    <div
                        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                        title="Click to change photo"
                    >
                        <svg className="w-5 h-5 mb-0.5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[10px] font-bold tracking-tight text-white/95">Change</span>
                    </div>
                )}

                {/* 3. CRITICAL REQUIREMENT: In-Frame Preloader (Exclusively within avatar frame!) */}
                {isBusy && (
                    <div
                        className="absolute inset-0 rounded-full bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-2 text-center animate-fadeIn"
                        role="status"
                        aria-live="polite"
                    >
                        <svg className="w-6 h-6 animate-spin text-white mb-1" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
                            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
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
                    type="button"
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    disabled={isBusy}
                    className="w-7 h-7 rounded-full bg-neutral-900 hover:bg-black text-white border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    aria-label="Profile photo options"
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen}
                    title="Profile photo actions"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </button>

                {/* Dropdown Menu for Touch, Keyboard & Explicit Actions */}
                {isMenuOpen && (
                    <div
                        className="absolute right-0 bottom-9 w-48 bg-white rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] py-1.5 z-50 animate-fadeIn text-xs font-bold text-black"
                        role="menu"
                    >
                        {/* Action 1: Change photo */}
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setIsMenuOpen(false);
                                fileInputRef.current?.click();
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center gap-2.5 transition-colors cursor-pointer text-neutral-900"
                        >
                            <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Change photo</span>
                        </button>

                        {/* Action 2: Restore previous photo (conditionally rendered) */}
                        {hasPreviousPhoto && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={handleRestore}
                                className="w-full px-3.5 py-2 text-left hover:bg-neutral-50 flex items-center justify-between gap-2.5 transition-colors cursor-pointer text-neutral-900 border-t border-neutral-100"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <svg className="w-4 h-4 text-neutral-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
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
                                <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Use default avatar</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
