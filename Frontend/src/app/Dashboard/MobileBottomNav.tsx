import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    LayoutDashboard,
    Compass,
    TrendingUp,
    Trophy,
    FileText,
    FolderGit2,
    CalendarDays,
    Users,
    GraduationCap,
    Calendar,
    ClipboardCheck,
    Check,
    Briefcase,
    UserPlus,
    User,
    Bell,
    Link2,
    Settings,
    LogOut,
} from "lucide-react";
import { DEFAULT_AVATAR_URL } from "../../utils/avatarConstants";
import type { SidebarTab } from "./Sidebar";

export interface MobileBottomNavProps {
    activeTab?: SidebarTab;
    onTabChange?: (tab: SidebarTab) => void;
    user?: any;
    displayName: string;
    avatarSrc?: string;
    clubWorkspaces?: any[];
    unreadNotificationsCount?: number;
    connectedPortalsCount?: number;
    brokenPortalsCount?: number;
    onSignOut: () => void;
    onOpenJoinClub: () => void;
}

type NavigationMenuKey = "hub" | "events" | "workspaces" | "profile" | null;

interface SubMenuItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    path?: string;
    action?: () => void;
    badge?: string | number;
    badgeVariant?: "danger" | "default";
    color: string;
}

interface DockTabItem {
    id: "home" | "explore" | "events" | "clubs" | "profile";
    label: string;
    icon: React.ReactNode;
    shaderColor: string;
    hasSubItems: boolean;
    menuKey?: NavigationMenuKey;
    path?: string;
    badge?: number | string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    activeTab,
    onTabChange,
    displayName,
    avatarSrc,
    clubWorkspaces = [],
    unreadNotificationsCount = 0,
    connectedPortalsCount = 0,
    brokenPortalsCount = 0,
    onSignOut,
    onOpenJoinClub,
}) => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeMenu, setActiveMenu] = useState<NavigationMenuKey>(null);

    // Close the menu when route changes or outside-tap occurs
    useEffect(() => {
        setActiveMenu(null);
    }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setActiveMenu(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSelectSubItem = (item: SubMenuItem) => {
        setActiveMenu(null);
        if (item.action) {
            item.action();
        } else if (item.path) {
            navigate(item.path);
            if (onTabChange) {
                onTabChange(item.id as SidebarTab);
            }
        }
    };

    // Sub-items for Option 2: Hub / Explore
    const hubSubItems: SubMenuItem[] = [
        {
            id: "explore",
            label: "Explore",
            icon: <Compass className="w-5 h-5 stroke-[2.3]" />,
            path: "/explore",
            color: "#FFE566",
        },
        {
            id: "trends",
            label: "Trends",
            icon: <TrendingUp className="w-5 h-5 stroke-[2.3]" />,
            path: "/trends",
            color: "#a2ff86",
        },
        {
            id: "leaderboard",
            label: "Ranks",
            icon: <Trophy className="w-5 h-5 stroke-[2.3]" />,
            path: "/leaderboard",
            color: "#FFE566",
        },
        {
            id: "projects",
            label: "Projects",
            icon: <FolderGit2 className="w-5 h-5 stroke-[2.3]" />,
            path: "/projects",
            color: "#38BDF8",
        },
        {
            id: "resume",
            label: "Resume",
            icon: <FileText className="w-5 h-5 stroke-[2.3]" />,
            path: "/resume",
            color: "#ff80d7ff",
        },
    ];

    // Sub-items for Option 3: Events
    const eventsSubItems: SubMenuItem[] = [
        {
            id: "clubs",
            label: "Clubs",
            icon: <Users className="w-5 h-5 stroke-[2.3]" />,
            path: "/college-clubs",
            color: "#A6FF70",
        },
        {
            id: "college-events",
            label: "Events",
            icon: <GraduationCap className="w-5 h-5 stroke-[2.3]" />,
            path: "/college-events",
            color: "#FFE566",
        },
        {
            id: "events",
            label: "Tracker",
            icon: <Calendar className="w-5 h-5 stroke-[2.3]" />,
            path: "/events",
            color: "#38BDF8",
        },
        {
            id: "activity",
            label: "Activity",
            icon: <ClipboardCheck className="w-5 h-5 stroke-[2.3]" />,
            path: "/activity",
            color: "#ff80d7ff",
        },
    ];

    // Sub-items for Option 4: Workspaces
    const workspaceSubItems: SubMenuItem[] =
        clubWorkspaces.length > 0
            ? [
                  ...clubWorkspaces.slice(0, 4).map((ws, i) => ({
                      id: `ws-${ws.clubId}`,
                      label: ws.clubName,
                      icon: ws.clubLogoUrl ? (
                          <img src={ws.clubLogoUrl} alt={ws.clubName} className="w-5 h-5 rounded-md object-cover" />
                      ) : (
                          <span className="font-black text-xs">{ws.clubName.slice(0, 2).toUpperCase()}</span>
                      ),
                      path: `/workspace/${ws.clubId}`,
                      color: ["#FFE566", "#38BDF8", "#a2ff86", "#ff80d7ff"][i % 4],
                  })),
                  {
                      id: "join-club",
                      label: "Join Club",
                      icon: <UserPlus className="w-5 h-5 stroke-[2.3]" />,
                      action: onOpenJoinClub,
                      color: "#A6FF70",
                  },
              ]
            : [
                  {
                      id: "explore-clubs",
                      label: "Explore",
                      icon: <Compass className="w-5 h-5 stroke-[2.3]" />,
                      path: "/college-clubs",
                      color: "#FFE566",
                  },
                  {
                      id: "join-club",
                      label: "Join Club",
                      icon: <UserPlus className="w-5 h-5 stroke-[2.3]" />,
                      action: onOpenJoinClub,
                      color: "#A6FF70",
                  },
              ];

    // Sub-items for Option 5: Profile / Account
    const profileSubItems: SubMenuItem[] = [
        {
            id: "profile",
            label: "Profile",
            icon: <User className="w-5 h-5 stroke-[2.3]" />,
            path: "/profile",
            color: "#a2ff86",
        },
        {
            id: "notifications",
            label: "Inbox",
            icon: <Bell className="w-5 h-5 stroke-[2.3]" />,
            path: "/notifications",
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
            badgeVariant: "danger",
            color: "#FFE566",
        },
        {
            id: "connect-platform",
            label: "Platforms",
            icon: <Link2 className="w-5 h-5 stroke-[2.3]" />,
            path: "/onboarding",
            badge: brokenPortalsCount > 0 ? "!" : connectedPortalsCount > 0 ? connectedPortalsCount : undefined,
            badgeVariant: brokenPortalsCount > 0 ? "danger" : "default",
            color: "#38BDF8",
        },
        {
            id: "settings",
            label: "Settings",
            icon: <Settings className="w-5 h-5 stroke-[2.3]" />,
            path: "/settings",
            color: "#FAF6EE",
        },
        {
            id: "signout",
            label: "Sign Out",
            icon: <LogOut className="w-5 h-5 stroke-[2.3] text-rose-700" />,
            action: onSignOut,
            color: "#ff70a6",
        },
    ];

    // Current active sub-item list
    const activeSubItems: SubMenuItem[] =
        activeMenu === "hub"
            ? hubSubItems
            : activeMenu === "events"
            ? eventsSubItems
            : activeMenu === "workspaces"
            ? workspaceSubItems
            : activeMenu === "profile"
            ? profileSubItems
            : [];

    // Determine currently active dock item for the sliding toggle shader
    const currentActiveId = useMemo((): "home" | "explore" | "events" | "clubs" | "profile" => {
        if (activeMenu === "hub") return "explore";
        if (activeMenu === "events") return "events";
        if (activeMenu === "workspaces") return "clubs";
        if (activeMenu === "profile") return "profile";

        if (location.pathname === "/dashboard" || activeTab === "dashboard") return "home";
        if (
            location.pathname.startsWith("/explore") ||
            location.pathname.startsWith("/trends") ||
            location.pathname.startsWith("/leaderboard") ||
            location.pathname.startsWith("/projects") ||
            location.pathname.startsWith("/resume") ||
            activeTab === "explore" ||
            activeTab === "trends" ||
            activeTab === "leaderboard" ||
            activeTab === "projects" ||
            activeTab === "resume"
        ) {
            return "explore";
        }

        if (
            location.pathname.startsWith("/events") ||
            location.pathname.startsWith("/college-clubs") ||
            location.pathname.startsWith("/campus-clubs") ||
            location.pathname.startsWith("/college-events") ||
            location.pathname.startsWith("/applications") ||
            location.pathname.startsWith("/activity") ||
            activeTab === "events" ||
            activeTab === "clubs" ||
            activeTab === "college-events" ||
            activeTab === "activity"
        ) {
            return "events";
        }

        if (location.pathname.startsWith("/workspace") || activeTab === ("workspace" as any)) {
            return "clubs";
        }

        if (
            location.pathname.startsWith("/profile") ||
            location.pathname.startsWith("/settings") ||
            location.pathname.startsWith("/notifications") ||
            activeTab === "profile" ||
            activeTab === "settings" ||
            activeTab === "notifications"
        ) {
            return "profile";
        }

        return "home";
    }, [activeMenu, location.pathname, activeTab]);

    // The 5 balanced dock tab items
    const dockTabs: DockTabItem[] = [
        {
            id: "home",
            label: "Home",
            icon: <LayoutDashboard className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#a2ff86",
            hasSubItems: false,
            path: "/dashboard",
        },
        {
            id: "explore",
            label: "Explore",
            icon: <Compass className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#FFE566",
            hasSubItems: true,
            menuKey: "hub",
        },
        {
            id: "events",
            label: "Events",
            icon: <CalendarDays className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#A6FF70",
            hasSubItems: true,
            menuKey: "events",
        },
        {
            id: "clubs",
            label: "Clubs",
            icon: <Briefcase className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#38BDF8",
            hasSubItems: true,
            menuKey: "workspaces",
            badge: clubWorkspaces.length > 0 ? clubWorkspaces.length : undefined,
        },
        {
            id: "profile",
            label: "Profile",
            icon: (
                <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
                    {/* Segmented outer ring matching Sidebar.tsx */}
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
                            padding: "1.5px",
                        }}
                    >
                        <div className="w-full h-full rounded-full bg-black p-[1px]">
                            <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
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
                                    <div className="w-full h-full bg-black flex items-center justify-center font-black text-[9px] text-[#a2ff86]">
                                        {displayName.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ),
            shaderColor: "#ff80d7ff",
            hasSubItems: true,
            menuKey: "profile",
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
    ];

    const handleDockTabClick = (item: DockTabItem) => {
        if (item.id === "home") {
            setActiveMenu(null);
            navigate("/dashboard");
            if (onTabChange) onTabChange("dashboard");
            return;
        }

        if (item.hasSubItems && item.menuKey) {
            setActiveMenu((prev) => (prev === item.menuKey ? null : item.menuKey!));
        }
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <>
            <AnimatePresence>
                {activeMenu && (
                    <motion.div
                        key="navigation-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveMenu(null)}
                        className="fixed inset-0 z-[9990] bg-black/50 lg:hidden"
                    />
                )}
            </AnimatePresence>

            <nav
                id="orbix-mobile-bottom-nav"
                aria-label="Mobile navigation"
                className="fixed bottom-[var(--mobile-dock-bottom)] inset-x-0 mx-auto z-[9991] w-[calc(100%-1.5rem)] max-w-md lg:hidden"
            >
                <AnimatePresence>
                    {activeMenu && (
                        <motion.div
                            key={activeMenu}
                            id="orbix-mobile-navigation-menu"
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-[calc(100%+0.75rem)] inset-x-0 grid max-h-[50dvh] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border-2 border-black bg-[#FAF6EE] p-2.5 shadow-[4px_4px_0px_#000]"
                        >
                            {activeSubItems.map((item) => {
                                const isCurrent = item.path && (
                                    item.id === activeTab || matchPath({ path: item.path, end: false }, location.pathname)
                                );
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelectSubItem(item)}
                                        aria-current={isCurrent ? "page" : undefined}
                                        className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border-2 border-black bg-white px-2 py-1.5 text-left text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black aria-[current=page]:bg-[#a2ff86]"
                                    >
                                        <span
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black"
                                            style={{ backgroundColor: item.color }}
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="min-w-0 flex-1 break-words">{item.label}</span>
                                        {item.badge !== undefined && (
                                            <span className={`shrink-0 rounded-full border border-black px-1 text-[10px] ${item.badgeVariant === "danger" ? "bg-[#FF6B6B]" : "bg-[#FFE566]"}`}>
                                                {item.badge}
                                            </span>
                                        )}
                                        {isCurrent && <Check aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[3]" />}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main 5-Option Toggle Dock Bar with Moving Shader */}
                <div className="grid h-[var(--mobile-dock-height)] grid-cols-5 gap-1 rounded-2xl border-2 border-black bg-[#FAF6EE] p-1.5 shadow-[4px_4px_0px_#000]">
                    {dockTabs.map((tab) => {
                        const isActive = currentActiveId === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleDockTabClick(tab)}
                                className="relative flex min-w-0 flex-col items-center justify-center rounded-xl border border-black bg-white text-black shadow-[2px_2px_0px_#000] transition-transform active:scale-95 focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                aria-label={tab.label}
                                aria-controls={activeMenu && activeMenu === tab.menuKey ? "orbix-mobile-navigation-menu" : undefined}
                                aria-current={isActive && !activeMenu && tab.id === "home" ? "page" : undefined}
                                aria-expanded={tab.hasSubItems && tab.menuKey ? activeMenu === tab.menuKey : undefined}
                            >
                                {/* Moving Shader / Active Pill Indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="mobileNavShader"
                                        className="absolute inset-0 rounded-[inherit] pointer-events-none"
                                        style={{ backgroundColor: tab.shaderColor }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 480,
                                            damping: 32,
                                        }}
                                    />
                                )}

                                {/* Icon and Text Content */}
                                <div
                                    className={`relative z-10 flex flex-col items-center justify-center transition-colors duration-150 ${
                                        isActive
                                            ? "text-black font-black"
                                            : "text-neutral-700 hover:text-black font-bold"
                                    }`}
                                >
                                    <div className="relative flex items-center justify-center">
                                        {tab.icon}
                                        {tab.badge !== undefined && (
                                            <span className="absolute -top-1 -right-2 z-20 px-1 h-3.5 min-w-[14px] flex items-center justify-center rounded-full text-[8.5px] font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] leading-none pointer-events-none">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                                        {tab.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>,
        document.body
    );
};
