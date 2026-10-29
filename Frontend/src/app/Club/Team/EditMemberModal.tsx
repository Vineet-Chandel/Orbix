import React, { useState, useEffect } from "react";
import { X, Shield } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import type { ClubMember, ClubTeam } from "./types";
import { DEFAULT_AVATAR_URL } from "../../../utils/avatarConstants";

interface EditMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: ClubMember | null;
    teams: ClubTeam[];
    onMemberUpdated: (updated: ClubMember) => void;
    onMemberRemoved: (membershipId: string) => void;
    isCurrentUserOwner: boolean;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
    isOpen,
    onClose,
    member,
    teams,
    onMemberUpdated,
    onMemberRemoved,
    isCurrentUserOwner,
}) => {
    const toast = useToast();

    const [clubRole, setClubRole] = useState<"owner" | "admin" | "team_lead" | "member" | "advisor">("member");
    const [title, setTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);

    // Assign team state
    const [assignTeamId, setAssignTeamId] = useState("");
    const [assignTeamRole, setAssignTeamRole] = useState<"member" | "co_lead" | "lead">("member");
    const [assignPositionTitle, setAssignPositionTitle] = useState("Member");
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        if (member) {
            setClubRole(member.clubRole || "member");
            setTitle(member.title || "Member");
            setConfirmRemove(false);
            setAssignTeamId("");
        }
    }, [member]);

    if (!isOpen || !member) return null;

    const isTargetOwner = member.clubRole === "owner";

    const handleSaveRoleAndTitle = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/club/team/members/${member.membershipId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    clubRole,
                    title: title.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to update member.", { title: "Error" });
                return;
            }

            toast.success(`Member @${member.username} updated!`, { title: "Saved" });
            onMemberUpdated({
                ...member,
                clubRole,
                title: title.trim() || member.title,
            });
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Network error.", { title: "Error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAssignTeam = async () => {
        if (!assignTeamId) {
            toast.error("Please select a department to assign.", { title: "Select Team" });
            return;
        }

        setIsAssigning(true);
        try {
            const res = await fetch(`/api/club/team/members/${member.membershipId}/assign-team`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    teamId: assignTeamId,
                    userId: member.userId,
                    teamRole: assignTeamRole,
                    positionTitle: assignPositionTitle.trim() || "Member",
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to assign department.", { title: "Error" });
                return;
            }

            const targetTeamObj = teams.find((t) => t.id === assignTeamId);
            const updatedTeams = [
                ...member.teams.filter((t) => t.teamId !== assignTeamId),
                {
                    teamId: assignTeamId,
                    teamName: targetTeamObj?.name || "Department",
                    teamRole: assignTeamRole,
                    positionTitle: assignPositionTitle.trim() || "Member",
                },
            ];

            onMemberUpdated({
                ...member,
                teams: updatedTeams,
            });

            toast.success(`Assigned @${member.username} to ${targetTeamObj?.name || "department"}.`, { title: "Assigned" });
            setAssignTeamId("");
        } catch (err: any) {
            toast.error(err.message || "Failed to assign team.", { title: "Error" });
        } finally {
            setIsAssigning(false);
        }
    };

    const handleRemoveFromTeam = async (teamId: string, teamName: string) => {
        try {
            const res = await fetch(`/api/club/team/teams/${teamId}/members/${member.userId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to remove from team.", { title: "Error" });
                return;
            }

            const updatedTeams = member.teams.filter((t) => t.teamId !== teamId);
            onMemberUpdated({
                ...member,
                teams: updatedTeams,
            });
            toast.info(`Removed from ${teamName}.`, { title: "Removed from Team" });
        } catch (err: any) {
            toast.error(err.message || "Error removing from team.", { title: "Error" });
        }
    };

    const handleRemoveMemberFromClub = async () => {
        setIsRemoving(true);
        try {
            const res = await fetch(`/api/club/team/members/${member.membershipId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to remove member.", { title: "Error" });
                return;
            }

            toast.success(`@${member.username} has been removed from the club.`, { title: "Member Removed" });
            onMemberRemoved(member.membershipId);
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Error removing member.", { title: "Error" });
        } finally {
            setIsRemoving(false);
        }
    };

    const unassignedTeams = teams.filter(
        (t) => !t.isArchived && !member.teams.some((mt) => mt.teamId === t.id)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="w-full max-w-xl bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
                {/* Header with Member Info */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/15">
                    <div className="flex items-center gap-3 min-w-0">
                        <img
                            src={member.avatarUrl || DEFAULT_AVATAR_URL}
                            alt={member.username}
                            className="w-11 h-11 rounded-full border-2 border-black object-cover shrink-0"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                            }}
                        />
                        <div className="min-w-0">
                            <h3 className="text-base font-black text-black truncate">
                                {member.displayName}
                            </h3>
                            <p className="text-xs font-mono font-bold text-neutral-600 truncate">
                                @{member.username} {member.college ? `• ${member.college}` : ""}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                    >
                        <X className="w-4 h-4 text-black stroke-[2.5]" />
                    </button>
                </div>

                {/* Form to update Role and Title */}
                <form onSubmit={handleSaveRoleAndTitle} className="space-y-4">
                    {/* Club-Wide Access Role */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Club-Wide Access Role
                        </label>
                        {isTargetOwner ? (
                            <div className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-black text-black flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                <span>Club Owner / Primary Registrar (Protected)</span>
                            </div>
                        ) : (
                            <select
                                value={clubRole}
                                onChange={(e) => setClubRole(e.target.value as any)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                            >
                                <option value="member">Club Member (Standard access)</option>
                                <option value="team_lead">Team Lead (Department lead management)</option>
                                {isCurrentUserOwner && (
                                    <option value="admin">Club Admin (Full team management privileges)</option>
                                )}
                                <option value="advisor">Advisor / Faculty Coordinator (Read-only)</option>
                            </select>
                        )}
                    </div>

                    {/* Organisational Title */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Organisational Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Technical Head, Design Lead, Vice President..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Update Role & Title"}
                    </button>
                </form>

                {/* Assigned Teams Section */}
                <div className="pt-3 border-t-2 border-black/10 space-y-3">
                    <span className="block text-xs font-black uppercase tracking-wider text-black">
                        Department Assignments ({member.teams.length})
                    </span>

                    {member.teams.length === 0 ? (
                        <p className="text-xs text-neutral-500 italic p-2 bg-[#FAF6EE] rounded-xl border border-black/30">
                            Not assigned to any specific department yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {member.teams.map((t) => (
                                <div
                                    key={t.teamId}
                                    className="p-2.5 bg-white border-2 border-black rounded-xl shadow-[1.5px_1.5px_0px_#000] flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-black truncate">
                                            {t.teamName}
                                        </p>
                                        <p className="text-[11px] font-bold text-neutral-600">
                                            Role: <span className="capitalize">{t.teamRole}</span> • {t.positionTitle}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFromTeam(t.teamId, t.teamName)}
                                        className="p-1 text-rose-600 hover:text-rose-800 border border-rose-300 rounded hover:bg-rose-50 text-[11px] font-black cursor-pointer"
                                        title="Remove from this department"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add to another team */}
                    {unassignedTeams.length > 0 && (
                        <div className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-2">
                            <span className="text-[11px] font-black uppercase text-neutral-700 block">
                                + Assign to Department
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <select
                                    value={assignTeamId}
                                    onChange={(e) => setAssignTeamId(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black"
                                >
                                    <option value="">Select Department...</option>
                                    {unassignedTeams.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={assignTeamRole}
                                    onChange={(e) => setAssignTeamRole(e.target.value as any)}
                                    className="px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black"
                                >
                                    <option value="member">Member</option>
                                    <option value="co_lead">Co-Lead</option>
                                    <option value="lead">Lead</option>
                                </select>
                                <input
                                    type="text"
                                    value={assignPositionTitle}
                                    onChange={(e) => setAssignPositionTitle(e.target.value)}
                                    placeholder="Position Title"
                                    className="px-2.5 py-1.5 bg-white border border-black rounded-lg text-xs font-bold text-black"
                                />
                                <button
                                    type="button"
                                    onClick={handleAssignTeam}
                                    disabled={!assignTeamId || isAssigning}
                                    className="px-3 py-1.5 bg-black text-[#a2ff86] rounded-lg font-black text-xs border border-black shadow-[1px_1px_0px_#000] hover:bg-neutral-900 cursor-pointer disabled:opacity-50"
                                >
                                    {isAssigning ? "Assigning..." : "Assign"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Danger: Remove Member from Club */}
                {!isTargetOwner && (
                    <div className="pt-3 border-t-2 border-black/10">
                        {!confirmRemove ? (
                            <button
                                type="button"
                                onClick={() => setConfirmRemove(true)}
                                className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                            >
                                Remove @{member.username} from this club...
                            </button>
                        ) : (
                            <div className="p-3 bg-rose-50 border-2 border-rose-600 rounded-xl space-y-2">
                                <p className="text-xs font-black text-rose-800">
                                    Remove @{member.username} from all departments?
                                </p>
                                <p className="text-[11px] text-rose-900 font-medium">
                                    Their club and department access will be revoked immediately. Their personal Orbix account will NOT be affected.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleRemoveMemberFromClub}
                                        disabled={isRemoving}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                                    >
                                        {isRemoving ? "Removing..." : "Yes, Revoke Access"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemove(false)}
                                        className="px-3 py-1.5 bg-white text-black rounded-lg font-bold text-xs border border-black cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
