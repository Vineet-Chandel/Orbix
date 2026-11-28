import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { MobileNavigationDock, type DockItem, type DockTab } from "../common/MobileNavigationDock";
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
    // Sub-items for Option 2: Hub / Explore
    const hubSubItems: DockItem[] = [
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
    const eventsSubItems: DockItem[] = [
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
    const workspaceSubItems: DockItem[] =
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
    const profileSubItems: DockItem[] = [
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

    // Determine currently active dock item for the sliding toggle shader
    const currentActiveId = useMemo((): "home" | "explore" | "events" | "clubs" | "profile" => {
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
    }, [location.pathname, activeTab]);

    // The 5 balanced dock tab items
    const dockTabs: DockTab[] = [
        {
            id: "home",
            label: "Home",
            icon: <LayoutDashboard className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#a2ff86",
            path: "/dashboard",
        },
        {
            id: "explore",
            label: "Explore",
            icon: <Compass className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#FFE566",
            items: hubSubItems.map((item) => ({ ...item, current: item.id === activeTab || undefined })),
        },
        {
            id: "events",
            label: "Events",
            icon: <CalendarDays className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#A6FF70",
            items: eventsSubItems.map((item) => ({ ...item, current: item.id === activeTab || undefined })),
        },
        {
            id: "clubs",
            label: "Clubs",
            icon: <Briefcase className="w-5 h-5 stroke-[2.3]" />,
            shaderColor: "#38BDF8",
            items: workspaceSubItems.map((item) => ({ ...item, current: item.id === activeTab || undefined })),
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
            items: profileSubItems.map((item) => ({ ...item, current: item.id === activeTab || undefined })),
            badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
        },
    ];

    return (
        <MobileNavigationDock
            tabs={dockTabs}
            currentTab={currentActiveId}
            onItemSelect={(item) => {
                if (item.path) onTabChange?.(item.id === "home" ? "dashboard" : item.id as SidebarTab);
            }}
        />
    );
};
