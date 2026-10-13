import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector, clearUser, fetchUserProfile } from "../../store";
import { Sidebar, type SidebarTab } from "./Sidebar";
import { ConnectedPlatformsSection } from "./ConnectedPlatformsSection";

export default function Dashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);

    // Determine initial active tab based on pathname
    const getTabFromPath = (path: string): SidebarTab => {
        if (path.includes("/profile")) return "profile";
        if (path.includes("/resume")) return "resume";
        if (path.includes("/projects")) return "projects";
        if (path.includes("/onboarding") || path.includes("/connect")) return "connect-platform";
        return "dashboard";
    };

    const [activeTab, setActiveTab] = useState<SidebarTab>(() => getTabFromPath(location.pathname));
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [timeRange, setTimeRange] = useState("Last 12 hour");

    useEffect(() => {
        setActiveTab(getTabFromPath(location.pathname));
    }, [location.pathname]);

    useEffect(() => {
        if (!user) {
            dispatch(fetchUserProfile());
        }
    }, [dispatch, user]);

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
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

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
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 font-sans flex antialiased selection:bg-neutral-900 selection:text-white">
            {/* Left Sidebar (Matching Prodexa Floating Style with Black Color Scheme) */}
            <Sidebar
                activeTab={activeTab}
                onTabChange={(tab) => {
                    setActiveTab(tab);
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                }}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Right Main Dashboard Workspace */}
            <div className="flex-1 min-w-0 flex flex-col min-h-screen p-3 sm:p-4 lg:pl-0">
                {/* Top Header Bar matching Prodexa style */}
                <header className="h-16 w-full rounded-2xl bg-white border border-neutral-200/90 shadow-xs px-4 sm:px-6 flex items-center justify-between gap-4 mb-4 flex-shrink-0">
                    {/* Left: Mobile Toggle & Page Title */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="lg:hidden p-2 text-neutral-600 hover:text-neutral-950 rounded-xl hover:bg-neutral-100 transition-colors"
                            aria-label="Open sidebar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                        <h1 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight">
                            {activeTab === "profile"
                                ? "Developer Profile"
                                : activeTab === "resume"
                                ? "Resume & Credentials"
                                : activeTab === "projects"
                                ? "Projects & Code"
                                : activeTab === "connect-platform"
                                ? "Connect Coding Platforms"
                                : "Orbix Dashboard"}
                        </h1>
                    </div>

                    {/* Center: Search input with ⌘ + / badge matching screenshot */}
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
                                className="w-full pl-9 pr-14 py-2 bg-neutral-100/80 hover:bg-neutral-100 focus:bg-white text-xs rounded-full border border-neutral-200/80 focus:border-neutral-900 focus:outline-none transition-colors"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-[10px] font-mono text-neutral-400 bg-white border border-neutral-200 px-1.5 py-0.5 rounded-md shadow-2xs">
                                    ⌘ + /
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Quick Action Icons & Profile Chip matching Prodexa */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            className="h-9 w-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
                            title="Help & Info"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            className="h-9 w-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
                            title="Settings"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            className="relative h-9 w-9 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
                            title="Notifications"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-black ring-2 ring-white" />
                        </button>

                        {/* Top Profile Chip matching Prodexa */}
                        <div className="flex items-center gap-2 pl-1 sm:pl-2">
                            <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="hidden sm:inline-block text-xs font-bold text-neutral-900 truncate max-w-[110px]">
                                {displayName}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Dashboard View */}
                {activeTab === "dashboard" && (
                    <main className="space-y-4 sm:space-y-5 flex-1">
                        {/* Greeting & Time Control Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
                                    Welcome {displayName}!
                                </h2>
                                <p className="text-xs text-neutral-500 font-medium">
                                    Today, {formattedDate}
                                </p>
                            </div>

                            <div className="flex items-center gap-2.5 flex-wrap">
                                {/* Time Filter Pill */}
                                <div className="inline-flex items-center gap-1.5 bg-white border border-neutral-200/90 rounded-full px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-xs">
                                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <select
                                        value={timeRange}
                                        onChange={(e) => setTimeRange(e.target.value)}
                                        className="bg-transparent focus:outline-none cursor-pointer pr-1 text-neutral-800"
                                    >
                                        <option value="Last 12 hour">Last 12 hour</option>
                                        <option value="Last 24 hour">Last 24 hour</option>
                                        <option value="Last 7 days">Last 7 days</option>
                                        <option value="All Time">All Time</option>
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    className="h-8 w-8 rounded-full bg-white border border-neutral-200/90 text-neutral-600 hover:text-neutral-900 flex items-center justify-center shadow-xs transition-colors"
                                    title="Filter"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="4" y1="21" x2="4" y2="14" />
                                        <line x1="4" y1="10" x2="4" y2="3" />
                                        <line x1="12" y1="21" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12" y2="3" />
                                        <line x1="20" y1="21" x2="20" y2="16" />
                                        <line x1="20" y1="12" x2="20" y2="3" />
                                        <line x1="1" y1="14" x2="7" y2="14" />
                                        <line x1="9" y1="8" x2="15" y2="8" />
                                        <line x1="17" y1="16" x2="23" y2="16" />
                                    </svg>
                                </button>

                                {/* Black Solid Capsule Button matching prompt instructions */}
                                <button
                                    type="button"
                                    onClick={() => alert("Exporting workspace report...")}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-black text-white hover:bg-neutral-800 px-4 py-2 text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                                >
                                    <span>Export as</span>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Top 4 Metrics Cards Row matching Prodexa layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {/* Card 1: Total Output (Solid Dark Hero Pill as shown in Prodexa) */}
                            <div className="rounded-2xl bg-black border border-neutral-800 p-4 text-white shadow-lg flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-neutral-300">Total Output</span>
                                    <span className="text-[10px] font-bold bg-neutral-900 border border-neutral-700 text-neutral-200 px-2 py-0.5 rounded-full">
                                        Today ▾
                                    </span>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">12,450</span>
                                        <span className="text-xs text-neutral-400 font-medium">Units</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                                        <span className="text-white font-bold">↑ 1.15%</span>
                                        <span>from yesterday</span>
                                    </p>
                                </div>
                            </div>

                            {/* Card 2: OEE Score */}
                            <div className="rounded-2xl bg-white border border-neutral-200/90 p-4 shadow-xs flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-neutral-500">OEE Score</span>
                                    <span className="text-[10px] text-neutral-400">Today ▾</span>
                                </div>
                                <div className="mt-3">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                                        85%
                                    </span>
                                    <p className="mt-1 text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                                        <span className="text-neutral-900 font-bold">↑ 5%</span>
                                        <span>from yesterday</span>
                                    </p>
                                </div>
                            </div>

                            {/* Card 3: Downtime */}
                            <div className="rounded-2xl bg-white border border-neutral-200/90 p-4 shadow-xs flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-neutral-500">Downtime</span>
                                    <span className="text-[10px] text-neutral-400">Today ▾</span>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">45</span>
                                        <span className="text-xs text-neutral-500 font-medium">min</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                                        <span className="text-neutral-900 font-bold">↓ 10%</span>
                                        <span>less than yesterday</span>
                                    </p>
                                </div>
                            </div>

                            {/* Card 4: Quality Rate */}
                            <div className="rounded-2xl bg-white border border-neutral-200/90 p-4 shadow-xs flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-neutral-500">Quality Rate</span>
                                    <span className="text-[10px] text-neutral-400">Today ▾</span>
                                </div>
                                <div className="mt-3">
                                    <span className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                                        98.5%
                                    </span>
                                    <p className="mt-1 text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                                        <span className="text-neutral-900 font-bold">↑ 0.5%</span>
                                        <span>improvement</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Platforms / Connected Accounts Grid Section matching screenshot in Light Theme */}
                        <ConnectedPlatformsSection
                            connectedPortals={connectedPortals}
                            onPortalsChange={(updated) => setConnectedPortals(updated)}
                        />

                        {/* Middle Row: Production Status Donut Chart & Uptime Machines */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                            {/* Left Chart Card: Production Status (7 cols) */}
                            <div className="lg:col-span-7 rounded-2xl bg-white border border-neutral-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                                            Production Status
                                        </h3>
                                        <span className="text-neutral-400 text-xs">ⓘ</span>
                                    </div>
                                    <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
                                        Machine #32 ▾
                                    </span>
                                </div>

                                <div className="my-4 flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div>
                                        <p className="text-xs text-neutral-400 font-medium">Total Production</p>
                                        <h4 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
                                            751,613
                                        </h4>
                                        <p className="text-[11px] text-neutral-500 font-medium mt-1">
                                            <span className="text-neutral-900 font-bold">↑ 1.15%</span> from yesterday
                                        </p>

                                        <div className="mt-4 space-y-2 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-black" />
                                                <span className="font-medium text-neutral-600">Normal</span>
                                                <span className="font-bold text-neutral-900 ml-auto pl-4">751,124</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                                <span className="font-medium text-neutral-600">At Risk</span>
                                                <span className="font-bold text-neutral-900 ml-auto pl-4">421</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                                                <span className="font-medium text-neutral-600">No Data</span>
                                                <span className="font-bold text-neutral-900 ml-auto pl-4">86</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Donut Chart representation */}
                                    <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                            {/* Background / Normal: 80% */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="36"
                                                stroke="#0e121d"
                                                strokeWidth="20"
                                                fill="transparent"
                                                strokeDasharray="226"
                                                strokeDashoffset="35"
                                            />
                                            {/* At risk: 10% */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="36"
                                                stroke="#f59e0b"
                                                strokeWidth="20"
                                                fill="transparent"
                                                strokeDasharray="226"
                                                strokeDashoffset="205"
                                            />
                                            {/* No Data: 5% */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="36"
                                                stroke="#94a3b8"
                                                strokeWidth="20"
                                                fill="transparent"
                                                strokeDasharray="226"
                                                strokeDashoffset="220"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-14 h-14 bg-white rounded-full shadow-inner" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right List Card: Uptime Machines (5 cols) */}
                            <div className="lg:col-span-5 rounded-2xl bg-white border border-neutral-200/90 p-4 sm:p-5 shadow-xs">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                                            Uptime Machines
                                        </h3>
                                        <span className="text-neutral-400 text-xs">ⓘ</span>
                                    </div>
                                    <button type="button" className="text-neutral-400 hover:text-neutral-900 text-sm">
                                        •••
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {[
                                        { id: "Machine #1", uptime: "12h 35m", status: "Active" },
                                        { id: "Machine #2", uptime: "Off Production", status: "Off" },
                                        { id: "Machine #3", uptime: "8h 59m", status: "Active" },
                                        { id: "Machine #4", uptime: "12h 54m", status: "Active" },
                                    ].map((m, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-100 transition-colors text-xs"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        m.status === "Active"
                                                            ? "bg-black text-white"
                                                            : "bg-neutral-200 text-neutral-600"
                                                    }`}
                                                >
                                                    {m.status}
                                                </span>
                                                <span className="font-bold text-neutral-900">{m.id}</span>
                                            </div>
                                            <span className="font-medium text-neutral-500 font-mono">
                                                {m.uptime}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Section: Energy Consumption Log Table matching Prodexa */}
                        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-xs overflow-hidden">
                            <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                                        Energy Consumption Log Table
                                    </h3>
                                    <span className="text-neutral-400 text-xs">ⓘ</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 hover:text-neutral-950 text-xs font-semibold"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                                        </svg>
                                        <span>Filter</span>
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-neutral-50/70 text-neutral-400 font-semibold border-b border-neutral-100">
                                        <tr>
                                            <th className="py-3 px-5">Date</th>
                                            <th className="py-3 px-5">Start Time</th>
                                            <th className="py-3 px-5">End Time</th>
                                            <th className="py-3 px-5">Duration (hr)</th>
                                            <th className="py-3 px-5">Energy (kWh)</th>
                                            <th className="py-3 px-5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-100 text-neutral-700 font-medium">
                                        {[
                                            { date: "23/04/2026", start: "08.30", end: "11.36", duration: 3, energy: 20.4, status: "Safe", color: "text-neutral-950 font-bold" },
                                            { date: "22/04/2026", start: "13.42", end: "16.48", duration: 3, energy: 50.1, status: "At Risk", color: "text-amber-600 font-semibold" },
                                            { date: "21/04/2026", start: "11.53", end: "16.59", duration: 3, energy: 98.4, status: "Warning", color: "text-rose-600 font-semibold" },
                                            { date: "20/04/2026", start: "08.28", end: "16.59", duration: 10, energy: 198.4, status: "At Risk", color: "text-amber-600 font-semibold" },
                                        ].map((row, i) => (
                                            <tr key={i} className="hover:bg-neutral-50 transition-colors">
                                                <td className="py-3.5 px-5 text-neutral-900 font-semibold">{row.date}</td>
                                                <td className="py-3.5 px-5 font-mono text-neutral-500">{row.start}</td>
                                                <td className="py-3.5 px-5 font-mono text-neutral-500">{row.end}</td>
                                                <td className="py-3.5 px-5 font-mono text-neutral-900">{row.duration}</td>
                                                <td className="py-3.5 px-5 font-mono text-neutral-900">{row.energy}</td>
                                                <td className="py-3.5 px-5">
                                                    <span className={`inline-flex items-center gap-1.5 ${row.color}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                        {row.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                )}

                {/* Sub-view: Profile */}
                {activeTab === "profile" && (
                    <div className="rounded-2xl bg-white border border-neutral-200/90 p-6 sm:p-8 shadow-xs space-y-6 flex-1">
                        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
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
                                className="px-4 py-2 rounded-full border border-neutral-300 hover:border-neutral-900 text-xs font-bold text-neutral-900 transition-colors"
                            >
                                Sign Out
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Display Name</span>
                                <p className="text-sm font-extrabold text-neutral-900">{displayName}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Username</span>
                                <p className="text-sm font-extrabold text-neutral-900">@{user?.username || "developer"}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Registered Email</span>
                                <p className="text-sm font-extrabold text-neutral-900">{user?.gmail || "Not specified"}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase">Connected Platforms</span>
                                <p className="text-sm font-extrabold text-neutral-900">{connectedPortalsCount} Portals Saved</p>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Link
                                to="/onboarding"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-md"
                            >
                                <span>Manage Coding Portals Bucket</span>
                                <span>→</span>
                            </Link>
                        </div>
                    </div>
                )}

                {/* Sub-view: Resume */}
                {activeTab === "resume" && (
                    <div className="rounded-2xl bg-white border border-neutral-200/90 p-6 sm:p-8 shadow-xs space-y-6 flex-1">
                        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                            <div>
                                <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">
                                    Developer Resume & Credentials
                                </h2>
                                <p className="text-xs text-neutral-500 mt-1">
                                    Auto-curated resume summarizing your verified contest ratings and problem solving track.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => alert("Downloading PDF resume...")}
                                className="px-4 py-2 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-md"
                            >
                                Download PDF
                            </button>
                        </div>

                        <div className="border border-neutral-200 rounded-2xl p-6 bg-neutral-50/50 space-y-6">
                            <div>
                                <h3 className="text-lg font-extrabold text-neutral-900">{displayName}</h3>
                                <p className="text-xs text-neutral-500 font-mono">@{user?.username} • {user?.gmail}</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                                    Competitive Programming & Platform Badges
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {Object.entries(connectedPortals).map(([pId, p]: [string, any]) => (
                                        <div key={pId} className="p-3 bg-white rounded-xl border border-neutral-200 shadow-2xs">
                                            <p className="text-xs font-bold text-neutral-900 capitalize">{pId}</p>
                                            <p className="text-[11px] font-mono text-neutral-500">@{p.username}</p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {p.stats?.map((st: any, idx: number) => (
                                                    <span key={idx} className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded-md font-medium text-neutral-700">
                                                        {st.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-view: Projects */}
                {activeTab === "projects" && (
                    <div className="rounded-2xl bg-white border border-neutral-200/90 p-6 sm:p-8 shadow-xs space-y-6 flex-1">
                        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
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
                                className="px-4 py-2 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-md"
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
                                <div key={idx} className="p-4 rounded-xl border border-neutral-200 hover:border-neutral-900 transition-colors bg-white shadow-2xs space-y-2">
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
            </div>
        </div>
    );
}
