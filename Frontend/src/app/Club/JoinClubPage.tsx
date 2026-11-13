// Frontend/src/app/Club/JoinClubPage.tsx
import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link, useLocation } from "react-router-dom";
import {
    AlertCircle,
    ArrowRight,
    Building2,
    Calendar,
    Sparkles,
    LogIn,
    UserPlus,
} from "lucide-react";
import { workspaceApi } from "../../api/workspaceApi";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader, OrbixButton } from "../../components/ui/loader";
import { useAppSelector } from "../../store";

export const JoinClubPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = (searchParams.get("token") || "").trim();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();

    const { user, isAuthenticated } = useAppSelector((state) => state.user);

    const [verifying, setVerifying] = useState(false);
    const [joining, setJoining] = useState(false);
    const [verifiedInvite, setVerifiedInvite] = useState<any | null>(null);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    const [manualToken, setManualToken] = useState("");

    const verifyToken = async (tokenStr: string) => {
        if (!tokenStr.trim()) return;
        try {
            setVerifying(true);
            setVerifyError(null);
            setVerifiedInvite(null);

            const res = await workspaceApi.verifyInvitation(tokenStr.trim());
            if (res.success && res.isValid && res.invitation) {
                setVerifiedInvite({ ...res.invitation, rawToken: tokenStr.trim() });
            } else {
                setVerifyError(res.reason || "This invitation is invalid, revoked, or has expired.");
            }
        } catch (err: any) {
            setVerifyError(err.message || "Failed to verify invitation token.");
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        if (token) {
            verifyToken(token);
        }
    }, [token]);

    const handleAccept = async () => {
        const activeToken = verifiedInvite?.rawToken || token;
        if (!activeToken) return;

        if (!isAuthenticated) {
            const returnUrl = encodeURIComponent(location.pathname + location.search);
            navigate(`/auth/signin?returnUrl=${returnUrl}`);
            return;
        }

        try {
            setJoining(true);
            const res = await workspaceApi.acceptInvitation(activeToken);
            if (res.success) {
                toast.success(res.message || `Successfully joined ${verifiedInvite?.clubName || "the club"}!`);
                const targetClubId = res.clubId || verifiedInvite?.clubId;
                if (targetClubId) {
                    navigate(`/workspace/${targetClubId}`);
                } else {
                    navigate("/workspace");
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to join club workspace.");
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FAF6EE] flex flex-col justify-between p-4 sm:p-6 text-black select-none">
            {/* Top Bar */}
            <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b-2 border-black/10">
                <Link to="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-[2px_2px_0px_#A6FF70]">
                        <span className="font-black text-white text-base">O</span>
                    </div>
                    <span className="font-black text-lg tracking-tight text-black">Orbix</span>
                </Link>

                {isAuthenticated ? (
                    <div className="flex items-center gap-2">
                        <Link
                            to="/dashboard"
                            className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] transition"
                        >
                            Go to Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link
                            to={`/auth/signin?returnUrl=${encodeURIComponent(location.pathname + location.search)}`}
                            className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] transition"
                        >
                            Sign In
                        </Link>
                    </div>
                )}
            </div>

            {/* Main Content Card */}
            <div className="max-w-lg w-full mx-auto my-auto py-8">
                <div className="bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-6 sm:p-8 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <div className="w-14 h-14 rounded-2xl bg-[#A6FF70] border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_#000] mx-auto">
                            <UserPlus className="w-7 h-7 text-black stroke-[2.5]" />
                        </div>
                        <h1 className="text-2xl font-black text-black">
                            Join Club Workspace
                        </h1>
                        <p className="text-xs text-neutral-600 font-medium max-w-sm mx-auto">
                            You have been invited to collaborate with your campus team on Orbix.
                        </p>
                    </div>

                    {verifying && (
                        <div className="py-8 flex flex-col items-center justify-center gap-3">
                            <OrbixLoader size="md" />
                            <p className="text-xs font-bold text-neutral-600">
                                Verifying cryptographic invitation...
                            </p>
                        </div>
                    )}

                    {verifyError && !verifying && (
                        <div className="p-4 bg-rose-50 border-2 border-rose-600 rounded-xl space-y-3">
                            <div className="flex items-start gap-2.5 text-xs text-rose-700 font-bold">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span>{verifyError}</span>
                            </div>
                            <div className="pt-2 border-t border-rose-200 flex gap-2">
                                <Link
                                    to="/clubs"
                                    className="px-3 py-1.5 bg-white border border-rose-600 text-rose-700 font-black text-xs rounded-lg hover:bg-rose-100 transition"
                                >
                                    Browse Campus Clubs
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVerifyError(null);
                                        setVerifiedInvite(null);
                                    }}
                                    className="px-3 py-1.5 bg-rose-600 text-white font-black text-xs rounded-lg hover:bg-rose-700 transition"
                                >
                                    Try Another Code
                                </button>
                            </div>
                        </div>
                    )}

                    {verifiedInvite && !verifying && (
                        <div className="space-y-5 animate-fadeIn">
                            {/* Club Card */}
                            <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded-xl space-y-3 shadow-[3px_3px_0px_#000]">
                                <div className="flex items-center gap-3.5">
                                    {verifiedInvite.clubLogoUrl ? (
                                        <img
                                            src={verifiedInvite.clubLogoUrl}
                                            alt={verifiedInvite.clubName || "Club"}
                                            className="w-14 h-14 rounded-xl object-cover border-2 border-black shadow-[2px_2px_0px_#000]"
                                        />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-black text-xl shadow-[2px_2px_0px_#000]">
                                            {(verifiedInvite.clubName || "C").charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                            Official Invitation
                                        </span>
                                        <h3 className="text-lg font-black text-black leading-tight">
                                            {verifiedInvite.clubName || verifiedInvite.workspaceName}
                                        </h3>
                                        {verifiedInvite.collegeName && (
                                            <p className="text-xs text-neutral-600 font-bold flex items-center gap-1 mt-0.5">
                                                <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                                                <span>{verifiedInvite.collegeName}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/10 text-xs">
                                    <div className="p-2.5 bg-white border-2 border-black rounded-lg">
                                        <span className="text-[10px] font-bold uppercase text-neutral-500 block">
                                            Role
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
                            </div>

                            {/* Authentication Decision */}
                            {isAuthenticated ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-neutral-500 text-center font-bold">
                                        Signed in as <strong>{user?.username || user?.gmail || "User"}</strong>
                                    </p>
                                    <OrbixButton
                                        type="button"
                                        onClick={handleAccept}
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
                            ) : (
                                <div className="space-y-3 pt-1">
                                    <div className="p-3 bg-[#FFE566]/30 border-2 border-black rounded-xl text-center text-xs font-bold text-black">
                                        Sign in or create a free Orbix account to accept this invitation.
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <Link
                                            to={`/auth/signin?returnUrl=${encodeURIComponent(location.pathname + location.search)}`}
                                            className="px-4 py-2.5 rounded-xl border-2 border-black bg-black text-white hover:bg-neutral-800 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition"
                                        >
                                            <LogIn className="w-3.5 h-3.5" />
                                            <span>Sign In</span>
                                        </Link>
                                        <Link
                                            to={`/auth/signup?returnUrl=${encodeURIComponent(location.pathname + location.search)}`}
                                            className="px-4 py-2.5 rounded-xl border-2 border-black bg-[#A6FF70] text-black hover:bg-[#92f557] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>Sign Up</span>
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!token && !verifiedInvite && !verifying && !verifyError && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Invitation Token or URL
                                </label>
                                <input
                                    type="text"
                                    value={manualToken}
                                    onChange={(e) => setManualToken(e.target.value)}
                                    placeholder="Paste token or invite link here..."
                                    className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => verifyToken(manualToken)}
                                disabled={!manualToken.trim()}
                                className="w-full py-2.5 rounded-xl bg-[#FFE566] hover:bg-[#fedb30] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            >
                                <span>Verify Invitation</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="max-w-4xl w-full mx-auto text-center text-xs text-neutral-500 font-bold pt-6 border-t-2 border-black/10">
                Orbix Campus Club Workspaces • All rights reserved
            </div>
        </div>
    );
};
export default JoinClubPage;
