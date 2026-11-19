
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import type { OrbixLoaderProps } from "./loader.types";
import { OrbixLoaderIcon } from "./OrbixLoaderIcon";
import { OrbixProgressBar } from "./OrbixProgressBar";
import { OrbixLoaderOverlay } from "./OrbixLoaderOverlay";
import { DEFAULT_COLOR, ACCENT_COLOR } from "./loader.constants";

/* -----------------------------------------
   Animation Configuration
------------------------------------------ */

const EASING = [0.22, 1, 0.36, 1] as const;

const ANIMATION_DURATION = {
    fast: 0.16,
    normal: 0.24,
    slow: 0.36,
} as const;

const ENTRY_ANIMATION = {
    opacity: 0,
    y: 7,
    scale: 0.97,
};

const VISIBLE_ANIMATION = {
    opacity: 1,
    y: 0,
    scale: 1,
};

const EXIT_ANIMATION = {
    opacity: 0,
    y: -4,
    scale: 0.98,
};

/* -----------------------------------------
   Utilities
------------------------------------------ */

const getLoaderSize = (
    size: OrbixLoaderProps["size"],
    variant: OrbixLoaderProps["variant"]
): OrbixLoaderProps["size"] => {
    if (variant === "fullscreen" && size === "md") {
        return "lg";
    }

    if (variant === "inline" && size === "md") {
        return "xs";
    }

    return size;
};

const normalizeProgress = (
    progress: number | undefined
): number | undefined => {
    if (typeof progress !== "number" || !Number.isFinite(progress)) {
        return undefined;
    }

    return Math.min(100, Math.max(0, progress));
};

/* -----------------------------------------
   OrbixLoader
------------------------------------------ */

/**
 * Centralized animated loading component for Orbix.
 *
 * Variants:
 * - minimal
 * - inline
 * - centered
 * - overlay
 * - fullscreen
 *
 * Features:
 * - Custom SVG loader identity
 * - Framer Motion transitions
 * - Reduced-motion support for wrapper animations
 * - Accessible status announcements
 * - Determinate progress
 * - Responsive sizing
 * - Consistent visual behavior
 */

export const OrbixLoader: React.FC<OrbixLoaderProps> = ({
    size = "md",
    variant = "centered",
    label,
    progress,
    speed = "normal",
    color = DEFAULT_COLOR,
    accentColor = ACCENT_COLOR,
    className = "",
    overlayClassName = "",
    showTrack = true,
}) => {
    const prefersReducedMotion = useReducedMotion();

    const shouldAnimate = prefersReducedMotion !== true;

    const accessibleLabel = label?.trim() || "Loading...";

    const visibleLabel = Boolean(label?.trim());

    const normalizedProgress = normalizeProgress(progress);

    const hasProgress =
        normalizedProgress !== undefined && showTrack;

    const loaderSize = getLoaderSize(size, variant);

    const duration = ANIMATION_DURATION[speed];

    const transition = {
        duration: shouldAnimate ? duration : 0,
        ease: EASING,
    };

    /* -----------------------------------------
       Shared Loader Content
    ------------------------------------------ */

    const content = (
        <motion.div
            initial={shouldAnimate ? ENTRY_ANIMATION : false}
            animate={VISIBLE_ANIMATION}
            exit={shouldAnimate ? EXIT_ANIMATION : { opacity: 0 }}
            transition={transition}
            className={[
                "relative flex flex-col",
                "items-center justify-center",
                "select-none",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-orbix-loader
            data-loader-variant={variant}
        >
            {/* Orbix Animated SVG Identity */}

            <span
                aria-hidden="true"
                className="flex items-center justify-center"
            >
                <OrbixLoaderIcon
                    size={loaderSize}
                    speed={speed}
                    color={color}
                    accentColor={accentColor}
                />
            </span>

            {/* Loading Label */}

            {visibleLabel && (
                <motion.p
                    initial={
                        shouldAnimate
                            ? { opacity: 0, y: 4 }
                            : false
                    }
                    animate={{
                        opacity: 1,
                        y: 0,
                    }}
                    transition={{
                        ...transition,
                        delay: shouldAnimate ? 0.08 : 0,
                    }}
                    className={[
                        "mt-3 max-w-[220px]",
                        "truncate text-center",
                        "text-xs font-semibold",
                        "tracking-tight",
                    ].join(" ")}
                    aria-hidden="true"
                >
                    {label}
                </motion.p>
            )}

            {/* Screen Reader Label */}

            <span className="sr-only">
                {accessibleLabel}
            </span>

            {/* Determinate Progress */}

            {hasProgress && (
                <div className="mt-3 w-full max-w-[180px]">
                    <OrbixProgressBar
                        progress={normalizedProgress}
                        accentColor={accentColor}
                        className="w-full"
                    />

                    <span className="sr-only">
                        {Math.round(normalizedProgress)}% complete
                    </span>
                </div>
            )}

            {/* Accessible Progress Information */}

            {hasProgress && (
                <div
                    className="sr-only"
                    role="progressbar"
                    aria-label={`${accessibleLabel} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={normalizedProgress}
                />
            )}
        </motion.div>
    );

    /* -----------------------------------------
       1. MINIMAL VARIANT
       Icon only
    ------------------------------------------ */

    if (variant === "minimal") {
        return (
            <motion.div
                initial={shouldAnimate ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                className={[
                    "inline-flex items-center justify-center",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label={accessibleLabel}
                data-orbix-loader
                data-loader-variant="minimal"
            >
                <span aria-hidden="true">
                    <OrbixLoaderIcon
                        size={size}
                        speed={speed}
                        color={color}
                        accentColor={accentColor}
                    />
                </span>
            </motion.div>
        );
    }

    /* -----------------------------------------
       2. INLINE VARIANT
       Buttons, forms, inputs
    ------------------------------------------ */

    if (variant === "inline") {
        return (
            <motion.div
                initial={shouldAnimate ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                className={[
                    "inline-flex max-w-full",
                    "items-center gap-2",
                    "select-none",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-orbix-loader
                data-loader-variant="inline"
            >
                <span
                    aria-hidden="true"
                    className="shrink-0"
                >
                    <OrbixLoaderIcon
                        size={loaderSize}
                        speed={speed}
                        color={color}
                        accentColor={accentColor}
                    />
                </span>

                {visibleLabel ? (
                    <span
                        className={[
                            "min-w-0 truncate",
                            "text-xs font-semibold",
                            "tracking-tight",
                        ].join(" ")}
                        aria-hidden="true"
                    >
                        {label}
                    </span>
                ) : (
                    <span className="sr-only">
                        {accessibleLabel}
                    </span>
                )}
            </motion.div>
        );
    }

    /* -----------------------------------------
       3. OVERLAY VARIANT
       4. FULLSCREEN VARIANT
    ------------------------------------------ */

    if (
        variant === "overlay" ||
        variant === "fullscreen"
    ) {
        return (
            <OrbixLoaderOverlay
                isOpen={true}
                fullscreen={variant === "fullscreen"}
                className={overlayClassName}
            >
                {content}
            </OrbixLoaderOverlay>
        );
    }

    /* -----------------------------------------
       5. CENTERED VARIANT
       Content sections and cards
    ------------------------------------------ */

    return (
        <div
            className={[
                "flex w-full",
                "min-h-[160px]",
                "items-center justify-center",
                "py-8",
            ].join(" ")}
            data-loader-container
        >
            {content}
        </div>
    );
};

export default OrbixLoader;
