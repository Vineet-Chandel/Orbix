import React, { useRef, useState } from "react";
import {
    UploadCloud,
    Trash2,
    RefreshCw,
    Sparkles,
    Image as ImageIcon,
    Tag,
    X,
    Plus,
} from "lucide-react";
import { OrbixLoader } from "../../../components/ui/loader";
import { ClubMarkdownEditor } from "./ClubMarkdownEditor";
import { useToast } from "../../../context/ToastContext";
import {
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
    removeClubImage,
} from "../../../utils/clubProfileApi";
import { ConfirmationModal } from "../../../components/ConfirmationModal";

interface StepBrandStoryProps {
    clubId?: string;
    logoUrl: string;
    onLogoChange: (url: string) => void;
    coverImageUrl: string;
    onCoverImageChange: (url: string) => void;
    about: string;
    onAboutChange: (text: string) => void;
    tagline: string;
    onTaglineChange: (text: string) => void;
    focusAreas: string[];
    onFocusAreasChange: (tags: string[]) => void;
}

const TEMPLATE_STORY = `## About Us
Tell students what your club does, your community, workshops, and flagship initiatives.

## Our Mission
What does your club aim to achieve for students and the campus community?

## Our Vision
What long-term impact and innovation do you want to foster?`;

export const StepBrandStory: React.FC<StepBrandStoryProps> = ({
    clubId,
    logoUrl,
    onLogoChange,
    coverImageUrl,
    onCoverImageChange,
    about,
    onAboutChange,
    tagline,
    onTaglineChange,
    focusAreas,
    onFocusAreasChange,
}) => {
    const toast = useToast();

    // Upload state
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoProgress, setLogoProgress] = useState<number | null>(null);
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [coverProgress, setCoverProgress] = useState<number | null>(null);

    // Drag-and-drop state
    const [isDraggingLogo, setIsDraggingLogo] = useState(false);
    const [isDraggingCover, setIsDraggingCover] = useState(false);

    // Tag input
    const [tagInput, setTagInput] = useState("");

    // Modal Confirmation Dialog state (replaces window.confirm)
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        confirmText?: string;
        variant?: "danger" | "warning";
        onConfirm: () => void;
    } | null>(null);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const validateImageFile = (file: File): boolean => {
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!validTypes.includes(file.type.toLowerCase())) {
            toast.error("Invalid file format. Please upload a PNG, JPEG/JPG, or WebP image.");
            return false;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image file is too large. Maximum permitted size is 5 MB.");
            return false;
        }
        return true;
    };

    const handleUploadLogoFile = async (file: File) => {
        if (!validateImageFile(file)) return;
        try {
            setIsUploadingLogo(true);
            setLogoProgress(0);
            const uploadConfig = await requestClubUploadSignature("logo", clubId);
            const result = await uploadClubImageToCloudinary(uploadConfig, file, (percent) => {
                setLogoProgress(percent);
            });
            onLogoChange(result.secureUrl);
            toast.success("Club logo uploaded successfully!");
        } catch (err: any) {
            console.error("Logo upload error:", err);
            toast.error(err.message || "Failed to upload club logo.");
        } finally {
            setIsUploadingLogo(false);
            setLogoProgress(null);
        }
    };

    const handleUploadCoverFile = async (file: File) => {
        if (!validateImageFile(file)) return;
        try {
            setIsUploadingCover(true);
            setCoverProgress(0);
            const uploadConfig = await requestClubUploadSignature("banner", clubId);
            const result = await uploadClubImageToCloudinary(uploadConfig, file, (percent) => {
                setCoverProgress(percent);
            });
            onCoverImageChange(result.secureUrl);
            toast.success("Club banner uploaded successfully!");
        } catch (err: any) {
            console.error("Banner upload error:", err);
            toast.error(err.message || "Failed to upload club banner.");
        } finally {
            setIsUploadingCover(false);
            setCoverProgress(null);
        }
    };

    const handleRemoveLogo = () => {
        setConfirmDialog({
            isOpen: true,
            title: "Remove Club Logo",
            description: "Are you sure you want to remove this club avatar logo?",
            confirmText: "Remove Logo",
            variant: "danger",
            onConfirm: async () => {
                setConfirmDialog(null);
                onLogoChange("");
                if (clubId) {
                    try {
                        await removeClubImage("logo", clubId);
                    } catch (err) {
                        console.warn("Server logo removal log:", err);
                    }
                }
                toast.info("Logo removed.");
            },
        });
    };

    const handleRemoveCover = () => {
        setConfirmDialog({
            isOpen: true,
            title: "Remove Club Banner",
            description: "Are you sure you want to remove this cover banner image?",
            confirmText: "Remove Banner",
            variant: "danger",
            onConfirm: async () => {
                setConfirmDialog(null);
                onCoverImageChange("");
                if (clubId) {
                    try {
                        await removeClubImage("banner", clubId);
                    } catch (err) {
                        console.warn("Server banner removal log:", err);
                    }
                }
                toast.info("Banner removed.");
            },
        });
    };

    const handleAddTag = () => {
        const clean = tagInput.trim().replace(/^#+/, "");
        if (!clean) return;
        if (clean.length > 30) {
            toast.error("Tags must be 30 characters or fewer.");
            return;
        }
        if (focusAreas.some((t) => t.toLowerCase() === clean.toLowerCase())) {
            toast.info(`Tag "${clean}" is already added.`);
            setTagInput("");
            return;
        }
        if (focusAreas.length >= 15) {
            toast.error("You can add up to 15 focus area tags.");
            return;
        }
        onFocusAreasChange([...focusAreas, clean]);
        setTagInput("");
    };

    const handleRemoveTag = (tagToRemove: string) => {
        onFocusAreasChange(focusAreas.filter((t) => t !== tagToRemove));
    };

    const handleApplyTemplate = () => {
        if (about.trim().length > 0) {
            setConfirmDialog({
                isOpen: true,
                title: "Replace Story Text",
                description: "Replace your current story text with the recommended template? Unsaved edits will be overwritten.",
                confirmText: "Apply Template",
                variant: "warning",
                onConfirm: () => {
                    setConfirmDialog(null);
                    onAboutChange(TEMPLATE_STORY);
                    toast.success("Template inserted!");
                },
            });
            return;
        }
        onAboutChange(TEMPLATE_STORY);
        toast.success("Template inserted!");
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="border-b border-black/10 pb-4">
                <h2 className="text-lg font-black text-black tracking-tight">Brand & Story</h2>
                <p className="text-xs text-neutral-600 font-medium mt-1">
                    Design a recognizable brand and craft your club narrative for students and visitors.
                </p>
            </div>

            {/* A. Club Branding Media Management */}
            <div className="space-y-3">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-black">
                        Club Visual Branding
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                        High-quality visual assets appear across the club directory and your public page. (Max 5 MB • PNG, JPG, WebP)
                    </p>
                </div>

                {/* 2-Card Compact Grid for Logo & Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* CARD 1: CLUB LOGO */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-black flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Club Logo</span>
                            </span>
                            <span className="text-[10px] font-bold text-neutral-500">
                                1:1 Square recommended
                            </span>
                        </div>

                        {logoUrl ? (
                            <div className="flex items-center gap-4 bg-white p-3.5 rounded-xl border border-black shadow-[1px_1px_0px_#000]">
                                <div className="w-20 h-20 rounded-xl border-2 border-black bg-[#FAF6EE] overflow-hidden shrink-0 flex items-center justify-center">
                                    <img src={logoUrl} alt="Club Logo Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                    <p className="text-xs font-bold text-black truncate">Logo Uploaded</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => logoInputRef.current?.click()}
                                            disabled={isUploadingLogo}
                                            className="px-2.5 py-1 rounded-lg bg-[#a2ff86] text-black text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] hover:bg-[#8ee673] flex items-center gap-1 cursor-pointer"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Replace</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="px-2.5 py-1 rounded-lg bg-white text-rose-600 text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Remove</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDraggingLogo(true);
                                }}
                                onDragLeave={() => setIsDraggingLogo(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingLogo(false);
                                    if (e.dataTransfer.files?.[0]) {
                                        handleUploadLogoFile(e.dataTransfer.files[0]);
                                    }
                                }}
                                onClick={() => logoInputRef.current?.click()}
                                className={`p-6 rounded-xl border-2 border-dashed border-black/40 bg-white flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-black hover:bg-amber-50/40 ${
                                    isDraggingLogo ? "border-black bg-amber-100/60 scale-[1.01]" : ""
                                }`}
                            >
                                {isUploadingLogo ? (
                                    <div className="space-y-2 flex flex-col items-center py-2 text-black">
                                        <OrbixLoader size="sm" />
                                        <span className="text-xs font-bold text-black">
                                            Uploading {logoProgress !== null ? `${logoProgress}%` : "..."}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-[#FFE566] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                            <UploadCloud className="w-5 h-5 text-black" />
                                        </div>
                                        <span className="text-xs font-black text-black">Click or drag club logo</span>
                                        <span className="text-[10px] text-neutral-500 font-medium">PNG, JPG, WebP up to 5 MB</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleUploadLogoFile(e.target.files[0]);
                                }
                            }}
                        />
                    </div>

                    {/* CARD 2: CLUB BANNER */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-black flex items-center gap-1.5">
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Club Header Banner</span>
                            </span>
                            <span className="text-[10px] font-bold text-neutral-500">
                                3:1 Wide aspect ratio
                            </span>
                        </div>

                        {coverImageUrl ? (
                            <div className="space-y-3 bg-white p-3.5 rounded-xl border border-black shadow-[1px_1px_0px_#000]">
                                <div className="w-full h-24 rounded-lg border-2 border-black overflow-hidden bg-neutral-900">
                                    <img src={coverImageUrl} alt="Club Banner Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-black truncate">Banner Uploaded</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => coverInputRef.current?.click()}
                                            disabled={isUploadingCover}
                                            className="px-2.5 py-1 rounded-lg bg-[#a2ff86] text-black text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] hover:bg-[#8ee673] flex items-center gap-1 cursor-pointer"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Replace</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemoveCover}
                                            className="px-2.5 py-1 rounded-lg bg-white text-rose-600 text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>Remove</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDraggingCover(true);
                                }}
                                onDragLeave={() => setIsDraggingCover(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingCover(false);
                                    if (e.dataTransfer.files?.[0]) {
                                        handleUploadCoverFile(e.dataTransfer.files[0]);
                                    }
                                }}
                                onClick={() => coverInputRef.current?.click()}
                                className={`p-6 rounded-xl border-2 border-dashed border-black/40 bg-white flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-black hover:bg-amber-50/40 ${
                                    isDraggingCover ? "border-black bg-amber-100/60 scale-[1.01]" : ""
                                }`}
                            >
                                {isUploadingCover ? (
                                    <div className="space-y-2 flex flex-col items-center py-2 text-black">
                                        <OrbixLoader size="sm" />
                                        <span className="text-xs font-bold text-black">
                                            Uploading {coverProgress !== null ? `${coverProgress}%` : "..."}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 flex flex-col items-center">
                                        <div className="w-10 h-10 rounded-full bg-[#FFE566] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                            <UploadCloud className="w-5 h-5 text-black" />
                                        </div>
                                        <span className="text-xs font-black text-black">Click or drag banner image</span>
                                        <span className="text-[10px] text-neutral-500 font-medium">3:1 wide ratio • up to 5 MB</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleUploadCoverFile(e.target.files[0]);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* B. Tagline Input */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        Club Tagline <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                    </label>
                    <span
                        className={`text-[10px] font-mono font-bold ${
                            tagline.length > 150 ? "text-amber-600" : "text-neutral-500"
                        }`}
                    >
                        {tagline.length}/160
                    </span>
                </div>
                <input
                    type="text"
                    value={tagline}
                    onChange={(e) => onTaglineChange(e.target.value.slice(0, 160))}
                    placeholder="e.g. Empowering students through hands-on cloud architecture and open-source."
                    maxLength={160}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                />
            </div>

            {/* C. Club Story (Markdown Editor) */}
            <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            About the Club <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                            Use Markdown to articulate your club's missions, flagship initiatives, and value to students.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleApplyTemplate}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-black text-[11px] font-black text-black shadow-[1px_1px_0px_#000] hover:bg-neutral-100 transition-colors cursor-pointer self-start sm:self-auto"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Insert Recommended Template</span>
                    </button>
                </div>

                <ClubMarkdownEditor
                    value={about}
                    onChange={onAboutChange}
                    placeholder="Write a rich story about your club, what you do, who you serve, and how to get involved..."
                    minHeight="min-h-[280px]"
                />
            </div>

            {/* D. Focus Areas (Tags) */}
            <div className="space-y-2.5">
                <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        Focus Areas & Topics <span className="text-neutral-400 text-[10px] font-bold">(Optional)</span>
                    </label>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                        Add up to 15 relevant domain tags (e.g. Cloud Computing, AI/ML, Open Source, UI/UX).
                    </p>
                </div>

                {/* Input row */}
                <div className="flex items-center gap-2 max-w-md">
                    <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddTag();
                                }
                            }}
                            placeholder="Add a domain tag..."
                            maxLength={30}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-black bg-white text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFE566] shadow-[2px_2px_0px_#000]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3.5 py-2 rounded-xl bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] transition-transform active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                    </button>
                </div>

                {/* Rendered Tags */}
                {focusAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {focusAreas.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[1px_1px_0px_#000]"
                            >
                                <span>#{tag}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="p-0.5 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
                                    title={`Remove ${tag}`}
                                >
                                    <X className="w-3 h-3 text-neutral-600 hover:text-black" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {confirmDialog && (
                <ConfirmationModal
                    isOpen={confirmDialog.isOpen}
                    onClose={() => setConfirmDialog(null)}
                    onConfirm={confirmDialog.onConfirm}
                    title={confirmDialog.title}
                    description={confirmDialog.description}
                    confirmText={confirmDialog.confirmText || "Confirm"}
                    variant={confirmDialog.variant || "danger"}
                />
            )}
        </div>
    );
};
