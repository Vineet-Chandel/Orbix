import React, { useState } from "react";
import {
    Plus,
    Trophy,
    Trash2,
    Edit2,
    MoveUp,
    MoveDown,
    X,
    ExternalLink,
    Calendar,
    Loader2,
} from "lucide-react";
import { NeoImageDropzone } from "../../../components/NeoImageDropzone";
import type { ClubAchievement } from "../../../utils/clubProfileApi";
import {
    addAchievement,
    updateAchievement,
    deleteAchievement,
    reorderAchievements,
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../../utils/clubProfileApi";
import { useToast } from "../../../context/ToastContext";

interface ClubAchievementsManagerProps {
    clubId: string;
    achievements: ClubAchievement[];
    canManage: boolean;
    onUpdate: () => void;
}

export const ClubAchievementsManager: React.FC<ClubAchievementsManagerProps> = ({
    clubId,
    achievements,
    canManage,
    onUpdate,
}) => {
    const toast = useToast();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAchievement, setEditingAchievement] = useState<ClubAchievement | null>(null);

    // Form fields
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [achievementDate, setAchievementDate] = useState("");
    const [issuer, setIssuer] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [externalLink, setExternalLink] = useState("");

    // Upload & action states
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const openAddModal = () => {
        setEditingAchievement(null);
        setTitle("");
        setDescription("");
        setAchievementDate("");
        setIssuer("");
        setImageUrl("");
        setExternalLink("");
        setIsModalOpen(true);
    };

    const openEditModal = (ach: ClubAchievement) => {
        setEditingAchievement(ach);
        setTitle(ach.title || "");
        setDescription(ach.description || "");
        setAchievementDate(ach.achievementDate || "");
        setIssuer(ach.issuer || "");
        setImageUrl(ach.imageUrl || "");
        setExternalLink(ach.externalLink || "");
        setIsModalOpen(true);
    };

    const handlePhotoSelectFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please select a valid image file (PNG, JPG, WEBP).");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image file must be under 5MB.");
            return;
        }

        try {
            setIsUploadingPhoto(true);
            setUploadProgress(0);

            const uploadConfig = await requestClubUploadSignature("achievement", clubId);
            const result = await uploadClubImageToCloudinary(uploadConfig, file, (percent) => {
                setUploadProgress(percent);
            });

            setImageUrl(result.secureUrl);
            toast.success("Achievement badge image uploaded!");
        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload image.");
        } finally {
            setIsUploadingPhoto(false);
            setUploadProgress(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter the achievement title.");
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                title: title.trim(),
                description: description.trim() || undefined,
                achievementDate: achievementDate.trim() || undefined,
                issuer: issuer.trim() || undefined,
                imageUrl: imageUrl.trim() || undefined,
                externalLink: externalLink.trim() || undefined,
            };

            if (editingAchievement) {
                await updateAchievement(editingAchievement.id, payload, clubId);
                toast.success("Achievement updated successfully!");
            } else {
                await addAchievement(payload, clubId);
                toast.success("Achievement added to club profile!");
            }

            setIsModalOpen(false);
            onUpdate();
        } catch (err: any) {
            console.error("Save achievement error:", err);
            toast.error(err.message || "Failed to save achievement.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this achievement?")) {
            return;
        }

        try {
            setDeletingId(id);
            await deleteAchievement(id, clubId);
            toast.success("Achievement removed.");
            onUpdate();
        } catch (err: any) {
            toast.error(err.message || "Failed to remove achievement.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleMove = async (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === achievements.length - 1)
        ) {
            return;
        }

        const nextOrder = [...achievements];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        const temp = nextOrder[index];
        nextOrder[index] = nextOrder[targetIndex];
        nextOrder[targetIndex] = temp;

        const ids = nextOrder.map((a) => a.id);
        try {
            await reorderAchievements(ids, clubId);
            onUpdate();
        } catch (err: any) {
            toast.error("Failed to reorder achievements.");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                <div>
                    <h3 className="text-sm font-black text-black">Achievements & Highlights</h3>
                    <p className="text-xs font-medium text-neutral-600 mt-0.5">
                        Feature hackathon podium finishes, institutional awards, and chapter milestones.
                    </p>
                </div>
                {canManage && (
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="px-3.5 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Achievement</span>
                    </button>
                )}
            </div>

            {achievements.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-2">
                    <Trophy className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h4 className="text-xs font-black text-black">No Achievements Added</h4>
                    <p className="text-[11px] font-medium text-neutral-500 max-w-sm mx-auto">
                        Add awards, national hackathon rankings, or chapter distinctions to boost your club's profile credibility.
                    </p>
                    {canManage && (
                        <button
                            type="button"
                            onClick={openAddModal}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-white text-black border border-black text-xs font-black shadow-[1px_1px_0px_#000] hover:bg-neutral-50 cursor-pointer"
                        >
                            + Add First Achievement
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {achievements.map((ach, index) => (
                        <div
                            key={ach.id}
                            className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-4"
                        >
                            {/* Trophy / Image Icon */}
                            <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black overflow-hidden shrink-0 flex items-center justify-center text-black shadow-[1px_1px_0px_#000]">
                                {ach.imageUrl ? (
                                    <img src={ach.imageUrl} alt={ach.title} className="w-full h-full object-cover" />
                                ) : (
                                    <Trophy className="w-6 h-6" />
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-black text-black">{ach.title}</h4>
                                    {ach.issuer && (
                                        <span className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[10px] font-bold text-neutral-800">
                                            {ach.issuer}
                                        </span>
                                    )}
                                    {ach.achievementDate && (
                                        <span className="text-[10px] font-black text-neutral-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {ach.achievementDate}
                                        </span>
                                    )}
                                </div>
                                {ach.description && (
                                    <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                        {ach.description}
                                    </p>
                                )}
                                {ach.externalLink && (
                                    <a
                                        href={ach.externalLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline mt-2"
                                    >
                                        <span>View certificate or announcement</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>

                            {/* Actions (if manager) */}
                            {canManage && (
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleMove(index, "up")}
                                            disabled={index === 0}
                                            title="Move Up"
                                            className="p-1 text-neutral-500 hover:text-black disabled:opacity-20 cursor-pointer"
                                        >
                                            <MoveUp className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMove(index, "down")}
                                            disabled={index === achievements.length - 1}
                                            title="Move Down"
                                            className="p-1 text-neutral-500 hover:text-black disabled:opacity-20 cursor-pointer"
                                        >
                                            <MoveDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(ach)}
                                            className="p-1 text-neutral-700 hover:text-black rounded border border-neutral-300 hover:border-black cursor-pointer"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(ach.id)}
                                            disabled={deletingId === ach.id}
                                            className="p-1 text-red-600 hover:text-red-800 rounded border border-neutral-300 hover:border-red-600 cursor-pointer disabled:opacity-50"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL: ADD / EDIT ACHIEVEMENT */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 sm:p-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between">
                            <h3 className="text-base font-black text-black">
                                {editingAchievement ? "Edit Achievement" : "Add New Achievement"}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-lg border border-black bg-white hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
                            {/* Image / Trophy Upload Dropzone */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                    Badge or Certificate Image
                                </label>
                                <NeoImageDropzone
                                    value={imageUrl}
                                    onChange={handlePhotoSelectFile}
                                    onRemove={() => setImageUrl("")}
                                    isUploading={isUploadingPhoto}
                                    uploadProgress={uploadProgress}
                                    aspectRatio="square"
                                    headline="Drag and drop achievement badge or certificate here"
                                    subtext="or click anywhere in this block to browse your device"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Achievement Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Smart India Hackathon 2024 - 1st Runner Up"
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Issuing Authority / Organizer
                                    </label>
                                    <input
                                        type="text"
                                        value={issuer}
                                        onChange={(e) => setIssuer(e.target.value)}
                                        placeholder="e.g. Ministry of Education, IEEE"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Date / Year
                                    </label>
                                    <input
                                        type="text"
                                        value={achievementDate}
                                        onChange={(e) => setAchievementDate(e.target.value)}
                                        placeholder="e.g. December 2024 or 2024"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Brief Description / Impact
                                </label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief details about the problem statement tackled, team members, or recognition..."
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    External Article / Proof URL
                                </label>
                                <input
                                    type="url"
                                    value={externalLink}
                                    onChange={(e) => setExternalLink(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="pt-3 border-t border-black/10 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-white text-black border-2 border-black text-xs font-bold shadow-[2px_2px_0px_#000] hover:bg-neutral-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50 flex items-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>{editingAchievement ? "Update Achievement" : "Add Achievement"}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
