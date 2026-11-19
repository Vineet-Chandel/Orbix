// Frontend/src/app/Club/TeamWorkspace/Modals/CreateCategoryModal.tsx
import React, { useState } from "react";
import { FolderPlus, X, Lock } from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { WorkspaceDepartment, WorkspaceRole, WorkspaceMember, WorkspaceChannelCategory } from "../../../../types/workspace";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";

interface CreateCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clubId: string;
    departments: WorkspaceDepartment[];
    roles: WorkspaceRole[];
    members: WorkspaceMember[];
    defaultDepartmentId?: string | null;
    onCategoryCreated: (category: WorkspaceChannelCategory) => void;
}

export const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
    isOpen,
    onClose,
    clubId,
    departments,
    roles,
    defaultDepartmentId,
    onCategoryCreated,
}) => {
    const toast = useToast();
    const [name, setName] = useState("");
    const [departmentId, setDepartmentId] = useState<string | null>(defaultDepartmentId || null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error("Category name is required.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.createCategory(
                {
                    name: trimmed,
                    departmentId: departmentId || null,
                    isPrivate,
                },
                clubId
            );

            if (res.success && res.category) {
                // If private and roles selected, configure category overrides
                if (isPrivate && selectedRoleIds.length > 0) {
                    for (const roleId of selectedRoleIds) {
                        await workspaceApi.setCategoryOverride(
                            res.category.id,
                            {
                                roleId,
                                allowPermissions: ["view_channel", "send_messages"],
                            },
                            clubId
                        );
                    }
                }

                toast.success(`Category "${res.category.name}" created successfully.`);
                onCategoryCreated(res.category);
                handleClose();
            }
        } catch (err: any) {
            console.error("Failed to create category:", err);
            toast.error(err.response?.data?.message || err.message || "Failed to create category.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setName("");
        setDepartmentId(defaultDepartmentId || null);
        setIsPrivate(false);
        setSelectedRoleIds([]);
        onClose();
    };

    const toggleRole = (roleId: string) => {
        setSelectedRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white border-2 border-black rounded-2xl w-full max-w-lg shadow-neo overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#A6FF70] border-2 border-black flex items-center justify-center text-black">
                            <FolderPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-black">Create Category</h3>
                            <p className="text-xs font-semibold text-neutral-600">Group related channels together</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-neutral-500 hover:text-black p-2 rounded-lg hover:bg-neutral-100 border-2 border-transparent hover:border-black transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Category Name */}
                    <div>
                        <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                            Category Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. TECHNICAL & DEVELOPMENT"
                            required
                            className="w-full px-4 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-black placeholder-neutral-400 focus:outline-none focus:bg-white text-sm font-semibold transition shadow-[2px_2px_0px_#000]"
                        />
                    </div>

                    {/* Department Association */}
                    <div>
                        <label className="block text-xs font-black text-black uppercase tracking-wider mb-2">
                            Associated Department (Optional)
                        </label>
                        <NeoSelect
                            value={departmentId || ""}
                            onChange={(val) => setDepartmentId(val ? val : null)}
                            options={[
                                { value: "", label: "Club-Wide (No specific department)" },
                                ...departments.map((dept) => ({
                                    value: dept.id,
                                    label: dept.name,
                                })),
                            ]}
                            placeholder="Club-Wide (No specific department)"
                            size="md"
                        />
                        <p className="text-xs font-medium text-neutral-600 mt-1.5">
                            Department categories help organize communication for specific units without mixing with club-wide topics.
                        </p>
                    </div>

                    {/* Private Category Toggle */}
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-3 shadow-[2px_2px_0px_#000]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Lock className="w-4 h-4 text-black" />
                                <div>
                                    <div className="text-sm font-black text-black">Private Category</div>
                                    <div className="text-xs font-medium text-neutral-600">
                                        Only selected roles and members can view channels in this category
                                    </div>
                                </div>
                            </div>
                            <NeoCheckbox
                                checked={isPrivate}
                                onCheckedChange={(checked: boolean) => setIsPrivate(checked)}
                                colorScheme="yellow"
                                size="sm"
                            />
                        </div>

                        {/* Role selection if private */}
                        {isPrivate && (
                            <div className="pt-3 border-t-2 border-black/10 space-y-2 animate-in fade-in duration-150">
                                <div className="text-xs font-black text-black">
                                    Allowed Roles (Admins & Owners have access automatically):
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                                    {roles.map((role) => {
                                        const isSelected = selectedRoleIds.includes(role.id);
                                        return (
                                            <button
                                                type="button"
                                                key={role.id}
                                                onClick={() => toggleRole(role.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 border-black transition flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? "bg-[#A6FF70] text-black shadow-[2px_2px_0px_#000]"
                                                        : "bg-white text-black hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full border border-black"
                                                    style={{ backgroundColor: role.color || "#000" }}
                                                />
                                                {role.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-xl text-xs font-black text-black bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !name.trim()}
                            className="px-5 py-2 rounded-xl text-xs font-black bg-[#A6FF70] hover:bg-[#92f25a] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? "Creating..." : "Create Category"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
