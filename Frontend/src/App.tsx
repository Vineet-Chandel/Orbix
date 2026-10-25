import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import SignInPage from './LandingPages/Auth-Pages/Signin/Landing';
import SignUpPage from './LandingPages/Auth-Pages/Signup/Landing';
import MainLanding from "./LandingPages/Main-Landing-Pages/Landing";
import CustomersPage from "./LandingPages/Customers/Landing";
import PricingPage from "./LandingPages/Pricing/Landing";
import SupportPage from "./LandingPages/Support/Landing";
import PlatformPage from "./LandingPages/Platform/Landing";
import BlogLanding from "./LandingPages/Blog/Landing";
import BlogCollectionPage from "./LandingPages/Blog/BlogCollectionPage";
import Dashboard from "./app/Dashboard/Landing";
import ProfileManager from "./app/Profile/ProfileManager";
import PublicProfilePage from "./app/Profile/PublicProfilePage";
import ProfilesOnboardingPage from "./LandingPages/Auth-Pages/ProfilesOnboarding/ProfilesOnboardingPage";
import LeaderboardPage from "./app/Leaderboard/LeaderboardPage";
import EventTrackerPage from "./app/Events/EventTrackerPage";
import { Card } from "./LandingPages/Main-Landing-Pages/Card";
import { Platform } from "./LandingPages/Main-Landing-Pages/Platform";
import { Events } from "./LandingPages/Main-Landing-Pages/Events";
import ProtectedRoute from "./ProtectedRoute";
import { ToastProvider } from "./context/ToastContext";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "./store";

const WorkspaceRedirect = () => {
  const { user } = useAppSelector((state) => state.user);
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth/signin" replace />;
};

const LegacyProfileRedirect = () => {
  const { username } = useParams<{ username: string }>();
  if (!username || username === "setup") {
    return <ProfilesOnboardingPage />;
  }
  return <Navigate to={`/profile/u/${encodeURIComponent(username)}`} replace />;
};

const SingleBlogParamRedirect = () => {
  const { pageId } = useParams<{ pageId: string }>();
  if (!pageId || pageId === 'overview') {
    return <Navigate to="/blog/aws-sbg-psit/aws-launchpad-2026" replace />;
  }
  return <Navigate to={`/blog/aws-sbg-psit/aws-launchpad-2026/${pageId}`} replace />;
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
          <Route path="/demo" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
          <Route path="/demo-profile" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/events" element={<EventTrackerPage />} />
          <Route path="/card" element={<Card />} />
          <Route path="/platforms" element={<Platform />} />
          <Route path="/orbit" element={<Platform />} />
          <Route path="/events-showcase" element={<Events />} />
          <Route path="/event-calendar" element={<Events />} />

          {/* Blog / Documentation Pages — /blog/hoster_name/blog_name/:pageId */}
          <Route path="/blog/:hoster/:blogName" element={<BlogLanding />} />
          <Route path="/blog/:hoster/:blogName/:pageId" element={<BlogLanding />} />

          {/* Blog Collection Hub Routes */}
          <Route path="/blogs" element={<BlogCollectionPage />} />
          <Route path="/blog" element={<BlogCollectionPage />} />
          <Route path="/blogs/:hoster/:blogName" element={<BlogLanding />} />
          <Route path="/blogs/:hoster/:blogName/:pageId" element={<BlogLanding />} />
          <Route path="/blog/:pageId" element={<SingleBlogParamRedirect />} />

          {/* Docs Routes */}
          <Route path="/docs" element={<Navigate to="/blog/aws-sbg-psit/aws-launchpad-2026" replace />} />
          <Route path="/docs/:pageId" element={<SingleBlogParamRedirect />} />

          {/* Public Shareable Profile Showcase Route */}
          <Route path="/profile/u/:username" element={<PublicProfilePage />} />
          <Route path="/profile/:username" element={<LegacyProfileRedirect />} />
          <Route path="/u/:username" element={<LegacyProfileRedirect />} />

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
            <Route path="/trends" element={<Dashboard />} />
            <Route path="/reports" element={<Dashboard />} />
            <Route path="/notifications" element={<Dashboard />} />
            <Route path="/inbox" element={<Dashboard />} />
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