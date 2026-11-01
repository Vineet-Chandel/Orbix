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
} from "lucide-react";
import { OrbixButton } from "../../../components/OrbixButton";
import { NeoImageDropzone } from "../../../components/NeoImageDropzone";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
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

export const ACHIEVEMENT_TYPES = [
    "Hackathon & Competitions",
    "Open Source Recognition",
    "Community & Ecosystem Award",
    "Technical Research & Grant",
    "Milestone & Growth",
    "Flagship Event",
    "Other Distinction",
];

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
    const [type, setType] = useState(ACHIEVEMENT_TYPES[0]);
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
    const [achievementToDelete, setAchievementToDelete] = useState<ClubAchievement | null>(null);

    const openAddModal = () => {
        setEditingAchievement(null);
        setTitle("");
        setType(ACHIEVEMENT_TYPES[0]);
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
        setType(ach.type || ach.achievementType || ACHIEVEMENT_TYPES[0]);
        setDescription(ach.description || "");
        setAchievementDate(ach.achievementDate || ach.date || "");
        setIssuer(ach.issuer || ach.organization || "");
        setImageUrl(ach.imageUrl || "");
        setExternalLink(ach.externalLink || ach.referenceUrl || "");
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
                type: type.trim() || undefined,
                achievementType: type.trim() || undefined,
                description: description.trim() || undefined,
                achievementDate: achievementDate.trim() || undefined,
                date: achievementDate.trim() || undefined,
                issuer: issuer.trim() || undefined,
                organization: issuer.trim() || undefined,
                imageUrl: imageUrl.trim() || undefined,
                externalLink: externalLink.trim() || undefined,
                referenceUrl: externalLink.trim() || undefined,
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

    const confirmDelete = async () => {
        if (!achievementToDelete) return;
        try {
            setDeletingId(achievementToDelete.id);
            await deleteAchievement(achievementToDelete.id, clubId);
            toast.success("Achievement removed.");
            setAchievementToDelete(null);
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
                    <h3 className="text-sm font-black text-black">Achievements & Distinctions</h3>
                    <p className="text-xs font-medium text-neutral-600 mt-0.5">
                        Add awards, hackathon victories, grants, and notable distinctions earned by your members.
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
                <div className="p-8 rounded-2xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-2">
                    <Trophy className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h4 className="text-xs font-black text-black">No Achievements Listed</h4>
                    <p className="text-[11px] font-medium text-neutral-500 max-w-sm mx-auto">
                        Achievements enhance your chapter's credibility for recruiting, sponsorships, and inter-college visibility.
                    </p>
                    {canManage && (
                        <button
                            type="button"
                            onClick={openAddModal}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-black text-xs font-bold text-black shadow-[1px_1px_0px_#000] hover:bg-neutral-100 cursor-pointer mt-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First Achievement</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {achievements.map((ach, index) => (
                        <div
                            key={ach.id}
                            className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-4 transition-all"
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
                                    {(ach.type || ach.achievementType) && (
                                        <span className="px-2 py-0.5 rounded-md bg-[#a2ff86] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                            {ach.type || ach.achievementType}
                                        </span>
                                    )}
                                    {(ach.issuer || ach.organization) && (
                                        <span className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black text-[10px] font-bold text-neutral-800">
                                            {ach.issuer || ach.organization}
                                        </span>
                                    )}
                                    {(ach.achievementDate || ach.date) && (
                                        <span className="text-[10px] font-black text-neutral-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {ach.achievementDate || ach.date}
                                        </span>
                                    )}
                                </div>
                                {ach.description && (
                                    <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                        {ach.description}
                                    </p>
                                )}
                                {(ach.externalLink || ach.referenceUrl) && (
                                    <a
                                        href={ach.externalLink || ach.referenceUrl || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline mt-2"
                                    >
                                        <span>View certificate / verification</span>
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
                                            onClick={() => setAchievementToDelete(ach)}
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
                            {/* Title */}
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

                            {/* Type and Issuer */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Achievement Type
                                    </label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden cursor-pointer"
                                    >
                                        {ACHIEVEMENT_TYPES.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Awarding Organization
                                    </label>
                                    <input
                                        type="text"
                                        value={issuer}
                                        onChange={(e) => setIssuer(e.target.value)}
                                        placeholder="e.g. Ministry of Education, AWS, IEEE"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Date & Reference URL */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Year or Date
                                    </label>
                                    <input
                                        type="text"
                                        value={achievementDate}
                                        onChange={(e) => setAchievementDate(e.target.value)}
                                        placeholder="e.g. 2024 or Dec 2024"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Proof or Reference URL
                                    </label>
                                    <input
                                        type="url"
                                        value={externalLink}
                                        onChange={(e) => setExternalLink(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Description / Summary
                                </label>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief explanation of the competition, problem solved, or milestone attained..."
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden resize-none"
                                />
                            </div>

                            {/* Image / Trophy Upload Dropzone */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                    Badge or Certificate Image (Optional)
                                </label>
                                <NeoImageDropzone
                                    value={imageUrl}
                                    onChange={handlePhotoSelectFile}
                                    onRemove={() => setImageUrl("")}
                                    isUploading={isUploadingPhoto}
                                    uploadProgress={uploadProgress}
                                    aspectRatio="square"
                                    headline="Drag badge or certificate photo here"
                                    subtext="or click to browse your device"
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
                                <OrbixButton
                                    type="submit"
                                    loading={isSubmitting}
                                    loadingLabel="Saving..."
                                    variant="lime"
                                >
                                    {editingAchievement ? "Update Achievement" : "Add Achievement"}
                                </OrbixButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmationModal
                isOpen={Boolean(achievementToDelete)}
                title="Remove Achievement"
                description={
                    achievementToDelete
                        ? `Are you sure you want to remove "${achievementToDelete.title}" from your public achievements list?`
                        : "Remove this achievement?"
                }
                confirmLabel="Remove Achievement"
                cancelLabel="Cancel"
                variant="danger"
                isLoading={Boolean(deletingId)}
                onConfirm={confirmDelete}
                onClose={() => setAchievementToDelete(null)}
            />
        </div>
    );
};
