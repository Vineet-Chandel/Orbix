import React from "react";
import type { OrbixSkeletonProps } from "./loader.types";

/**
 * OrbixSkeleton
 *
 * Coordinated placeholder skeleton components for predictable layouts.
 * Matches Orbix dark/neo-brutalist styling.
 */
export const OrbixSkeleton: React.FC<OrbixSkeletonProps> = ({
    variant = "text",
    width,
    height,
    className = "",
    count = 1,
    rounded,
}) => {
    const items = Array.from({ length: Math.max(1, count) });

    // Base shimmer animation class
    const baseClass = "bg-neutral-200 dark:bg-[#18181b] animate-pulse relative overflow-hidden";

    // 1. TEXT VARIANT
    if (variant === "text") {
        return (
            <div className={`space-y-2.5 w-full ${className}`}>
                {items.map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClass} h-3.5 ${rounded || "rounded-md"}`}
                        style={{
                            width: i === items.length - 1 && items.length > 1 ? "75%" : width || "100%",
                            height: height || undefined,
                        }}
                    />
                ))}
            </div>
        );
    }

    // 2. AVATAR VARIANT
    if (variant === "avatar") {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                {items.map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClass} ${rounded || "rounded-full"} shrink-0`}
                        style={{
                            width: width || 40,
                            height: height || width || 40,
                        }}
                    />
                ))}
            </div>
        );
    }

    // 3. CARD VARIANT
    if (variant === "card") {
        return (
            <div className={`grid gap-4 w-full ${className}`}>
                {items.map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClass} ${
                            rounded || "rounded-2xl"
                        } p-6 border-2 border-black/10 dark:border-white/10`}
                        style={{
                            width: width || "100%",
                            height: height || 160,
                        }}
                    />
                ))}
            </div>
        );
    }

    // 4. IMAGE VARIANT
    if (variant === "image") {
        return (
            <div className={`w-full ${className}`}>
                {items.map((_, i) => (
                    <div
                        key={i}
                        className={`${baseClass} ${rounded || "rounded-xl"} aspect-video border border-black/10 dark:border-white/10`}
                        style={{
                            width: width || "100%",
                            height: height || undefined,
                        }}
                    />
                ))}
            </div>
        );
    }

    // 5. TABLE ROW VARIANT
    if (variant === "table-row") {
        return (
            <div className={`space-y-3 w-full ${className}`}>
                {items.map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-4 p-3 bg-neutral-100 dark:bg-[#121215] rounded-xl border border-black/10 dark:border-white/10"
                    >
                        <div className={`${baseClass} w-8 h-8 rounded-lg shrink-0`} />
                        <div className="flex-1 space-y-1.5">
                            <div className={`${baseClass} h-3 w-1/3 rounded`} />
                            <div className={`${baseClass} h-2.5 w-1/2 rounded`} />
                        </div>
                        <div className={`${baseClass} h-6 w-16 rounded-md shrink-0`} />
                    </div>
                ))}
            </div>
        );
    }

    // 6. BUTTON VARIANT
    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            {items.map((_, i) => (
                <div
                    key={i}
                    className={`${baseClass} ${rounded || "rounded-xl"} h-10`}
                    style={{
                        width: width || 110,
                        height: height || 40,
                    }}
                />
            ))}
        </div>
    );
};
