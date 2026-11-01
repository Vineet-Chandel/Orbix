import { Navigate, Outlet, useOutletContext } from "react-router-dom";
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

export default ProtectedRoute;