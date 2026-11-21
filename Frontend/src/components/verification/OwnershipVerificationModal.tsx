import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    Copy,
    Check,
    Clock,
    ExternalLink,
    AlertCircle,
    X,
    ShieldCheck,
    AlertTriangle,
    RefreshCw,
} from "lucide-react";
import { PORTALS } from "../../utils/portalParser";
import { getPortalIcon } from "../../utils/portalIcons";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { usePlatformVerification } from "../../hooks/usePlatformVerification";
import { OrbixLoader } from "../ui/loader";
import { startGitHubOwnershipVerification } from "../../api/platformVerificationApi";
import type { ConfirmVerificationSuccessResponse } from "../../types/platformVerification";

export interface OwnershipVerificationModalProps {
    isOpen: boolean;
    portalId: string;
    username: string;
    onClose: () => void;
    onVerifiedSuccess?: (res: ConfirmVerificationSuccessResponse) => void;
    onBeforeOAuthRedirect?: () => void;
}

export const OwnershipVerificationModal: React.FC<OwnershipVerificationModalProps> = ({
    isOpen,
    portalId,
    username,
    onClose,
    onVerifiedSuccess,
    onBeforeOAuthRedirect,
}) => {
    const config = PORTALS[portalId];
    const isGitHub = portalId.toLowerCase() === "github";

    const {
        challenge,
        isInitiating,
        isConfirming,
        isCancelling,
        isCopied,
        formattedTime,
        isExpired,
        attemptsRemaining,
        cooldownSeconds,
        error: hookError,
        copyToken,
        startVerification,
        confirmChallenge,
        cancelChallenge,
        clearChallenge,
    } = usePlatformVerification({
        onSuccess: (res) => {
            onVerifiedSuccess?.(res);
            setTimeout(() => {
                onClose();
            }, 1200);
        },
    });

    const [isSuccess, setIsSuccess] = useState(false);
    const [oauthRedirecting, setOauthRedirecting] = useState(false);
    const [oauthError, setOauthError] = useState<string | null>(null);

    // Initial initiation when modal opens
    useEffect(() => {
        if (isOpen && portalId && username && !isGitHub && !challenge && !isInitiating) {
            startVerification(portalId, username);
        }
    }, [isOpen, portalId, username, isGitHub, challenge, isInitiating, startVerification]);

    const handleCloseModal = () => {
        if (isConfirming || isCancelling || oauthRedirecting) return;
        if (challenge && !isSuccess) {
            cancelChallenge(portalId);
        }
        clearChallenge();
        setIsSuccess(false);
        onClose();
    };

    const { handleBackdropClick } = useModalDismiss({
        isOpen,
        onClose: handleCloseModal,
        disableEscape: isConfirming || isCancelling || oauthRedirecting,
        disableBackdrop: isConfirming || isCancelling || oauthRedirecting,
    });

    if (!isOpen || typeof document === "undefined") return null;

    const handleConfirm = async () => {
        if ((!challenge && !isGitHub) || isConfirming || (challenge && isExpired) || cooldownSeconds > 0) return;
        const result = await confirmChallenge(portalId, username);
        if (result?.success) {
            setIsSuccess(true);
        }
    };

    const handleRestart = async () => {
        clearChallenge();
        await startVerification(portalId, username);
    };

    const handleGitHubOAuth = async () => {
        if (oauthRedirecting) return;
        setOauthRedirecting(true);
        setOauthError(null);
        try {
            const url = await startGitHubOwnershipVerification(username, window.location.href);
            onBeforeOAuthRedirect?.();
            window.location.assign(url);
        } catch (error) {
            setOauthError(error instanceof Error ? error.message : "Could not start GitHub verification. Please retry.");
            setOauthRedirecting(false);
        }
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ownershipVerificationTitle"
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
            <div
                className="w-full max-w-lg bg-white border-3 border-black rounded-2xl p-5 sm:p-6 shadow-[8px_8px_0px_#000] text-black space-y-4 sm:space-y-5 animate-scaleUp overflow-hidden max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b-2 border-black/10 pb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center p-2 shadow-[2px_2px_0px_#000] shrink-0">
                            {getPortalIcon(portalId, "w-full h-full object-contain")}
                        </div>
                        <div className="min-w-0">
                            <h3
                                id="ownershipVerificationTitle"
                                className="text-base sm:text-lg font-black tracking-tight text-black leading-snug break-words"
                            >
                                Verify {config?.name || portalId} Ownership
                            </h3>
                            <p className="text-xs font-mono font-bold text-neutral-600 break-all">
                                @{username}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCloseModal}
                        disabled={isConfirming || oauthRedirecting}
                        className="p-1 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none transition-all cursor-pointer disabled:opacity-50"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* State: Success */}
                {isSuccess ? (
                    <div className="py-6 text-center space-y-3 animate-fadeIn">
                        <div className="w-16 h-16 rounded-full bg-[#a2ff86] border-2 border-black flex items-center justify-center mx-auto shadow-[4px_4px_0px_#000]">
                            <ShieldCheck className="w-9 h-9 text-black stroke-[2.5]" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-lg font-black text-black">Ownership Verified!</h4>
                            <p className="text-xs font-bold text-neutral-700">
                                Your ownership of @{username} on {config?.name} has been cryptographically confirmed.
                            </p>
                        </div>
                    </div>
                ) : isGitHub ? (
                    /* State: GitHub OAuth Identity Verification */
                    <div className="space-y-4 animate-fadeIn">
                        <div className="p-4 rounded-xl border-2 border-black bg-neutral-50 shadow-[2px_2px_0px_#000] space-y-2">
                            <div className="flex items-center gap-2">
                                {getPortalIcon("github", "w-5 h-5 text-black")}
                                <span className="text-xs font-black uppercase tracking-wider text-black">
                                    Verify with GitHub
                                </span>
                            </div>
                            <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                                Verify will open GitHub so you can authorize Orbix.
                            </p>
                            <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                                Sign in with the GitHub account shown above. You’ll return here after verification.
                            </p>
                        </div>

                        {(oauthError || hookError) && (
                            <div className="p-3 rounded-lg border-2 border-black bg-rose-50 text-rose-900 text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#dc2626]">
                                <AlertCircle className="w-4 h-4 stroke-[2.5] shrink-0 text-rose-700" />
                                <span role="alert">{oauthError || hookError}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button type="button" onClick={handleCloseModal} disabled={oauthRedirecting}
                                className="min-h-11 min-w-0 px-3 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer disabled:opacity-50 whitespace-nowrap">
                                Cancel
                            </button>
                            <button type="button" onClick={handleGitHubOAuth} disabled={oauthRedirecting} aria-busy={oauthRedirecting}
                                className="min-h-11 min-w-0 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ffd93d] text-xs font-black shadow-[3px_3px_0px_#000] cursor-pointer disabled:opacity-60 disabled:cursor-wait whitespace-nowrap">
                                {oauthRedirecting ? <span aria-hidden="true" className="w-4 h-4 shrink-0 border-2 border-black border-t-transparent rounded-full animate-spin" /> :
                                    <span className="w-4 h-4 shrink-0 flex items-center justify-center" aria-hidden="true">{getPortalIcon("github", "w-4 h-4")}</span>}
                                <span>{oauthRedirecting ? "Opening…" : "Verify"}</span>
                            </button>
                        </div>
                    </div>
                ) : isInitiating ? (
                    /* State: Initiating Challenge */
                    <div className="py-10 text-center space-y-3">
                        <OrbixLoader size="sm" variant="minimal" />
                        <p className="text-xs font-bold text-neutral-700 animate-pulse">
                            Generating cryptographic verification challenge...
                        </p>
                    </div>
                ) : challenge ? (
                    /* State: Active Challenge Presentation */
                    <div className="space-y-4 animate-fadeIn">
                        {/* Expiry and Cooldown Bar */}
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE] shadow-[2px_2px_0px_#000]">
                            <div className="flex items-center gap-1.5 text-xs font-black text-black">
                                <Clock className="w-4 h-4 stroke-[2.5]" />
                                <span>Challenge Expiry:</span>
                                <span className={`font-mono ${isExpired ? "text-rose-600 font-black" : "text-neutral-900"}`}>
                                    {isExpired ? "EXPIRED" : formattedTime}
                                </span>
                            </div>

                            {attemptsRemaining !== undefined && attemptsRemaining < 5 && (
                                <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-md border border-black bg-amber-100 text-amber-950">
                                    {attemptsRemaining} attempts left
                                </span>
                            )}
                        </div>

                        {/* Platform Specific Instructions */}
                        <div className="space-y-1.5">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                1. Copy Verification Token
                            </span>
                            <div className="relative flex items-center rounded-xl border-2 border-black bg-neutral-900 text-white p-3 font-mono text-xs shadow-[3px_3px_0px_#000] overflow-hidden">
                                <span className="select-all tracking-wider font-bold truncate pr-16 text-[#FFE566]">
                                    {challenge.token}
                                </span>
                                <button
                                    type="button"
                                    onClick={copyToken}
                                    className="absolute right-2 px-2.5 py-1 rounded-md border-2 border-white bg-white hover:bg-neutral-100 text-black text-[11px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                                >
                                    {isCopied ? (
                                        <>
                                            <Check className="w-3 h-3 stroke-[3] text-emerald-600" />
                                            <span>Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3 stroke-[2.5]" />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Step 2: Placement guidance */}
                        <div className="space-y-2 rounded-xl border-2 border-black bg-amber-50/70 p-3.5 shadow-[2px_2px_0px_#000]">
                            <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-[#FFE566] border border-black flex items-center justify-center text-[10px] font-black">
                                    2
                                </span>
                                Update your {config?.name} Profile
                            </span>
                            <p className="text-xs font-bold text-neutral-800 leading-relaxed">
                                {challenge.instructions}
                            </p>
                            <p className="text-[11px] font-bold text-neutral-600">
                                Place the token in your <strong className="text-black">{challenge.displayFieldName}</strong> field and save changes on {config?.name}.
                            </p>

                            {challenge.profileSettingsUrl && (
                                <a
                                    href={challenge.profileSettingsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-black text-black underline hover:text-neutral-700 pt-1"
                                >
                                    <span>Open {config?.name} Profile Settings</span>
                                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                </a>
                            )}
                        </div>

                        {/* Error state alert */}
                        {hookError && (
                            <div className="p-3 rounded-xl border-2 border-black bg-rose-50 text-rose-950 text-xs font-bold flex items-start gap-2 shadow-[2px_2px_0px_#dc2626]">
                                <AlertCircle className="w-4 h-4 stroke-[2.5] shrink-0 text-rose-600 mt-0.5" />
                                <div className="space-y-0.5">
                                    <p className="font-black text-rose-900">Verification Check Failed</p>
                                    <p className="text-rose-800">{hookError}</p>
                                    {cooldownSeconds > 0 && (
                                        <p className="text-neutral-700 text-[11px] font-mono">
                                            Rate limit cooldown: {cooldownSeconds}s remaining.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 pt-2 border-t-2 border-black/10">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                disabled={isConfirming}
                                className="w-full sm:w-auto px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black uppercase shadow-[2px_2px_0px_#000] cursor-pointer transition-all"
                            >
                                Verify Later
                            </button>

                            {isExpired ? (
                                <button
                                    type="button"
                                    onClick={handleRestart}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none cursor-pointer transition-all"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Restart Challenge</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isConfirming || cooldownSeconds > 0}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#90f274] text-black text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isConfirming ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                            <span>Verifying Profile...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                                            <span>I've Updated My Profile</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Error state when challenge initiation fails */
                    <div className="py-6 text-center space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-100 border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                            <AlertTriangle className="w-6 h-6 text-rose-600 stroke-[2.5]" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-black">Could Not Initiate Challenge</h4>
                            <p className="text-xs font-bold text-neutral-600 max-w-sm mx-auto">
                                {hookError || "Unable to contact verification service. Please try again later."}
                            </p>
                        </div>
                        <div className="flex justify-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black uppercase shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => startVerification(portalId, username)}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ffd93d] text-xs font-black uppercase shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
