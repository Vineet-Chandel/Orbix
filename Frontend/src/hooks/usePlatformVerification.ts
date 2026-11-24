import { useState, useEffect, useRef, useCallback } from "react";
import {
    initiateVerification,
    confirmVerification,
    cancelVerification,
    VerificationApiError,
} from "../api/platformVerificationApi";
import type {
    ActiveVerificationChallenge,
    ConfirmVerificationSuccessResponse,
} from "../types/platformVerification";
import { useToast } from "../context/ToastContext";

export interface UsePlatformVerificationOptions {
    onSuccess?: (result: ConfirmVerificationSuccessResponse) => void;
}

export function usePlatformVerification(options: UsePlatformVerificationOptions = {}) {
    const toast = useToast();
    const onSuccessRef = useRef(options.onSuccess);
    useEffect(() => {
        onSuccessRef.current = options.onSuccess;
    }, [options.onSuccess]);

    const [challenge, setChallenge] = useState<ActiveVerificationChallenge | null>(null);
    const [isInitiating, setIsInitiating] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
    const [attemptsRemaining, setAttemptsRemaining] = useState<number | undefined>(undefined);
    const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
        };
    }, []);

    // Challenge expiry countdown timer
    useEffect(() => {
        if (!challenge?.expiresAt) {
            return;
        }

        const updateCountdown = () => {
            const expiryTime = new Date(challenge.expiresAt).getTime();
            const now = Date.now();
            const diffSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
            setRemainingSeconds(diffSeconds);
        };

        const interval = setInterval(updateCountdown, 1000);
        countdownIntervalRef.current = interval;

        return () => {
            clearInterval(interval);
        };
    }, [challenge?.expiresAt]);

    // Rate-limit cooldown timer
    useEffect(() => {
        if (cooldownSeconds <= 0) return;

        const interval = setInterval(() => {
            setCooldownSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        cooldownIntervalRef.current = interval;

        return () => clearInterval(interval);
    }, [cooldownSeconds]);

    // Copy challenge token to clipboard
    const copyToken = useCallback(async () => {
        if (!challenge?.token) return false;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(challenge.token);
            } else {
                // Fallback for older browsers
                const textarea = document.createElement("textarea");
                textarea.value = challenge.token;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }

            setIsCopied(true);
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
            return true;
        } catch {
            toast.error("Failed to copy verification token to clipboard. Please copy manually.");
            return false;
        }
    }, [challenge, toast]);

    // Start verification challenge
    const startVerification = useCallback(
        async (portal: string, portalUsername: string, targetField?: string) => {
            setIsInitiating(true);
            setError(null);

            try {
                const res = await initiateVerification({ portal, portalUsername, targetField });

                if (res.alreadyVerified) {
                    toast.info(`Account @${portalUsername} on ${portal} is already verified.`);
                    setIsInitiating(false);
                    onSuccessRef.current?.({
                        success: true,
                        verified: true,
                        portal: res.portal,
                        portalUsername: res.portalUsername,
                        verificationMethod: res.verificationMethod || (res.portal.toLowerCase() === "github" ? "oauth" : "token"),
                        verifiedAt: res.verifiedAt || new Date().toISOString(),
                    });
                    return { alreadyVerified: true };
                }

                if (!res.token || !res.challengeId || !res.expiresAt) {
                    throw new VerificationApiError(
                        "Server did not return a complete verification challenge.",
                        500,
                        "SERVER_ERROR"
                    );
                }

                const newChallenge: ActiveVerificationChallenge = {
                    challengeId: res.challengeId,
                    portal: res.portal,
                    portalUsername: res.portalUsername,
                    targetField: res.targetField || "bio",
                    displayFieldName: res.displayFieldName || "Profile Bio",
                    token: res.token,
                    tokenDisplayPrefix: res.tokenDisplayPrefix || res.token.substring(0, 12),
                    instructions: res.instructions || "Add the verification token to your profile.",
                    profileSettingsUrl: res.profileSettingsUrl,
                    expiresAt: typeof res.expiresAt === "string" ? res.expiresAt : new Date(res.expiresAt).toISOString(),
                };

                const diffSeconds = Math.max(0, Math.floor((new Date(newChallenge.expiresAt).getTime() - Date.now()) / 1000));
                setRemainingSeconds(diffSeconds);
                setChallenge(newChallenge);
                setAttemptsRemaining(5);
                setIsInitiating(false);
                return { success: true, challenge: newChallenge };
            } catch (err: unknown) {
                setIsInitiating(false);
                const apiErr = err instanceof VerificationApiError 
                    ? err 
                    : new VerificationApiError(err instanceof Error ? err.message : "Failed to initiate verification", 500);

                if (apiErr.resetInSeconds) {
                    setCooldownSeconds(apiErr.resetInSeconds);
                }

                setError(apiErr.message);

                if (apiErr.requiresOAuth && apiErr.oauthUrl) {
                    return { requiresOAuth: true, oauthUrl: apiErr.oauthUrl, error: apiErr.message };
                }

                toast.error(apiErr.message, { title: "Verification Error" });
                return { success: false, error: apiErr.message, code: apiErr.code };
            }
        },
        [toast]
    );

    // Confirm ownership challenge
    const confirmChallenge = useCallback(
        async (portal: string, portalUsername?: string) => {
            setIsConfirming(true);
            setError(null);

            try {
                const res = await confirmVerification({ portal, portalUsername });
                setIsConfirming(false);
                setChallenge(null);
                setRemainingSeconds(0);
                toast.success(res.message || "Platform account ownership verified successfully!", {
                    title: "Ownership Verified",
                });
                onSuccessRef.current?.(res);
                return { success: true, result: res };
            } catch (err: unknown) {
                setIsConfirming(false);
                const apiErr = err instanceof VerificationApiError 
                    ? err 
                    : new VerificationApiError(err instanceof Error ? err.message : "Verification confirmation failed", 500);

                if (apiErr.attemptsRemaining !== undefined) {
                    setAttemptsRemaining(apiErr.attemptsRemaining);
                }

                if (apiErr.resetInSeconds) {
                    setCooldownSeconds(apiErr.resetInSeconds);
                }

                setError(apiErr.message);
                toast.error(apiErr.message, { title: "Verification Failed" });
                return { success: false, error: apiErr.message, code: apiErr.code, attemptsRemaining: apiErr.attemptsRemaining };
            }
        },
        [toast]
    );

    // Cancel challenge
    const cancelChallenge = useCallback(
        async (portal: string) => {
            setIsCancelling(true);
            try {
                await cancelVerification({ portal });
            } catch {
                // Non-fatal if server already expired it
            } finally {
                setChallenge(null);
                setRemainingSeconds(0);
                setIsCancelling(false);
                setError(null);
            }
        },
        []
    );

    const formattedTime = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

    return {
        challenge,
        isInitiating,
        isConfirming,
        isCancelling,
        isCopied,
        remainingSeconds,
        formattedTime,
        isExpired: remainingSeconds === 0 && Boolean(challenge),
        attemptsRemaining,
        cooldownSeconds,
        error,
        copyToken,
        startVerification,
        confirmChallenge,
        cancelChallenge,
        clearChallenge: () => setChallenge(null),
    };
}
