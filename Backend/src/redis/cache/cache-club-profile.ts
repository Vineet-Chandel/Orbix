import redis from "../client.js";

const CLUB_PUBLIC_CACHE_PREFIX = "cache:club:public:";
const CLUB_WORKSPACE_CACHE_PREFIX = "cache:club:workspace:";

/**
 * Get cached public club profile
 */
export async function getCachedPublicClubProfile(slug: string): Promise<any | null> {
    try {
        if (!redis) return null;
        const key = `${CLUB_PUBLIC_CACHE_PREFIX}${slug.toLowerCase()}`;
        const raw = await redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Set cached public club profile (10 minutes)
 */
export async function setCachedPublicClubProfile(slug: string, data: any, ttlSeconds = 600): Promise<void> {
    try {
        if (!redis) return;
        const key = `${CLUB_PUBLIC_CACHE_PREFIX}${slug.toLowerCase()}`;
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch {
        // Non-fatal cache write failure
    }
}

/**
 * Get cached workspace club profile for an authenticated manager/user
 */
export async function getCachedWorkspaceClubProfile(cacheKey: string): Promise<any | null> {
    try {
        if (!redis) return null;
        const key = `${CLUB_WORKSPACE_CACHE_PREFIX}${cacheKey.toLowerCase()}`;
        const raw = await redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Set cached workspace club profile (15 minutes)
 */
export async function setCachedWorkspaceClubProfile(cacheKey: string, data: any, ttlSeconds = 900): Promise<void> {
    try {
        if (!redis) return;
        const key = `${CLUB_WORKSPACE_CACHE_PREFIX}${cacheKey.toLowerCase()}`;
        await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch {
        // Non-fatal cache write failure
    }
}

/**
 * Invalidate all public club profile cache keys
 */
export async function invalidateClubProfileCache(slug?: string, otherSlugs: string[] = []): Promise<void> {
    try {
        if (!redis) return;
        const keysToDelete: string[] = [];
        if (slug) {
            keysToDelete.push(`${CLUB_PUBLIC_CACHE_PREFIX}${slug.toLowerCase()}`);
        }
        for (const s of otherSlugs) {
            if (s) keysToDelete.push(`${CLUB_PUBLIC_CACHE_PREFIX}${s.toLowerCase()}`);
        }

        if (keysToDelete.length > 0) {
            await redis.del(...keysToDelete);
        }
    } catch {
        // Non-fatal cache invalidation failure
    }
}

/**
 * Get cached user's active club id
 */
export async function getCachedUserActiveClubId(userId: string): Promise<string | null> {
    try {
        if (!redis) return null;
        return await redis.get(`cache:club:user_active_club:${userId.toLowerCase()}`);
    } catch {
        return null;
    }
}

/**
 * Set cached user's active club id (24 hours)
 */
export async function setCachedUserActiveClubId(userId: string, clubId: string, ttlSeconds = 86400): Promise<void> {
    try {
        if (!redis) return;
        await redis.setex(`cache:club:user_active_club:${userId.toLowerCase()}`, ttlSeconds, clubId);
    } catch {
        // Non-fatal
    }
}

/**
 * Invalidate workspace club profile caches for a club and associated users
 */
export async function invalidateClubWorkspaceCache(clubId: string, userIds: string[] = []): Promise<void> {
    try {
        if (!redis) return;
        const keysToDelete = new Set<string>();
        keysToDelete.add(`${CLUB_WORKSPACE_CACHE_PREFIX}${clubId.toLowerCase()}`);
        keysToDelete.add(`${CLUB_WORKSPACE_CACHE_PREFIX}club:${clubId.toLowerCase()}`);

        for (const uid of userIds) {
            if (uid) {
                keysToDelete.add(`${CLUB_WORKSPACE_CACHE_PREFIX}user:${uid.toLowerCase()}`);
                keysToDelete.add(`${CLUB_WORKSPACE_CACHE_PREFIX}${clubId.toLowerCase()}:${uid.toLowerCase()}`);
                keysToDelete.add(`${CLUB_WORKSPACE_CACHE_PREFIX}club:${clubId.toLowerCase()}:${uid.toLowerCase()}`);
                keysToDelete.add(`cache:club:user_active_club:${uid.toLowerCase()}`);
            }
        }

        try {
            const matched = await redis.keys(`${CLUB_WORKSPACE_CACHE_PREFIX}*${clubId.toLowerCase()}*`);
            for (const k of matched) {
                keysToDelete.add(k);
            }
        } catch {
            // Non-fatal pattern match fallback
        }

        if (keysToDelete.size > 0) {
            await redis.del(...Array.from(keysToDelete));
        }
    } catch {
        // Non-fatal cache invalidation failure
    }
}

/**
 * Complete invalidation across public and workspace caches
 */
export async function invalidateAllClubCaches(clubId: string, slug?: string, userIds: string[] = []): Promise<void> {
    await Promise.allSettled([
        invalidateClubProfileCache(slug),
        invalidateClubWorkspaceCache(clubId, userIds),
    ]);
}
