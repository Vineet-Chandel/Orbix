import React, { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { OrbixInitialLoader } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch, fetchUserProfile } from "../../store";

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

        if (status === "success" && token) {
            try {
                localStorage.setItem("orbix_token", token);
            } catch {
                // Ignore storage quota errors
            }

            // Immediately load user profile into Redux store
            dispatch(fetchUserProfile({ force: true }))
                .unwrap()
                .then(() => {
                    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
                    if (isNew) {
                        toast.success(`Welcome to Orbix! Successfully registered with ${providerName}.`, {
                            title: "Account Created",
                        });
                    } else {
                        toast.success(`Welcome back! Successfully authenticated via ${providerName}.`, {
                            title: "Signed In",
                        });
                    }
                    navigate(returnTo, { replace: true });
                })
                .catch((err) => {
                    console.warn("Profile sync warning on OAuth callback:", err);
                    // Still navigate since cookie & token are already established
                    navigate(returnTo, { replace: true });
                });
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
