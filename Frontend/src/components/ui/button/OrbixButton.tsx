import React from "react";
import { OrbixLoaderIcon } from "../loader/OrbixLoaderIcon";

export type OrbixButtonVariant =
    | "yellow"
    | "primary"
    | "lime"
    | "black"
    | "white"
    | "danger"
    | "rose"
    | "danger-solid"
    | "amber"
    | "ghost";

export type OrbixButtonSize = "sm" | "md" | "lg" | "icon";

export interface OrbixButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Whether the button is in a loading state.
     * When true:
     * - Replaces leading icon with the custom Orbix animated hourglass
     * - Disables clicks and prevents double submission
     * - Displays loadingLabel (or auto-derived action verb)
     * - Sets aria-busy="true"
     */
    loading?: boolean;

    /**
     * Label to display during loading.
     * If omitted, auto-derives from common action verbs ("Connect" -> "Connecting...", etc.)
     * or original button label.
     */
    loadingLabel?: string;

    /**
     * Visual button styling variant.
     * Defaults to "yellow" (#FFE34A)
     */
    variant?: OrbixButtonVariant;

    /**
     * Button size preset matching Orbix standard proportions.
     * Defaults to "md"
     */
    size?: OrbixButtonSize;

    /**
     * Optional leading icon component (e.g. UserPlus, Save, Check) or JSX element.
     * Replaced by the animated OrbixLoaderIcon during loading.
     */
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode;

    /**
     * Optional trailing icon component (e.g. ArrowRight) or JSX element.
     */
    iconRight?: React.ComponentType<{ className?: string }> | React.ReactNode;

    /**
     * Expand to 100% of parent width.
     */
    fullWidth?: boolean;

    /**
     * Render typography uppercase with tracking-wider.
     */
    uppercase?: boolean;

    /**
     * Border thickness class override (default: "border-2")
     */
    borderWidth?: "2" | "2.5" | "3";

    /**
     * Custom shadow preset
     */
    shadow?: "sm" | "md" | "lg" | "none";
}

/**
 * Standard Action Verb Map for automatic loading label generation
 */
const ACTION_VERBS: Record<string, string> = {
    connect: "Connecting...",
    save: "Saving...",
    "save changes": "Saving Changes...",
    "save profile": "Saving Profile...",
    "save about": "Saving About...",
    submit: "Submitting...",
    delete: "Deleting...",
    remove: "Removing...",
    upload: "Uploading...",
    verify: "Verifying...",
    update: "Updating...",
    accept: "Accepting...",
    decline: "Declining...",
    withdraw: "Withdrawing...",
    disconnect: "Disconnecting...",
    refresh: "Refreshing...",
    sync: "Syncing...",
    add: "Adding...",
    "add member": "Adding Member...",
    create: "Creating...",
    "create team": "Creating Team...",
    publish: "Publishing...",
    unblock: "Unblocking...",
    send: "Sending...",
    "send invitation": "Sending...",
    "send message": "Sending...",
    "send notification": "Sending...",
    approve: "Approving...",
    confirm: "Confirming...",
    export: "Exporting...",
    activate: "Activating...",
    disable: "Disabling...",
};

function resolveLoadingText(
    loadingLabel?: string,
    children?: React.ReactNode
): string {
    if (loadingLabel) return loadingLabel;
    if (typeof children === "string") {
        const lower = children.trim().toLowerCase();
        if (ACTION_VERBS[lower]) {
            return ACTION_VERBS[lower];
        }
        // Basic progressive verb fallback
        if (lower.endsWith("e") && !lower.endsWith("ee")) {
            return `${children.trim().slice(0, -1)}ing...`;
        }
        return `${children.trim()}ing...`;
    }
    return "Loading...";
}

function renderIconElement(
    IconProp: React.ComponentType<{ className?: string }> | React.ReactNode,
    className: string
): React.ReactNode {
    if (!IconProp) return null;
    if (React.isValidElement(IconProp)) {
        return IconProp;
    }
    if (typeof IconProp === "function" || typeof IconProp === "object") {
        const IconComponent = IconProp as React.ComponentType<{ className?: string }>;
        return <IconComponent className={className} />;
    }
    return null;
}

const VARIANT_STYLES: Record<OrbixButtonVariant, string> = {
    yellow: "bg-[#FFE34A] hover:bg-[#ffd91a] text-black border-black",
    primary: "bg-[#FFE34A] hover:bg-[#ffd91a] text-black border-black",
    lime: "bg-[#a2ff86] hover:bg-[#8ee673] text-black border-black",
    black: "bg-black hover:bg-neutral-900 text-[#a2ff86] border-black",
    white: "bg-white hover:bg-neutral-100 text-black border-black",
    danger: "bg-rose-100 hover:bg-rose-200 text-rose-900 border-black",
    rose: "bg-rose-100 hover:bg-rose-200 text-rose-900 border-black",
    "danger-solid": "bg-rose-500 hover:bg-rose-600 text-white border-black",
    amber: "bg-amber-100 hover:bg-amber-200 text-amber-900 border-black",
    ghost: "bg-transparent hover:bg-black/5 text-black border-transparent hover:border-black shadow-none",
};

const SIZE_STYLES: Record<OrbixButtonSize, { container: string; minHeight: string; iconSize: number; iconClass: string; gap: string }> = {
    sm: {
        container: "px-3 py-1.5 text-xs font-black rounded-xl",
        minHeight: "min-h-[34px]",
        iconSize: 22,
        iconClass: "w-4 h-4 stroke-[2.5]",
        gap: "gap-2",
    },
    md: {
        container: "px-4 py-2 text-xs sm:text-sm font-black rounded-xl",
        minHeight: "min-h-[38px]",
        iconSize: 26,
        iconClass: "w-4.5 h-4.5 stroke-[2.5]",
        gap: "gap-2",
    },
    lg: {
        container: "px-5 py-2.5 text-sm sm:text-base font-black rounded-xl",
        minHeight: "min-h-[44px]",
        iconSize: 30,
        iconClass: "w-5 h-5 stroke-[2.5]",
        gap: "gap-2.5",
    },
    icon: {
        container: "p-2 rounded-xl aspect-square justify-center",
        minHeight: "min-h-[38px] min-w-[38px]",
        iconSize: 26,
        iconClass: "w-4.5 h-4.5 stroke-[2.5]",
        gap: "gap-0",
    },
};

const BORDER_STYLES: Record<"2" | "2.5" | "3", string> = {
    "2": "border-2",
    "2.5": "border-[2.5px]",
    "3": "border-[3px]",
};

const SHADOW_STYLES: Record<"sm" | "md" | "lg" | "none", string> = {
    sm: "shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]",
    md: "shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000]",
    lg: "shadow-[4px_4px_0px_#000] hover:shadow-[5px_5px_0px_#000]",
    none: "shadow-none",
};

/**
 * OrbixButton
 *
 * Production-grade neo-brutalist button for the Orbix ecosystem.
 * Features an integrated animated hourglass morphing loader with:
 * - Geometric center animation (preventing origin bugs)
 * - Complete layout stability (zero button width/height jumping via CSS grid dual-layer)
 * - Accessibility (aria-busy, disabled handling, polite announcements)
 * - Touch & keyboard friendliness
 */
export const OrbixButton = React.forwardRef<HTMLButtonElement, OrbixButtonProps>(
    (
        {
            children,
            loading = false,
            loadingLabel,
            variant = "yellow",
            size = "md",
            icon,
            iconRight,
            fullWidth = false,
            uppercase = false,
            borderWidth = "2",
            shadow = "sm",
            className = "",
            disabled = false,
            type = "button",
            onClick,
            ...props
        },
        ref
    ) => {
        const sizeConfig = SIZE_STYLES[size] || SIZE_STYLES.md;
        const resolvedLoadingLabel = resolveLoadingText(loadingLabel, children);
        const borderClass = BORDER_STYLES[borderWidth] || BORDER_STYLES["2"];
        const shadowClass = SHADOW_STYLES[shadow] || SHADOW_STYLES.sm;

        const isDisabled = Boolean(disabled || loading);

        // Leading icon rendering
        const renderedIcon = renderIconElement(icon, sizeConfig.iconClass);
        const renderedIconRight = renderIconElement(iconRight, sizeConfig.iconClass);

        return (
            <button
                ref={ref}
                type={type}
                disabled={isDisabled}
                onClick={loading ? undefined : onClick}
                aria-busy={loading ? "true" : "false"}
                className={`
                    relative inline-flex items-center justify-center font-sans tracking-tight
                    ${sizeConfig.container}
                    ${sizeConfig.minHeight}
                    ${VARIANT_STYLES[variant] || VARIANT_STYLES.yellow}
                    ${borderClass}
                    ${shadowClass}
                    ${uppercase ? "uppercase tracking-wider" : ""}
                    ${fullWidth ? "w-full" : "w-auto shrink-0"}
                    select-none transition-all duration-150
                    ${
                        loading
                            ? "cursor-wait opacity-95 pointer-events-none active:translate-x-0 active:translate-y-0"
                            : disabled
                            ? "cursor-not-allowed opacity-50 shadow-none pointer-events-none"
                            : "cursor-pointer hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]"
                    }
                    ${className}
                `}
                {...props}
            >
                {/* 
                  Dual-Layer CSS Grid technique:
                  Both Normal and Loading states occupy the exact same grid cell (col-1, row-1).
                  This naturally sizes the button container to max(normal, loading) width/height,
                  preventing ANY width jump or layout shift when loading toggles!
                */}
                <span className="grid grid-cols-1 grid-rows-1 items-center justify-items-center w-full">
                    {/* LAYER 1: Normal Content */}
                    <span
                        className={`col-start-1 row-start-1 inline-flex items-center justify-center ${sizeConfig.gap} transition-opacity duration-150 ${
                            loading ? "invisible opacity-0 pointer-events-none select-none" : "visible opacity-100"
                        }`}
                        aria-hidden={loading ? "true" : undefined}
                    >
                        {renderedIcon && <span className="shrink-0 flex items-center justify-center">{renderedIcon}</span>}
                        {children && <span className="truncate leading-none">{children}</span>}
                        {renderedIconRight && <span className="shrink-0 flex items-center justify-center">{renderedIconRight}</span>}
                    </span>

                    {/* LAYER 2: Loading State with Morphing Hourglass */}
                    <span
                        className={`col-start-1 row-start-1 inline-flex items-center justify-center ${sizeConfig.gap} transition-opacity duration-150 ${
                            loading ? "visible opacity-100" : "invisible opacity-0 pointer-events-none select-none"
                        }`}
                        aria-hidden={!loading ? "true" : undefined}
                    >
                        <OrbixLoaderIcon
                            size={sizeConfig.iconSize}
                            speed="normal"
                            color="currentColor"
                            className="shrink-0"
                        />
                        {size !== "icon" && (
                            <span className="truncate leading-none">{resolvedLoadingLabel}</span>
                        )}
                    </span>
                </span>
            </button>
        );
    }
);

OrbixButton.displayName = "OrbixButton";
