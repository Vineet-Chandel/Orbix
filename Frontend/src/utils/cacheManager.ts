import { invalidateSubmissions } from "../store/submissionsSlice";
import { clearDevelopmentCache } from "../store/developmentSlice";
import { clearContestsCache } from "../store/contestsSlice";
import { clearBadgesCache } from "../store/badgesSlice";
import { invalidatePublicProfileClientCache } from "./profileApi";

/**
 * Universally invalidates all platform-dependent cached data across Redux,
 * LocalStorage, in-memory caches, and dispatches cross-window update events.
 *
 * This ensures that as soon as any platform account is added, edited, or removed,
 * no stale data lingers and all charts/tables re-sync dynamically with zero glitches.
 */
export function invalidateConnectedPlatformCaches(dispatch?: any, username?: string) {
    const cleanUser = username?.trim();

    try {
        if (cleanUser) {
            // Remove specific user entries from localStorage caches
            for (const key of [
                "orbix_unified_submissions",
                "orbix_unified_development",
                "orbix_unified_contests",
                "orbix_unified_badges",
            ]) {
                try {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        delete parsed[cleanUser];
                        delete parsed[cleanUser.toLowerCase()];
                        localStorage.setItem(key, JSON.stringify(parsed));
                    }
                } catch {
                    // Safe fallback
                }
            }
        } else {
            // Clear entire cache buckets if user is unspecified
            localStorage.removeItem("orbix_unified_submissions");
            localStorage.removeItem("orbix_unified_development");
            localStorage.removeItem("orbix_unified_contests");
            localStorage.removeItem("orbix_unified_badges");
        }
    } catch {
        // Safe fallback
    }

    // Invalidate public profile memory cache
    invalidatePublicProfileClientCache(cleanUser);

    // Invalidate Redux slices
    if (dispatch) {
        try {
            dispatch(invalidateSubmissions(cleanUser));
            dispatch(clearDevelopmentCache(cleanUser));
            dispatch(clearContestsCache(cleanUser));
            dispatch(clearBadgesCache(cleanUser));
        } catch {
            // Safe fallback
        }
    }

    // Broadcast across windows and tabs
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("orbix_portals_updated"));
        window.dispatchEvent(new Event("storage"));
    }
}
