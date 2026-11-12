import { Link, Navigate, Outlet, useOutletContext } from "react-router-dom";
import { Building2, Lock, ArrowRight } from "lucide-react";
import { useAppSelector } from "./store";
import { OrbixLoader } from "./components/ui/loader";

const ProtectedRoute = () => {
    const { user, loading } = useAppSelector((state) => state.user);
    const context = useOutletContext();

    if (loading && !user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <OrbixLoader size="lg" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth/signin" replace />;
    }

    // Restrict club accounts from personal-user features (dashboard, profile, resume, settings)
    if (user.accountType === "club") {
        if (user.clubStatus === "approved" || user.verifiedClub) {
            return <Navigate to="/club/dashboard" replace />;
        }
        return <Navigate to="/club/status" replace />;
    }

    return <Outlet context={context} />;
};

export const ClubProtectedRoute = () => {
    const { user, loading } = useAppSelector((state) => state.user);
    const context = useOutletContext();

    if (loading && !user) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center text-black">
                <OrbixLoader size="lg" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth/signin?tab=club" replace />;
    }

    // Strict isolation: personal accounts must sign in separately via the Club Portal
    if (user.accountType !== "club") {
        return (
            <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-4">
                <div className="max-w-lg w-full bg-white border-2 border-black rounded-3xl shadow-[6px_6px_0px_#000] p-6 sm:p-8 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center shrink-0">
                            <Lock className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-black text-white mb-1">
                                Strict Portal Separation
                            </span>
                            <h1 className="text-xl font-black text-black leading-tight">
                                Club Portal Login Required
                            </h1>
                        </div>
                    </div>

                    <p className="text-sm font-medium text-neutral-700 leading-relaxed">
                        You are currently signed in to your <strong className="text-black">Personal Account</strong>{" "}
                        {user.username ? `(@${user.username})` : ""}. Personal sessions do not grant access to a Club Dashboard or Club Status portal.
                    </p>

                    <div className="p-3.5 rounded-2xl bg-[#FAF6EE] border-2 border-black/15 flex items-start gap-2.5 text-xs font-semibold text-neutral-700">
                        <Building2 className="w-4 h-4 text-black shrink-0 mt-0.5" />
                        <span>
                            To manage a verified club or check an application, please sign in through the dedicated Club Portal using your club handle and password.
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <Link
                            to="/auth/signin?tab=club"
                            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#a2ff86] hover:bg-[#8ef56e] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] transition-all"
                        >
                            Sign In to Club Portal
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] transition-all"
                        >
                            Personal Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return <Outlet context={context} />;
};

export default ProtectedRoute;