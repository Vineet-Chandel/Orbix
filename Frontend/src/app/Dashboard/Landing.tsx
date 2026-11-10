import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Code2, GitBranch } from "lucide-react";
import { useAppDispatch, useAppSelector, fetchUserProfile } from "../../store";
import { NotificationBell } from "../../components/NotificationBell";
import { Sidebar, type SidebarTab } from "./Sidebar";
import { CodingSubmissionsTable } from "./CodingSubmissionsTable";
import { DevelopmentContributionsTable } from "./DevelopmentContributionsTable";
import { ContestPerformanceSection } from "./ContestPerformanceSection";
import { PracticeAnalyticsSection } from "./PracticeAnalytics/PracticeAnalyticsSection";
import { DevelopmentAnalyticsSection } from "./DevelopmentAnalytics/DevelopmentAnalyticsSection";
import { NotificationsView } from "../Notifications/NotificationsView";
import { TrendsView } from "../Trends/TrendsView";
import { ResumeManager } from "../Resume/ResumeManager";
import { ExploreView } from "../Explore/ExploreView";
import { StudentCampusClubsView } from "../Club/CollegeClubs/StudentCampusClubsView";
import { CollegeEventsView } from "../Events/CollegeEventsView";
import { StudentActivityView } from "../Events/StudentActivityView";
import { ProjectsManagementView } from "../Projects/ProjectsManagementView";
import { UserCertificateWalletView } from "../Certificates/UserCertificateWalletView";
import { MemberWorkspaceView } from "../Club/TeamWorkspace/MemberWorkspaceView";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";

export default function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);

    // Determine initial active tab based on pathname
    const getTabFromPath = (path: string): SidebarTab => {
        if (path === "/clubs" || path.startsWith("/clubs")) return "clubs";
        if (path.includes("/college-events") || path.includes("/college-event")) return "college-events";
        if (path.includes("/activity") || path.includes("/applications") || path.includes("/application")) return "activity";
        if (path.includes("/wallet") || path.includes("/certificates") || path.includes("/certificate")) return "wallet";
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
    }, [location.pathname]);

    useEffect(() => {
        dispatch(fetchUserProfile());
    }, [dispatch]);

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
                    if (!next[k] || !next[k].username || next[k].username !== handle) {
                        next[k] = {
                            ...(prev[k] || {}),
                            portal: k,
                            username: handle,
                            profileUrl: p.link || p.profileUrl || prev[k]?.profileUrl || "",
                            verified: p.verified !== false,
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
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Left Sidebar (Neo-Brutalist floating sidebar) */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                    setActiveTab(tab);
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "clubs") navigate("/clubs");
                    if (tab === "college-events") navigate("/college-events");
                    if (tab === "activity" || tab === "applications") navigate("/activity");
                    if (tab === "explore") navigate("/explore");
                    if (tab === "trends") navigate("/trends");
                    if (tab === "notifications") navigate("/notifications");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                    if (tab === "blogs") navigate("/blogs");
                    if (tab === "docs") navigate("/docs");
                    if (tab === "leaderboard") navigate("/leaderboard");
                    if (tab === "connect-platform") navigate("/onboarding");
                    if (tab === ("workspace" as any)) navigate("/workspace");
                }}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:p-3">
                {activeTab === "college-events" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <CollegeEventsView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === "activity" || activeTab === "applications" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <StudentActivityView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === "clubs" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <StudentCampusClubsView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === "explore" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ExploreView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === "resume" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ResumeManager onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === "notifications" ? (
                    <section
                        aria-label="Orbix Inbox"
                        className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                    >
                        <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                            <NotificationsView />
                        </div>
                        <SectionBottomIllustration alt="Notifications illustration" />
                    </section>
                ) : activeTab === "trends" ? (
                    <section
                        aria-label="Orbix Trends"
                        className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                    >
                        <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                            <TrendsView
                                connectedPortals={connectedPortals}
                                username={user?.username || ""}
                                onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
                            />
                        </div>
                        <SectionBottomIllustration alt="Trends illustration" />
                    </section>
                ) : activeTab === "projects" ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ProjectsManagementView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === "wallet" || activeTab === "certificates" ? (
                    <div className="flex-1 w-full min-h-0 bg-[#FAF6EE] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between animate-in fade-in duration-200">
                        <UserCertificateWalletView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : activeTab === ("workspace" as any) || location.pathname.startsWith("/workspace") ? (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <MemberWorkspaceView onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                ) : (
                    /* Default Dashboard View (Practice vs Development) */
                    <section
                        aria-label="Orbix Developer Dashboard"
                        className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                    >
                        <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                            {/* Dashboard Header Bar */}
                            <div className="pb-5 border-b-2 border-black/55 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Left: Mobile Toggle & Welcome Greeting */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsMobileSidebarOpen(true)}
                                            className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                            aria-label="Open sidebar"
                                        >
                                            <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <line x1="3" y1="12" x2="21" y2="12" />
                                                <line x1="3" y1="6" x2="21" y2="6" />
                                                <line x1="3" y1="18" x2="21" y2="18" />
                                            </svg>
                                        </button>
                                        <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                            Welcome, {displayName}!
                                        </h1>
                                    </div>
                                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black text-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                            Today, {formattedDate}
                                        </span>
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
                                            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                                                activeDashboardField === "practice"
                                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                            }`}
                                        >
                                            <Code2 className="w-4 h-4" />
                                            <span>Practice</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setActiveDashboardField("development")}
                                            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all cursor-pointer ${
                                                activeDashboardField === "development"
                                                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                            }`}
                                        >
                                            <GitBranch className="w-4 h-4" />
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
            </div>
        </div>
    );
}
