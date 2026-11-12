// Frontend/src/app/Club/TeamWorkspace/Roles/RolesPermissionsView.tsx
import React, { useState, useMemo, useCallback, useRef } from "react";
import {
    Shield,
    Users,
    Plus,
    ArrowUp,
    ArrowDown,
    Edit3,
    Trash2,
    CheckCircle2,
    XCircle,
    Lock,
    Crown,
    UserCheck,
    Layers,
    Sliders,
    RefreshCw,
    Search,
    AlertTriangle,
    X,
    Sparkles,
    MessageSquare,
    Folder,
    Award,
    Eye,
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

interface RolesPermissionsViewProps {
    clubId: string;
    roles: WorkspaceRole[];
    members: WorkspaceMember[];
    departments: WorkspaceDepartment[];
    currentMember: WorkspaceMember | null;
    capabilities: MemberCapabilityResolution | null;
    isAdmin?: boolean;
    isClubContext?: boolean;
    onRefresh: () => void;
}

interface TierDefinition {
    tierNumber: number;
    title: string;
    subtitle: string;
    badgeBg: string;
    badgeText: string;
    accentColor: string;
    rankRange: string;
    roles: WorkspaceRole[];
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({
    clubId,
    roles,
    members,
    departments: _departments,
    currentMember,
    capabilities,
    isAdmin = false,
    isClubContext = false,
    onRefresh,
}) => {
    const toast = useToast();

    // Active sub-tab within Roles view: "hierarchy" (Tree & Permissions) or "my-powers"
    const [subTab, setSubTab] = useState<"hierarchy" | "my-powers">("hierarchy");
    const activeSubTab = isClubContext ? "hierarchy" : subTab;

    // Modal state for Create / Edit role
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [roleToEdit, setRoleToEdit] = useState<WorkspaceRole | null>(null);

    // Delete role state
    const [deletingRole, setDeletingRole] = useState<WorkspaceRole | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Reorder loading state
    const [isReordering, setIsReordering] = useState(false);

    // Filter search in Tree
    const [searchQuery, setSearchQuery] = useState("");

    // Active Simulated Role state (merged simulator into tree)
    const [simulatedRoleId, setSimulatedRoleId] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewCache, setPreviewCache] = useState<Record<string, WorkspacePermissionPreviewResult>>({});

    const simulatorRef = useRef<HTMLDivElement | null>(null);

    // Authority computations (Club identity has equivalent supreme authority to Workspace Owner)
    const isOwner = Boolean(isClubContext || capabilities?.isOwner || currentMember?.role?.slug === "owner");
    const actorRank = isClubContext ? 1000 : (capabilities?.highestRank || currentMember?.role?.rank || 0);
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

    // Group sorted roles into 4 distinct hierarchical tiers:
    // 1. Workspace Owner (Highest rank, Rank 1000+)
    // 2. Administrator (Rank 700 - 999)
    // 3. Department Lead (Rank 400 - 699)
    // 4. Members & Contributors (Rank < 400)
    const tiers: TierDefinition[] = useMemo(() => {
        const t1Roles = sortedRoles.filter((r) => r.rank >= 1000);
        const t2Roles = sortedRoles.filter((r) => r.rank >= 700 && r.rank < 1000);
        const t3Roles = sortedRoles.filter((r) => r.rank >= 400 && r.rank < 700);
        const t4Roles = sortedRoles.filter((r) => r.rank < 400);

        return [
            {
                tierNumber: 1,
                title: "Workspace Owner",
                subtitle: "Supreme Authority • Complete administrative control over workspace, memberships, and billing.",
                badgeBg: "bg-amber-100",
                badgeText: "text-amber-900 border-amber-300",
                accentColor: "#dc2626",
                rankRange: "Rank 1000 (Supreme)",
                roles: t1Roles,
            },
            {
                tierNumber: 2,
                title: "Administrator",
                subtitle: "System Governance • High-level delegation to manage members, channels, tasks, and audit logs.",
                badgeBg: "bg-purple-100",
                badgeText: "text-purple-900 border-purple-300",
                accentColor: "#7c3aed",
                rankRange: "Rank 700 – 999",
                roles: t2Roles,
            },
            {
                tierNumber: 3,
                title: "Department Lead",
                subtitle: "Departmental Leadership • Oversees assigned team roster, deliverables, reviews, and channels.",
                badgeBg: "bg-blue-100",
                badgeText: "text-blue-900 border-blue-300",
                accentColor: "#2563eb",
                rankRange: "Rank 400 – 699",
                roles: t3Roles,
            },
            {
                tierNumber: 4,
                title: "Members, Guests & Observers",
                subtitle: "Collaboration & Read-Only • Active contributors, guest participants, and read-only observers.",
                badgeBg: "bg-emerald-100",
                badgeText: "text-emerald-900 border-emerald-300",
                accentColor: "#16a34a",
                rankRange: "Rank 1 – 399",
                roles: t4Roles,
            },
        ];
    }, [sortedRoles]);

    // Load Preview Simulator data for a role
    const loadPreview = useCallback(
        async (roleId: string) => {
            if (!roleId) return;
            if (previewCache[roleId]) return;

            try {
                setPreviewLoading(true);
                const res = await workspaceApi.previewPermissions({ roleId }, clubId);
                if (res.success && res.preview) {
                    setPreviewCache((prev) => ({ ...prev, [roleId]: res.preview }));
                }
            } catch (err: any) {
                toast.error(err.message || "Failed to load capability preview.");
            } finally {
                setPreviewLoading(false);
            }
        },
        [clubId, previewCache, toast]
    );

    // Trigger simulation when user clicks a role card
    const handleSelectRoleForSimulation = (roleId: string) => {
        if (simulatedRoleId === roleId) {
            // Toggle off if already selected
            setSimulatedRoleId(null);
            return;
        }
        setSimulatedRoleId(roleId);
        loadPreview(roleId);

        // Smooth scroll to the simulator inspection panel
        setTimeout(() => {
            simulatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    // Handle role reordering (Moving custom role Up or Down)
    const handleMoveRole = async (roleIndex: number, direction: "up" | "down", e: React.MouseEvent) => {
        e.stopPropagation();
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
                if (simulatedRoleId === deletingRole.id) {
                    setSimulatedRoleId(null);
                }
                onRefresh();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete role.");
        } finally {
            setIsDeleting(false);
        }
    };

    // Active simulated preview data
    const activePreview = simulatedRoleId ? previewCache[simulatedRoleId] : null;
    const activeRole = sortedRoles.find((r) => r.id === simulatedRoleId);

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
                            Hierarchical role administration with integrated real-time capability simulator.
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

            {/* Sub-tab Navigation (Only visible in personal member context where My Assigned Powers is relevant) */}
            {!isClubContext && (
                <div className="flex border-b-2 border-black gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={() => setSubTab("hierarchy")}
                        className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all flex items-center gap-2 ${
                            activeSubTab === "hierarchy"
                                ? "bg-white -mb-[2px] border-b-2 border-b-white z-10 shadow-neo-xs"
                                : "bg-[#FAF6EE] opacity-70 hover:opacity-100"
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        Role Hierarchy & Permissions ({roles.length})
                    </button>

                    <button
                        onClick={() => setSubTab("my-powers")}
                        className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all flex items-center gap-2 ${
                            activeSubTab === "my-powers"
                                ? "bg-white -mb-[2px] border-b-2 border-b-white z-10 shadow-neo-xs"
                                : "bg-[#FAF6EE] opacity-70 hover:opacity-100"
                        }`}
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        My Assigned Powers
                    </button>
                </div>
            )}

            {/* TAB 1: TREE-LIKE ROLE HIERARCHY & INTEGRATED SIMULATOR */}
            {activeSubTab === "hierarchy" && (
                <div className="space-y-6">
                    {/* Search & Hierarchy Legend Bar */}
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

                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-neutral-600 bg-white border-2 border-black rounded-xl px-3 py-1.5 shadow-neo-xs">
                            <span className="flex items-center gap-1 font-black text-amber-700">
                                <Crown className="w-3.5 h-3.5" /> Owner (1000)
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1 font-black text-purple-700">
                                <Shield className="w-3.5 h-3.5" /> Admin (800)
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1 font-black text-blue-700">
                                <Award className="w-3.5 h-3.5" /> Dept Lead (500)
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1 font-black text-emerald-700">
                                <Users className="w-3.5 h-3.5" /> Member (200)
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1 font-black text-zinc-600">
                                <UserCheck className="w-3.5 h-3.5" /> Guest (100)
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="flex items-center gap-1 font-black text-slate-600">
                                <Eye className="w-3.5 h-3.5" /> Observer (50)
                            </span>
                        </div>
                    </div>

                    {/* Interactive Tree Structure Container */}
                    <div className="bg-[#FAF6EE] border-4 border-black rounded-3xl p-5 sm:p-8 shadow-neo relative overflow-hidden">
                        {/* Background dot grid pattern */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
                                backgroundSize: "16px 16px",
                            }}
                        />

                        {/* Instruction Pill */}
                        <div className="relative z-10 flex items-center justify-between mb-8 pb-4 border-b-2 border-black/10">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-black uppercase text-black tracking-wider">
                                    Organizational Role Tree & Delegation Chain
                                </span>
                            </div>
                            <span className="text-[11px] font-bold text-neutral-600 bg-white px-2.5 py-1 border-2 border-black rounded-lg shadow-neo-xs">
                                Click any card to inspect & simulate powers
                            </span>
                        </div>

                        {/* Vertical Tree Flow */}
                        <div className="relative z-10 space-y-6">
                            {tiers.map((tier, tierIdx) => {
                                const matchingRoles = tier.roles.filter((r) => {
                                    if (!searchQuery.trim()) return true;
                                    const q = searchQuery.toLowerCase();
                                    return (
                                        r.name.toLowerCase().includes(q) ||
                                        r.slug.toLowerCase().includes(q) ||
                                        (r.description && r.description.toLowerCase().includes(q))
                                    );
                                });

                                if (matchingRoles.length === 0 && searchQuery.trim()) {
                                    return null;
                                }

                                return (
                                    <div key={tier.tierNumber} className="relative">
                                        {/* Connector Trunk from previous tier */}
                                        {tierIdx > 0 && (
                                            <div className="flex flex-col items-center justify-center my-3">
                                                <div className="w-1 h-6 bg-black" />
                                                <div className="w-7 h-7 rounded-full bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-neo-xs font-black text-xs text-black">
                                                    ↓
                                                </div>
                                                <div className="w-1 h-6 bg-black" />
                                            </div>
                                        )}

                                        {/* Tier Banner / Header */}
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-0.5 text-xs font-black uppercase rounded-lg border-2 border-black shadow-neo-xs ${tier.badgeBg} ${tier.badgeText}`}>
                                                    Tier {tier.tierNumber} • {tier.title}
                                                </span>
                                                <span className="text-[11px] font-bold text-neutral-500 hidden sm:inline">
                                                    ({tier.rankRange})
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                {matchingRoles.length} {matchingRoles.length === 1 ? "Role" : "Roles"} in Tier
                                            </span>
                                        </div>

                                        {/* Tier Roles Grid */}
                                        <div
                                            className={`grid gap-4 ${
                                                matchingRoles.length === 1
                                                    ? "grid-cols-1 max-w-2xl mx-auto"
                                                    : matchingRoles.length === 2
                                                    ? "grid-cols-1 md:grid-cols-2"
                                                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                                            }`}
                                        >
                                            {matchingRoles.map((role) => {
                                                const isSystem = role.isSystem;
                                                const isRoleOwner = role.slug === "owner" || role.rank >= 1000;
                                                const isRoleAdmin = role.slug === "admin" || (role.rank >= 800 && role.rank < 1000);
                                                const isRoleLead = role.slug === "dept_lead" || (role.rank >= 400 && role.rank < 800);
                                                const memberCount = memberCountsByRole[role.id] || 0;
                                                const isSimulating = simulatedRoleId === role.id;
                                                const globalIdx = sortedRoles.findIndex((r) => r.id === role.id);

                                                const canEditThisRole =
                                                    canManageRoles &&
                                                    !isSystem &&
                                                    (isOwner || role.rank < actorRank);

                                                return (
                                                    <div
                                                        key={role.id}
                                                        onClick={() => handleSelectRoleForSimulation(role.id)}
                                                        className={`relative bg-white border-3 border-black rounded-2xl p-5 shadow-neo transition-all duration-150 cursor-pointer text-left ${
                                                            isSimulating
                                                                ? "ring-4 ring-black bg-[#FFE566]/20 border-black shadow-neo-lg scale-[1.01]"
                                                                : isRoleOwner
                                                                ? "border-amber-500/80 hover:border-black hover:shadow-neo-md"
                                                                : "hover:border-black hover:shadow-neo-md"
                                                        }`}
                                                    >
                                                        {/* Active Simulating indicator pill */}
                                                        {isSimulating && (
                                                            <div className="absolute -top-3 -right-2 bg-black text-[#A6FF70] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-black shadow-neo-xs flex items-center gap-1 z-20">
                                                                <span className="w-2 h-2 rounded-full bg-[#A6FF70] animate-pulse" />
                                                                Currently Simulating
                                                            </div>
                                                        )}

                                                        {/* Top Row: Icon, Title, Badges */}
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-11 h-11 border-2 border-black rounded-xl flex items-center justify-center shrink-0 shadow-neo-xs text-white"
                                                                    style={{ backgroundColor: role.color || tier.accentColor }}
                                                                >
                                                                    {isRoleOwner ? (
                                                                        <Crown className="w-6 h-6 text-amber-200" />
                                                                    ) : isRoleAdmin ? (
                                                                        <Shield className="w-5 h-5" />
                                                                    ) : isRoleLead ? (
                                                                        <Award className="w-5 h-5" />
                                                                    ) : (
                                                                        <Users className="w-5 h-5" />
                                                                    )}
                                                                </div>

                                                                <div>
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <h3 className="text-sm font-black text-black">
                                                                            {role.name}
                                                                        </h3>
                                                                        <span
                                                                            className="px-2 py-0.5 text-[10px] font-black rounded-lg border border-black shadow-neo-xs"
                                                                            style={{
                                                                                backgroundColor: `${role.color || tier.accentColor}20`,
                                                                                color: role.color || tier.accentColor,
                                                                            }}
                                                                        >
                                                                            Rank {role.rank}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black">
                                                                        {isSystem ? (
                                                                            <span className="px-1.5 py-0.5 uppercase bg-neutral-100 text-neutral-700 border border-neutral-300 rounded flex items-center gap-1">
                                                                                <Lock className="w-2.5 h-2.5" />
                                                                                System
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-1.5 py-0.5 uppercase bg-purple-100 text-purple-700 border border-purple-300 rounded">
                                                                                Custom
                                                                            </span>
                                                                        )}
                                                                        <span className="text-neutral-500 font-bold">
                                                                            • {memberCount} {memberCount === 1 ? "member" : "members"}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Description */}
                                                        {role.description && (
                                                            <p className="text-xs text-neutral-600 font-medium mt-2.5 line-clamp-2 leading-relaxed">
                                                                {role.description}
                                                            </p>
                                                        )}

                                                        {/* Permissions Badges Row */}
                                                        <div className="mt-3.5 pt-2.5 border-t-2 border-neutral-100 flex flex-wrap items-center gap-1">
                                                            <span className="text-[10px] font-black uppercase text-neutral-400 mr-1">
                                                                Grants ({role.permissions?.length || 0}):
                                                            </span>
                                                            {role.permissions?.includes("*") ? (
                                                                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
                                                                    * (Full Supreme Authority)
                                                                </span>
                                                            ) : role.permissions && role.permissions.length > 0 ? (
                                                                <>
                                                                    {role.permissions.slice(0, 3).map((p) => (
                                                                        <span
                                                                            key={p}
                                                                            className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-300 rounded"
                                                                        >
                                                                            {p}
                                                                        </span>
                                                                    ))}
                                                                    {role.permissions.length > 3 && (
                                                                        <span className="px-1.5 py-0.5 text-[9px] font-black bg-neutral-200 text-neutral-700 border border-neutral-300 rounded">
                                                                            +{role.permissions.length - 3} more
                                                                        </span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-neutral-400 italic">No direct permissions</span>
                                                            )}
                                                        </div>

                                                        {/* Reorder and Edit Actions for Custom Roles */}
                                                        {canEditThisRole && (
                                                            <div className="mt-3 pt-2.5 border-t-2 border-neutral-100 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={(e) => handleMoveRole(globalIdx, "up", e)}
                                                                        disabled={globalIdx === 0 || isReordering || sortedRoles[globalIdx - 1]?.isSystem}
                                                                        className="p-1 hover:bg-neutral-200 rounded border border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        title="Promote role rank"
                                                                    >
                                                                        <ArrowUp className="w-3 h-3 text-black" />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => handleMoveRole(globalIdx, "down", e)}
                                                                        disabled={
                                                                            globalIdx === sortedRoles.length - 1 ||
                                                                            isReordering ||
                                                                            sortedRoles[globalIdx + 1]?.isSystem
                                                                        }
                                                                        className="p-1 hover:bg-neutral-200 rounded border border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        title="Demote role rank"
                                                                    >
                                                                        <ArrowDown className="w-3 h-3 text-black" />
                                                                    </button>
                                                                </div>

                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            setRoleToEdit(role);
                                                                            setIsCreateModalOpen(true);
                                                                        }}
                                                                        className="px-2 py-1 text-[10px] font-black bg-white hover:bg-neutral-100 text-black border border-black rounded-lg shadow-neo-xs flex items-center gap-1"
                                                                    >
                                                                        <Edit3 className="w-3 h-3" />
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeletingRole(role)}
                                                                        className="px-2 py-1 text-[10px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-black rounded-lg shadow-neo-xs flex items-center gap-1"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* MERGED CAPABILITY PREVIEW SIMULATOR INSPECTION PANEL */}
                    {simulatedRoleId && (
                        <div
                            ref={simulatorRef}
                            className="scroll-mt-6 bg-white border-4 border-black rounded-3xl p-5 sm:p-7 shadow-neo space-y-6 animate-in fade-in duration-200"
                        >
                            {/* Simulator Header Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                                <div className="flex items-center gap-3.5">
                                    <div
                                        className="w-12 h-12 border-2 border-black rounded-2xl flex items-center justify-center text-white shadow-neo-sm"
                                        style={{ backgroundColor: activeRole?.color || "#475569" }}
                                    >
                                        <Sliders className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-black text-black">
                                                Simulating: {activeRole?.name}
                                            </h2>
                                            <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#FFE566] border border-black rounded-lg">
                                                Rank {activeRole?.rank}
                                            </span>
                                            <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-lg">
                                                Simulated Environment
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                            Examine exact module permissions, shell navigation tabs, and authority boundaries for this role.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSimulatedRoleId(null)}
                                        className="px-3.5 py-1.5 text-xs font-black bg-neutral-100 hover:bg-neutral-200 text-black border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Close Simulator
                                    </button>
                                </div>
                            </div>

                            {previewLoading ? (
                                <div className="p-12 text-center bg-[#FAF6EE] border-2 border-black rounded-2xl shadow-neo flex flex-col items-center justify-center gap-3">
                                    <OrbixLoader size="md" />
                                    <span className="text-xs font-black text-black">Resolving capability matrix for {activeRole?.name}...</span>
                                </div>
                            ) : activePreview ? (
                                <div className="space-y-6">
                                    {/* Allowed Workspace Shell Tabs */}
                                    {(() => {
                                        const shellTabs = [
                                            { id: "overview", label: "Workspace Overview" },
                                            { id: "departments", label: "Departments" },
                                            { id: "roster", label: "Member Roster" },
                                            { id: "invitations", label: "Invitations" },
                                            { id: "channels", label: "Channels & Chat" },
                                            { id: "all-tasks", label: "All Tasks" },
                                            { id: "my-tasks", label: "My Tasks" },
                                            { id: "resources", label: "Files & Resources" },
                                            { id: "recognition", label: "Recognition" },
                                            { id: "activity", label: "Activity Log" },
                                            { id: "audit", label: "Audit Trail" },
                                            { id: "roles", label: "Roles & Permissions" },
                                            { id: "settings", label: "Settings" },
                                        ];

                                        const checkTabAllowed = (tabId: string) => {
                                            return (
                                                activePreview.navigation.allowedTabs.includes(tabId) ||
                                                (tabId === "roster" && (activePreview.navigation.allowedTabs.includes("members") || activePreview.navigation.canViewMembers)) ||
                                                (tabId === "resources" && (activePreview.navigation.allowedTabs.includes("files") || activePreview.navigation.canViewResources)) ||
                                                (tabId === "recognition" && (activePreview.navigation.allowedTabs.includes("recognition") || activePreview.navigation.canViewRecognition))
                                            );
                                        };

                                        const allowedCount = shellTabs.filter((t) => checkTabAllowed(t.id)).length;

                                        return (
                                            <div className="bg-[#FAF6EE] border-2 border-black rounded-2xl p-4 shadow-neo-xs space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                                                        <Layers className="w-4 h-4 text-black" />
                                                        Allowed Shell Navigation Tabs ({allowedCount})
                                                    </h4>
                                                    <span className="text-[10px] font-bold text-neutral-500">
                                                        Simulated user experience in team workspace
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5">
                                                    {shellTabs.map((tab) => {
                                                        const isAllowed = checkTabAllowed(tab.id);
                                                        return (
                                                            <span
                                                                key={tab.id}
                                                                className={`px-2.5 py-1 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition ${
                                                                    isAllowed
                                                                        ? "bg-white text-black border-black shadow-neo-xs font-black"
                                                                        : "bg-neutral-100 text-neutral-400 border-neutral-300 line-through opacity-60"
                                                                }`}
                                                            >
                                                                {isAllowed ? (
                                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                ) : (
                                                                    <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                                                                )}
                                                                {tab.label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Granular Module Capabilities Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {/* 1. Workspace Admin */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Workspace Admin</span>
                                                <Shield className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.workspace.manageSettings ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage Settings</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.workspace.manageRoles ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage Roles</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.workspace.viewAuditLogs ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>View Audit Logs</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* 2. Departments Module */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Departments</span>
                                                <Layers className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.departments.create ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Create Departments</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.departments.manageAll ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage All Departments</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.departments.manageMembers ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage Member Roster</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* 3. Members & Access */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Members & Access</span>
                                                <Users className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.members.invite ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Invite New Members</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.members.manage ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Remove / Suspend</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.members.assignRole ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Assign Member Roles</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* 4. Tasks Workflow */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Tasks & Review</span>
                                                <CheckCircle2 className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.tasks.create ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Create Tasks</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.tasks.assign ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Assign Tasks</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.tasks.review ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Review & Sign Off</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.tasks.delete ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Archive / Delete Tasks</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* 5. Channels & Communication */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Channels & Chat</span>
                                                <MessageSquare className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.channels.create ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Create Channels</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.channels.manage ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage Channels</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.channels.sendMessages ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Send Messages & Chat</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.channels.moderate ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Moderate & Delete Any</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* 6. Files & Resources */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Files & Resources</span>
                                                <Folder className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.assets.upload ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Upload Attachments</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.assets.manage ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage Shared Resources</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.audit.view ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Audit Visibility</span>
                                                </li>
                                            </ul>
                                        </div>

                                        {/* 7. Recognition & Orbits */}
                                        <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-neo-sm space-y-2">
                                            <h4 className="text-xs font-black uppercase text-black border-b-2 border-neutral-100 pb-2 flex items-center justify-between">
                                                <span>Recognition & Orbits</span>
                                                <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                                            </h4>
                                            <ul className="space-y-1.5 text-xs font-medium">
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.recognition?.view ?? true ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>View Leaderboards & Stats</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.recognition?.award ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Award Orbits</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.recognition?.managePolicy ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Manage Policy & Budgets</span>
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    {activePreview.capabilities.recognition?.reverse ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                                                    )}
                                                    <span>Audited Award Reversals</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: MY ASSIGNED POWERS (Personal user context only) */}
            {!isClubContext && activeSubTab === "my-powers" && (
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
                                    ? "Tier 1: Workspace Owner (Supreme)"
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
