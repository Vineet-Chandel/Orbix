import React from "react";
import { AdaptiveImageDropzone } from "./media/AdaptiveImageDropzone";

export interface NeoImageDropzoneProps {
    placementId?: string;
    label?: string;
    headline?: string;
    subtext?: string;
    value?: string | null;
    onChange: (file: File) => Promise<void> | void;
    onRemove?: () => void;
    isUploading?: boolean;
    uploadProgress?: number | null;
    aspectRatio?: "square" | "banner" | "avatar";
    maxSizeMB?: number;
    recommendedNote?: string;
    allowedExtensions?: string[];
    accept?: string;
    disabled?: boolean;
    className?: string;
}

/**
 * NeoImageDropzone — Powered by Orbix Adaptive Image System
 * Provides backward compatibility for all existing dropzones while delivering
 * full interactive framing, zooming, rotation, safe-area previews, and multi-context rendering.
 */
export const NeoImageDropzone: React.FC<NeoImageDropzoneProps> = ({
    placementId,
    aspectRatio = "square",
    maxSizeMB,
    ...props
}) => {
    // Resolve placement ID
    const effectivePlacementId =
        placementId ||
        (aspectRatio === "banner"
            ? "event_banner"
            : aspectRatio === "avatar"
            ? "club_coordinator"
            : "club_achievement");

    return (
        <AdaptiveImageDropzone
            placementId={effectivePlacementId}
            customConfig={maxSizeMB ? { maxFileSizeMB: maxSizeMB } : undefined}
            {...props}
        />
    );
};

export default NeoImageDropzone;
