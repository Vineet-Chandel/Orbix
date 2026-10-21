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
        id: 'products',
        title: 'Products',
        dropdown: true,
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
        ),
    },
    {
        id: 'customers',
        title: 'Customers',
        dropdown: false,
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        id: 'pricing',
        title: 'Pricing',
        dropdown: false,
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
        ),
    },
    {
        id: 'support',
        title: 'Support',
        dropdown: false,
        icon: (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
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
    // Auto-detect route if activeTab is not explicitly specified (route '/' has no active tab)
    let detectedTab: string | null = null;
    if (location.pathname.startsWith('/customers')) {
        detectedTab = 'customers';
    } else if (location.pathname.startsWith('/pricing')) {
        detectedTab = 'pricing';
    } else if (location.pathname.startsWith('/support')) {
        detectedTab = 'support';
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

        if (tabId === 'products') {
            setIsClickOpen((prev) => {
                const next = !prev;
                setOpenDropdown(next ? 'products' : null);
                return next;
            });
            return;
        }

        // Close dropdown and navigate to dedicated pages
        setIsClickOpen(false);
        setOpenDropdown(null);

        if (tabId === 'customers') {
            navigate('/customers');
        } else if (tabId === 'pricing') {
            navigate('/pricing');
        } else if (tabId === 'support') {
            navigate('/support');
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
        if (tabId === 'products') {
            setOpenDropdown('products');
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
        <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
            <nav
                ref={navRef}
                aria-label="Main Navigation"
                className="w-[80%] pointer-events-auto relative flex items-center justify-between gap-1.5 sm:gap-2.5 p-[3px] pl-3.5 sm:pl-4 pr-[3px] rounded-full bg-[#0d111c]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.45),0_1px_1px_0_rgba(255,255,255,0.08)_inset] transition-all duration-300 h-[52px]"
            >
                {/* Brand Logo & Title */}
                <Link
                    to="/"
                    className="flex items-center gap-2.5 py-1 mr-1 group rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 "
                >
                    {/* Logo badge with circular backdrop */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-105">

                        <svg className="w-7 h-7" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="white" />
                            <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                            <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="white" />
                            <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="white" />
                            <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="white" />
                            <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="white" />
                            <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="white" />
                            <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="white" />
                            <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="white" />
                            <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="white" />
                            <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="white" />
                            <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="white" />
                            <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="white" />
                            <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="white" />
                            <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="white" />
                        </svg>
                    </div>
                    <span className="font-semibold text-white tracking-tight text-sm sm:text-base">
                        Orbix
                    </span>
                </Link>

                {/* Navigation Items with Animated Slider */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                    {NAV_ITEMS.map((item) => {
                        const isRouteActive = activeTab === item.id;
                        const isHovered = hoveredTab === item.id;
                        // Products is never permanently selected on default route; it is selected only on hover or when dropdown is open
                        const isProductsHovered = item.id === 'products' && (isHovered || openDropdown === 'products');
                        const isSelected = item.id === 'products' ? isProductsHovered : isRouteActive;

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
                                    className={`relative z-10 flex items-center h-[46px] px-3.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium transition-colors duration-200 focus:outline-none select-none cursor-pointer ${isSelected
                                        ? 'text-neutral-950 font-semibold'
                                        : isHovered
                                            ? 'text-white font-medium'
                                            : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    {/* Active sliding pill indicator with minute difference to outer boundary */}
                                    {isSelected && (
                                        <motion.div
                                            layoutId="active-nav-pill"
                                            className="absolute inset-0 bg-gradient-to-b from-white to-[#dfe3ef] rounded-full shadow-[0_2px_14px_rgba(255,255,255,0.28),0_10px_24px_-12px_rgba(120,150,255,0.5)] -z-10"
                                            transition={{
                                                type: 'spring',
                                                stiffness: 420,
                                                damping: 30,
                                            }}
                                        />
                                    )}

                                    {/* Dark glass hover shader matching active pill height & shift from top edge */}
                                    {!isSelected && isHovered && (
                                        <motion.div
                                            layoutId="hover-nav-pill"
                                            className="absolute inset-0 bg-[#121624]/90 backdrop-blur-xl border border-white/[0.14] rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.4),0_1px_1px_rgba(255,255,255,0.12)_inset] -z-10 pointer-events-none"
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
                                        <span className={`transition-colors duration-200 ${isSelected ? 'text-neutral-950' : isHovered ? 'text-white' : 'text-neutral-400'}`}>
                                            {item.icon}
                                        </span>

                                        {/* Item Title */}
                                        <span>{item.title}</span>

                                        {/* Dropdown Chevron if item has dropdown */}
                                        {item.dropdown && (
                                            <svg
                                                className={`w-3 h-3 transition-transform duration-200 ${openDropdown === item.id ? 'rotate-180' : ''
                                                    } ${isSelected ? 'text-neutral-950' : isHovered ? 'text-white' : 'text-neutral-400'}`}
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
                        className="h-[46px] px-3.5 sm:px-4 flex items-center justify-center text-xs sm:text-sm font-medium text-neutral-300 hover:text-white transition-colors rounded-full hover:bg-white/[0.06] focus:outline-none whitespace-nowrap"
                        title="View live demo showcase profile (@Vineet-Chandel)"
                    >
                        Demo Profile
                    </Link>

                    {/* Authenticated User Notification Bell & Rounded Profile Picture */}
                    {isLoggedIn && (
                        <>
                            <NotificationBell variant="dark" />
                            <Link
                                to="/dashboard"
                                title={`${displayName} - Open Dashboard`}
                                className="group relative flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                            >
                                <img
                                    src={avatarSrc}
                                    alt={displayName}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                            displayName
                                        )}&background=111827&color=fff&size=128&bold=true`;
                                    }}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-white/20 ring-2 ring-white/10 group-hover:ring-amber-400/50 shadow-sm transition-all"
                                />
                            </Link>
                        </>
                    )}

                    {/* Primary CTA Button: Workspace with dynamic auth redirection and loader */}
                    <button
                        type="button"
                        onClick={handleWorkspaceClick}
                        disabled={loading}
                        className="group relative inline-flex items-center h-[46px] gap-1.5 pl-3.5 sm:pl-4 pr-2 sm:pr-2.5 rounded-full bg-gradient-to-b from-white to-[#dfe3ef] text-neutral-950 font-semibold text-xs sm:text-sm shadow-sm hover:from-white hover:to-white transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:scale-[1.02] active:scale-[0.98] focus:outline-none whitespace-nowrap cursor-pointer disabled:cursor-wait overflow-hidden"
                    >
                        <span>Workspace</span>
                        <span className="w-5 h-5 rounded-full bg-neutral-950/10 flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
                            <svg
                                className="w-3 h-3 text-neutral-950"
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

                        {/* Loader overlay over the workspace button while auth is verifying */}
                        {loading && (
                            <div className="absolute inset-0 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center z-10 transition-opacity">
                                <svg
                                    className="w-4 h-4 animate-spin text-neutral-950"
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
                    {openDropdown === 'products' && (
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
                                className="w-[960px] max-w-[94vw] bg-white text-slate-900 rounded-[28px] p-7 sm:p-8 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden"
                            >
                                <div className="grid grid-cols-12 gap-7">
                                    {/* Column 1: AI Impact & Efficiency */}
                                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                                        {/* Category 1: AI IMPACT */}
                                        <div className="flex flex-col gap-2.5">
                                            <span className="px-3 py-1 rounded-full bg-[#edf0f7] text-[#484f63] font-bold text-[10px] tracking-wider uppercase w-fit select-none">
                                                AI IMPACT
                                            </span>

                                            <div className="flex flex-col gap-1 mt-1">
                                                {/* AI Code Reviews */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" />
                                                            <path d="m9 12 2 2 4-4" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            AI Code Reviews
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Catch security risks, bugs, and spec mismatches
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* AI & Productivity Insights */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M3 20h18M6 16v-4M10 16v-8M14 16v-5M18 16v-10" />
                                                            <path d="m4 9 5-4 4 3 6-5" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            AI & Productivity Insights
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            See how AI tools affect cycle time and delivery speed
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* Measure AI Impact */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="9" />
                                                            <path d="M12 12 16 8" />
                                                            <path d="M7 16a6 6 0 0 1 10 0" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Measure AI Impact
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Track AI adoption and tie it to delivery outcomes
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* MCP Server */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect width="20" height="8" x="2" y="3" rx="2" />
                                                            <rect width="20" height="8" x="2" y="13" rx="2" />
                                                            <line x1="6" y1="7" x2="6.01" y2="7" />
                                                            <line x1="6" y1="17" x2="6.01" y2="17" />
                                                            <path d="M14 7h4M14 17h4" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            MCP Server
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Chat with your data to spot patterns and boost output
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Category 2: EFFICIENCY */}
                                        <div className="flex flex-col gap-2.5">
                                            <span className="px-3 py-1 rounded-full bg-[#edf0f7] text-[#484f63] font-bold text-[10px] tracking-wider uppercase w-fit select-none">
                                                EFFICIENCY
                                            </span>

                                            <div className="flex flex-col gap-1 mt-1">
                                                {/* DevOps Workflow Automation */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="18" cy="18" r="3" />
                                                            <circle cx="6" cy="6" r="3" />
                                                            <path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            DevOps Workflow Automation
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Policy-based PR routing, approvals, and tests
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* AI Powered Support */}
                                                <Link
                                                    to="/support"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                            <path d="M3 3v5h5" />
                                                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                                            <path d="M16 21h5v-5" />
                                                            <circle cx="12" cy="12" r="2" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            AI Powered Support
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Unify AI and human code delivery in one clear view
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Predictable Delivery & Developer Experience */}
                                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                                        {/* Category 3: PREDICTABLE DELIVERY */}
                                        <div className="flex flex-col gap-2.5">
                                            <span className="px-3 py-1 rounded-full bg-[#edf0f7] text-[#484f63] font-bold text-[10px] tracking-wider uppercase w-fit select-none">
                                                PREDICTABLE DELIVERY
                                            </span>

                                            <div className="flex flex-col gap-1 mt-1">
                                                {/* Resource Allocation */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="4" y1="21" x2="4" y2="14" />
                                                            <line x1="4" y1="10" x2="4" y2="3" />
                                                            <line x1="12" y1="21" x2="12" y2="12" />
                                                            <line x1="12" y1="8" x2="12" y2="3" />
                                                            <line x1="20" y1="21" x2="20" y2="16" />
                                                            <line x1="20" y1="12" x2="20" y2="3" />
                                                            <line x1="1" y1="14" x2="7" y2="14" />
                                                            <line x1="9" y1="8" x2="15" y2="8" />
                                                            <line x1="17" y1="16" x2="23" y2="16" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Resource Allocation
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Cost initiatives and shape your investment strategy
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* Cost Capitalization */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="9" />
                                                            <line x1="12" y1="7" x2="12" y2="17" />
                                                            <path d="M9 10a2.5 2.5 0 0 1 5 0c0 2-3 2-3 4h4" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Cost Capitalization
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Capitalize engineering costs with audit-ready reports
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* Dev Team Management */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="9" y="3" width="6" height="5" rx="1" />
                                                            <rect x="3" y="16" width="6" height="5" rx="1" />
                                                            <rect x="15" y="16" width="6" height="5" rx="1" />
                                                            <path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Dev Team Management
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Set targets and tie throughput to business outcomes
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Category 4: DEVELOPER EXPERIENCE */}
                                        <div className="flex flex-col gap-2.5">
                                            <span className="px-3 py-1 rounded-full bg-[#edf0f7] text-[#484f63] font-bold text-[10px] tracking-wider uppercase w-fit select-none">
                                                DEVELOPER EXPERIENCE
                                            </span>

                                            <div className="flex flex-col gap-1 mt-1">
                                                {/* Optimization */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="3" />
                                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Optimization
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Surface friction with feedback and MCP insights
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* Reporting */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="3" width="18" height="18" rx="2" />
                                                            <path d="M7 12h4M7 8h8M7 16h6" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Reporting
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Spot what's working and what needs attention
                                                        </p>
                                                    </div>
                                                </Link>

                                                {/* Surveys */}
                                                <Link
                                                    to="/platform"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer text-left"
                                                >
                                                    <div className="mt-0.5 text-slate-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                                            <path d="M8 9h8M8 13h5" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                                            Surveys
                                                        </h4>
                                                        <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                                            Turn developer feedback into actionable signals
                                                        </p>
                                                    </div>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 3: Exact Right-Side Component (Platform overview + Featured card with illustration) */}
                                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
                                        {/* Top Card: Platform overview */}
                                        <Link
                                            to="/platform"
                                            onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                            className="w-full bg-[#dce2ff] hover:bg-[#d2d9fc] transition-all duration-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between group shadow-sm text-left"
                                        >
                                            <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                                                Platform overview
                                            </span>
                                            <div className="w-10 h-10 rounded-full border border-slate-900/40 flex items-center justify-center text-slate-900 transition-transform duration-200 group-hover:translate-x-1 flex-shrink-0">
                                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                    <polyline points="12 5 19 12 12 19" />
                                                </svg>
                                            </div>
                                        </Link>

                                        {/* Bottom Card: Featured What your software factory is doing to your engineers */}
                                        <div className="w-full bg-[#9feaed] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[300px] shadow-sm group">
                                            <div className="relative z-10 text-left">
                                                <h3 className="font-bold text-slate-900 text-xl leading-[1.22] tracking-tight max-w-[215px]">
                                                    What your software factory is doing to your engineers
                                                </h3>
                                                <Link
                                                    to="/auth/signup"
                                                    onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                                    className="inline-flex items-center gap-1.5 mt-4 font-bold text-slate-900 text-sm underline decoration-slate-900/70 underline-offset-4 hover:opacity-80 transition-opacity"
                                                >
                                                    <span>Register now</span>
                                                    <span className="text-base leading-none">↗</span>
                                                </Link>
                                            </div>

                                            {/* Exact illustration matching user's provided graphic */}
                                            <div className="absolute right-0 bottom-0 w-[240px] sm:w-[260px] pointer-events-none select-none">
                                                <img
                                                    src="/platform-graphic.png"
                                                    alt="What your software factory is doing to your engineers"
                                                    className="w-full h-auto object-contain object-bottom-right"
                                                />
                                            </div>
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