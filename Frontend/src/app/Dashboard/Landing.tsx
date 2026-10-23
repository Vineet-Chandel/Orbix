import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector, clearUser, fetchUserProfile } from "../../store";
import { NotificationBell } from "../../components/NotificationBell";
import { Sidebar, type SidebarTab } from "./Sidebar";
import { CodingSubmissionsTable } from "./CodingSubmissionsTable";
import { DevelopmentContributionsTable } from "./DevelopmentContributionsTable";
import { ContestPerformanceSection } from "./ContestPerformanceSection";
import { PracticeAnalyticsSection } from "./PracticeAnalytics/PracticeAnalyticsSection";
import { PracticeMonthlyStatsCards } from "./PracticeMonthlyStatsCards";
import { DevelopmentAnalyticsSection } from "./DevelopmentAnalytics/DevelopmentAnalyticsSection";
import { NotificationsView } from "../Notifications/NotificationsView";
import { TrendsView } from "../Trends/TrendsView";
import { ResumeManager } from "../Resume/ResumeManager";

export default function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);

    // Determine initial active tab based on pathname
    const getTabFromPath = (path: string): SidebarTab => {
        if (path.includes("/trends") || path.includes("/reports")) return "trends";
        if (path.includes("/notifications") || path.includes("/inbox")) return "notifications";
        if (path.includes("/profile")) return "profile";
        if (path.includes("/resume")) return "resume";
        if (path.includes("/projects")) return "projects";
        if (path.includes("/onboarding") || path.includes("/connect")) return "connect-platform";
        if (path.includes("/leaderboard")) return "leaderboard";
        return "dashboard";
    };

    const [activeTab, setActiveTab] = useState<SidebarTab>(() => getTabFromPath(location.pathname));
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeDashboardField, setActiveDashboardField] = useState<"practice" | "development">("practice");

    useEffect(() => {
        setActiveTab(getTabFromPath(location.pathname));
    }, [location.pathname]);

    useEffect(() => {
        dispatch(fetchUserProfile());
    }, [dispatch]);

    const handleSignOut = async () => {
        try {
            const endpoints = ["http://localhost:3000/api/signout", "/api/signout"];
            await Promise.allSettled(
                endpoints.map((url) =>
                    fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ gmail: user?.gmail || "" }),
                    })
                )
            );
        } catch {
            // ignore
        }
        dispatch(clearUser());
        navigate("/auth/signin");
    };

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
                            portal: k,
                            username: handle,
                            profileUrl: p.link || p.profileUrl || "",
                            verified: p.verified !== false,
                            displayName: p.displayName || p.display_name || handle,
                            avatarUrl: p.avatarUrl || p.avatar_url,
                            stats: p.stats,
                            syncStatus: p.lastSyncStatus || p.syncStatus || "valid",
                            lastSyncAt: p.lastSyncAt || p.last_sync_at,
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

    const connectedPortalsCount = Object.keys(connectedPortals).length;

    // Formatting date matching the Prodexa screenshot ("Today, 20 January 2029")
    const formattedDate = new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());

    return (
        <div className={`min-h-screen ${activeTab === "resume" ? "bg-[#F0F2F6]" : "bg-[#F5F5F7]"} text-neutral-900 font-sans flex antialiased selection:bg-neutral-900 selection:text-white`}>
            {/* Left Sidebar (Apple-inspired floating sidebar) */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                    setActiveTab(tab);
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "trends") navigate("/trends");
                    if (tab === "notifications") navigate("/notifications");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                }}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Right Main Dashboard Workspace */}
            <div className="flex-1 min-w-0 flex flex-col min-h-screen p-3 sm:p-4 lg:pl-0">
                {/* Top Header Bar matching Apple design language (hidden on resume and profile sections to match Connected Platforms exactly) */}
                {activeTab !== "resume" && activeTab !== "profile" && (
                    <header className="h-16 w-full rounded-2xl bg-white border border-neutral-300 shadow-sm px-4 sm:px-6 flex items-center justify-between gap-4 mb-4 flex-shrink-0">
                        {/* Left: Mobile Toggle & Page Title */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsMobileSidebarOpen(true)}
                                className="lg:hidden p-2 text-neutral-600 hover:text-neutral-950 rounded-xl hover:bg-black/[0.04] transition-colors"
                                aria-label="Open sidebar"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                            <h1 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight">
                                {activeTab === "trends"
                                    ? "Trends & Performance Reports"
                                    : activeTab === "notifications"
                                        ? "Inbox & Inquiries"
                                        : activeTab === "projects"
                                            ? "Projects & Code"
                                            : activeTab === "connect-platform"
                                                ? "Connect Coding Platforms"
                                                : "Orbix Dashboard"}
                            </h1>
                        </div>

                        {/* Center: Search input with ⌘ + / badge */}
                        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
                            <div className="relative w-full">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search or jump to..."
                                    className="w-full pl-9 pr-14 py-2 bg-black/[0.03] hover:bg-black/[0.05] focus:bg-white text-xs sm:text-sm rounded-full border border-neutral-300 focus:border-black text-neutral-900 focus:outline-none transition-colors"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-[10px] font-mono text-neutral-400 bg-white border border-neutral-300 px-1.5 py-0.5 rounded-md shadow-2xs">
                                        ⌘ + /
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right action area: Notification Bell & Quick Profile */}
                        <div className="flex items-center gap-2">
                            <NotificationBell variant="light" />
                            <Link
                                to="/profile"
                                title="Profile Settings"
                                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-black/[0.04] transition-colors"
                            >
                                <img
                                    src={user?.photoUrl || user?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=fff&size=64&bold=true`}
                                    alt={displayName}
                                    className="w-7 h-7 rounded-full object-cover border border-neutral-200"
                                />
                                <span className="hidden sm:inline text-xs sm:text-sm font-semibold text-neutral-700">
                                    {displayName}
                                </span>
                            </Link>
                        </div>
                    </header>
                )}

                {/* Dashboard View */}
                {activeTab === "dashboard" && (
                    <main className="space-y-4 sm:space-y-5 flex-1">
                        {/* Greeting Row with Two Primary Fields: Practice & Development Switcher */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
                                    Welcome {displayName}!
                                </h2>
                                <p className="text-xs sm:text-sm text-neutral-500 font-medium">
                                    Today, {formattedDate}
                                </p>
                            </div>

                            {/* Two Dashboard Fields: Practice & Development */}
                            <div className="inline-flex items-center p-1 rounded-2xl bg-white border border-neutral-300 shadow-sm self-start sm:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setActiveDashboardField("practice")}
                                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeDashboardField === "practice"
                                        ? "bg-black text-white shadow-xs"
                                        : "text-neutral-600 hover:text-neutral-950 hover:bg-black/[0.04]"
                                        }`}
                                >
                                    <span>Practice</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveDashboardField("development")}
                                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${activeDashboardField === "development"
                                        ? "bg-black text-white shadow-xs"
                                        : "text-neutral-600 hover:text-neutral-950 hover:bg-black/[0.04]"
                                        }`}
                                >
                                    <span>Development</span>
                                </button>
                            </div>
                        </div>



                        {/* Practice Field: Multi-Platform Coding Submissions (Excluding GitHub) & Contest Performance */}
                        {activeDashboardField === "practice" && (
                            <div className="w-full animate-fadeIn space-y-6">
                                <CodingSubmissionsTable
                                    connectedPortals={connectedPortals}
                                    username={user?.username || ""}
                                />
                                <PracticeMonthlyStatsCards
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

                        {/* Development Field: Development Metrics, Languages & Contributions (GitHub) */}
                        {activeDashboardField === "development" && (
                            <div className="w-full animate-fadeIn space-y-6">
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

                    </main>
                )}

                {/* Sub-view: Profile */}
                {activeTab === "profile" && (
                    <div className="rounded-2xl bg-white border border-black/[0.06] p-6 sm:p-8 shadow-xs space-y-6 flex-1">
                        <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
                            <div>
                                <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
                                    Developer Profile
                                </h2>
                                <p className="text-xs text-neutral-500 mt-1">
                                    Your personal information and connected coding identities.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="px-4 py-2 rounded-full border border-black/10 hover:border-black text-xs font-bold text-neutral-900 hover:bg-black/[0.04] transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.06] space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Display Name</span>
                                <p className="text-sm font-extrabold text-neutral-900">{displayName}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.06] space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Username</span>
                                <p className="text-sm font-extrabold text-neutral-900">@{user?.username || "developer"}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.06] space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Registered Email</span>
                                <p className="text-sm font-extrabold text-neutral-900">{user?.gmail || "Not specified"}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.06] space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Connected Platforms</span>
                                <p className="text-sm font-extrabold text-neutral-900">{connectedPortalsCount} Portals Saved</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Link
                                to="/onboarding"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-xs"
                            >
                                <span>Manage Coding Portals Bucket</span>
                                <span>→</span>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Sub-view: Resume */}
                {activeTab === "resume" && (
                    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
                        <ResumeManager onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
                    </div>
                )}

                {/* Sub-view: Projects */}
                {activeTab === "projects" && (
                    <div className="rounded-2xl bg-white border border-black/[0.06] p-6 sm:p-8 shadow-xs space-y-6 flex-1">
                        <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
                            <div>
                                <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
                                    Projects & Repositories
                                </h2>
                                <p className="text-xs text-neutral-500 mt-1">
                                    Manage your integrated GitHub repositories and continuous automation pipelines.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => alert("Creating new repository integration...")}
                                className="px-4 py-2 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-xs"
                            >
                                + New Project
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { name: "orbix-core", desc: "Core authentication and multi-platform profile aggregator", stars: 142, lang: "TypeScript" },
                                { name: "orbix-engine", desc: "Model Context Protocol real-time reviewer and analysis pipeline", stars: 89, lang: "Go" },
                                { name: "orbix-ui", desc: "Clean modern dashboard with responsive sidebar and widgets", stars: 64, lang: "React" },
                            ].map((proj, idx) => (
                                <div key={idx} className="p-4 rounded-xl border border-black/[0.06] hover:border-black/20 transition-colors bg-white shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-neutral-900">{proj.name}</h4>
                                        <span className="text-[11px] font-mono text-neutral-400">★ {proj.stars}</span>
                                    </div>
                                    <p className="text-xs text-neutral-500 leading-relaxed">{proj.desc}</p>
                                    <div className="pt-2 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-black" />
                                        <span className="text-[11px] text-neutral-600 font-medium">{proj.lang}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sub-view: Notifications & Messages */}
                {activeTab === "notifications" && (
                    <NotificationsView />
                )}

                {/* Sub-view: Trends & Performance Reports */}
                {activeTab === "trends" && (
                    <TrendsView
                        connectedPortals={connectedPortals}
                        username={user?.username || ""}
                    />
                )}
            </div>
        </div>
    );
}
