import React, { useRef, useState, useEffect } from "react";
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
 * - Desktop (md and above: >= 768px): Pristine responsive multi-column grid layout.
 * - Mobile (< md): Pins the screen vertically at top-[75px], converting vertical finger
 *   scrolling into smooth horizontal card translation.
 * - Stops/pins until all cards have scrolled horizontally to the end, then smoothly resumes
 *   vertical scrolling up the page.
 * - Drastically reduces total page height and eliminates infinite vertical card stacking.
 */
export const MobilePinnedHorizontalCards: React.FC<MobilePinnedHorizontalCardsProps> = ({
    children,
    itemCount,
    className = "",
    cardWidthClassName = "w-[85vw] max-w-[325px]",
    sectionTitle = "Cards",
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const stickyRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    // Initial safe synchronous height estimates so container has space to stick from the very first frame
    const initialScrollDist = Math.max(300, (itemCount - 1) * 320);
    const [trackHeight, setTrackHeight] = useState<number>(540 + initialScrollDist);

    // Dynamic measurements on mount and resize
    useEffect(() => {
        if (itemCount <= 1) return;

        const updateMeasurements = () => {
            if (!rowRef.current || !viewportRef.current || !stickyRef.current) return;
            const rowWidth = rowRef.current.scrollWidth;
            const viewWidth = viewportRef.current.clientWidth;
            const maxScrollX = Math.max(0, rowWidth - viewWidth);
            const stickyH = stickyRef.current.offsetHeight || 500;
            const scrollDistance = Math.max(280, Math.round(maxScrollX * 1.15));

            setTrackHeight(stickyH + scrollDistance);
        };

        updateMeasurements();
        const t1 = setTimeout(updateMeasurements, 80);
        const t2 = setTimeout(updateMeasurements, 300);
        const t3 = setTimeout(updateMeasurements, 800);

        const ro = new ResizeObserver(() => updateMeasurements());
        if (rowRef.current) ro.observe(rowRef.current);
        if (viewportRef.current) ro.observe(viewportRef.current);
        if (stickyRef.current) ro.observe(stickyRef.current);

        window.addEventListener("resize", updateMeasurements, { passive: true });

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            ro.disconnect();
            window.removeEventListener("resize", updateMeasurements);
        };
    }, [itemCount]);

    // High performance direct DOM scroll translation (60fps/120fps with zero React re-render lag)
    useEffect(() => {
        if (itemCount <= 1) return;

        const handleScroll = () => {
            if (!trackRef.current || !rowRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            const pinTop = 75; // sticky offset below navbar
            const scrolled = pinTop - rect.top;

            const stickyH = stickyRef.current?.offsetHeight || 500;
            const totalScrollDist = Math.max(280, trackRef.current.offsetHeight - stickyH);

            const rawProgress = Math.max(0, Math.min(1, scrolled / totalScrollDist));

            // Map progress [0.02, 0.88] to horizontal travel [0, 1]
            // Leaves a 12% resting buffer at the end so the last card stays in view before unpinning
            const slideProgress = Math.max(0, Math.min(1, (rawProgress - 0.02) / 0.86));

            const viewWidth = viewportRef.current?.clientWidth || window.innerWidth;
            const maxScrollX = Math.max(0, rowRef.current.scrollWidth - viewWidth);
            const targetX = slideProgress * maxScrollX;

            rowRef.current.style.transform = `translate3d(${-targetX}px, 0, 0)`;

            if (progressBarRef.current) {
                progressBarRef.current.style.width = `${Math.round(15 + slideProgress * 85)}%`;
            }
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
        };
    }, [itemCount, trackHeight]);

    // Touch swipe listener: seamlessly convert horizontal thumb swipes to vertical window scroll
    useEffect(() => {
        const el = viewportRef.current;
        if (!el || itemCount <= 1) return;

        let touchStartX = 0;
        let touchStartY = 0;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return;
            const deltaX = touchStartX - e.touches[0].clientX;
            const deltaY = touchStartY - e.touches[0].clientY;

            // If user swipes horizontally on the cards, drive the window scroll directly
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
                window.scrollBy({ top: deltaX * 0.9, behavior: "instant" });
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        };

        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: true });

        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
        };
    }, [itemCount]);

    // If only 1 card exists, render cleanly centered without horizontal scroll
    if (itemCount <= 1) {
        return (
            <div className={`w-full ${className}`}>
                <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {children}
                </div>
                <div className="block md:hidden w-full flex justify-center">
                    <div className="w-full max-w-[325px]">
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`w-full ${className}`}>
            {/* 1. Desktop & Tablet Grid View (md and above: >= 768px) - Untouched & pristine */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {children}
            </div>

            {/* 2. Mobile Pinned Horizontal Scroll (under md: < 768px) */}
            <div className="block md:hidden w-full">
                <div
                    ref={trackRef}
                    style={{ height: `${trackHeight}px` }}
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
                                    <div
                                        ref={progressBarRef}
                                        style={{ width: "15%" }}
                                        className="h-full bg-[#a2ff86] border-r border-black transition-[width] duration-75 ease-out"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Viewport Window: NEVER wraps, displays cards side-by-side in one row */}
                        <div
                            ref={viewportRef}
                            className="w-full overflow-hidden pb-3 touch-pan-y"
                        >
                            <div
                                ref={rowRef}
                                className="flex flex-nowrap gap-4 w-max items-stretch pr-6 will-change-transform"
                                style={{ transform: "translate3d(0px, 0, 0)" }}
                            >
                                {React.Children.map(children, (child, idx) => (
                                    <div
                                        key={idx}
                                        className={`${cardWidthClassName} shrink-0 h-full flex flex-col`}
                                    >
                                        {child}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};