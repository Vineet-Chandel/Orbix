import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";

export interface MobilePinnedHorizontalCardsProps {
    children: React.ReactNode;
    itemCount: number;
    className?: string;
    cardWidthClassName?: string;
    sectionTitle?: string;
}

/**
 * MobilePinnedHorizontalCards:
 * - On desktop (md and above: >= 768px): Pristine responsive multi-column grid layout.
 * - On mobile (< md): Pins the screen vertically below the floating navbar, converting
 *   vertical finger scrolling directly into horizontal card translation.
 * - Stops/pins until all cards have scrolled horizontally to the end, then smoothly resumes
 *   vertical scrolling up the page.
 * - Bidirectional (scroll down slides cards forward; scroll up slides cards backward).
 * - Drastically reduces total page height and eliminates infinite vertical card stacking.
 */
export const MobilePinnedHorizontalCards: React.FC<MobilePinnedHorizontalCardsProps> = ({
    children,
    itemCount,
    className = "",
    cardWidthClassName = "w-[84vw] max-w-[325px]",
    sectionTitle = "Cards",
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const stickyRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    const [maxScrollX, setMaxScrollX] = useState<number>(0);
    const [stickyHeight, setStickyHeight] = useState<number>(0);

    // Motion values for smooth 60fps/120fps hardware-accelerated animations
    const contentX = useMotionValue(0);
    const progressPercent = useMotionValue(15);
    const progressWidth = useTransform(progressPercent, (v) => `${v}%`);

    // Measure horizontal scrollable width and sticky container height
    useEffect(() => {
        const measure = () => {
            if (rowRef.current && viewportRef.current) {
                const totalWidth = rowRef.current.scrollWidth;
                const viewWidth = viewportRef.current.clientWidth;
                const diff = Math.max(0, totalWidth - viewWidth);
                setMaxScrollX((prev) => (Math.abs(prev - diff) > 2 ? diff : prev));
            }
            if (stickyRef.current) {
                const h = stickyRef.current.offsetHeight;
                setStickyHeight((prev) => (Math.abs(prev - h) > 2 ? h : prev));
            }
        };

        measure();
        const t1 = setTimeout(measure, 100);
        const t2 = setTimeout(measure, 350);
        const t3 = setTimeout(measure, 800);

        const ro = new ResizeObserver(() => measure());
        if (rowRef.current) ro.observe(rowRef.current);
        if (viewportRef.current) ro.observe(viewportRef.current);
        if (stickyRef.current) ro.observe(stickyRef.current);

        window.addEventListener("resize", measure, { passive: true });

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            ro.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [itemCount]);

    // Calculate vertical scroll distance needed to scroll all cards smoothly
    const scrollDistance = Math.max(280, Math.round(maxScrollX * 1.15));

    // Handle scroll to smoothly update motion values
    useEffect(() => {
        if (itemCount <= 1 || maxScrollX <= 0) {
            contentX.set(0);
            progressPercent.set(100);
            return;
        }

        const handleScroll = () => {
            if (!trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const pinTop = 75; // sticky offset from top of viewport
            const scrolled = pinTop - rect.top;
            const rawProgress = Math.max(0, Math.min(1, scrolled / scrollDistance));

            // Map progress [0.02, 0.88] to horizontal travel [0, 1]
            // Leaves a 12% resting zone at the end before unpinning
            const slideProgress = Math.max(0, Math.min(1, (rawProgress - 0.02) / 0.86));
            contentX.set(-slideProgress * maxScrollX);
            progressPercent.set(Math.round(15 + slideProgress * 85));
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, [itemCount, maxScrollX, scrollDistance, contentX, progressPercent]);

    // Height of the track wrapper: stickyHeight + scrollDistance ensures pinning unpins cleanly
    const trackHeight =
        maxScrollX > 0 && itemCount > 1 && stickyHeight > 0
            ? `${stickyHeight + scrollDistance}px`
            : "auto";

    return (
        <div className={`w-full ${className}`}>
            {/* 1. Desktop & Tablet Grid View (md and above: >= 768px) - completely untouched */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {children}
            </div>

            {/* 2. Mobile Pinned Horizontal Scroll (under md: < 768px) */}
            <div className="block md:hidden">
                {itemCount <= 1 || maxScrollX === 0 ? (
                    <div className="w-full flex justify-center">
                        <div className="w-full max-w-[340px]">
                            {children}
                        </div>
                    </div>
                ) : (
                    <div
                        ref={trackRef}
                        style={{ height: trackHeight }}
                        className="relative w-full"
                    >
                        {/* Sticky Viewport Container: Pinned comfortably below floating navbar */}
                        <div
                            ref={stickyRef}
                            className="sticky top-[75px] w-full z-10 py-2"
                        >
                            {/* Mobile Scroll Indicator Pill & Progress */}
                            <div className="flex items-center justify-between px-1 mb-2.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFE566] border-2 border-black text-[10px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000]">
                                    <span>Scroll down to slide</span>
                                    <ArrowRight className="w-3 h-3 stroke-[3]" />
                                </span>

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-black text-neutral-600">
                                        {itemCount} {sectionTitle}
                                    </span>
                                    <div className="w-16 h-2 rounded-full border border-black bg-white overflow-hidden shadow-[1px_1px_0px_#000]">
                                        <motion.div
                                            style={{ width: progressWidth }}
                                            className="h-full bg-[#a2ff86] border-r border-black"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Viewport Window with Overflow Hidden */}
                            <div ref={viewportRef} className="w-full overflow-hidden pb-3">
                                <motion.div
                                    ref={rowRef}
                                    style={{ x: contentX }}
                                    className="flex flex-nowrap gap-4 w-max items-stretch pr-6 will-change-transform"
                                >
                                    {React.Children.map(children, (child, idx) => (
                                        <div key={idx} className={`${cardWidthClassName} shrink-0 h-full flex flex-col`}>
                                            {child}
                                        </div>
                                    ))}
                                </motion.div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};