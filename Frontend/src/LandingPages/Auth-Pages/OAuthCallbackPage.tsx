import React, { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { OrbixLoader } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import { useAppDispatch, fetchUserProfile } from "../../store";
import { OrbixLogo } from "../../components/OrbixLogo";

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
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex flex-col items-center justify-center p-6 text-black select-none">
            <div className="w-full max-w-sm p-8 rounded-3xl bg-white border-3 border-black shadow-[8px_8px_0px_#000] text-center space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                    <OrbixLogo className="w-8 h-8 text-black" />
                </div>
                <div className="space-y-1.5">
                    <h2 className="text-xl font-black text-black tracking-tight">Authenticating with Orbix</h2>
                    <p className="text-xs font-bold text-neutral-600">
                        Finalizing your secure session and setting up your workspace...
                    </p>
                </div>
                <div className="pt-2 flex justify-center">
                    <OrbixLoader size="sm" variant="minimal" />
                </div>
            </div>
        </div>
    );
};

export default OAuthCallbackPage;
