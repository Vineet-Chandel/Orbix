import React from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useBlogLikes } from "../../hooks/useBlogLikes";
import { OrbixLoader } from "../../../../components/ui/loader";

export type BlogLikeButtonSize = "sm" | "md" | "lg" | "xl";

interface BlogLikeButtonProps {
    hoster: string;
    blogName: string;
    variant?: "card" | "header" | "badge";
    size?: BlogLikeButtonSize;
    className?: string;
}

const SIZE_CONFIG: Record<
    BlogLikeButtonSize,
    { icon: string; text: string; gap: string; padding: string }
> = {
    sm: {
        icon: "w-4 h-4",
        text: "text-xs font-semibold",
        gap: "gap-1.5",
        padding: "px-2 py-1 rounded-md",
    },
    md: {
        icon: "w-5 h-5 sm:w-6 sm:h-6",
        text: "text-sm sm:text-base font-bold",
        gap: "gap-2",
        padding: "px-2.5 py-1.5 rounded-lg",
    },
    lg: {
        icon: "w-7 h-7 sm:w-8 sm:h-8",
        text: "text-base sm:text-lg font-black",
        gap: "gap-2.5 sm:gap-3",
        padding: "px-3.5 py-2 rounded-xl",
    },
    xl: {
        icon: "w-9 h-9 sm:w-10 sm:h-10",
        text: "text-lg sm:text-xl font-black",
        gap: "gap-3 sm:gap-4",
        padding: "px-4 py-2.5 rounded-2xl",
    },
};

const LOADER_SIZES: Record<BlogLikeButtonSize, number> = {
    sm: 13,
    md: 15,
    lg: 17,
    xl: 19,
};

export const BlogLikeButton: React.FC<BlogLikeButtonProps> = ({
    hoster,
    blogName,
    variant = "card",
    size,
    className = "",
}) => {
    const { likeCount, likedByViewer, loading, isToggling, toggleLike } = useBlogLikes(hoster, blogName);

    // Resolve size: explicit size prop takes precedence, otherwise fallback to variant default
    const resolvedSize: BlogLikeButtonSize =
        size || (variant === "header" ? "md" : variant === "badge" ? "sm" : "lg");

    const config = SIZE_CONFIG[resolvedSize];

    // Format count for natural display (e.g. 1200 -> 1.2k)
    const formattedCount = React.useMemo(() => {
        if (likeCount >= 1000000) {
            return `${(likeCount / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
        }
        if (likeCount >= 1000) {
            return `${(likeCount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
        }
        return likeCount.toString();
    }, [likeCount]);

    return (
        <motion.button
            type="button"
            onClick={toggleLike}
            disabled={isToggling}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.9 }}
            className={`group inline-flex items-center ${config.gap} ${config.padding} bg-transparent border-0 shadow-none select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 hover:bg-red-50/80 dark:hover:bg-red-950/30 active:bg-red-100 dark:active:bg-red-950/50 disabled:opacity-70 transition-colors ${className}`}
            aria-label={likedByViewer ? "Unlike this publication" : "Like this publication"}
            aria-pressed={likedByViewer}
            title={likedByViewer ? "Unlike this publication" : "Like this publication"}
        >
            <motion.div
                key={likedByViewer ? "liked" : "unliked"}
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.25, 1] }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="flex items-center justify-center shrink-0"
            >
                <Heart
                    className={`${config.icon} transition-colors duration-150 ${
                        likedByViewer
                            ? "fill-red-500 text-red-500 stroke-red-500 stroke-[1.5]"
                            : "fill-none text-neutral-800 dark:text-neutral-200 group-hover:text-red-500 stroke-[2] transition-transform"
                    }`}
                />
            </motion.div>
            <span
                className={`font-mono ${config.text} tracking-tight tabular-nums transition-colors duration-150 leading-none inline-flex items-center justify-center ${
                    likedByViewer
                        ? "text-red-600 dark:text-red-400 font-bold"
                        : "text-neutral-800 dark:text-neutral-200 group-hover:text-black dark:group-hover:text-white"
                }`}
            >
                {loading ? (
                    <OrbixLoader
                        size={LOADER_SIZES[resolvedSize]}
                        variant="minimal"
                        color="currentColor"
                    />
                ) : (
                    formattedCount
                )}
            </span>
        </motion.button>
    );
};

export default BlogLikeButton;
