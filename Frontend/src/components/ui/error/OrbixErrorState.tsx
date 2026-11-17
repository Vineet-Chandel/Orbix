import React from "react";
import {
    AlertTriangle,
    WifiOff,
    RefreshCw,
    FolderOpen,
    Lock,
    FileQuestion,
    Home,
} from "lucide-react";

export type OrbixErrorStateType =
    | "error"
    | "offline"
    | "empty"
    | "unauthorized"
    | "not-found";

export interface OrbixErrorStateProps {
    type?: OrbixErrorStateType;
    title?: string;
    message?: string;
    onRetry?: () => void;
    retryLabel?: string;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    secondaryActionHref?: string;
    className?: string;
    compact?: boolean;
    children?: React.ReactNode;
}

const DEFAULT_CONFIG: Record<
    OrbixErrorStateType,
    {
        icon: React.ComponentType<{ className?: string }>;
        badge: string;
        badgeColor: string;
        title: string;
        message: string;
        retryLabel: string;
    }
> = {
    error: {
        icon: AlertTriangle,
        badge: "System Alert",
        badgeColor: "bg-[#FF6B6B] text-black",
        title: "Unable to Load Data",
        message: "An unexpected error occurred while retrieving this content. Please try again.",
        retryLabel: "Try Again",
    },
    offline: {
        icon: WifiOff,
        badge: "Offline",
        badgeColor: "bg-[#FFE566] text-black",
        title: "No Internet Connection",
        message: "You appear to be offline. Please verify your connection to retrieve updated data.",
        retryLabel: "Check & Retry",
    },
    empty: {
        icon: FolderOpen,
        badge: "Empty",
        badgeColor: "bg-neutral-200 text-black",
        title: "No Content Available",
        message: "There is nothing here yet. As activity occurs, it will appear in this space.",
        retryLabel: "Refresh",
    },
    unauthorized: {
        icon: Lock,
        badge: "Protected",
        badgeColor: "bg-[#FFE566] text-black",
        title: "Access Restricted",
        message: "You need to be signed in with appropriate permissions to access this area.",
        retryLabel: "Sign In",
    },
    "not-found": {
        icon: FileQuestion,
        badge: "Missing",
        badgeColor: "bg-neutral-200 text-black",
        title: "Record Not Found",
        message: "The requested item or section could not be located or may have been relocated.",
        retryLabel: "Go Back",
    },
};

export const OrbixErrorState: React.FC<OrbixErrorStateProps> = ({
    type = "error",
    title,
    message,
    onRetry,
    retryLabel,
    secondaryActionLabel,
    onSecondaryAction,
    secondaryActionHref,
    className = "",
    compact = false,
    children,
}) => {
    const config = DEFAULT_CONFIG[type];
    const IconComponent = config.icon;

    const displayTitle = title || config.title;
    const displayMessage = message || config.message;
    const displayRetryLabel = retryLabel || config.retryLabel;

    if (compact) {
        return (
            <div
                className={`w-full p-4 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3 text-left ${className}`}
                role="alert"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF6EE] border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0">
                        <IconComponent className="w-4.5 h-4.5 text-black stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs font-black text-black truncate uppercase tracking-tight">
                            {displayTitle}
                        </h4>
                        <p className="text-[11px] font-bold text-neutral-600 truncate">
                            {displayMessage}
                        </p>
                    </div>
                </div>

                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#a2ff86] hover:bg-[#8ef56e] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                    >
                        <RefreshCw className="w-3 h-3 stroke-[2.5]" />
                        <span>{displayRetryLabel}</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div
            className={`w-full rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6 sm:p-8 text-center flex flex-col items-center justify-center space-y-4 ${className}`}
            role="alert"
        >
            {/* Neo-Brutalist Icon Container */}
            <div className="w-14 h-14 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center text-black">
                <IconComponent className="w-7 h-7 stroke-[2.5]" />
            </div>

            {/* Status Badge */}
            <span
                className={`inline-block px-3 py-0.5 rounded-full border border-black text-[10px] font-black uppercase tracking-widest ${config.badgeColor}`}
            >
                {config.badge}
            </span>

            {/* Typography */}
            <div className="space-y-1.5 max-w-md">
                <h3 className="text-base sm:text-lg font-black text-black tracking-tight leading-snug">
                    {displayTitle}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-neutral-600 leading-relaxed">
                    {displayMessage}
                </p>
            </div>

            {/* Actions */}
            {(onRetry || secondaryActionLabel || children) && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {onRetry && (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ef56e] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{displayRetryLabel}</span>
                        </button>
                    )}

                    {secondaryActionLabel && (
                        secondaryActionHref ? (
                            <a
                                href={secondaryActionHref}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                <Home className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{secondaryActionLabel}</span>
                            </a>
                        ) : onSecondaryAction ? (
                            <button
                                type="button"
                                onClick={onSecondaryAction}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                                <span>{secondaryActionLabel}</span>
                            </button>
                        ) : null
                    )}

                    {children}
                </div>
            )}
        </div>
    );
};

export default OrbixErrorState;
