import React from "react";

export interface VerifiedBadgeProps {
    size?: "xs" | "sm" | "md" | "lg" | "xl";
    className?: string;
    title?: string;
    showLabel?: boolean;
    labelText?: string;
}

const SIZE_MAP: Record<string, string> = {
    xs: "w-3.5 h-3.5",
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
    xl: "w-7 h-7",
};

/**
 * X.com / Twitter-style Blue Verified Badge
 * Iconic 8-pointed scalloped star with crisp white checkmark in verified Twitter Blue (#1D9BF0).
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
    size = "sm",
    className = "",
    title = "Verified",
    showLabel = false,
    labelText = "Verified",
}) => {
    const sizeClasses = SIZE_MAP[size] || SIZE_MAP.sm;

    const icon = (
        <svg
            viewBox="0 0 24 24"
            aria-label={title}
            className={`inline-block shrink-0 select-none ${sizeClasses} ${className}`}
            style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.15))" }}
        >
            <title>{title}</title>
            {/* Scalloped 8-pointed Rosette Star */}
            <path
                d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
                fill="#1D9BF0"
            />
            {/* Crisp Center Checkmark */}
            <path
                d="M10.54 16.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
                fill="#FFFFFF"
            />
        </svg>
    );

    if (showLabel) {
        return (
            <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-950 border border-sky-300 text-[11px] font-black shadow-[1px_1px_0px_#000]"
                title={title}
            >
                {icon}
                <span>{labelText}</span>
            </span>
        );
    }

    return icon;
};

export default VerifiedBadge;
