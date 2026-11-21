import React from "react";

/**
 * lazyWithRetry
 *
 * Resilient wrapper around React.lazy() that automatically retries failed
 * dynamic module imports (e.g., intermittent network drops or freshly deployed chunks).
 *
 * If retries are exhausted, it throws to the enclosing ErrorBoundary with
 * user-friendly recovery options.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
    componentImport: () => Promise<{ default: T }>,
    maxRetries = 2,
    retryDelayMs = 1000
): React.LazyExoticComponent<T> {
    return React.lazy(async () => {
        let attempts = 0;

        while (attempts <= maxRetries) {
            try {
                return await componentImport();
            } catch (error: any) {
                attempts += 1;

                // If user is explicitly offline, don't spin retries silently
                const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

                if (attempts > maxRetries || isOffline) {
                    // Check if this looks like a chunk loading / network error
                    const message = error?.message || "";
                    const isChunkError =
                        message.includes("dynamically imported module") ||
                        message.includes("Loading chunk") ||
                        message.includes("Failed to fetch") ||
                        error?.name === "ChunkLoadError";

                    if (isChunkError) {
                        const enhancedError = new Error(
                            isOffline
                                ? "You appear to be offline. Please verify your internet connection and try again."
                                : "A network hiccup interrupted loading this page. Please click retry to continue."
                        );
                        (enhancedError as any).isChunkError = true;
                        (enhancedError as any).originalError = error;
                        throw enhancedError;
                    }

                    throw error;
                }

                // Wait before retrying with slight backoff
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempts));
            }
        }

        throw new Error("Failed to load component after multiple attempts.");
    });
}

export default lazyWithRetry;
