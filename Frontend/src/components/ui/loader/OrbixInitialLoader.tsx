import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ArrowRight } from "lucide-react";
import { OrbixLogo } from "../../OrbixLogo";
import { OrbixLoaderIcon } from "./OrbixLoaderIcon";

export interface OrbixInitialLoaderProps {
    message?: string;
    subMessage?: string;
    timeoutMs?: number;
    onTimeout?: () => void;
    onRetry?: () => void;
    onBypass?: () => void;
    className?: string;
}

/**
 * OrbixInitialLoader
 *
 * Dedicated initial startup & authentication resolution loading screen.
 * Reuses the authoritative Orbix brand logo and continuous morphing SVG hourglass loader.
 * Employs Neo-Brutalist styling tokens and safety timeouts to guarantee users are
 * never trapped in an unrecoverable loading freeze.
 */
export const OrbixInitialLoader: React.FC<OrbixInitialLoaderProps> = ({
    message = "Initializing Orbix...",
    subMessage = "Verifying secure workspace session",
    timeoutMs = 6000,
    onTimeout,
    onRetry,
    onBypass,
    className = "",
}) => {
    const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        const timer = setTimeout(() => {
            setHasTimedOut(true);
            if (onTimeout) {
                onTimeout();
            }
        }, timeoutMs);

        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [timeoutMs, onTimeout]);

    return (
        <div
            className={`min-h-screen w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex flex-col items-center justify-center p-6 select-none ${className}`}
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
                {/* Enlarged Centered Orbix Branding Group */}
                <div className="flex flex-col items-center space-y-3">
                    {/* Enlarged Official Orbix Logo */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                        <OrbixLogo className="w-full h-full text-black hover:scale-105 transition-transform" />
                    </div>

                    {/* Enlarged Orbix Wordmark */}
                    <div className="space-y-1">
                        <h1 className="text-4xl sm:text-5xl font-black text-black tracking-tight leading-none">
                            Orbix
                        </h1>
                        <p className="text-xs sm:text-sm font-bold text-neutral-600 tracking-wider">
                            Empowering Dev Workflows
                        </p>
                    </div>
                </div>

                {/* Central Continuous Morphing Hourglass Loader (Centered, without card container) */}
                <div className="flex flex-col items-center space-y-3 pt-2">
                    <OrbixLoaderIcon
                        size={56}
                        speed="normal"
                        color="#000000"
                        accentColor="#a2ff86"
                    />
                    {message && (
                        <p className="text-xs font-bold text-neutral-600 tracking-wide">
                            {message}
                        </p>
                    )}
                    {subMessage && (
                        <p className="text-[11px] font-medium text-neutral-500">
                            {subMessage}
                        </p>
                    )}
                </div>

                {/* Safety Timeout Recovery Controls */}
                <AnimatePresence>
                    {hasTimedOut && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="w-full pt-4 space-y-3 flex flex-col items-center"
                        >
                            <p className="text-xs font-bold text-neutral-700 leading-snug">
                                Connection is taking longer than expected ({elapsedSeconds}s).
                            </p>
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
};

export default OrbixInitialLoader;
