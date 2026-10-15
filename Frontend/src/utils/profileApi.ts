export interface PublicProfilePlatform {
    portal: string;
    portalUsername: string;
    link: string;
    verified: boolean;
    displayName?: string;
    avatarUrl?: string;
    stats: Array<{ label: string; value: string }>;
    isPublic: boolean;
    lastSyncStatus?: string;
    lastSyncAt?: string;
}

export interface PublicProfileData {
    id?: string;
    username: string;
    displayName: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    headline?: string;
    bio?: string;
    website?: string;
    location?: string;
    skills?: string[];
    isPublic: boolean;
    createdAt?: string;
    isOwner: boolean;
    platforms: PublicProfilePlatform[];
}

// In-memory client-side cache for public profile requests (5 minutes freshness)
const publicProfileCache = new Map<string, { data: PublicProfileData; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<PublicProfileData>>();
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

export const invalidatePublicProfileClientCache = (username?: string) => {
    if (username) {
        publicProfileCache.delete(username.toLowerCase().trim());
    } else {
        publicProfileCache.clear();
    }
};

/**
 * Fetch public profile by username with client-side caching & request deduplication
 */
export async function fetchPublicProfile(username: string, force = false): Promise<PublicProfileData> {
    const key = username.toLowerCase().trim();

    // Check client-side memory cache if not forced
    if (!force) {
        const cached = publicProfileCache.get(key);
        if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
            return cached.data;
        }
    }

    // Deduplicate in-flight requests
    if (inFlightRequests.has(key)) {
        return inFlightRequests.get(key)!;
    }

    const requestPromise = (async () => {
        const endpoints = [
            `/api/profile/public/${encodeURIComponent(key)}`,
            `http://localhost:3000/api/profile/public/${encodeURIComponent(key)}`,
            `/profile/public/${encodeURIComponent(key)}`,
        ];

        let lastError = "Unable to fetch profile";

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });

                if (response.ok) {
                    const json = await response.json();
                    if (json.success && json.profile) {
                        const profile = json.profile as PublicProfileData;
                        publicProfileCache.set(key, { data: profile, timestamp: Date.now() });
                        return profile;
                    }
                } else if (response.status === 404) {
                    const errJson = await response.json().catch(() => null);
                    throw new Error(errJson?.message || "Profile not found or is private.");
                }
            } catch (err: any) {
                if (err.message.includes("not found") || err.message.includes("private")) {
                    throw err;
                }
                lastError = err?.message || lastError;
            }
        }

        throw new Error(lastError);
    })();

    inFlightRequests.set(key, requestPromise);

    try {
        const result = await requestPromise;
        return result;
    } finally {
        inFlightRequests.delete(key);
    }
}

/**
 * Update authenticated user's profile details
 */
export async function updateProfile(payload: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    bio?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    website?: string;
    location?: string;
    skills?: string[];
    isPublic?: boolean;
}): Promise<any> {
    const endpoints = ["/api/profile", "http://localhost:3000/api/profile"];
    let lastError = "Failed to update profile";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json.user;
            } else {
                const errJson = await response.json().catch(() => null);
                throw new Error(errJson?.message || "Failed to update profile");
            }
        } catch (err: any) {
            lastError = err.message || lastError;
        }
    }

    throw new Error(lastError);
}

/**
 * Toggle platform visibility
 */
export async function togglePlatformVisibility(portal: string, isPublic: boolean): Promise<any> {
    const endpoints = [
        `/api/portals/${portal}/visibility`,
        `http://localhost:3000/api/portals/${portal}/visibility`,
        `/api/profile/platforms/${portal}/visibility`,
        `http://localhost:3000/api/profile/platforms/${portal}/visibility`,
    ];

    let lastError = "Failed to update platform visibility";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ isPublic }),
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json.platform;
            }
        } catch (err: any) {
            lastError = err.message || lastError;
        }
    }

    throw new Error(lastError);
}

/**
 * Disconnect a platform
 */
export async function disconnectPlatform(portal: string): Promise<boolean> {
    const endpoints = [
        `/api/portals/${portal}`,
        `http://localhost:3000/api/portals/${portal}`,
        `/api/profile/platforms/${portal}`,
        `http://localhost:3000/api/profile/platforms/${portal}`,
    ];

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (response.ok) {
                invalidatePublicProfileClientCache();
                return true;
            }
        } catch {
            // continue
        }
    }

    throw new Error(`Failed to disconnect ${portal}`);
}

/**
 * Edit a platform handle / link
 */
export async function editPlatformHandle(portal: string, handleOrLink: string): Promise<any> {
    const endpoints = [
        `/api/portals/${portal}`,
        `http://localhost:3000/api/portals/${portal}`,
        `/api/profile/platforms/${portal}`,
        `http://localhost:3000/api/profile/platforms/${portal}`,
    ];

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ handle: handleOrLink }),
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json.platform;
            }
        } catch {
            // continue
        }
    }

    throw new Error(`Failed to update ${portal}`);
}
