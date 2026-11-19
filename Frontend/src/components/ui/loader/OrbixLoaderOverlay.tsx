import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OrbixLoaderOverlayProps {
    isOpen: boolean;
    fullscreen?: boolean;
    className?: string;
    children: React.ReactNode;
}

export const OrbixLoaderOverlay: React.FC<OrbixLoaderOverlayProps> = ({
    isOpen,
    fullscreen = false,
    className = "",
    children,
}) => {
    // Lock body scroll when fullscreen loader is active
    useEffect(() => {
        if (!fullscreen || !isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [fullscreen, isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className={`flex flex-col items-center justify-center select-none ${
                        fullscreen
                            ? "fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] bg-black/50 backdrop-blur-xs text-white"
                            : "absolute inset-0 z-50 bg-black/20 backdrop-blur-xs rounded-inherit text-white"
                    } ${className}`}
                    role="alertdialog"
                    aria-modal="true"
                    aria-busy="true"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
