import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import { verifyInstitutionalEmailToken } from "../../api/collegeVerificationApi";
import {
    openCollegeVerificationModal,
    emitCollegeVerificationUpdated,
} from "../../utils/collegeVerificationModalEvents";

// Module-level deduplication sets ensure strict single execution across React 18 Strict Mode and routing remounts
const inFlightTokens = new Set<string>();
const processedTokens = new Set<string>();
const PENDING_EMAIL_TOKEN_KEY = "orbix_pending_college_email_token";

function notifyCollegeVerificationChannels() {
    emitCollegeVerificationUpdated();
    try {
        if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("orbix_college_verification");
            channel.postMessage({ type: "college_verification_updated" });
            channel.close();
        }
    } catch {
        // Ignore BroadcastChannel errors in restricted browsers
    }
}

/**
 * Authoritative institutional email verification listener.
 * Mounted once at router root level in App.tsx.
 */
export const CollegeEmailVerificationListener = () => {
    const location = useLocation();
    const dispatch = useAppDispatch();
    const { user, loading } = useAppSelector((state) => state.user);
    const toast = useToast();
    const isVerifyingRef = useRef(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const urlToken = searchParams.get("verify_college_email") || searchParams.get("college_verify_token");
        const openVerification = searchParams.get("open_verification");

        if (urlToken && urlToken.trim().length > 0) {
            const cleanUrlToken = urlToken.trim();
            try {
                sessionStorage.setItem(PENDING_EMAIL_TOKEN_KEY, cleanUrlToken);
            } catch {}

            // Immediately scrub the sensitive token from browser address bar & history
            searchParams.delete("verify_college_email");
            searchParams.delete("college_verify_token");
            const remainingSearch = searchParams.toString();
            const cleanUrl = `${location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${location.hash}`;
            window.history.replaceState(null, "", cleanUrl);
        }

        let storedToken: string | null = null;
        try {
            storedToken = sessionStorage.getItem(PENDING_EMAIL_TOKEN_KEY);
        } catch {}

        const token = urlToken?.trim() || storedToken?.trim() || null;

        if (token) {
            // Wait until authentication resolves before calling authenticated /email/verify endpoint
            if (loading) {
                return;
            }

            if (!user) {
                // Keep token safely in sessionStorage until user signs in
                return;
            }

            // Strict deduplication guard
            if (inFlightTokens.has(token) || processedTokens.has(token) || isVerifyingRef.current) {
                return;
            }

            inFlightTokens.add(token);
            isVerifyingRef.current = true;
            try {
                sessionStorage.removeItem(PENDING_EMAIL_TOKEN_KEY);
            } catch {}

            // Perform authoritative authenticated token redemption
            (async () => {
                try {
                    toast.info("Verifying institutional email token...", { title: "Verification" });
                    const res = await verifyInstitutionalEmailToken(token);
                    processedTokens.add(token);

                    toast.success(res.message || "Institutional email successfully verified!", {
                        title: "Email Verified",
                    });

                    // Refresh authoritative user profile and notify all UI surfaces & open tabs
                    await dispatch(fetchUserProfile({ force: true }));
                    notifyCollegeVerificationChannels();

                    // Open the single modal so the student sees their verified status
                    openCollegeVerificationModal();
                } catch (err: any) {
                    processedTokens.add(token);
                    const msg = String(err?.message || "");

                    if (msg.toLowerCase().includes("already been used")) {
                        toast.info("This institutional email link has already been verified.", {
                            title: "Token Already Used",
                        });
                        notifyCollegeVerificationChannels();
                        openCollegeVerificationModal();
                    } else if (msg.toLowerCase().includes("expired")) {
                        toast.error("This verification link has expired. Please request a new verification email.", {
                            title: "Link Expired",
                        });
                        openCollegeVerificationModal();
                    } else {
                        toast.error(msg || "Failed to verify institutional email. The link is invalid.", {
                            title: "Verification Failed",
                        });
                    }
                } finally {
                    inFlightTokens.delete(token);
                    isVerifyingRef.current = false;
                }
            })();
        } else if (openVerification === "true") {
            // Clean up query param and open verification modal
            searchParams.delete("open_verification");
            const remainingSearch = searchParams.toString();
            const cleanUrl = `${location.pathname}${remainingSearch ? `?${remainingSearch}` : ""}${location.hash}`;
            window.history.replaceState(null, "", cleanUrl);
            openCollegeVerificationModal();
        }
    }, [location.search, location.pathname, location.hash, user, loading, dispatch, toast]);

    return null;
};
