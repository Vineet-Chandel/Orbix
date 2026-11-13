import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, ChevronDown, CalendarDays, BookOpen, Briefcase, Settings, Compass, Award, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppDispatch, useAppSelector, clearUser } from "../../store";
import { fetchUnreadNotificationCount } from "../../utils/profileApi";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import { OrbixLogo } from "../../components/OrbixLogo";
import { buildApiUrl } from "../../api/apiClient";
import { workspaceApi } from "../../api/workspaceApi";
import { JoinClubModal } from "../Club/JoinClubModal";
import type { UserClubWorkspaceSummary } from "../../types/workspace";

export type SidebarTab =
    | "home"
    | "dashboard"
    | "explore"
    | "trends"
    | "notifications"
    | "leaderboard"
    | "events"
    | "clubs"
    | "college-events"
    | "applications"
    | "activity"
    | "wallet"
    | "certificates"
    | "connect-platform"
    | "profile"
    | "resume"
    | "projects"
    | "blogs"
    | "docs"
    | "codexa"
    | "evolexa"
    | "flowexa"
    | "workspace"
    | "settings";

export type CollapsibleSection = "events" | "documentation" | "workspaces";

interface SidebarProps {
    activeTab?: SidebarTab;
    onTabChange?: (tab: SidebarTab) => void;
    isOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar = ({
    activeTab = "dashboard",
    onTabChange,
    isOpen = false,
    onClose,
}: SidebarProps) => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.user);

    // Profile menu toggle and ref for outside-click handling
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Hover-driven expansion: collapsed by default (Image 2), expands on hovering or when profile menu is open
    const [isHovered, setIsHovered] = useState(false);
    const isExpanded = isOpen || isHovered || isProfileMenuOpen;

    // Collapsible accordion dropdown state: only one section can be open at a time ("events" | "documentation" | "workspaces" | null)
    const [openSection, setOpenSection] = useState<CollapsibleSection | null>(() => {
        if (
            location.pathname.startsWith("/events") ||
            location.pathname.startsWith("/clubs") ||
            location.pathname.startsWith("/college-events") ||
            location.pathname.startsWith("/applications") ||
            location.pathname.startsWith("/activity")
        ) {
            return "events";
        }
        if (
            location.pathname.startsWith("/blogs") ||
            location.pathname.startsWith("/blog") ||
            location.pathname.startsWith("/docs")
        ) {
            return "documentation";
        }
        if (location.pathname.startsWith("/workspace")) {
            return "workspaces";
        }
        return "events";
    });

    const [clubWorkspaces, setClubWorkspaces] = useState<UserClubWorkspaceSummary[]>([]);
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
    const [isJoinClubModalOpen, setIsJoinClubModalOpen] = useState(false);

    const loadWorkspaces = async () => {
        try {
            setLoadingWorkspaces(true);
            const res = await workspaceApi.getMyWorkspaces();
            if (res.success) {
                setClubWorkspaces(res.workspaces || []);
            }
        } catch (err) {
            console.warn("[Sidebar] Failed to load user workspaces:", err);
        } finally {
            setLoadingWorkspaces(false);
        }
    };

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const handleToggleSection = (section: CollapsibleSection) => {
        setOpenSection((prev) => (prev === section ? null : section));
    };

    // Auto-open section when navigating or when activeTab changes
    useEffect(() => {
        if (
            activeTab === "events" ||
            activeTab === "clubs" ||
            activeTab === "college-events" ||
            activeTab === "applications" ||
            activeTab === "activity" ||
            location.pathname.startsWith("/events") ||
            location.pathname.startsWith("/clubs") ||
            location.pathname.startsWith("/college-events") ||
            location.pathname.startsWith("/applications") ||
            location.pathname.startsWith("/activity")
        ) {
            setOpenSection("events");
        } else if (
            activeTab === "docs" ||
            activeTab === "blogs" ||
            location.pathname.startsWith("/docs") ||
            location.pathname.startsWith("/blog") ||
            location.pathname.startsWith("/blogs")
        ) {
            setOpenSection("documentation");
        } else if (
            activeTab === "codexa" ||
            activeTab === "evolexa" ||
            activeTab === "flowexa" ||
            activeTab === "workspace" ||
            location.pathname.startsWith("/workspace")
        ) {
            setOpenSection("workspaces");
        }
    }, [location.pathname, activeTab]);

    // Close profile menu when clicking/tapping outside or pressing Escape
    useEffect(() => {
        if (!isProfileMenuOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isProfileMenuOpen]);

    // Connected portals and health sync tracking
    const [connectedPortalsCount, setConnectedPortalsCount] = useState<number>(0);
    const [brokenPortalsCount, setBrokenPortalsCount] = useState<number>(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

    useEffect(() => {
        const handleSync = () => {
            try {
                const raw = localStorage.getItem("orbix_connected_portals");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const count = Object.keys(parsed).length;
                    if (count > 0) {
                        setConnectedPortalsCount(count);
                        const broken = Object.values(parsed).filter(
                            (p: any) => p && (p.verified === false || p.syncStatus === "broken")
                        ).length;
                        setBrokenPortalsCount(broken);
                        return;
                    }
                }
                if (user?.platforms && Array.isArray(user.platforms) && user.platforms.length > 0) {
                    setConnectedPortalsCount(user.platforms.length);
                    const broken = user.platforms.filter((p: any) => p && p.verified === false).length;
                    setBrokenPortalsCount(broken);
                    return;
                }
            } catch {
                // ignore
            }
            setConnectedPortalsCount(0);
            setBrokenPortalsCount(0);
        };

        const handleUnreadSync = async () => {
            if (!user) return;
            try {
                const count = await fetchUnreadNotificationCount();
                setUnreadNotificationsCount(count);
            } catch {
                // ignore
            }
        };

        handleSync();
        handleUnreadSync();

        const notifInterval = setInterval(handleUnreadSync, 30000);

        window.addEventListener("orbix_portals_updated", handleSync);
        window.addEventListener("orbix_notifications_updated", handleUnreadSync);
        window.addEventListener("storage", handleSync);
        window.addEventListener("focus", handleUnreadSync);

        return () => {
            clearInterval(notifInterval);
            window.removeEventListener("orbix_portals_updated", handleSync);
            window.removeEventListener("orbix_notifications_updated", handleUnreadSync);
            window.removeEventListener("storage", handleSync);
            window.removeEventListener("focus", handleUnreadSync);
        };
    }, [user]);

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Developer";

    const displayEmail = user?.gmail || (user as any)?.email || "";
    const avatarSrc = user?.photoUrl || user?.avatarUrl || (user as any)?.avatar || DEFAULT_AVATAR_URL;

    const handleSignOut = async () => {
        try {
            const primarySignout = buildApiUrl("/api/auth/logout");
            const endpoints = import.meta.env.DEV
                ? [primarySignout, "/api/auth/signout", "http://localhost:3000/api/auth/logout", "/api/signout"]
                : [primarySignout, "/api/auth/signout", "/api/signout"];
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

    const handleItemClick = (tab: SidebarTab) => {
        if (onTabChange) {
            onTabChange(tab);
        }
        if (onClose) {
            onClose();
        }
    };

    // 1 dashboard, 2 leaderboard, 3 connect platform, 4 resume, 5 projects
    const mainNavItems = [
        {
            id: "dashboard" as SidebarTab,
            label: "Dashboard",
            icon: (


                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 5a2 2 0 0 1 2-2h6v18H4a2 2 0 0 1-2-2zm12-2h6a2 2 0 0 1 2 2v5h-8zm0 11h8v5a2 2 0 0 1-2 2h-6z"></path>
                </svg>
            ),
            path: "/dashboard",
        },
        {
            id: "explore" as SidebarTab,
            label: "Explore",
            icon: (
                <Compass className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />
            ),
            path: "/explore",
        },
        {
            id: "trends" as SidebarTab,
            label: "Trends & Reports",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                </svg>
            ),
            path: "/trends",
        },
        {
            id: "leaderboard" as SidebarTab,
            label: "Leaderboard",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 1024 1024">
                    <path fill="currentColor" d="M868 160h-92v-40c0-4.4-3.6-8-8-8H256c-4.4 0-8 3.6-8 8v40h-92a44 44 0 0 0-44 44v148c0 81.7 60 149.6 138.2 162C265.7 630.2 359 721.7 476 734.5v105.2H280c-17.7 0-32 14.3-32 32V904c0 4.4 3.6 8 8 8h512c4.4 0 8-3.6 8-8v-32.3c0-17.7-14.3-32-32-32H548V734.5C665 721.7 758.3 630.2 773.8 514C852 501.6 912 433.7 912 352V204a44 44 0 0 0-44-44M184 352V232h64v207.6a91.99 91.99 0 0 1-64-87.6m520 128c0 49.1-19.1 95.4-53.9 130.1c-34.8 34.8-81 53.9-130.1 53.9h-16c-49.1 0-95.4-19.1-130.1-53.9c-34.8-34.8-53.9-81-53.9-130.1V184h384zm136-128c0 41-26.9 75.8-64 87.6V232h64z"></path>
                </svg>
            ),
            path: "/leaderboard",
        },
        {
            id: "resume" as SidebarTab,
            label: "Resume",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
            ),
            path: "/resume",
        },
        {
            id: "projects" as SidebarTab,
            label: "Projects",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <polygon points="12 11 12 17 17 14" />
                </svg>
            ),
            path: "/projects",
        },
    ];

    // Events Section: Clubs, College Events, Event Tracker, Applications
    const eventItems = [
        {
            id: "clubs" as SidebarTab,
            label: "Clubs",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            ),
            path: "/clubs",
            isComingSoon: false,
        },
        {
            id: "college-events" as SidebarTab,
            label: "College Events",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
            ),
            path: "/college-events",
            isComingSoon: false,
        },
        {
            id: "events" as SidebarTab,
            label: "Event Tracker",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
            ),
            path: "/events",
            isComingSoon: false,
        },
        {
            id: "activity" as SidebarTab,
            label: "Activity",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="m9 14 2 2 4-4" />
                </svg>
            ),
            path: "/activity",
            isComingSoon: false,
        },
        {
            id: "wallet" as SidebarTab,
            label: "Certificates",
            icon: (
                <Award className="w-5 h-5 flex-shrink-0" />
            ),
            path: "/wallet",
            isComingSoon: false,
        },
    ];

    // Documentation Items: Blogs, Docs
    const documentationItems = [
        {
            id: "blogs" as SidebarTab,
            label: "Blogs",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            ),
            path: "/blogs",
        },
        {
            id: "docs" as SidebarTab,
            label: "Docs",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
            ),
            path: "/docs",
        },
    ];



    const renderNavItem = (item: {
        id: SidebarTab;
        label: string;
        icon: React.ReactNode;
        path: string;
        badge?: string;
        badgeVariant?: "danger" | "default";
    }) => {
        const isCurrentActive =
            activeTab === item.id ||
            (item.path && location.pathname === item.path) ||
            (item.id === "activity" && (location.pathname.startsWith("/activity") || location.pathname.startsWith("/applications") || activeTab === "applications")) ||
            (item.id === "docs" && location.pathname.startsWith("/docs")) ||
            (item.id === "blogs" && (location.pathname.startsWith("/blogs") || location.pathname.startsWith("/blog")));

        return (
            <Link
                key={item.id}
                to={item.path}
                onClick={() => handleItemClick(item.id)}
                className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${isCurrentActive
                    ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black z-10"
                    : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                    }`}
            >
                {/* Active vertical accent bar */}
                <span
                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${isCurrentActive && isExpanded ? "bg-black opacity-100" : "bg-transparent opacity-0"
                        }`}
                />

                <div className="flex items-center w-full">
                    {/* SVG Icon: DEAD-CENTER in 44px container */}
                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                        <span
                            className={`w-5 h-5 flex items-center justify-center transition-colors ${isCurrentActive
                                ? "text-black"
                                : "text-neutral-700 group-hover:text-black"
                                }`}
                        >
                            {item.icon}
                        </span>
                    </div>

                    {/* Text label only rendered when expanded */}
                    {isExpanded && (
                        <span className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${isCurrentActive ? "text-black font-black" : "text-neutral-800 font-bold"}`}>
                            {item.label}
                        </span>
                    )}
                </div>

                {item.badge && isExpanded && (
                    <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors flex-shrink-0 whitespace-nowrap ml-2 border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${(item as any).badgeVariant === "danger"
                            ? "bg-[#FF6B6B] text-black animate-pulse"
                            : isCurrentActive
                                ? "bg-black text-[#a2ff86]"
                                : "bg-[#FFE566] text-black"
                            }`}
                    >
                        {item.badge}
                    </span>
                )}

                {/* Small badge dot in collapsed rail */}
                {item.badge && !isExpanded && (item as any).badgeVariant === "danger" && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#FF6B6B] border border-black animate-pulse" />
                )}

                {/* Floating tooltip when contracted */}
                {!isExpanded && (
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {isCurrentActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />
                        )}
                    </div>
                )}
            </Link>
        );
    };

    const sidebarContent = (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
            }}
            className={`h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col justify-between rounded-2xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black text-black px-2 py-2.5 sm:px-2 sm:py-3 select-none transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-2 sm:top-3 left-2 sm:left-3 z-[60] will-change-[width] ${isExpanded
                ? "w-64 sm:w-[264px] shadow-[6px_6px_0px_#000]"
                : "w-[68px] sm:w-[72px] shadow-[4px_4px_0px_#000]"
                }`}
        >
            {/* Top Brand Header */}
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto no-scrollbar overflow-x-hidden">
                <div className={`flex items-center pb-3 pt-0.5 border-b-2 border-black/15 overflow-x-hidden ${isExpanded ? "px-1 justify-start" : "justify-center"}`}>
                    <Link
                        to="/dashboard"
                        onClick={() => handleItemClick("dashboard")}
                        className={`flex items-center group cursor-pointer overflow-x-hidden ${isExpanded ? "gap-3 min-w-0" : "justify-center mx-auto"}`}
                        title="Orbix — AI Powered Ecosystem"
                    >
                        {/* Pure Black Orbix Brand Star Logo (DEAD CENTER when collapsed) */}
                        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <OrbixLogo className="w-full h-full text-black" />
                        </div>

                        {/* Title and Subtitle with overflow-x-hidden and whitespace-nowrap */}
                        {isExpanded && (
                            <div className="flex flex-col min-w-0 overflow-x-hidden animate-fadeIn">
                                <span className="text-2xl font-black tracking-tight text-black leading-tight whitespace-nowrap truncate">
                                    Orbix
                                </span>
                                <span className="text-[11px] font-bold text-neutral-600 whitespace-nowrap truncate">
                                    Empowering Dev Workflows
                                </span>
                            </div>
                        )}
                    </Link>

                    {/* Mobile Close Button */}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="lg:hidden p-1.5 text-black hover:bg-black/10 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer ml-auto"
                            aria-label="Close Sidebar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Main Navigation Items (EXACTLY CENTERED when collapsed) */}
                <div className="pt-3.5 space-y-1.5 px-0.5 pr-1.5">
                    {mainNavItems.map(renderNavItem)}
                </div>

                {/* Subtle Hairline Divider before Collapsible Groups */}
                <div className={`my-3 h-0.5 bg-black/15 overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 2: Events Dropdown Accordion (Clubs, College Events, Event Tracker, Applications) */}
                <div className="space-y-1 overflow-x-hidden">
                    {(!isExpanded && openSection === "events") ? null : (
                        <button
                            type="button"
                            onClick={() => handleToggleSection("events")}
                            className={`flex items-center transition-all group select-none cursor-pointer ${
                                isExpanded
                                    ? "w-full justify-between px-3 py-1.5 rounded-xl hover:bg-black/5"
                                    : "w-11 h-11 mx-auto justify-center rounded-xl hover:bg-black/5"
                            } ${openSection === "events" ? "bg-black/[0.04]" : ""}`}
                            title={!isExpanded ? "Events" : undefined}
                            aria-expanded={openSection === "events"}
                        >
                            <div className={`flex items-center min-w-0 ${isExpanded ? "" : "justify-center"}`}>
                                {!isExpanded && openSection !== "events" && (
                                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                        <CalendarDays className="w-4.5 h-4.5 text-neutral-700 group-hover:text-black stroke-[2.2] flex-shrink-0" />
                                    </span>
                                )}
                                {isExpanded && (
                                    <span className="text-[11px] font-black tracking-wider uppercase whitespace-nowrap truncate text-neutral-800 group-hover:text-black">
                                        Events
                                    </span>
                                )}
                            </div>
                            {isExpanded && (
                                <ChevronDown
                                    className={`w-3.5 h-3.5 text-neutral-600 group-hover:text-black transition-transform duration-200 stroke-[2.5] flex-shrink-0 ${
                                        openSection === "events" ? "rotate-180" : ""
                                    }`}
                                />
                            )}
                        </button>
                    )}

                    <AnimatePresence initial={false}>
                        {openSection === "events" && (
                            <motion.div
                                key="events-items"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="space-y-1.5 overflow-hidden pt-0.5 px-0.5 pr-1.5"
                            >
                                {eventItems.map((item) =>
                                    item.isComingSoon || !item.path ? (
                                        <div
                                            key={item.id}
                                            className="flex items-center h-11 rounded-xl text-xs sm:text-sm font-bold text-neutral-700 select-none overflow-x-hidden relative w-full cursor-default"
                                            title={!isExpanded ? `${item.label} (Coming Soon)` : `${item.label} — Coming Soon`}
                                        >
                                            <div className="flex items-center overflow-x-hidden w-full min-w-0">
                                                {/* SVG Icon: DEAD-CENTER in 44px container */}
                                                <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                                    <span className="w-5 h-5 flex items-center justify-center text-neutral-700">
                                                        {item.icon}
                                                    </span>
                                                </div>

                                                {isExpanded && (
                                                    <span className="whitespace-nowrap truncate overflow-x-hidden animate-fadeIn pl-0.5 text-neutral-800 font-bold">
                                                        {item.label}
                                                    </span>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-2 border-black bg-[#FFE566] text-black text-[10px] font-black tracking-tight whitespace-nowrap flex-shrink-0 mr-1 shadow-[2px_2px_0px_#000] animate-fadeIn">
                                                    <Lock className="w-2.5 h-2.5 text-black stroke-[2.5] flex-shrink-0" />
                                                    <span>Coming soon</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        renderNavItem(item as any)
                                    )
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Divider between Events & Workspaces */}
                <div className={`my-1.5 h-0.5 bg-black/15 overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 3: Club Workspaces Accordion (Direct Member Workspaces) */}
                <div className="space-y-1 overflow-x-hidden">
                    {(!isExpanded && openSection === "workspaces") ? null : (
                        <button
                            type="button"
                            onClick={() => handleToggleSection("workspaces")}
                            className={`flex items-center transition-all group select-none cursor-pointer ${
                                isExpanded
                                    ? "w-full justify-between px-3 py-1.5 rounded-xl hover:bg-black/5"
                                    : "w-11 h-11 mx-auto justify-center rounded-xl hover:bg-black/5"
                            } ${openSection === "workspaces" ? "bg-black/[0.04]" : ""}`}
                            title={!isExpanded ? "Club Workspaces" : undefined}
                            aria-expanded={openSection === "workspaces"}
                        >
                            <div className={`flex items-center min-w-0 ${isExpanded ? "" : "justify-center"}`}>
                                {!isExpanded && openSection !== "workspaces" && (
                                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                        <Briefcase className="w-4.5 h-4.5 text-neutral-700 group-hover:text-black stroke-[2.2] flex-shrink-0" />
                                    </span>
                                )}
                                {isExpanded && (
                                    <span className="text-[11px] font-black tracking-wider uppercase whitespace-nowrap truncate text-neutral-800 group-hover:text-black">
                                        Club Workspaces
                                    </span>
                                )}
                            </div>
                            {isExpanded && (
                                <div className="flex items-center gap-1.5">
                                    {loadingWorkspaces ? (
                                        <span className="w-2 h-2 rounded-full bg-neutral-400 animate-pulse" />
                                    ) : clubWorkspaces.length > 0 ? (
                                        <span className="px-1.5 py-0.2 bg-[#FFE566] text-black border border-black rounded-full text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                            {clubWorkspaces.length}
                                        </span>
                                    ) : null}
                                    <ChevronDown
                                        className={`w-3.5 h-3.5 text-neutral-600 group-hover:text-black transition-transform duration-200 stroke-[2.5] flex-shrink-0 ${
                                            openSection === "workspaces" ? "rotate-180" : ""
                                        }`}
                                    />
                                </div>
                            )}
                        </button>
                    )}

                    <AnimatePresence initial={false}>
                        {openSection === "workspaces" && (
                            <motion.div
                                key="workspaces-items"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="space-y-1.5 overflow-hidden pt-0.5 px-0.5 pr-1.5"
                            >
                                {clubWorkspaces.length > 0 ? (
                                    <>
                                        {clubWorkspaces.map((ws) => {
                                            const isCurrent =
                                                location.pathname.startsWith(`/workspace/${ws.clubId}`) ||
                                                (location.pathname === "/workspace" && clubWorkspaces[0]?.clubId === ws.clubId);

                                            return (
                                                <Link
                                                    key={ws.workspaceId}
                                                    to={`/workspace/${ws.clubId}`}
                                                    onClick={() => {
                                                        if (onTabChange) onTabChange("workspace" as any);
                                                    }}
                                                    className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                                                        isCurrent
                                                            ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black z-10"
                                                            : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                                                    }`}
                                                    title={!isExpanded ? `${ws.clubName} Workspace` : undefined}
                                                >
                                                    {/* Active vertical accent bar */}
                                                    <span
                                                        className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                                            isCurrent && isExpanded ? "bg-black opacity-100" : "bg-transparent opacity-0"
                                                        }`}
                                                    />

                                                    <div className="flex items-center w-full min-w-0">
                                                        {/* Club Icon / Avatar: DEAD-CENTER in 44px container */}
                                                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                                            <div className="w-6 h-6 rounded-md border border-black bg-neutral-100 flex items-center justify-center overflow-hidden font-black text-[10px] text-black shadow-[1px_1px_0px_#000]">
                                                                {ws.clubLogoUrl ? (
                                                                    <img src={ws.clubLogoUrl} alt={ws.clubName} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    ws.clubName.slice(0, 2).toUpperCase()
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Text label only rendered when expanded */}
                                                        {isExpanded && (
                                                            <div className="min-w-0 flex-1 pr-1 animate-fadeIn">
                                                                <p className={`whitespace-nowrap truncate text-xs ${isCurrent ? "font-black text-black" : "font-bold text-neutral-800"}`}>
                                                                    {ws.clubName}
                                                                </p>
                                                                <p className="whitespace-nowrap truncate text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                                                                    {ws.roleTitle || ws.roleName}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Tooltip when rail collapsed */}
                                                    {!isExpanded && (
                                                        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                                                            <span>{ws.clubName}</span>
                                                            <span className="text-[10px] text-neutral-400">({ws.roleTitle || ws.roleName})</span>
                                                        </div>
                                                    )}
                                                </Link>
                                            );
                                        })}

                                        {/* Quick Actions: Join Another Club */}
                                        <div className="pt-1 mt-1 border-t border-black/10 space-y-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsJoinClubModalOpen(true)}
                                                className={`flex items-center rounded-xl text-xs transition-all duration-150 group cursor-pointer w-full bg-[#A6FF70]/30 hover:bg-[#A6FF70] text-black border-2 border-black/30 hover:border-black font-black ${
                                                    isExpanded ? "px-2.5 py-1.5 justify-between" : "w-11 h-11 justify-center mx-auto"
                                                }`}
                                                title={!isExpanded ? "Join Another Club" : undefined}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <UserPlus className="w-3.5 h-3.5 text-black flex-shrink-0" />
                                                    {isExpanded && (
                                                        <span className="truncate text-[11px] font-black text-black">Join Another Club</span>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    /* Zero club workspaces state */
                                    <div className="p-2 text-center">
                                        {isExpanded ? (
                                            <div className="space-y-2 py-1">
                                                <p className="text-[11px] font-bold text-neutral-600">
                                                    No active club workspace
                                                </p>
                                                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                                    <Link
                                                        to="/clubs"
                                                        className="inline-flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-black bg-[#FFE566] hover:bg-[#fedb30] text-black border-2 border-black rounded-xl shadow-neo-xs transition cursor-pointer"
                                                    >
                                                        <Compass className="w-3.5 h-3.5 text-black" />
                                                        <span>Explore Club</span>
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsJoinClubModalOpen(true)}
                                                        className="inline-flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-black bg-[#A6FF70] hover:bg-[#92f557] text-black border-2 border-black rounded-xl shadow-neo-xs transition cursor-pointer"
                                                    >
                                                        <UserPlus className="w-3.5 h-3.5 text-black" />
                                                        <span>Join Club</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1.5 py-1">
                                                <Link
                                                    to="/clubs"
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#FFE566] hover:bg-[#fedb30] text-black border-2 border-black shadow-neo-xs transition-all mx-auto"
                                                    title="Explore Club"
                                                >
                                                    <Compass className="w-4 h-4 text-black" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsJoinClubModalOpen(true)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#A6FF70] hover:bg-[#92f557] text-black border-2 border-black shadow-neo-xs transition-all cursor-pointer mx-auto"
                                                    title="Join Club"
                                                >
                                                    <UserPlus className="w-4 h-4 text-black" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Divider between Workspaces & Documentation */}
                <div className={`my-1.5 h-0.5 bg-black/15 overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 4: Documentation Dropdown Accordion (Blogs, Docs) */}
                <div className="space-y-1 overflow-x-hidden">
                    {(!isExpanded && openSection === "documentation") ? null : (
                        <button
                            type="button"
                            onClick={() => handleToggleSection("documentation")}
                            className={`flex items-center transition-all group select-none cursor-pointer ${
                                isExpanded
                                    ? "w-full justify-between px-3 py-1.5 rounded-xl hover:bg-black/5"
                                    : "w-11 h-11 mx-auto justify-center rounded-xl hover:bg-black/5"
                            } ${openSection === "documentation" ? "bg-black/[0.04]" : ""}`}
                            title={!isExpanded ? "Documentation" : undefined}
                            aria-expanded={openSection === "documentation"}
                        >
                            <div className={`flex items-center min-w-0 ${isExpanded ? "" : "justify-center"}`}>
                                {!isExpanded && openSection !== "documentation" && (
                                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                        <BookOpen className="w-4.5 h-4.5 text-neutral-700 group-hover:text-black stroke-[2.2] flex-shrink-0" />
                                    </span>
                                )}
                                {isExpanded && (
                                    <span className="text-[11px] font-black tracking-wider uppercase whitespace-nowrap truncate text-neutral-800 group-hover:text-black">
                                        Documentation
                                    </span>
                                )}
                            </div>
                            {isExpanded && (
                                <ChevronDown
                                    className={`w-3.5 h-3.5 text-neutral-600 group-hover:text-black transition-transform duration-200 stroke-[2.5] flex-shrink-0 ${
                                        openSection === "documentation" ? "rotate-180" : ""
                                    }`}
                                />
                            )}
                        </button>
                    )}

                    <AnimatePresence initial={false}>
                        {openSection === "documentation" && (
                            <motion.div
                                key="documentation-items"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                className="space-y-1.5 overflow-hidden pt-0.5 px-0.5 pr-1.5"
                            >
                                {documentationItems.map(renderNavItem)}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Bottom Section: Profile Card (DEAD CENTER avatar when collapsed) */}
            <div ref={profileMenuRef} className="pt-2.5 border-t-2 border-black/15 relative flex-shrink-0 z-[70]">
                <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="w-full h-14 flex items-center rounded-xl hover:bg-black/5 border-2 border-transparent hover:border-black/25 transition-all cursor-pointer group text-left relative"
                    title={`${displayName} (${displayEmail})`}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="menu"
                >
                    <div className={`flex items-center w-full ${isExpanded ? "justify-start" : "justify-center"}`}>
                        {/* Circular Avatar: Prominent & Centered with glowing segmented ring */}
                        <div className="flex items-center justify-center flex-shrink-0">
                            <div className="relative flex-shrink-0 w-12 h-12 sm:w-[50px] sm:h-[50px]">
                                {/* Segmented outer ring */}
                                <div
                                    className="absolute inset-0 rounded-full"
                                    style={{
                                        background: `
                conic-gradient(
                    from -75deg,
                    #C084FC 0deg 98deg,
                    #000000 98deg 103deg,
                    #38BDF8 103deg 190deg,
                    #000000 190deg 195deg,
                    #ff80d7ff 195deg 355deg,
                    #000000 355deg 360deg
                )
            `,
                                        padding: "2.5px",
                                    }}
                                >
                                    {/* Dark separator / inner ring */}
                                    <div className="w-full h-full rounded-full bg-black p-[2px]">
                                        {/* Avatar image */}
                                        <div className="w-full h-full rounded-full overflow-hidden bg-white border border-black">
                                            {avatarSrc ? (
                                                <img
                                                    src={avatarSrc}
                                                    alt={displayName}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                    }}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-black flex items-center justify-center font-black text-base text-[#a2ff86]">
                                                    {displayName.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {unreadNotificationsCount > 0 && (
                                    <span className="absolute -top-1 -right-1 z-30 flex h-3.5 w-3.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B6B] opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF6B6B] border border-black shadow-[1px_1px_0px_#000]" />
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Name & Email fade in */}
                        {isExpanded && (
                            <div className="min-w-0 flex-1 overflow-hidden animate-fadeIn pl-2.5">
                                <h4 className="text-xs sm:text-sm font-black text-black whitespace-nowrap truncate group-hover:text-black">
                                    {displayName}
                                </h4>
                                <p className="text-[11px] font-bold text-neutral-600 whitespace-nowrap truncate">
                                    {displayEmail}
                                </p>
                            </div>
                        )}

                        {isExpanded && (
                            <div className="text-black transition-colors p-1 flex-shrink-0 pr-2 ml-auto">
                                <svg
                                    className={`w-4 h-4 transition-transform duration-200 stroke-[2.5] ${isProfileMenuOpen ? "rotate-180" : ""
                                        }`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </div>
                        )}
                    </div>
                </button>

                {/* Profile Popup Menu */}
                {isProfileMenuOpen && (
                    <div
                        role="menu"
                        className={`absolute p-2 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[6px_6px_0px_#000] z-[90] animate-fadeIn text-xs text-black w-64 ${
                            isExpanded
                                ? "bottom-full mb-2 left-0 right-0 w-full"
                                : "bottom-0 left-[calc(100%+12px)]"
                        }`}
                    >
                        <div className="px-3 py-2 border-b-2 border-black/15 mb-1.5">
                            <p className="font-black text-black truncate">{displayName}</p>
                            <p className="text-[11px] font-bold text-neutral-600 truncate">{displayEmail}</p>
                        </div>

                        <Link
                            to="/profile"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("profile");
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="truncate">Developer Profile</span>
                        </Link>

                        <Link
                            to="/notifications"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("notifications");
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.73 21a2 2 0 01-3.46 0" />
                                </svg>
                                <span className="truncate">Notifications</span>
                            </div>
                            {unreadNotificationsCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FF6B6B] text-black border border-black min-w-[18px] text-center leading-none">
                                    {unreadNotificationsCount}
                                </span>
                            )}
                        </Link>

                        <Link
                            to="/onboarding"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("connect-platform");
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                <span className="truncate">Connected Platforms</span>
                            </div>
                            {brokenPortalsCount > 0 ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FF6B6B] text-black border border-black min-w-[18px] text-center leading-none">
                                    {brokenPortalsCount} broken
                                </span>
                            ) : connectedPortalsCount > 0 ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#a2ff86] text-black border border-black min-w-[18px] text-center leading-none">
                                    {connectedPortalsCount}
                                </span>
                            ) : null}
                        </Link>

                        <Link
                            to="/settings"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("settings");
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors"
                        >
                            <Settings className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                            <span className="truncate">Settings</span>
                        </Link>

                        <div className="my-1.5 border-t-2 border-black/15" />

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleSignOut();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-700 font-black hover:bg-rose-100/60 transition-colors cursor-pointer text-left"
                        >
                            <svg className="w-3.5 h-3.5 text-rose-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="truncate">Sign out</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop Fixed Floating Sidebar:
                Fixed-width placeholder rail keeps dashboard width 100% static so UI never hangs or reflows.
                The expanding aside floats on top (absolute top-3 left-3 z-50).
            */}
            <div className="hidden lg:block h-screen sticky top-0 flex-shrink-0 w-[84px] sm:w-[88px] z-50 relative">
                {sidebarContent}
            </div>

            {/* Mobile Responsive Slide-Over Drawer */}
            {isOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex">
                    {/* Backdrop */}
                    <div
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-fadeIn"
                    />

                    {/* Drawer Content */}
                    <div className="relative z-50 p-3 h-full max-w-xs animate-slideRight">
                        {sidebarContent}
                    </div>
                </div>
            )}

            {/* Join Club Workspace Modal */}
            <JoinClubModal
                isOpen={isJoinClubModalOpen}
                onClose={() => setIsJoinClubModalOpen(false)}
                onJoined={() => {
                    loadWorkspaces();
                }}
            />
        </>
    );
};
