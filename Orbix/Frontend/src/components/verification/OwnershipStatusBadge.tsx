import React from "react";
import type { OwnershipStatus } from "../../types/platformVerification";
import { VerifiedBadge } from "../VerifiedBadge";
import { AlertCircle, Clock, ShieldAlert, HelpCircle } from "lucide-react";

export interface OwnershipStatusBadgeProps {
    status?: OwnershipStatus | "PENDING" | "UNSUPPORTED" | string | null;
    isSupported?: boolean;
    size?: "xs" | "sm" | "md";
    showLabel?: boolean;
    className?: string;
    onClick?: () => void;
}

export const OwnershipStatusBadge: React.FC<OwnershipStatusBadgeProps> = ({
    status = "CONNECTED_UNVERIFIED",
    isSupported = true,
    size = "sm",
    showLabel = true,
    className = "",
    onClick,
}) => {
    // If platform is not supported for verification, show unsupported state
    if (!isSupported) {
        return (
            <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-300 text-[10px] font-bold tracking-tight select-none ${className}`}
                title="Cryptographic ownership verification is not available for this platform."
            >
                <HelpCircle className="w-3 h-3 text-neutral-400 stroke-[2.5]" />
                {showLabel && <span>Verification Unavailable</span>}
            </span>
        );
    }

    if (status === "VERIFIED") {
        return (
            <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 text-sky-950 border-2 border-black text-[10px] font-black tracking-wide shadow-[1px_1px_0px_#000] select-none ${className}`}
                title="Cryptographic account ownership verified."
            >
                <VerifiedBadge size={size === "xs" ? "xs" : size === "md" ? "md" : "sm"} />
                {showLabel && <span className="uppercase">Verified</span>}
            </span>
        );
    }

    if (status === "PENDING") {
        return (
            <span
                onClick={onClick}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#FFE566] text-black border-2 border-black text-[10px] font-black tracking-wide shadow-[1px_1px_0px_#000] animate-pulse select-none ${
                    onClick ? "cursor-pointer hover:shadow-none transition-all" : ""
                } ${className}`}
                title="Ownership verification challenge active."
            >
                <Clock className="w-3 h-3 text-black stroke-[3]" />
                {showLabel && <span className="uppercase">Verification Pending</span>}
            </span>
        );
    }

    if (status === "REVOKED") {
        return (
            <span
                onClick={onClick}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border-2 border-black text-[10px] font-black tracking-wide shadow-[1px_1px_0px_#000] select-none ${
                    onClick ? "cursor-pointer hover:shadow-none transition-all" : ""
                } ${className}`}
                title="Previously verified ownership was revoked."
            >
                <ShieldAlert className="w-3 h-3 text-rose-700 stroke-[2.5]" />
                {showLabel && <span className="uppercase">Ownership Revoked</span>}
            </span>
        );
    }

    // Default: CONNECTED_UNVERIFIED
    return (
        <span
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 border-2 border-black text-[10px] font-black tracking-wide shadow-[1px_1px_0px_#000] select-none ${
                onClick ? "cursor-pointer hover:bg-amber-100 hover:shadow-none transition-all" : ""
            } ${className}`}
            title="Account is connected but cryptographic ownership has not been proven."
        >
            <AlertCircle className="w-3 h-3 text-amber-600 stroke-[2.5]" />
            {showLabel && <span className="uppercase">Unverified</span>}
        </span>
    );
};
