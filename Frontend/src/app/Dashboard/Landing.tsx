import { lazyWithRetry } from "../../utils/lazyWithRetry";
import { DashboardRouteSkeleton } from "../../components/ui/loader";
import { useState, useEffect, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Code2, GitBranch, GraduationCap, Sparkles } from "lucide-react";
import { useAppSelector } from "../../store";
import { NotificationBell } from "../../components/NotificationBell";
import { Sidebar, type SidebarTab } from "./Sidebar";
const CodingSubmissionsTable = lazyWithRetry(() => import("./CodingSubmissionsTable").then((m) => ({ default: m.CodingSubmissionsTable })));
const DevelopmentContributionsTable = lazyWithRetry(() => import("./DevelopmentContributionsTable").then((m) => ({ default: m.DevelopmentContributionsTable })));
const ContestPerformanceSection = lazyWithRetry(() => import("./ContestPerformanceSection").then((m) => ({ default: m.ContestPerformanceSection })));
const PracticeAnalyticsSection = lazyWithRetry(() => import("./PracticeAnalytics/PracticeAnalyticsSection").then((m) => ({ default: m.PracticeAnalyticsSection })));
const DevelopmentAnalyticsSection = lazyWithRetry(() => import("./DevelopmentAnalytics/DevelopmentAnalyticsSection").then((m) => ({ default: m.DevelopmentAnalyticsSection })));
const NotificationsView = lazyWithRetry(() => import("../Notifications/NotificationsView").then((m) => ({ default: m.NotificationsView })));
const TrendsView = lazyWithRetry(() => import("../Trends/TrendsView").then((m) => ({ default: m.TrendsView })));
const ResumeManager = lazyWithRetry(() => import("../Resume/ResumeManager").then((m) => ({ default: m.ResumeManager })));
const ExploreView = lazyWithRetry(() => import("../Explore/ExploreView").then((m) => ({ default: m.ExploreView })));
const StudentCampusClubsView = lazyWithRetry(() => import("../Club/CollegeClubs/StudentCampusClubsView").then((m) => ({ default: m.StudentCampusClubsView })));
const CollegeEventsView = lazyWithRetry(() => import("../Events/CollegeEventsView").then((m) => ({ default: m.CollegeEventsView })));
const StudentActivityView = lazyWithRetry(() => import("../Events/StudentActivityView").then((m) => ({ default: m.StudentActivityView })));
const ProjectsManagementView = lazyWithRetry(() => import("../Projects/ProjectsManagementView").then((m) => ({ default: m.ProjectsManagementView })));
const MemberWorkspaceView = lazyWithRetry(() => import("../Club/TeamWorkspace/MemberWorkspaceView").then((m) => ({ default: m.MemberWorkspaceView })));
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";

export default function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAppSelector((state) => state.user);

    // Determine initial active tab based on pathname
    const getTabFromPath = (path: string): SidebarTab => {
        if (path.includes("/college-clubs") || path.includes("/campus-clubs") || path === "/clubs" || path.startsWith("/clubs")) return "clubs";
        if (path.includes("/college-events") || path.includes("/college-event")) return "college-events";
        if (
            path.includes("/activity") ||
            path.includes("/applications") ||
            path.includes("/application") ||
            path.includes("/wallet") ||
            path.includes("/certificates") ||
            path.includes("/certificate")
        ) return "activity";
        if (path.includes("/explore")) return "explore";
        if (path.includes("/trends") || path.includes("/reports")) return "trends";
        if (path.includes("/notifications") || path.includes("/inbox")) return "notifications";
        if (path.includes("/profile")) return "profile";
        if (path.includes("/resume")) return "resume";
        if (path.includes("/projects")) return "projects";
        if (path.includes("/blogs") || path.includes("/blog")) return "blogs";
        if (path.includes("/docs")) return "docs";
        if (path.includes("/onboarding") || path.includes("/connect")) return "connect-platform";
        if (path.includes("/leaderboard")) return "leaderboard";
        if (path.startsWith("/workspace")) return "workspace" as SidebarTab;
        return "dashboard";
    };

    const [activeTab, setActiveTab] = useState<SidebarTab>(() => getTabFromPath(location.pathname));
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [activeDashboardField, setActiveDashboardField] = useState<"practice" | "development">("practice");

    useEffect(() => {
        setActiveTab(getTabFromPath(location.pathname));
        if (location.pathname === "/wallet" || location.pathname === "/certificates") {
            navigate("/activity?tab=certificates", { replace: true });
        }
    }, [location.pathname, navigate]);


    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Developer";

    const [connectedPortals, setConnectedPortals] = useState<Record<string, any>>(() => {
        try {
            const raw = localStorage.getItem("orbix_connected_portals");
            if (raw) return JSON.parse(raw);
        } catch { }
        return {};
    });

    // Synchronize connectedPortals from user.platforms when loaded from server
    useEffect(() => {
        if (user?.platforms && Array.isArray(user.platforms) && user.platforms.length > 0) {
            setConnectedPortals((prev) => {
                const next = { ...prev };
                let hasChanges = false;
                for (const p of user.platforms!) {
                    const k = (p.portal || "").toLowerCase().trim();
                    if (!k) continue;
                    const handle = (p.portalUsername || p.portal_username || p.username || "").trim();
                    const ownershipStatus = p.ownershipStatus || p.ownership_status || "CONNECTED_UNVERIFIED";
                    if (!next[k] || !next[k].username || next[k].username !== handle || next[k].ownershipStatus !== ownershipStatus || next[k].verificationMethod !== (p.verificationMethod || p.verification_method || null)) {
                        next[k] = {
                            ...(prev[k] || {}),
                            portal: k,
                            username: handle,
                            profileUrl: p.link || p.profileUrl || prev[k]?.profileUrl || "",
                            verified: ownershipStatus === "VERIFIED",
                            ownershipStatus,
                            verificationMethod: p.verificationMethod || p.verification_method || null,
                            verifiedAt: p.verifiedAt || p.verified_at || null,
                            displayName: p.displayName || p.display_name || handle,
                            avatarUrl: p.avatarUrl || p.avatar_url || prev[k]?.avatarUrl,
                            stats: p.stats || prev[k]?.stats,
                            syncStatus: p.lastSyncStatus || p.syncStatus || prev[k]?.syncStatus || "valid",
                            lastSyncAt: p.lastSyncAt || p.last_sync_at || prev[k]?.lastSyncAt,
                        };
                        hasChanges = true;
                    }
                }
                if (hasChanges) {
                    try {
                        localStorage.setItem("orbix_connected_portals", JSON.stringify(next));
                    } catch { }
                    return next;
                }
                return prev;
            });
        }
    }, [user?.platforms]);

    useEffect(() => {
        const handleSync = () => {
            try {
                const raw = localStorage.getItem("orbix_connected_portals");
                setConnectedPortals(raw ? JSON.parse(raw) : {});
            } catch {
                setConnectedPortals({});
            }
        };

        window.addEventListener("orbix_portals_updated", handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            window.removeEventListener("orbix_portals_updated", handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, []);

    // Formatting date matching the Prodexa screenshot ("Today, 20 January 2029")
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    return (
        <div className="flex h-screen w-full max-w-full min-w-0 bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Left Sidebar (Neo-Brutalist floating sidebar) */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                    setActiveTab(tab);
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "clubs") navigate("/college-clubs");
                    if (tab === "college-events") navigate("/college-events");
                    if (tab === "activity" || tab === "applications") navigate("/activity");
                    if (tab === "wallet" || tab === "certificates") navigate("/activity?tab=certificates");
                    if (tab === "explore") navigate("/explore");
                    if (tab === "trends") navigate("/trends");
                    if (tab === "notifications") navigate("/notifications");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                    if (tab === "leaderboard") navigate("/leaderboard");
                    if (tab === "connect-platform") navigate("/onboarding");
                    if (tab === ("workspace" as any)) navigate("/workspace");
                }}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0 w-full max-w-full p-2 sm:p-3 lg:p-3">
                <Suspense fallback={<DashboardRouteSkeleton />}>
                {activeTab === "college-events" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <CollegeEventsView />
                    </div>
                ) : activeTab === "activity" || activeTab === "applications" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <StudentActivityView />
                    </div>
                ) : activeTab === "clubs" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <StudentCampusClubsView />
                    </div>
                ) : activeTab === "explore" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ExploreView />
                    </div>
                ) : activeTab === "resume" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ResumeManager />
                    </div>
                ) : activeTab === "notifications" ? (
                    <section
                        aria-label="Orbix Inbox"
                        className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                    >
                        <div className="p-4 sm:p-6 lg:p-8 pb-32 sm:pb-32 lg:pb-8 flex-1 space-y-6">
                            <NotificationsView />
                        </div>
                        <SectionBottomIllustration alt="Notifications illustration" />
                    </section>
                ) : activeTab === "trends" ? (
                    <section
                        aria-label="Orbix Trends"
                        className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                    >
                        <div className="p-4 sm:p-6 lg:p-8 pb-32 sm:pb-32 lg:pb-8 flex-1 space-y-6">
                            <TrendsView
                                connectedPortals={connectedPortals}
                                username={user?.username || ""}
                            />
                        </div>
                        <SectionBottomIllustration alt="Trends illustration" />
                    </section>
                ) : activeTab === "projects" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ProjectsManagementView />
                    </div>
                ) : activeTab === ("workspace" as any) || location.pathname.startsWith("/workspace") ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <MemberWorkspaceView />
                    </div>
                ) : (
                    /* Default Dashboard View (Practice vs Development) */
                    <section
                        aria-label="Orbix Developer Dashboard"
                        className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                    >
                        <div className="p-4 sm:p-6 lg:p-8 pb-32 sm:pb-32 lg:pb-8 flex-1 space-y-6">
                            {/* Dashboard Header Bar */}
                            <div className="pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Left: Welcome Greeting */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <div className="orbix-page-heading-icon p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                            <Sparkles className="w-5 h-5 text-black stroke-[2.5]" />
                                        </div>
                                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight truncate">
                                            Welcome, {displayName}!
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                            Today, {formattedDate}
                                        </span>
                                        {user?.college?.officialName && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#a2ff86] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                                <GraduationCap className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                <span>{user.college.officialName}</span>
                                            </span>
                                        )}
                                        <span className="text-xs font-bold text-neutral-700 hidden sm:inline">
                                            · Unified Developer Command Center
                                        </span>
                                    </div>
                                </div>

                                {/* Right: Practice/Development Switcher + Search + Profile/Bell */}
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Practice & Development Segmented Switcher */}
                                    <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDashboardField("practice")}
                                            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                                                activeDashboardField === "practice"
                                                    ? "bg-black text-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                            }`}
                                        >
                                            <Code2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            <span>Practice</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setActiveDashboardField("development")}
                                            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                                                activeDashboardField === "development"
                                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                            }`}
                                        >
                                            <GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            <span>Development</span>
                                        </button>
                                    </div>

                                    {/* Notification Bell */}
                                    <NotificationBell variant="neo" />
                                </div>
                            </div>

                            {/* PRACTICE VIEW */}
                            {activeDashboardField === "practice" && (
                                <div className="w-full space-y-6 animate-in fade-in duration-200">
                                    <CodingSubmissionsTable
                                        connectedPortals={connectedPortals}
                                        username={user?.username || ""}
                                    />
                                    <PracticeAnalyticsSection
                                        connectedPortals={connectedPortals}
                                        username={user?.username || ""}
                                    />
                                    <ContestPerformanceSection
                                        connectedPortals={connectedPortals}
                                        username={user?.username || ""}
                                    />
                                </div>
                            )}

                            {/* DEVELOPMENT VIEW */}
                            {activeDashboardField === "development" && (
                                <div className="w-full space-y-6 animate-in fade-in duration-200">
                                    <DevelopmentContributionsTable
                                        connectedPortals={connectedPortals}
                                        username={user?.username || ""}
                                    />
                                    <DevelopmentAnalyticsSection
                                        connectedPortals={connectedPortals}
                                        username={user?.username || ""}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Bottom Illustration Banner */}
                        <SectionBottomIllustration alt="Dashboard workspace illustration" />
                    </section>
                )}
                </Suspense>
            </div>
        </div>
    );
}
