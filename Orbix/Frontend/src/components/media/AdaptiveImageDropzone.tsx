import React, { useState, useRef, useId } from "react";
import { UploadCloud, CheckCircle2, Trash2, RefreshCw, Crop } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader } from "../ui/loader";
import { getMediaPlacementConfig, type MediaPlacementConfig } from "./imagePlacementConfigs";
import { AdaptiveImageEditorModal } from "./AdaptiveImageEditorModal";

export interface AdaptiveImageDropzoneProps {
    placementId?: string;
    customConfig?: Partial<MediaPlacementConfig>;
    label?: string;
    headline?: string;
    subtext?: string;
    value?: string | null;
    onChange: (file: File) => Promise<void> | void;
    onRemove?: () => void;
    isUploading?: boolean;
    uploadProgress?: number | null;
    disabled?: boolean;
    className?: string;
}

export const AdaptiveImageDropzone: React.FC<AdaptiveImageDropzoneProps> = ({
    placementId = "event_banner",
    customConfig,
    label,
    headline,
    subtext,
    value,
    onChange,
    onRemove,
    isUploading = false,
    uploadProgress = null,
    disabled = false,
    className = "",
}) => {
    const toast = useToast();
    const inputId = useId();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const baseConfig = getMediaPlacementConfig(placementId);
    const config: MediaPlacementConfig = {
        ...baseConfig,
        ...customConfig,
        features: {
            ...baseConfig.features,
            ...(customConfig?.features || {}),
        },
    };

    const [isDragging, setIsDragging] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Validate file format and size
    const validateSelectedFile = (file: File): boolean => {
        if (!file.type.startsWith("image/") && !config.allowedMimeTypes.includes(file.type)) {
            toast.error("Please select a valid image file (PNG, JPG, or WEBP).");
            return false;
        }

        if (file.size > config.maxFileSizeMB * 1024 * 1024) {
            toast.error(`Image size must be under ${config.maxFileSizeMB} MB.`);
            return false;
        }

        return true;
    };

    const handleFileChosen = (file: File) => {
        if (!validateSelectedFile(file)) return;
        setPendingFile(file);
        setIsEditorOpen(true);
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
            handleFileChosen(files[0]);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileChosen(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Open editor on existing image
    const handleEditExistingFrame = () => {
        if (!value) return;
        setPendingFile(value);
        setIsEditorOpen(true);
    };

    // When framed in editor modal and confirmed
    const handleEditorConfirm = async (result: { file: File }) => {
        setIsEditorOpen(false);
        setPendingFile(null);
        await onChange(result.file);
    };

    // Compute preview container aspect ratio
    const previewRatio = config.aspectRatio;
    const isSquareOrCircle = config.shape === "circle" || config.shape === "square";

    return (
        <div className={`space-y-1.5 ${className}`}>
            {/* Optional Top Label */}
            {label && (
                <div className="flex items-center justify-between">
                    <label htmlFor={inputId} className="block text-xs font-black uppercase tracking-wider text-black">
                        {label}
                    </label>
                    <span className="text-[10px] font-bold text-neutral-500">
                        {config.title} • {config.shape === "circle" ? "1:1 Circle" : `${previewRatio}:1`}
                    </span>
                </div>
            )}

            {/* Hidden native file input */}
            <input
                ref={fileInputRef}
                id={inputId}
                type="file"
                accept={config.allowedMimeTypes.join(",")}
                onChange={handleFileInputChange}
                disabled={disabled || isUploading}
                className="hidden"
                aria-label={label || headline || "Upload image"}
            />

            {/* State A: Uploading state */}
            {isUploading ? (
                <div className="w-full rounded-2xl border-2 border-black bg-amber-50/70 p-6 shadow-[3px_3px_0px_#000] flex flex-col items-center justify-center text-center space-y-3">
                    <OrbixLoader size="sm" />
                    <div className="space-y-1">
                        <span className="text-xs font-black text-black">
                            {uploadProgress !== null ? `Uploading (${uploadProgress}%)...` : "Processing media..."}
                        </span>
                        <p className="text-[11px] font-medium text-neutral-600">
                            Uploading framed high-resolution asset to cloud storage...
                        </p>
                    </div>
                </div>
            ) : value ? (
                /* State B: Active Image Preview & Action Controls */
                <div className="rounded-2xl border-2 border-black bg-white p-3.5 shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-black text-black">Framed Image Ready</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={handleEditExistingFrame}
                                className="px-2.5 py-1 rounded-lg bg-[#FFE566] text-black text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] hover:bg-[#FDD835] flex items-center gap-1 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                title="Adjust crop, zoom, or alignment"
                            >
                                <Crop className="w-3 h-3" />
                                <span>Adjust Frame</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg bg-[#a2ff86] text-black text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] hover:bg-[#8ee673] flex items-center gap-1 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                title="Choose a different image file"
                            >
                                <RefreshCw className="w-3 h-3" />
                                <span>Replace</span>
                            </button>
                            {onRemove && (
                                <button
                                    type="button"
                                    onClick={onRemove}
                                    className="p-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-black shadow-[1px_1px_0px_#000] flex items-center justify-center cursor-pointer"
                                    title="Remove image"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Image Render Box */}
                    <div className="flex items-center justify-center p-2 rounded-xl bg-neutral-950 border-2 border-black overflow-hidden relative">
                        <div
                            className={`relative overflow-hidden ${
                                isSquareOrCircle
                                    ? "w-28 h-28 rounded-2xl border-2 border-white/20"
                                    : "w-full aspect-[2.4/1] max-h-48 rounded-lg"
                            }`}
                        >
                            <img
                                src={value}
                                alt="Framed preview"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                /* State C: Empty Dropzone Target */
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full rounded-2xl border-2 border-dashed border-black/40 bg-white p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-black hover:bg-amber-50/50 shadow-[2px_2px_0px_#000] ${
                        isDragging ? "border-black bg-amber-100/70 scale-[1.01]" : ""
                    }`}
                >
                    <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] mb-2.5">
                        <UploadCloud className="w-6 h-6 text-black stroke-[2.5]" />
                    </div>

                    <span className="text-xs font-black text-black">
                        {headline || `Drag and drop your ${config.title.toLowerCase()} here`}
                    </span>
                    <span className="text-[11px] font-bold text-neutral-500 mt-0.5">
                        {subtext || "or click to browse from your device"}
                    </span>

                    <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black/30 text-[9px] font-black uppercase text-neutral-700">
                            {config.shape === "circle" ? "1:1 Circle" : `${previewRatio}:1 Ratio`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black/30 text-[9px] font-black uppercase text-neutral-700">
                            Max {config.maxFileSizeMB} MB
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[9px] font-black uppercase text-black">
                            Adaptive Editor
                        </span>
                    </div>
                </div>
            )}

            {/* Adaptive Image Editor Modal */}
            {isEditorOpen && pendingFile && (
                <AdaptiveImageEditorModal
                    isOpen={isEditorOpen}
                    onClose={() => {
                        setIsEditorOpen(false);
                        setPendingFile(null);
                    }}
                    imageSource={pendingFile}
                    placementId={config.placementId}
                    customConfig={config}
                    onConfirm={handleEditorConfirm}
                />
            )}
        </div>
    );
};

export default AdaptiveImageDropzone;
