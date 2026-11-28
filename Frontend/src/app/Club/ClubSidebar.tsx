import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    TrendingUp,
    Edit3,
    Bell,
    LogOut,
    ChevronDown,
    Settings,
    Building2,
    Award,
    Layers,
    UserPlus,
    Megaphone,
    MessageSquareQuote,
    Globe,
} from "lucide-react";
import { MobileNavigationDock, type DockItem } from "../common/MobileNavigationDock";
import { OrbixLogo } from "../../components/OrbixLogo";

export type ClubTab =
    | "overview"
    | "analytics"
    | "events"
    | "certificates"
    | "feedback-surveys"
    | "team"
    | "team-workspace"
    | "recruitment"
    | "announcements"
    | "clubs"
    | "profile"
    | "credibility"
    | "settings";

interface ClubSidebarProps {
    club: {
        id: string;
        name: string;
        slug: string;
        clubUsername?: string;
        college_name: string;
        logo_url: string | null;
        logoUrl?: string | null;
    };
    activeTab: ClubTab;
    unreadInboxCount?: number;
    teamPendingCount?: number;
    onOpenInbox: () => void;
    onSignOut: () => void;
}

interface ClubNavCategory {
    id: string;
    label: string;
    dockLabel: string;
    color: string;
    items: (Omit<DockItem, "id" | "color"> & { id: ClubTab; path: string })[];
}

export const ClubSidebar = ({
    club,
    activeTab,
    unreadInboxCount = 0,
    teamPendingCount = 0,
    onOpenInbox,
    onSignOut,
}: ClubSidebarProps) => {
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    const isExpanded = isHovered || isProfileMenuOpen;

    // Close profile menu when clicking outside or pressing Escape
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

    // Category-wise Sidebar specification matching personal account structure
    const clubCategories: ClubNavCategory[] = [
        {
            id: "command-center",
            dockLabel: "Home",
            color: "#a2ff86",
            label: "01 · COMMAND CENTER",
            items: [
                {
                    id: "overview",
                    label: "Dashboard",
                    icon: <LayoutDashboard className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/dashboard",
                },
                {
                    id: "analytics",
                    label: "Trends & Analytics",
                    icon: <TrendingUp className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/analytics",
                },
            ],
        },
        {
            id: "programs-events",
            dockLabel: "Events",
            color: "#FFE566",
            label: "02 · PROGRAMS & EVENTS",
            items: [
                {
                    id: "events",
                    label: "Events",
                    icon: <CalendarDays className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/events",
                },
                {
                    id: "certificates",
                    label: "Certificates",
                    icon: <Award className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/certificates",
                },
                {
                    id: "feedback-surveys",
                    label: "Feedback & Surveys",
                    icon: <MessageSquareQuote className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/feedback-surveys",
                },
            ],
        },
        {
            id: "people-collaboration",
            dockLabel: "Team",
            color: "#38BDF8",
            label: "03 · PEOPLE & COLLABORATION",
            items: [
                {
                    id: "team",
                    label: "Team",
                    icon: <Users className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/team",
                    badge: teamPendingCount > 0 ? teamPendingCount : undefined,
                },
                {
                    id: "team-workspace",
                    label: "Team Workspace",
                    icon: <Layers className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/team-workspace",
                },
                {
                    id: "recruitment",
                    label: "Recruitment",
                    icon: <UserPlus className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/recruitment",
                },
            ],
        },
        {
            id: "club-network",
            dockLabel: "Network",
            color: "#A6FF70",
            label: "04 · CLUB NETWORK",
            items: [
                {
                    id: "announcements",
                    label: "Announcements",
                    icon: <Megaphone className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/announcements",
                },
                {
                    id: "clubs",
                    label: "Campus Clubs",
                    icon: <Building2 className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/clubs",
                },
            ],
        },
    ];

    const accountItems: DockItem[] = [
        { id: "profile", label: "Manage Profile", icon: <Edit3 size={16} />, path: "/club/profile", color: "#a2ff86", current: activeTab === "profile" },
        { id: "public-page", label: "Public Club Page", icon: <Globe size={16} />, path: `/clubs/${club.slug || club.clubUsername || club.id}`, color: "#38BDF8" },
        {
            id: "notifications",
            label: "Notifications",
            icon: <Bell size={16} />,
            action: onOpenInbox,
            badge: unreadInboxCount || undefined,
            badgeVariant: "danger",
            color: "#FFE566",
        },
        { id: "settings", label: "Settings & Permissions", icon: <Settings size={16} />, path: "/club/settings", color: "#FAF6EE", current: activeTab === "settings" },
        { id: "signout", label: "Sign Out", icon: <LogOut size={16} />, action: onSignOut, color: "#ff80d7ff" },
    ];

    const clubLogo = club.logo_url || club.logoUrl;
    const clubAvatar = clubLogo ? (
        <img src={clubLogo} alt="" className="h-full w-full object-cover" />
    ) : (
        <span className="text-xs tracking-tight">{club.name.slice(0, 2).toUpperCase()}</span>
    );

    const renderNavItem = (item: ClubNavCategory["items"][number]) => {
        const isCurrentActive = activeTab === item.id;

        return (
            <Link
                key={item.id}
                to={item.path}
                aria-current={isCurrentActive ? "page" : undefined}
                className={`flex items-center h-10 sm:h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                    isCurrentActive
                        ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black z-10"
                        : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                }`}
                title={!isExpanded ? item.label : undefined}
            >
                {/* Active vertical accent bar */}
                <span
                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                        isCurrentActive && isExpanded ? "bg-black opacity-100" : "bg-transparent opacity-0"
                    }`}
                />

                <div className="flex items-center w-full min-w-0">
                    {/* SVG Icon: DEAD-CENTER in container */}
                    <div className="w-10 sm:w-11 h-10 sm:h-11 flex items-center justify-center flex-shrink-0">
                        <span
                            className={`w-5 h-5 flex items-center justify-center transition-colors ${
                                isCurrentActive
                                    ? "text-black"
                                    : "text-neutral-700 group-hover:text-black"
                            }`}
                        >
                            {item.icon}
                        </span>
                    </div>

                    {/* Text label only rendered when expanded */}
                    {isExpanded && (
                        <span
                            className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${
                                isCurrentActive ? "text-black font-black" : "text-neutral-800 font-bold"
                            }`}
                        >
                            {item.label}
                        </span>
                    )}
                </div>

                {item.badge !== undefined && isExpanded && (
                    <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors flex-shrink-0 whitespace-nowrap ml-auto mr-2 border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${
                            isCurrentActive
                                ? "bg-black text-[#a2ff86]"
                                : "bg-[#FFE566] text-black"
                        }`}
                    >
                        {item.badge}
                    </span>
                )}

                {/* Floating tooltip when contracted */}
                {!isExpanded && (
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {isCurrentActive && <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />}
                    </div>
                )}
            </Link>
        );
    };

    const sidebarContent = (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col justify-between rounded-2xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-3 border-black text-black px-2 py-2.5 sm:px-2 sm:py-3 select-none transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isExpanded
                    ? "absolute top-2 sm:top-3 left-2 sm:left-3 z-[60] will-change-[width] w-64 sm:w-[264px] shadow-[6px_6px_0px_#000]"
                    : "absolute top-2 sm:top-3 left-2 sm:left-3 z-[60] will-change-[width] w-[68px] sm:w-[72px] shadow-[4px_4px_0px_#000]"
            }`}
        >
            {/* Top Brand Header (Fixed, Never Scrolls) */}
            <div
                className={`flex-shrink-0 pb-3 pt-0.5 border-b-2 border-black/15 flex items-center ${
                    isExpanded ? "px-1 justify-between" : "justify-center"
                }`}
            >
                <Link
                    to="/club/dashboard"
                    className={`flex items-center group cursor-pointer ${
                        isExpanded ? "gap-2.5 min-w-0 flex-1" : "justify-center mx-auto"
                    }`}
                    title="Orbix — Empowering Dev Workflows"
                >
                    {/* Pure Black Orbix Brand Star Logo (DEAD CENTER when collapsed) */}
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <OrbixLogo className="w-full h-full text-black" />
                    </div>

                    {/* Title and Subtitle with overflow-x-hidden and whitespace-nowrap */}
                    {isExpanded && (
                        <div className="flex flex-col min-w-0 overflow-hidden text-left animate-fadeIn">
                            <span className="text-xl sm:text-2xl font-black tracking-tight text-black leading-tight truncate">
                                Orbix
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-bold text-neutral-600 truncate">
                                Empowering Dev Workflows
                            </span>
                        </div>
                    )}
                </Link>

            </div>

            {/* Category-Wise Navigation Groups (Scrollable) */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar overflow-x-hidden pt-2.5 pb-2 px-0.5 pr-1 space-y-1">
                {clubCategories.map((category, index) => (
                    <div key={category.id} className="space-y-0.5">
                        {/* Divider between categories */}
                        {index > 0 && (
                            <div
                                className={`my-2 h-0.5 bg-black/15 overflow-x-hidden ${
                                    isExpanded ? "w-full" : "w-8 mx-auto"
                                }`}
                            />
                        )}

                        {/* Category Header Label (rendered when expanded) */}
                        {isExpanded && (
                            <div className="px-2 pt-1 pb-1">
                                <span className="text-[10px] font-black tracking-wider uppercase text-neutral-500 font-mono select-none block truncate">
                                    {category.label}
                                </span>
                            </div>
                        )}

                        {/* Category items */}
                        <div className="space-y-1">
                            {category.items.map(renderNavItem)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Section: Club Profile Card (DEAD CENTER avatar when collapsed) */}
            <div ref={profileMenuRef} className="pt-2.5 border-t-2 border-black/15 relative flex-shrink-0 z-[70]">
                <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="w-full h-14 flex items-center rounded-xl hover:bg-black/5 border-2 border-transparent hover:border-black/25 transition-all cursor-pointer group text-left relative"
                    title={`${club.name} (${club.college_name})`}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="menu"
                >
                    {/* Fixed 44px container centering the club logo / initials avatar */}
                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 pl-0.5">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center font-black text-black overflow-hidden relative group-hover:scale-105 transition-transform">
                                {clubAvatar}
                            </div>
                            {unreadInboxCount > 0 && (
                                <span className="absolute -top-1 -right-1 z-30 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B6B] opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF6B6B] border border-black shadow-[1px_1px_0px_#000]" />
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Metadata text & Chevron: only rendered when sidebar is expanded */}
                    {isExpanded && (
                        <div className="flex items-center justify-between flex-1 min-w-0 pr-1 pl-2.5 animate-fadeIn">
                            <div className="flex flex-col min-w-0 pr-2">
                                <span className="text-xs font-black text-black leading-snug truncate">
                                    {club.name}
                                </span>
                                <span className="text-[10px] font-bold text-neutral-600 truncate">
                                    {club.college_name}
                                </span>
                            </div>
                            <ChevronDown
                                className={`w-4 h-4 text-black transition-transform duration-200 flex-shrink-0 ${
                                    isProfileMenuOpen ? "rotate-180" : ""
                                }`}
                            />
                        </div>
                    )}
                </button>

                {/* Profile Popup Menu */}
                {isProfileMenuOpen && (
                    <div
                        role="menu"
                        className={`absolute w-64 bg-[#FAF6EE] border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-2 z-[90] text-xs animate-in fade-in duration-150 space-y-1 ${
                            isExpanded
                                ? "bottom-full left-0 mb-2 slide-in-from-bottom-2"
                                : "bottom-0 left-[calc(100%+12px)] slide-in-from-left-2"
                        }`}
                    >
                        {/* Club Account Header */}
                        <div className="px-3 py-2 border-b-2 border-black/15 mb-1.5 space-y-0.5">
                            <p className="font-black text-black truncate">{club.name}</p>
                            <p className="text-[10px] font-bold text-neutral-600 truncate">{club.college_name}</p>
                        </div>

                        {accountItems.map((item) => {
                            const props = {
                                className: `flex w-full items-center gap-2.5 rounded-xl border-2 border-transparent px-3 py-2 text-left font-bold transition-colors hover:bg-black/5 aria-[current=page]:border-black aria-[current=page]:bg-[#a2ff86] aria-[current=page]:font-black ${item.id === "signout" ? "text-rose-600" : "text-neutral-800"}`,
                                "aria-current": item.current ? "page" as const : undefined,
                                onClick: () => {
                                    setIsProfileMenuOpen(false);
                                    item.action?.();
                                },
                            };
                            const content = (
                                <>
                                    {item.icon}
                                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                    {item.badge !== undefined && (
                                        <span className="rounded-full border border-black bg-[#FF6B6B] px-1.5 text-[10px] font-black text-black">
                                            {item.badge}
                                        </span>
                                    )}
                                </>
                            );
                            return item.path ? (
                                <Link key={item.id} to={item.path} {...props}>{content}</Link>
                            ) : (
                                <button key={item.id} type="button" {...props}>{content}</button>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop persistent sidebar:
                Fixed-width placeholder rail (88px on sm/lg) keeps dashboard width static
                and provides a regular 12px gap to the main display card.
            */}
            <div className="hidden lg:block h-screen sticky top-0 flex-shrink-0 w-[84px] sm:w-[88px] z-50 relative">
                {sidebarContent}
            </div>

            <MobileNavigationDock
                layerClassName="z-40"
                currentTab={
                    activeTab === "profile" || activeTab === "settings" ? "account" :
                    clubCategories.find((category) => category.items.some((item) => item.id === activeTab))?.id ?? "command-center"
                }
                tabs={[
                    ...clubCategories.map((category) => ({
                        id: category.id,
                        label: category.dockLabel,
                        icon: category.items[0].icon,
                        shaderColor: category.color,
                        badge: category.id === "people-collaboration" ? teamPendingCount || undefined : undefined,
                        items: category.items.map((item) => ({
                            ...item,
                            current: activeTab === item.id,
                            color: category.color,
                        })),
                    })),
                    {
                        id: "account",
                        label: "Account",
                        icon: <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-black bg-[#FAF6EE]">{clubAvatar}</span>,
                        shaderColor: "#ff80d7ff",
                        badge: unreadInboxCount || undefined,
                        items: accountItems,
                    },
                ]}
            />
        </>
    );
};
