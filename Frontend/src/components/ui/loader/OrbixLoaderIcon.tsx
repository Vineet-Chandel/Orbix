import React, { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { OrbixLoaderIconProps } from "./loader.types";
import {
    DEFAULT_COLOR,
    ACCENT_COLOR,
    LOADER_DURATION_MAP,
    SVG_PATH_HOURGLASS,
    SVG_PATH_BOWTIE,
    SVG_INNER_CLIP_HOURGLASS,
    SVG_INNER_CLIP_BOWTIE,
} from "./loader.constants";
import { getNumericSize, getStrokeWidth } from "./loader.utils";

/**
 * OrbixLoaderIcon
 *
 * Core continuous morphing SVG loader:
 * Hourglass → Fluid transformation → Bowtie / Flow symbol → Fluid transformation → Hourglass.
 * 
 * Hardware-accelerated, resolution-independent SVG with Framer Motion path interpolation.
 */
export const OrbixLoaderIcon: React.FC<OrbixLoaderIconProps> = ({
    size = "md",
    speed = "normal",
    color = DEFAULT_COLOR,
    strokeWidth,
    accentColor = ACCENT_COLOR,
    className = "",
    reducedMotion = false,
}) => {
    const rawId = useId();
    const clipId = useMemo(() => `orbix-clip-${rawId.replace(/:/g, "")}`, [rawId]);
    const glowId = useMemo(() => `orbix-glow-${rawId.replace(/:/g, "")}`, [rawId]);

    const systemReducedMotion = useReducedMotion();
    const isReduced = reducedMotion || Boolean(systemReducedMotion);

    const numSize = getNumericSize(size);
    const calculatedStroke = getStrokeWidth(size, strokeWidth);
    const duration = LOADER_DURATION_MAP[speed] || LOADER_DURATION_MAP.normal;

    // Reduced motion mode: elegant static hourglass with gentle breathing opacity
    if (isReduced) {
        return (
            <svg
                width={numSize}
                height={numSize}
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={`select-none shrink-0 ${className}`}
                aria-hidden="true"
            >
                <g transform="translate(32 32) scale(1.18) translate(-32 -32)">
                    {/* Outlined Hourglass */}
                    <path
                        d={SVG_PATH_HOURGLASS}
                        stroke={color}
                        strokeWidth={calculatedStroke}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Static Upper & Lower Fluid with calm pulse */}
                    <motion.g
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <path
                            d="M 23 18 L 41 18 L 34 29 L 30 29 Z"
                            fill={color}
                            opacity={0.85}
                        />
                        <path
                            d="M 22 49 Q 32 40 42 49 Z"
                            fill={color}
                            opacity={0.9}
                        />
                    </motion.g>
                </g>
            </svg>
        );
    }

    return (
        <svg
            width={numSize}
            height={numSize}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`select-none shrink-0 ${className}`}
            aria-hidden="true"
        >
            <defs>
                {/* Inner clipping path for liquid containment */}
                <clipPath id={clipId}>
                    <motion.path
                        animate={{
                            d: [
                                SVG_INNER_CLIP_HOURGLASS,
                                SVG_INNER_CLIP_HOURGLASS,
                                SVG_INNER_CLIP_BOWTIE,
                                SVG_INNER_CLIP_HOURGLASS,
                                SVG_INNER_CLIP_HOURGLASS,
                            ],
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.45, 0.72, 0.95, 1],
                        }}
                    />
                </clipPath>

                {/* Subtle technical glow highlight for the waist pinch */}
                <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>

            {/* Scale wrapper centered at (32, 32) to ensure hourglass fills the viewport without edge clipping */}
            <g transform="translate(32 32) scale(1.18) translate(-32 -32)">
                {/* Rotating Container: Flips 180 degrees every cycle so drained sand resets to top naturally around geometric center */}
                <motion.g
                    style={{
                        originX: 0.5,
                        originY: 0.5,
                        transformOrigin: "32px 32px",
                        transformBox: "view-box",
                    }}
                    animate={{
                        rotate: [0, 0, 90, 180, 180],
                    }}
                    transition={{
                        duration,
                        repeat: Infinity,
                        ease: [0.65, 0, 0.35, 1],
                        times: [0, 0.48, 0.75, 0.98, 1],
                    }}
                >
                    {/* LIQUID & PARTICLES LAYER (Strictly clipped within the glass shell) */}
                    <g clipPath={`url(#${clipId})`}>
                        {/* 1. Upper Chamber Draining Fluid */}
                        <motion.path
                            fill={color}
                            animate={{
                                d: [
                                    "M 21.5 16 C 25 15, 39 15, 42.5 16 L 34.5 30 L 29.5 30 Z",
                                    "M 24 22 C 28 21.5, 36 21.5, 40 22 L 33.5 30.5 L 30.5 30.5 Z",
                                    "M 29 28 C 30.5 28, 33.5 28, 35 28 L 32.8 31 L 31.2 31 Z",
                                    "M 31 31 L 33 31 L 32.5 31.5 L 31.5 31.5 Z",
                                    "M 21.5 16 C 25 15, 39 15, 42.5 16 L 34.5 30 L 29.5 30 Z",
                                ],
                                opacity: [0.95, 0.9, 0.8, 0, 0.95],
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                ease: "easeInOut",
                                times: [0, 0.25, 0.42, 0.48, 1],
                            }}
                        />

                        {/* 2. Lower Chamber Accumulating Mound */}
                        <motion.path
                            fill={color}
                            animate={{
                                d: [
                                    // Start: near empty flat pool
                                    "M 22 49 Q 32 48.5 42 49 L 43 50 L 21 50 Z",
                                    // Mid: growing rounded dome
                                    "M 21.5 49 Q 32 44 42.5 49 L 43 50 L 21 50 Z",
                                    // Full: prominent curved sand mound reaching toward waist
                                    "M 20.5 49 Q 32 38.5 43.5 49 L 44 50 L 20 50 Z",
                                    // During rotation / bowtie morph: fluid pools with centrifugal inertia along lower-right wing
                                    "M 21 48 C 29 44, 40 40, 46 47 C 43 50, 30 50, 21 48 Z",
                                    // Reset as it completes 180° flip (now at the top for next cycle)
                                    "M 22 49 Q 32 48.5 42 49 L 43 50 L 21 50 Z",
                                ],
                                opacity: [0.9, 0.95, 1, 0.95, 0.9],
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                ease: "easeInOut",
                                times: [0, 0.25, 0.48, 0.75, 1],
                            }}
                        />

                        {/* 3. Central Pouring Fluid Stream */}
                        <motion.line
                            x1="32"
                            y1="30.5"
                            x2="32"
                            y2="46"
                            stroke={color}
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            animate={{
                                opacity: [0, 1, 1, 0, 0],
                                strokeDashoffset: [0, -12, -24, -30, 0],
                            }}
                            style={{
                                strokeDasharray: "4 3",
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                ease: "linear",
                                times: [0, 0.08, 0.44, 0.48, 1],
                            }}
                        />

                        {/* 4. Fine Mist/Splash Particles in Lower Chamber */}
                        <motion.circle
                            cx="32"
                            cy="43"
                            r="1.6"
                            fill={color}
                            animate={{
                                opacity: [0, 0.8, 0.8, 0, 0],
                                scale: [0.6, 1.2, 0.9, 0.4, 0],
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                ease: "easeOut",
                                times: [0, 0.1, 0.42, 0.48, 1],
                            }}
                        />
                    </g>

                    {/* OUTER SHAPE MORPHING OUTLINE (Hourglass <-> Bowtie) */}
                    <motion.path
                        stroke={color}
                        strokeWidth={calculatedStroke}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        animate={{
                            d: [
                                SVG_PATH_HOURGLASS,
                                SVG_PATH_HOURGLASS,
                                SVG_PATH_BOWTIE,
                                SVG_PATH_HOURGLASS,
                                SVG_PATH_HOURGLASS,
                            ],
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.48, 0.75, 0.98, 1],
                        }}
                    />

                    {/* RESTRAINED SUBTLE ACCENT PINCH HIGHLIGHT */}
                    <motion.circle
                        cx="32"
                        cy="32"
                        r="1.8"
                        fill={accentColor}
                        filter={`url(#${glowId})`}
                        animate={{
                            opacity: [0.3, 0.9, 0.5, 0.2, 0.3],
                            scale: [0.8, 1.2, 1, 0.7, 0.8],
                        }}
                        transition={{
                            duration,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.25, 0.5, 0.75, 1],
                        }}
                    />
                </motion.g>
            </g>
        </svg>
    );
};
