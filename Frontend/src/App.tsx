import { initialSeoData } from "./seo/client";
import { StandaloneShowcase } from "./seo/StandaloneShowcase";
import { RouteSeo } from "./seo/RouteSeo";
import { useEffect, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import MainLanding from "./LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Landing";

import ProtectedRoute, { ClubProtectedRoute } from "./ProtectedRoute";
import { ToastProvider } from "./context/ToastContext";
import {
  OrbixLoadingProvider,
  OrbixInitialLoader,
  DashboardRouteSkeleton,
  DocsRouteSkeleton,
  ContentRouteSkeleton,
  AuthRouteSkeleton,
} from "./components/ui/loader";
import { OrbixErrorBoundary } from "./components/ui/error/OrbixErrorBoundary";
import { OrbixOfflineBanner } from "./components/ui/network/OrbixOfflineBanner";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "./store";
import { ScrollToTop } from "./components/ScrollToTop";
import NotFoundPage from "./pages/NotFoundPage";

const AnnouncementPermalinkPage = lazyWithRetry(() => import("./app/Club/Announcements/AnnouncementPermalinkPage"));
const MemberAnnouncementsPage = lazyWithRetry(() => import("./app/Club/Announcements/MemberAnnouncementsPage"));

const ClubLanding = lazyWithRetry(() => import("./LandingPages/Main-Landing-Pages/Club-Account-Landing-Pages/Landing"));

// Code-split other routes & showcases with resilient retry logic
const SignInPage = lazyWithRetry(() => import('./LandingPages/Auth-Pages/Signin/Landing'));
const SignUpPage = lazyWithRetry(() => import('./LandingPages/Auth-Pages/Signup/Landing'));
const OAuthCallbackPage = lazyWithRetry(() => import('./LandingPages/Auth-Pages/OAuthCallbackPage'));
const CustomersPage = lazyWithRetry(() => import("./LandingPages/Customers/Landing"));
const PricingPage = lazyWithRetry(() => import("./LandingPages/Pricing/Landing"));
const PlatformPage = lazyWithRetry(() => import("./LandingPages/Platform/Landing"));
const BlogLanding = lazyWithRetry(() => import("./LandingPages/Blog/Landing"));
const BlogCollectionPage = lazyWithRetry(() => import("./LandingPages/Blog/BlogCollectionPage"));
const DocsHubPage = lazyWithRetry(() => import("./LandingPages/Docs/DocsHubPage"));
const DocsViewerPage = lazyWithRetry(() => import("./LandingPages/Docs/DocsViewerPage"));
const Dashboard = lazyWithRetry(() => import("./app/Dashboard/Landing"));
const ProfileManager = lazyWithRetry(() => import("./app/Profile/ProfileManager"));
const SettingsPage = lazyWithRetry(() => import("./app/Settings/SettingsPage"));
const PublicProfilePage = lazyWithRetry(() => import("./app/Profile/PublicProfilePage"));
const CollegeOnboardingPage = lazyWithRetry(() => import("./LandingPages/Auth-Pages/CollegeOnboarding/CollegeOnboardingPage"));
const ProfilesOnboardingPage = lazyWithRetry(() => import("./LandingPages/Auth-Pages/ProfilesOnboarding/ProfilesOnboardingPage"));
const LeaderboardPage = lazyWithRetry(() => import("./app/Leaderboard/LeaderboardPage"));
const EventsIndex = lazyWithRetry(() => import("./seo/EventsIndex"));
const PublicEventPage = lazyWithRetry(() => import("./seo/PublicEventPage"));
const AboutPage = lazyWithRetry(() => import("./seo/PublicAnswers"));
const Card = lazyWithRetry(() => import("./LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Card").then(m => ({ default: m.Card })));
const Platform = lazyWithRetry(() => import("./LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Platform").then(m => ({ default: m.Platform })));
const Events = lazyWithRetry(() => import("./LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Events").then(m => ({ default: m.Events })));
const ClubStatusPage = lazyWithRetry(() => import("./app/Club/ClubStatusPage"));
const ClubReviewerQueuePage = lazyWithRetry(() => import("./app/Club/ClubReviewerQueuePage"));
const ClubDashboardPage = lazyWithRetry(() => import("./app/Club/ClubDashboardPage"));
const PublicClubProfilePage = lazyWithRetry(() => import("./app/Club/PublicClubProfilePage"));
const PrivacyPolicyPage = lazyWithRetry(() => import("./LandingPages/Legal/PrivacyPolicyPage"));
const TermsConditionsPage = lazyWithRetry(() => import("./LandingPages/Legal/TermsConditionsPage"));
const GuardianConsentPage = lazyWithRetry(() => import("./LandingPages/Legal/GuardianConsentPage"));
const PublicEventRegistrationPage = lazyWithRetry(() => import("./app/Events/PublicEventRegistrationPage"));
const PublicCertificateVerifyPage = lazyWithRetry(() => import("./app/Certificates/PublicCertificateVerifyPage"));
const JoinClubPage = lazyWithRetry(() => import("./app/Club/JoinClubPage"));

const WorkspaceRedirect = () => {
  const { user, isAuthenticated, loading } = useAppSelector((state) => state.user);
  const isOnline = typeof navigator === "undefined" || navigator.onLine;

  if (loading) {
    return (
      <OrbixInitialLoader
        message="Verifying session…"
        subMessage="Connecting to your workspace"
      />
    );
  }

  if (!isAuthenticated || !user || !isOnline) {
    return <Navigate to="/auth/signin" replace />;
  }

  if (user.accountType === "club") {
    if (user.clubStatus === "approved" || user.verifiedClub) {
      return <Navigate to="/club/dashboard" replace />;
    }
    return <Navigate to="/club/status" replace />;
  }
  return <Dashboard />;
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

const LegacyActivityRedirect = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (!params.has("tab") && !params.has("segment")) {
    params.set("tab", "applications");
  }
  return <Navigate to={`/activity?${params.toString()}`} replace />;
};

const PublicClubRoute = () => {
  const location = useLocation();
  return <PublicClubProfilePage initialClubData={initialSeoData(location.pathname)?.entity?.club} />;
};

const App = () => {
  const dispatch = useAppDispatch();

  // Fetch /profile/me on app load/refresh to sync Redux with active session
  useEffect(() => {
    try {
      if (localStorage.getItem("orbix_signed_out")) return;
    } catch { /* Verify the session normally when storage is unavailable. */ }

    if (typeof navigator === "undefined" || navigator.onLine) {
      dispatch(fetchUserProfile());
    }

    const handleOnline = () => {
      try {
        if (!localStorage.getItem("orbix_signed_out") && localStorage.getItem("orbix_token")) {
          dispatch(fetchUserProfile({ force: true }));
        }
      } catch {
        dispatch(fetchUserProfile({ force: true }));
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [dispatch]);

  return (
    <OrbixLoadingProvider>
      <ToastProvider>
        <BrowserRouter>
          {/* Universal automatic scroll restoration on route navigation */}
          <ScrollToTop />
          <RouteSeo />

          {/* Global Network Connectivity Status Banner */}
          <OrbixOfflineBanner />

          <OrbixErrorBoundary level="route">
            <Suspense fallback={<ContentRouteSkeleton />}>
              <Routes>
                {/* Public Landing & Marketing Pages */}
                <Route path="/" element={<MainLanding />} />
                <Route path="/clubs" element={<ClubLanding />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/pricing" element={<PricingPage />} />

                {/* Legal & Minor Attendee Consent Routes */}
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
                <Route path="/terms" element={<TermsConditionsPage />} />
                <Route path="/terms-and-conditions" element={<Navigate to="/terms" replace />} />
                <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
                <Route path="/events/guardian-consent" element={<GuardianConsentPage />} />
                <Route path="/platform" element={<PlatformPage />} />
                <Route path="/demo" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
                <Route path="/demo/profile" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
                <Route path="/demo-profile" element={<Navigate to="/profile/u/Vineet-Chandel" replace />} />
                <Route path="/demo/club" element={<Navigate to="/clubs/aws-swg-psit" replace />} />
                <Route path="/demo-club" element={<Navigate to="/clubs/aws-swg-psit" replace />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/events" element={<EventsIndex />} />
                <Route path="/events/:eventId" element={<PublicEventPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/events/:eventId/register" element={<PublicEventRegistrationPage />} />
                <Route path="/card" element={<StandaloneShowcase path="/card"><Card /></StandaloneShowcase>} />
                <Route path="/platforms" element={<StandaloneShowcase path="/platforms"><Platform /></StandaloneShowcase>} />
                <Route path="/orbit" element={<Platform />} />
                <Route path="/events-showcase" element={<StandaloneShowcase path="/events-showcase"><Events /></StandaloneShowcase>} />
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
                <Route path="/docs" element={<Suspense fallback={<DocsRouteSkeleton />}><DocsHubPage /></Suspense>} />
                <Route path="/docs/algorithm" element={<Suspense fallback={<DocsRouteSkeleton />}><DocsViewerPage /></Suspense>} />
                <Route path="/docs/:slug" element={<Suspense fallback={<DocsRouteSkeleton />}><DocsViewerPage /></Suspense>} />
                <Route path="/docs/:folderId/:docId" element={<Suspense fallback={<DocsRouteSkeleton />}><DocsViewerPage /></Suspense>} />

                {/* Public Shareable Profile Showcase Route */}
                <Route path="/profile/u/:username" element={<PublicProfilePage />} />
                <Route path="/profile/:username" element={<LegacyProfileRedirect />} />
                <Route path="/u/:username" element={<LegacyProfileRedirect />} />

                {/* Public Certificate Verification Routes */}
                <Route path="/verify/certificate/:credentialCode" element={<PublicCertificateVerifyPage />} />
                <Route path="/verify-cert/:credentialCode" element={<PublicCertificateVerifyPage />} />
                <Route path="/verify/:credentialCode" element={<PublicCertificateVerifyPage />} />
                <Route path="/verify" element={<PublicCertificateVerifyPage />} />

                {/* Auth Pages */}
                <Route path="/auth/signup" element={<Suspense fallback={<AuthRouteSkeleton />}><SignUpPage /></Suspense>} />
                <Route path="/auth/signin" element={<Suspense fallback={<AuthRouteSkeleton />}><SignInPage /></Suspense>} />
                <Route path="/auth/forgot-password" element={<Navigate to="/auth/signin?view=forgot-password" replace />} />
                <Route path="/forgot-password" element={<Navigate to="/auth/signin?view=forgot-password" replace />} />
                <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                <Route path="/login" element={<Navigate to="/auth/signin" replace />} />
                <Route path="/workspace" element={<WorkspaceRedirect />} />

                {/* Legacy Activity, Tracker & Invitation Redirects */}
                <Route path="/student/activity" element={<LegacyActivityRedirect />} />
                <Route path="/events/tracker" element={<LegacyActivityRedirect />} />
                <Route path="/workspace-invite" element={<JoinClubPage />} />

                {/* Club Verification, Dedicated Dashboard & Public Presence */}
                <Route path="/club/team-workspace/join" element={<JoinClubPage />} />
                <Route path="/join-club" element={<JoinClubPage />} />
                <Route path="/club/join" element={<JoinClubPage />} />
                <Route element={<Suspense fallback={<DashboardRouteSkeleton showSidebar />}><ClubProtectedRoute /></Suspense>}>
                  <Route path="/club/status" element={<ClubStatusPage />} />
                  <Route path="/clubs/status" element={<Navigate to="/club/status" replace />} />
                  <Route path="/club" element={<Navigate to="/club/dashboard" replace />} />
                  <Route path="/club/dashboard" element={<ClubDashboardPage />} />
                  <Route path="/club/team" element={<ClubDashboardPage />} />
                  <Route path="/club/team-workspace" element={<ClubDashboardPage />} />
                  <Route path="/club/recruitment" element={<ClubDashboardPage />} />
                  <Route path="/club/events" element={<ClubDashboardPage />} />
                  <Route path="/club/events/:eventId" element={<ClubDashboardPage />} />
                  <Route path="/club/events/:eventId/checkin" element={<ClubDashboardPage />} />
                  <Route path="/club/analytics" element={<ClubDashboardPage />} />
                  <Route path="/club/trends" element={<Navigate to="/club/analytics" replace />} />
                  <Route path="/club/certificates" element={<ClubDashboardPage />} />
                  <Route path="/club/feedback-surveys" element={<ClubDashboardPage />} />
                  <Route path="/club/announcements" element={<ClubDashboardPage />} />
                  <Route path="/club/credibility" element={<Navigate to="/club/dashboard" replace />} />
                  <Route path="/club/profile" element={<ClubDashboardPage />} />
                  <Route path="/club/manage-profile" element={<Navigate to="/club/profile" replace />} />
                  <Route path="/club/clubs" element={<ClubDashboardPage />} />
                  <Route path="/club/campus-clubs" element={<Navigate to="/club/clubs" replace />} />
                  <Route path="/club/other-clubs" element={<Navigate to="/club/clubs" replace />} />
                  <Route path="/club/settings" element={<ClubDashboardPage />} />
                  <Route path="/club/inbox" element={<ClubDashboardPage />} />
                </Route>
                <Route path="/announcements/:announcementId" element={<AnnouncementPermalinkPage />} />
                <Route path="/clubs/:slug" element={<PublicClubRoute />} />
                <Route path="/staff/club-reviews" element={<ClubReviewerQueuePage />} />

                {/* New User Onboarding & Profiles Links Setup */}
                <Route path="/onboarding/college" element={<CollegeOnboardingPage />} />
                <Route path="/onboarding" element={<ProfilesOnboardingPage />} />
                <Route path="/auth/profiles" element={<ProfilesOnboardingPage />} />
                <Route path="/profile/setup" element={<ProfilesOnboardingPage />} />

                {/* Protected Routes */}
                <Route element={<Suspense fallback={<DashboardRouteSkeleton showSidebar />}><ProtectedRoute /></Suspense>}>
                  <Route path="/club-announcements" element={<MemberAnnouncementsPage />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/college-clubs" element={<Dashboard />} />
                  <Route path="/campus-clubs" element={<Dashboard />} />
                  <Route path="/college-events" element={<Dashboard />} />
                  <Route path="/college-events/:eventId" element={<Dashboard />} />
                  <Route path="/college-events/:eventId/:slug" element={<Dashboard />} />
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
                  <Route path="/wallet" element={<Navigate to="/activity?tab=certificates" replace />} />
                  <Route path="/certificates" element={<Navigate to="/activity?tab=certificates" replace />} />
                  <Route path="/workspace" element={<Dashboard />} />
                  <Route path="/workspace/:clubId" element={<Dashboard />} />
                  <Route path="/workspace/:clubId/:section" element={<Dashboard />} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </OrbixErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </OrbixLoadingProvider>
  );
};

export default App;
