import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    Users,
    CalendarDays,
    ShieldCheck,
    Edit3,
    Mail,
    LogOut,
    ChevronDown,
    X,
} from "lucide-react";
import { OrbixLogo } from "../../components/OrbixLogo";

interface ClubSidebarProps {
    club: {
        id: string;
        name: string;
        slug: string;
        clubUsername?: string;
        college_name: string;
        logo_url: string | null;
    };
    activeSegment: "dashboard" | "team";
    onSegmentChange: (segment: "dashboard" | "team") => void;
    activeTab?: "overview" | "profile" | "events";
    onTabChange?: (tab: "overview" | "profile" | "events") => void;
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
    activeSegment,
    onSegmentChange,
    activeTab = "overview",
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
            className={`h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col justify-between rounded-2xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black text-black px-2 py-2.5 sm:px-2 sm:py-3 select-none transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-2 sm:top-3 left-2 sm:left-3 z-50 overflow-x-hidden will-change-[width] ${
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
                            onSegmentChange("dashboard");
                            if (onTabChange) onTabChange("overview");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center group cursor-pointer overflow-x-hidden ${
                            isExpanded ? "gap-3 min-w-0" : "justify-center mx-auto"
                        }`}
                        title="Orbix — Empowering Dev Workflows"
                    >
                        {/* Pure Black Orbix Brand Star Logo (DEAD CENTER when collapsed) */}
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <OrbixLogo className="w-full h-full text-black" />
                        </div>

                        {/* Title and Subtitle with overflow-x-hidden and whitespace-nowrap */}
                        {isExpanded && (
                            <div className="flex flex-col min-w-0 overflow-x-hidden text-left animate-fadeIn">
                                <span className="text-base font-black tracking-tight text-black leading-tight whitespace-nowrap truncate">
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

                {/* Main Navigation Items: Exactly 2 primary segments - Dashboard and Team */}
                <div className="pt-3.5 space-y-1.5 overflow-x-hidden">
                    {/* Item 1: Dashboard */}
                    <button
                        type="button"
                        onClick={() => {
                            onSegmentChange("dashboard");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer overflow-x-hidden relative w-full ${
                            activeSegment === "dashboard"
                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Dashboard" : undefined}
                    >
                        {/* Active vertical accent bar */}
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeSegment === "dashboard" && isExpanded
                                    ? "bg-[#a2ff86] opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />

                        <div className="flex items-center overflow-x-hidden w-full">
                            {/* SVG Icon: DEAD-CENTER in 44px container */}
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <span
                                    className={`w-5 h-5 flex items-center justify-center transition-colors ${
                                        activeSegment === "dashboard"
                                            ? "text-[#a2ff86]"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-5 h-5 flex-shrink-0"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            fill="none"
                                            stroke="currentColor"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M2 5a2 2 0 0 1 2-2h6v18H4a2 2 0 0 1-2-2zm12-2h6a2 2 0 0 1 2 2v5h-8zm0 11h8v5a2 2 0 0 1-2 2h-6z"
                                        />
                                    </svg>
                                </span>
                            </div>

                            {/* Text label only rendered when expanded */}
                            {isExpanded && (
                                <span
                                    className={`whitespace-nowrap truncate overflow-x-hidden animate-fadeIn pl-0.5 ${
                                        activeSegment === "dashboard"
                                            ? "text-[#a2ff86] font-black"
                                            : "text-neutral-800 font-bold"
                                    }`}
                                >
                                    Dashboard
                                </span>
                            )}
                        </div>
                    </button>

                    {/* Item 2: Team */}
                    <button
                        type="button"
                        onClick={() => {
                            onSegmentChange("team");
                            if (onClose) onClose();
                        }}
                        className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer overflow-x-hidden relative w-full ${
                            activeSegment === "team"
                                ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                                : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                        }`}
                        title={!isExpanded ? "Team" : undefined}
                    >
                        {/* Active vertical accent bar */}
                        <span
                            className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${
                                activeSegment === "team" && isExpanded
                                    ? "bg-[#a2ff86] opacity-100"
                                    : "bg-transparent opacity-0"
                            }`}
                        />

                        <div className="flex items-center overflow-x-hidden w-full">
                            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                <Users
                                    className={`w-5 h-5 transition-colors stroke-[2.2] ${
                                        activeSegment === "team"
                                            ? "text-[#a2ff86]"
                                            : "text-neutral-700 group-hover:text-black"
                                    }`}
                                />
                            </div>

                            {isExpanded && (
                                <div className="flex items-center justify-between flex-1 pr-2.5 overflow-x-hidden animate-fadeIn">
                                    <span
                                        className={`whitespace-nowrap truncate pl-0.5 ${
                                            activeSegment === "team"
                                                ? "text-[#a2ff86] font-black"
                                                : "text-neutral-800 font-bold"
                                        }`}
                                    >
                                        Team
                                    </span>
                                    {teamPendingCount !== undefined && teamPendingCount > 0 && (
                                        <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border border-black ${
                                                activeSegment === "team"
                                                    ? "bg-[#a2ff86] text-black"
                                                    : "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                            }`}
                                        >
                                            {teamPendingCount}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </button>
                </div>
            </div>

            {/* Bottom Section: Club Profile Card (DEAD CENTER avatar when collapsed) */}
            <div ref={profileMenuRef} className="pt-2.5 border-t-2 border-black/15 relative flex-shrink-0">
                <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="w-full h-14 flex items-center rounded-xl hover:bg-black/5 border-2 border-transparent hover:border-black/25 transition-all cursor-pointer group text-left overflow-hidden relative"
                    title={`${club.name} (${club.college_name})`}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="menu"
                >
                    <div
                        className={`flex items-center overflow-hidden w-full ${
                            isExpanded ? "justify-start" : "justify-center"
                        }`}
                    >
                        {/* Circular Avatar: Prominent & Centered with segmented ring */}
                        <div className="flex items-center justify-center flex-shrink-0">
                            <div className="relative flex-shrink-0 w-12 h-12 sm:w-[50px] sm:h-[50px]">
                                {/* Segmented outer ring matching Personal Account */}
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
                                    <div className="w-full h-full rounded-full bg-black p-[2px]">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-white border border-black flex items-center justify-center font-black text-xs text-neutral-900">
                                            {club.logo_url ? (
                                                <img
                                                    src={club.logo_url}
                                                    alt={club.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-[#FAF6EE] flex items-center justify-center font-black text-xs text-black">
                                                    {club.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Unread badge if any */}
                                {unreadInboxCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B6B] opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#FF6B6B] border border-black" />
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Name & College Details when expanded */}
                        {isExpanded && (
                            <div className="min-w-0 flex-1 overflow-hidden animate-fadeIn pl-2.5">
                                <div className="flex items-center gap-1">
                                    <h4 className="text-xs sm:text-sm font-black text-black whitespace-nowrap truncate group-hover:text-black">
                                        {club.name}
                                    </h4>
                                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                </div>
                                <p className="text-[11px] font-bold text-neutral-600 whitespace-nowrap truncate">
                                    {club.college_name}
                                </p>
                            </div>
                        )}

                        {isExpanded && (
                            <div className="text-black transition-colors p-1 flex-shrink-0 pr-2 ml-auto">
                                <ChevronDown
                                    className={`w-4 h-4 transition-transform duration-200 stroke-[2.5] ${
                                        isProfileMenuOpen ? "rotate-180" : ""
                                    }`}
                                />
                            </div>
                        )}
                    </div>
                </button>

                {/* Profile Popup Menu */}
                {isProfileMenuOpen && (
                    <div
                        role="menu"
                        className="absolute bottom-full mb-2 left-0 right-0 p-2 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[6px_6px_0px_#000] z-50 animate-fadeIn text-xs text-black"
                    >
                        <div className="px-3 py-2 border-b-2 border-black/15 mb-1.5">
                            <p className="font-black text-black truncate">{club.name}</p>
                            <p className="text-[11px] font-bold text-neutral-600 truncate">{club.college_name}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onSegmentChange("dashboard");
                                if (onTabChange) onTabChange("overview");
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
                                onSegmentChange("team");
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <Users className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                                <span className="truncate">Team Workspace</span>
                            </div>
                            {teamPendingCount !== undefined && teamPendingCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FFE566] text-black border border-black min-w-[18px] text-center leading-none">
                                    {teamPendingCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onSegmentChange("dashboard");
                                if (onTabChange) onTabChange("events");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <CalendarDays className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                            <span className="truncate">Events & Workshops</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onSegmentChange("dashboard");
                                if (onTabChange) onTabChange("profile");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors text-left cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" />
                            <span className="truncate">Edit Club Profile</span>
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
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FF6B6B] text-black border border-black min-w-[18px] text-center leading-none">
                                    {unreadInboxCount}
                                </span>
                            )}
                        </button>

                        <div className="my-1.5 h-0.5 bg-black/15" />

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                onSignOut();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-700 font-black hover:bg-rose-100/60 transition-colors cursor-pointer text-left"
                        >
                            <LogOut className="w-3.5 h-3.5 text-rose-700 flex-shrink-0 stroke-[2.5]" />
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
            <div className="hidden lg:block h-screen sticky top-0 flex-shrink-0 w-[84px] sm:w-[88px] z-40 relative">
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
        </>
    );
};
