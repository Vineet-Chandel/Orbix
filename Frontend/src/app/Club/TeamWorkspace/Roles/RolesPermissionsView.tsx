// Frontend/src/app/Club/TeamWorkspace/Roles/RolesPermissionsView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Shield,
    Users,
    Plus,
    ArrowUp,
    ArrowDown,
    Edit3,
    Trash2,
    Eye,
    CheckCircle2,
    XCircle,
    Info,
    Lock,
    Crown,
    UserCheck,
    Layers,
    Sliders,
    RefreshCw,
    Search,
    AlertTriangle,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { OrbixLoader } from "../../../../components/ui/loader";
import type {
    WorkspaceRole,
    WorkspaceMember,
    WorkspaceDepartment,
    MemberCapabilityResolution,
    WorkspacePermissionPreviewResult,
} from "../../../../types/workspace";
import { CreateEditRoleModal } from "./CreateEditRoleModal";
import { NeoSelect } from "../../../../components/NeoSelect";

interface RolesPermissionsViewProps {
    clubId: string;
    roles: WorkspaceRole[];
    members: WorkspaceMember[];
    departments: WorkspaceDepartment[];
    currentMember: WorkspaceMember | null;
    capabilities: MemberCapabilityResolution | null;
    isAdmin?: boolean;
    onRefresh: () => void;
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({
    clubId,
    roles,
    members,
    departments: _departments,
    currentMember,
    capabilities,
    isAdmin = false,
    onRefresh,
}) => {
    const toast = useToast();

    // Active sub-tab within Roles view
    const [subTab, setSubTab] = useState<"hierarchy" | "simulator" | "my-powers">("hierarchy");

    // Modal state for Create / Edit role
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [roleToEdit, setRoleToEdit] = useState<WorkspaceRole | null>(null);

    // Delete role state
    const [deletingRole, setDeletingRole] = useState<WorkspaceRole | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Reorder loading state
    const [isReordering, setIsReordering] = useState(false);

    // Permission Preview Simulator state
    const [selectedRoleForPreview, setSelectedRoleForPreview] = useState<string>(
        roles[0]?.id || ""
    );
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewResult, setPreviewResult] = useState<WorkspacePermissionPreviewResult | null>(null);

    // Filter search
    const [searchQuery, setSearchQuery] = useState("");

    // Authority computations
    const isOwner = Boolean(capabilities?.isOwner || currentMember?.role?.slug === "owner");
    const actorRank = capabilities?.highestRank || currentMember?.role?.rank || 0;
    const canCreateRoles = Boolean(capabilities?.capabilities.roles.create || isAdmin || isOwner);
    const canManageRoles = Boolean(capabilities?.capabilities.roles.manage || isAdmin || isOwner);

    // Compute member counts per role
    const memberCountsByRole = useMemo(() => {
        const counts: Record<string, number> = {};
        members.forEach((m) => {
            const rId = m.roleId || m.role?.id;
            if (rId) counts[rId] = (counts[rId] || 0) + 1;
        });
        return counts;
    }, [members]);

    // Sorted roles descending by rank
    const sortedRoles = useMemo(() => {
        return [...roles].sort((a, b) => b.rank - a.rank);
    }, [roles]);

    const filteredRoles = useMemo(() => {
        if (!searchQuery.trim()) return sortedRoles;
        const q = searchQuery.toLowerCase();
        return sortedRoles.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                r.slug.toLowerCase().includes(q) ||
                (r.description && r.description.toLowerCase().includes(q))
        );
    }, [sortedRoles, searchQuery]);

    // Load Preview when simulator is active
    const loadPreview = useCallback(
        async (roleId: string) => {
            if (!roleId) return;
            try {
                setPreviewLoading(true);
                const res = await workspaceApi.previewPermissions({ roleId }, clubId);
                if (res.success && res.preview) {
                    setPreviewResult(res.preview);
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to load capability preview.");
            } finally {
                setPreviewLoading(false);
            }
        },
        [clubId, toast]
    );

    useEffect(() => {
        if (subTab === "simulator" && selectedRoleForPreview) {
            loadPreview(selectedRoleForPreview);
        }
    }, [subTab, selectedRoleForPreview, loadPreview]);

    // Handle role reordering (Moving custom role Up or Down)
    const handleMoveRole = async (roleIndex: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? roleIndex - 1 : roleIndex + 1;
        if (targetIndex < 0 || targetIndex >= sortedRoles.length) return;

        const roleToMove = sortedRoles[roleIndex];
        const adjacentRole = sortedRoles[targetIndex];

        if (roleToMove.isSystem || adjacentRole.isSystem) {
            toast.error("System roles have fixed rank boundaries and cannot be moved.");
            return;
        }

        // Escalation guard: actor must outrank the role being moved
        if (roleToMove.rank >= actorRank && !isOwner) {
            toast.error("You cannot modify the rank of a role that equals or exceeds your rank.");
            return;
        }

        try {
            setIsReordering(true);
            // Swap ranks with adjacent role (ensuring distinct values)
            let newRankToMove = adjacentRole.rank;
            let newAdjacentRank = roleToMove.rank;

            if (newRankToMove === newAdjacentRank) {
                newRankToMove = direction === "up" ? newRankToMove + 5 : newRankToMove - 5;
            }

            const updates = [
                { id: roleToMove.id, rank: newRankToMove },
                { id: adjacentRole.id, rank: newAdjacentRank },
            ];

            const res = await workspaceApi.reorderRoles(updates, clubId);
            if (res.success) {
                toast.success("Role hierarchy reordered.");
                onRefresh();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to reorder roles.");
        } finally {
            setIsReordering(false);
        }
    };

    // Handle role deletion
    const handleDeleteRole = async () => {
        if (!deletingRole) return;
        try {
            setIsDeleting(true);
            const res = await workspaceApi.deleteRole(deletingRole.id, clubId);
            if (res.success) {
                toast.success(res.message || `Role "${deletingRole.name}" deleted.`);
                setDeletingRole(null);
                onRefresh();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete role.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Header Card */}
            <div className="bg-[#FAF6EE] border-4 border-black rounded-2xl p-5 sm:p-6 shadow-neo flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-[#FFE566] border-2 border-black rounded-2xl flex items-center justify-center shadow-neo-sm">
                        <Shield className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black text-black">Roles, Permissions & Delegation</h1>
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#A6FF70] border border-black rounded-lg">
                                Phase 07 Ready
                            </span>
                        </div>
                        <p className="text-xs font-bold text-neutral-600 mt-0.5">
                            Hierarchical role administration, fine-grained capability simulator, and personal authority inspector.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={onRefresh}
                        className="px-3.5 py-2 text-xs font-black bg-white hover:bg-neutral-50 border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1.5"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-neutral-700" />
                        Sync
                    </button>

                    {canCreateRoles && (
                        <button
                            onClick={() => {
                                setRoleToEdit(null);
                                setIsCreateModalOpen(true);
                            }}
                            className="px-4 py-2 text-xs font-black bg-[#FFE566] hover:bg-[#FADC45] text-black border-2 border-black rounded-xl shadow-neo-sm transition active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            Create Custom Role
                        </button>
                    )}
                </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex border-b-2 border-black gap-2 overflow-x-auto pb-1">
                <button
                    onClick={() => setSubTab("hierarchy")}
                    className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all flex items-center gap-2 ${
                        subTab === "hierarchy"
                            ? "bg-white -mb-[2px] border-b-2 border-b-white z-10 shadow-neo-xs"
                            : "bg-[#FAF6EE] opacity-70 hover:opacity-100"
                    }`}
                >
                    <Layers className="w-3.5 h-3.5" />
                    Role Hierarchy & Permissions ({roles.length})
                </button>

                <button
                    onClick={() => setSubTab("simulator")}
                    className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all flex items-center gap-2 ${
                        subTab === "simulator"
                            ? "bg-white -mb-[2px] border-b-2 border-b-white z-10 shadow-neo-xs"
                            : "bg-[#FAF6EE] opacity-70 hover:opacity-100"
                    }`}
                >
                    <Sliders className="w-3.5 h-3.5" />
                    Capability Preview Simulator
                </button>

                <button
                    onClick={() => setSubTab("my-powers")}
                    className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all flex items-center gap-2 ${
                        subTab === "my-powers"
                            ? "bg-white -mb-[2px] border-b-2 border-b-white z-10 shadow-neo-xs"
                            : "bg-[#FAF6EE] opacity-70 hover:opacity-100"
                    }`}
                >
                    <UserCheck className="w-3.5 h-3.5" />
                    My Assigned Powers
                </button>
            </div>

            {/* TAB 1: ROLE HIERARCHY */}
            {subTab === "hierarchy" && (
                <div className="space-y-4">
                    {/* Search & Hierarchy Info Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative max-w-sm w-full">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search roles by name or description..."
                                className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-white border-2 border-black rounded-xl shadow-neo-xs focus:outline-none focus:ring-2 focus:ring-[#FFE566]"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 bg-white border-2 border-black rounded-xl px-3 py-1.5 shadow-neo-xs">
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            <span>Rank 1000 = Owner (Supreme)</span>
                            <span className="text-neutral-300">•</span>
                            <Shield className="w-3.5 h-3.5 text-blue-500" />
                            <span>Rank 800 = Admin</span>
                            <span className="text-neutral-300">•</span>
                            <span>Rank 200 = Member</span>
                        </div>
                    </div>

                    {/* Roles Grid / List */}
                    <div className="space-y-3">
                        {filteredRoles.map((role, idx) => {
                            const isSystem = role.isSystem;
                            const isRoleOwner = role.slug === "owner" || role.rank === 1000;
                            const isRoleAdmin = role.slug === "admin" || role.rank === 800;
                            const memberCount = memberCountsByRole[role.id] || 0;

                            const canEditThisRole =
                                canManageRoles &&
                                !isSystem &&
                                (isOwner || role.rank < actorRank);

                            return (
                                <div
                                    key={role.id}
                                    className={`bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-neo transition-all ${
                                        isRoleOwner ? "bg-amber-50/40" : ""
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                        {/* Left: Role identity & badges */}
                                        <div className="flex items-start sm:items-center gap-3.5">
                                            <div
                                                className="w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center shrink-0 shadow-neo-xs text-white"
                                                style={{ backgroundColor: role.color || "#475569" }}
                                            >
                                                {isRoleOwner ? (
                                                    <Crown className="w-5 h-5 text-amber-200" />
                                                ) : isRoleAdmin ? (
                                                    <Shield className="w-5 h-5" />
                                                ) : (
                                                    <Layers className="w-5 h-5" />
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-base font-black text-black">{role.name}</h3>
                                                    <span
                                                        className="px-2 py-0.5 text-[10px] font-black rounded-lg border border-black shadow-neo-xs"
                                                        style={{ backgroundColor: `${role.color || "#475569"}20`, color: role.color || "#475569" }}
                                                    >
                                                        Rank {role.rank}
                                                    </span>

                                                    {isSystem ? (
                                                        <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-lg flex items-center gap-1">
                                                            <Lock className="w-2.5 h-2.5" />
                                                            System Role
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-purple-100 text-purple-700 border border-purple-300 rounded-lg">
                                                            Custom Role
                                                        </span>
                                                    )}

                                                    <span className="text-xs font-bold text-neutral-500">
                                                        ({memberCount} {memberCount === 1 ? "member" : "members"})
                                                    </span>
                                                </div>

                                                {role.description && (
                                                    <p className="text-xs text-neutral-600 font-medium mt-1 leading-relaxed">
                                                        {role.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Actions and Hierarchy Controls */}
                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            {/* Preview in Simulator button */}
                                            <button
                                                onClick={() => {
                                                    setSelectedRoleForPreview(role.id);
                                                    setSubTab("simulator");
                                                }}
                                                className="px-3 py-1.5 text-xs font-black bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1.5"
                                                title="Preview effective capabilities in simulator"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-neutral-700" />
                                                Simulate
                                            </button>

                                            {/* Reorder Arrows (Only for custom roles when authorized) */}
                                            {canManageRoles && !isSystem && (
                                                <div className="flex items-center gap-1 border-2 border-black rounded-xl p-0.5 bg-neutral-50 shadow-neo-xs">
                                                    <button
                                                        onClick={() => handleMoveRole(idx, "up")}
                                                        disabled={idx === 0 || isReordering || sortedRoles[idx - 1]?.isSystem}
                                                        className="p-1 hover:bg-neutral-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Promote role rank"
                                                    >
                                                        <ArrowUp className="w-3.5 h-3.5 text-black" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveRole(idx, "down")}
                                                        disabled={
                                                            idx === sortedRoles.length - 1 ||
                                                            isReordering ||
                                                            sortedRoles[idx + 1]?.isSystem
                                                        }
                                                        className="p-1 hover:bg-neutral-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Demote role rank"
                                                    >
                                                        <ArrowDown className="w-3.5 h-3.5 text-black" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Edit Custom Role */}
                                            {canEditThisRole && (
                                                <button
                                                    onClick={() => {
                                                        setRoleToEdit(role);
                                                        setIsCreateModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-black bg-white hover:bg-neutral-100 text-black border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    Edit
                                                </button>
                                            )}

                                            {/* Delete Custom Role */}
                                            {canEditThisRole && (
                                                <button
                                                    onClick={() => setDeletingRole(role)}
                                                    className="px-3 py-1.5 text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Permissions badges row */}
                                    <div className="mt-3.5 pt-3 border-t-2 border-neutral-100 flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-black uppercase text-neutral-400 mr-1">
                                            Permissions ({role.permissions?.length || 0}):
                                        </span>
                                        {role.permissions?.includes("*") ? (
                                            <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                                                * (Full Supreme Authority)
                                            </span>
                                        ) : role.permissions && role.permissions.length > 0 ? (
                                            role.permissions.map((p) => (
                                                <span
                                                    key={p}
                                                    className="px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-md"
                                                >
                                                    {p}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[10px] font-medium text-neutral-500 italic">
                                                No direct permissions assigned
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: PERMISSION PREVIEW SIMULATOR */}
            {subTab === "simulator" && (
                <div className="space-y-4">
                    {/* Simulator Controls Card */}
                    <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-neo flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-base font-black text-black">Read-Only Permission Simulator</h2>
                                <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-lg">
                                    Simulated Environment
                                </span>
                            </div>
                            <p className="text-xs font-medium text-neutral-600 mt-1 max-w-xl">
                                Select any role to inspect exactly what modules, capabilities, and navigation items a member with that role would see in their workspace shell.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <label className="text-xs font-black uppercase text-black shrink-0">Simulate Role:</label>
                            <div className="min-w-[240px]">
                                <NeoSelect
                                    value={selectedRoleForPreview}
                                    onChange={(val) => setSelectedRoleForPreview(val)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-black"
                                    options={sortedRoles.map((r) => ({
                                        value: r.id,
                                        label: `${r.name} (Rank ${r.rank}) ${r.isSystem ? "[System]" : "[Custom]"}`,
                                    }))}
                                />
                            </div>
                        </div>
                    </div>

                    {previewLoading ? (
                        <div className="p-12 text-center bg-white border-2 border-black rounded-2xl shadow-neo flex flex-col items-center justify-center gap-3">
                            <OrbixLoader size="md" />
                            <span className="text-xs font-bold text-neutral-600">Resolving capability matrix...</span>
                        </div>
                    ) : previewResult ? (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            {/* Summary banner */}
                            <div className="bg-[#FFE566]/20 border-2 border-black rounded-2xl p-4 shadow-neo-xs flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Info className="w-5 h-5 text-amber-800 shrink-0" />
                                    <div>
                                        <h4 className="text-xs font-black text-black">
                                            Simulating: {previewResult.effectiveRole.name} (Rank {previewResult.highestRank})
                                        </h4>
                                        <p className="text-[11px] font-bold text-neutral-600">
                                            Highest manageable member rank: {previewResult.highestManageableRank} • Allowed Shell Tabs:{" "}
                                            {previewResult.navigation.allowedTabs.join(", ")}
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-white border border-black rounded-lg shadow-neo-xs">
                                    Read-Only
                                </span>
                            </div>

                            {/* Granular Module Capabilities Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* 1. Workspace Module */}
                                <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm">
                                    <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 mb-2.5 flex items-center justify-between">
                                        <span>Workspace Admin</span>
                                        <Shield className="w-3.5 h-3.5 text-neutral-600" />
                                    </h4>
                                    <ul className="space-y-1.5 text-xs font-medium">
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.workspace.manageSettings ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Manage Settings</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.workspace.manageRoles ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Manage Roles</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.workspace.viewAuditLogs ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>View Audit Logs</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* 2. Departments Module */}
                                <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm">
                                    <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 mb-2.5 flex items-center justify-between">
                                        <span>Departments</span>
                                        <Layers className="w-3.5 h-3.5 text-neutral-600" />
                                    </h4>
                                    <ul className="space-y-1.5 text-xs font-medium">
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.departments.create ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Create Departments</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.departments.manageAll ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Manage All Departments</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.departments.manageMembers ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Manage Roster</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* 3. Members Module */}
                                <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm">
                                    <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 mb-2.5 flex items-center justify-between">
                                        <span>Members & Access</span>
                                        <Users className="w-3.5 h-3.5 text-neutral-600" />
                                    </h4>
                                    <ul className="space-y-1.5 text-xs font-medium">
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.members.invite ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Invite New Members</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.members.manage ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Remove / Suspend</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.members.assignRole ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Assign Member Roles</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* 4. Tasks Workflow Module */}
                                <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm">
                                    <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 mb-2.5 flex items-center justify-between">
                                        <span>Tasks & Review</span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-neutral-600" />
                                    </h4>
                                    <ul className="space-y-1.5 text-xs font-medium">
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.tasks.create ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Create Tasks</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.tasks.assign ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Assign Tasks</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.tasks.review ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Review & Sign Off</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            {previewResult.capabilities.tasks.delete ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                            )}
                                            <span>Archive / Delete Tasks</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

            {/* TAB 3: MY ASSIGNED POWERS */}
            {subTab === "my-powers" && (
                <div className="space-y-4">
                    <div className="bg-white border-2 border-black rounded-2xl p-6 shadow-neo space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-neutral-100 pb-4">
                            <div className="flex items-center gap-3.5">
                                <div
                                    className="w-12 h-12 border-2 border-black rounded-2xl flex items-center justify-center text-white shadow-neo-sm"
                                    style={{ backgroundColor: currentMember?.role?.color || "#475569" }}
                                >
                                    {isOwner ? <Crown className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        {currentMember?.user?.firstName || "Your"} Authority Profile
                                    </h3>
                                    <p className="text-xs font-bold text-neutral-600">
                                        Assigned Role: <span className="text-black">{currentMember?.role?.name || "Member"}</span> (Rank {actorRank})
                                    </p>
                                </div>
                            </div>

                            <span
                                className="px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black shadow-neo-xs self-start sm:self-auto"
                                style={{
                                    backgroundColor: `${currentMember?.role?.color || "#475569"}20`,
                                    color: currentMember?.role?.color || "#475569",
                                }}
                            >
                                {isOwner
                                    ? "Tier 1: Club Manager (Supreme)"
                                    : capabilities?.isWorkspaceManager
                                    ? "Tier 2: Workspace Manager (Delegated)"
                                    : (capabilities?.leadDepartmentIds.length || 0) > 0
                                    ? "Tier 3: Department Lead"
                                    : "Tier 4: Team Member"}
                            </span>
                        </div>

                        {/* Department Lead Status */}
                        {(capabilities?.leadDepartmentIds.length || 0) > 0 && (
                            <div className="p-3.5 bg-[#A6FF70]/20 border-2 border-black rounded-xl">
                                <h4 className="text-xs font-black text-black flex items-center gap-2">
                                    <Crown className="w-3.5 h-3.5 text-emerald-800" />
                                    Department Lead Delegations
                                </h4>
                                <p className="text-[11px] font-bold text-neutral-700 mt-0.5">
                                    You have full leadership authority over tasks, deliverables, and channels in{" "}
                                    {capabilities?.leadDepartmentIds.length} department(s).
                                </p>
                            </div>
                        )}

                        {/* Effective Permissions */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-black mb-2">Effective Permission Grants</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {isOwner ? (
                                    <span className="px-2.5 py-1 text-xs font-black bg-[#FFE566] text-black border border-black rounded-lg shadow-neo-xs">
                                        * (Supreme Authority Across All Modules)
                                    </span>
                                ) : (capabilities?.effectivePermissions.length || 0) > 0 ? (
                                    capabilities?.effectivePermissions.map((p) => (
                                        <span
                                            key={p}
                                            className="px-2 py-0.5 text-[11px] font-mono font-bold bg-[#FAF6EE] text-black border border-black rounded-md"
                                        >
                                            {p}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-neutral-500 italic">Standard member permissions</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Role Modal */}
            <CreateEditRoleModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setRoleToEdit(null);
                }}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    setRoleToEdit(null);
                    onRefresh();
                }}
                clubId={clubId}
                roleToEdit={roleToEdit}
                currentMemberRank={actorRank}
                isOwner={isOwner}
                actorPermissions={capabilities?.effectivePermissions || []}
            />

            {/* Delete Confirmation Modal */}
            {deletingRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-[#FAF6EE] border-4 border-black rounded-2xl shadow-neo-lg p-6 max-w-md w-full space-y-4">
                        <div className="w-12 h-12 bg-rose-100 border-2 border-black rounded-2xl flex items-center justify-center shadow-neo-xs text-rose-600">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-black">
                                Delete Role: "{deletingRole.name}"?
                            </h3>
                            <p className="text-xs font-bold text-neutral-600 mt-1 leading-relaxed">
                                This custom role will be permanently removed. Any members currently holding this role will be automatically reassigned to the default <strong>Member</strong> role.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeletingRole(null)}
                                className="px-4 py-2 text-xs font-black bg-white hover:bg-neutral-100 border-2 border-black rounded-xl shadow-neo-xs transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteRole}
                                disabled={isDeleting}
                                className="px-4 py-2 text-xs font-black bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-xl shadow-neo-xs transition disabled:opacity-50"
                            >
                                {isDeleting ? "Deleting..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
