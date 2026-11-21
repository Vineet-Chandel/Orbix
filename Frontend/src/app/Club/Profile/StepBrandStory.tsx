import React, { useState } from "react";
import {
    Sparkles,
    Tag,
    X,
    Plus,
} from "lucide-react";
import { ClubMarkdownEditor } from "./ClubMarkdownEditor";
import { useToast } from "../../../context/ToastContext";
import {
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
    removeClubImage,
} from "../../../utils/clubProfileApi";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { AdaptiveImageDropzone } from "../../../components/media/AdaptiveImageDropzone";

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
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000]">
                        <AdaptiveImageDropzone
                            placementId="club_logo"
                            label="Club Chapter Logo"
                            headline="Drag and drop club logo here"
                            subtext="or click to browse your device (PNG, JPG, WebP)"
                            value={logoUrl}
                            onChange={handleUploadLogoFile}
                            onRemove={handleRemoveLogo}
                            isUploading={isUploadingLogo}
                            uploadProgress={logoProgress}
                        />
                    </div>

                    {/* CARD 2: CLUB BANNER */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000]">
                        <AdaptiveImageDropzone
                            placementId="club_banner"
                            label="Club Header Banner"
                            headline="Drag and drop club banner here"
                            subtext="or click to browse your device (2.6:1 wide ratio)"
                            value={coverImageUrl}
                            onChange={handleUploadCoverFile}
                            onRemove={handleRemoveCover}
                            isUploading={isUploadingCover}
                            uploadProgress={coverProgress}
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
