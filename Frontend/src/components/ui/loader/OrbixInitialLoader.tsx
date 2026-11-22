import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, ArrowRight } from "lucide-react";

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
 * Shares the lightweight branded intro with the pre-JavaScript startup screen.
 * Renders full-screen at high z-index via React Portal (by default) to break out of
 * local form containers, panels, or nested stacking contexts.
 */
export const OrbixInitialLoader: React.FC<OrbixInitialLoaderProps> = ({
    message = "Initializing Orbix...",
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
    const [counter, setCounter] = useState(0);

    useEffect(() => {
        const start = performance.now();
        const timer = window.setInterval(() => {
            const next = Math.min(94, Math.round(94 * (1 - Math.exp(-(performance.now() - start) / 650))));
            setCounter(next);
            if (next === 94) window.clearInterval(timer);
        }, 60);
        return () => window.clearInterval(timer);
    }, []);

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

    const loaderContent = (
        <div
            className={`orbix-intro ${fullscreen ? "" : "orbix-intro--contained"} ${className}`}
            style={{ zIndex }}
            role="status"
            aria-live="polite"
            aria-label={message}
        >
            <span className="orbix-intro__counter" aria-hidden="true">{String(counter).padStart(3, '0')}</span>
            <div className="orbix-intro__middle" aria-hidden="true">
                <img className="orbix-intro__pixels" src="/orbix-pixel-loader.svg" width="118" height="118" alt="" />
            </div>
            <div className="orbix-intro__word" aria-hidden="true">
                {'ORBIX'.split('').map(letter => <span key={letter}>{letter}</span>)}
            </div>
                {hasTimedOut && (onRetry || onBypass) && (
                    <div className="orbix-intro__recovery" style={{ display: "flex", gap: 20 }}>
                        {onRetry && <button type="button" onClick={onRetry}><RefreshCw size={12} style={{ display: "inline", marginRight: 6 }} />Try again</button>}
                        {onBypass && <button type="button" onClick={onBypass}>Continue <ArrowRight size={12} style={{ display: "inline", marginLeft: 6 }} /></button>}
                    </div>
                )}
        </div>
    );

    if (fullscreen && usePortal && typeof document !== "undefined") {
        return createPortal(loaderContent, document.body);
    }

    return loaderContent;
};

export default OrbixInitialLoader;
