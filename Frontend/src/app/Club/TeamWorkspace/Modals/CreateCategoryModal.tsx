// Frontend/src/app/Club/TeamWorkspace/Modals/CreateCategoryModal.tsx
import React, { useState } from "react";
import { FolderPlus, X, Lock } from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { WorkspaceDepartment, WorkspaceRole, WorkspaceMember, WorkspaceChannelCategory } from "../../../../types/workspace";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <FolderPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-100">Create Category</h3>
                            <p className="text-xs text-slate-400">Group related channels together</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/60 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Category Name */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Category Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. TECHNICAL & DEVELOPMENT"
                            required
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-sm font-medium transition"
                        />
                    </div>

                    {/* Department Association */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                            Associated Department (Optional)
                        </label>
                        <select
                            value={departmentId || ""}
                            onChange={(e) => setDepartmentId(e.target.value ? e.target.value : null)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-indigo-500/50 transition"
                        >
                            <option value="">Club-Wide (No specific department)</option>
                            {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1.5">
                            Department categories help organize communication for specific units without mixing with club-wide topics.
                        </p>
                    </div>

                    {/* Private Category Toggle */}
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Lock className="w-4 h-4 text-amber-400" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-200">Private Category</div>
                                    <div className="text-xs text-slate-400">
                                        Only selected roles and members can view channels in this category
                                    </div>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPrivate}
                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Role selection if private */}
                        {isPrivate && (
                            <div className="pt-3 border-t border-slate-800/80 space-y-2 animate-in fade-in duration-150">
                                <div className="text-xs font-semibold text-slate-400">
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
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                                }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: role.color || "#6366f1" }}
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
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !name.trim()}
                            className="px-5 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition"
                        >
                            {submitting ? "Creating..." : "Create Category"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
