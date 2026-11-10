// Frontend/src/app/Club/TeamWorkspace/Members/ChangeRoleModal.tsx
import React, { useState } from "react";
import { Shield, X, Check, AlertCircle } from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { WorkspaceMember, WorkspaceRole } from "../../../../types/workspace";

interface ChangeRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: WorkspaceMember | null;
    roles: WorkspaceRole[];
    currentActor: WorkspaceMember | null;
    clubId: string;
    onSuccess: () => void;
}

export const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({
    isOpen,
    onClose,
    member,
    roles,
    currentActor,
    clubId,
    onSuccess,
}) => {
    const toast = useToast();
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");
    const [customTitle, setCustomTitle] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Initialize selection when member opens
    React.useEffect(() => {
        if (member) {
            setSelectedRoleId(member.roleId);
            setCustomTitle(member.roleTitle || "");
        }
    }, [member]);

    if (!isOpen || !member) return null;

    const actorRank = currentActor?.role?.rank ?? 0;
    const isOwner = currentActor?.role?.slug === "owner" || actorRank === 1000;

    // Filter available roles: cannot assign "owner", and rank must be strictly less than actor rank unless owner
    const assignableRoles = roles.filter((r) => {
        if (r.slug === "owner") return false;
        if (!isOwner && r.rank >= actorRank) return false;
        return true;
    });

    const fullName = `${member.user?.firstName || ""} ${member.user?.lastName || ""}`.trim() || member.user?.username || "Unknown";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoleId) {
            toast.error("Please select a target role");
            return;
        }

        try {
            setLoading(true);
            const res = await workspaceApi.assignMemberRole(
                member.userId,
                selectedRoleId,
                customTitle.trim() || undefined,
                clubId
            );

            if (res.success) {
                toast.success(res.message || "Member role updated successfully");
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || "Failed to update role");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to change member role");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl max-w-md w-full p-6 shadow-neo animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-lg">
                            <Shield className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-black">Change Workspace Role</h3>
                            <p className="text-xs text-neutral-600 font-medium">Updating {fullName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-neutral-100 border border-black rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            Current Role
                        </label>
                        <div className="p-2.5 bg-neutral-100 border-2 border-black rounded-xl text-xs font-bold text-neutral-800 flex items-center justify-between">
                            <span>{member.roleTitle || member.role?.name || "Member"}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-white border border-black rounded">
                                Rank: {member.role?.rank ?? "N/A"}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            New Role Target *
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {assignableRoles.map((role) => (
                                <label
                                    key={role.id}
                                    className={`flex items-center justify-between p-2.5 border-2 rounded-xl cursor-pointer transition-all ${
                                        selectedRoleId === role.id
                                            ? "border-black bg-[#A6FF70]/30 shadow-neo-xs"
                                            : "border-neutral-300 hover:border-black bg-white"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="radio"
                                            name="workspaceRole"
                                            value={role.id}
                                            checked={selectedRoleId === role.id}
                                            onChange={() => setSelectedRoleId(role.id)}
                                            className="accent-black w-4 h-4"
                                        />
                                        <div>
                                            <div className="font-black text-xs text-black flex items-center gap-2">
                                                {role.name}
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full border border-black inline-block"
                                                    style={{ backgroundColor: role.color }}
                                                />
                                            </div>
                                            <div className="text-[11px] text-neutral-500 font-medium">
                                                {role.description}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-neutral-500">
                                        Rank {role.rank}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {assignableRoles.length === 0 && (
                            <div className="p-3 bg-amber-50 border-2 border-black rounded-xl text-xs text-amber-800 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>You do not have a high enough rank to change this member's role.</span>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            Custom Role Title (Optional)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Lead Full-Stack Architect"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            maxLength={80}
                            className="w-full px-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                        />
                        <p className="text-[10px] text-neutral-500 mt-1">
                            A specific organizational title displayed in the member directory and badges.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-xs font-bold bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedRoleId}
                            className="px-4 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="animate-pulse">Updating...</span>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Confirm Role
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
