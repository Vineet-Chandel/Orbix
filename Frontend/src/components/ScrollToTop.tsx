import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Universal Scroll Restoration Architecture for Orbix
 * 
 * Guarantees that navigating between pages (e.g., from the landing page footer
 * to /docs, /pricing, /customers, /profile, etc.) immediately resets the scroll
 * position to the top of the viewport instead of preserving the scroll offset.
 * 
 * Also supports:
 * - Hash anchors (e.g., /docs#section-name scrolls to the targeted element)
 * - Re-clicking current route links from bottom of the page (smooth scrolls to top)
 * - Asynchronous Suspense/lazy-loaded route chunk mounting
 * - Disabling conflicting browser-native scroll restoration
 */
export const ScrollToTop: React.FC = () => {
    const location = useLocation();

    // Disable browser native automatic scroll restoration so it does not conflict with SPA routing
    useEffect(() => {
        if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
            window.history.scrollRestoration = "manual";
        }
    }, []);

    // Sync document title on route change, guaranteeing "Orbix" with capital 'O' across all pages
    useEffect(() => {
        if (typeof document === "undefined") return;

        const path = location.pathname;
        // Don't overwrite dynamic entity profiles that manage their own titles
        if (path.startsWith("/profile/u/") || path.startsWith("/clubs/")) {
            return;
        }

        const ROUTE_TITLE_MAP: Record<string, string> = {
            "/": "Orbix — The Engineering Credibility Network",
            "/dashboard": "Orbix",
            "/explore": "Explore — Orbix",
            "/trends": "Trends & Reports — Orbix",
            "/leaderboard": "Leaderboard — Orbix",
            "/events": "Events — Orbix",
            "/card": "Digital Card — Orbix",
            "/resume": "Resume — Orbix",
            "/projects": "Projects — Orbix",
            "/settings": "Settings — Orbix",
            "/college-clubs": "Campus Clubs & Chapters — Orbix",
            "/campus-clubs": "Campus Clubs & Chapters — Orbix",
            "/clubs": "Collegiate Clubs — Orbix",
            "/club": "Club Dashboard — Orbix",
            "/club/dashboard": "Club Dashboard — Orbix",
            "/club/status": "Club Status — Orbix",
            "/customers": "Customers — Orbix",
            "/pricing": "Pricing — Orbix",
            "/platform": "Platform — Orbix",
            "/platforms": "Platform Integrations — Orbix",
            "/blogs": "Blogs — Orbix",
            "/blog": "Blogs — Orbix",
            "/docs": "Documentation — Orbix",
            "/privacy": "Privacy Policy — Orbix",
            "/terms": "Terms & Conditions — Orbix",
            "/auth/signin": "Sign In — Orbix",
            "/auth/signup": "Sign Up — Orbix",
        };

        document.title = ROUTE_TITLE_MAP[path] || "Orbix";
    }, [location.pathname]);

    // Scroll to top or target anchor on route change
    useLayoutEffect(() => {
        // If an anchor hash is provided in the URL (e.g., #section-id), scroll to that element
        if (location.hash) {
            const elementId = location.hash.replace("#", "");
            const scrollToElement = () => {
                const element = document.getElementById(elementId) || document.querySelector(location.hash);
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "start" });
                    return true;
                }
                return false;
            };

            // Attempt immediate scroll, with a fallback timer for lazy/async components
            if (!scrollToElement()) {
                const timer = setTimeout(scrollToElement, 100);
                return () => clearTimeout(timer);
            }
            return;
        }

        const resetAllScrollPositions = () => {
            // 1. Primary window & document root scroll reset
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: "instant" as ScrollBehavior,
            });

            if (document.documentElement) {
                document.documentElement.scrollTop = 0;
            }
            if (document.body) {
                document.body.scrollTop = 0;
            }

            // 2. React root container reset
            const root = document.getElementById("root");
            if (root) {
                root.scrollTop = 0;
            }

            // 3. Reset any internal overflow scrolling containers (e.g. <main>, .overflow-y-auto)
            const scrollContainers = document.querySelectorAll<HTMLElement>(
                "main, [data-scroll-container], .overflow-y-auto, .overflow-auto"
            );
            scrollContainers.forEach((container) => {
                container.scrollTop = 0;
            });
        };

        // Immediate synchronous reset before paint
        resetAllScrollPositions();

        // Secondary reset on next animation frame to ensure lazy Suspense chunks mount at top
        const rafId = requestAnimationFrame(() => {
            resetAllScrollPositions();
        });

        // Tertiary fallback for heavy dynamically code-split routes
        const timerId = setTimeout(() => {
            resetAllScrollPositions();
        }, 50);

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(timerId);
        };
    }, [location.pathname, location.search, location.hash, location.key]);

    // Handle clicking a link pointing to the exact same page while scrolled down
    useEffect(() => {
        const handleSamePageLinkClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement)?.closest("a");
            if (!anchor) return;

            const href = anchor.getAttribute("href");
            if (!href) return;

            // Ignore external links, mailto, tel, or target="_blank"
            if (
                anchor.target === "_blank" ||
                href.startsWith("http://") ||
                href.startsWith("https://") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:")
            ) {
                return;
            }

            // If user clicked link to current page without an anchor hash, smooth scroll to top
            const currentPath = window.location.pathname;
            if (href === currentPath || href === "") {
                window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: "smooth",
                });
            }
        };

        document.addEventListener("click", handleSamePageLinkClick, true);
        return () => {
            document.removeEventListener("click", handleSamePageLinkClick, true);
        };
    }, []);

    return null;
};

export default ScrollToTop;
