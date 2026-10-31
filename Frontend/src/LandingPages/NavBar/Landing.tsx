import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store';
import { NotificationBell } from '../../components/NotificationBell';
import { OrbixLogo } from '../../components/OrbixLogo';

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
                    className="flex items-center gap-2.5 py-1 mr-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 hover:opacity-85 transition-opacity"
                >
                    <OrbixLogo className="w-8 h-8 sm:w-9 sm:h-9 text-black group-hover:scale-105 transition-transform flex-shrink-0" />
                    <span className="font-black text-2xl sm:text-3xl tracking-tight text-black leading-none">
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
                                className="w-[860px] max-w-[95vw] bg-white text-black rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 shadow-[8px_8px_0px_#000] border-2 border-black overflow-hidden select-none"
                            >
                                {/* Header Row */}
                                <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black/15">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#a2ff86] border border-black animate-pulse" />
                                        <span className="text-xs font-mono font-black tracking-wider uppercase text-black">
                                            Featured Workshop & Blog
                                        </span>
                                    </div>
                                    <Link
                                        to="/blogs"
                                        onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                        className="group inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                    >
                                        <span>View All Blogs</span>
                                        <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
                                    </Link>
                                </div>

                                <div className="grid grid-cols-12 gap-5 sm:gap-6">
                                    {/* Left: Featured AWS Launchpad Blog Card with Cloudinary Banner */}
                                    <div className="col-span-12 lg:col-span-7 flex flex-col">
                                        <Link
                                            to="/blog/aws-sbg-psit/aws-launchpad-2026"
                                            onClick={() => { setOpenDropdown(null); setIsClickOpen(false); }}
                                            className="group flex flex-col h-full rounded-2xl bg-[#FAF6EE] hover:bg-[#FAF6EE]/90 border-2 border-black p-3.5 sm:p-4 shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all duration-200 cursor-pointer text-left"
                                        >
                                            {/* Cloudinary Banner Image */}
                                            <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border-2 border-black bg-black mb-3 shadow-[2px_2px_0px_#000]">
                                                <img
                                                    src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792919453/AWS_EC2_Deployment_Banner_samf2y.png"
                                                    alt="AWS EC2 Deployment Guide Banner"
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                                />
                                                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black text-[#a2ff86] border border-black text-[10px] font-mono font-black shadow-[1.5px_1.5px_0px_#000]">
                                                    AWS LAUNCHPAD 2026
                                                </div>
                                            </div>

                                            {/* Tags & Time */}
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2.5">
                                                <span className="text-[10px] font-mono font-black text-black bg-[#FFE566] px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                                    AWS SBG PSIT
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-black bg-white px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                                    ~120 min read
                                                </span>
                                                <span className="text-[10px] font-mono font-black text-black bg-[#a2ff86] px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000] ml-auto">
                                                    Beginner Friendly
                                                </span>
                                            </div>

                                            {/* Title & Description */}
                                            <h3 className="text-base sm:text-lg font-black text-black group-hover:underline transition-colors leading-snug mb-1.5">
                                                Deploy your first website to AWS
                                            </h3>
                                            <p className="text-xs text-neutral-700 font-medium line-clamp-2 leading-relaxed mb-3.5">
                                                A visual, step-by-step workbook for launching EC2 instances, configuring security groups, setting up Nginx, and deploying production applications.
                                            </p>

                                            {/* Action Button */}
                                            <div className="mt-auto pt-2.5 flex items-center justify-between border-t-2 border-black/15">
                                                <span className="text-xs font-black text-black">
                                                    Start reading guide
                                                </span>
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black text-[#a2ff86] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] group-hover:translate-x-0.5 transition-transform">
                                                    ↗
                                                </span>
                                            </div>
                                        </Link>
                                    </div>

                                    {/* Right: Quick Chapter Links */}
                                    <div className="col-span-12 lg:col-span-5 flex flex-col justify-between gap-2">
                                        <div className="flex items-center justify-between pb-0.5">
                                            <span className="text-xs font-mono font-black uppercase text-black tracking-wider">
                                                Workbook Chapters
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-neutral-700 bg-[#FAF6EE] px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                                5 Modules
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-2 flex-1">
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
                                                    className="p-2.5 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all text-left group"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-[10px] font-mono font-black text-[#a2ff86] bg-black border border-black px-1.5 py-0.5 rounded shrink-0">
                                                                CH {ch.chapter}
                                                            </span>
                                                            <h4 className="text-xs font-black text-black group-hover:text-black transition-colors truncate">
                                                                {ch.title}
                                                            </h4>
                                                        </div>
                                                        <span className="text-black font-bold text-xs opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0">
                                                            →
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-700 font-medium mt-0.5 line-clamp-1">
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