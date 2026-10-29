import React, { useState, useEffect } from "react";
import { X, Edit3, Loader2, Archive, AlertTriangle } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import type { ClubMember, ClubTeam } from "./types";

interface EditTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: ClubTeam | null;
    members: ClubMember[];
    onTeamUpdated: (updated: ClubTeam) => void;
    onTeamArchived: (teamId: string, isArchived: boolean) => void;
    onTeamDeleted: (teamId: string) => void;
}

export const EditTeamModal: React.FC<EditTeamModalProps> = ({
    isOpen,
    onClose,
    team,
    members,
    onTeamUpdated,
    onTeamArchived,
    onTeamDeleted,
}) => {
    const toast = useToast();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [responsibilities, setResponsibilities] = useState("");
    const [leadUserId, setLeadUserId] = useState("");
    const [coLeadUserId, setCoLeadUserId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (team) {
            setName(team.name || "");
            setDescription(team.description || "");
            setResponsibilities(team.responsibilities || "");
            setLeadUserId(team.leadId || team.lead?.id || "");
            setCoLeadUserId(team.coLeadId || team.coLead?.id || "");
            setConfirmDelete(false);
        }
    }, [team]);

    if (!isOpen || !team) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            toast.error("Team name must be at least 2 characters.", { title: "Validation Error" });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/club/team/teams/${team.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: trimmedName,
                    description: description.trim() || undefined,
                    responsibilities: responsibilities.trim() || undefined,
                    leadUserId: leadUserId || null,
                    coLeadUserId: coLeadUserId || null,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to update team.", { title: "Error" });
                return;
            }

            toast.success(`Team "${trimmedName}" updated!`, { title: "Changes Saved" });
            onTeamUpdated({ ...team, ...data.team });
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to update team.", { title: "Error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleArchiveToggle = async () => {
        const nextState = !team.isArchived;
        try {
            const res = await fetch(`/api/club/team/teams/${team.id}/archive`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ isArchived: nextState }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Archive action failed.", { title: "Error" });
                return;
            }
            toast.info(`Team ${nextState ? "archived" : "unarchived"}.`, { title: "Status Updated" });
            onTeamArchived(team.id, nextState);
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Network error.", { title: "Error" });
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/club/team/teams/${team.id}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to delete team.", { title: "Error" });
                return;
            }
            toast.success(`Team "${team.name}" deleted.`, { title: "Team Deleted" });
            onTeamDeleted(team.id);
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Delete failed.", { title: "Error" });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="w-full max-w-xl bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                            <Edit3 className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-black">
                                Edit {team.name}
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Update description, responsibilities, and leadership appointments.
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Team Name */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Department / Team Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Description & Purpose
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                        />
                    </div>

                    {/* Responsibilities */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Responsibilities & Deliverables
                        </label>
                        <textarea
                            value={responsibilities}
                            onChange={(e) => setResponsibilities(e.target.value)}
                            rows={2}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                        />
                    </div>

                    {/* Team Leads */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Department Lead
                            </label>
                            <select
                                value={leadUserId}
                                onChange={(e) => setLeadUserId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                            >
                                <option value="">No Lead Assigned</option>
                                {members.map((m) => (
                                    <option key={m.userId} value={m.userId}>
                                        {m.displayName} (@{m.username})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Co-Lead / Deputy
                            </label>
                            <select
                                value={coLeadUserId}
                                onChange={(e) => setCoLeadUserId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                            >
                                <option value="">No Co-Lead Assigned</option>
                                {members
                                    .filter((m) => m.userId !== leadUserId)
                                    .map((m) => (
                                        <option key={m.userId} value={m.userId}>
                                            {m.displayName} (@{m.username})
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Danger / Archival Controls */}
                    <div className="pt-3 border-t-2 border-black/10 space-y-3">
                        <span className="block text-xs font-black uppercase tracking-wider text-neutral-600">
                            Management Actions
                        </span>
                        <div className="flex items-center justify-between gap-3 p-3 bg-[#FAF6EE] border-2 border-black rounded-xl">
                            <div className="text-xs">
                                <span className="font-black text-black block">
                                    {team.isArchived ? "Unarchive Department" : "Archive Department"}
                                </span>
                                <span className="text-[11px] text-neutral-600 font-medium">
                                    {team.isArchived ? "Restore team back to active operations." : "Preserves historical roster without active display."}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleArchiveToggle}
                                className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 border border-black font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                <Archive className="w-3.5 h-3.5" />
                                <span>{team.isArchived ? "Unarchive" : "Archive"}</span>
                            </button>
                        </div>

                        {/* Delete Section */}
                        {!confirmDelete ? (
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                            >
                                Delete this department permanently...
                            </button>
                        ) : (
                            <div className="p-3 bg-rose-50 border-2 border-rose-600 rounded-xl space-y-2">
                                <div className="flex items-center gap-2 text-rose-700">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span className="text-xs font-black">
                                        Are you sure you want to delete {team.name}?
                                    </span>
                                </div>
                                <p className="text-[11px] text-rose-900 font-medium">
                                    This removes the department and its assignments. Existing club memberships remain intact.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000] hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                                    >
                                        {isDeleting ? "Deleting..." : "Yes, Delete Permanently"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(false)}
                                        className="px-3 py-1.5 bg-white text-black rounded-lg font-bold text-xs border border-black cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-black/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl bg-white border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || name.trim().length < 2}
                            className="px-5 py-2.5 rounded-xl bg-black border-2 border-black text-[#a2ff86] font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving Changes...</span>
                                </>
                            ) : (
                                <span>Save Changes</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
