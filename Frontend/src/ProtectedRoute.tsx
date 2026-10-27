import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { useAppSelector } from "./store";

const ProtectedRoute = () => {
    const { user, loading } = useAppSelector((state) => state.user);
    const context = useOutletContext();

    if (loading && !user) {
        return (
            <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-sm text-white/50 tracking-wide font-medium">Verifying session...</p>
                </div>
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

export default ProtectedRoute;