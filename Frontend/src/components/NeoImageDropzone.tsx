import React, { useState, useRef, useId } from "react";
import { UploadCloud, Loader2, CheckCircle2, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "../context/ToastContext";

export interface NeoImageDropzoneProps {
    label?: string;
    headline?: string;
    subtext?: string;
    value?: string | null;
    onChange: (file: File) => Promise<void> | void;
    onRemove?: () => void;
    isUploading?: boolean;
    uploadProgress?: number | null;
    aspectRatio?: "square" | "banner" | "avatar";
    maxSizeMB?: number;
    recommendedNote?: string;
    allowedExtensions?: string[];
    accept?: string;
    disabled?: boolean;
    className?: string;
}

/**
 * NeoImageDropzone — Neo-Brutalist Drag & Drop File Upload Component
 * Matches the Orbix Resume and Media upload dropzone aesthetic with dashed border,
 * centered upload icon, format badges, live preview, and theme green accent buttons.
 */
export const NeoImageDropzone: React.FC<NeoImageDropzoneProps> = ({
    label,
    headline = "Drag and drop your image file here",
    subtext = "or click anywhere in this block to browse your device",
    value,
    onChange,
    onRemove,
    isUploading = false,
    uploadProgress = null,
    aspectRatio = "square",
    maxSizeMB = 5,
    recommendedNote,
    allowedExtensions = [".PNG", ".JPG", ".WEBP"],
    accept = "image/png,image/jpeg,image/webp",
    disabled = false,
    className = "",
}) => {
    const toast = useToast();
    const inputId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const validateAndProcessFile = (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please select a valid image file (PNG, JPG, or WEBP).");
            return;
        }

        if (file.size > maxSizeMB * 1024 * 1024) {
            toast.error(`Image size must be under ${maxSizeMB} MB.`);
            return;
        }

        onChange(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || isUploading) return;
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (disabled || isUploading) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            validateAndProcessFile(files[0]);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            validateAndProcessFile(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleClickDropzone = () => {
        if (!disabled && !isUploading) {
            fileInputRef.current?.click();
        }
    };

    // Render Preview container according to aspect ratio
    const renderPreviewImage = () => {
        if (!value) return null;

        if (aspectRatio === "banner") {
            return (
                <div className="w-full h-32 sm:h-44 rounded-2xl bg-white border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_#000] flex items-center justify-center">
                    <img
                        src={value}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                    />
                </div>
            );
        }

        if (aspectRatio === "avatar") {
            return (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_#000] flex items-center justify-center mx-auto">
                    <img
                        src={value}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                    />
                </div>
            );
        }

        // Default: square
        return (
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_#000] flex items-center justify-center mx-auto">
                <img
                    src={value}
                    alt="Logo Preview"
                    className="w-full h-full object-cover"
                />
            </div>
        );
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-xs font-black uppercase tracking-wider text-black">
                    {label}
                </label>
            )}

            <input
                ref={fileInputRef}
                id={inputId}
                type="file"
                accept={accept}
                onChange={handleFileInputChange}
                disabled={disabled || isUploading}
                className="hidden"
            />

            {/* Dropzone Container */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClickDropzone}
                className={`p-6 sm:p-7 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer select-none ${
                    isDragging
                        ? "bg-[#a2ff86]/20 border-black ring-2 ring-black scale-[0.99]"
                        : value
                        ? "bg-[#FAF6EE] border-black shadow-[2px_2px_0px_#000]"
                        : "bg-[#FAF6EE]/60 border-black/35 hover:border-black hover:bg-[#FAF6EE]"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
                {/* State 1: Uploading progress */}
                {isUploading ? (
                    <div className="space-y-3 py-3">
                        <div className="w-14 h-14 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <Loader2 className="w-7 h-7 text-black stroke-[2.5] animate-spin" />
                        </div>
                        <div className="space-y-1 max-w-sm mx-auto">
                            <p className="text-sm font-black text-black">
                                Uploading image to Cloudinary...
                            </p>
                            <p className="text-xs text-neutral-600 font-bold">
                                {uploadProgress !== null ? `${uploadProgress}% completed` : "Processing..."}
                            </p>
                        </div>
                        {uploadProgress !== null && (
                            <div className="w-48 max-w-full mx-auto bg-white h-2 rounded-full border border-black overflow-hidden shadow-inner">
                                <div
                                    className="bg-[#a2ff86] h-full transition-all duration-200"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}
                    </div>
                ) : value ? (
                    /* State 2: Existing Image Preview */
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        {renderPreviewImage()}

                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-neutral-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Active file ready & uploaded</span>
                        </div>

                        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={disabled}
                                className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Change Image</span>
                            </button>

                            {onRemove && (
                                <button
                                    type="button"
                                    onClick={onRemove}
                                    disabled={disabled}
                                    className="px-3.5 py-2 rounded-xl bg-white text-rose-600 hover:bg-rose-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove</span>
                                </button>
                            )}
                        </div>

                        <p className="text-[10px] text-neutral-500 font-medium">
                            Or drag and drop a new image file over this block to replace it
                        </p>
                    </div>
                ) : (
                    /* State 3: Empty Dropzone Prompt (Exact layout of Image 2) */
                    <div className="space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000] hover:scale-105 transition-transform">
                            <UploadCloud className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>

                        <div className="space-y-1 max-w-md mx-auto">
                            <p className="text-sm sm:text-base font-black text-black">
                                {headline}
                            </p>
                            <p className="text-xs text-neutral-600 font-medium">
                                {subtext}
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-neutral-600 flex-wrap">
                            {allowedExtensions.map((ext) => (
                                <span
                                    key={ext}
                                    className="px-2 py-0.5 rounded bg-white border border-black/30 shadow-[1px_1px_0px_#000] font-mono"
                                >
                                    {ext}
                                </span>
                            ))}
                            <span>• Up to {maxSizeMB} MB</span>
                        </div>

                        {recommendedNote && (
                            <p className="text-[10px] text-neutral-500 font-medium pt-0.5">
                                {recommendedNote}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeoImageDropzone;
