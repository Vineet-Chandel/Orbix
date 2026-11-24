import React, { useState, useEffect, useRef } from "react";
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
import { getPlatformVerificationGuide } from "../../utils/platformVerificationSupport";
import leetcodeGuideImg from "../../assets/verification/leetcode-verification-guide-cropped.png";

interface CopySuccessIconProps {
    className?: string;
}

const CopySuccessIcon: React.FC<CopySuccessIconProps> = ({ className = "w-4 h-4 sm:w-4.5 sm:h-4.5" }) => (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
        {/* Rear square: Hollow with crisp white outline and transparent/dark interior */}
        <Copy className="w-full h-full text-white stroke-[2.5]" aria-hidden="true" />

        {/* Front square: Solid bright white fill with dark contrasting checkmark */}
        <span
            className="absolute top-[33.33%] left-[33.33%] w-[58.33%] h-[58.33%] bg-white rounded-[2px] flex items-center justify-center pointer-events-none"
            aria-hidden="true"
        >
            <Check className="w-[82%] h-[82%] text-neutral-900 stroke-[3.5]" aria-hidden="true" />
        </span>
    </span>
);

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
            setIsSuccess(true);
            onVerifiedSuccess?.(res);
            setTimeout(() => {
                onClose();
            }, 1200);
        },
    });

    const [isSuccess, setIsSuccess] = useState(false);
    const [oauthRedirecting, setOauthRedirecting] = useState(false);
    const [oauthError, setOauthError] = useState<string | null>(null);
    const [showCheck, setShowCheck] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [rotationKey, setRotationKey] = useState(0);
    const initiatedIdentity = useRef<string | null>(null);

    const animMidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revertMidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revertEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearAllCopyTimers = () => {
        if (animMidTimerRef.current) clearTimeout(animMidTimerRef.current);
        if (animEndTimerRef.current) clearTimeout(animEndTimerRef.current);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (revertMidTimerRef.current) clearTimeout(revertMidTimerRef.current);
        if (revertEndTimerRef.current) clearTimeout(revertEndTimerRef.current);
    };

    useEffect(() => {
        return () => {
            clearAllCopyTimers();
        };
    }, []);

    const startRevertAnimation = () => {
        setRotationKey((k) => k + 1);
        setIsRotating(true);

        // Near midpoint of 360deg rotation (180ms), transition back to Copy icon
        revertMidTimerRef.current = setTimeout(() => {
            setShowCheck(false);
        }, 180);

        // Complete rotation at 360ms
        revertEndTimerRef.current = setTimeout(() => {
            setIsRotating(false);
        }, 360);
    };

    const handleCopyClick = async () => {
        const success = await copyToken();
        // If clipboard copy fails, do not trigger animation or success state
        if (!success) return;

        clearAllCopyTimers();

        if (showCheck) {
            // Re-click while already in success state: cleanly restart the 1.5s hold
            setIsRotating(false);
            holdTimerRef.current = setTimeout(() => {
                startRevertAnimation();
            }, 1500);
        } else {
            // Initial copy: start 360-degree clockwise rotation
            setRotationKey((k) => k + 1);
            setIsRotating(true);

            // Near midpoint of 360deg rotation (180ms), switch rendered icon to CopyCheck
            animMidTimerRef.current = setTimeout(() => {
                setShowCheck(true);
            }, 180);

            // Complete first rotation at 360ms
            animEndTimerRef.current = setTimeout(() => {
                setIsRotating(false);
                // Hold visible for ~1.5 seconds, then smoothly rotate back
                holdTimerRef.current = setTimeout(() => {
                    startRevertAnimation();
                }, 1500);
            }, 360);
        }
    };

    // Initial initiation when modal opens
    useEffect(() => {
        if (!isOpen) { initiatedIdentity.current = null; return; }
        const identity = `${portalId}:${username}`;
        if (portalId && username && !isGitHub && initiatedIdentity.current !== identity) {
            initiatedIdentity.current = identity;
            startVerification(portalId, username);
        }
    }, [isOpen, portalId, username, isGitHub, startVerification]);

    const handleCloseModal = () => {
        if (isConfirming || isCancelling || oauthRedirecting) return;
        clearAllCopyTimers();
        setShowCheck(false);
        setIsRotating(false);
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

    const guide = challenge
        ? getPlatformVerificationGuide(portalId, challenge.token, challenge.profileSettingsUrl)
        : null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ownershipVerificationTitle"
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[10001] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
            <div
                className={`w-full ${challenge ? "max-w-lg lg:max-w-4xl" : "max-w-lg"
                    } bg-white border-3 border-black rounded-2xl p-5 sm:p-6 shadow-[8px_8px_0px_#000] text-black animate-scaleUp overflow-hidden max-h-[92vh] flex flex-col`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b-2 border-black/10 pb-3.5 shrink-0">
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
                    /* State: Active Challenge Presentation - Desktop Two-Panel Layout */
                    <div className="flex-1 flex flex-col min-h-0 animate-fadeIn">
                        {/* Presentational CSS for countdown text pulse & 2D clockwise copy rotation */}
                        <style>{`
                            @keyframes orbixExpiryTextPulse {
                                0%, 100% {
                                    color: #000000;
                                }
                                50% {
                                    color: #dc2626;
                                }
                            }
                            .animate-expiry-pulse {
                                animation: orbixExpiryTextPulse 2s ease-in-out infinite;
                            }
                            @keyframes copyClockwiseSpin {
                                from {
                                    transform: rotate(0deg);
                                }
                                to {
                                    transform: rotate(360deg);
                                }
                            }
                            .copy-rotate-clockwise {
                                animation: copyClockwiseSpin 360ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
                                transform-origin: center;
                            }
                            @media (prefers-reduced-motion: reduce) {
                                .animate-expiry-pulse {
                                    animation: none !important;
                                }
                                .copy-rotate-clockwise {
                                    animation: none !important;
                                }
                            }
                        `}</style>

                        {/* Two-Panel Main Content Area: Scrollable */}
                        <div className="flex-1 overflow-y-auto py-3 sm:py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-0">
                                {/* LEFT COLUMN — TOKEN & INSTRUCTIONS */}
                                <div className="space-y-5 sm:space-y-6 border-b-2 border-black/10 pb-5 lg:border-b-0 lg:pb-0 lg:border-r-2 lg:border-black/10 lg:pr-6 xl:pr-8 pt-1 sm:pt-1.5">
                                    {/* Token Section with Descriptive Label */}
                                    <div className="space-y-3 sm:space-y-3.5">
                                        <p className=" mb-6 text-xs sm:text-sm font-bold text-neutral-900 tracking-tight">
                                            Copy the verification token below
                                        </p>

                                        {/* Minimal Token Container with Integrated Lucide Copy Icon */}
                                        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-neutral-900 text-white px-3.5 py-3 font-mono text-xs sm:text-sm shadow-[3px_3px_0px_#000]">
                                            <span className="select-all tracking-wider font-bold truncate pr-2 text-[#FFE566]">
                                                {challenge.token}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleCopyClick}
                                                className="p-1.5 -mr-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 active:bg-neutral-700 transition-colors cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#FFE566] shrink-0 flex items-center justify-center"
                                                aria-label={showCheck ? "Verification token copied" : "Copy verification token"}
                                                title={showCheck ? "Copied" : "Copy verification token"}
                                            >
                                                <span className="sr-only">
                                                    {showCheck ? "Verification token copied to clipboard" : "Copy verification token"}
                                                </span>
                                                <span className="relative w-4 h-4 sm:w-4.5 sm:h-4.5 flex items-center justify-center">
                                                    <span
                                                        key={rotationKey}
                                                        className={`w-full h-full flex items-center justify-center ${isRotating ? "copy-rotate-clockwise" : ""
                                                            }`}
                                                    >
                                                        {showCheck ? (
                                                            <CopySuccessIcon className="w-full h-full" />
                                                        ) : (
                                                            <Copy className="w-full h-full stroke-[2.5]" aria-hidden="true" />
                                                        )}
                                                    </span>
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Essential Supporting Verification Description */}
                                    <div className="space-y-3.5 sm:space-y-4 text-xs sm:text-sm pt-1.5 sm:pt-2">
                                        <p className="text-neutral-900 leading-relaxed">
                                            Place the verification token in your {guide?.portalName}{" "}
                                            <strong className="font-black text-black">
                                                {guide?.targetFieldName}
                                            </strong>{" "}
                                            field and save your changes.
                                        </p>
                                        <p className="text-neutral-600 leading-relaxed">
                                            Click <strong className="font-bold text-black">I've Updated My Profile</strong> below to allow Orbix to verify ownership.
                                        </p>
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
                                </div>

                                {/* RIGHT COLUMN — SETTINGS LINK, COUNTDOWN & VISUAL GUIDE */}
                                {guide && (
                                    <div className="space-y-3.5 pt-4 lg:pt-1 sm:lg:pt-1.5 lg:pl-6 xl:pl-8">
                                        {/* Top Row: Profile Settings Link (Left) + Countdown Timer (Right) */}
                                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                                            {guide.settingsUrl ? (
                                                <a
                                                    href={guide.settingsUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-black underline hover:text-neutral-700 transition-colors"
                                                >
                                                    <span>{guide.settingsUrlLabel}</span>
                                                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </a>
                                            ) : <div />}

                                            {/* Simplified Expiry: Clock icon + countdown time only, no box, no border, no label */}
                                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                <div
                                                    className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-black transition-colors ${isExpired ? "text-rose-600 font-black" : "animate-expiry-pulse"
                                                        }`}
                                                    role="status"
                                                    aria-live="polite"
                                                    aria-label={`Time remaining: ${isExpired ? "Expired" : formattedTime}`}
                                                >
                                                    <Clock className="w-4 h-4 stroke-[2.5] shrink-0" />
                                                    <span className="font-mono font-black tabular-nums tracking-tight">
                                                        {isExpired ? "EXPIRED" : formattedTime}
                                                    </span>
                                                </div>

                                                {attemptsRemaining !== undefined && attemptsRemaining < 5 && (
                                                    <span className="text-[10px] sm:text-[11px] font-black uppercase px-1.5 py-0.5 rounded border border-black bg-amber-100 text-amber-950 shadow-[1px_1px_0px_#000]">
                                                        {attemptsRemaining} left
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Annotated Platform Screenshot: Primary Visual Element */}
                                        {guide.hasScreenshot && (
                                            <div className="space-y-1.5 pt-0.5">
                                                <div className="rounded-xl border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000] bg-neutral-900">
                                                    <img
                                                        src={guide.portalId === "leetcode" ? leetcodeGuideImg : undefined}
                                                        alt={guide.screenshotAlt}
                                                        className="w-full h-auto object-contain block max-h-[220px] sm:max-h-[235px]"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                {guide.screenshotCaption && (
                                                    <p className="text-[11px] font-bold text-neutral-500 italic leading-tight">
                                                        {guide.screenshotCaption}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer: Full width across the bottom */}
                        <div className="flex items-center justify-center pt-3.5 border-t-2 border-black/10 shrink-0">
                            {isExpired ? (
                                <button
                                    type="button"
                                    onClick={handleRestart}
                                    className="w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ffd93d] text-black text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none cursor-pointer transition-all"
                                >
                                    <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Restart Challenge</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isConfirming || cooldownSeconds > 0}
                                    className="w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#90f274] text-black text-xs font-black uppercase tracking-wide shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
