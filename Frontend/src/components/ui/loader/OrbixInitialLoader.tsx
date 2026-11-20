import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ArrowRight } from "lucide-react";
import { OrbixLogo } from "../../OrbixLogo";
import { OrbixLoader } from "./OrbixLoader";

export interface OrbixInitialLoaderProps {
    message?: string;
    subMessage?: string;
    timeoutMs?: number;
    onTimeout?: () => void;
    onRetry?: () => void;
    onBypass?: () => void;
    className?: string;
    fullscreen?: boolean;
    usePortal?: boolean;
    zIndex?: number | string;
}

/**
 * OrbixInitialLoader
 *
 * Authoritative startup, authentication resolution, and redirection loading screen.
 * Reuses the authoritative Orbix brand logo and continuous morphing SVG hourglass loader.
 * Renders full-screen at high z-index via React Portal (by default) to break out of
 * local form containers, panels, or nested stacking contexts.
 */
export const OrbixInitialLoader: React.FC<OrbixInitialLoaderProps> = ({
    message = "Initializing Orbix...",
    subMessage: _subMessage,
    timeoutMs = 6000,
    onTimeout,
    onRetry,
    onBypass,
    className = "",
    fullscreen = true,
    usePortal = true,
    zIndex = 99990,
}) => {
    const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);

    // Lock body scroll when fullscreen loader is active
    useEffect(() => {
        if (!fullscreen || typeof document === "undefined") return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [fullscreen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setHasTimedOut(true);
            if (onTimeout) {
                onTimeout();
            }
        }, timeoutMs);

        return () => {
            clearTimeout(timer);
        };
    }, [timeoutMs, onTimeout]);

    const containerClasses = fullscreen
        ? `fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100svh] min-w-full overflow-hidden flex flex-col items-center justify-center p-6 select-none bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-neutral-900 pointer-events-auto ${className}`
        : `min-h-screen w-full relative flex flex-col items-center justify-center p-6 select-none bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-neutral-900 ${className}`;

    const containerStyle = fullscreen ? { zIndex } : undefined;

    const loaderContent = (
        <div
            className={containerClasses}
            style={containerStyle}
            role="status"
            aria-live="polite"
            aria-label={message}
        >
            <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center space-y-8 max-w-sm w-full mx-auto"
            >
                {/* Centered Authoritative Orbix Branding Group */}
                <div className="flex flex-col items-center space-y-3">
                    {/* Official Orbix Logo */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                        <OrbixLogo className="w-full h-full text-black hover:scale-105 transition-transform" />
                    </div>

                    {/* Orbix Wordmark */}
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-black text-black tracking-tight leading-none">
                            Orbix
                        </h1>
                    </div>
                </div>

                {/* Central Continuous Morphing Hourglass Loader (Global OrbixLoader) */}
                <div className="flex flex-col items-center pt-2">
                    <OrbixLoader
                        size={56}
                        variant="minimal"
                        speed="normal"
                        color="#000000"
                        accentColor="#a2ff86"
                    />
                </div>

                {/* Safety Timeout Recovery Controls */}
                <AnimatePresence>
                    {hasTimedOut && (onRetry || onBypass) && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="w-full pt-4 space-y-3 flex flex-col items-center"
                        >
                            <div className="flex items-center gap-2.5">
                                {onRetry && (
                                    <button
                                        type="button"
                                        onClick={onRetry}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ef56e] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Retry</span>
                                    </button>
                                )}
                                {onBypass && (
                                    <button
                                        type="button"
                                        onClick={onBypass}
                                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[0.5px] active:translate-y-[0.5px] text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                                    >
                                        <span>Continue</span>
                                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );

    if (fullscreen && usePortal && typeof document !== "undefined") {
        return createPortal(loaderContent, document.body);
    }

    return loaderContent;
};

export default OrbixInitialLoader;
