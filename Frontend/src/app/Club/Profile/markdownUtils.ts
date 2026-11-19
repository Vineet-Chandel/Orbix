import React from "react";
import DOMPurify from "dompurify";

/**
 * Safely sanitizes SVG / HTML strings across all environments (browser, SSR, Vite).
 */
export function safeSanitizeSvg(rawSvg: string): string {
    try {
        if (typeof window !== "undefined") {
            const purify =
                typeof (DOMPurify as any)?.sanitize === "function"
                    ? DOMPurify
                    : typeof (DOMPurify as any) === "function"
                    ? (DOMPurify as any)(window)
                    : (DOMPurify as any)?.default && typeof (DOMPurify as any)?.default?.sanitize === "function"
                    ? (DOMPurify as any).default
                    : null;
            if (purify && typeof purify.sanitize === "function") {
                return purify.sanitize(rawSvg, { USE_PROFILES: { svg: true, svgFilters: true } });
            }
        }
    } catch (e) {
        console.warn("DOMPurify sanitize warning:", e);
    }
    return rawSvg;
}

/**
 * Extracts raw plain text from React children nodes recursively.
 */
export function extractText(children: React.ReactNode): string {
    if (typeof children === "string") return children;
    if (typeof children === "number") return String(children);
    if (!children) return "";
    if (Array.isArray(children)) return children.map(extractText).join("");
    if (React.isValidElement(children) && children.props && (children.props as any).children) {
        return extractText((children.props as any).children);
    }
    return "";
}

/**
 * Generates a GitHub-compatible deterministic slug.
 */
export function githubSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[*_`~[\]()]/g, "") // strip markdown markers
        .replace(/<[^>]*>/g, "") // strip HTML tags
        .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF\u0900-\u097F\u0400-\u04FF\u4E00-\u9FFF-]/g, "") // keep unicode words & hyphen
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}
