// Frontend/src/app/Club/TeamWorkspace/Roles/CreateEditRoleModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    X,
    Shield,
    Check,
    Palette,
    Info,
    CheckSquare,
    Square,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { WorkspaceRole } from "../../../../types/workspace";

interface CreateEditRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    clubId: string;
    roleToEdit?: WorkspaceRole | null;
    currentMemberRank: number;
    isOwner: boolean;
    actorPermissions: string[];
}

interface PermissionGroup {
    name: string;
    description: string;
    permissions: Array<{
        key: string;
        label: string;
        description: string;
    }>;
}

const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        name: "Workspace & Administration",
        description: "High-level workspace settings, configurations, and audit visibility",
        permissions: [
            { key: "workspace:manage_settings", label: "Manage Settings", description: "Configure workspace general settings, invitations and policies" },
            { key: "audit:view", label: "View Audit Logs", description: "Inspect tamper-evident chronological workspace audit history" },
        ],
    },
    {
        name: "Departments Management",
        description: "Department lifecycle and team memberships",
        permissions: [
            { key: "departments:create", label: "Create Departments", description: "Add new departments to this workspace" },
            { key: "departments:manage", label: "Manage All Departments", description: "Edit names, icons, descriptions, and leads" },
            { key: "departments:manage_members", label: "Manage Department Roster", description: "Add, remove, or transfer members between departments" },
            { key: "departments:delete", label: "Delete / Archive Departments", description: "Archive or permanently remove departments" },
        ],
    },
    {
        name: "Members & Access Control",
        description: "User invitations, promotions, and membership management",
        permissions: [
            { key: "members:invite", label: "Invite Members", description: "Send invitations to join the workspace" },
            { key: "members:remove", label: "Remove / Suspend Members", description: "Revoke memberships or temporarily suspend members" },
            { key: "members:assign_role", label: "Assign Roles", description: "Promote or demote members (strictly below actor's rank)" },
        ],
    },
    {
        name: "Roles & Delegated Authority",
        description: "Custom role creation, hierarchy reordering, and permission definition",
        permissions: [
            { key: "roles:create", label: "Create Custom Roles", description: "Define custom roles and assign non-escalating permissions" },
            { key: "roles:manage", label: "Manage & Reorder Roles", description: "Edit custom role permissions, ranks, and hierarchy" },
        ],
    },
    {
        name: "Channels & Communication",
        description: "Messaging, category organization, and real-time moderation",
        permissions: [
            { key: "channels:create", label: "Create Channels", description: "Create text, announcement, or forum channels" },
            { key: "channels:manage", label: "Manage Channels & Categories", description: "Edit topic, privacy, slowmode, and permissions" },
            { key: "channels:delete", label: "Delete Channels", description: "Remove channels and channel categories" },
            { key: "messages:send", label: "Send Messages", description: "Post in discussion and forum channels" },
            { key: "messages:attach_files", label: "Attach Media", description: "Upload images, files, and deliverables in chat" },
            { key: "messages:pin", label: "Pin Messages", description: "Pin important discussions to channel banners" },
            { key: "messages:moderate", label: "Moderate & Delete Any", description: "Delete inappropriate messages from any user" },
        ],
    },
    {
        name: "Tasks & Deliverables Workflow",
        description: "Accountability tracking, assignments, reviews, and sign-offs",
        permissions: [
            { key: "tasks:create", label: "Create Tasks", description: "Create tasks with checklists, instructions, and deadlines" },
            { key: "tasks:assign", label: "Assign Members", description: "Delegate tasks to workspace or department members" },
            { key: "tasks:review", label: "Review Deliverables", description: "Approve deliverables or request revision changes" },
            { key: "tasks:edit_all", label: "Edit Any Task", description: "Modify tasks across all workspace departments" },
            { key: "tasks:delete", label: "Delete / Archive Tasks", description: "Permanently delete or archive task entries" },
        ],
    },
    {
        name: "Files & Deliverable Assets",
        description: "Workspace digital repository and attachment controls",
        permissions: [
            { key: "files:upload", label: "Upload Assets", description: "Upload resources and task deliverables to cloud storage" },
            { key: "files:manage", label: "Manage Assets", description: "Move, rename, organize, or purge workspace files" },
        ],
    },
    {
        name: "Recognition & Orbits",
        description: "Merit awards, peer appreciation, and incentive policy controls",
        permissions: [
            { key: "recognition:award", label: "Award Orbits", description: "Grant recognition points and orbits to deserving team members" },
            { key: "recognition:manage_policy", label: "Manage Recognition Policy", description: "Configure monthly budgets, point limits, and DPI weights" },
        ],
    },
];

const PRESET_COLORS = [
    "#475569", // Slate
    "#2563EB", // Blue
    "#7C3AED", // Purple
    "#DB2777", // Pink
    "#DC2626", // Red
    "#D97706", // Amber
    "#059669", // Emerald
    "#0D9488", // Teal
    "#0891B2", // Cyan
    "#000000", // Black
];

export const CreateEditRoleModal: React.FC<CreateEditRoleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    clubId,
    roleToEdit,
    currentMemberRank,
    isOwner,
    actorPermissions,
}) => {
    const toast = useToast();
    const isEditing = Boolean(roleToEdit);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [rank, setRank] = useState(300);
    const [color, setColor] = useState("#475569");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Max rank calculation: Non-owners cannot create roles with rank >= their own rank or >= 800 (Admin rank)
    const maxRankAllowed = useMemo(() => {
        if (isOwner) return 999;
        return Math.min(799, Math.max(201, currentMemberRank - 1));
    }, [isOwner, currentMemberRank]);

    useEffect(() => {
        if (isOpen) {
            if (roleToEdit) {
                setName(roleToEdit.name);
                setDescription(roleToEdit.description || "");
                setRank(roleToEdit.rank);
                setColor(roleToEdit.color || "#475569");
                setSelectedPermissions(roleToEdit.permissions || []);
            } else {
                setName("");
                setDescription("");
                // Default to a safe rank between 200 and 700
                setRank(Math.min(500, maxRankAllowed));
                setColor("#475569");
                setSelectedPermissions(["messages:send", "messages:attach_files", "tasks:create", "files:upload"]);
            }
        }
    }, [isOpen, roleToEdit, maxRankAllowed]);

    if (!isOpen) return null;

    const hasWildcard = isOwner || actorPermissions.includes("*");

    const togglePermission = (permKey: string) => {
        // Escalation check: non-owners cannot grant permissions they do not hold
        if (!hasWildcard && !actorPermissions.includes(permKey)) {
            toast.error(`Escalation denied: You cannot grant "${permKey}" because you do not hold this permission.`);
            return;
        }

        setSelectedPermissions((prev) =>
            prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
        );
    };

    const toggleGroup = (group: PermissionGroup) => {
        const availableInGroup = group.permissions
            .map((p) => p.key)
            .filter((key) => hasWildcard || actorPermissions.includes(key));

        const allSelected = availableInGroup.every((k) => selectedPermissions.includes(k));

        if (allSelected) {
            setSelectedPermissions((prev) => prev.filter((k) => !availableInGroup.includes(k)));
        } else {
            setSelectedPermissions((prev) => Array.from(new Set([...prev, ...availableInGroup])));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Role name is required.");
            return;
        }

        if (rank < 1 || rank > maxRankAllowed) {
            toast.error(`Role rank must be between 1 and ${maxRankAllowed}.`);
            return;
        }

        try {
            setIsSubmitting(true);

            if (isEditing && roleToEdit) {
                await workspaceApi.updateRole(
                    roleToEdit.id,
                    {
                        name: name.trim(),
                        description: description.trim() || undefined,
                        rank: Number(rank),
                        color,
                        permissions: selectedPermissions,
                    },
                    clubId
                );
                toast.success(`Role "${name}" updated successfully.`);
            } else {
                await workspaceApi.createRole(
                    {
                        name: name.trim(),
                        description: description.trim() || undefined,
                        rank: Number(rank),
                        color,
                        permissions: selectedPermissions,
                    },
                    clubId
                );
                toast.success(`Custom role "${name}" created successfully.`);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.message || `Failed to ${isEditing ? "update" : "create"} role.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-[#FAF6EE] border-4 border-black rounded-2xl shadow-neo-lg w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b-2 border-black bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center shadow-neo-xs text-white"
                            style={{ backgroundColor: color }}
                        >
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-black">
                                {isEditing ? `Edit Custom Role: ${roleToEdit?.name}` : "Create Custom Role"}
                            </h2>
                            <p className="text-xs font-bold text-neutral-600">
                                Configure role hierarchy rank, identity styling, and fine-grained permissions.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 border-2 border-black rounded-xl flex items-center justify-center hover:bg-neutral-100 transition shadow-neo-xs"
                    >
                        <X className="w-5 h-5 text-black" />
                    </button>
                </div>

                {/* Form Body */}
                <form id="role-form" onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-6 flex-1">
                    {/* Role Basic Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 space-y-1">
                            <label className="text-xs font-black uppercase text-black">
                                Role Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Lead Technical Architect, Media Specialist"
                                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border-2 border-black rounded-xl shadow-neo-xs focus:outline-none focus:ring-2 focus:ring-[#FFE566]"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                                Hierarchy Rank (1–{maxRankAllowed})
                                <span title="Higher rank grants authority over lower ranks. Cannot exceed your rank.">
                                    <Info className="w-3 h-3 text-neutral-500" />
                                </span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={maxRankAllowed}
                                value={rank}
                                onChange={(e) => setRank(Number(e.target.value))}
                                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border-2 border-black rounded-xl shadow-neo-xs focus:outline-none focus:ring-2 focus:ring-[#FFE566]"
                                required
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase text-black">Description & Scope</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Describe this role's purpose, scope, and responsibilities within the club..."
                            className="w-full px-3.5 py-2 text-xs font-medium bg-white border-2 border-black rounded-xl shadow-neo-xs focus:outline-none focus:ring-2 focus:ring-[#FFE566]"
                        />
                    </div>

                    {/* Color Picker & Live Badge Preview */}
                    <div className="p-4 bg-white border-2 border-black rounded-xl shadow-neo-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <label className="text-xs font-black uppercase text-black flex items-center gap-2 mb-2">
                                <Palette className="w-3.5 h-3.5 text-neutral-700" />
                                Role Accent Color
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        type="button"
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-7 h-7 rounded-lg border-2 border-black transition-all ${
                                            color === c ? "scale-110 shadow-neo-xs ring-2 ring-black" : "opacity-80 hover:opacity-100"
                                        }`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="w-7 h-7 rounded-lg border-2 border-black p-0 cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="text-right">
                            <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">Badge Preview</span>
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black text-xs font-black shadow-neo-xs"
                                style={{ backgroundColor: `${color}20`, color: color }}
                            >
                                <span className="w-2 h-2 rounded-full border border-black" style={{ backgroundColor: color }} />
                                {name.trim() || "Role Preview"} • Rank {rank}
                            </span>
                        </div>
                    </div>

                    {/* Permissions Selector by Module */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-black uppercase text-black">Granular Module Permissions</h3>
                                <p className="text-[11px] font-bold text-neutral-600">
                                    Selected permissions ({selectedPermissions.length} active) will be granted to any member assigned this role.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {PERMISSION_GROUPS.map((group) => {
                                const availableInGroup = group.permissions.filter(
                                    (p) => hasWildcard || actorPermissions.includes(p.key)
                                );
                                const selectedInGroup = availableInGroup.filter((p) =>
                                    selectedPermissions.includes(p.key)
                                );
                                const isAllSelected =
                                    availableInGroup.length > 0 && selectedInGroup.length === availableInGroup.length;

                                return (
                                    <div
                                        key={group.name}
                                        className="bg-white border-2 border-black rounded-xl p-3.5 shadow-neo-xs"
                                    >
                                        <div className="flex items-center justify-between border-b-2 border-neutral-100 pb-2 mb-2.5">
                                            <div>
                                                <h4 className="text-xs font-black text-black">{group.name}</h4>
                                                <p className="text-[10px] font-medium text-neutral-500">{group.description}</p>
                                            </div>
                                            {availableInGroup.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroup(group)}
                                                    className="text-[10px] font-black uppercase px-2 py-1 bg-neutral-100 hover:bg-neutral-200 border border-black rounded-lg transition"
                                                >
                                                    {isAllSelected ? "Deselect All" : "Select All"}
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {group.permissions.map((perm) => {
                                                const canGrant = hasWildcard || actorPermissions.includes(perm.key);
                                                const isChecked = selectedPermissions.includes(perm.key);

                                                return (
                                                    <div
                                                        key={perm.key}
                                                        onClick={() => canGrant && togglePermission(perm.key)}
                                                        className={`p-2.5 rounded-lg border-2 transition-all flex items-start gap-2.5 ${
                                                            !canGrant
                                                                ? "opacity-40 cursor-not-allowed bg-neutral-100 border-neutral-300"
                                                                : isChecked
                                                                ? "bg-[#FFE566]/20 border-black cursor-pointer shadow-neo-xs"
                                                                : "bg-neutral-50 hover:bg-white border-neutral-300 cursor-pointer"
                                                        }`}
                                                    >
                                                        <div className="mt-0.5 shrink-0">
                                                            {isChecked ? (
                                                                <CheckSquare className="w-4 h-4 text-black" />
                                                            ) : (
                                                                <Square className="w-4 h-4 text-neutral-400" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-black text-black leading-tight">
                                                                    {perm.label}
                                                                </span>
                                                                {!canGrant && (
                                                                    <span className="text-[9px] font-black uppercase bg-neutral-200 px-1 rounded text-neutral-600">
                                                                        Unpossessed
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-neutral-600 font-medium leading-normal mt-0.5">
                                                                {perm.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </form>

                {/* Footer Controls */}
                <div className="p-4 border-t-2 border-black bg-white flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl shadow-neo-xs transition"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        form="role-form"
                        disabled={isSubmitting}
                        className="px-5 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm transition active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            "Saving..."
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                {isEditing ? "Save Role Changes" : "Create Role"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
