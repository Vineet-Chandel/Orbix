// Frontend/src/app/Club/TeamWorkspace/Navigation/WorkspaceSectionSwitcher.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface WorkspaceSectionNavItem {
    id: string;
    label: string;
    count?: number;
    icon: React.ReactNode;
    accentDotClass?: string;
}

interface WorkspaceSectionSwitcherProps {
    items: WorkspaceSectionNavItem[];
    activeSection: string;
    onSelect: (sectionId: string) => void;
}

export const WorkspaceSectionSwitcher: React.FC<WorkspaceSectionSwitcherProps> = ({
    items,
    activeSection,
    onSelect,
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollIndicators = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const maxScrollLeft = el.scrollWidth - el.clientWidth;
        setCanScrollLeft(el.scrollLeft > 6);
        setCanScrollRight(maxScrollLeft - el.scrollLeft > 6);
    }, []);

    // Measure overflow & attach resize observer
    useEffect(() => {
        const timer = window.setTimeout(updateScrollIndicators, 0);
        const el = scrollContainerRef.current;
        if (!el) return () => window.clearTimeout(timer);

        const ro = new ResizeObserver(() => updateScrollIndicators());
        ro.observe(el);
        return () => {
            window.clearTimeout(timer);
            ro.disconnect();
        };
    }, [items.length, updateScrollIndicators]);

    // Smoothly scroll the black toggle track to center the active white overlay
    useEffect(() => {
        const target = buttonRefs.current[activeSection];
        if (!target) return;
        target.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
        });
        const timer = window.setTimeout(updateScrollIndicators, 320);
        return () => window.clearTimeout(timer);
    }, [activeSection, items.length, updateScrollIndicators]);

    const scrollByAmount = (delta: number) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollBy({ left: delta, behavior: "smooth" });
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const el = scrollContainerRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            el.scrollLeft += e.deltaY;
        }
    };

    return (
        <div className="relative w-full bg-black border-2 border-black rounded-2xl p-1.5 sm:p-2 shadow-[4px_4px_0px_#000] overflow-hidden">
            {/* Subtle left scroll control when overflowing */}
            {canScrollLeft && (
                <button
                    type="button"
                    onClick={() => scrollByAmount(-240)}
                    aria-label="Scroll sections left"
                    className="hidden sm:flex items-center justify-center absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-9 rounded-lg bg-black/90 hover:bg-neutral-800 text-white border border-white/20 shadow-md transition"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            )}

            <LayoutGroup id="orbix-workspace-section-toggle">
                <div
                    ref={scrollContainerRef}
                    onScroll={updateScrollIndicators}
                    onWheel={handleWheel}
                    role="tablist"
                    aria-label="Workspace Sections"
                    className={`flex items-center gap-1.5 w-full overflow-x-auto no-scrollbar scroll-smooth ${
                        canScrollLeft ? "sm:pl-7" : ""
                    } ${canScrollRight ? "sm:pr-7" : ""}`}
                >
                    {items.map((item) => {
                        const isActive = activeSection === item.id;
                        return (
                            <motion.button
                                key={item.id}
                                ref={(node) => {
                                    buttonRefs.current[item.id] = node;
                                }}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => onSelect(item.id)}
                                whileTap={{ scale: 0.97 }}
                                className={`relative shrink-0 px-4 py-2.5 rounded-xl text-xs font-black tracking-tight flex items-center gap-2 whitespace-nowrap select-none cursor-pointer transition-colors duration-150 focus:outline-none ${
                                    isActive
                                        ? "text-black"
                                        : "text-neutral-300 hover:text-white hover:bg-white/10"
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="workspace-active-section-pill"
                                        transition={{
                                            type: "spring",
                                            stiffness: 420,
                                            damping: 32,
                                            mass: 0.72,
                                        }}
                                        className="absolute inset-0 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#A6FF70] z-0"
                                    />
                                )}

                                <motion.span
                                    animate={{ scale: isActive ? 1.08 : 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 26,
                                    }}
                                    className="relative z-10 flex items-center justify-center"
                                >
                                    {item.icon}
                                </motion.span>

                                <span className="relative z-10">{item.label}</span>

                                {typeof item.count === "number" && (
                                    <span
                                        className={`relative z-10 px-1.5 py-0.5 text-[10px] font-black rounded-md border transition-colors ${
                                            isActive
                                                ? "bg-[#A6FF70] text-black border-black"
                                                : "bg-neutral-800 text-neutral-300 border-white/20"
                                        }`}
                                    >
                                        {item.count}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </LayoutGroup>

            {/* Subtle right scroll control when overflowing */}
            {canScrollRight && (
                <button
                    type="button"
                    onClick={() => scrollByAmount(240)}
                    aria-label="Scroll sections right"
                    className="hidden sm:flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-9 rounded-lg bg-black/90 hover:bg-neutral-800 text-white border border-white/20 shadow-md transition"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};
