import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector, clearUser } from "../../store";

export type SidebarTab =
    | "dashboard"
    | "connect-platform"
    | "profile"
    | "resume"
    | "projects"
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

    // Profile menu toggle
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    // Hover-driven expansion: collapsed by default (Image 2), expands on hovering (Image 1)
    const [isHovered, setIsHovered] = useState(false);
    const isExpanded = isOpen || isHovered;

    // Connected portals and health sync tracking
    const [connectedPortalsCount, setConnectedPortalsCount] = useState<number>(0);
    const [brokenPortalsCount, setBrokenPortalsCount] = useState<number>(0);

    useEffect(() => {
        const handleSync = () => {
            try {
                const raw = localStorage.getItem("orbix_connected_portals");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    setConnectedPortalsCount(Object.keys(parsed).length);
                    const broken = Object.values(parsed).filter(
                        (p: any) => p && (p.verified === false || p.syncStatus === "broken")
                    ).length;
                    setBrokenPortalsCount(broken);
                    return;
                }
            } catch {
                // ignore
            }
            setConnectedPortalsCount(0);
            setBrokenPortalsCount(0);
        };

        handleSync();
        window.addEventListener("orbix_portals_updated", handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            window.removeEventListener("orbix_portals_updated", handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, []);

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Vineet Chandel";

    const displayEmail = user?.gmail || (user as any)?.email || "vineetsinghbitu@gmail.com";
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

    const handleWorkspaceRedirection = (name: string, url: string) => {
        const confirmed = window.confirm(
            `Redirect to ${name} Workspace?\n\nYou will be navigating to the ${name} environment.`
        );
        if (confirmed) {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const handleItemClick = (tab: SidebarTab) => {
        if (onTabChange) {
            onTabChange(tab);
        }
        if (onClose) {
            onClose();
        }
    };

    // 1 dashboard, 2 connect platform, 3 profile, 4 resume, 5 projects
    const mainNavItems = [
        {
            id: "dashboard" as SidebarTab,
            label: "Dashboard",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            ),
            path: "/dashboard",
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
            id: "profile" as SidebarTab,
            label: "Profile",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            ),
            path: "/profile",
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

    // Workspace redirections: Codexa, Evolexa, Flowexa
    const workspaceItems = [
        {
            id: "codexa" as SidebarTab,
            name: "Codexa",
            description: "Code & Compiler Workspace",
            url: "https://github.com",
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 141 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M28.001 9.5L2.50104 54.5C0.998939 58.5834 0.64081 60.8842 0.501038 65C0.938524 68.5876 1.28381 70.4643 2.50104 73L30.001 120.5C35.4895 125.639 38.9529 126.875 45.501 127.5H99.001C105.055 125.113 108.146 123.091 113.001 118L138.001 74.5C137.555 72.8604 137.011 72.6945 136.001 72.5H120.501C115.678 74.645 113.297 76.327 109.501 80C100.469 95.3741 95.8945 104.483 85.001 118C79.395 121.617 75.9883 122.881 69.001 122.5C61.7381 121.647 58.3542 120.112 53.501 115.5L26.501 70C24.9477 65.1254 24.8433 61.7609 27.501 57L52.501 14.5C56.0812 9.93194 58.5322 7.57464 64.001 6H73.501C80.5078 6.26746 82.9476 8.58767 87.501 13C95.4738 21.4342 94.5253 25.7724 102.001 37C105.329 43.6932 111.503 52.4157 121.001 56H137.501C138.562 54.4501 138.56 53.4612 137.501 51.5L110.001 6.5C104.567 2.11059 101.303 0.697955 95.001 0.5H42.001C35.9066 2.76829 32.8347 4.72468 28.001 9.5Z" fill="white" />
                    <path d="M73.001 28.5L72.501 12.5C70.7058 11.0543 69.8735 11.3238 68.501 12.5V28.5C66.6181 38.531 63.7181 43.4648 56.501 51.5C48.4748 57.6826 43.6156 60.3666 33.501 62C31.6617 63.574 30.9902 64.4922 33.501 66.5C43.8214 67.5752 48.5852 70.34 56.501 76.5C62.7019 83.5583 65.51 88.1063 68.501 98V115.5C70.2071 116.947 71.1914 116.977 73.001 115.5V98C75.4015 88.542 78.0024 83.8767 84.501 76.5C91.0133 71.4181 95.0765 69.1031 103.501 66.5H139.001C140.933 64.5141 140.478 63.5826 139.001 62L103.501 61.5C95.2528 59.0485 91.2098 56.5163 84.501 51C78.304 44.7688 75.3678 39.8531 73.001 28.5Z" fill="white" />
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
                    <path d="M1.70876 4.5C0.12191 2.90864 0.0724409 1.99494 1.70876 0.5H117.709C119.545 1.97671 119.977 2.8261 117.709 4.5C104.181 12.5622 98.954 17.9449 94.2088 29C92.6688 30.6466 91.6861 30.6173 89.7088 29C79.7437 10.5806 72.2203 6.69689 59.7088 6.5C45.4453 8.09559 38.2192 11.668 31.7088 27.5C30.4283 40.9054 30.4372 48.3489 31.7088 61.5C37.9917 76.5533 44.5975 80.7771 60.7088 82.5C77.7677 78.9809 83.6949 73.7856 89.7088 60.5C91.7028 57.2348 93.1523 57.7809 94.7085 60.5C102.674 75.3508 108.536 78.7372 119.209 84C119.834 85.9888 119.8 86.9752 117.709 88H1.70876C0.183632 86.2274 0.0547327 85.3401 1.70876 84C13.7194 76.5162 20.6745 70.4354 22.7088 61.5C24.6139 49.0868 24.218 41.4629 22.7088 27.5C18.6733 17.3207 14.491 12.1814 1.70876 4.5Z" fill="white" />
                    <path d="M62.7085 19C61.538 18.0534 60.879 17.5934 59.7088 19C53.2869 30.3265 48.6067 35.5219 37.2085 41.5C34.6732 43.3691 34.2664 44.4424 37.2085 46.5C48.0841 52.2247 52.886 56.9754 58.7085 68.5C60.5486 69.8018 61.5591 70.1832 63.2085 68.5C68.5928 57.3944 73.8336 52.8094 85.7085 46.5C87.027 45.0962 87.7324 44.308 85.7085 42.5C75.5879 36.7207 70.2354 32.5144 62.7085 19Z" fill="white" />
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
                    <path d="M121.238 43.9466C59.009 80.5035 33.1605 107.594 0.738281 165.947C105.26 197.551 137.021 234.274 172.238 314.947C184.063 377.952 179.633 409.761 153.238 460.447C214.254 425.34 239.644 395.514 273.738 329.447C304.125 246.736 306.738 196.516 281.238 98.9466C199.34 161.027 147.684 179.97 73.2383 165.947C130.596 158.31 160.167 149.436 207.738 124.447C274.352 86.5932 300.141 57.7559 338.738 1.44657C241.336 -2.43033 190.709 4.44276 121.238 43.9466Z" fill="white" />
                    <path d="M294.238 94.013C349.223 86.4663 369.977 68.9291 386.724 10.9463C395.658 59.6846 411.018 80.3366 474.238 94.013C426.713 105.579 402.401 115.84 386.724 178.946C371.021 121.546 348.728 105.363 294.238 94.013Z" fill="white" />
                </svg>
            ),
        },
    ];

    const sidebarContent = (
        <aside
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setIsProfileMenuOpen(false);
            }}
            className={`h-[calc(100vh-1.5rem)] sm:h-[calc(100vh-2rem)] flex flex-col justify-between rounded-[32px] bg-[#0c1017] border border-white/[0.08] text-white p-3.5 select-none transition-[width,box-shadow] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-3 sm:top-4 left-3 sm:left-4 z-50 overflow-x-hidden will-change-[width] ${
                isExpanded
                    ? "w-64 sm:w-[264px] shadow-2xl shadow-black/80 ring-1 ring-white/10"
                    : "w-[72px] shadow-lg shadow-black/40"
            }`}
        >
            {/* Top Brand Header without border or bg around logo */}
            <div className="overflow-x-hidden flex-shrink-0">
                <div className={`flex items-center pb-4 pt-1 border-b border-white/[0.07] overflow-x-hidden ${isExpanded ? "px-1 justify-start" : "justify-center"}`}>
                    <Link
                        to="/dashboard"
                        onClick={() => handleItemClick("dashboard")}
                        className={`flex items-center group cursor-pointer overflow-x-hidden ${isExpanded ? "gap-3 min-w-0" : "justify-center mx-auto"}`}
                        title="Orbix — AI Powered Ecosystem"
                    >
                        {/* Pure White Orbix Brand Star Logo (DEAD CENTER when collapsed) */}
                        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="white" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="white" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="white" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="white" />
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="white" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="white" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="white" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="white" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="white" />
                            </svg>
                        </div>

                        {/* Title and Subtitle with overflow-x-hidden and whitespace-nowrap */}
                        {isExpanded && (
                            <div className="flex flex-col min-w-0 overflow-x-hidden animate-fadeIn">
                                <span className="text-base font-extrabold tracking-tight text-white leading-tight whitespace-nowrap truncate">
                                    Orbix
                                </span>
                                <span className="text-[11px] font-medium text-neutral-400 whitespace-nowrap truncate">
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
                            className="lg:hidden p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors cursor-pointer ml-auto"
                            aria-label="Close Sidebar"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Main Navigation Items (EXACTLY CENTERED when collapsed) */}
                <div className="pt-3.5 space-y-1.5 overflow-x-hidden">
                    {mainNavItems.map((item) => {
                        const isCurrentActive =
                            activeTab === item.id ||
                            (item.path && location.pathname === item.path);

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                onClick={() => handleItemClick(item.id)}
                                className={`flex items-center h-11 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 group cursor-pointer overflow-x-hidden relative w-full ${
                                    isCurrentActive
                                        ? "bg-white/[0.1] text-white"
                                        : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                                title={!isExpanded ? item.label : undefined}
                            >
                                {/* Active vertical accent bar */}
                                <span
                                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full transition-opacity duration-200 ${
                                        isCurrentActive && isExpanded ? "bg-white opacity-100" : "bg-transparent opacity-0"
                                    }`}
                                />

                                <div className="flex items-center overflow-x-hidden w-full">
                                    {/* SVG Icon: DEAD-CENTER in 44px container */}
                                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                        <span
                                            className={`w-5 h-5 flex items-center justify-center transition-colors ${
                                                isCurrentActive
                                                    ? "text-white"
                                                    : "text-neutral-400 group-hover:text-white"
                                            }`}
                                        >
                                            {item.icon}
                                        </span>
                                    </div>

                                    {/* Text label only rendered when expanded */}
                                    {isExpanded && (
                                        <span className="whitespace-nowrap truncate overflow-x-hidden animate-fadeIn pl-0.5">
                                            {item.label}
                                        </span>
                                    )}
                                </div>

                                {item.badge && isExpanded && (
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors flex-shrink-0 whitespace-nowrap ml-2 ${
                                            (item as any).badgeVariant === "danger"
                                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                                                : isCurrentActive
                                                ? "bg-white/20 text-white"
                                                : "bg-white/[0.06] text-neutral-400 group-hover:text-neutral-200"
                                        }`}
                                    >
                                        {item.badge}
                                    </span>
                                )}

                                {/* Small badge dot in collapsed rail */}
                                {item.badge && !isExpanded && (item as any).badgeVariant === "danger" && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-[#0c1017]" />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* Subtle Hairline Divider (Matching Image 1 & 2) */}
                <div className={`my-3 h-px bg-white/[0.07] overflow-x-hidden ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

                {/* Section 2: Workspace Redirections (Codexa, Evolexa, Flowexa) */}
                <div className="space-y-1.5 overflow-x-hidden">
                    {isExpanded && (
                        <div className="flex items-center justify-between px-3 py-1 text-neutral-400 overflow-x-hidden animate-fadeIn">
                            <span className="text-[11px] font-bold tracking-wider uppercase whitespace-nowrap truncate">
                                Workspaces
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500 whitespace-nowrap">3 Apps</span>
                        </div>
                    )}

                    {workspaceItems.map((item) => {
                        const isCurrentActive = activeTab === item.id;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    handleItemClick(item.id);
                                    handleWorkspaceRedirection(item.name, item.url);
                                }}
                                className={`flex items-center h-11 rounded-2xl text-xs sm:text-sm font-medium transition-all duration-200 group cursor-pointer text-left overflow-x-hidden relative w-full ${
                                    isCurrentActive
                                        ? "bg-white/[0.1] text-white"
                                        : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                                }`}
                                title={!isExpanded ? `${item.name} Workspace` : `Redirect to ${item.name} Workspace`}
                            >
                                <div className="flex items-center overflow-x-hidden w-full">
                                    {/* SVG Icon: DEAD-CENTER in 44px container */}
                                    <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                                        <span className="w-5 h-5 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors">
                                            {item.icon}
                                        </span>
                                    </div>

                                    {isExpanded && (
                                        <span className="whitespace-nowrap truncate overflow-x-hidden animate-fadeIn pl-0.5">
                                            {item.name}
                                        </span>
                                    )}
                                </div>

                                {isExpanded && (
                                    <div className="flex items-center text-neutral-500 group-hover:text-neutral-300 transition-colors pr-1 flex-shrink-0">
                                        <svg
                                            className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line x1="7" y1="17" x2="17" y2="7" />
                                            <polyline points="7 7 17 7 17 17" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Section: Profile Card (DEAD CENTER avatar when collapsed) */}
            <div className="pt-3 border-t border-white/[0.07] relative overflow-x-hidden flex-shrink-0">
                <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="w-full h-12 flex items-center rounded-2xl hover:bg-white/[0.05] transition-colors cursor-pointer group text-left overflow-x-hidden relative"
                    title={`${displayName} (${displayEmail})`}
                >
                    <div className="flex items-center overflow-x-hidden w-full">
                        {/* Circular Avatar: DEAD CENTER in 44px container with glowing amber ring */}
                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                            <img
                                src={avatarSrc}
                                alt={displayName}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        displayName
                                    )}&background=1f293d&color=fff&size=128&bold=true`;
                                }}
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-500/40"
                            />
                        </div>

                        {/* Name & Email fade in */}
                        {isExpanded && (
                            <div className="min-w-0 flex-1 overflow-x-hidden animate-fadeIn pl-2">
                                <h4 className="text-xs sm:text-sm font-bold text-white whitespace-nowrap truncate group-hover:text-neutral-100">
                                    {displayName}
                                </h4>
                                <p className="text-[11px] font-medium text-neutral-400 whitespace-nowrap truncate">
                                    {displayEmail}
                                </p>
                            </div>
                        )}

                        {isExpanded && (
                            <div className="text-neutral-400 group-hover:text-white transition-colors p-1 flex-shrink-0 pr-2 ml-auto">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </div>
                        )}
                    </div>
                </button>

                {/* Profile Popup Menu */}
                {isProfileMenuOpen && (
                    <div
                        className={`absolute bottom-full mb-2 p-1.5 rounded-2xl bg-[#111622] border border-white/[0.1] shadow-2xl z-50 animate-fadeIn text-xs ${
                            isExpanded ? "left-0 right-0" : "left-0 w-52"
                        }`}
                    >
                        <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
                            <p className="font-bold text-white truncate">{displayName}</p>
                            <p className="text-[11px] text-neutral-400 truncate">{displayEmail}</p>
                        </div>

                        <Link
                            to="/profile"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("profile");
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/[0.07] transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>Developer Profile</span>
                        </Link>

                        <Link
                            to="/onboarding"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleItemClick("connect-platform");
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/[0.07] transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span>Connected Platforms ({connectedPortalsCount})</span>
                        </Link>

                        <div className="my-1 border-t border-white/[0.06]" />

                        <button
                            type="button"
                            onClick={() => {
                                setIsProfileMenuOpen(false);
                                handleSignOut();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                        >
                            <svg className="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign out</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop Fixed Floating Sidebar:
                Fixed-width placeholder rail (w-[96px] sm:w-[104px]) keeps dashboard width 100% static so UI never hangs or reflows.
                The expanding aside floats on top (absolute top-3 left-3 z-50).
            */}
            <div className="hidden lg:block h-screen sticky top-0 p-3 sm:p-4 flex-shrink-0 w-[96px] sm:w-[104px] z-40 relative">
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
