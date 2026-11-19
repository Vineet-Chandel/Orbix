import type { LoaderSize, LoaderSpeed } from "./loader.types";

export const LOADER_SIZE_MAP: Record<Exclude<LoaderSize, number>, number> = {
    xs: 20,
    sm: 26,
    md: 38,
    lg: 54,
    xl: 72,
};

export const LOADER_STROKE_MAP: Record<Exclude<LoaderSize, number>, number> = {
    xs: 4.8,
    sm: 4.4,
    md: 3.6,
    lg: 3.2,
    xl: 3.0,
};

export const LOADER_DURATION_MAP: Record<LoaderSpeed, number> = {
    fast: 1.6,
    normal: 2.4,
    slow: 3.6,
};

export const DEFAULT_COLOR = "currentColor";
export const DEFAULT_BG = "transparent";
export const ACCENT_COLOR = "currentColor";

export const DEFAULT_DELAY_MS = 150;
export const DEFAULT_MIN_DURATION_MS = 300;

/**
 * Normalized 64x64 SVG Path Definitions:
 * Exactly matching command structure (M followed by 10 C curves, then Z)
 * for seamless Framer Motion path morphing.
 */

// Path A: Upright Hourglass with flat rounded top/bottom caps and narrow waist
export const SVG_PATH_HOURGLASS =
    "M 20 12 C 24 12, 40 12, 44 12 C 47 12, 48 14, 46 17 C 42 23, 36 28, 35 32 C 36 36, 42 41, 46 47 C 48 50, 47 52, 44 52 C 40 52, 24 52, 20 52 C 17 52, 16 50, 18 47 C 22 41, 28 36, 29 32 C 28 28, 22 23, 18 17 C 16 14, 17 12, 20 12 Z";

// Path B: Tilted Bowtie / Flow Symbol with curved lateral lobes and organic pinched waist
export const SVG_PATH_BOWTIE =
    "M 20 15 C 24 14, 40 14, 44 15 C 49 16, 52 22, 49 27 C 44 30, 36 30, 35 32 C 36 34, 44 34, 49 37 C 52 42, 49 48, 44 49 C 40 50, 24 50, 20 49 C 15 48, 12 42, 15 37 C 20 34, 28 34, 29 32 C 28 30, 20 30, 15 27 C 12 22, 15 16, 20 15 Z";

// Inner Clip Path: Hourglass inner chamber cavity (inset by 2.5px)
export const SVG_INNER_CLIP_HOURGLASS =
    "M 21.5 14.5 C 25 14.5, 39 14.5, 42.5 14.5 C 44.5 14.5, 45.5 16, 44 18 C 40 23.5, 34.5 28.5, 34 32 C 34.5 35.5, 40 40.5, 44 46 C 45.5 48, 44.5 49.5, 42.5 49.5 C 39 49.5, 25 49.5, 21.5 49.5 C 19.5 49.5, 18.5 48, 20 46 C 24 40.5, 29.5 35.5, 30 32 C 29.5 28.5, 24 23.5, 20 18 C 18.5 16, 19.5 14.5, 21.5 14.5 Z";

// Inner Clip Path: Bowtie inner cavity
export const SVG_INNER_CLIP_BOWTIE =
    "M 21.5 17 C 25 16, 39 16, 42.5 17 C 46.5 18, 49 22.5, 46.5 26.5 C 42 29.5, 35 29.5, 34 32 C 35 34.5, 42 34.5, 46.5 37.5 C 49 41.5, 46.5 46, 42.5 47 C 39 48, 25 48, 21.5 47 C 17.5 46, 15 41.5, 17.5 37.5 C 22 34.5, 29 34.5, 30 32 C 29 29.5, 22 29.5, 17.5 26.5 C 15 22.5, 17.5 18, 21.5 17 Z";
