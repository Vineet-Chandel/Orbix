import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// @ts-ignore
import { AppHeader } from './components/layout/AppHeader';
// @ts-ignore
import { Sidebar } from './components/layout/Sidebar';
// @ts-ignore
import { RightTableOfContents } from './components/layout/RightTableOfContents';
// @ts-ignore
import { ReadingProgress } from './components/ReadingProgress';
// @ts-ignore
import { DocumentSearch } from './components/DocumentSearch';
// @ts-ignore
import { BackToTop } from './components/BackToTop';
// @ts-ignore
import { FullWidthBottomBanner } from './components/layout/FullWidthBottomBanner';
// @ts-ignore
import { NeoButton } from './components/ui/NeoButton';

// Introduction Overview Page
// @ts-ignore
import { IntroductionPage, INTRODUCTION_HEADINGS } from './pages/IntroductionPage';

// Chapter 1 Pages
// @ts-ignore
import { DeploymentOverviewPage, PAGE_1_HEADINGS } from './pages/DeploymentOverviewPage';
// @ts-ignore
import { Ec2ArchitecturePage, PAGE_2_HEADINGS } from './pages/Ec2ArchitecturePage';
// @ts-ignore
import { AwsServicesPage, PAGE_3_HEADINGS } from './pages/AwsServicesPage';
// @ts-ignore
import { PreflightPage, PAGE_4_HEADINGS } from './pages/PreflightPage';

// Chapter 2 Pages
// @ts-ignore
import { InspectAndLaunchPage, DEPLOY_PAGE_1_HEADINGS } from './pages/step-by-step-deployment/InspectAndLaunchPage';
// @ts-ignore
import { NetworkingPage, DEPLOY_PAGE_2_HEADINGS } from './pages/step-by-step-deployment/NetworkingPage';
// @ts-ignore
import { ConnectAndInstallPage, DEPLOY_PAGE_3_HEADINGS } from './pages/step-by-step-deployment/ConnectAndInstallPage';
// @ts-ignore
import { DeployAndVerifyPage, DEPLOY_PAGE_4_HEADINGS } from './pages/step-by-step-deployment/DeployAndVerifyPage';

// Chapter 3 Pages
// @ts-ignore
import { VerificationChecklistPage, VERIFICATION_PAGE_HEADINGS } from './pages/VerificationChecklistPage';

// Chapter 4 Pages
// @ts-ignore
import { CommonErrorsPage, COMMON_ERRORS_PAGE_HEADINGS } from './pages/troubleshooting/CommonErrorsPage';
// @ts-ignore
import { DebuggingToolkitPage, DEBUGGING_TOOLKIT_HEADINGS } from './pages/troubleshooting/DebuggingToolkitPage';

// Chapter 5 Pages
// @ts-ignore
import { ProjectTwoPage, PROJECT_TWO_PAGE_HEADINGS } from './pages/independent-challenge/ProjectTwoPage';
// @ts-ignore
import { IndependentChecklistPage, INDEPENDENT_CHECKLIST_HEADINGS } from './pages/independent-challenge/IndependentChecklistPage';

// Chapter 6 Pages
// @ts-ignore
import { SecurityAndPermissionsPage, SECURITY_PAGE_HEADINGS } from './pages/SecurityAndPermissionsPage';

// Chapter 7 Pages
// @ts-ignore
import { CostAwarenessAndCleanupPage, COST_AND_CLEANUP_HEADINGS } from './pages/CostAwarenessAndCleanupPage';

// Chapter 8 Pages
// @ts-ignore
import { FurtherLearningResourcesPage, FURTHER_LEARNING_HEADINGS } from './pages/FurtherLearningResourcesPage';

// Chapter 9 Pages
// @ts-ignore
import { InstructorOrganiserChecklistPage, INSTRUCTOR_CHECKLIST_HEADINGS } from './pages/InstructorOrganiserChecklistPage';

// @ts-ignore
import { PlaceholderPage } from './pages/PlaceholderPage';
// @ts-ignore
import { useTheme } from './hooks/useTheme';

const VALID_PAGES = [
  'overview',
  'intro-deployment',
  'intro-ec2-architecture',
  'intro-aws-services',
  'intro-preflight',
  'deploy-inspect-and-launch',
  'deploy-networking',
  'deploy-connect-and-install',
  'deploy-and-verify',
  'verification-checklist',
  'troubleshoot-common-errors',
  'troubleshoot-debugging-toolkit',
  'challenge-project-two',
  'challenge-checklist',
  'security-and-permissions',
  'cost-and-cleanup',
  'further-learning',
  'instructor-checklist',
];

const BlogLanding: React.FC = () => {
  const { hoster, blogName, pageId } = useParams<{ hoster?: string; blogName?: string; pageId?: string }>();
  const navigate = useNavigate();

  // Normalize hoster and blogName slugs
  const hosterSlug = hoster ? encodeURIComponent(hoster.toLowerCase().trim().replace(/\s+/g, '-')) : 'aws-sbg-psit';
  const blogNameSlug = blogName ? encodeURIComponent(blogName.toLowerCase().trim().replace(/\s+/g, '-')) : 'aws-launchpad-2026';

  // Human-readable titles for display
  const displayHoster = hoster && hoster.toLowerCase() !== 'aws-sbg-psit'
    ? decodeURIComponent(hoster).replace(/-/g, ' ').toUpperCase()
    : 'AWS SBG PSIT';

  const displayBlogName = blogName && blogName.toLowerCase() !== 'aws-launchpad-2026'
    ? decodeURIComponent(blogName).replace(/-/g, ' ').toUpperCase()
    : 'AWS LAUNCHPAD 2026';

  // Determine active page from URL param (default to 'overview')
  const activePage = useMemo(() => {
    if (pageId && VALID_PAGES.includes(pageId)) {
      return pageId;
    }
    return 'overview';
  }, [pageId]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();

  // Clean up dark mode from root element when unmounting Blog to keep rest of Orbix clean
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  // Navigate using react-router with /blog/:hoster/:blogName pattern
  const handleNavigate = (targetPageId: string) => {
    const target = targetPageId || 'overview';
    if (target === 'overview') {
      navigate(`/blog/${hosterSlug}/${blogNameSlug}`);
    } else {
      navigate(`/blog/${hosterSlug}/${blogNameSlug}/${target}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine which page component and headings to render
  const { pageComponent, currentHeadings } = useMemo(() => {
    switch (activePage) {
      // Introduction: Workshop Overview
      case 'overview':
        return {
          pageComponent: <IntroductionPage onNavigate={handleNavigate} />,
          currentHeadings: INTRODUCTION_HEADINGS,
        };

      // Chapter 1: Introduction & Prerequisites
      case 'intro-deployment':
        return {
          pageComponent: <DeploymentOverviewPage onNavigate={handleNavigate} />,
          currentHeadings: PAGE_1_HEADINGS,
        };
      case 'intro-ec2-architecture':
        return {
          pageComponent: <Ec2ArchitecturePage onNavigate={handleNavigate} />,
          currentHeadings: PAGE_2_HEADINGS,
        };
      case 'intro-aws-services':
        return {
          pageComponent: <AwsServicesPage onNavigate={handleNavigate} />,
          currentHeadings: PAGE_3_HEADINGS,
        };
      case 'intro-preflight':
        return {
          pageComponent: <PreflightPage onNavigate={handleNavigate} />,
          currentHeadings: PAGE_4_HEADINGS,
        };

      // Chapter 2: Step-by-Step Deployment
      case 'deploy-inspect-and-launch':
        return {
          pageComponent: <InspectAndLaunchPage onNavigate={handleNavigate} />,
          currentHeadings: DEPLOY_PAGE_1_HEADINGS,
        };
      case 'deploy-networking':
        return {
          pageComponent: <NetworkingPage onNavigate={handleNavigate} />,
          currentHeadings: DEPLOY_PAGE_2_HEADINGS,
        };
      case 'deploy-connect-and-install':
        return {
          pageComponent: <ConnectAndInstallPage onNavigate={handleNavigate} />,
          currentHeadings: DEPLOY_PAGE_3_HEADINGS,
        };
      case 'deploy-and-verify':
        return {
          pageComponent: <DeployAndVerifyPage onNavigate={handleNavigate} />,
          currentHeadings: DEPLOY_PAGE_4_HEADINGS,
        };

      // Chapter 3: Verification Checklist
      case 'verification-checklist':
        return {
          pageComponent: <VerificationChecklistPage onNavigate={handleNavigate} />,
          currentHeadings: VERIFICATION_PAGE_HEADINGS,
        };

      // Chapter 4: Troubleshooting Guide
      case 'troubleshoot-common-errors':
        return {
          pageComponent: <CommonErrorsPage onNavigate={handleNavigate} />,
          currentHeadings: COMMON_ERRORS_PAGE_HEADINGS,
        };
      case 'troubleshoot-debugging-toolkit':
        return {
          pageComponent: <DebuggingToolkitPage onNavigate={handleNavigate} />,
          currentHeadings: DEBUGGING_TOOLKIT_HEADINGS,
        };

      // Chapter 5: Independent Deployment Challenge
      case 'challenge-project-two':
        return {
          pageComponent: <ProjectTwoPage onNavigate={handleNavigate} />,
          currentHeadings: PROJECT_TWO_PAGE_HEADINGS,
        };
      case 'challenge-checklist':
        return {
          pageComponent: <IndependentChecklistPage onNavigate={handleNavigate} />,
          currentHeadings: INDEPENDENT_CHECKLIST_HEADINGS,
        };

      // Chapter 6: Security and Permissions
      case 'security-and-permissions':
        return {
          pageComponent: <SecurityAndPermissionsPage onNavigate={handleNavigate} />,
          currentHeadings: SECURITY_PAGE_HEADINGS,
        };

      // Chapter 7: Cost Awareness and Resource Cleanup
      case 'cost-and-cleanup':
        return {
          pageComponent: <CostAwarenessAndCleanupPage onNavigate={handleNavigate} />,
          currentHeadings: COST_AND_CLEANUP_HEADINGS,
        };

      // Chapter 8: Further Learning Resources
      case 'further-learning':
        return {
          pageComponent: <FurtherLearningResourcesPage onNavigate={handleNavigate} />,
          currentHeadings: FURTHER_LEARNING_HEADINGS,
        };

      // Chapter 9: Instructor and Organiser Checklist
      case 'instructor-checklist':
        return {
          pageComponent: <InstructorOrganiserChecklistPage onNavigate={handleNavigate} />,
          currentHeadings: INSTRUCTOR_CHECKLIST_HEADINGS,
        };

      default:
        return {
          pageComponent: <PlaceholderPage pageId={activePage} onNavigate={handleNavigate} />,
          currentHeadings: [],
        };
    }
  }, [activePage]);

  return (
    <div className="blog-container min-h-screen neo-grid-bg text-black dark:text-zinc-100 flex flex-col font-sans transition-colors duration-150">
      {/* Sticky Top Header */}
      <AppHeader
        onToggleSidebar={() => setIsSidebarOpen((prev: boolean) => !prev)}
        isSidebarOpen={isSidebarOpen}
        onOpenSearch={() => setIsSearchOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigateHome={() => handleNavigate('overview')}
        hoster={displayHoster}
        blogName={displayBlogName}
      />

      {/* Reading Progress Indicator */}
      <ReadingProgress />

      {/* Main 3-Column Documentation Container - spans 100% full screen width */}
      <div className="flex-1 flex w-full">
        {/* Column 1: Left Global Navigation Sidebar */}
        <Sidebar
          activePage={activePage}
          onSelectPage={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Column 2: Central Documentation Reading Surface */}
        <main className="flex-1 min-w-0 lg:pl-64 xl:pl-72 transition-all duration-150">
          <div className="flex flex-col min-h-full">
            <div className="w-full">
              {pageComponent}
            </div>

            {/* Full Screen Width Bottom Banner */}
            <FullWidthBottomBanner onNavigate={handleNavigate} />

            {/* Document Article Footer */}
            <footer className="w-full px-4 sm:px-8 py-6 mt-auto border-t-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[0_-2px_0px_#000000] text-xs font-mono text-black dark:text-zinc-300 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#a6ff70] border border-black inline-block" />
                <span className="font-bold text-black dark:text-white uppercase tracking-wider">
                  {displayBlogName}
                </span>
                <span>•</span>
                <span className="text-slate-600 dark:text-zinc-400">Hosted by {displayHoster}</span>
              </div>
              <div className="flex items-center gap-4">
                <NeoButton
                  variant="lime"
                  size="sm"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Return to top ↑
                </NeoButton>
              </div>
            </footer>
          </div>
        </main>

        {/* Column 3: Right "On this page" Local Table of Contents */}
        {currentHeadings.length > 0 && (
          <RightTableOfContents headings={currentHeadings} />
        )}
      </div>

      {/* Floating Back-to-Top Control */}
      <BackToTop />

      {/* Full-text Search Modal */}
      <DocumentSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(item: { pageId?: string }) => {
          if (item.pageId) {
            handleNavigate(item.pageId);
          }
        }}
      />
    </div>
  );
};

export default BlogLanding;
