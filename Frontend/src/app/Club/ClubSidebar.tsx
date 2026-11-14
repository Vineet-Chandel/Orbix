import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    TrendingUp,
    Edit3,
    Mail,
    LogOut,
    ChevronDown,
    X,
    Settings,
    Building2,
    Award,
    Layers,
    UserPlus,
    Megaphone,
    MessageSquareQuote,
    Globe,
    ExternalLink,
} from "lucide-react";
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
    onTabChange: (tab: ClubTab) => void;
    isOpen: boolean;
    onClose: () => void;
    unreadInboxCount?: number;
    teamPendingCount?: number;
    eventsCount?: number;
    onOpenInbox: () => void;
    onSignOut: () => void;
}

interface ClubCategoryItem {
    id: ClubTab;
    label: string;
    icon: React.ReactNode;
    path: string;
    badge?: string | number;
}

interface ClubNavCategory {
    id: string;
    label: string;
    items: ClubCategoryItem[];
}

export const ClubSidebar = ({
    club,
    activeTab,
    onTabChange,
    isOpen = false,
    onClose,
    unreadInboxCount = 0,
    teamPendingCount = 0,
    eventsCount: _eventsCount = 0,
    onOpenInbox,
    onSignOut,
}: ClubSidebarProps) => {
    const location = useLocation();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    const isExpanded = isOpen || isHovered || isProfileMenuOpen;

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

    const handleItemClick = (tab: ClubTab) => {
        onTabChange(tab);
        if (onClose) onClose();
    };

    // Category-wise Sidebar specification matching personal account structure
    const clubCategories: ClubNavCategory[] = [
        {
            id: "command-center",
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
            label: "04 · CLUB NETWORK",
            items: [
                {
                    id: "announcements",
                    label: "Announcement",
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
        {
            id: "club-identity",
            label: "05 · CLUB IDENTITY",
            items: [
                {
                    id: "profile",
                    label: "Manage Profile",
                    icon: <Edit3 className="w-5 h-5 flex-shrink-0 stroke-[2.2]" />,
                    path: "/club/profile",
                },
            ],
        },
    ];

    const renderNavItem = (item: ClubCategoryItem) => {
        const isCurrentActive =
            activeTab === item.id ||
            (item.path && location.pathname === item.path) ||
            (item.id === "overview" && (location.pathname === "/club/dashboard" || location.pathname === "/club")) ||
            (item.id === "analytics" && (location.pathname.startsWith("/club/analytics") || location.pathname.startsWith("/club/trends"))) ||
            (item.id === "events" && location.pathname.startsWith("/club/events")) ||
            (item.id === "certificates" && location.pathname.startsWith("/club/certificates")) ||
            (item.id === "feedback-surveys" && (location.pathname.startsWith("/club/feedback") || activeTab === "feedback-surveys")) ||
            (item.id === "team" && location.pathname === "/club/team" && activeTab === "team") ||
            (item.id === "team-workspace" && (location.pathname === "/club/team-workspace" || activeTab === "team-workspace")) ||
            (item.id === "recruitment" && (location.pathname === "/club/recruitment" || activeTab === "recruitment")) ||
            (item.id === "announcements" && (location.pathname.startsWith("/club/announcement") || activeTab === "announcements")) ||
            (item.id === "clubs" && (location.pathname.startsWith("/club/clubs") || location.pathname.startsWith("/club/campus-clubs") || location.pathname.startsWith("/club/other-clubs"))) ||
            (item.id === "profile" && (location.pathname.startsWith("/club/profile") || location.pathname.startsWith("/club/manage-profile")));

        return (
            <Link
                key={item.id}
                to={item.path}
                onClick={() => handleItemClick(item.id)}
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
                isOpen
                    ? "fixed top-2 sm:top-3 left-2 sm:left-3 z-[60] w-[280px] max-w-[calc(100vw-1rem)] shadow-[6px_6px_0px_#000]"
                    : isExpanded
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
                    onClick={() => {
                        onTabChange("overview");
                        if (onClose) onClose();
                    }}
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

                {/* Mobile Close Button */}
                {onClose && isExpanded && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="lg:hidden p-1.5 text-black hover:bg-black/10 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all cursor-pointer flex-shrink-0 ml-1.5"
                        aria-label="Close Sidebar"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                )}
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
                                {club.logo_url || club.logoUrl ? (
                                    <img
                                        src={club.logo_url || club.logoUrl || ""}
                                        alt={club.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-xs tracking-tight">
                                        {club.name.slice(0, 2).toUpperCase()}
                                    </span>
                                )}
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
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-black text-black truncate">{club.name}</p>
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-[#a2ff86] text-black border border-black shrink-0">
                                    Club Lead
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-neutral-600 truncate">{club.college_name}</p>
                        </div>

                        {/* Unique Action 1: Public Club Page */}
                        <Link
                            to={`/clubs/${club.slug || club.clubUsername || club.id}`}
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                if (onClose) onClose();
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Globe className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                                <span className="truncate">Public Club Page</span>
                            </div>
                            <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                        </Link>

                        {/* Unique Action 2: Club Inbox */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onOpenInbox();
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Mail className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                                <span className="truncate">Club Inbox</span>
                            </div>
                            {unreadInboxCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FF6B6B] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    {unreadInboxCount}
                                </span>
                            )}
                        </button>

                        {/* Unique Action 3: Settings & Permissions */}
                        <Link
                            to="/club/settings"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("settings");
                                if (onClose) onClose();
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold transition-colors text-left cursor-pointer ${
                                activeTab === "settings"
                                    ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black"
                                    : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent"
                            }`}
                        >
                            <Settings className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === "settings" ? "text-black" : "text-neutral-700"}`} />
                            <span className="truncate">Settings &amp; Permissions</span>
                        </Link>

                        <div className="my-1.5 h-0.5 bg-black/15" />

                        {/* Sign Out */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onSignOut();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 font-black hover:bg-rose-50 transition-colors text-left cursor-pointer"
                        >
                            <LogOut className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                            <span className="truncate">Sign Out</span>
                        </button>
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

            {/* Mobile overlay and backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 lg:hidden"
                    onClick={onClose}
                >
                    <div onClick={(e) => e.stopPropagation()}>{sidebarContent}</div>
                </div>
            )}
        </>
    );
};
