import type { LoaderSize } from "./loader.types";
import { LOADER_SIZE_MAP } from "./loader.constants";

export function getNumericSize(size?: LoaderSize): number {
    if (typeof size === "number") return size;
    if (size && LOADER_SIZE_MAP[size]) return LOADER_SIZE_MAP[size];
    return LOADER_SIZE_MAP.md;
}

export function getStrokeWidth(size?: LoaderSize, customStroke?: number): number {
    if (typeof customStroke === "number") return customStroke;
    const numSize = getNumericSize(size);
    // Calculate SVG coordinate stroke to ensure consistent ~1.8px-2.4px visible screen stroke
    if (numSize <= 22) return 5.0;
    if (numSize <= 26) return 4.5;
    if (numSize <= 38) return 3.6;
    if (numSize <= 54) return 3.2;
    if (numSize <= 72) return 3.0;
    return 2.8;
}

export function clampProgress(val?: number): number | undefined {
    if (typeof val !== "number") return undefined;
    return Math.max(0, Math.min(100, Math.round(val)));
}

let counter = 0;
export function generateTaskId(prefix = "task"): string {
    counter = (counter + 1) % 1000000;
    return `${prefix}-${Date.now()}-${counter}`;
}

export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
