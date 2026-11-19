// Frontend/src/app/Club/TeamWorkspace/Manager/WorkspaceManagerModal.tsx
import React, { useState, useEffect } from "react";
import { UserCog, X, Check, Trash2, ShieldCheck } from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { TeamWorkspace, WorkspaceMember } from "../../../../types/workspace";
import { NeoSelect } from "../../../../components/NeoSelect";
import { NeoCheckbox } from "../../../../components/NeoCheckbox";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

interface WorkspaceManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspace: TeamWorkspace | null;
    members: WorkspaceMember[];
    clubId: string;
    onSuccess: () => void;
}

interface ManagerPermissionsState {
    can_manage_departments: boolean;
    can_manage_members: boolean;
    can_invite_members: boolean;
    can_manage_channels: boolean;
    can_manage_settings: boolean;
}

const DEFAULT_PERMISSIONS: ManagerPermissionsState = {
    can_manage_departments: true,
    can_manage_members: true,
    can_invite_members: true,
    can_manage_channels: true,
    can_manage_settings: false,
};

export const WorkspaceManagerModal: React.FC<WorkspaceManagerModalProps> = ({
    isOpen,
    onClose,
    workspace,
    members,
    clubId,
    onSuccess,
}) => {
    const toast = useToast();
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [permissions, setPermissions] = useState<ManagerPermissionsState>(DEFAULT_PERMISSIONS);
    const [loading, setLoading] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false);

    useEffect(() => {
        if (workspace?.managerUserId) {
            setSelectedUserId(workspace.managerUserId);
            if (workspace.managerPermissions) {
                const perms = Array.isArray(workspace.managerPermissions)
                    ? workspace.managerPermissions.reduce((acc, p) => ({ ...acc, [p]: true }), {} as Record<string, boolean>)
                    : (workspace.managerPermissions as Record<string, any>);
                setPermissions({
                    can_manage_departments: !!perms.can_manage_departments,
                    can_manage_members: !!perms.can_manage_members,
                    can_invite_members: !!perms.can_invite_members,
                    can_manage_channels: !!perms.can_manage_channels,
                    can_manage_settings: !!perms.can_manage_settings,
                });
            }
        } else {
            setSelectedUserId("");
            setPermissions(DEFAULT_PERMISSIONS);
        }
    }, [workspace]);

    if (!isOpen) return null;

    // Filter candidate members: exclude owner (rank 1000) or inactive/suspended members
    const candidateMembers = members.filter(
        (m) => !m.isSuspended && m.membershipStatus === "active" && m.role?.slug !== "owner"
    );

    const currentManager = members.find((m) => m.userId === workspace?.managerUserId);

    const togglePermission = (key: keyof ManagerPermissionsState) => {
        setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId) {
            toast.error("Please select a workspace member to appoint as Workspace Manager.");
            return;
        }

        try {
            setLoading(true);
            const res = await workspaceApi.appointManager({
                clubId,
                managerUserId: selectedUserId,
                permissions,
            });

            if (res.success) {
                toast.success(res.message || "Workspace Manager designated successfully");
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || "Failed to appoint manager");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to appoint Workspace Manager");
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        try {
            setIsRevoking(true);
            const res = await workspaceApi.revokeManager(clubId);
            if (res.success) {
                toast.success(res.message || "Workspace Manager revoked");
                setIsRevokeConfirmOpen(false);
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || "Failed to revoke manager");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to revoke manager");
        } finally {
            setIsRevoking(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl max-w-lg w-full p-6 shadow-neo animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-yellow-200 border-2 border-black rounded-lg">
                            <UserCog className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-black">Workspace Manager</h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Designate operational workspace administrator
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-neutral-100 border border-black rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                <div className="mt-3 p-3 bg-neutral-50 border-2 border-black rounded-xl text-xs text-neutral-700 leading-relaxed">
                    <span className="font-black text-black">Club Owner Protection:</span> The Workspace Manager executes day-to-day operations (departments, invitations, member coordination) but <strong>cannot</strong> transfer ownership, delete the workspace, or appoint other managers.
                </div>

                {workspace?.managerUserId && currentManager && (
                    <div className="mt-4 p-3 bg-emerald-50 border-2 border-black rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full border border-black bg-white flex items-center justify-center font-bold text-xs">
                                {currentManager.user?.avatarUrl ? (
                                    <img
                                        src={currentManager.user.avatarUrl}
                                        alt=""
                                        className="w-full h-full object-cover rounded-full"
                                    />
                                ) : (
                                    (currentManager.user?.firstName?.charAt(0) || "M")
                                )}
                            </div>
                            <div>
                                <div className="text-xs font-black text-black">
                                    {currentManager.user?.firstName} {currentManager.user?.lastName} (@{currentManager.user?.username})
                                </div>
                                <div className="text-[10px] text-emerald-800 font-medium flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Current Designated Manager
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsRevokeConfirmOpen(true)}
                            disabled={isRevoking}
                            className="px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 border border-black rounded-lg transition-all flex items-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" />
                            Revoke
                        </button>
                    </div>
                )}

                <form onSubmit={handleSave} className="mt-4 space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            Select Workspace Member *
                        </label>
                        <NeoSelect
                            value={selectedUserId}
                            onChange={(val) => setSelectedUserId(val)}
                            options={[
                                { value: "", label: "-- Choose Member to Appoint --" },
                                ...candidateMembers.map((m) => {
                                    const name = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.username;
                                    return {
                                        value: m.userId,
                                        label: `${name} (@${m.user?.username}) — ${m.roleTitle}`,
                                    };
                                }),
                            ]}
                            placeholder="-- Choose Member to Appoint --"
                            size="md"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-2">
                            Delegated Manager Permissions
                        </label>
                        <div className="space-y-3 border-2 border-black rounded-xl p-3 bg-neutral-50 text-xs">
                            <NeoCheckbox
                                checked={permissions.can_manage_departments}
                                onCheckedChange={() => togglePermission("can_manage_departments")}
                                label="Manage Departments"
                                description="Create, edit, archive and assign department leads"
                                colorScheme="yellow"
                                size="sm"
                            />
                            <NeoCheckbox
                                checked={permissions.can_manage_members}
                                onCheckedChange={() => togglePermission("can_manage_members")}
                                label="Manage Member Roles & Status"
                                description="Promote, demote and suspend non-admin members"
                                colorScheme="yellow"
                                size="sm"
                            />
                            <NeoCheckbox
                                checked={permissions.can_invite_members}
                                onCheckedChange={() => togglePermission("can_invite_members")}
                                label="Issue Workspace Invitations"
                                description="Generate cryptographic join tokens and invite team candidates"
                                colorScheme="yellow"
                                size="sm"
                            />
                            <NeoCheckbox
                                checked={permissions.can_manage_channels}
                                onCheckedChange={() => togglePermission("can_manage_channels")}
                                label="Manage Discussion Channels"
                                description="Create and configure public and department channels"
                                colorScheme="yellow"
                                size="sm"
                            />
                            <NeoCheckbox
                                checked={permissions.can_manage_settings}
                                onCheckedChange={() => togglePermission("can_manage_settings")}
                                label="Workspace Branding & Settings"
                                description="Update general description, icon, and announcement banners"
                                colorScheme="yellow"
                                size="sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading || isRevoking}
                            className="px-4 py-2 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedUserId}
                            className="px-4 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="animate-pulse">Saving...</span>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    {workspace?.managerUserId ? "Update Manager" : "Appoint Manager"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Revoke Confirmation Modal */}
            <ConfirmationModal
                isOpen={isRevokeConfirmOpen}
                onClose={() => setIsRevokeConfirmOpen(false)}
                onConfirm={handleRevoke}
                title="Revoke Workspace Manager Designation?"
                description="Are you sure you want to revoke the Workspace Manager designation? The current manager will immediately lose delegated workspace management privileges."
                confirmText="Revoke Manager"
                cancelText="Keep Manager"
                variant="danger"
                isLoading={isRevoking}
            />
        </div>
    );
};
