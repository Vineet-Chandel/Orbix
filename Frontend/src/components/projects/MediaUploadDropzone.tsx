import React, { useState, useRef } from "react";
import {
    Upload,
    Image as ImageIcon,
    Trash2,
    AlertCircle,
    Loader2,
    MoveUp,
    MoveDown,
    Plus,
    Crop,
} from "lucide-react";
import {
    requestProjectMediaSignature,
    uploadProjectMediaToCloudinary,
} from "../../api/projectApi";
import type { ProjectGalleryImage, ExtractedScreenshot } from "../../types/project";
import { NeoSelect } from "../NeoSelect";
import { AdaptiveImageEditorModal } from "../media/AdaptiveImageEditorModal";

interface MediaUploadDropzoneProps {
    coverImageUrl: string;
    onCoverImageChange: (url: string) => void;
    galleryImages: ProjectGalleryImage[];
    onGalleryImagesChange: (images: ProjectGalleryImage[]) => void;
    discoveredScreenshots?: ExtractedScreenshot[];
}

export const MediaUploadDropzone: React.FC<MediaUploadDropzoneProps> = ({
    coverImageUrl,
    onCoverImageChange,
    galleryImages,
    onGalleryImagesChange,
    discoveredScreenshots = [],
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadTarget, setUploadTarget] = useState<"cover" | "gallery">("cover");
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Adaptive Image Editor state for Project Cover
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorSource, setEditorSource] = useState<File | string | null>(null);

    // Direct URL inputs
    const [directCoverUrl, setDirectCoverUrl] = useState(coverImageUrl);
    const [newGalleryUrl, setNewGalleryUrl] = useState("");
    const [newGalleryCaption, setNewGalleryCaption] = useState("");
    const [newGalleryType, setNewGalleryType] = useState<"screenshot" | "architecture" | "supporting">("screenshot");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const triggerFilePicker = (target: "cover" | "gallery") => {
        setUploadTarget(target);
        setUploadError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side validation: max 10MB
        if (file.size > 10 * 1024 * 1024) {
            setUploadError("Image file size must be less than 10MB.");
            return;
        }

        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
        if (!validTypes.includes(file.type)) {
            setUploadError("Unsupported image format. Allowed: JPG, PNG, WEBP, GIF, SVG.");
            return;
        }

        // If uploadTarget is cover, route through the Adaptive Image Editor
        if (uploadTarget === "cover") {
            setEditorSource(file);
            setIsEditorOpen(true);
            return;
        }

        setIsUploading(true);
        setUploadProgress(10);
        setUploadError(null);

        try {
            const config = await requestProjectMediaSignature();
            const result = await uploadProjectMediaToCloudinary(config, file, (percent) => {
                setUploadProgress(percent);
            });

            const newImg: ProjectGalleryImage = {
                id: `img_${Date.now()}`,
                url: result.secureUrl,
                caption: file.name.replace(/\.[^/.]+$/, ""),
                type: "screenshot",
                displayOrder: galleryImages.length,
            };
            onGalleryImagesChange([...galleryImages, newImg]);
        } catch (err: any) {
            console.error("Image upload failed:", err);
            setUploadError(
                err.message || "Failed to upload image to cloud storage. You can enter an image URL directly below."
            );
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    // Confirmed framed cover from Adaptive Image Editor
    const handleCoverFramedConfirm = async (cropResult: { file: File; blob: Blob; dataUrl: string }) => {
        setIsEditorOpen(false);
        setEditorSource(null);
        setIsUploading(true);
        setUploadProgress(10);
        setUploadError(null);

        try {
            const config = await requestProjectMediaSignature();
            const result = await uploadProjectMediaToCloudinary(config, cropResult.file, (percent) => {
                setUploadProgress(percent);
            });
            onCoverImageChange(result.secureUrl);
            setDirectCoverUrl(result.secureUrl);
        } catch (err: any) {
            console.error("Framed cover upload failed:", err);
            setUploadError(
                err.message || "Failed to upload framed cover image."
            );
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    // Manual Direct URL update for Cover
    const applyDirectCoverUrl = () => {
        if (!directCoverUrl.trim()) {
            onCoverImageChange("");
            return;
        }
        if (!/^https?:\/\//i.test(directCoverUrl.trim())) {
            setUploadError("Direct image URL must begin with http:// or https://");
            return;
        }
        onCoverImageChange(directCoverUrl.trim());
        setUploadError(null);
    };

    // Add Direct URL to Gallery
    const addDirectGalleryImage = () => {
        const cleanUrl = newGalleryUrl.trim();
        if (!cleanUrl) return;
        if (!/^https?:\/\//i.test(cleanUrl)) {
            setUploadError("Gallery image URL must begin with http:// or https://");
            return;
        }

        const newImg: ProjectGalleryImage = {
            id: `img_${Date.now()}`,
            url: cleanUrl,
            caption: newGalleryCaption.trim() || undefined,
            type: newGalleryType,
            displayOrder: galleryImages.length,
        };

        onGalleryImagesChange([...galleryImages, newImg]);
        setNewGalleryUrl("");
        setNewGalleryCaption("");
        setUploadError(null);
    };

    const removeGalleryImage = (index: number) => {
        const updated = galleryImages.filter((_, i) => i !== index);
        onGalleryImagesChange(updated);
    };

    const moveGalleryImage = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= galleryImages.length) return;
        const copy = [...galleryImages];
        const [moved] = copy.splice(index, 1);
        copy.splice(targetIndex, 0, moved);
        onGalleryImagesChange(copy);
    };

    return (
        <div className="space-y-6">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                onChange={handleFileSelected}
                className="hidden"
            />

            {/* Upload progress & error alerts */}
            {isUploading && (
                <div className="bg-[#a2ff86] border-2 border-black p-3.5 shadow-[2px_2px_0px_#000] flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-black shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs font-black uppercase text-black">
                            Uploading image to secure storage... {uploadProgress ? `${uploadProgress}%` : ""}
                        </p>
                        {uploadProgress !== null && (
                            <div className="w-full bg-black/20 h-1.5 mt-1 border border-black/40">
                                <div
                                    className="bg-black h-full transition-all duration-200"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {uploadError && (
                <div className="bg-amber-100 border-2 border-black p-3 shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                    <div className="text-xs font-medium text-amber-900 leading-relaxed">
                        {uploadError}
                    </div>
                </div>
            )}

            {/* 1. Project Cover Image */}
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Primary Cover Image
                        </h4>
                        <p className="text-[11px] font-medium text-neutral-500">
                            Appears as the hero visual on project cards and profile showcase.
                        </p>
                    </div>
                    {coverImageUrl && (
                        <button
                            type="button"
                            onClick={() => {
                                onCoverImageChange("");
                                setDirectCoverUrl("");
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 border border-transparent hover:border-black transition-all"
                            title="Remove cover image"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {coverImageUrl ? (
                    <div className="relative border-2 border-black overflow-hidden bg-neutral-100 group max-h-56 flex items-center justify-center">
                        <img
                            src={coverImageUrl}
                            alt="Project Cover Preview"
                            className="w-full h-auto object-cover max-h-56"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80";
                            }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setEditorSource(coverImageUrl);
                                    setIsEditorOpen(true);
                                }}
                                className="px-3 py-1.5 bg-[#FFE566] border-2 border-black text-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] flex items-center gap-1.5 hover:bg-[#ffd500]"
                            >
                                <Crop className="w-3.5 h-3.5" />
                                Adjust Frame
                            </button>
                            <button
                                type="button"
                                onClick={() => triggerFilePicker("cover")}
                                className="px-3 py-1.5 bg-[#a2ff86] border-2 border-black text-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] hover:bg-[#86efac]"
                            >
                                Replace File
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => triggerFilePicker("cover")}
                        className="border-2 border-dashed border-black/50 hover:border-black p-6 bg-[#FAF6EE] text-center cursor-pointer transition-colors"
                    >
                        <Upload className="w-7 h-7 mx-auto text-black mb-2" />
                        <p className="text-xs font-black uppercase text-black">
                            Click to Upload Project Cover
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-1">
                            JPG, PNG, WEBP, or SVG up to 10MB
                        </p>
                    </div>
                )}

                {/* Direct URL input fallback */}
                <div className="pt-2 border-t border-black/10 flex gap-2">
                    <input
                        type="url"
                        value={directCoverUrl}
                        onChange={(e) => setDirectCoverUrl(e.target.value)}
                        placeholder="Or enter direct image URL (e.g. https://...)"
                        className="flex-1 px-3 py-1.5 text-xs font-mono border-2 border-black bg-[#FAF6EE] focus:bg-white focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={applyDirectCoverUrl}
                        className="px-3 py-1.5 bg-black text-white font-black text-xs uppercase border-2 border-black active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        Set URL
                    </button>
                </div>
            </div>

            {/* 2. Discovered README Screenshots Approval Picker */}
            {discoveredScreenshots.length > 0 && (
                <div className="bg-[#FAF6EE] border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-black uppercase bg-[#a2ff86] border border-black px-1.5 py-0.5 text-black">
                                Found in README ({discoveredScreenshots.length})
                            </span>
                            <h4 className="text-xs font-black uppercase tracking-wider text-black mt-1">
                                Discovered Screenshots
                            </h4>
                            <p className="text-[11px] font-medium text-neutral-600">
                                Click any screenshot to use as Cover or add to Gallery.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-44 overflow-y-auto p-1">
                        {discoveredScreenshots.map((item, i) => (
                            <div
                                key={i}
                                className="border-2 border-black bg-white p-1.5 flex flex-col justify-between group hover:shadow-[2px_2px_0px_#000] transition-all"
                            >
                                <div className="h-20 bg-neutral-100 overflow-hidden border border-black/20 flex items-center justify-center">
                                    <img
                                        src={item.url}
                                        alt={item.caption || `Screenshot ${i + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = "none";
                                        }}
                                    />
                                </div>
                                <div className="mt-1.5 flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onCoverImageChange(item.url);
                                            setDirectCoverUrl(item.url);
                                        }}
                                        className="flex-1 py-1 text-[10px] font-black uppercase bg-[#a2ff86] border border-black text-black hover:bg-black hover:text-white transition-colors"
                                    >
                                        Use Cover
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newImg: ProjectGalleryImage = {
                                                id: `shot_${Date.now()}_${i}`,
                                                url: item.url,
                                                caption: item.caption || `Screenshot ${i + 1}`,
                                                type: "screenshot",
                                                displayOrder: galleryImages.length,
                                            };
                                            onGalleryImagesChange([...galleryImages, newImg]);
                                        }}
                                        className="flex-1 py-1 text-[10px] font-black uppercase bg-white border border-black text-black hover:bg-neutral-200 transition-colors"
                                    >
                                        + Gallery
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Screenshots, Architecture Diagrams & Supporting Media Gallery */}
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                            Project Media Gallery ({galleryImages.length})
                        </h4>
                        <p className="text-[11px] font-medium text-neutral-500">
                            Screenshots, architecture diagrams, and system flow visuals.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => triggerFilePicker("gallery")}
                        className="px-3 py-1 bg-black text-white text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Media
                    </button>
                </div>

                {/* Add via URL Form */}
                <div className="p-3 bg-[#FAF6EE] border border-black/40 space-y-2">
                    <span className="text-[10px] font-black uppercase text-neutral-600 block">
                        Add Media via URL
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                            type="url"
                            value={newGalleryUrl}
                            onChange={(e) => setNewGalleryUrl(e.target.value)}
                            placeholder="Image URL https://..."
                            className="px-2.5 py-1.5 text-xs font-mono border border-black bg-white focus:outline-none sm:col-span-2"
                        />
                        <NeoSelect
                            value={newGalleryType}
                            onChange={(val) => setNewGalleryType(val as any)}
                            size="sm"
                            options={[
                                { value: "screenshot", label: "Screenshot" },
                                { value: "architecture", label: "Architecture Diagram" },
                                { value: "supporting", label: "Supporting Image" },
                            ]}
                        />
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newGalleryCaption}
                            onChange={(e) => setNewGalleryCaption(e.target.value)}
                            placeholder="Optional caption or diagram label"
                            className="flex-1 px-2.5 py-1 text-xs border border-black bg-white focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={addDirectGalleryImage}
                            disabled={!newGalleryUrl.trim()}
                            className="px-3 py-1 bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-40 text-black text-xs font-black uppercase border border-black flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                        </button>
                    </div>
                </div>

                {/* Existing Gallery List */}
                {galleryImages.length === 0 ? (
                    <div className="text-center py-6 text-neutral-400 text-xs font-medium border border-dashed border-neutral-300">
                        No gallery images added yet. Upload files or paste image URLs above.
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {galleryImages.map((img, idx) => {
                            const url = typeof img === "string" ? img : img.url;
                            const caption = typeof img === "string" ? `Image ${idx + 1}` : img.caption || `Image ${idx + 1}`;
                            const type = typeof img === "string" ? "screenshot" : img.type || "screenshot";

                            return (
                                <div
                                    key={idx}
                                    className="p-2.5 bg-[#FAF6EE] border-2 border-black flex items-center justify-between gap-3 shadow-[2px_2px_0px_#000]"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-12 h-10 border border-black bg-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                                            <img
                                                src={url}
                                                alt={caption}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 bg-black text-white">
                                                    {type}
                                                </span>
                                                <span className="text-xs font-bold text-black truncate max-w-[200px]">
                                                    {caption}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono text-neutral-500 truncate block mt-0.5">
                                                {url}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => moveGalleryImage(idx, "up")}
                                            disabled={idx === 0}
                                            className="p-1 border border-black bg-white hover:bg-neutral-100 disabled:opacity-30"
                                            title="Move Up"
                                        >
                                            <MoveUp className="w-3.5 h-3.5 text-black" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveGalleryImage(idx, "down")}
                                            disabled={idx === galleryImages.length - 1}
                                            className="p-1 border border-black bg-white hover:bg-neutral-100 disabled:opacity-30"
                                            title="Move Down"
                                        >
                                            <MoveDown className="w-3.5 h-3.5 text-black" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeGalleryImage(idx)}
                                            className="p-1 border border-black bg-white hover:bg-red-50 text-red-600"
                                            title="Remove"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Adaptive Image Editor for Project Cover */}
            <AdaptiveImageEditorModal
                isOpen={isEditorOpen}
                onClose={() => {
                    setIsEditorOpen(false);
                    setEditorSource(null);
                }}
                imageSource={editorSource}
                placementId="project_cover"
                onConfirm={handleCoverFramedConfirm}
            />
        </div>
    );
};
