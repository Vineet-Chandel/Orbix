// Frontend/src/app/Club/TeamWorkspace/Modals/EditCategoryModal.tsx
import React, { useState, useEffect } from "react";
import { Folder, X, Lock, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceDepartment,
    WorkspaceChannelCategory,
} from "../../../../types/workspace";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

interface EditCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    category: WorkspaceChannelCategory | null;
    allCategories: WorkspaceChannelCategory[];
    departments: WorkspaceDepartment[];
    onCategoryUpdated: (category: WorkspaceChannelCategory) => void;
    onCategoryDeleted: (categoryId: string) => void;
    onCategoriesReordered: (categories: WorkspaceChannelCategory[]) => void;
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
    isOpen,
    onClose,
    clubId,
    category,
    allCategories,
    departments,
    onCategoryUpdated,
    onCategoryDeleted,
    onCategoriesReordered,
}) => {
    const toast = useToast();
    const [name, setName] = useState("");
    const [departmentId, setDepartmentId] = useState<string | null>(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen && category) {
            setName(category.name);
            setDepartmentId(category.departmentId || null);
            setIsPrivate(category.isPrivate || false);
        }
    }, [isOpen, category]);

    if (!isOpen || !category) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error("Category name is required.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.updateCategory(
                category.id,
                {
                    name: trimmed,
                    departmentId: departmentId || null,
                    isPrivate,
                },
                clubId
            );

            if (res.success && res.category) {
                toast.success("Category updated successfully.");
                onCategoryUpdated(res.category);
                onClose();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to update category.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        try {
            setDeleting(true);
            const res = await workspaceApi.deleteCategory(category.id, clubId);
            if (res.success) {
                toast.success(`Category "${category.name}" deleted.`);
                setIsDeleteConfirmOpen(false);
                onCategoryDeleted(category.id);
                onClose();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to delete category.");
        } finally {
            setDeleting(false);
        }
    };

    const handleMove = async (direction: "up" | "down") => {
        const index = allCategories.findIndex((c) => c.id === category.id);
        if (index === -1) return;
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === allCategories.length - 1) return;

        const targetIndex = direction === "up" ? index - 1 : index + 1;
        const reordered = [...allCategories];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(targetIndex, 0, moved);

        try {
            const res = await workspaceApi.reorderCategories(
                reordered.map((c) => c.id),
                clubId
            );
            if (res.success) {
                toast.success(`Category moved ${direction}.`);
                onCategoriesReordered(reordered);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.message || "Failed to reorder categories.");
        }
    };

    const currentIndex = allCategories.findIndex((c) => c.id === category.id);
    const canMoveUp = currentIndex > 0;
    const canMoveDown = currentIndex < allCategories.length - 1 && currentIndex !== -1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white border-2 border-black rounded-2xl w-full max-w-md shadow-neo overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black">
                            <Folder className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-black">Manage Category</h3>
                            <p className="text-xs text-neutral-500 font-semibold">
                                Edit settings or reorder #{category.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-black transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Category Name */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                            Category Name
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            placeholder="e.g. CORE TEAM, PROJECTS, ANNOUNCEMENTS"
                            className="w-full px-4 py-2.5 rounded-xl border-2 border-black text-black font-black text-xs uppercase focus:outline-none focus:bg-[#FFFDF8] shadow-neo-xxs"
                        />
                    </div>

                    {/* Department Scope */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                            Department Scope
                        </label>
                        <NeoSelect
                            value={departmentId || "none"}
                            onChange={(val) => setDepartmentId(val === "none" ? null : val)}
                            options={[
                                { value: "none", label: "Chapter-Wide (All Departments)" },
                                ...departments.map((d) => ({
                                    value: d.id,
                                    label: `Dept: ${d.name}`,
                                })),
                            ]}
                            triggerClassName="w-full text-xs font-bold"
                        />
                        <p className="text-[11px] text-neutral-500 font-semibold mt-1">
                            Channels in this category will inherit this department scope.
                        </p>
                    </div>

                    {/* Privacy Toggle */}
                    <div className="p-3.5 rounded-xl border-2 border-black bg-[#FAF6EE] flex items-start gap-3">
                        <NeoCheckbox
                            checked={isPrivate}
                            onCheckedChange={(checked) => setIsPrivate(checked)}
                        />
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-black">
                                <Lock className="w-3.5 h-3.5 text-black" />
                                <span>Private Category</span>
                            </div>
                            <p className="text-[11px] text-neutral-600 font-semibold mt-0.5">
                                Only authorized roles and members can see this category and its channels.
                            </p>
                        </div>
                    </div>

                    {/* Reordering Controls */}
                    <div className="p-3 rounded-xl border-2 border-black bg-neutral-50 flex items-center justify-between">
                        <div>
                            <div className="text-xs font-black text-black">Sidebar Order</div>
                            <div className="text-[10px] font-bold text-neutral-500">
                                Position {currentIndex + 1} of {allCategories.length}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={!canMoveUp}
                                onClick={() => handleMove("up")}
                                className="px-2.5 py-1 text-xs font-black bg-white hover:bg-[#FFE566] disabled:opacity-40 border-2 border-black rounded-lg shadow-neo-xxs flex items-center gap-1 transition"
                                title="Move Category Up"
                            >
                                <ArrowUp className="w-3 h-3" /> Up
                            </button>
                            <button
                                type="button"
                                disabled={!canMoveDown}
                                onClick={() => handleMove("down")}
                                className="px-2.5 py-1 text-xs font-black bg-white hover:bg-[#FFE566] disabled:opacity-40 border-2 border-black rounded-lg shadow-neo-xxs flex items-center gap-1 transition"
                                title="Move Category Down"
                            >
                                <ArrowDown className="w-3 h-3" /> Down
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t-2 border-black">
                        <button
                            type="button"
                            disabled={deleting || submitting}
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 border-2 border-rose-300 hover:border-rose-600 rounded-xl transition flex items-center gap-1.5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleting ? "Deleting..." : "Delete"}
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:text-black transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-4 py-2 rounded-xl text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition disabled:opacity-50"
                            >
                                {submitting ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Delete Category Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDelete}
                title={`Delete Category "${category.name}"?`}
                description={
                    category.channels && category.channels.length > 0
                        ? `Category "${category.name}" contains ${category.channels.length} channel(s). Deleting it will unassign those channels. Proceed?`
                        : `Are you sure you want to permanently delete category "${category.name}"?`
                }
                confirmText="Delete Category"
                cancelText="Cancel"
                variant="danger"
                isLoading={deleting}
            />
        </div>
    );
};
