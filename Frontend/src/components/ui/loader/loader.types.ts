import type { ReactNode } from "react";

export type LoaderSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

export type LoaderVariant = "inline" | "centered" | "overlay" | "fullscreen" | "minimal";

export type LoaderSpeed = "slow" | "normal" | "fast";

export interface OrbixLoaderIconProps {
    size?: LoaderSize;
    speed?: LoaderSpeed;
    color?: string;
    strokeWidth?: number;
    accentColor?: string;
    className?: string;
    reducedMotion?: boolean;
}

export interface OrbixLoaderProps {
    size?: LoaderSize;
    variant?: LoaderVariant;
    label?: string;
    description?: string;
    progress?: number;
    speed?: LoaderSpeed;
    color?: string;
    accentColor?: string;
    className?: string;
    overlayClassName?: string;
    showTrack?: boolean;
    centerScreen?: boolean;
    children?: ReactNode;
}

export interface LoaderTask {
    id: string;
    label?: string;
    description?: string;
    progress?: number;
    variant?: LoaderVariant;
    startTime: number;
    delay?: number;
    minDuration?: number;
}

export interface ShowLoaderOptions {
    id?: string;
    label?: string;
    description?: string;
    progress?: number;
    variant?: LoaderVariant;
    delay?: number;
    minDuration?: number;
}

export interface UpdateLoaderOptions {
    id?: string;
    label?: string;
    description?: string;
    progress?: number;
}

export interface OrbixLoadingContextValue {
    isLoading: boolean;
    isDelayedShowing: boolean;
    activeTask: LoaderTask | null;
    showLoader: (options?: ShowLoaderOptions) => string;
    hideLoader: (id?: string) => void;
    updateLoader: (options: UpdateLoaderOptions) => void;
    withGlobalLoading: <T>(fn: () => Promise<T>, options?: ShowLoaderOptions) => Promise<T>;
}

export type SkeletonVariant = "text" | "avatar" | "card" | "image" | "table-row" | "button";

export interface OrbixSkeletonProps {
    variant?: SkeletonVariant;
    width?: string | number;
    height?: string | number;
    className?: string;
    count?: number;
    rounded?: string;
}
