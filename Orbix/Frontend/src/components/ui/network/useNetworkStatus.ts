import { useState, useEffect } from "react";

export interface NetworkStatus {
    isOnline: boolean;
    wasOffline: boolean;
    isReconnected: boolean;
}

/**
 * useNetworkStatus
 *
 * Real-time reactive listener for browser online / offline state.
 * Employs native navigator.onLine and window online/offline events.
 * Provides a transient `isReconnected` flag to confirm recovery before dismissing notifications.
 */
export const useNetworkStatus = (): NetworkStatus => {
    const [isOnline, setIsOnline] = useState<boolean>(() => {
        return typeof navigator !== "undefined" ? navigator.onLine : true;
    });

    const [wasOffline, setWasOffline] = useState<boolean>(false);
    const [isReconnected, setIsReconnected] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleOnline = () => {
            setIsOnline(true);
            setWasOffline((prev) => {
                if (prev) {
                    setIsReconnected(true);
                    // Dismiss the green "reconnected" confirmation after 3.5 seconds
                    setTimeout(() => {
                        setIsReconnected(false);
                    }, 3500);
                    return false;
                }
                return false;
            });
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
            setIsReconnected(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    return {
        isOnline,
        wasOffline,
        isReconnected,
    };
};

export default useNetworkStatus;
