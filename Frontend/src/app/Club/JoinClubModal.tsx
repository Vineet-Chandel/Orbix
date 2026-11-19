// Frontend/src/app/Club/JoinClubModal.tsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    X,
    UserPlus,
    Link as LinkIcon,
    Shield,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Users,
    Building2,
    Calendar,
    Sparkles,
} from "lucide-react";
import { workspaceApi } from "../../api/workspaceApi";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader, OrbixButton } from "../../components/ui/loader";
import { useModalDismiss } from "../../hooks/useModalDismiss";

interface JoinClubModalProps {
    isOpen: boolean;
    onClose: () => void;
    onJoined?: (clubId?: string) => void;
    initialToken?: string;
}

export const JoinClubModal: React.FC<JoinClubModalProps> = ({
    isOpen,
    onClose,
    onJoined,
    initialToken = "",
}) => {
    const toast = useToast();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<"code" | "pending">("code");
    const [inviteInput, setInviteInput] = useState(initialToken);
    const [verifying, setVerifying] = useState(false);
    const [joining, setJoining] = useState(false);
    const [verifiedInvite, setVerifiedInvite] = useState<any | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    // Pending invitations
    const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);

    const { handleBackdropClick } = useModalDismiss({ isOpen, onClose });

    // Extract raw token from full URL or return trimmed token
    const extractToken = (raw: string) => {
        const trimmed = raw.trim();
        try {
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.includes("token=")) {
                const url = new URL(trimmed.startsWith("http") ? trimmed : `https://dummy.com/${trimmed}`);
                const tokenParam = url.searchParams.get("token");
                if (tokenParam) return tokenParam.trim();
            }
        } catch {
            // fallback to raw string
        }
        return trimmed;
    };

    // Load pending invitations when opened
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const loadPending = async () => {
            try {
                setLoadingPending(true);
                const res = await workspaceApi.getMyPendingInvitations();
                if (isMounted && res.success && Array.isArray(res.invitations)) {
                    setPendingInvitations(res.invitations);
                    if (res.invitations.length > 0 && !initialToken) {
                        setActiveTab("pending");
                    }
                }
            } catch (err) {
                console.warn("[JoinClubModal] Failed to load pending invites:", err);
            } finally {
                if (isMounted) setLoadingPending(false);
            }
        };

        loadPending();
        return () => {
            isMounted = false;
        };
    }, [isOpen, initialToken]);

    // Auto-verify if initial token provided
    useEffect(() => {
        if (isOpen && initialToken.trim()) {
            setInviteInput(initialToken.trim());
            handleVerify(initialToken.trim());
        }
    }, [isOpen, initialToken]);

    const handleVerify = async (tokenToVerify?: string) => {
        const token = extractToken(tokenToVerify || inviteInput);
        if (!token) {
            setVerifyError("Please enter an invitation link or token code.");
            return;
        }

        try {
            setVerifying(true);
            setVerifyError(null);
            setVerifiedInvite(null);

            const res = await workspaceApi.verifyInvitation(token);
            if (res.success && res.isValid && res.invitation) {
                setVerifiedInvite({ ...res.invitation, rawToken: token });
            } else {
                setVerifyError(res.reason || "Invalid, revoked, or expired invitation token.");
            }
        } catch (err: any) {
            setVerifyError(err.message || "Failed to verify invitation. Please check the token.");
        } finally {
            setVerifying(false);
        }
    };

    const handleAcceptVerified = async () => {
        if (!verifiedInvite?.rawToken) return;

        try {
            setJoining(true);
            const res = await workspaceApi.acceptInvitation(verifiedInvite.rawToken);
            if (res.success) {
                toast.success(res.message || `Successfully joined ${verifiedInvite.clubName || "the club"}!`);
                onJoined?.(res.clubId || verifiedInvite.clubId);
                onClose();
                const targetClubId = res.clubId || verifiedInvite.clubId;
                if (targetClubId) {
                    navigate(`/workspace/${targetClubId}`);
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to accept invitation.");
        } finally {
            setJoining(false);
        }
    };

    const handleAcceptPending = async (inv: any) => {
        try {
            setAcceptingId(inv.id);
            const res = await workspaceApi.acceptInvitation({
                invitationId: inv.id,
                type: inv.type,
                token: inv.token || undefined,
            });

            if (res.success) {
                toast.success(res.message || `Successfully joined ${inv.clubName}!`);
                setPendingInvitations((prev) => prev.filter((i) => i.id !== inv.id));
                onJoined?.(inv.clubId);
                onClose();
                if (inv.clubId) {
                    navigate(`/workspace/${inv.clubId}`);
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to accept invitation.");
        } finally {
            setAcceptingId(null);
        }
    };

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn overflow-y-auto"
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-xl bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#A6FF70] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                            <UserPlus className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-black">
                                Join Club Workspace
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Connect with your campus club and unlock team workspaces, tasks, and recognition.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer transition-all"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 text-black stroke-[2.5]" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 p-1 bg-neutral-100 border-2 border-black rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab("code")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeTab === "code"
                                ? "bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-600 hover:text-black border-2 border-transparent"
                        }`}
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Invite Code or Link</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("pending")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 relative ${
                            activeTab === "pending"
                                ? "bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                                : "text-neutral-600 hover:text-black border-2 border-transparent"
                        }`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        <span>Pending Invitations</span>
                        {pendingInvitations.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 bg-[#FFE566] text-black border border-black rounded-full text-[10px] font-black">
                                {pendingInvitations.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab 1: Invite Code / Link */}
                {activeTab === "code" && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Enter Invite URL or Code
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={inviteInput}
                                        onChange={(e) => {
                                            setInviteInput(e.target.value);
                                            setVerifyError(null);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleVerify();
                                            }
                                        }}
                                        placeholder="Paste link: https://.../club/team-workspace/join?token=..."
                                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleVerify()}
                                    disabled={verifying || !inviteInput.trim()}
                                    className="px-4 py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#fedb30] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer transition-all flex items-center gap-1.5"
                                >
                                    {verifying ? (
                                        <OrbixLoader size="xs" variant="minimal" />
                                    ) : (
                                        <>
                                            <span>Verify</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {verifyError && (
                            <div className="p-3 bg-rose-50 border-2 border-rose-600 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-bold">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span>{verifyError}</span>
                            </div>
                        )}

                        {verifiedInvite && (
                            <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-4 shadow-[3px_3px_0px_#000] animate-fadeIn">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        {verifiedInvite.clubLogoUrl ? (
                                            <img
                                                src={verifiedInvite.clubLogoUrl}
                                                alt={verifiedInvite.clubName || "Club"}
                                                className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[2px_2px_0px_#000]"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-[#70E0FF] border-2 border-black flex items-center justify-center font-black text-black text-lg shadow-[2px_2px_0px_#000]">
                                                {(verifiedInvite.clubName || "C").charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                                Invited to Join
                                            </span>
                                            <h4 className="text-base font-black text-black">
                                                {verifiedInvite.clubName || verifiedInvite.workspaceName || "Club Workspace"}
                                            </h4>
                                            {verifiedInvite.collegeName && (
                                                <p className="text-xs text-neutral-600 font-bold flex items-center gap-1">
                                                    <Building2 className="w-3 h-3 text-neutral-500" />
                                                    <span>{verifiedInvite.collegeName}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-2.5 py-1 rounded-full bg-[#A6FF70] border-2 border-black text-[10px] font-black text-black">
                                        Valid Invite
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/10 text-xs">
                                    <div className="p-2.5 bg-white border-2 border-black rounded-lg">
                                        <span className="text-[10px] font-bold uppercase text-neutral-500 block">
                                            Assigned Role
                                        </span>
                                        <span className="font-black text-black">
                                            {verifiedInvite.roleName}
                                        </span>
                                    </div>
                                    <div className="p-2.5 bg-white border-2 border-black rounded-lg">
                                        <span className="text-[10px] font-bold uppercase text-neutral-500 block">
                                            Department
                                        </span>
                                        <span className="font-black text-black">
                                            {verifiedInvite.departmentName || "General Team"}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-xs text-neutral-600 font-medium flex items-center justify-between">
                                    <span>Invited by <strong>@{verifiedInvite.inviterName}</strong></span>
                                    {verifiedInvite.expiresAt && (
                                        <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Expires in {Math.max(1, Math.ceil((new Date(verifiedInvite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                                        </span>
                                    )}
                                </div>

                                {verifiedInvite.invitationMessage && (
                                    <div className="p-2.5 bg-white border-2 border-black rounded-lg text-xs italic text-neutral-700">
                                        &ldquo;{verifiedInvite.invitationMessage}&rdquo;
                                    </div>
                                )}

                                <OrbixButton
                                    type="button"
                                    onClick={handleAcceptVerified}
                                    loading={joining}
                                    loadingLabel="Joining Workspace..."
                                    variant="lime"
                                    size="lg"
                                    className="w-full justify-center"
                                    iconRight={<Sparkles className="w-4 h-4 stroke-[2.5]" />}
                                    uppercase
                                >
                                    Accept &amp; Join Workspace
                                </OrbixButton>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 2: Pending Invitations */}
                {activeTab === "pending" && (
                    <div className="space-y-3">
                        {loadingPending ? (
                            <div className="py-8 flex flex-col items-center justify-center gap-2">
                                <OrbixLoader size="sm" />
                                <p className="text-xs font-bold text-neutral-600">
                                    Checking pending invitations...
                                </p>
                            </div>
                        ) : pendingInvitations.length === 0 ? (
                            <div className="p-6 bg-neutral-50 border-2 border-dashed border-black/30 rounded-xl text-center space-y-2">
                                <Shield className="w-8 h-8 text-neutral-400 mx-auto" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    No Pending Invitations
                                </h4>
                                <p className="text-xs text-neutral-500 font-medium max-w-sm mx-auto">
                                    You don&apos;t have any pending invitations right now. Ask your club or workspace manager to share an invite link or token with you.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("code")}
                                    className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Have an invite link? Enter it here</span>
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                {pendingInvitations.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="p-3.5 bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            {inv.clubLogoUrl ? (
                                                <img
                                                    src={inv.clubLogoUrl}
                                                    alt={inv.clubName}
                                                    className="w-10 h-10 rounded-lg object-cover border-2 border-black shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-black text-base shrink-0">
                                                    {(inv.clubName || "C").charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="text-xs font-black text-black">
                                                    {inv.clubName}
                                                </h4>
                                                <p className="text-[11px] text-neutral-600 font-bold">
                                                    {inv.roleName}
                                                    {inv.departmentName && ` • ${inv.departmentName}`}
                                                </p>
                                                <span className="text-[10px] text-neutral-500">
                                                    Invited by @{inv.inviterName}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleAcceptPending(inv)}
                                            disabled={acceptingId === inv.id}
                                            className="px-3 py-2 rounded-xl bg-[#A6FF70] hover:bg-[#92f557] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                                        >
                                            {acceptingId === inv.id ? (
                                                <OrbixLoader size="xs" variant="minimal" />
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                                    <span>Accept &amp; Join</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
export default JoinClubModal;
