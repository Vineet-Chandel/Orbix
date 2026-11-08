import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import MainLanding from "./LandingPages/Main-Landing-Pages/Landing";
import ProtectedRoute from "./ProtectedRoute";
import { ToastProvider } from "./context/ToastContext";
import { OrbixLoadingProvider, OrbixLoader } from "./components/ui/loader";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "./store";

// Code-split other routes & showcases to keep initial homepage bundle ultra-lean
const SignInPage = lazy(() => import('./LandingPages/Auth-Pages/Signin/Landing'));
const SignUpPage = lazy(() => import('./LandingPages/Auth-Pages/Signup/Landing'));
const OAuthCallbackPage = lazy(() => import('./LandingPages/Auth-Pages/OAuthCallbackPage'));
const CustomersPage = lazy(() => import("./LandingPages/Customers/Landing"));
const PricingPage = lazy(() => import("./LandingPages/Pricing/Landing"));
const SupportPage = lazy(() => import("./LandingPages/Support/Landing"));
const PlatformPage = lazy(() => import("./LandingPages/Platform/Landing"));
const BlogLanding = lazy(() => import("./LandingPages/Blog/Landing"));
const BlogCollectionPage = lazy(() => import("./LandingPages/Blog/BlogCollectionPage"));
const DocsHubPage = lazy(() => import("./LandingPages/Docs/DocsHubPage"));
const DocsViewerPage = lazy(() => import("./LandingPages/Docs/DocsViewerPage"));
const Dashboard = lazy(() => import("./app/Dashboard/Landing"));
const ProfileManager = lazy(() => import("./app/Profile/ProfileManager"));
const SettingsPage = lazy(() => import("./app/Settings/SettingsPage"));
const PublicProfilePage = lazy(() => import("./app/Profile/PublicProfilePage"));
const ProfilesOnboardingPage = lazy(() => import("./LandingPages/Auth-Pages/ProfilesOnboarding/ProfilesOnboardingPage"));
const LeaderboardPage = lazy(() => import("./app/Leaderboard/LeaderboardPage"));
const EventTrackerPage = lazy(() => import("./app/Events/EventTrackerPage"));
const Card = lazy(() => import("./LandingPages/Main-Landing-Pages/Card").then(m => ({ default: m.Card })));
const Platform = lazy(() => import("./LandingPages/Main-Landing-Pages/Platform").then(m => ({ default: m.Platform })));
const Events = lazy(() => import("./LandingPages/Main-Landing-Pages/Events").then(m => ({ default: m.Events })));
const ClubStatusPage = lazy(() => import("./app/Club/ClubStatusPage"));
const ClubReviewerQueuePage = lazy(() => import("./app/Club/ClubReviewerQueuePage"));
const ClubDashboardPage = lazy(() => import("./app/Club/ClubDashboardPage"));
const PublicClubProfilePage = lazy(() => import("./app/Club/PublicClubProfilePage"));
const PrivacyPolicyPage = lazy(() => import("./LandingPages/Legal/PrivacyPolicyPage"));
const TermsConditionsPage = lazy(() => import("./LandingPages/Legal/TermsConditionsPage"));
const GuardianConsentPage = lazy(() => import("./LandingPages/Legal/GuardianConsentPage"));
const PublicEventRegistrationPage = lazy(() => import("./app/Events/PublicEventRegistrationPage"));

const WorkspaceRedirect = () => {
  const { user } = useAppSelector((state) => state.user);
  if (!user) return <Navigate to="/auth/signin" replace />;
  if (user.accountType === "club") {
    if (user.clubStatus === "approved" || user.verifiedClub) {
      return <Navigate to="/club/dashboard" replace />;
    }
    return <Navigate to="/club/status" replace />;
  }
  return <Navigate to="/dashboard" replace />;
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
    <OrbixLoadingProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center text-black">
                <OrbixLoader size="lg" />
              </div>
            }
          >
            <Routes>
          {/* Public Landing & Marketing Pages */}
          <Route path="/" element={<MainLanding />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/support" element={<SupportPage />} />

          {/* Legal & Minor Attendee Consent Routes */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
          <Route path="/terms" element={<TermsConditionsPage />} />
          <Route path="/terms-and-conditions" element={<Navigate to="/terms" replace />} />
          <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
          <Route path="/events/guardian-consent" element={<GuardianConsentPage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/demo" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
          <Route path="/demo-profile" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/events" element={<EventTrackerPage />} />
          <Route path="/events/:eventId/register" element={<PublicEventRegistrationPage />} />
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
          <Route path="/docs" element={<DocsHubPage />} />
          <Route path="/docs/algorithm" element={<DocsViewerPage />} />
          <Route path="/docs/:slug" element={<DocsViewerPage />} />
          <Route path="/docs/:folderId/:docId" element={<DocsViewerPage />} />

          {/* Public Shareable Profile Showcase Route */}
          <Route path="/profile/u/:username" element={<PublicProfilePage />} />
          <Route path="/profile/:username" element={<LegacyProfileRedirect />} />
          <Route path="/u/:username" element={<LegacyProfileRedirect />} />

          {/* Auth Pages */}
          <Route path="/auth/signup" element={<SignUpPage />} />
          <Route path="/auth/signin" element={<SignInPage />} />
          <Route path="/auth/forgot-password" element={<Navigate to="/auth/signin?view=forgot-password" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/auth/signin?view=forgot-password" replace />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/login" element={<Navigate to="/auth/signin" replace />} />
          <Route path="/workspace" element={<WorkspaceRedirect />} />

          {/* Club Verification, Dedicated Dashboard & Public Presence */}
          <Route path="/club/status" element={<ClubStatusPage />} />
          <Route path="/clubs/status" element={<Navigate to="/club/status" replace />} />
          <Route path="/club" element={<Navigate to="/club/dashboard" replace />} />
          <Route path="/club/dashboard" element={<ClubDashboardPage />} />
          <Route path="/club/team" element={<ClubDashboardPage />} />
          <Route path="/club/events" element={<ClubDashboardPage />} />
          <Route path="/club/events/:eventId" element={<ClubDashboardPage />} />
          <Route path="/club/events/:eventId/checkin" element={<ClubDashboardPage />} />
          <Route path="/club/analytics" element={<ClubDashboardPage />} />
          <Route path="/club/trends" element={<Navigate to="/club/analytics" replace />} />
          <Route path="/club/certificates" element={<ClubDashboardPage />} />
          <Route path="/club/credibility" element={<Navigate to="/club/dashboard" replace />} />
          <Route path="/club/profile" element={<ClubDashboardPage />} />
          <Route path="/club/manage-profile" element={<Navigate to="/club/profile" replace />} />
          <Route path="/club/clubs" element={<ClubDashboardPage />} />
          <Route path="/club/campus-clubs" element={<Navigate to="/club/clubs" replace />} />
          <Route path="/club/other-clubs" element={<Navigate to="/club/clubs" replace />} />
          <Route path="/club/settings" element={<ClubDashboardPage />} />
          <Route path="/club/inbox" element={<ClubDashboardPage />} />
          <Route path="/clubs/:slug" element={<PublicClubProfilePage />} />
          <Route path="/staff/club-reviews" element={<ClubReviewerQueuePage />} />

          {/* New User Onboarding & Profiles Links Setup */}
          <Route path="/onboarding" element={<ProfilesOnboardingPage />} />
          <Route path="/auth/profiles" element={<ProfilesOnboardingPage />} />
          <Route path="/profile/setup" element={<ProfilesOnboardingPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clubs" element={<Dashboard />} />
            <Route path="/college-events" element={<Dashboard />} />
            <Route path="/activity" element={<Dashboard />} />
            <Route path="/applications" element={<Dashboard />} />
            <Route path="/explore" element={<Dashboard />} />
            <Route path="/trends" element={<Dashboard />} />
            <Route path="/reports" element={<Dashboard />} />
            <Route path="/notifications" element={<Dashboard />} />
            <Route path="/inbox" element={<Dashboard />} />
            <Route path="/profile" element={<ProfileManager />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/resume" element={<Dashboard />} />
            <Route path="/projects" element={<Dashboard />} />
          </Route>
        </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </OrbixLoadingProvider>
  );
};

export default App;