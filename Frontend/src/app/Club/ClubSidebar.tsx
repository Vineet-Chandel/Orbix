import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    Edit3,
    Mail,
    LogOut,
    ChevronDown,
    X,
    Settings,
    Building2,
} from "lucide-react";
import { OrbixLogo } from "../../components/OrbixLogo";

export type ClubTab = "overview" | "team" | "events" | "profile" | "clubs" | "settings";

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

export const ClubSidebar = ({
    club,
    activeTab,
    onTabChange,
    isOpen = false,
    onClose,
    unreadInboxCount = 0,
    teamPendingCount = 0,
    eventsCount = 0,
    onOpenInbox,
    onSignOut,
}: ClubSidebarProps) => {
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

    const sidebarContent = (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col justify-between rounded-2xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black text-black px-2 py-2.5 sm:px-2 sm:py-3 select-none transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-2 sm:top-3 left-2 sm:left-3 z-[60] will-change-[width] ${
                isExpanded
                    ? "w-64 sm:w-[264px] shadow-[6px_6px_0px_#000]"
                    : "w-[68px] sm:w-[72px] shadow-[4px_4px_0px_#000]"
            }`}
        >
            {/* Top Brand Header */}
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto no-scrollbar overflow-x-hidden">
                <div
                    className={`flex items-center pb-3 pt-0.5 border-b-2 border-black/15 overflow-x-hidden ${
                        isExpanded ? "px-1 justify-start" : "justify-center"
                    }`}
                >
                    <button
                        type="button"
                        onClick={() => {
                            onTabChange("overview");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center group cursor-pointer overflow-x-hidden ${
                            isExpanded ? "gap-3 min-w-0" : "justify-center mx-auto"
                        }`}
                        title="Orbix — Empowering Dev Workflows"
                    >
                        {/* Pure Black Orbix Brand Star Logo (DEAD CENTER when collapsed) */}
                        <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <OrbixLogo className="w-full h-full text-black" />
                        </div>

                        {/* Title and Subtitle with overflow-x-hidden and whitespace-nowrap */}
                        {isExpanded && (
                            <div className="flex flex-col min-w-0 overflow-x-hidden text-left animate-fadeIn">
                                <span className="text-2xl font-black tracking-tight text-black leading-tight whitespace-nowrap truncate">
                                    Orbix
                                </span>
                                <span className="text-[11px] font-bold text-neutral-600 whitespace-nowrap truncate">
                                    Empowering Dev Workflows
                                </span>
                            </div>
                        )}
                    </button>

                    {/* Mobile Close Button */}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="lg:hidden p-1.5 text-black hover:bg-black/10 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer ml-auto"
                            aria-label="Close Sidebar"
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    )}
                </div>

                {/* Main Navigation Items */}
                <div className="pt-3.5 space-y-1.5 overflow-x-hidden">
                    {/* Item 1: Dashboard Overview */}
                    <button
                        type="button"
                        onClick={() => {
                            onTabChange("overview");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                            activeTab === "overview"
                                ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Dashboard" : undefined}
                    >
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeTab === "overview" && isExpanded
                                    ? "bg-black opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />
                        <div className="flex items-center w-full">
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <LayoutDashboard
                                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                        activeTab === "overview"
                                            ? "text-black"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                />
                            </div>
                            {isExpanded && (
                                <span
                                    className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${
                                        activeTab === "overview"
                                            ? "text-black font-black"
                                            : "text-neutral-800 font-bold"
                                    }`}
                                >
                                    Dashboard
                                </span>
                            )}
                        </div>

                        {/* Floating tooltip when contracted */}
                        {!isExpanded && (
                            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                                <span>Dashboard</span>
                                {activeTab === "overview" && <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />}
                            </div>
                        )}
                    </button>

                    {/* Item 2: Team Workspace */}
                    <button
                        type="button"
                        onClick={() => {
                            onTabChange("team");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                            activeTab === "team"
                                ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Team Workspace" : undefined}
                    >
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeTab === "team" && isExpanded
                                    ? "bg-black opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />
                        <div className="flex items-center w-full">
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <Users
                                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                        activeTab === "team"
                                            ? "text-black"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                />
                            </div>
                            {isExpanded && (
                                <div className="flex items-center justify-between flex-1 min-w-0 pr-2">
                                    <span
                                        className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${
                                            activeTab === "team"
                                                ? "text-black font-black"
                                                : "text-neutral-800 font-bold"
                                        }`}
                                    >
                                        Team
                                    </span>
                                    {teamPendingCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-black text-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] flex-shrink-0 ml-2">
                                            {teamPendingCount}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Floating tooltip when contracted */}
                        {!isExpanded && (
                            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                                <span>Team Workspace</span>
                                {activeTab === "team" && <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />}
                            </div>
                        )}
                    </button>

                    {/* Item 3: Events & Workshops */}
                    <button
                        type="button"
                        onClick={() => {
                            onTabChange("events");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                            activeTab === "events"
                                ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Events & Workshops" : undefined}
                    >
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeTab === "events" && isExpanded
                                    ? "bg-black opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />
                        <div className="flex items-center w-full">
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <CalendarDays
                                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                        activeTab === "events"
                                            ? "text-black"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                />
                            </div>
                            {isExpanded && (
                                <div className="flex items-center justify-between flex-1 min-w-0 pr-2">
                                    <span
                                        className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${
                                            activeTab === "events"
                                                ? "text-black font-black"
                                                : "text-neutral-800 font-bold"
                                        }`}
                                    >
                                        Events
                                    </span>
                                    {eventsCount > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-black text-[#FFE566] border border-black shadow-[1px_1px_0px_#000] flex-shrink-0 ml-2">
                                            {eventsCount}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Floating tooltip when contracted */}
                        {!isExpanded && (
                            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                                <span>Events & Workshops</span>
                                {activeTab === "events" && <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />}
                            </div>
                        )}
                    </button>

                    {/* Item 4: Manage Profile */}
                    <button
                        type="button"
                        onClick={() => {
                            onTabChange("profile");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                            activeTab === "profile"
                                ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Manage Profile" : undefined}
                    >
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeTab === "profile" && isExpanded
                                    ? "bg-black opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />
                        <div className="flex items-center w-full">
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <Edit3
                                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                        activeTab === "profile"
                                            ? "text-black"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                />
                            </div>
                            {isExpanded && (
                                <span
                                    className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${
                                        activeTab === "profile"
                                            ? "text-black font-black"
                                            : "text-neutral-800 font-bold"
                                    }`}
                                >
                                    Manage Profile
                                </span>
                            )}
                        </div>

                        {/* Floating tooltip when contracted */}
                        {!isExpanded && (
                            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                                <span>Manage Profile</span>
                                {activeTab === "profile" && <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />}
                            </div>
                        )}
                    </button>

                    {/* Item 5: Other Clubs */}
                    <button
                        type="button"
                        onClick={() => {
                            onTabChange("clubs");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer relative w-full ${
                            activeTab === "clubs"
                                ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Campus Clubs" : undefined}
                    >
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeTab === "clubs" && isExpanded
                                    ? "bg-black opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />
                        <div className="flex items-center w-full">
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <Building2
                                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                                        activeTab === "clubs"
                                            ? "text-black"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                />
                            </div>
                            {isExpanded && (
                                <span
                                    className={`whitespace-nowrap truncate animate-fadeIn pl-0.5 ${
                                        activeTab === "clubs"
                                            ? "text-black font-black"
                                            : "text-neutral-800 font-bold"
                                    }`}
                                >
                                    Campus Clubs
                                </span>
                            )}
                        </div>

                        {/* Floating tooltip when contracted */}
                        {!isExpanded && (
                            <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-xl bg-black text-white text-xs font-black border-2 border-black shadow-[3px_3px_0px_#a2ff86] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[90] whitespace-nowrap hidden sm:flex items-center gap-1.5">
                                <span>Campus Clubs</span>
                                {activeTab === "clubs" && <span className="w-1.5 h-1.5 rounded-full bg-[#a2ff86]" />}
                            </div>
                        )}
                    </button>
                </div>
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
                        className={`absolute w-64 bg-[#FAF6EE] border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-2 z-[90] text-xs animate-in fade-in duration-150 space-y-0.5 ${
                            isExpanded
                                ? "bottom-full left-0 mb-2 slide-in-from-bottom-2"
                                : "bottom-0 left-[calc(100%+12px)] slide-in-from-left-2"
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("overview");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <LayoutDashboard className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                            <span className="truncate">Overview Dashboard</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("team");
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Users className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                                <span className="truncate">Team Workspace</span>
                            </div>
                            {teamPendingCount !== undefined && teamPendingCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    {teamPendingCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("events");
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <CalendarDays className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                                <span className="truncate">Events & Workshops</span>
                            </div>
                            {eventsCount !== undefined && eventsCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    {eventsCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("profile");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                            <span className="truncate">Manage Profile</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("clubs");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <Building2 className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                            <span className="truncate">Campus Clubs</span>
                        </button>

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

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onTabChange("settings");
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-bold transition-colors text-left cursor-pointer ${
                                activeTab === "settings"
                                    ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_#000] font-black"
                                    : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent"
                            }`}
                        >
                            <Settings className={`w-3.5 h-3.5 flex-shrink-0 ${activeTab === "settings" ? "text-black" : "text-neutral-700"}`} />
                            <span className="truncate">Settings</span>
                        </button>

                        <div className="my-1.5 h-0.5 bg-black/15" />

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
