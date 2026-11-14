import React, { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Share2 } from "lucide-react";
import { useEventEngagement } from "../../hooks/useEventEngagement";
import { OrbixLoader } from "../ui/loader";
import { EventShareModal } from "./EventShareModal";

export type EventActionRowSize = "sm" | "md" | "lg" | "xl";

export interface EventActionRowProps {
    eventId: string;
    eventTitle?: string;
    eventSummary?: string;
    initialLikeCount?: number;
    initialLiked?: boolean;
    initialShareCount?: number;
    size?: EventActionRowSize;
    className?: string;
}

const SIZE_CONFIG: Record<
    EventActionRowSize,
    { icon: string; text: string; gap: string; rowGap: string; loaderSize: number }
> = {
    sm: {
        icon: "w-3.5 h-3.5 sm:w-4 sm:h-4",
        text: "text-xs font-bold",
        gap: "gap-1.5",
        rowGap: "gap-3 sm:gap-3.5",
        loaderSize: 13,
    },
    md: {
        icon: "w-6 h-6 sm:w-7 sm:h-7",
        text: "text-base sm:text-lg font-black",
        gap: "gap-2 sm:gap-2.5",
        rowGap: "gap-5 sm:gap-6",
        loaderSize: 18,
    },
    lg: {
        icon: "w-7 h-7 sm:w-8 sm:h-8",
        text: "text-lg sm:text-xl font-black",
        gap: "gap-2.5 sm:gap-3",
        rowGap: "gap-6 sm:gap-7",
        loaderSize: 20,
    },
    xl: {
        icon: "w-8 h-8 sm:w-9 sm:h-9",
        text: "text-xl sm:text-2xl font-black",
        gap: "gap-3 sm:gap-3.5",
        rowGap: "gap-7 sm:gap-8",
        loaderSize: 22,
    },
};

function formatCompactNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return String(num || 0);
}

/**
 * EventActionRow
 * Instagram-inspired compact action bar for events:
 * [Heart Icon + Like Count]   [Share Icon + Share Count]
 * Features optimistic updates, instant SWR cache display, dynamic OrbixLoader, and multi-instance sync.
 */
export const EventActionRow: React.FC<EventActionRowProps> = ({
    eventId,
    eventTitle,
    eventSummary,
    initialLikeCount,
    initialLiked,
    initialShareCount,
    size = "sm",
    className = "",
}) => {
    const {
        likeCount,
        likedByViewer,
        shareCount,
        loading,
        isLiking,
        isSharing,
        toggleLike,
        shareEvent,
        copyEventLink,
        shareEventInternally,
    } = useEventEngagement(eventId, {
        eventTitle,
        eventSummary,
        initialLikeCount,
        initialLiked,
        initialShareCount,
    });

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const config = SIZE_CONFIG[size];
    const formattedLikeCount = formatCompactNumber(likeCount);
    const formattedShareCount = formatCompactNumber(shareCount);

    const handleLikeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        toggleLike();
    };

    const handleShareClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsShareModalOpen(true);
    };

    return (
        <div
            className={`inline-flex items-center ${config.rowGap} ${className}`}
            onClick={(e) => e.stopPropagation()}
            role="toolbar"
            aria-label="Event actions"
        >
            {/* 1. Like Button */}
            <motion.button
                type="button"
                onClick={handleLikeClick}
                disabled={isLiking}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                className={`group inline-flex items-center ${config.gap} bg-transparent border-0 shadow-none select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all`}
                aria-label={likedByViewer ? "Unlike event" : "Appreciate event"}
                aria-pressed={likedByViewer}
                title={likedByViewer ? "Unlike event" : "Appreciate event"}
            >
                <motion.div
                    key={likedByViewer ? "liked" : "unliked"}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.8, 1.25, 1] }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="flex items-center justify-center shrink-0"
                >
                    <Heart
                        className={`${config.icon} transition-colors duration-150 drop-shadow-sm ${
                            likedByViewer
                                ? "fill-rose-500 text-rose-500 stroke-rose-500 stroke-[1.5]"
                                : "fill-none text-neutral-900 dark:text-neutral-100 group-hover:text-rose-500 stroke-[2.2]"
                        }`}
                    />
                </motion.div>
                <span
                    className={`font-mono ${config.text} tracking-tight tabular-nums transition-colors duration-150 leading-none inline-flex items-center justify-center min-w-[1ch] drop-shadow-sm ${
                        likedByViewer
                            ? "text-rose-600 dark:text-rose-400 font-black"
                            : "text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white font-black"
                    }`}
                >
                    {loading ? (
                        <OrbixLoader
                            size={config.loaderSize}
                            variant="minimal"
                            color="currentColor"
                        />
                    ) : (
                        formattedLikeCount
                    )}
                </span>
            </motion.button>

            {/* 2. Share Button */}
            <motion.button
                type="button"
                onClick={handleShareClick}
                disabled={isSharing}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                className={`group inline-flex items-center ${config.gap} bg-transparent border-0 shadow-none select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all`}
                aria-label="Share event"
                title="Share event link"
            >
                <div className="flex items-center justify-center shrink-0">
                    <Share2
                        className={`${config.icon} transition-colors duration-150 text-neutral-900 dark:text-neutral-100 group-hover:text-blue-500 stroke-[2.2] drop-shadow-sm`}
                    />
                </div>
                <span
                    className={`font-mono ${config.text} tracking-tight tabular-nums transition-colors duration-150 leading-none inline-flex items-center justify-center min-w-[1ch] text-neutral-900 dark:text-neutral-100 group-hover:text-black dark:group-hover:text-white font-black drop-shadow-sm`}
                >
                    {loading ? (
                        <OrbixLoader
                            size={config.loaderSize}
                            variant="minimal"
                            color="currentColor"
                        />
                    ) : (
                        formattedShareCount
                    )}
                </span>
            </motion.button>

            {/* 3. Event Share Modal */}
            <EventShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                eventId={eventId}
                eventTitle={eventTitle}
                eventSummary={eventSummary}
                shareCount={shareCount}
                onInternalShare={shareEventInternally}
                onNativeShare={shareEvent}
                onCopyLink={copyEventLink}
            />
        </div>
    );
};

export default EventActionRow;
