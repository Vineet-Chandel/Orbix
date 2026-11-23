import React, { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { OrbixInitialLoader } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch, setUser, fetchUserProfile } from "../../store";
import { buildApiUrl } from "../../api/apiClient";

export const OAuthCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();
    const dispatch = useAppDispatch();
    const processedRef = useRef(false);

    useEffect(() => {
        if (processedRef.current) return;
        processedRef.current = true;

        const token = searchParams.get("token");
        const status = searchParams.get("status");
        const error = searchParams.get("error");
        const provider = searchParams.get("provider") || "OAuth";
        const isNew = searchParams.get("isNew") === "1";
        const returnTo = searchParams.get("returnTo") || "/dashboard";

        if (error) {
            const readableError = decodeURIComponent(error);
            toast.error(readableError, { title: "Authentication Error" });
            navigate("/auth/signin", { replace: true });
            return;
        }

        // Defensive fallback: If OAuth provider redirected directly to frontend SPA route with code and state instead of backend callback endpoint
        const code = searchParams.get("code");
        if (code && !token) {
            const query = new URLSearchParams(window.location.search);
            // Detect provider by query param if present, defaulting to github
            const targetProvider = provider === "google" ? "google" : "github";
            window.location.href = `${buildApiUrl(`/auth/${targetProvider}/callback`)}?${query.toString()}`;
            return;
        }

        if (status === "success" && token) {
            try {
                localStorage.setItem("orbix_token", token);
                localStorage.removeItem("orbix_signed_out");
            } catch {
                // Ignore storage quota errors
            }

            const establishSessionAndRedirect = async () => {
                const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                try {
                    // Call /api/auth/oauth/session to set HTTPOnly cookies on frontend origin and retrieve user
                    const sessionUrl = buildApiUrl("/api/auth/oauth/session");
                    const res = await fetch(sessionUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        credentials: "include",
                        body: JSON.stringify({ token }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (data?.token) {
                            try {
                                localStorage.setItem("orbix_token", data.token);
                            } catch {}
                        }
                        if (data?.user) {
                            dispatch(setUser({
                                ...data.user,
                                accountType: "personal",
                            }));
                        } else {
                            await dispatch(fetchUserProfile({ force: true })).unwrap();
                        }
                    } else {
                        // Fallback to fetchUserProfile if session endpoint returns non-OK
                        await dispatch(fetchUserProfile({ force: true })).unwrap();
                    }

                    if (isNew) {
                        toast.success(`Welcome to Orbix! Successfully registered with ${providerName}.`, {
                            title: "Account Created",
                        });
                        navigate(`/onboarding/college?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
                    } else {
                        toast.success(`Welcome back! Successfully authenticated via ${providerName}.`, {
                            title: "Signed In",
                        });
                        navigate(returnTo, { replace: true });
                    }
                } catch (err: any) {
                    console.error("OAuth session sync warning:", err);
                    // Defensive fallback: attempt fetchUserProfile directly
                    try {
                        await dispatch(fetchUserProfile({ force: true })).unwrap();
                        const fallbackDestination = isNew
                            ? `/onboarding/college?returnTo=${encodeURIComponent(returnTo)}`
                            : returnTo;
                        navigate(fallbackDestination, { replace: true });
                    } catch (finalErr: any) {
                        toast.error(finalErr?.message || "Failed to finalize authentication session.", {
                            title: "Authentication Error",
                        });
                        navigate("/auth/signin", { replace: true });
                    }
                }
            };

            establishSessionAndRedirect();
            return;
        }

        // If neither token nor explicit error, redirect to signin
        navigate("/auth/signin", { replace: true });
    }, [searchParams, navigate, toast, dispatch]);

    return (
        <OrbixInitialLoader
            message="Authenticating with Orbix…"
            subMessage="Finalizing your secure session and setting up your workspace"
        />
    );
};

export default OAuthCallbackPage;
