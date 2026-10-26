import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAppDispatch, useAppSelector, clearUser } from "../../store";
import { fetchUnreadNotificationCount } from "../../utils/profileApi";

export type SidebarTab =
    | "home"
    | "dashboard"
    | "trends"
    | "notifications"
    | "leaderboard"
    | "events"
    | "clubs"
    | "college-events"
    | "applications"
    | "connect-platform"
    | "profile"
    | "resume"
    | "projects"
    | "blogs"
    | "docs"
    | "codexa"
    | "evolexa"
    | "flowexa";

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
    const avatarSrc = user?.photoUrl || user?.avatarUrl || (user as any)?.avatar || "/avatar.png";

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
            id: "connect-platform" as SidebarTab,
            label: "Connect Platform",
            badge: brokenPortalsCount > 0 ? `${brokenPortalsCount} broken` : connectedPortalsCount > 0 ? `${connectedPortalsCount}` : undefined,
            badgeVariant: brokenPortalsCount > 0 ? ("danger" as const) : ("default" as const),
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
            ),
            path: "/onboarding",
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
            isComingSoon: true,
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
            isComingSoon: true,
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
            id: "applications" as SidebarTab,
            label: "Applications",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <path d="m9 14 2 2 4-4" />
                </svg>
            ),
            isComingSoon: true,
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

    // Workspace redirections: Codexa, Evolexa, Flowexa
    const workspaceItems = [
        {
            id: "codexa" as SidebarTab,
            name: "Codexa",
            description: "Code & Compiler Workspace",
            url: "https://github.com",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 141 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M28.001 9.5L2.50104 54.5C0.998939 58.5834 0.64081 60.8842 0.501038 65C0.938524 68.5876 1.28381 70.4643 2.50104 73L30.001 120.5C35.4895 125.639 38.9529 126.875 45.501 127.5H99.001C105.055 125.113 108.146 123.091 113.001 118L138.001 74.5C137.555 72.8604 137.011 72.6945 136.001 72.5H120.501C115.678 74.645 113.297 76.327 109.501 80C100.469 95.3741 95.8945 104.483 85.001 118C79.395 121.617 75.9883 122.881 69.001 122.5C61.7381 121.647 58.3542 120.112 53.501 115.5L26.501 70C24.9477 65.1254 24.8433 61.7609 27.501 57L52.501 14.5C56.0812 9.93194 58.5322 7.57464 64.001 6H73.501C80.5078 6.26746 82.9476 8.58767 87.501 13C95.4738 21.4342 94.5253 25.7724 102.001 37C105.329 43.6932 111.503 52.4157 121.001 56H137.501C138.562 54.4501 138.56 53.4612 137.501 51.5L110.001 6.5C104.567 2.11059 101.303 0.697955 95.001 0.5H42.001C35.9066 2.76829 32.8347 4.72468 28.001 9.5Z" fill="currentColor" />
                    <path d="M73.001 28.5L72.501 12.5C70.7058 11.0543 69.8735 11.3238 68.501 12.5V28.5C66.6181 38.531 63.7181 43.4648 56.501 51.5C48.4748 57.6826 43.6156 60.3666 33.501 62C31.6617 63.574 30.9902 64.4922 33.501 66.5C43.8214 67.5752 48.5852 70.34 56.501 76.5C62.7019 83.5583 65.51 88.1063 68.501 98V115.5C70.2071 116.947 71.1914 116.977 73.001 115.5V98C75.4015 88.542 78.0024 83.8767 84.501 76.5C91.0133 71.4181 95.0765 69.1031 103.501 66.5H139.001C140.933 64.5141 140.478 63.5826 139.001 62L103.501 61.5C95.2528 59.0485 91.2098 56.5163 84.501 51C78.304 44.7688 75.3678 39.8531 73.001 28.5Z" fill="currentColor" />
                </svg>
            ),
        },
        {
            id: "evolexa" as SidebarTab,
            name: "Evolexa",
            description: "AI Evolution & Insights",
            url: "https://huggingface.co",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" viewBox="0 0 121 89" fill="none">
                    <path d="M1.70876 4.5C0.12191 2.90864 0.0724409 1.99494 1.70876 0.5H117.709C119.545 1.97671 119.977 2.8261 117.709 4.5C104.181 12.5622 98.954 17.9449 94.2088 29C92.6688 30.6466 91.6861 30.6173 89.7088 29C79.7437 10.5806 72.2203 6.69689 59.7088 6.5C45.4453 8.09559 38.2192 11.668 31.7088 27.5C30.4283 40.9054 30.4372 48.3489 31.7088 61.5C37.9917 76.5533 44.5975 80.7771 60.7088 82.5C77.7677 78.9809 83.6949 73.7856 89.7088 60.5C91.7028 57.2348 93.1523 57.7809 94.7085 60.5C102.674 75.3508 108.536 78.7372 119.209 84C119.834 85.9888 119.8 86.9752 117.709 88H1.70876C0.183632 86.2274 0.0547327 85.3401 1.70876 84C13.7194 76.5162 20.6745 70.4354 22.7088 61.5C24.6139 49.0868 24.218 41.4629 22.7088 27.5C18.6733 17.3207 14.491 12.1814 1.70876 4.5Z" fill="currentColor" />
                    <path d="M62.7085 19C61.538 18.0534 60.879 17.5934 59.7088 19C53.2869 30.3265 48.6067 35.5219 37.2085 41.5C34.6732 43.3691 34.2664 44.4424 37.2085 46.5C48.0841 52.2247 52.886 56.9754 58.7085 68.5C60.5486 69.8018 61.5591 70.1832 63.2085 68.5C68.5928 57.3944 73.8336 52.8094 85.7085 46.5C87.027 45.0962 87.7324 44.308 85.7085 42.5C75.5879 36.7207 70.2354 32.5144 62.7085 19Z" fill="currentColor" />
                </svg>
            ),
        },
        {
            id: "flowexa" as SidebarTab,
            name: "Flowexa",
            description: "Workflows & Automation",
            url: "https://linear.app",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 475 462" fill="none">
                    <path d="M121.238 43.9466C59.009 80.5035 33.1605 107.594 0.738281 165.947C105.26 197.551 137.021 234.274 172.238 314.947C184.063 377.952 179.633 409.761 153.238 460.447C214.254 425.34 239.644 395.514 273.738 329.447C304.125 246.736 306.738 196.516 281.238 98.9466C199.34 161.027 147.684 179.97 73.2383 165.947C130.596 158.31 160.167 149.436 207.738 124.447C274.352 86.5932 300.141 57.7559 338.738 1.44657C241.336 -2.43033 190.709 4.44276 121.238 43.9466Z" fill="currentColor" />
                    <path d="M294.238 94.013C349.223 86.4663 369.977 68.9291 386.724 10.9463C395.658 59.6846 411.018 80.3366 474.238 94.013C426.713 105.579 402.401 115.84 386.724 178.946C371.021 121.546 348.728 105.363 294.238 94.013Z" fill="currentColor" />
                </svg>
            ),
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
            (item.id === "docs" && location.pathname.startsWith("/docs")) ||
            (item.id === "blogs" && (location.pathname.startsWith("/blogs") || location.pathname.startsWith("/blog")));

        return (
            <Link
                key={item.id}
                to={item.path}
                onClick={() => handleItemClick(item.id)}
                className={`flex items-center h-11 rounded-xl text-xs sm:text-sm transition-all duration-150 group cursor-pointer overflow-x-hidden relative w-full ${isCurrentActive
                    ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2.5px_2.5px_0px_#000] font-black"
                    : "text-neutral-800 hover:text-black hover:bg-black/5 border-2 border-transparent font-bold"
                    }`}
                title={!isExpanded ? item.label : undefined}
            >
                {/* Active vertical accent bar */}
                <span
                    className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-150 ${isCurrentActive && isExpanded ? "bg-[#a2ff86] opacity-100" : "bg-transparent opacity-0"
                        }`}
                />

                <div className="flex items-center overflow-x-hidden w-full">
                    {/* SVG Icon: DEAD-CENTER in 44px container */}
                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                        <span
                            className={`w-5 h-5 flex items-center justify-center transition-colors ${isCurrentActive
                                ? "text-[#a2ff86]"
                                : "text-neutral-700 group-hover:text-black"
                                }`}
                        >
                            {item.icon}
                        </span>
                    </div>

                    {/* Text label only rendered when expanded */}
                    {isExpanded && (
                        <span className={`whitespace-nowrap truncate overflow-x-hidden animate-fadeIn pl-0.5 ${isCurrentActive ? "text-[#a2ff86] font-black" : "text-neutral-800 font-bold"}`}>
                            {item.label}
                        </span>
                    )}
                </div>

                {item.badge && isExpanded && (
                    <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-colors flex-shrink-0 whitespace-nowrap ml-2 border-2 border-black shadow-[1.5px_1.5px_0px_#000] ${(item as any).badgeVariant === "danger"
                            ? "bg-[#FF6B6B] text-black animate-pulse"
                            : isCurrentActive
                                ? "bg-[#a2ff86] text-black"
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
            </Link>
        );
    };

    const sidebarContent = (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
            }}
            className={`h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] flex flex-col justify-between rounded-2xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-2 border-black text-black px-2 py-2.5 sm:px-2 sm:py-3 select-none transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-2 sm:top-3 left-2 sm:left-3 z-50 overflow-x-hidden will-change-[width] ${isExpanded
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
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <svg className="w-full h-full text-black" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="currentColor" stroke="currentColor" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="currentColor" stroke="currentColor" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="currentColor" stroke="currentColor" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="currentColor" stroke="currentColor" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="currentColor" stroke="currentColor" />
                            </svg>
                        </div>

                        {/* Title and Subtitle with overflow-x-hidden and whitespace-nowrap */}
                        {isExpanded && (
                            <div className="flex flex-col min-w-0 overflow-x-hidden animate-fadeIn">
                                <span className="text-base font-black tracking-tight text-black leading-tight whitespace-nowrap truncate">
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
                <div className="pt-3.5 space-y-1.5 overflow-x-hidden">
                    {mainNavItems.map(renderNavItem)}
                </div>

                {/* Subtle Hairline Divider */}
                <div className={`my-3 h-0.5 bg-black/15 overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 2: Events (Clubs, College Events, Event Tracker, Applications) */}
                <div className="space-y-1.5 overflow-x-hidden">
                    {isExpanded && (
                        <div className="flex items-center justify-between px-3 py-1 text-black overflow-x-hidden animate-fadeIn">
                            <span className="text-[11px] font-black tracking-wider uppercase whitespace-nowrap truncate text-neutral-800">
                                Events
                            </span>
                        </div>
                    )}
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
                </div>

                {/* Subtle Hairline Divider */}
                <div className={`my-3 h-0.5 bg-black/15 overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 3: Documentation (Blogs, Docs) */}
                <div className="space-y-1.5 overflow-x-hidden">
                    {isExpanded && (
                        <div className="flex items-center justify-between px-3 py-1 text-black overflow-x-hidden animate-fadeIn">
                            <span className="text-[11px] font-black tracking-wider uppercase whitespace-nowrap truncate text-neutral-800">
                                Documentation
                            </span>
                        </div>
                    )}
                    {documentationItems.map(renderNavItem)}
                </div>

                {/* Subtle Hairline Divider */}
                <div className={`my-3 h-0.5 bg-black/15 overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 3: Workspace Redirections (Codexa, Evolexa, Flowexa) */}
                <div className="space-y-1.5 overflow-x-hidden">
                    {isExpanded && (
                        <div className="flex items-center justify-between px-3 py-1 text-black overflow-x-hidden animate-fadeIn">
                            <span className="text-[11px] font-black tracking-wider uppercase whitespace-nowrap truncate text-neutral-800">
                                Workspaces
                            </span>
                        </div>
                    )}

                    {workspaceItems.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center h-11 rounded-xl text-xs sm:text-sm font-bold text-neutral-700 select-none overflow-x-hidden relative w-full cursor-default"
                            title={!isExpanded ? `${item.name} (Coming Soon)` : `${item.name} Workspace — Coming Soon`}
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
                                        {item.name}
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
                    ))}
                </div>
            </div>

            {/* Bottom Section: Profile Card (DEAD CENTER avatar when collapsed) */}
            <div ref={profileMenuRef} className="pt-2.5 border-t-2 border-black/15 relative flex-shrink-0">
                <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="w-full h-14 flex items-center rounded-xl hover:bg-black/5 border-2 border-transparent hover:border-black/25 transition-all cursor-pointer group text-left overflow-hidden relative"
                    title={`${displayName} (${displayEmail})`}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="menu"
                >
                    <div className={`flex items-center overflow-hidden w-full ${isExpanded ? "justify-start" : "justify-center"}`}>
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
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                            displayName
                                                        )}&background=000&color=a2ff86&size=128&bold=true`;
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
                                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF6B6B] opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF6B6B] ring-2 ring-black" />
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
                        className="absolute bottom-full mb-2 left-0 right-0 p-2 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[6px_6px_0px_#000] z-50 animate-fadeIn text-xs text-black"
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

                        {user?.username && (
                            <Link
                                to={`/profile/u/${encodeURIComponent(user.username)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setIsProfileMenuOpen(false)}
                                className="flex items-center justify-between px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    <span className="truncate">Public Showcase</span>
                                </div>
                                <svg className="w-3 h-3 text-neutral-700 flex-shrink-0 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </Link>
                        )}

                        <Link
                            to="/onboarding"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("connect-platform");
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-800 font-bold hover:text-black hover:bg-black/5 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span className="truncate">Connected Platforms ({connectedPortalsCount})</span>
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
