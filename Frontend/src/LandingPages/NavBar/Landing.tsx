import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store';
import { NotificationBell } from '../../components/NotificationBell';

export interface NavItem {
    id: string;
    title: string;
    icon: React.ReactNode;
    dropdown?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    {
        id: 'docs',
        title: 'Docs',
        dropdown: false,
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="8" y1="7" x2="16" y2="7" />
                <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
        ),
    },
    {
        id: 'blogs',
        title: 'Blogs',
        dropdown: true,
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
        ),
    },
];

interface NavBarProps {
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
}

const NavBar: React.FC<NavBarProps> = ({ activeTab: externalActiveTab, onTabChange }) => {
    const navigate = useNavigate();
    const location = useLocation();
    // Auto-detect route if activeTab is not explicitly specified
    let detectedTab: string | null = null;
    if (location.pathname.startsWith('/docs')) {
        detectedTab = 'docs';
    } else if (location.pathname.startsWith('/blog') || location.pathname.startsWith('/blogs')) {
        detectedTab = 'blogs';
    }

    const [internalActiveTab, setInternalActiveTab] = useState<string | null>(detectedTab);
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [isClickOpen, setIsClickOpen] = useState(false);
    const dropdownTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navRef = useRef<HTMLElement>(null);

    useEffect(() => {
        setInternalActiveTab(detectedTab);
    }, [detectedTab]);

    const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
                setIsClickOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTabClick = (tabId: string) => {
        setInternalActiveTab(tabId);
        onTabChange?.(tabId);

        if (tabId === 'blogs') {
            setIsClickOpen(false);
            setOpenDropdown(null);
            navigate('/blogs');
            return;
        }

        // Close dropdown and navigate to dedicated pages
        setIsClickOpen(false);
        setOpenDropdown(null);

        if (tabId === 'docs') {
            navigate('/docs');
        }
    };

    const { user, loading, isAuthenticated } = useAppSelector((state) => state.user);

    // Synchronous fallback from localStorage for immediate paint
    const storedUser = React.useMemo(() => {
        try {
            const raw = localStorage.getItem("orbix_user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);

    const currentUser = user || storedUser;
    const isLoggedIn = Boolean(
        (isAuthenticated && user) ||
        (currentUser && (currentUser.username || currentUser.gmail || currentUser.id))
    );

    const displayName = currentUser?.firstName
        ? `${currentUser.firstName} ${currentUser.lastName || ""}`.trim()
        : currentUser?.username || "Developer";

    const avatarSrc = currentUser?.photoUrl
        || currentUser?.avatarUrl
        || (currentUser as any)?.photo_url
        || (currentUser as any)?.avatar_url
        || (currentUser as any)?.avatar
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=111827&color=fff&size=128&bold=true`;

    const handleWorkspaceClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (loading) return;
        if (isLoggedIn) {
            navigate("/dashboard");
        } else {
            navigate("/auth/signin");
        }
    };

    const handleMouseEnterTab = (tabId: string) => {
        if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
        setHoveredTab(tabId);
        if (tabId === 'blogs') {
            setOpenDropdown('blogs');
        } else {
            setOpenDropdown(null);
        }
    };

    const handleMouseLeaveTab = () => {
        setHoveredTab(null);
        if (isClickOpen) return;
        if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
        dropdownTimeout.current = setTimeout(() => {
            setOpenDropdown(null);
        }, 280);
    };

    const handleMouseEnterDropdown = () => {
        if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
    };

    const handleMouseLeaveDropdown = () => {
        if (isClickOpen) return;
        if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
        dropdownTimeout.current = setTimeout(() => {
            setOpenDropdown(null);
        }, 250);
    };

    return (
        <header className="fixed top-3 sm:top-6 left-0 right-0 z-50 flex justify-center px-2 sm:px-4 pointer-events-none">
            <nav
                ref={navRef}
                aria-label="Main Navigation"
                className="w-[96%] sm:w-[92%] md:w-[86%] lg:w-[80%] max-w-5xl pointer-events-auto relative flex items-center justify-between gap-1 sm:gap-2.5 p-1 pl-2.5 sm:pl-4 pr-1.5 sm:pr-2.5 rounded-full bg-white/95 backdrop-blur-md border-2 border-black shadow-[4px_4px_0px_#000] transition-all duration-300 h-[50px] sm:h-[54px]"
            >
                {/* Brand Logo & Title */}
                <Link
                    to="/"
                    className="flex items-center gap-2.5 py-1 mr-1 group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                >
                    {/* Logo badge with circular backdrop */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105 text-neutral-950">

                        <svg className="w-7 h-7" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="currentColor" />
                            <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="currentColor" />
                            <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="currentColor" />
                            <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="currentColor" />
                            <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="currentColor" />
                            <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="currentColor" />
                            <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="currentColor" />
                            <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="currentColor" />
                            <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="currentColor" />
                            <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="currentColor" />
                        </svg>
                    </div>
                    <span className="font-semibold text-neutral-950 tracking-tight text-sm sm:text-base">
                        Orbix
                    </span>
                </Link>

                {/* Navigation Items with Animated Slider */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                    {NAV_ITEMS.map((item) => {
                        const isRouteActive = activeTab === item.id;
                        const isHovered = hoveredTab === item.id;
                        // Blogs is selected when active or when dropdown is open/hovered
                        const isBlogsHovered = item.id === 'blogs' && (isHovered || openDropdown === 'blogs');
                        const isSelected = item.id === 'blogs' ? (isBlogsHovered || isRouteActive) : isRouteActive;

                        return (
                            <div
                                key={item.id}
                                className="relative flex items-center h-full"
                                onMouseEnter={() => handleMouseEnterTab(item.id)}
                                onMouseLeave={handleMouseLeaveTab}
                            >
                                <button
                                    id={`nav-item-${item.id}`}
                                    type="button"
                                    onClick={() => handleTabClick(item.id)}
                                    className={`relative z-10 flex items-center h-[36px] sm:h-[40px] px-2.5 sm:px-4 rounded-full text-xs sm:text-sm transition-colors duration-200 focus:outline-none select-none cursor-pointer ${isSelected
                                        ? 'text-white font-semibold'
                                        : isHovered
                                            ? 'text-neutral-950 font-medium'
                                            : 'text-neutral-600 hover:text-neutral-950'
                                        }`}
                                >
                                    {/* Active sliding pill indicator */}
                                    {isSelected && (
                                        <motion.div
                                            layoutId="active-nav-pill"
                                            className="absolute inset-0 bg-neutral-950 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.22)] -z-10"
                                            transition={{
                                                type: 'spring',
                                                stiffness: 420,
                                                damping: 30,
                                            }}
                                        />
                                    )}

                                    {/* Light hover shader */}
                                    {!isSelected && isHovered && (
                                        <motion.div
                                            layoutId="hover-nav-pill"
                                            className="absolute inset-0 bg-neutral-100 rounded-full border border-black/5 -z-10 pointer-events-none"
                                            transition={{
                                                type: 'spring',
                                                stiffness: 400,
                                                damping: 28,
                                                mass: 0.65,
                                            }}
                                        />
                                    )}

                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        {/* Item Icon */}
                                        <span className={`transition-colors duration-200 ${isSelected ? 'text-white' : isHovered ? 'text-neutral-950' : 'text-neutral-500'}`}>
                                            {item.icon}
                                        </span>

                                        {/* Item Title */}
                                        <span>{item.title}</span>

                                        {/* Dropdown Chevron if item has dropdown */}
                                        {item.dropdown && (
                                            <svg
                                                className={`w-3 h-3 transition-transform duration-200 ${openDropdown === item.id ? 'rotate-180' : ''
                                                    } ${isSelected ? 'text-white' : isHovered ? 'text-neutral-950' : 'text-neutral-500'}`}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 ml-1 sm:ml-2">
                    {/* Demo Profile Link */}
                    <Link
                        to="/profile/u/Vineet-Chandel"
                        className="hidden md:flex h-[36px] sm:h-[40px] px-3 sm:px-4 items-center justify-center text-xs sm:text-sm font-medium text-neutral-600 hover:text-neutral-950 transition-colors rounded-full hover:bg-neutral-100 focus:outline-none whitespace-nowrap"
                        title="View live demo showcase profile (@Vineet-Chandel)"
                    >
                        Demo Profile
                    </Link>

                    {/* Authenticated User Notification Bell */}
                    {isLoggedIn && <NotificationBell variant="light" />}

                    {/* Primary CTA Button: Workspace (with Avatar when logged in) or Sign in (when logged out) */}
                    <button
                        type="button"
                        onClick={handleWorkspaceClick}
                        disabled={loading}
                        title={isLoggedIn ? `${displayName} - Open Workspace` : "Sign in to Orbix"}
                        className={`group relative inline-flex items-center h-[36px] sm:h-[40px] gap-1.5 sm:gap-2 rounded-full bg-black text-white font-black text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:bg-neutral-900 transition-all duration-200 active:translate-x-[1px] active:translate-y-[1px] focus:outline-none whitespace-nowrap cursor-pointer disabled:cursor-wait overflow-hidden mr-0.5 sm:mr-1 ${isLoggedIn ? "pl-1 sm:pl-1.5 pr-2.5 sm:pr-3.5" : "pl-3.5 sm:pl-4 pr-2.5 sm:pr-3.5"
                            }`}
                    >
                        {isLoggedIn && (
                            <img
                                src={avatarSrc}
                                alt={displayName}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                        displayName
                                    )}&background=111827&color=fff&size=128&bold=true`;
                                }}
                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover ring-1 ring-white/20 shadow-xs flex-shrink-0"
                            />
                        )}

                        <span>{isLoggedIn ? "Workspace" : "Sign in"}</span>

                        <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5 flex-shrink-0">
                            <svg
                                className="w-3 h-3 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </span>

                        {/* Loader overlay over the button while auth is verifying */}
                        {loading && (
                            <div className="absolute inset-0 rounded-full bg-neutral-950/90 backdrop-blur-xs flex items-center justify-center z-10 transition-opacity">
                                <svg
                                    className="w-4 h-4 animate-spin text-white"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            </div>
                        )}
                    </button>
                </div>

                {/* Full Megamenu Dropdown positioned below the navbar */}
                <AnimatePresence>
                    {openDropdown === 'blogs' && (
                        <div
                            className="absolute top-full left-1/2 -translate-x-1/2 pt-2.5 z-50 pointer-events-auto"
                            onMouseEnter={handleMouseEnterDropdown}
                            onMouseLeave={handleMouseLeaveDropdown}
                        >
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="w-[840px] max-w-[94vw] bg-white/95 backdrop-blur-2xl text-slate-900 rounded-[24px] p-6 sm:p-7 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.06)] border border-slate-200 overflow-hidden"
                            >
                                {/* Header Row */}
                                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-slate-500">
                                            Featured Workshop & Blog
                                        </span>
                                    </div>
                                    <Link
                                        to="/blogs"
                                        onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                        className="text-xs font-semibold text-slate-600 hover:text-black flex items-center gap-1 transition-colors group"
                                    >
                                        <span>View All Blogs</span>
                                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                                    </Link>
                                </div>

                                <div className="grid grid-cols-12 gap-6">
                                    {/* Left: Featured AWS Launchpad Blog Card with Cloudinary Banner */}
                                    <div className="col-span-12 lg:col-span-7 flex flex-col">
                                        <Link
                                            to="/blog/aws-sbg-psit/aws-launchpad-2026"
                                            onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                            className="group flex flex-col h-full rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 hover:border-slate-300 p-3.5 transition-all duration-200 cursor-pointer text-left shadow-xs hover:shadow-sm"
                                        >
                                            {/* Cloudinary Banner Image */}
                                            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 mb-3.5">
                                                <img
                                                    src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792919453/AWS_EC2_Deployment_Banner_samf2y.png"
                                                    alt="AWS EC2 Deployment Guide Banner"
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                />
                                                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-[10px] font-mono font-bold text-slate-900 border border-slate-200 shadow-xs">
                                                    AWS LAUNCHPAD 2026
                                                </div>
                                            </div>

                                            {/* Tags & Time */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded border border-slate-300/50">
                                                    AWS SBG PSIT
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-500">
                                                    ~120 min read
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-emerald-600 ml-auto">
                                                    Beginner Friendly
                                                </span>
                                            </div>

                                            {/* Title & Description */}
                                            <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-emerald-600 transition-colors leading-snug mb-1.5">
                                                Deploy your first website to AWS
                                            </h3>
                                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                                                A visual, step-by-step workbook for launching EC2 instances, configuring security groups, setting up Nginx, and deploying production applications.
                                            </p>

                                            {/* Action Button */}
                                            <div className="mt-auto pt-2.5 flex items-center justify-between border-t border-slate-200">
                                                <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-950">
                                                    Start reading guide
                                                </span>
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold transition-transform duration-200 group-hover:translate-x-1">
                                                    ↗
                                                </span>
                                            </div>
                                        </Link>
                                    </div>

                                    {/* Right: Quick Chapter Links */}
                                    <div className="col-span-12 lg:col-span-5 flex flex-col justify-between gap-2.5">
                                        <div className="text-[11px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-0.5">
                                            Workbook Chapters
                                        </div>

                                        <div className="flex flex-col gap-1.5 flex-1">
                                            {[
                                                {
                                                    chapter: '01',
                                                    title: 'Architecture & EC2',
                                                    desc: 'Repository to live website & EC2 fundamentals',
                                                    path: '/blog/aws-sbg-psit/aws-launchpad-2026/intro-ec2-architecture',
                                                },
                                                {
                                                    chapter: '02',
                                                    title: 'Step-by-Step Deployment',
                                                    desc: 'Connect, configure Nginx, and deploy web assets',
                                                    path: '/blog/aws-sbg-psit/aws-launchpad-2026/deploy-inspect-and-launch',
                                                },
                                                {
                                                    chapter: '03',
                                                    title: 'Verification Checklist',
                                                    desc: '8-step live deployment verification & validation',
                                                    path: '/blog/aws-sbg-psit/aws-launchpad-2026/verification-checklist',
                                                },
                                                {
                                                    chapter: '04',
                                                    title: 'Troubleshooting Toolkit',
                                                    desc: 'Common error diagnostics and remediation steps',
                                                    path: '/blog/aws-sbg-psit/aws-launchpad-2026/troubleshoot-common-errors',
                                                },
                                                {
                                                    chapter: '05',
                                                    title: 'Independent Challenge',
                                                    desc: 'Build and deploy a second custom project to EC2',
                                                    path: '/blog/aws-sbg-psit/aws-launchpad-2026/challenge-project-two',
                                                },
                                            ].map((ch) => (
                                                <Link
                                                    key={ch.chapter}
                                                    to={ch.path}
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 hover:border-slate-300 transition-all text-left group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                            CH {ch.chapter}
                                                        </span>
                                                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                                                            {ch.title}
                                                        </h4>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                        {ch.desc}
                                                    </p>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
};

export default NavBar;