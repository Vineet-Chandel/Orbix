// Frontend/src/app/Club/TeamWorkspace/Invitations/InvitationsOverviewView.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Mail,
    UserPlus,
    Clock,
    CheckCircle2,
    XCircle,
    Shield,
    Trash2,
    RefreshCw,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type {
    WorkspaceInvitation,
    WorkspaceRole,
    WorkspaceDepartment,
    WorkspaceMember,
} from "../../../../types/workspace";
import { InviteMemberModal } from "../Members/InviteMemberModal";
import { ConfirmationModal } from "../../../../components/ConfirmationModal";

interface InvitationsOverviewViewProps {
    clubId: string;
    roles: WorkspaceRole[];
    departments: WorkspaceDepartment[];
    members?: WorkspaceMember[];
    currentMember: WorkspaceMember | null;
    isClubContext?: boolean;
    onRefreshMembers?: () => void;
}

export const InvitationsOverviewView: React.FC<InvitationsOverviewViewProps> = ({
    clubId,
    roles,
    departments,
    members,
    currentMember,
    isClubContext = false,
    onRefreshMembers,
}) => {
    const toast = useToast();
    const toastRef = useRef(toast);
    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);
    const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [invitationToRevoke, setInvitationToRevoke] = useState<string | null>(null);

    const loadInvitations = useCallback(async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getInvitations(
                statusFilter === "all" ? undefined : statusFilter,
                clubId
            );
            if (res.success) {
                setInvitations(res.invitations || []);
            }
        } catch (err: any) {
            toastRef.current.error(err.message || "Failed to load invitations");
        } finally {
            setLoading(false);
        }
    }, [clubId, statusFilter]);

    useEffect(() => {
        loadInvitations();
    }, [loadInvitations]);

    const handleRevoke = (invitationId: string) => {
        setInvitationToRevoke(invitationId);
    };

    const confirmRevoke = async () => {
        if (!invitationToRevoke) return;

        try {
            setRevokingId(invitationToRevoke);
            const res = await workspaceApi.revokeInvitation(clubId, invitationToRevoke);
            if (res.success) {
                toast.success(res.message || "Invitation revoked successfully");
                setInvitationToRevoke(null);
                await loadInvitations();
            } else {
                toast.error(res.message || "Failed to revoke invitation");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to revoke invitation");
        } finally {
            setRevokingId(null);
        }
    };

    const actorRank = currentMember?.role?.rank ?? 0;
    const isOwner = Boolean(isClubContext) || currentMember?.role?.slug === "owner" || actorRank === 1000;
    const canInvite = isOwner || actorRank >= 800;

    return (
        <div className="bg-white border-2 border-black rounded-xl p-6 shadow-neo space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-black flex items-center gap-2">
                        <Mail className="w-5 h-5 text-black" />
                        Cryptographic Join Invitations
                    </h3>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        Manage time-limited (7-day), single-use cryptographic invitation tokens for chapter onboarding.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadInvitations}
                        className="p-2 border-2 border-black rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-all shadow-neo-xs"
                        title="Refresh invitations"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>

                    {canInvite && (
                        <button
                            onClick={() => setIsInviteModalOpen(true)}
                            className="px-4 py-2 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-sm transition-all flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            Generate Invite Link
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-600">Filter Status:</span>
                {(["all", "pending", "accepted", "revoked", "expired"] as const).map((st) => (
                    <button
                        key={st}
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1 text-xs font-black rounded-lg border-2 border-black transition-all capitalize ${
                            statusFilter === st
                                ? "bg-black text-white"
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                        }`}
                    >
                        {st}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto border-2 border-black rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-neutral-100 border-b-2 border-black font-black uppercase text-neutral-700">
                            <th className="p-3">Candidate / Email</th>
                            <th className="p-3">Target Role</th>
                            <th className="p-3">Department</th>
                            <th className="p-3">Expires At</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Invited By</th>
                            {canInvite && <th className="p-3 text-right">Action</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y border-black font-medium bg-white">
                        {invitations.map((inv) => {
                            const isPending = inv.status === "pending";
                            const isExpired = new Date(inv.expiresAt) < new Date() && isPending;

                            return (
                                <tr key={inv.id} className="hover:bg-neutral-50/80 transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold text-black flex items-center gap-1.5">
                                            <Mail className="w-3.5 h-3.5 text-neutral-400" />
                                            {inv.email}
                                        </div>
                                        <div className="text-[10px] font-mono text-neutral-400 mt-0.5">
                                            Token Hash: {inv.tokenHash.slice(0, 16)}...
                                        </div>
                                    </td>

                                    <td className="p-3">
                                        <span
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border border-black shadow-neo-xxs"
                                            style={{
                                                backgroundColor: `${inv.role?.color || "#000000"}15`,
                                                color: inv.role?.color || "#000000",
                                            }}
                                        >
                                            <Shield className="w-3 h-3" />
                                            {inv.role?.name || "Member"}
                                        </span>
                                    </td>

                                    <td className="p-3">
                                        {inv.department ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border border-black bg-neutral-100">
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: inv.department.color }}
                                                />
                                                {inv.department.name}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-neutral-400 italic">Unassigned</span>
                                        )}
                                    </td>

                                    <td className="p-3 text-neutral-600 font-medium">
                                        {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </td>

                                    <td className="p-3">
                                        {inv.status === "accepted" ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black bg-emerald-100 text-emerald-800 border border-black rounded">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Accepted
                                            </span>
                                        ) : inv.status === "revoked" ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black bg-red-100 text-red-800 border border-black rounded">
                                                <XCircle className="w-3 h-3 text-red-700" /> Revoked
                                            </span>
                                        ) : isExpired ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black bg-neutral-200 text-neutral-700 border border-black rounded">
                                                <Clock className="w-3 h-3 text-neutral-500" /> Expired
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-black bg-amber-100 text-amber-800 border border-black rounded">
                                                <Clock className="w-3 h-3 text-amber-700" /> Pending
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-3 text-neutral-700 text-xs font-semibold">
                                        {inv.inviter ? (
                                            <span>
                                                {inv.inviter.firstName} {inv.inviter.lastName} (@{inv.inviter.username})
                                            </span>
                                        ) : (
                                            <span className="text-neutral-400">System</span>
                                        )}
                                    </td>

                                    {canInvite && (
                                        <td className="p-3 text-right">
                                            {isPending && !isExpired && (
                                                <button
                                                    onClick={() => handleRevoke(inv.id)}
                                                    disabled={revokingId === inv.id}
                                                    className="px-2.5 py-1 text-[11px] font-bold text-red-700 bg-red-100 hover:bg-red-200 border border-black rounded-lg transition-all flex items-center gap-1 ml-auto"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    {revokingId === inv.id ? "Revoking..." : "Revoke"}
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}

                        {invitations.length === 0 && !loading && (
                            <tr>
                                <td colSpan={canInvite ? 7 : 6} className="p-8 text-center text-neutral-500 font-bold">
                                    No invitations found for the selected status.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                clubId={clubId}
                roles={roles}
                departments={departments}
                members={members?.filter((m) => m.user?.accountType !== "club")}
                currentActor={currentMember}
                isClubContext={Boolean(isClubContext)}
                onSuccess={() => {
                    loadInvitations();
                    onRefreshMembers?.();
                }}
            />

            {/* Revoke Invitation Modal */}
            <ConfirmationModal
                isOpen={Boolean(invitationToRevoke)}
                onClose={() => setInvitationToRevoke(null)}
                onConfirm={confirmRevoke}
                title="Revoke Invitation Link?"
                description="Are you sure you want to revoke this invitation token? The invite link will become invalid immediately and cannot be used to join."
                confirmText="Revoke Link"
                cancelText="Keep Active"
                variant="danger"
                isLoading={Boolean(revokingId)}
            />
        </div>
    );
};
