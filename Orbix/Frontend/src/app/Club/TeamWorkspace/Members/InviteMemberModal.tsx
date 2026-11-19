// Frontend/src/app/Club/TeamWorkspace/Members/InviteMemberModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
    UserPlus,
    X,
    Copy,
    Check,
    Mail,
    Link as LinkIcon,
    ArrowUpCircle,
    Search,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { NeoSelect } from "../../../../components/NeoSelect";
import type {
    WorkspaceRole,
    WorkspaceDepartment,
    WorkspaceMember,
} from "../../../../types/workspace";

interface InviteMemberModalProps {
    isOpen?: boolean;
    clubId: string;
    roles: WorkspaceRole[];
    departments: WorkspaceDepartment[];
    members?: WorkspaceMember[];
    currentActor?: WorkspaceMember | null;
    isClubContext?: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    onInvited?: () => void;
}

type ModalMode = "invite" | "promote";

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
    isOpen = true,
    clubId,
    roles,
    departments,
    members,
    currentActor,
    isClubContext = false,
    onClose,
    onSuccess,
    onInvited,
}) => {
    const toast = useToast();
    const actorRank = currentActor?.role?.rank ?? 0;
    const isPersonalOwner =
        !isClubContext && (currentActor?.role?.slug === "owner" || actorRank >= 1000);

    // Roles allowed for invitation or promotion, ordered highest rank first
    const assignableRoles = useMemo(() => {
        return [...roles]
            .filter((r) => {
                if (isClubContext) return true;
                if (r.slug === "owner" || r.rank >= 1000) return false;
                if (!isPersonalOwner && r.rank >= actorRank) return false;
                return true;
            })
            .sort((a, b) => b.rank - a.rank);
    }, [roles, isClubContext, isPersonalOwner, actorRank]);

    // Existing personal members eligible for role reassignment/promotion
    const promotableMembers = useMemo(() => {
        if (!members) return [];
        return members.filter((m) => {
            if (m.user?.accountType === "club") return false;
            if (currentActor?.userId && m.userId === currentActor.userId) return false;
            if (isClubContext) return true;
            const targetIsOwner = m.role?.slug === "owner" || (m.role?.rank ?? 0) >= 1000;
            if (targetIsOwner) return false;
            return isPersonalOwner || actorRank > (m.role?.rank ?? 0);
        });
    }, [members, currentActor?.userId, isClubContext, isPersonalOwner, actorRank]);

    const showModeToggle = members !== undefined;

    const defaultInviteRoleId = useMemo(
        () =>
            assignableRoles.find((r) => r.slug === "member")?.id ||
            assignableRoles[0]?.id ||
            "",
        [assignableRoles]
    );

    const [mode, setMode] = useState<ModalMode>("invite");

    // Invite form state
    const [email, setEmail] = useState("");
    const [roleId, setRoleId] = useState(defaultInviteRoleId);
    const [departmentId, setDepartmentId] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Promote form state
    const [memberSearch, setMemberSearch] = useState("");
    const [selectedMemberId, setSelectedMemberId] = useState("");
    const [promoteRoleId, setPromoteRoleId] = useState(assignableRoles[0]?.id || "");
    const [customRoleTitle, setCustomRoleTitle] = useState("");

    // Generated Invite state
    const [generatedInvite, setGeneratedInvite] = useState<{
        token: string;
        link: string;
        email: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    // Keep default role IDs valid when roles or modal open state change
    useEffect(() => {
        if (isOpen) {
            setGeneratedInvite(null);
            if (!assignableRoles.some((r) => r.id === roleId)) {
                setRoleId(defaultInviteRoleId);
            }
            if (!assignableRoles.some((r) => r.id === promoteRoleId)) {
                setPromoteRoleId(assignableRoles[0]?.id || "");
            }
        }
    }, [isOpen, assignableRoles, defaultInviteRoleId, roleId, promoteRoleId]);

    // Sync target role selector when picking a member to promote/update
    const selectedMember = useMemo(
        () => promotableMembers.find((m) => m.userId === selectedMemberId) || null,
        [promotableMembers, selectedMemberId]
    );

    useEffect(() => {
        if (selectedMember) {
            if (assignableRoles.some((r) => r.id === selectedMember.roleId)) {
                setPromoteRoleId(selectedMember.roleId);
            } else if (assignableRoles[0]?.id) {
                setPromoteRoleId(assignableRoles[0].id);
            }
            setCustomRoleTitle(selectedMember.roleTitle || "");
        }
    }, [selectedMember, assignableRoles]);

    const filteredMembers = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return promotableMembers;
        return promotableMembers.filter((m) => {
            const name = `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.toLowerCase();
            const username = (m.user?.username || "").toLowerCase();
            const roleName = (m.role?.name || "").toLowerCase();
            const title = (m.roleTitle || "").toLowerCase();
            return (
                name.includes(q) ||
                username.includes(q) ||
                roleName.includes(q) ||
                title.includes(q)
            );
        });
    }, [promotableMembers, memberSearch]);

    if (!isOpen) return null;

    const handleInviteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !roleId) {
            toast.error("Valid email and role are required.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.createInvitation(
                {
                    email: email.trim(),
                    roleId,
                    departmentId: departmentId || undefined,
                    invitationMessage: message.trim() || undefined,
                },
                clubId
            );

            if (res.success) {
                toast.success(res.message);
                const fullLink = `${window.location.origin}/club/team-workspace/join?token=${res.token}`;
                setGeneratedInvite({
                    token: res.token,
                    link: fullLink,
                    email: res.invitation.email,
                });
                onSuccess?.();
                onInvited?.();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to create invitation.");
        } finally {
            setSubmitting(false);
        }
    };

    const handlePromoteSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMember) {
            toast.error("Select an existing member to update.");
            return;
        }
        if (!promoteRoleId) {
            toast.error("Select a target role.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.assignMemberRole(
                selectedMember.userId,
                promoteRoleId,
                customRoleTitle.trim() || undefined,
                clubId
            );
            if (res.success) {
                toast.success(res.message || "Member role updated successfully.");
                onSuccess?.();
                onInvited?.();
                onClose();
            } else {
                toast.error(res.message || "Failed to update member role.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update member role.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopy = () => {
        if (!generatedInvite) return;
        navigator.clipboard.writeText(generatedInvite.link);
        setCopied(true);
        toast.success("Invitation link copied to clipboard!");
        setTimeout(() => setCopied(false), 3000);
    };

    const switchMode = (nextMode: ModalMode) => {
        setMode(nextMode);
        setGeneratedInvite(null);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl max-w-lg w-full p-6 shadow-neo animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-4 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-lg">
                            {mode === "invite" ? (
                                <UserPlus className="w-5 h-5 text-black" />
                            ) : (
                                <ArrowUpCircle className="w-5 h-5 text-black" />
                            )}
                        </div>
                        <h3 className="text-lg font-black text-black">
                            {mode === "invite"
                                ? "Invite Member to Workspace"
                                : "Promote / Reassign Member Role"}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-500 hover:text-black border-2 border-transparent hover:border-black rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Mode Toggler: Invite New User vs Promote Existing Member */}
                {showModeToggle && !generatedInvite && (
                    <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-neutral-100 border-2 border-black rounded-xl">
                        <button
                            type="button"
                            onClick={() => switchMode("invite")}
                            className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                                mode === "invite"
                                    ? "bg-[#A6FF70] text-black border-2 border-black shadow-neo-xs"
                                    : "text-neutral-600 hover:text-black border-2 border-transparent"
                            }`}
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Invite New Member</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode("promote")}
                            className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                                mode === "promote"
                                    ? "bg-[#A6FF70] text-black border-2 border-black shadow-neo-xs"
                                    : "text-neutral-600 hover:text-black border-2 border-transparent"
                            }`}
                        >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span>Promote Existing</span>
                        </button>
                    </div>
                )}

                {generatedInvite ? (
                    /* Success & Shareable Link State */
                    <div className="mt-5 space-y-4">
                        <div className="p-4 bg-emerald-50 border-2 border-black rounded-xl">
                            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                Cryptographic Single-Use Invite Created
                            </div>
                            <p className="text-xs text-neutral-700 mt-1">
                                A cryptographically secure token was generated for{" "}
                                <strong>{generatedInvite.email}</strong>. The link expires in 7 days
                                and is invalidated immediately upon single use.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                Shareable Invitation Link
                            </label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                    <input
                                        type="text"
                                        readOnly
                                        value={generatedInvite.link}
                                        className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold bg-neutral-50 border-2 border-black rounded-xl focus:outline-none"
                                    />
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className="px-4 py-2 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-sm flex items-center gap-1.5 transition"
                                >
                                    {copied ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-end pt-4 border-t-2 border-black">
                            <button
                                onClick={onClose}
                                className="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-black font-black text-xs border-2 border-black rounded-xl shadow-neo-xs"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : mode === "invite" ? (
                    <form onSubmit={handleInviteSubmit} className="mt-5 space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                Member Email *
                            </label>
                            <div className="relative">
                                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="student@college.edu or personal email"
                                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                    Assigned Role *
                                </label>
                                <NeoSelect
                                    value={roleId}
                                    onChange={(val) => setRoleId(val)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={assignableRoles.map((r) => ({
                                        value: r.id,
                                        label: `${r.name} (Rank ${r.rank})`,
                                    }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                    Department (Optional)
                                </label>
                                <NeoSelect
                                    value={departmentId}
                                    onChange={(val) => setDepartmentId(val)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={[
                                        { value: "", label: "No Initial Department" },
                                        ...departments
                                            .filter((d) => d.status === "active")
                                            .map((d) => ({ value: d.id, label: d.name })),
                                    ]}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                Invitation Note (Optional)
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Add a welcome note or onboarding instructions..."
                                rows={2}
                                className="w-full px-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t-2 border-black">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !roleId}
                                className="px-4 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm transition-all disabled:opacity-50"
                            >
                                {submitting ? "Generating..." : "Generate Secure Invite"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handlePromoteSubmit} className="mt-5 space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                Select Existing Member *
                            </label>
                            <div className="relative mb-2">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                    placeholder="Search by name, @username, or current role..."
                                    className="w-full pl-8 pr-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-1.5 border-2 border-black rounded-xl p-2 bg-neutral-50">
                                {filteredMembers.length === 0 ? (
                                    <div className="py-4 text-center text-xs font-bold text-neutral-500">
                                        No eligible workspace members found.
                                    </div>
                                ) : (
                                    filteredMembers.map((m) => {
                                        const name =
                                            `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                                            m.user?.username ||
                                            "Member";
                                        const isSelected = selectedMemberId === m.userId;
                                        return (
                                            <button
                                                type="button"
                                                key={m.userId}
                                                onClick={() => setSelectedMemberId(m.userId)}
                                                className={`w-full text-left px-2.5 py-2 rounded-lg border-2 flex items-center justify-between gap-2 transition ${
                                                    isSelected
                                                        ? "bg-[#A6FF70]/40 border-black shadow-neo-xs"
                                                        : "bg-white border-transparent hover:border-black"
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-xs font-black text-black truncate">
                                                        {name}{" "}
                                                        <span className="font-mono text-[10px] font-bold text-neutral-500">
                                                            @{m.user?.username}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-neutral-600 truncate">
                                                        {m.roleTitle || m.role?.name || "Member"}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-neutral-100 border border-black rounded shrink-0">
                                                    {m.role?.name || "Role"} ({m.role?.rank ?? 0})
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                    New Role Target *
                                </label>
                                <NeoSelect
                                    value={promoteRoleId}
                                    onChange={(val) => setPromoteRoleId(val)}
                                    size="sm"
                                    triggerClassName="w-full text-xs font-bold"
                                    options={assignableRoles.map((r) => ({
                                        value: r.id,
                                        label: `${r.name} (Rank ${r.rank})`,
                                    }))}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                    Custom Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={customRoleTitle}
                                    onChange={(e) => setCustomRoleTitle(e.target.value)}
                                    maxLength={80}
                                    placeholder="e.g. Technical Lead"
                                    className="w-full px-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-4 border-t-2 border-black">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting || !selectedMember || !promoteRoleId}
                                className="px-4 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm transition-all disabled:opacity-50"
                            >
                                {submitting ? "Updating Role..." : "Assign Role"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default InviteMemberModal;
