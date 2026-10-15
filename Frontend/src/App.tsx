import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SignInPage from './LandingPages/Auth-Pages/Signin/Landing';
import SignUpPage from './LandingPages/Auth-Pages/Signup/Landing';
import MainLanding from "./LandingPages/Main-Landing-Pages/Landing";
import CustomersPage from "./LandingPages/Customers/Landing";
import PricingPage from "./LandingPages/Pricing/Landing";
import SupportPage from "./LandingPages/Support/Landing";
import PlatformPage from "./LandingPages/Platform/Landing";
import Dashboard from "./app/Dashboard/Landing";
import ProfileManager from "./app/Profile/ProfileManager";
import PublicProfilePage from "./app/Profile/PublicProfilePage";
import ProfilesOnboardingPage from "./LandingPages/Auth-Pages/ProfilesOnboarding/ProfilesOnboardingPage";
import ProtectedRoute from "./ProtectedRoute";
import { ToastProvider } from "./context/ToastContext";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "./store";

const WorkspaceRedirect = () => {
  const { user } = useAppSelector((state) => state.user);
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth/signin" replace />;
};

const App = () => {
  const dispatch = useAppDispatch();

  // Fetch /profile/me on app load/refresh to sync Redux with active session
  useEffect(() => {
    dispatch(fetchUserProfile());
  }, [dispatch]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing & Marketing Pages */}
          <Route path="/" element={<MainLanding />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/demo" element={<SupportPage />} />

          {/* Public Shareable Profile Showcase Route */}
          <Route path="/profile/:username" element={<PublicProfilePage />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />

          {/* Auth Pages */}
          <Route path="/auth/signup" element={<SignUpPage />} />
          <Route path="/auth/signin" element={<SignInPage />} />
          <Route path="/login" element={<Navigate to="/auth/signin" replace />} />
          <Route path="/workspace" element={<WorkspaceRedirect />} />

          {/* New User Onboarding & Profiles Links Setup */}
          <Route path="/onboarding" element={<ProfilesOnboardingPage />} />
          <Route path="/auth/profiles" element={<ProfilesOnboardingPage />} />
          <Route path="/profile/setup" element={<ProfilesOnboardingPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<ProfileManager />} />
            <Route path="/resume" element={<Dashboard />} />
            <Route path="/projects" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;