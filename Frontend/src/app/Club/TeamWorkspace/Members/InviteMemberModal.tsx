// Frontend/src/app/Club/TeamWorkspace/Members/InviteMemberModal.tsx
import React, { useState } from "react";
import {
    UserPlus,
    X,
    Copy,
    Check,
    Mail,
    Shield,
    Folder,
    Link as LinkIcon,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { WorkspaceRole, WorkspaceDepartment } from "../../../../types/workspace";

interface InviteMemberModalProps {
    isOpen?: boolean;
    clubId: string;
    roles: WorkspaceRole[];
    departments: WorkspaceDepartment[];
    onClose: () => void;
    onSuccess?: () => void;
    onInvited?: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
    isOpen = true,
    clubId,
    roles,
    departments,
    onClose,
    onSuccess,
    onInvited,
}) => {
    const toast = useToast();
    const [email, setEmail] = useState("");
    const [roleId, setRoleId] = useState(roles.find((r) => r.slug === "member")?.id || roles[0]?.id || "");
    const [departmentId, setDepartmentId] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Generated Invite state
    const [generatedInvite, setGeneratedInvite] = useState<{
        token: string;
        link: string;
        email: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
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

    const handleCopy = () => {
        if (!generatedInvite) return;
        navigator.clipboard.writeText(generatedInvite.link);
        setCopied(true);
        toast.success("Invitation link copied to clipboard!");
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl max-w-lg w-full p-6 shadow-neo animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-lg">
                            <UserPlus className="w-5 h-5 text-black" />
                        </div>
                        <h3 className="text-lg font-black text-black">Invite Member to Workspace</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-500 hover:text-black border-2 border-transparent hover:border-black rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {!generatedInvite ? (
                    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                    Assigned Role *
                                </label>
                                <div className="relative">
                                    <Shield className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                    <select
                                        value={roleId}
                                        onChange={(e) => setRoleId(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none"
                                        required
                                    >
                                        {roles
                                            .filter((r) => r.slug !== "owner")
                                            .map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name} (Rank {r.rank})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                    Department (Optional)
                                </label>
                                <div className="relative">
                                    <Folder className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                    <select
                                        value={departmentId}
                                        onChange={(e) => setDepartmentId(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none"
                                    >
                                        <option value="">No Initial Department</option>
                                        {departments
                                            .filter((d) => d.status === "active")
                                            .map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
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
                                disabled={submitting}
                                className="px-4 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm transition-all"
                            >
                                {submitting ? "Generating..." : "Generate Secure Invite"}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* Success & Shareable Link State */
                    <div className="mt-5 space-y-4">
                        <div className="p-4 bg-emerald-50 border-2 border-black rounded-xl">
                            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                Cryptographic Single-Use Invite Created
                            </div>
                            <p className="text-xs text-neutral-700 mt-1">
                                A cryptographically secure token was generated for <strong>{generatedInvite.email}</strong>.
                                The link expires in 7 days and is invalidated immediately upon single use.
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
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
                )}
            </div>
        </div>
    );
};

export default InviteMemberModal;
