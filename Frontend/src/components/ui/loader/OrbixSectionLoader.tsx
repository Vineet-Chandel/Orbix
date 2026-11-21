import React from "react";
import { OrbixLoader } from "./OrbixLoader";
import { OrbixSkeleton } from "./OrbixSkeleton";
import { OrbixErrorState } from "../error/OrbixErrorState";

export interface OrbixSectionLoaderProps {
    isLoading?: boolean;
    error?: Error | string | null;
    onRetry?: () => void;
    isEmpty?: boolean;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyActionLabel?: string;
    onEmptyAction?: () => void;
    skeleton?: "card" | "table-row" | "text" | "custom";
    customSkeleton?: React.ReactNode;
    skeletonCount?: number;
    loaderLabel?: string;
    className?: string;
    children?: React.ReactNode;
}

/**
 * OrbixSectionLoader
 *
 * Coordinates Layer 3 section-level states:
 * - Loading: renders contextual skeleton or centered loader without reflowing page shell.
 * - Error: renders actionable retry interface preserving container context.
 * - Empty: distinguishes empty data from ongoing loading or failure.
 * - Ready: renders the children seamlessly.
 */
export const OrbixSectionLoader: React.FC<OrbixSectionLoaderProps> = ({
    isLoading = false,
    error = null,
    onRetry,
    isEmpty = false,
    emptyTitle,
    emptyMessage,
    emptyActionLabel,
    onEmptyAction,
    skeleton = "card",
    customSkeleton,
    skeletonCount = 3,
    loaderLabel,
    className = "",
    children,
}) => {
    // 1. Loading State
    if (isLoading) {
        if (customSkeleton) {
            return <div className={`w-full ${className}`}>{customSkeleton}</div>;
        }

        if (skeleton === "card") {
            return (
                <div className={`w-full ${className}`}>
                    <OrbixSkeleton variant="card" count={skeletonCount} />
                </div>
            );
        }

        if (skeleton === "table-row") {
            return (
                <div className={`w-full ${className}`}>
                    <OrbixSkeleton variant="table-row" count={skeletonCount} />
                </div>
            );
        }

        if (skeleton === "text") {
            return (
                <div className={`w-full ${className}`}>
                    <OrbixSkeleton variant="text" count={skeletonCount} />
                </div>
            );
        }

        return (
            <div className={`w-full py-8 flex items-center justify-center ${className}`}>
                <OrbixLoader size="md" label={loaderLabel} />
            </div>
        );
    }

    // 2. Error State
    if (error) {
        const errorText = typeof error === "string" ? error : error?.message;
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

        return (
            <div className={`w-full ${className}`}>
                <OrbixErrorState
                    type={isOffline ? "offline" : "error"}
                    message={errorText || undefined}
                    onRetry={onRetry}
                />
            </div>
        );
    }

    // 3. Empty State
    if (isEmpty) {
        return (
            <div className={`w-full ${className}`}>
                <OrbixErrorState
                    type="empty"
                    title={emptyTitle}
                    message={emptyMessage}
                    secondaryActionLabel={emptyActionLabel}
                    onSecondaryAction={onEmptyAction}
                />
            </div>
        );
    }

    // 4. Content State
    return <>{children}</>;
};

export default OrbixSectionLoader;
