import React from "react";

interface SectionBottomIllustrationProps {
    className?: string;
    imgClassName?: string;
    alt?: string;
}

/**
 * Smart bottom desk illustration grounded cleanly at the bottom of Orbix sections.
 * 
 * - `shrink-0`: Prevents flexbox compression so the image is never squashed and the container remains fully scrollable.
 * - `mt-auto`: Anchors the illustration at the very bottom when content is minimal or empty, keeping headers at the top.
 * - `w-full h-auto`: Preserves the natural 1916x675 aspect ratio so no parts (e.g. lamp, plants, shelf) are ever cut off.
 */
export const SectionBottomIllustration: React.FC<SectionBottomIllustrationProps> = ({
    className = "",
    imgClassName = "",
    alt = "Orbix workspace illustration",
}) => {
    return (
        <footer
            aria-label="Section decorative illustration"
            className={`w-full mt-auto pt-4 sm:pt-6 shrink-0 select-none pointer-events-none rounded-b-[14px] ${className}`}
        >
            <img
                src="/image.png"
                alt={alt}
                className={`w-full h-auto block rounded-b-[14px] ${imgClassName}`}
                loading="eager"
            />
        </footer>
    );
};

export default SectionBottomIllustration;
