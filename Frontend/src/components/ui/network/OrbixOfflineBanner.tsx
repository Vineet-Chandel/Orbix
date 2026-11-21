import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, CheckCircle2, X } from "lucide-react";
import { useNetworkStatus } from "./useNetworkStatus";

export const OrbixOfflineBanner: React.FC = () => {
    const { isOnline, isReconnected } = useNetworkStatus();
    const [isDismissed, setIsDismissed] = useState(false);

    // Reset dismiss state if status changes to offline
    React.useEffect(() => {
        if (!isOnline) {
            setIsDismissed(false);
        }
    }, [isOnline]);

    const isVisible = (!isOnline || isReconnected) && !isDismissed;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -16, x: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, x: 16, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed top-5 sm:top-6 right-4 sm:right-6 z-[99999] pointer-events-auto max-w-[calc(100vw-2rem)] select-none"
                    role="status"
                    aria-live="polite"
                >
                    {!isOnline ? (
                        <div className="flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-[#FFE566] text-black border-2 border-black shadow-[4px_4px_0px_#000] text-xs font-black">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                            <WifiOff className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                            <span className="truncate">
                                You are offline. Changes will sync once reconnected.
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsDismissed(true)}
                                className="p-0.5 ml-1 text-black hover:bg-black/10 rounded-md transition-colors cursor-pointer shrink-0"
                                aria-label="Dismiss offline notice"
                            >
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black shadow-[4px_4px_0px_#000] text-xs font-black">
                            <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5] shrink-0" />
                            <span>Connection restored!</span>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default OrbixOfflineBanner;
