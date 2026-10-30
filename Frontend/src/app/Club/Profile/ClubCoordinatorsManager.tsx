import React, { useState } from "react";
import {
    Plus,
    UserCheck,
    Trash2,
    Edit2,
    MoveUp,
    MoveDown,
    X,
    Mail,
    Loader2,
} from "lucide-react";
import { getPlatformIcon } from "../../../utils/platformLinks";
import type { ClubCoordinator } from "../../../utils/clubProfileApi";
import {
    addCoordinator,
    updateCoordinator,
    deleteCoordinator,
    reorderCoordinators,
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../../utils/clubProfileApi";
import { useToast } from "../../../context/ToastContext";
import { NeoImageDropzone } from "../../../components/NeoImageDropzone";

interface ClubCoordinatorsManagerProps {
    clubId: string;
    coordinators: ClubCoordinator[];
    canManage: boolean;
    onUpdate: () => void;
}

export const ClubCoordinatorsManager: React.FC<ClubCoordinatorsManagerProps> = ({
    clubId,
    coordinators,
    canManage,
    onUpdate,
}) => {
    const toast = useToast();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoordinator, setEditingCoordinator] = useState<ClubCoordinator | null>(null);

    // Form fields
    const [name, setName] = useState("");
    const [department, setDepartment] = useState("");
    const [role, setRole] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [isPrimary, setIsPrimary] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [contactEmail, setContactEmail] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [linkedUserId, setLinkedUserId] = useState("");

    // Upload & action states
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const openAddModal = () => {
        setEditingCoordinator(null);
        setName("");
        setDepartment("");
        setRole("");
        setImageUrl("");
        setIsPrimary(coordinators.length === 0);
        setIsPublic(true);
        setContactEmail("");
        setLinkedinUrl("");
        setLinkedUserId("");
        setIsModalOpen(true);
    };

    const openEditModal = (coord: ClubCoordinator) => {
        setEditingCoordinator(coord);
        setName(coord.name || "");
        setDepartment(coord.department || "");
        setRole(coord.role || "");
        setImageUrl(coord.imageUrl || "");
        setIsPrimary(Boolean(coord.isPrimary));
        setIsPublic(coord.isPublic !== false);
        setContactEmail(coord.contactEmail || "");
        setLinkedinUrl(coord.linkedinUrl || "");
        setLinkedUserId(coord.linkedUserId || "");
        setIsModalOpen(true);
    };

    const handlePhotoSelectFile = async (file: File) => {
        try {
            setIsUploadingPhoto(true);
            setUploadProgress(0);

            const uploadConfig = await requestClubUploadSignature("coordinator", clubId);
            const result = await uploadClubImageToCloudinary(uploadConfig, file, (percent) => {
                setUploadProgress(percent);
            });

            setImageUrl(result.secureUrl);
            toast.success("Coordinator photo uploaded successfully!");
        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload coordinator photo.");
        } finally {
            setIsUploadingPhoto(false);
            setUploadProgress(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Please enter the coordinator's name.");
            return;
        }
        if (!role.trim()) {
            toast.error("Please enter the coordinator's role (e.g. Lead Coordinator, Technical Head).");
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                name: name.trim(),
                department: department.trim() || undefined,
                role: role.trim(),
                imageUrl: imageUrl.trim() || undefined,
                isPrimary,
                isPublic,
                contactEmail: contactEmail.trim() || undefined,
                linkedinUrl: linkedinUrl.trim() || undefined,
                linkedUserId: linkedUserId.trim() || undefined,
            };

            if (editingCoordinator) {
                await updateCoordinator(editingCoordinator.id, payload, clubId);
                toast.success("Coordinator updated successfully!");
            } else {
                await addCoordinator(payload, clubId);
                toast.success("Coordinator added to club profile!");
            }

            setIsModalOpen(false);
            onUpdate();
        } catch (err: any) {
            console.error("Save coordinator error:", err);
            toast.error(err.message || "Failed to save coordinator.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this coordinator from the public club profile?")) {
            return;
        }

        try {
            setDeletingId(id);
            await deleteCoordinator(id, clubId);
            toast.success("Coordinator removed.");
            onUpdate();
        } catch (err: any) {
            toast.error(err.message || "Failed to remove coordinator.");
        } finally {
            setDeletingId(null);
        }
    };

    const handleMove = async (index: number, direction: "up" | "down") => {
        if (
            (direction === "up" && index === 0) ||
            (direction === "down" && index === coordinators.length - 1)
        ) {
            return;
        }

        const nextOrder = [...coordinators];
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        const temp = nextOrder[index];
        nextOrder[index] = nextOrder[targetIndex];
        nextOrder[targetIndex] = temp;

        const ids = nextOrder.map((c) => c.id);
        try {
            await reorderCoordinators(ids, clubId);
            onUpdate();
        } catch (err: any) {
            toast.error("Failed to reorder coordinators.");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                <div>
                    <h3 className="text-sm font-black text-black">Club Coordinators & Leads</h3>
                    <p className="text-xs font-medium text-neutral-600 mt-0.5">
                        Showcase faculty mentors, student conveners, and domain coordinators on your public profile.
                    </p>
                </div>
                {canManage && (
                    <button
                        type="button"
                        onClick={openAddModal}
                        className="px-3.5 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Coordinator</span>
                    </button>
                )}
            </div>

            {coordinators.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-2">
                    <UserCheck className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h4 className="text-xs font-black text-black">No Coordinators Added</h4>
                    <p className="text-[11px] font-medium text-neutral-500 max-w-sm mx-auto">
                        Add key representatives, student presidents, or domain leads so collegiate visitors know who leads this chapter.
                    </p>
                    {canManage && (
                        <button
                            type="button"
                            onClick={openAddModal}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-white text-black border border-black text-xs font-black shadow-[1px_1px_0px_#000] hover:bg-neutral-50 cursor-pointer"
                        >
                            + Add First Coordinator
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {coordinators.map((coord, index) => (
                        <div
                            key={coord.id}
                            className={`p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3.5 transition-all ${coord.isPrimary ? "ring-2 ring-[#a2ff86]" : ""
                                }`}
                        >
                            {/* Photo / Avatar */}
                            <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black overflow-hidden shrink-0 flex items-center justify-center font-black text-sm text-neutral-700 shadow-[1px_1px_0px_#000]">
                                {coord.imageUrl ? (
                                    <img
                                        src={coord.imageUrl}
                                        alt={coord.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span>{coord.name.slice(0, 2).toUpperCase()}</span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="text-xs font-black text-black truncate">{coord.name}</h4>
                                    {coord.isPrimary && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-[#a2ff86] border border-black text-[9px] font-black text-black shadow-[1px_1px_0px_#000]">
                                            Lead
                                        </span>
                                    )}
                                    {!coord.isPublic && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-neutral-200 border border-black text-[9px] font-black text-neutral-700">
                                            Hidden
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-bold text-neutral-700 truncate mt-0.5">{coord.role}</p>
                                {coord.department && (
                                    <p className="text-[10px] font-medium text-neutral-500 truncate">{coord.department}</p>
                                )}

                                {/* Links preview */}
                                <div className="flex items-center gap-2 mt-2">
                                    {coord.contactEmail && (
                                        <a
                                            href={`mailto:${coord.contactEmail}`}
                                            className="text-neutral-600 hover:text-black"
                                            title={coord.contactEmail}
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                    {coord.linkedinUrl && (
                                        <a
                                            href={coord.linkedinUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-neutral-600 hover:text-blue-600"
                                            title="LinkedIn"
                                        >
                                            {getPlatformIcon("linkedin", "w-3.5 h-3.5")}
                                        </a>
                                    )}
                                </div>
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
                                            disabled={index === coordinators.length - 1}
                                            title="Move Down"
                                            className="p-1 text-neutral-500 hover:text-black disabled:opacity-20 cursor-pointer"
                                        >
                                            <MoveDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(coord)}
                                            className="p-1 text-neutral-700 hover:text-black rounded border border-neutral-300 hover:border-black cursor-pointer"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(coord.id)}
                                            disabled={deletingId === coord.id}
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

            {/* MODAL: ADD / EDIT COORDINATOR */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 sm:p-5 bg-[#FAF6EE] border-b-2 border-black flex items-center justify-between">
                            <h3 className="text-base font-black text-black">
                                {editingCoordinator ? "Edit Coordinator" : "Add New Coordinator"}
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
                            {/* Photo Upload Dropzone */}
                            <NeoImageDropzone
                                label="Coordinator Photo"
                                headline="Drag and drop coordinator photo here"
                                subtext="or click anywhere in this block to browse your device"
                                value={imageUrl}
                                onChange={handlePhotoSelectFile}
                                onRemove={() => setImageUrl("")}
                                isUploading={isUploadingPhoto}
                                uploadProgress={uploadProgress}
                                aspectRatio="avatar"
                                maxSizeMB={5}
                                recommendedNote="PNG, JPG or WEBP up to 5MB."
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Alex Sharma"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Role / Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={role}
                                        onChange={(e) => setRole(e.target.value)}
                                        placeholder="e.g. President / Lead Coordinator"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Department / Branch
                                    </label>
                                    <input
                                        type="text"
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        placeholder="e.g. Computer Science & Engg."
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        value={contactEmail}
                                        onChange={(e) => setContactEmail(e.target.value)}
                                        placeholder="alex@example.edu"
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    LinkedIn Profile URL
                                </label>
                                <input
                                    type="url"
                                    value={linkedinUrl}
                                    onChange={(e) => setLinkedinUrl(e.target.value)}
                                    placeholder="https://linkedin.com/in/username"
                                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                />
                            </div>

                            {/* Toggles */}
                            <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2.5">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPrimary}
                                        onChange={(e) => setIsPrimary(e.target.checked)}
                                        className="w-4 h-4 rounded border-2 border-black text-black focus:ring-0"
                                    />
                                    <span className="text-xs font-black text-black">
                                        Designate as Primary / Lead Coordinator
                                    </span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPublic}
                                        onChange={(e) => setIsPublic(e.target.checked)}
                                        className="w-4 h-4 rounded border-2 border-black text-black focus:ring-0"
                                    />
                                    <span className="text-xs font-bold text-neutral-800">
                                        Publicly visible on the club's showcase profile
                                    </span>
                                </label>
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
                                        <span>{editingCoordinator ? "Update Coordinator" : "Add Coordinator"}</span>
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
