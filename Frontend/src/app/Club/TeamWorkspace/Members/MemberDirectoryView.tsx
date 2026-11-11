// Frontend/src/app/Club/TeamWorkspace/Members/MemberDirectoryView.tsx
import React, { useState } from "react";
import {
    Users,
    Search,
    UserPlus,
    Shield,
    Lock,
    UserCheck,
    UserX,
    Filter,
    Trash2,
    Sparkles,
} from "lucide-react";
import { useToast } from "../../../../context/ToastContext";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceDepartment,
    TeamWorkspace,
} from "../../../../types/workspace";
import { ChangeRoleModal } from "./ChangeRoleModal";
import { InviteMemberModal } from "./InviteMemberModal";
import { MemberRecognitionProfileModal } from "../Recognition/MemberRecognitionProfileModal";
import { NeoSelect } from "../../../../components/NeoSelect";

interface MemberDirectoryViewProps {
    workspace: TeamWorkspace;
    members: WorkspaceMember[];
    roles: WorkspaceRole[];
    departments: WorkspaceDepartment[];
    currentMember: WorkspaceMember | null;
    clubId: string;
    onRefresh: () => void;
    onToggleSuspension: (member: WorkspaceMember) => void;
    onNavigateToRoles?: () => void;
}

export const MemberDirectoryView: React.FC<MemberDirectoryViewProps> = ({
    workspace,
    members,
    roles,
    departments,
    currentMember,
    clubId,
    onRefresh,
    onToggleSuspension,
    onNavigateToRoles,
}) => {
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");

    // Modal states
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [roleModalMember, setRoleModalMember] = useState<WorkspaceMember | null>(null);
    const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [recognitionUserId, setRecognitionUserId] = useState<string | null>(null);

    // Permission checks
    const actorRank = currentMember?.role?.rank ?? 0;
    const isOwner = currentMember?.role?.slug === "owner" || actorRank === 1000;
    const isManager = currentMember?.userId === workspace.managerUserId;
    const canSeePrivate = isOwner || isManager || actorRank >= 800;
    const mgrPerms = Array.isArray(workspace.managerPermissions)
        ? workspace.managerPermissions.reduce((acc: any, p: string) => ({ ...acc, [p]: true }), {})
        : ((workspace.managerPermissions as Record<string, any>) || {});
    const canInvite =
        isOwner ||
        actorRank >= 800 ||
        (isManager && !!mgrPerms.can_invite_members);
    const canManageRoles =
        isOwner ||
        actorRank >= 800 ||
        (isManager && !!mgrPerms.can_manage_members);
    const canSuspend =
        isOwner ||
        actorRank >= 800 ||
        (isManager && !!mgrPerms.can_manage_members);

    // Filter members
    const filteredMembers = members.filter((m) => {
        // Status filter
        if (statusFilter === "active" && m.isSuspended) return false;
        if (statusFilter === "suspended" && !m.isSuspended) return false;

        // Role filter
        if (roleFilter !== "all" && m.roleId !== roleFilter && m.role?.slug !== roleFilter) {
            return false;
        }

        // Department filter (multi-department matching)
        if (departmentFilter !== "all") {
            const inDept = m.departments?.some((d) => d.id === departmentFilter);
            if (!inDept) return false;
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const fullName = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.toLowerCase();
            const username = (m.user?.username || "").toLowerCase();
            const email = (m.user?.email || "").toLowerCase();
            const roleTitle = (m.roleTitle || "").toLowerCase();
            const matchDept = m.departments?.some((d) => d.name.toLowerCase().includes(q));

            if (!fullName.includes(q) && !username.includes(q) && !email.includes(q) && !roleTitle.includes(q) && !matchDept) {
                return false;
            }
        }

        return true;
    });

    return (
        <div className="bg-white border-2 border-black rounded-xl p-6 shadow-neo space-y-5">
            {/* Header with Title and Invite CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-black flex items-center gap-2">
                        <Users className="w-5 h-5 text-black" />
                        Workspace Member Roster
                    </h3>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        Manage active roles, department associations, and membership access across the chapter.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {onNavigateToRoles && (
                        <button
                            onClick={onNavigateToRoles}
                            className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs transition flex items-center gap-1.5"
                        >
                            <Shield className="w-3.5 h-3.5 text-neutral-700" />
                            Manage Roles
                        </button>
                    )}

                    {canInvite && (
                        <button
                            onClick={() => setIsInviteOpen(true)}
                            className="px-4 py-2 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-sm transition-all flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            Invite Team Member
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center gap-2.5 p-3.5 bg-neutral-50 border-2 border-black rounded-xl">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search name, @handle, role, or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs font-semibold border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                        <Filter className="w-3.5 h-3.5" />
                        <span>Filters:</span>
                    </div>

                    {/* Role Filter */}
                    <div className="min-w-[150px]">
                        <NeoSelect
                            value={roleFilter}
                            onChange={(val) => setRoleFilter(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: `All Roles (${roles.length})` },
                                ...roles.map((r) => ({ value: r.id, label: r.name })),
                            ]}
                        />
                    </div>

                    {/* Department Filter */}
                    <div className="min-w-[170px]">
                        <NeoSelect
                            value={departmentFilter}
                            onChange={(val) => setDepartmentFilter(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: `All Departments (${departments.length})` },
                                ...departments.map((d) => ({ value: d.id, label: d.name })),
                            ]}
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="min-w-[140px]">
                        <NeoSelect
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "all", label: "All Statuses" },
                                { value: "active", label: "Active Members" },
                                { value: "suspended", label: "Suspended Only" },
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* Members Directory Table */}
            <div className="overflow-x-auto border-2 border-black rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-neutral-100 border-b-2 border-black font-black uppercase text-neutral-700">
                            <th className="p-3">Member Profile</th>
                            <th className="p-3">Workspace Role</th>
                            <th className="p-3">Departments</th>
                            <th className="p-3">Joined</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y border-black font-medium bg-white">
                        {filteredMembers.map((m) => {
                            const isTargetOwner = m.role?.slug === "owner" || m.role?.rank === 1000;
                            const isTargetManager = m.userId === workspace.managerUserId;
                            const fullName =
                                `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                                m.user?.username ||
                                "Unknown";

                            const canModifyThisMember =
                                !isTargetOwner &&
                                m.userId !== currentMember?.userId &&
                                (isOwner || (actorRank > (m.role?.rank || 0)));

                            return (
                                <tr key={m.id} className="hover:bg-neutral-50/80 transition-colors">
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full border-2 border-black bg-neutral-200 overflow-hidden flex items-center justify-center font-black text-xs shrink-0">
                                                {m.user?.avatarUrl ? (
                                                    <img
                                                        src={m.user.avatarUrl}
                                                        alt={fullName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    fullName.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-black text-black flex items-center gap-1.5 flex-wrap">
                                                    {fullName}
                                                    {isTargetOwner && (
                                                        <span className="px-1.5 py-0.2 text-[10px] bg-red-100 text-red-700 border border-black rounded font-black">
                                                            Owner
                                                        </span>
                                                    )}
                                                    {isTargetManager && (
                                                        <span className="px-1.5 py-0.2 text-[10px] bg-yellow-100 text-yellow-800 border border-black rounded font-black">
                                                            Manager
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-neutral-500 font-mono">
                                                    @{m.user?.username}
                                                    {canSeePrivate && m.user?.email && (
                                                        <span className="text-neutral-400"> • {m.user.email}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-3">
                                        <span
                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border border-black shadow-neo-xxs"
                                            style={{
                                                backgroundColor: `${m.role?.color || "#000000"}15`,
                                                color: m.role?.color || "#000000",
                                            }}
                                        >
                                            <Shield className="w-3 h-3" />
                                            {m.roleTitle || m.role?.name || "Member"}
                                        </span>
                                    </td>

                                    <td className="p-3">
                                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                            {m.departments && m.departments.length > 0 ? (
                                                m.departments.map((dept) => (
                                                    <span
                                                        key={dept.id}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border border-black bg-neutral-100"
                                                    >
                                                        <span
                                                            className="w-1.5 h-1.5 rounded-full"
                                                            style={{ backgroundColor: dept.color }}
                                                        />
                                                        {dept.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-neutral-400 italic">
                                                    No department assigned
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="p-3 text-neutral-600 font-medium">
                                        {new Date(m.joinedAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </td>

                                    <td className="p-3">
                                        {m.isSuspended ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black bg-amber-100 text-amber-800 border border-black rounded">
                                                <Lock className="w-3 h-3 text-amber-700" />
                                                Suspended
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black bg-emerald-100 text-emerald-800 border border-black rounded">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                                Active
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {/* Recognition Profile Trigger */}
                                            <button
                                                onClick={() => setRecognitionUserId(m.userId)}
                                                className="px-2 py-1 text-[11px] font-black border border-black rounded bg-[#FFE566] hover:bg-[#fedb33] shadow-neo-xxs transition-all flex items-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
                                                title="View member workspace recognition profile"
                                            >
                                                <Sparkles className="w-3 h-3 fill-black text-black" />
                                                <span>Orbits</span>
                                            </button>

                                            {canManageRoles && canModifyThisMember && (
                                                <button
                                                    onClick={() => setRoleModalMember(m)}
                                                    className="px-2 py-1 text-[11px] font-bold border border-black rounded bg-white hover:bg-neutral-100 shadow-neo-xs transition-all"
                                                    title="Change workspace hierarchy role"
                                                >
                                                    Change Role
                                                </button>
                                            )}

                                            {canSuspend && canModifyThisMember && (
                                                <button
                                                    onClick={() => onToggleSuspension(m)}
                                                    className={`px-2 py-1 text-[11px] font-bold border border-black rounded shadow-neo-xs transition-all ${
                                                        m.isSuspended
                                                            ? "bg-emerald-200 hover:bg-emerald-300 text-black"
                                                            : "bg-amber-100 hover:bg-amber-200 text-black"
                                                    }`}
                                                    title={m.isSuspended ? "Restore access" : "Suspend workspace access"}
                                                >
                                                    {m.isSuspended ? (
                                                        <span className="flex items-center gap-1">
                                                            <UserCheck className="w-3 h-3" /> Restore
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <UserX className="w-3 h-3" /> Suspend
                                                        </span>
                                                    )}
                                                </button>
                                            )}

                                            {canModifyThisMember && (isOwner || isManager || actorRank >= 800) && (
                                                <button
                                                    onClick={() => setMemberToRemove(m)}
                                                    className="p-1 text-red-600 hover:text-red-800 border border-transparent hover:border-black rounded transition"
                                                    title="Remove member from workspace"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {filteredMembers.length === 0 && (
                            <tr>
                                <td colSpan={canManageRoles || canSuspend ? 6 : 5} className="p-8 text-center text-neutral-500 font-bold">
                                    No members match the selected filters or search query.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Change Role Modal */}
            {roleModalMember && (
                <ChangeRoleModal
                    isOpen={!!roleModalMember}
                    onClose={() => setRoleModalMember(null)}
                    member={roleModalMember}
                    roles={roles}
                    currentActor={currentMember}
                    clubId={clubId}
                    onSuccess={() => {
                        onRefresh();
                        setRoleModalMember(null);
                    }}
                />
            )}

            {/* Invite Member Modal */}
            <InviteMemberModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                clubId={clubId}
                roles={roles}
                departments={departments}
                onSuccess={() => {
                    onRefresh();
                }}
            />

            {/* Remove Member Confirmation Modal */}
            {memberToRemove && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white border-2 border-black rounded-2xl p-6 max-w-sm w-full shadow-neo text-center animate-in fade-in">
                        <div className="w-12 h-12 bg-red-100 border-2 border-black rounded-xl flex items-center justify-center mx-auto mb-3 shadow-neo-xs">
                            <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        <h4 className="text-base font-black text-black">Remove from Workspace?</h4>
                        <p className="text-xs text-neutral-600 mt-2 font-medium">
                            Are you sure you want to remove <strong>@{memberToRemove.user?.username}</strong> from this workspace? They will lose access to all channels, tasks, and departments.
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-5">
                            <button
                                onClick={async () => {
                                    try {
                                        setIsRemoving(true);
                                        const res = await workspaceApi.removeMember(memberToRemove.userId, clubId);
                                        if (res.success) {
                                            toast.success(res.message);
                                            setMemberToRemove(null);
                                            onRefresh();
                                        }
                                    } catch (err: any) {
                                        toast.error(err.message || "Failed to remove member.");
                                    } finally {
                                        setIsRemoving(false);
                                    }
                                }}
                                disabled={isRemoving}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs border-2 border-black rounded-xl shadow-neo-xs transition disabled:opacity-50"
                            >
                                {isRemoving ? "Removing..." : "Yes, Remove"}
                            </button>
                            <button
                                onClick={() => setMemberToRemove(null)}
                                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs border border-black rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Recognition Profile Modal */}
            <MemberRecognitionProfileModal
                isOpen={!!recognitionUserId}
                onClose={() => setRecognitionUserId(null)}
                userId={recognitionUserId}
                clubId={clubId}
            />
        </div>
    );
};
