import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

type ArcMenuKey = "hub" | "events" | "workspaces" | "profile" | null;

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
    arcKey?: ArcMenuKey;
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
    const [activeArc, setActiveArc] = useState<ArcMenuKey>(null);
    const navRef = useRef<HTMLDivElement>(null);

    // Close arc menu when route changes or outside-tap occurs
    useEffect(() => {
        setActiveArc(null);
    }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setActiveArc(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSelectSubItem = (item: SubMenuItem) => {
        setActiveArc(null);
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
                      label: ws.clubName.slice(0, 10),
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
        activeArc === "hub"
            ? hubSubItems
            : activeArc === "events"
            ? eventsSubItems
            : activeArc === "workspaces"
            ? workspaceSubItems
            : activeArc === "profile"
            ? profileSubItems
            : [];

    // Determine currently active dock item for the sliding toggle shader
    const currentActiveId = useMemo((): "home" | "explore" | "events" | "clubs" | "profile" => {
        if (activeArc === "hub") return "explore";
        if (activeArc === "events") return "events";
        if (activeArc === "workspaces") return "clubs";
        if (activeArc === "profile") return "profile";

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
    }, [activeArc, location.pathname, activeTab]);

    // Geometry calculation for circular circumference fan-out:
    // Orbit container dimensions
    const CONTAINER_W = 340;
    const CX = CONTAINER_W / 2; // 170
    const CY = 155; // Bottom anchor point
    const RADIUS = 126; // Arc radius in px
    const BUTTON_SIZE = 46;
    const HALF_BTN = BUTTON_SIZE / 2; // 23
    const totalItems = activeSubItems.length;
    const startAngle = 160; // Left angle (deg)
    const endAngle = 20;   // Right angle (deg)

    // Calculate SVG dashed path mathematically aligned with the node centers
    const svgArcPath = useMemo(() => {
        const radStart = (166 * Math.PI) / 180;
        const radEnd = (14 * Math.PI) / 180;
        const x1 = CX + RADIUS * Math.cos(radStart);
        const y1 = CY - RADIUS * Math.sin(radStart);
        const x2 = CX + RADIUS * Math.cos(radEnd);
        const y2 = CY - RADIUS * Math.sin(radEnd);
        return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    }, [CX, CY, RADIUS]);

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
            arcKey: "hub",
        },
        {
            id: "events",
            label: "Events",
            icon: <CalendarDays className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#A6FF70",
            hasSubItems: true,
            arcKey: "events",
        },
        {
            id: "clubs",
            label: "Clubs",
            icon: <Briefcase className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#38BDF8",
            hasSubItems: true,
            arcKey: "workspaces",
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
            arcKey: "profile",
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
    ];

    const handleDockTabClick = (item: DockTabItem) => {
        if (item.id === "home") {
            setActiveArc(null);
            navigate("/dashboard");
            if (onTabChange) onTabChange("dashboard");
            return;
        }

        if (item.hasSubItems && item.arcKey) {
            setActiveArc((prev) => (prev === item.arcKey ? null : item.arcKey!));
        }
    };

    return (
        <>
            {/* Backdrop Dimmer when Circular Circumference Arc is Active */}
            <AnimatePresence>
                {activeArc && (
                    <motion.div
                        key="arc-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => setActiveArc(null)}
                        className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-xs lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sticky Bottom Navigation Container (Mobile only, overlay on full screen) */}
            <div
                ref={navRef}
                id="orbix-mobile-bottom-nav"
                className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:bottom-3 inset-x-0 mx-auto z-[9990] w-[calc(100%-1rem)] max-w-[420px] lg:hidden select-none"
            >
                {/* Radial Circular Circumference Menu Overlay */}
                <AnimatePresence>
                    {activeArc && (
                        <div className="absolute bottom-[calc(100%+0.6rem)] inset-x-0 mx-auto flex flex-col items-center pointer-events-none">
                            {/* Circular Circumference Orbit Area */}
                            <div className="relative w-[340px] h-[155px] pointer-events-none overflow-visible">
                                {/* Dashed Orbit Circumference Guideline (100% aligned with node centers) */}
                                <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                                    viewBox="0 0 340 155"
                                >
                                    <path
                                        d={svgArcPath}
                                        fill="none"
                                        stroke="#000000"
                                        strokeWidth="2.5"
                                        strokeDasharray="6 6"
                                        strokeLinecap="round"
                                        className="opacity-35"
                                    />
                                </svg>

                                {/* Sequence Nodes Placed Along the Circumference */}
                                {activeSubItems.map((item, idx) => {
                                    const angleDeg =
                                        totalItems <= 1
                                            ? 90
                                            : startAngle - idx * ((startAngle - endAngle) / (totalItems - 1));
                                    const angleRad = (angleDeg * Math.PI) / 180;
                                    const nodeCenterX = CX + RADIUS * Math.cos(angleRad);
                                    const nodeCenterY = CY - RADIUS * Math.sin(angleRad);

                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{
                                                scale: 0,
                                                opacity: 0,
                                            }}
                                            animate={{
                                                scale: 1,
                                                opacity: 1,
                                            }}
                                            exit={{
                                                scale: 0,
                                                opacity: 0,
                                                transition: { duration: 0.12 },
                                            }}
                                            transition={{
                                                type: "spring",
                                                stiffness: 440,
                                                damping: 24,
                                                delay: idx * 0.035, // Staggered sequence from corner to corner
                                            }}
                                            style={{
                                                left: `${nodeCenterX - HALF_BTN}px`,
                                                top: `${nodeCenterY - HALF_BTN}px`,
                                                width: `${BUTTON_SIZE}px`,
                                            }}
                                            className="absolute pointer-events-auto flex flex-col items-center group cursor-pointer"
                                            onClick={() => handleSelectSubItem(item)}
                                        >
                                            {/* Sub-item Button Node (Centered exactly on orbit line) */}
                                            <div
                                                className="w-[46px] h-[46px] rounded-full border-2 border-black flex items-center justify-center text-black font-black shadow-[3px_3px_0px_#000] group-hover:scale-110 group-active:translate-x-0.5 group-active:translate-y-0.5 group-active:shadow-[1px_1px_0px_#000] transition-transform relative select-none"
                                                style={{ backgroundColor: item.color }}
                                            >
                                                {item.icon}

                                                {/* Optional Notification/Alert Beacon */}
                                                {item.badge !== undefined && (
                                                    <span className="absolute -top-1 -right-1 z-30 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#FF6B6B] text-black border border-black text-[9px] font-black shadow-[1px_1px_0px_#000]">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Label Pill Attached Below Node */}
                                            <span className="mt-1 px-1.5 py-0.5 rounded-md bg-[#FAF6EE] text-black border border-black text-[9.5px] font-black uppercase tracking-tight whitespace-nowrap shadow-[1px_1px_0px_#000] select-none pointer-events-none group-hover:bg-white transition-colors">
                                                {item.label}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Main 5-Option Toggle Dock Bar with Moving Shader */}
                <div className="relative bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] border-2 sm:border-3 border-black shadow-[4px_4px_0px_#000] rounded-2xl px-1.5 py-1 flex items-center justify-between">
                    {dockTabs.map((tab) => {
                        const isActive = currentActiveId === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleDockTabClick(tab)}
                                className="relative flex-1 h-12 flex flex-col items-center justify-center cursor-pointer select-none transition-transform active:scale-95"
                                aria-label={tab.label}
                                aria-expanded={tab.hasSubItems && tab.arcKey ? activeArc === tab.arcKey : undefined}
                            >
                                {/* Moving Shader / Active Pill Indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="mobileNavShader"
                                        className="absolute inset-0.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]"
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
            </div>
        </>
    );
};
